/** Credential races and rollback on isolated PostgreSQL; no live account or provider. */
import assert from "node:assert/strict";
import {randomUUID,randomBytes} from "node:crypto";
import pg from "pg";
import express from "express";
import {ensureSchema,createPostgresStore} from "../server/lib/store-postgres.ts";
import {hashPasswordAsync,signToken,verifyToken,verifyPasswordAsync} from "../server/lib/crypto.ts";
const url=new URL(process.env.LOAD_DATABASE_URL||"http://invalid");
assert.equal(process.env.CI,"true");
assert(["localhost","127.0.0.1","[::1]"].includes(url.hostname)&&url.pathname==="/yomu_load");
const secret=randomBytes(32).toString("hex");process.env.SYNC_JWT_SECRET=secret;
const {createApiRouter}=await import("../server/api.ts");
const options={connectionString:url.toString(),max:1,connectionTimeoutMillis:5000,statement_timeout:10000,query_timeout:12000};
const pools=[new pg.Pool(options),new pg.Pool(options)],observer=new pg.Pool(options),accounts=createPostgresStore(observer);
const servers=[],bases=[],users=[],releases=[];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let beforeChange=null,afterPassword=null,loginEntered=null,failInsert=false;
const hold=()=>{const h={entered:deferred(),release:deferred()};releases.push(h.release.resolve);return h;};
const password="synthetic-credential-password",next="synthetic-new-password",hash=await hashPasswordAsync(password);
const sql=(pool,index)=>({
 query:(...args)=>pool.query(...args),
 async connect(){
  const c=await pool.connect();
  return {release:error=>c.release(error),async query(text,params){
   if(index===0&&failInsert&&text.startsWith("INSERT INTO sessions")){failInsert=false;throw Error("synthetic session insert failure");}
   const result=await c.query(text,params);
   if(index===0&&afterPassword&&text.startsWith("UPDATE users SET password_hash")){
    const h=afterPassword;afterPassword=null;h.entered.resolve();await h.release.promise;
   }
   return result;
  }};
 }
});
async function call(index,path,token,body){
 const response=await fetch(bases[index]+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 return {status:response.status,data:await response.json()};
}
async function account(){
 const u={id:randomUUID(),email:randomUUID()+"@example.test",passwordHash:hash,plan:"free",createdAt:Date.now()};
 users.push(u.id);await accounts.createUser(u);
 const sid=randomUUID();await accounts.createSession({id:sid,userId:u.id,createdAt:Date.now(),expiresAt:Date.now()+600000});
 await accounts.setSync(u.id,{blob:{items:[{id:"keep",chapter:37}],updatedAt:1},updatedAt:1});
 return {...u,sid,token:signToken({sub:u.id,jti:sid},secret)};
}
try{
 await ensureSchema(observer);
 for(let i=0;i<2;i++){
  const store=createPostgresStore(sql(pools[i],i)),change=store.changeCredentials,login=store.createVerifiedSession;
  store.changeCredentials=async(...args)=>{
   if(i===0&&beforeChange){const h=beforeChange;beforeChange=null;h.entered.resolve();await h.release.promise;}
   return change(...args);
  };
  store.createVerifiedSession=async(...args)=>{if(i===1&&loginEntered){loginEntered.resolve();loginEntered=null;}return login(...args);};
  const app=express();app.use("/api",createApiRouter(store));
  let server;await new Promise(r=>{server=app.listen(0,"127.0.0.1",r);});servers.push(server);bases.push("http://127.0.0.1:"+server.address().port+"/api");
 }
 // A paid webhook arriving while the password check runs must survive an email edit.
 const paid=await account(),edit=hold();beforeChange=edit;
 const editing=call(0,"/auth/email",paid.token,{current:password,email:"new-"+paid.email});
 await edit.entered.promise;await accounts.applyBillingEvent(paid.id,"pro",{provider:"stripe",eventId:randomUUID()});
 edit.release.resolve();assert.equal((await editing).status,200);
 assert.equal((await accounts.getUserById(paid.id)).plan,"pro");
 assert.equal((await accounts.getSync(paid.id)).blob.items[0].chapter,37);
 // Once inside a password transaction, other connections still see the entire old state.
 const rotating=await account(),barrier=hold();afterPassword=barrier;
 const rotate=call(0,"/auth/password",rotating.token,{current:password,next});
 await barrier.entered.promise;
 assert.equal((await accounts.getUserById(rotating.id)).passwordHash,hash);
 assert(await accounts.getSession(rotating.sid));
 const arrived=deferred();loginEntered=arrived;
 const lateLogin=call(1,"/auth/login",null,{email:rotating.email,password});
 await arrived.promise;barrier.release.resolve();
 const changed=await rotate;assert.equal(changed.status,200);
 assert.equal((await lateLogin).status,401);
 assert.equal((await call(1,"/me",rotating.token)).status,401);
 assert.equal((await call(1,"/me",changed.data.token)).status,200);
 const replacement=verifyToken(changed.data.token,secret).jti;
 assert.equal((await observer.query("SELECT id FROM sessions WHERE user_id=$1",[rotating.id])).rows.length,1);
 assert(await accounts.getSession(replacement));
 assert.equal((await accounts.getSync(rotating.id)).blob.items[0].chapter,37);
 // An insert failure must roll back BOTH password update and revocation.
 failInsert=true;
 const failed=await call(0,"/auth/password",changed.data.token,{current:next,next:"third-safe-password"});
 assert.equal(failed.status,500);
 assert(await verifyPasswordAsync(next,(await accounts.getUserById(rotating.id)).passwordHash));
 assert(await accounts.getSession(replacement));
 assert.equal((await call(1,"/me",changed.data.token)).status,200);
 // Revoke a session while its already-verified edit is delayed.
 const revoked=await account(),waiting=hold();beforeChange=waiting;
 const stale=call(0,"/auth/email",revoked.token,{current:password,email:"stolen-"+revoked.email});
 await waiting.entered.promise;
 assert.equal((await call(1,"/auth/logout-all",revoked.token,{})).status,200);
 waiting.release.resolve();assert.equal((await stale).status,401);
 assert.equal((await accounts.getUserById(revoked.id)).email,revoked.email);
 // Concurrent unique-email claims: one winner, no partial credential changes.
 const a=await account(),b=await account(),target=randomUUID()+"@example.test";
 const clashes=await Promise.all([call(0,"/auth/email",a.token,{current:password,email:target}),call(1,"/auth/email",b.token,{current:password,email:target})]);
 assert.deepEqual(clashes.map(r=>r.status).sort(),[200,409]);
 for(const u of [a,b]){assert(await accounts.getSession(u.sid));assert.equal((await accounts.getSync(u.id)).blob.items[0].chapter,37);}
 // Transaction cleanup leaves both max=1 worker pools usable after success and rollback.
 assert.equal((await call(0,"/me",paid.token)).status,200);
 assert.equal((await call(1,"/me",paid.token)).data.user.plan,"pro");
 console.log("PASS: real PostgreSQL and two HTTP workers preserve paid rights/library, reject stale login and revoked edits, roll back password/session failure atomically, and resolve concurrent email claims without leaking connections.");
}finally{
 for(const release of releases)release();
 for(const server of servers)await new Promise((r,j)=>server.close(e=>e?j(e):r()));
 for(const id of users)await observer.query("DELETE FROM users WHERE id=$1",[id]);
 await Promise.all([...pools,observer].map(p=>p.end()));
}
