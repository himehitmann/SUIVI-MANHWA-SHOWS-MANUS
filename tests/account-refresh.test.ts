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
