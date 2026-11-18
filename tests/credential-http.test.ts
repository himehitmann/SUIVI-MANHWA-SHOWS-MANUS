import {afterEach,beforeEach,expect,it,vi} from "vitest";
import express from "express";
import type {Server} from "node:http";
import {createApiRouter} from "../server/api";
import {createStore,type Store} from "../server/lib/store";
import {createMemoryAccessStore} from "../server/lib/access";
let server:Server,base:string,store:Store,token:string,userId:string;
const password="original-safe-password",next="changed-safe-password";
const call=async(path:string,body?:unknown,auth=token)=>{
 const r=await fetch(base+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(auth?{Authorization:"Bearer "+auth}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json()};
};
beforeEach(async()=>{
 store=createStore();token="";
 const app=express();app.use("/api",createApiRouter(store,createMemoryAccessStore(),new Set(),"paid",{offers:()=>[],begin:async()=>{throw Error("closed");},expire:async()=>{},assertDeletable:async()=>{}}));
 await new Promise<void>(r=>{server=app.listen(0,"127.0.0.1",r);});base="http://127.0.0.1:"+(server.address() as any).port+"/api";
 const created=await call("/auth/signup",{email:"reader@example.test",password});expect(created.status).toBe(200);
 token=created.data.token;userId=created.data.user.id;
 await store.setSync(userId,{blob:{items:[{id:"saved",chapter:42}],updatedAt:1},updatedAt:1});
});
afterEach(async()=>{vi.restoreAllMocks();await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));});
it.each(["email","password"])("does not downgrade a payment received during a %s change",async kind=>{
 const original=store.changeCredentials;
 vi.spyOn(store,"changeCredentials").mockImplementationOnce(async(...args)=>{
  await store.applyBillingEvent(userId,"pro",{provider:"stripe",eventId:"payment-during-edit"});
  return original(...args);
 });
 const result=await call("/auth/"+kind,kind==="email"?{current:password,email:"new@example.test"}:{current:password,next});
 expect(result.status).toBe(200);
 const me=await call("/me",undefined,result.data.token||token);
 expect(me.data.user.plan).toBe("pro");expect((await store.getSync(userId))?.blob.items[0].chapter).toBe(42);
});
it.each(["email","password"])("refuses %s edits whose session was revoked after password verification",async kind=>{
 const original=store.changeCredentials;
 vi.spyOn(store,"changeCredentials").mockImplementationOnce(async(...args)=>{await store.revokeUserSessions(userId);return original(...args);});
 const result=await call("/auth/"+kind,kind==="email"?{current:password,email:"new@example.test"}:{current:password,next});
 expect(result.status).toBe(401);expect(result.data.token).toBeUndefined();
 expect((await call("/auth/login",{email:"reader@example.test",password},"")).status).toBe(200);
});
it("rejects a delayed login after a concurrent password change",async()=>{
 const original=store.createVerifiedSession;
 vi.spyOn(store,"createVerifiedSession").mockImplementationOnce(async(...args)=>{
  const changed=await call("/auth/password",{current:password,next});expect(changed.status).toBe(200);
  return original(...args);
 });
 const late=await call("/auth/login",{email:"reader@example.test",password},"");
 expect(late.status).toBe(401);expect(late.data.token).toBeUndefined();
 expect((await call("/auth/login",{email:"reader@example.test",password:next},"")).status).toBe(200);
});
it("returns a conflict when another account claims the email just before commit",async()=>{
 const original=store.changeCredentials;
 vi.spyOn(store,"changeCredentials").mockImplementationOnce(async(...args)=>{
  await store.createUser({id:"other",email:"taken@example.test",passwordHash:"fixture",plan:"free",createdAt:1});
  return original(...args);
 });
 const result=await call("/auth/email",{current:password,email:"taken@example.test"});
 expect(result.status).toBe(409);expect(result.data.error).toBe("email_taken");
 expect((await call("/me")).data.user.email).toBe("reader@example.test");
});
it("rechecks authentication after a slow deletion eligibility check",async()=>{
 const original=store.deleteAuthenticatedUser;
 vi.spyOn(store,"deleteAuthenticatedUser").mockImplementationOnce(async(...args)=>{
  const changed=await call("/auth/password",{current:password,next});expect(changed.status).toBe(200);
  return original(...args);
 });
 const result=await call("/auth/delete",{current:password});expect(result.status).toBe(401);
 expect(await store.getUserById(userId)).not.toBeNull();expect((await store.getSync(userId))?.blob.items[0].chapter).toBe(42);
});
it("rejects a subscription activated immediately before deletion",async()=>{
 const original=store.deleteAuthenticatedUser;
 vi.spyOn(store,"deleteAuthenticatedUser").mockImplementationOnce(async(...args)=>{
  await store.applyBillingEvent(userId,"pro",{provider:"stripe",eventId:"late-payment"});return original(...args);
 });
 const result=await call("/auth/delete",{current:password});
 expect(result.status).toBe(409);expect(result.data.error).toBe("billing_subscription_active");expect((await call("/me")).status).toBe(200);
});
