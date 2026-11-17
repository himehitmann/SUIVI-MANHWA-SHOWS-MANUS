import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import express from "express";
import type {Server} from "node:http";
import {createApiRouter} from "../server/api";
import {createStore} from "../server/lib/store";
import {createMemoryAccessStore} from "../server/lib/access";
import {CheckoutError} from "../server/lib/managed-checkout";
describe("authenticated managed checkout HTTP",()=>{
 let server:Server,base:string,store:ReturnType<typeof createStore>,access:ReturnType<typeof createMemoryAccessStore>,owners:Set<string>;
 const begin=vi.fn(),expire=vi.fn();
 beforeEach(async()=>{
  begin.mockReset().mockResolvedValue({url:"https://checkout.stripe.com/c/pay/cs_fixture",offer:"month"});expire.mockReset().mockResolvedValue(undefined);
  store=createStore();access=createMemoryAccessStore();owners=new Set();
  const app=express();app.use("/api",createApiRouter(store,access,owners,"paid",{offers:()=>["month","year"],begin,expire}));
  await new Promise<void>(resolve=>{server=app.listen(0,"127.0.0.1",resolve);});
  base="http://127.0.0.1:"+(server.address() as any).port+"/api";
 });
 afterEach(async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
 const call=(path:string,token?:string,body?:unknown)=>fetch(base+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const signup=async(name="reader")=>await(await call("/auth/signup",undefined,{email:name+"@example.test",password:"test-password-123"})).json();
 it("publishes offer identifiers without keys or provider prices",async()=>{
  const r=await call("/billing/offers");expect(r.status).toBe(200);expect(r.headers.get("cache-control")).toBe("no-store");
  expect(await r.json()).toEqual({offers:["month","year"]});
 });
 it("requires authenticated accounts for both mutations",async()=>{
  for(const path of ["/billing/checkout","/billing/checkout/expire"])expect((await call(path,"invalid",{})).status).toBe(401);
  expect(begin).not.toHaveBeenCalled();expect(expire).not.toHaveBeenCalled();
 });
 it.each([{offer:"lifetime"},{offer:"month",userId:"other"},{offer:"year",price:"price_cheaper"},{offer:"month",url:"https://evil.test"},{}])("rejects client-controlled prices, identities or redirects: %j",async body=>{
  const a=await signup();expect((await call("/billing/checkout",a.token,body)).status).toBe(400);expect(begin).not.toHaveBeenCalled();
 });
 it("uses server account identity and leaves saved progress unchanged",async()=>{
  const a=await signup();await store.setSync(a.user.id,{blob:{items:[{id:"saved",chapter:8}],updatedAt:1},updatedAt:1});
  const before=await store.getSync(a.user.id),r=await call("/billing/checkout",a.token,{offer:"month"});
  expect(r.status).toBe(200);expect(begin.mock.calls[0][0]).toMatchObject({id:a.user.id,email:"reader@example.test",plan:"free"});
  expect(begin.mock.calls[0][1]).toBe("month");expect(await store.getSync(a.user.id)).toEqual(before);
 });
 it("rechecks paid plans, administrator roles and gifts server-side",async()=>{
  const owner=await signup("owner"),admin=await signup("admin"),gift=await signup("gift"),paid=await signup("paid");
  owners.add(owner.user.id);
  await access.change(owner.user.id,admin.user.id,{requestId:"admin",expectedVersion:0,kind:"role",role:"admin",reason:"Test delegation"},owners);
  await access.change(owner.user.id,gift.user.id,{requestId:"gift",expectedVersion:0,kind:"gift",days:1,reason:"Test gift"},owners);
  for(const plan of ["pro","lifetime"] as const){
   await store.updateUser({...await store.getUserById(paid.user.id)!,plan});
   expect((await call("/billing/checkout",paid.token,{offer:"month"})).status).toBe(409);
  }
  for(const a of [owner,admin,gift])expect(await(await call("/billing/checkout",a.token,{offer:"month"})).json()).toEqual({error:"access_already_active"});
  expect(begin).not.toHaveBeenCalled();
 });
 it("expires only the authenticated account and rejects account injection",async()=>{
  const a=await signup();expect((await call("/billing/checkout/expire",a.token,{userId:"other"})).status).toBe(400);
  expect((await call("/billing/checkout/expire",a.token,{})).status).toBe(200);expect(expire).toHaveBeenCalledWith(a.user.id);
 });
 it("returns safe errors without provider details",async()=>{
  const a=await signup();begin.mockRejectedValueOnce(new Error("private provider response"));
  const r=await call("/billing/checkout",a.token,{offer:"month"});expect(r.status).toBe(503);expect(await r.json()).toEqual({error:"checkout_unavailable"});
  begin.mockRejectedValueOnce(new CheckoutError("checkout_pending"));
  expect((await call("/billing/checkout",a.token,{offer:"month"})).status).toBe(409);
 });
 it("limits creation and expiry attempts per account",async()=>{
  const a=await signup();
  for(let i=0;i<10;i++)expect((await call("/billing/checkout",a.token,{offer:"month"})).status).toBe(200);
  expect((await call("/billing/checkout",a.token,{offer:"month"})).status).toBe(429);expect(begin).toHaveBeenCalledTimes(10);
  for(let i=0;i<10;i++)expect((await call("/billing/checkout/expire",a.token,{})).status).toBe(200);
  expect((await call("/billing/checkout/expire",a.token,{})).status).toBe(429);
 });
});
