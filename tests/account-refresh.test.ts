import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {createHttpProvider} from "../client/src/lib/sync";
const base="https://account.example.test/api";
const original={id:"user1",email:"reader@example.test",plan:"free",role:"member"};
let memory:Map<string,string>;
beforeEach(()=>{
 memory=new Map();
 vi.stubGlobal("localStorage",{getItem:(key:string)=>memory.get(key)||null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key)});
});
afterEach(()=>vi.unstubAllGlobals());
async function signedIn(){
 const request=vi.fn().mockResolvedValueOnce(Response.json({token:"test-token",user:original}));
 vi.stubGlobal("fetch",request);
 const provider=createHttpProvider(base);await provider.signIn(original.email,"test-password");
 return {provider,request};
}
describe("fresh account rights before checkout",()=>{
 it.each([
  {plan:"pro",role:"member"},{plan:"lifetime",role:"member"},
  {plan:"pro",role:"admin"},{plan:"pro",role:"owner"},{plan:"free",role:"member"},
 ])("replaces cached rights with the server account %j",async rights=>{
  const {provider,request}=await signedIn();
  request.mockResolvedValueOnce(Response.json({user:{...original,...rights}}));
  expect(await provider.refreshSession()).toMatchObject({userId:original.id,...rights});
  expect(provider.getSession()).toMatchObject(rights);
  const [url,options]=request.mock.calls[1];
  expect(url).toBe(base+"/me");expect(options.headers.Authorization).toBe("Bearer test-token");
  expect(options.redirect).toBe("error");expect(options.credentials).toBe("omit");
  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(createHttpProvider(base).getSession()).toMatchObject(rights);
 });
 it.each([
  {user:{...original,id:"other"}},{user:{...original,plan:"unknown"}},
  {user:{...original,role:"root"}},{user:{...original,email:null}},{},
 ])("rejects malformed or foreign account evidence without persisting it",async body=>{
  const {provider,request}=await signedIn();request.mockResolvedValueOnce(Response.json(body));
  await expect(provider.refreshSession()).rejects.toThrow("account_check_failed");
  expect(provider.getSession()).toEqual({userId:original.id,email:original.email,plan:"free",role:"member"});
 });
 it("rejects a server failure, then allows a fresh retry",async()=>{
  const {provider,request}=await signedIn();request.mockResolvedValueOnce(Response.json({}, {status:503}));
  await expect(provider.refreshSession()).rejects.toThrow("account_check_failed");
  request.mockResolvedValueOnce(Response.json({user:{...original,plan:"pro"}}));
  expect((await provider.refreshSession()).plan).toBe("pro");
 });
 it("does not resurrect a signed-out account when its old request finishes",async()=>{
  const {provider,request}=await signedIn();let finish!:(value:Response)=>void;
  request.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;}));
  const pending=provider.refreshSession();const rejected=expect(pending).rejects.toThrow("account_changed");
  request.mockResolvedValueOnce(Response.json({ok:true}));await provider.signOut();
  finish(Response.json({user:{...original,plan:"pro"}}));await rejected;
  expect(provider.getSession()).toBeNull();expect(createHttpProvider(base).getSession()).toBeNull();
 });
 it("does not overwrite a different account signed in during verification",async()=>{
  const {provider,request}=await signedIn();let finish!:(value:Response)=>void;
  request.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;}));
  const pending=provider.refreshSession();const rejected=expect(pending).rejects.toThrow("account_changed");
  request.mockResolvedValueOnce(Response.json({token:"second-token",user:{...original,id:"user2"}}));
  await provider.signIn(original.email,"test-password");
  finish(Response.json({user:{...original,plan:"pro"}}));await rejected;
  expect(provider.getSession()?.userId).toBe("user2");
 });
 it("requires a signed-in account before contacting the server",async()=>{
  const request=vi.fn();vi.stubGlobal("fetch",request);
  await expect(createHttpProvider(base).refreshSession()).rejects.toThrow("unauthorized");
  expect(request).not.toHaveBeenCalled();
 });
});

describe("billing access from the web account",()=>{
 const url="https://billing.stripe.com/p/login/test_4gw6oJchs69w47e7ss";
 it("requests a safe link without appending account data",async()=>{
  const {provider,request}=await signedIn();request.mockResolvedValueOnce(Response.json({url}));
  expect(await provider.billingPortal()).toBe(url);
  const [endpoint,init]=request.mock.calls[1];
  expect(endpoint).toBe(base+"/billing/portal");expect(init.headers.Authorization).toBe("Bearer test-token");
  expect(init.redirect).toBe("error");expect(init.credentials).toBe("omit");
  expect(init.signal).toBeInstanceOf(AbortSignal);
 });
 it.each([404,503])("reports unconfigured or legacy services without a broken link (%s)",async status=>{
  const {provider,request}=await signedIn();request.mockResolvedValueOnce(Response.json({error:"billing_portal_unavailable"},{status}));
  expect(await provider.billingPortal()).toBeNull();
 });
 it.each([{url:"https://evil.test"},{url:"https://billing.stripe.com/p/session/private"},{url:url+"?email=reader@example.test"},{}])("rejects an unsafe backend reply %j",async reply=>{
  const {provider,request}=await signedIn();request.mockResolvedValueOnce(Response.json(reply));
  await expect(provider.billingPortal()).rejects.toThrow("billing_portal_failed");
 });
 it("supports retry after an outage",async()=>{
  const {provider,request}=await signedIn();request.mockResolvedValueOnce(Response.json({},{status:503}));
  await expect(provider.billingPortal()).rejects.toThrow("billing_portal_failed");
  request.mockResolvedValueOnce(Response.json({url}));expect(await provider.billingPortal()).toBe(url);
 });
 it("discards late billing access after an account change",async()=>{
  const {provider,request}=await signedIn();let finish!:(value:Response)=>void;
  request.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;}));
  const pending=provider.billingPortal();const rejected=expect(pending).rejects.toThrow("account_changed");
  request.mockResolvedValueOnce(Response.json({token:"second-token",user:{...original,id:"user2"}}));
  await provider.signIn(original.email,"test-password");finish(Response.json({url}));await rejected;
 });
 it("does not contact billing when signed out",async()=>{
  const request=vi.fn();vi.stubGlobal("fetch",request);
  await expect(createHttpProvider(base).billingPortal()).rejects.toThrow("unauthorized");
  expect(request).not.toHaveBeenCalled();
 });
});
