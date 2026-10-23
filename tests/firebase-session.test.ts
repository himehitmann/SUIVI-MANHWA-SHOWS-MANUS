import {describe,it,expect,vi} from "vitest";
import {createFirebaseSessionManager} from "../shared/firebase-session";
import type {FirebaseSession} from "../shared/firebase-auth";
const config={projectId:"yomu-test-project",apiKey:"public-test-configuration-key"};
const now=()=>1800000000000;
const session=(userId="user-a",expiresAt=now()+3600000):FirebaseSession=>({
 provider:"firebase",projectId:config.projectId,userId,email:userId+"@example.com",
 token:"synthetic-id-token",refreshToken:"synthetic-refresh-token",expiresAt,
});
function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(e:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(initial:FirebaseSession|null=session()){
 let saved=initial?{...initial}:null;
 const store={read:vi.fn(async()=>saved?{...saved}:null),write:vi.fn(async(value:FirebaseSession|null)=>{saved=value?{...value}:null;})};
 const auth={signIn:vi.fn(async()=>session()),signUp:vi.fn(async()=>session()),refresh:vi.fn(async()=>session())};
 return {store,auth,manager:createFirebaseSessionManager(config,store,auth,now),saved:()=>saved};
}
describe("persistent Firebase worker sessions",()=>{
 it("restores a durable session after worker restart without signing in again",async()=>{
  const f=fixture();expect(await f.manager.getSession()).toEqual(session());
  const restarted=createFirebaseSessionManager(config,f.store,f.auth,now);
  expect(await restarted.getSession()).toEqual(session());expect(f.auth.signIn).not.toHaveBeenCalled();
  const copy=await restarted.getSession();copy!.token="changed";
  expect((await restarted.getSession())?.token).toBe("synthetic-id-token");
 });
 it("coalesces simultaneous refreshes and persists the rotated token",async()=>{
  const f=fixture(session("user-a",now()+30000)),pending=deferred<FirebaseSession>();
  f.auth.refresh.mockReturnValue(pending.promise);
  const reads=[f.manager.getSession(),f.manager.getSession(),f.manager.getSession()];
  await vi.waitFor(()=>expect(f.auth.refresh).toHaveBeenCalledOnce());
  pending.resolve({...session(),refreshToken:"rotated"});await Promise.all(reads);
  expect(f.store.write).toHaveBeenCalledOnce();expect(f.saved()?.refreshToken).toBe("rotated");
 });
 it("does not resurrect a session when refresh finishes after logout",async()=>{
  const f=fixture(session("user-a",now()-1)),pending=deferred<FirebaseSession>();
  f.auth.refresh.mockReturnValue(pending.promise);
  const read=f.manager.getSession(),assertion=expect(read).rejects.toThrow("account_changed");
  await vi.waitFor(()=>expect(f.auth.refresh).toHaveBeenCalledOnce());
  await f.manager.signOut();pending.resolve(session());await assertion;
  expect(f.saved()).toBeNull();expect(await f.manager.getSession()).toBeNull();
 });
 it("does not overwrite the new account with an old account refresh",async()=>{
  const f=fixture(session("user-a",now()-1)),pending=deferred<FirebaseSession>();
  f.auth.refresh.mockReturnValue(pending.promise);
  const read=f.manager.getSession(),assertion=expect(read).rejects.toThrow("account_changed");
  await vi.waitFor(()=>expect(f.auth.refresh).toHaveBeenCalledOnce());
  f.auth.signIn.mockResolvedValue(session("user-b"));await f.manager.signIn("b@example.com","password");
  pending.resolve(session());await assertion;expect(f.saved()?.userId).toBe("user-b");
 });
 it("latest login attempt wins even when earlier requests finish later",async()=>{
  const f=fixture(null),first=deferred<FirebaseSession>();
  f.auth.signIn.mockReturnValueOnce(first.promise).mockResolvedValueOnce(session("user-b"));
  const a=f.manager.signIn("a@example.com","password"),assertion=expect(a).rejects.toThrow("account_changed");
  await vi.waitFor(()=>expect(f.auth.signIn).toHaveBeenCalledOnce());
  await f.manager.signIn("b@example.com","password");first.resolve(session());await assertion;
  expect(f.saved()?.userId).toBe("user-b");
 });
 it("keeps durable credentials on network failure and permits a later retry",async()=>{
  const f=fixture(session("user-a",now()-1));f.auth.refresh.mockRejectedValueOnce(Error("network_error"));
  await expect(f.manager.getSession()).rejects.toThrow("network_error");expect(f.store.write).not.toHaveBeenCalled();
  expect((await f.manager.getSession())?.userId).toBe("user-a");expect(f.auth.refresh).toHaveBeenCalledTimes(2);
 });
 it("does not confirm login or logout if durable storage fails",async()=>{
  const f=fixture();f.auth.signIn.mockResolvedValue(session("user-b"));
  f.store.write.mockRejectedValueOnce(Error("storage_failed"));
  await expect(f.manager.signIn("b@example.com","password")).rejects.toThrow("storage_failed");
  expect((await f.manager.getSession())?.userId).toBe("user-a");
  f.store.write.mockRejectedValueOnce(Error("storage_failed"));
  await expect(f.manager.signOut()).rejects.toThrow("storage_failed");
  expect(f.saved()?.userId).toBe("user-a");
 });
 it("rejects a wrong project or changed user during refresh without persisting it",async()=>{
  const f=fixture(session("user-a",now()-1));f.auth.refresh.mockResolvedValue(session("user-b"));
  await expect(f.manager.getSession()).rejects.toThrow("account_mismatch");
  expect(f.store.write).not.toHaveBeenCalled();
  const bad=fixture({...session(),projectId:"other-project"});
  await expect(bad.manager.getSession()).rejects.toThrow("invalid_session");
 });
 it("persists only session fields and never passwords or roles",async()=>{
  const f=fixture(null);
  f.auth.signUp.mockResolvedValue({...session(),password:"secret",role:"admin"} as FirebaseSession);
  await f.manager.signUp("reader@example.com","secret");
  expect(f.saved()).toEqual(session());expect(f.saved()).not.toHaveProperty("password");
 });
});
