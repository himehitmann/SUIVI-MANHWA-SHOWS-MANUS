/** Account deletion vs checkout races on isolated PostgreSQL. Never live Stripe. */
import assert from "node:assert/strict";
import {randomUUID,randomBytes} from "node:crypto";
import pg from "pg";
import express from "express";
import {ensureSchema,createPostgresStore} from "../server/lib/store-postgres.ts";
import {ensureAccessSchema,createPostgresAccessStore} from "../server/lib/access.ts";
import {ensureCheckoutSchema,createPostgresCheckoutStore} from "../server/lib/checkout-store.ts";
import {createManagedCheckout} from "../server/lib/managed-checkout.ts";
import {createPostgresBillingAccountRunner} from "../server/lib/billing-account.ts";
import {hashPasswordAsync} from "../server/lib/crypto.ts";
import {checkoutProvider} from "../tests/fixtures/checkout-provider.ts";
const url=new URL(process.env.LOAD_DATABASE_URL||"http://invalid");
assert.equal(process.env.CI,"true");assert(["localhost","127.0.0.1","[::1]"].includes(url.hostname)&&url.pathname==="/yomu_load");
process.env.SYNC_JWT_SECRET=randomBytes(32).toString("hex");
const {createApiRouter}=await import("../server/api.ts");
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{assert.equal(new URL(String(input)).hostname,"127.0.0.1");return nativeFetch(input,init);};
const options={connectionString:url.toString(),max:1,connectionTimeoutMillis:5000,statement_timeout:10000,query_timeout:12000};
const pools=[new pg.Pool(options),new pg.Pool(options)],observer=new pg.Pool(options),servers=[],bases=[],users=[];
const provider=checkoutProvider(),config={enabled:true,key:"synthetic-deletion-fixture",origin:"https://yomu.example",month:"price_month",year:"price_year"};
let gate=null;const holds=[];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const request=async(input,init)=>{
 if(gate&&((gate.kind==="post"&&init?.method==="POST"&&String(input).endsWith("/checkout/sessions"))||(gate.kind==="read"&&!init?.method&&String(input).includes("/checkout/sessions/cs_")))){
  const waiting=gate;gate=null;waiting.entered.resolve();await waiting.release.promise;
 }
 return provider.request(input,init);
};
const call=async(index,path,token,body)=>{
 const response=await fetch(bases[index]+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 return {status:response.status,data:await response.json()};
};
const password="synthetic-deletion-password",hash=await hashPasswordAsync(password);
async function account(){
 const u={id:randomUUID(),email:randomUUID()+"@example.test",passwordHash:hash,plan:"free",createdAt:Date.now()};
 users.push(u.id);await createPostgresStore(observer).createUser(u);
 const result=await call(0,"/auth/login",null,{email:u.email,password});assert.equal(result.status,200);return {...u,token:result.data.token};
}
try{
 await ensureSchema(observer);await ensureAccessSchema(observer);await ensureCheckoutSchema(observer);
 for(const pool of pools){
  const app=express(),store=createPostgresStore(pool),access=createPostgresAccessStore(pool),checkout=createManagedCheckout(createPostgresCheckoutStore(pool),config,request);
  app.use("/api",createApiRouter(store,access,new Set(),"paid",checkout,createPostgresBillingAccountRunner(pool,config,request)));
  let server;await new Promise(r=>{server=app.listen(0,"127.0.0.1",r);});servers.push(server);bases.push("http://127.0.0.1:"+server.address().port+"/api");
 }
 const u=await account(),accounts=createPostgresStore(observer),attempts=createPostgresCheckoutStore(observer);
 await accounts.setSync(u.id,{blob:{items:[{id:"keep",chapter:24}],updatedAt:1},updatedAt:1});
 const before=await accounts.getSync(u.id),hold={kind:"post",entered:deferred(),release:deferred()};holds.push(hold);gate=hold;
 const buying=call(0,"/billing/checkout",u.token,{offer:"month"});await hold.entered.promise;
 // The reservation must already be committed while the provider response is pending.
 assert(await attempts.read(u.id));
 let deletionDone=false;const deleting=call(1,"/auth/delete",u.token,{current:password}).then(r=>{deletionDone=true;return r;});
 await new Promise(r=>setTimeout(r,100));assert.equal(deletionDone,false);
 hold.release.resolve();assert.equal((await buying).status,200);
 const blocked=await deleting;assert.equal(blocked.status,409);assert.equal(blocked.data.error,"billing_checkout_pending");
 assert.deepEqual(await accounts.getSync(u.id),before);
 // Reverse the race: deletion holds the same lock while checking an expired session.
 const attempt=await attempts.read(u.id);provider.sessions.get(attempt.sessionId).status="expired";
 const readHold={kind:"read",entered:deferred(),release:deferred()};holds.push(readHold);gate=readHold;
 const removal=call(0,"/auth/delete",u.token,{current:password});await readHold.entered.promise;
 const posts=provider.posts.length;let purchaseDone=false;
 const latePurchase=call(1,"/billing/checkout",u.token,{offer:"year"}).then(r=>{purchaseDone=true;return r;});
 await new Promise(r=>setTimeout(r,100));assert.equal(purchaseDone,false);
 readHold.release.resolve();assert.equal((await removal).status,200);assert.equal((await latePurchase).status,401);
 assert.equal(provider.posts.length,posts);assert.equal(await accounts.getUserById(u.id),null);assert.equal(await attempts.read(u.id),null);
 // Password rotation during a provider read invalidates the pending deletion.
 const secured=await account();
 await accounts.setSync(secured.id,{blob:{items:[{id:"keep-after-rotation",chapter:18}],updatedAt:1},updatedAt:1});
 assert.equal((await call(0,"/billing/checkout",secured.token,{offer:"month"})).status,200);
 provider.sessions.get((await attempts.read(secured.id)).sessionId).status="expired";
 const passwordHold={kind:"read",entered:deferred(),release:deferred()};holds.push(passwordHold);gate=passwordHold;
 const staleDelete=call(0,"/auth/delete",secured.token,{current:password});
 await passwordHold.entered.promise;
 const rotated=await call(1,"/auth/password",secured.token,{current:password,next:"synthetic-new-deletion-password"});
 assert.equal(rotated.status,200);
 passwordHold.release.resolve();assert.equal((await staleDelete).status,401);
 assert.equal((await accounts.getSync(secured.id)).blob.items[0].chapter,18);
 assert.equal((await call(1,"/me",rotated.data.token)).status,200);
 // A subscription activated during the same read must also block the final delete.
 const paidLate=await account();
 assert.equal((await call(0,"/billing/checkout",paidLate.token,{offer:"month"})).status,200);
 provider.sessions.get((await attempts.read(paidLate.id)).sessionId).status="expired";
 const paymentHold={kind:"read",entered:deferred(),release:deferred()};holds.push(paymentHold);gate=paymentHold;
 const paidDelete=call(0,"/auth/delete",paidLate.token,{current:password});
 await paymentHold.entered.promise;
 await accounts.applyBillingEvent(paidLate.id,"pro",{provider:"stripe",eventId:randomUUID()});
 paymentHold.release.resolve();assert.equal((await paidDelete).data.error,"billing_subscription_active");
 assert.equal((await call(1,"/me",paidLate.token)).status,200);
 // A failed provider POST must not roll back its persistent evidence when releasing the lock.
 const lost=await account();provider.loseNext();
 assert.equal((await call(0,"/billing/checkout",lost.token,{offer:"month"})).status,503);
 const evidence=await attempts.read(lost.id);assert(evidence&&!evidence.sessionId);
 assert.equal((await call(1,"/auth/delete",lost.token,{current:password})).data.error,"billing_review_required");
 const count=provider.sessions.size;assert.equal((await call(1,"/billing/checkout",lost.token,{offer:"month"})).status,200);
 assert.equal(provider.sessions.size,count);
 // A queued purchase must recheck a session revoked while waiting for its lock.
 const revoked=await account(),sessionHold={entered:deferred(),release:deferred()};holds.push(sessionHold);
 const locked=createPostgresBillingAccountRunner(pools[0],config,request)(revoked.id,async()=>{sessionHold.entered.resolve();await sessionHold.release.promise;});
 await sessionHold.entered.promise;
 let queuedDone=false;const beforeRevoked=provider.posts.length;
 const queued=call(1,"/billing/checkout",revoked.token,{offer:"month"}).then(r=>{queuedDone=true;return r;});
 await new Promise(r=>setTimeout(r,100));assert.equal(queuedDone,false);
 await accounts.revokeUserSessions(revoked.id);
 sessionHold.release.resolve();await locked;assert.equal((await queued).status,401);
 assert.equal(provider.posts.length,beforeRevoked);
 // Both max=1 pools can still serve requests: no nested acquisition or leaked lock.
 assert.equal((await call(0,"/me",lost.token)).status,200);assert.equal((await call(1,"/me",lost.token)).status,200);
 console.log("PASS: two HTTP workers with one database connection each serialize checkout/delete in both orders; reservations survive provider failure; rejected deletion preserves library; deleted accounts cannot start a late checkout; locks are released.");
}finally{
 for(const hold of holds)hold.release.resolve();
 for(const server of servers)await new Promise((r,j)=>server.close(e=>e?j(e):r()));
 for(const id of users)await observer.query("DELETE FROM users WHERE id=$1",[id]);
 await Promise.all([...pools,observer].map(p=>p.end()));
}
