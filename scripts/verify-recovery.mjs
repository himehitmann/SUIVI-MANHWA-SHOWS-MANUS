/** Synthetic recovery drill: never accepts production hosts or databases. */
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import express from "express";
import pg from "pg";
import {ensureSchema,createPostgresStore} from "../server/lib/store-postgres.ts";
import {ensureAccessSchema,createPostgresAccessStore} from "../server/lib/access.ts";
import {ensureCheckoutSchema,createPostgresCheckoutStore} from "../server/lib/checkout-store.ts";
import {createManagedCheckout} from "../server/lib/managed-checkout.ts";
import {checkoutProvider} from "../tests/fixtures/checkout-provider.ts";

assert.equal(process.env.CI,"true","Recovery drill is CI-only");
const url=new URL(process.env.RECOVERY_DATABASE_URL||"http://invalid");
assert(["localhost","127.0.0.1"].includes(url.hostname)&&url.pathname==="/yomu_recovery","Use the isolated recovery fixture only");
process.env.SYNC_JWT_SECRET=randomBytes(32).toString("hex");
const {createApiRouter}=await import("../server/api.ts");
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const destination=new URL(typeof input==="string"||input instanceof URL?input:input.url);
 assert.equal(destination.hostname,"127.0.0.1","No external requests in the recovery drill");
 return nativeFetch(input,init);
};
const provider=checkoutProvider();
const checkoutSettings={enabled:true,key:"synthetic-recovery-fixture",origin:"https://yomu.example",month:"price_month",year:"price_year"};
const run=promisify(execFile),directory=await mkdtemp(path.join(tmpdir(),"yomu-recovery-"));
const admin=new pg.Pool({connectionString:url.toString(),max:2});
const names=["recovery_source_","recovery_target_"].map(prefix=>prefix+randomBytes(6).toString("hex"));
const created=[];let pool,server,base;
const report={kind:"Synthetic PostgreSQL backup/restore and fresh account login; not a production or browser reinstall certification",commit:process.env.GITHUB_SHA,checks:[]};
const password="synthetic-recovery-password",email="recovery@example.test";
const fixture={items:[{id:"series",title:"Series",type:"watching",season:3,episode:7,updatedAt:100},{id:"webtoon",title:"Webtoon",type:"reading",chapter:42,updatedAt:101},{id:"film",title:"Film",type:"watching",state:"completed",updatedAt:102}],lists:[{id:"favorites",name:"Favorites",itemIds:["series","webtoon"],updatedAt:103}],sites:[{id:"reader",url:"https://example.test",updatedAt:104}],profile:{name:"Recovery fixture",bio:"Personal library",updatedAt:105},tombstones:[{kind:"items",id:"removed-work",deletedAt:106}],updatedAt:106};
function dbUrl(name){const value=new URL(url);value.pathname="/"+name;return value.toString();}
async function stop(){
 if(server){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));server=null;}
 if(pool){await pool.end();pool=null;}
}
async function start(name,sales=false){
 pool=new pg.Pool({connectionString:dbUrl(name),max:3});
 await ensureSchema(pool);await ensureAccessSchema(pool);await ensureCheckoutSchema(pool);
 const checkout=createManagedCheckout(createPostgresCheckoutStore(pool),{...checkoutSettings,enabled:sales},provider.request);
 const app=express();app.use("/api",createApiRouter(createPostgresStore(pool),createPostgresAccessStore(pool),new Set(),"paid",checkout));
 await new Promise(resolve=>{server=app.listen(0,"127.0.0.1",resolve);});
 base="http://127.0.0.1:"+server.address().port+"/api";
}
async function request(route,{token,body,method=body?"POST":"GET",status=200}={}){
 const response=await fetch(base+route,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,status,route+" status");return response.json();
}
async function restored(){
 const login=await request("/auth/login",{body:{email,password}});
 const result=await request("/sync",{token:login.token});
 for(const key of ["items","lists","sites","profile","tombstones"]){const canonical=value=>Array.isArray(value)?[...value].sort((a,b)=>a.id.localeCompare(b.id)):value;assert.deepEqual(canonical(result.blob[key]),canonical(fixture[key]),key+" restored");}
 await request("/auth/login",{body:{email,password:"wrong-password"},status:401});
 await request("/sync",{status:401});
 return login.token;
}
function pgEnv(database){return {...process.env,PGHOST:url.hostname,PGPORT:url.port||"5432",PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:database,PGSSLMODE:"disable"};}
try{
 for(const name of names){assert(/^recovery_(source|target)_[a-f0-9]{12}$/.test(name));await admin.query('CREATE DATABASE "'+name+'"');created.push(name);}
 await start(names[0]);
 const account=await request("/auth/signup",{body:{email,password}});
 const accounts=createPostgresStore(pool);
 await accounts.updateUser({...await accounts.getUserById(account.user.id),plan:"pro"});
 await request("/sync",{token:account.token,method:"PUT",body:{blob:fixture}});
 // No browser cache or prior token is used for subsequent recovery.
 await stop();await start(names[0]);await restored();
 report.checks.push("Fresh login after API and connection-pool restart restores progress, lists, sites, profile and deletions");
 const other=await request("/auth/signup",{body:{email:"other@example.test",password}});
 assert.equal((await request("/sync",{token:other.token})).blob,null);
 report.checks.push("Another account and unauthenticated clients cannot retrieve this library");
 // Three durable attempts are captured with the backup: known, response lost,
 // and an unknown attempt beyond the provider's idempotency retention window.
 const signupCheckout=async(name)=>{
  const a=await request("/auth/signup",{body:{email:name+"@example.test",password}});
  return {id:a.user.id,email:a.user.email};
 };
 const known=await signupCheckout("known-checkout"),lost=await signupCheckout("lost-checkout"),old=await signupCheckout("old-checkout");
 const attempts=createPostgresCheckoutStore(pool);
 const service=createManagedCheckout(attempts,checkoutSettings,provider.request);
 await service.begin(known,"month");
 provider.loseNext();await assert.rejects(service.begin(lost,"month"),/response lost/);
 provider.loseNext();
 const oldTime=Date.now()-24*3600000;
 await assert.rejects(createManagedCheckout(attempts,checkoutSettings,provider.request,()=>oldTime).begin(old,"year"),/response lost/);
 const snapshot=await Promise.all([known,lost,old].map(u=>attempts.read(u.id)));
 assert(snapshot[0].sessionId&&!snapshot[1].sessionId&&!snapshot[2].sessionId);
 const sessionCount=provider.sessions.size;
 await stop();
 const archive=path.join(directory,"fixture.dump");
 await run("pg_dump",["--format=custom","--no-owner","--no-acl","--file",archive],{env:pgEnv(names[0]),timeout:60000});
 await run("pg_restore",["--exit-on-error","--no-owner","--no-acl","--dbname",names[1],archive],{env:pgEnv(names[1]),timeout:60000});
 // Stripe can advance after the backup without any matching local webhook yet.
 provider.sessions.get(snapshot[0].sessionId).status="complete";
 // Remove the source database: all subsequent assertions rely on the restored copy.
 await admin.query('DROP DATABASE "'+names[0]+'"');created.splice(created.indexOf(names[0]),1);
 await start(names[1]);const freshToken=await restored();
 // An empty newly-installed client must not erase the server library.
 await request("/sync",{token:freshToken,method:"PUT",body:{blob:{items:[],updatedAt:200}}});
 await restored();
 report.checks.push("pg_dump/pg_restore into a separate database survives removal of the source");
 report.checks.push("An empty client sync preserves the remotely saved library");
 // Restoring database contents cannot restore changes made at Stripe afterward.
 // Keep new sales closed while the restored library remains available.
 const loginPurchase=async(user)=>request("/auth/login",{body:{email:user.email,password}});
 let purchaser=await loginPurchase(lost);
 assert.deepEqual(await request("/billing/offers"),{offers:[]});
 const beforeClosed=provider.posts.length;
 assert.equal((await request("/billing/checkout",{token:purchaser.token,body:{offer:"month"},status:503})).error,"checkout_closed");
 assert.equal(provider.posts.length,beforeClosed);
 const recoveredStore=createPostgresCheckoutStore(pool);
 assert.deepEqual(await Promise.all([known,lost,old].map(u=>recoveredStore.read(u.id))),snapshot);
 report.checks.push("The actual database dump restores checkout bodies, keys, timestamps and session IDs; new sales remain closed during recovery");

 // Synthetic explicit reopening only after inspecting all fixture attempts.
 await stop();await start(names[1],true);
 purchaser=await loginPurchase(known);
 assert.equal((await request("/billing/checkout",{token:purchaser.token,body:{offer:"month"},status:409})).error,"checkout_pending");
 assert.equal((await request("/me",{token:purchaser.token})).user.plan,"free");
 assert.equal(provider.sessions.size,sessionCount);
 report.checks.push("Provider completion after the backup blocks another purchase even when the restored account has not received its activation webhook");
 purchaser=await loginPurchase(lost);
 const resumed=await request("/billing/checkout",{token:purchaser.token,body:{offer:"month"}});
 const recoveredAttempt=await createPostgresCheckoutStore(pool).read(lost.id);
 assert(resumed.url.includes(recoveredAttempt.sessionId));
 assert.equal(provider.sessions.size,sessionCount);
 assert.deepEqual(provider.posts.at(-1),provider.posts.find(p=>p.key==="yomu-checkout-"+snapshot[1].id));
 report.checks.push("A restored unknown creation within the safety window reuses the original idempotency key and body, without another provider session");
 purchaser=await loginPurchase(old);const beforeOld=provider.posts.length;
 for(const route of ["/billing/checkout","/billing/checkout/expire"]){
  assert.equal((await request(route,{token:purchaser.token,body:route.endsWith("/expire")?{}:{offer:"year"},status:409})).error,"checkout_review_required");
 }
 assert.equal(provider.posts.length,beforeOld);
 assert.deepEqual(await createPostgresCheckoutStore(pool).read(old.id),snapshot[2]);
 report.checks.push("An unknown restored creation older than 23 hours refuses retry and expiry, retains its evidence and makes no provider creation call");

 // Closing new sales does not block safe cleanup or account backup retrieval.
 await stop();await start(names[1],false);
 purchaser=await loginPurchase(lost);
 await request("/billing/checkout/expire",{token:purchaser.token,body:{}});
 assert.equal(await createPostgresCheckoutStore(pool).read(lost.id),null);
 assert.equal(provider.sessions.get(recoveredAttempt.sessionId).status,"expired");
 purchaser=await loginPurchase(known);
 assert.equal((await request("/billing/checkout/expire",{token:purchaser.token,body:{},status:409})).error,"checkout_pending");
 await restored();
 report.checks.push("Closed sales still permit expiry of an unpaid session, reject expiry of a completed one and preserve fresh-login library recovery");
 report.passed=true;
 await mkdir("test-results",{recursive:true});await writeFile("test-results/recovery-report.json",JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{
 await stop();
 for(const name of created)await admin.query('DROP DATABASE "'+name+'"');
 await admin.end();await rm(directory,{recursive:true,force:true});
}
