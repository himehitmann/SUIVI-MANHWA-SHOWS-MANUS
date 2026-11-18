import {afterEach,beforeEach,describe,expect,it} from "vitest";
import express from "express";
import type {Server} from "node:http";
import {createApiRouter} from "../server/api";
import {createStore} from "../server/lib/store";
import {createMemoryAccessStore} from "../server/lib/access";
import {accessMode,canWriteSync} from "../server/lib/commercial-access";

describe("commercial mode selection",()=>{
 it("defaults production to paid and development to personal",()=>{
  expect(accessMode(undefined,"production")).toBe("paid");
  expect(accessMode("","production")).toBe("paid");
  expect(accessMode(undefined,"development")).toBe("personal");
  expect(accessMode("personal","production")).toBe("personal");
  expect(accessMode("paid","development")).toBe("paid");
 });
 it.each(["free","PAID","true"," personal "])("rejects invalid mode %s",value=>expect(()=>accessMode(value,"production")).toThrow("YOMU_ACCESS_MODE"));
 it("allows only paid effective plans in commercial mode",()=>{
  expect(canWriteSync("paid","free")).toBe(false);
  expect(canWriteSync("paid","pro")).toBe(true);
  expect(canWriteSync("paid","lifetime")).toBe(true);
  expect(canWriteSync("personal","free")).toBe(true);
 });
});
describe("paid sync HTTP access",()=>{
 let server:Server,base:string,store:ReturnType<typeof createStore>,access:ReturnType<typeof createMemoryAccessStore>,owners:Set<string>;
 beforeEach(async()=>{
  store=createStore();access=createMemoryAccessStore();owners=new Set();
  const app=express();app.use("/api",createApiRouter(store,access,owners,"paid"));
  await new Promise<void>(resolve=>{server=app.listen(0,"127.0.0.1",resolve);});
  base="http://127.0.0.1:"+(server.address() as any).port+"/api";
 });
 afterEach(async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
 const call=(path:string,token?:string,body?:unknown,method=body===undefined?"GET":"POST")=>fetch(base+path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const signup=async(name:string)=>(await(await call("/auth/signup",undefined,{email:name+"@example.test",password:"test-password-123"})).json());
 const upload=(token:string,blob:any={items:[{id:"saved-work",chapter:7,updatedAt:1}],updatedAt:1})=>call("/sync",token,{blob},"PUT");
 const plan=async(id:string,value:"free"|"pro"|"lifetime")=>store.updateUser({...await store.getUserById(id)!,plan:value});
 it("keeps signup, login and data reads available but refuses an unpaid upload",async()=>{
  const a=await signup("reader");
  expect(a.user.syncAccess).toBe("read_only");expect(a.user.plan).toBe("free");
  expect((await upload(a.token)).status).toBe(403);
  expect(await (await upload(a.token)).json()).toMatchObject({error:"subscription_required"});
  expect(await store.getSync(a.user.id)).toBeNull();
  expect((await call("/sync",a.token)).status).toBe(200);
  expect((await call("/me",a.token)).status).toBe(200);
  expect((await call("/auth/login",undefined,{email:"reader@example.test",password:"test-password-123"})).status).toBe(200);
  expect((await call("/auth/password",a.token,{current:"test-password-123",next:"new-safe-password"})).status).toBe(200);
 });
 it("rejects unauthenticated writes before changing any account",async()=>{
  expect((await upload("missing")).status).toBe(401);
  expect((await call("/sync")).status).toBe(401);
 });
 it.each(["pro","lifetime"] as const)("accepts server-granted %s access and keeps the server plan",async value=>{
  const a=await signup(value);await plan(a.user.id,value);
  expect((await upload(a.token,{items:[{id:"work",chapter:12}],plan:"free"})).status).toBe(200);
  const remote=await(await call("/sync",a.token)).json();
  expect(remote.blob.plan).toBe(value);expect(remote.blob.items[0].chapter).toBe(12);
  expect((await(await call("/me",a.token)).json()).user.syncAccess).toBe("read_write");
 });
 it("does not accept client-supplied plans, roles or gift dates as payment",async()=>{
  const a=await signup("forged");
  expect((await upload(a.token,{items:[{id:"x"}],plan:"lifetime",role:"owner",giftUntil:9999999999999})).status).toBe(403);
  expect((await store.getUserById(a.user.id))?.plan).toBe("free");
  expect(await store.getSync(a.user.id)).toBeNull();
 });
 it("preserves a paid backup on expiry and permits retrieval without renewal",async()=>{
  const a=await signup("expires"),b=await signup("other");await plan(a.user.id,"pro");
  expect((await upload(a.token)).status).toBe(200);
  await plan(a.user.id,"free");
  const before=await store.getSync(a.user.id);
  expect((await upload(a.token,{items:[],tombstones:[{kind:"items",id:"saved-work",deletedAt:999}],updatedAt:999})).status).toBe(403);
  expect(await store.getSync(a.user.id)).toEqual(before);
  const backup=await(await call("/sync",a.token)).json();
  expect(backup.blob.items[0].chapter).toBe(7);expect(backup.blob.plan).toBe("free");
  expect((await(await call("/sync",b.token)).json()).blob).toBeNull();
  await plan(a.user.id,"pro");
  expect((await upload(a.token,{items:[{id:"saved-work",chapter:8,updatedAt:1000}],updatedAt:1000})).status).toBe(200);
  expect((await(await call("/sync",a.token)).json()).blob.items[0].chapter).toBe(8);
 });
 it("allows owner, administrator and active gifts without purchasing",async()=>{
  const owner=await signup("owner"),admin=await signup("admin"),gift=await signup("gift");
  owners.add(owner.user.id);
  await access.change(owner.user.id,admin.user.id,{requestId:"admin",expectedVersion:0,kind:"role",role:"admin",reason:"Test delegation"},owners);
  await access.change(owner.user.id,gift.user.id,{requestId:"gift",expectedVersion:0,kind:"gift",days:1,reason:"Test gift"},owners);
  for(const a of [owner,admin,gift])expect((await upload(a.token)).status).toBe(200);
  await access.change(owner.user.id,admin.user.id,{requestId:"remove-admin",expectedVersion:1,kind:"role",role:"member",reason:"End delegation"},owners);
  await access.change(owner.user.id,gift.user.id,{requestId:"remove-gift",expectedVersion:1,kind:"gift",days:0,reason:"End gift"},owners);
  for(const a of [admin,gift]){
    expect((await upload(a.token)).status).toBe(403);
    expect((await(await call("/sync",a.token)).json()).blob.items[0].chapter).toBe(7);
  }
 });
 it("does not mutate storage if reading administrative rights fails",async()=>{
  const a=await signup("failure");
  const read=access.get;access.get=async()=>{throw Error("simulated storage failure");};
  expect((await upload(a.token)).status).toBe(500);
  access.get=read;expect(await store.getSync(a.user.id)).toBeNull();
 });
 it("permits account deletion without subscription",async()=>{
  const a=await signup("delete");
  expect((await call("/auth/delete",a.token,{current:"test-password-123"})).status).toBe(200);
  expect(await store.getUserById(a.user.id)).toBeNull();
 });
});
