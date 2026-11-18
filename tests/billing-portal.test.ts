import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import express from "express";
import type {Server} from "node:http";
import {createApiRouter} from "../server/api";
import {createStore} from "../server/lib/store";
import {createMemoryAccessStore} from "../server/lib/access";
import {stripePortalLoginUrl,billingPortalCopy} from "../shared/billing-portal";
const url="https://billing.stripe.com/p/login/test_4gw6oJchs69w47e7ss";

describe("shareable billing portal URL",()=>{
 it("accepts test and live portal login links",()=>{
  expect(stripePortalLoginUrl(url)).toBe(url);
  expect(stripePortalLoginUrl(url.replace("test_",""))).toBe(url.replace("test_",""));
 });
 it.each([null,{},42,""," "+url,url+"\n",url+"?prefilled_email=reader@example.test",url+"#account",url+"/extra",
  url.replace("https:","http:"),url.replace("stripe.com","stripe.com.evil.test"),url.replace("billing.",""),
  url.replace("/p/login/","/p/session/"),url.replace("billing.stripe.com","reader:password@billing.stripe.com"),
  url.replace("billing.stripe.com","billing.stripe.com:8443"),url.replace("/p/login/","/p/../p/login/"),
  url.replace("/p/login/","/p%2flogin/"),url.replace("/p/login/","\\p\\login\\"),
 ])("rejects unsafe or private URLs %s",value=>expect(stripePortalLoginUrl(value)).toBeNull());
 it("provides all supported translations without empty strings",()=>{
  for(const lang of ["en","fr","es","de","pt","ja","ko","zh-CN"]){
   for(const value of Object.values(billingPortalCopy(lang)))expect(value.trim().length).toBeGreaterThan(0);
  }
  expect(billingPortalCopy("unknown")).toBe(billingPortalCopy("en"));
 });
});

describe("billing portal HTTP access",()=>{
 let server:Server,base:string,store:ReturnType<typeof createStore>,owners:Set<string>;
 beforeEach(async()=>{
  vi.stubEnv("STRIPE_PORTAL_LOGIN_URL",url);store=createStore();owners=new Set();
  const app=express();app.use("/api",createApiRouter(store,createMemoryAccessStore(),owners,"paid"));
  await new Promise<void>(resolve=>{server=app.listen(0,"127.0.0.1",resolve);});
  base="http://127.0.0.1:"+(server.address() as any).port+"/api";
 });
 afterEach(async()=>{vi.unstubAllEnvs();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
 const get=(token?:string,path="/billing/portal")=>fetch(base+path,{headers:token?{Authorization:"Bearer "+token}:{}});
 const signup=async()=>(await(await fetch(base+"/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"reader@example.test",password:"test-password-123"})})).json());
 it("requires a current account, not just a link or an invalid token",async()=>{
  expect((await get()).status).toBe(401);expect((await get("invalid")).status).toBe(401);
  const a=await signup();await store.deleteUser(a.user.id);expect((await get(a.token)).status).toBe(401);
 });
 it("retains access for expired subscribers and owners and never changes a plan",async()=>{
  const a=await signup();
  for(const plan of ["pro","free","lifetime"] as const){
   await store.updateUser({...await store.getUserById(a.user.id)!,plan});
   const response=await get(a.token);expect(response.status).toBe(200);
   expect(response.headers.get("cache-control")).toBe("no-store");
   expect(await response.json()).toEqual({url});
   expect((await store.getUserById(a.user.id))?.plan).toBe(plan);
  }
  owners.add(a.user.id);expect((await get(a.token)).status).toBe(200);
 });
 it.each(["","https://evil.test/portal","https://billing.stripe.com/p/session/private"] )("fails closed on missing or invalid configuration %s",async value=>{
  vi.stubEnv("STRIPE_PORTAL_LOGIN_URL",value);const a=await signup();
  const response=await get(a.token);expect(response.status).toBe(503);
  expect(await response.json()).toEqual({error:"billing_portal_unavailable"});
 });
 it("ignores client redirect, account and email arguments",async()=>{
  const a=await signup();
  const response=await get(a.token,"/billing/portal?url=https://evil.test&customer=other&email=someone@example.test");
  expect(await response.json()).toEqual({url});
 });
 it("bounds repeated access without blocking the initial link",async()=>{
  const a=await signup();
  for(let i=0;i<30;i++)expect((await get(a.token)).status).toBe(200);
  expect((await get(a.token)).status).toBe(429);
 });
});
