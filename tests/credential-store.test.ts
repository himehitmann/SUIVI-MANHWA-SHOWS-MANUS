import {beforeEach,describe,expect,it} from "vitest";
import {createStore,type Store,type SessionRecord} from "../server/lib/store";
const user={id:"reader",email:"reader@example.test",passwordHash:"old-hash",plan:"free" as const,createdAt:1};
const session=(id:string,userId=user.id):SessionRecord=>({id,userId,createdAt:Date.now(),expiresAt:Date.now()+60000});
const proof={userId:user.id,passwordHash:user.passwordHash,sessionId:"old-session"};
let store:Store;
beforeEach(async()=>{store=createStore();await store.createUser(user);await store.createSession(session("old-session"));
 await store.setSync(user.id,{blob:{items:[{id:"saved",chapter:12}],updatedAt:1},updatedAt:1});});
describe("atomic credentials and verified sessions",()=>{
 it("preserves a paid entitlement and library when an email edit uses an older snapshot",async()=>{
  await store.applyBillingEvent(user.id,"pro",{provider:"stripe",eventId:"paid"});
  const result=await store.changeCredentials(proof,{kind:"email",email:"  NEW@example.test "});
  expect(result).toMatchObject({plan:"pro",email:"new@example.test",passwordHash:"old-hash",createdAt:1});
  expect((await store.getSync(user.id))?.blob.items[0].chapter).toBe(12);
 });
 it("preserves a concurrently changed email and paid plan when rotating the password",async()=>{
  await store.changeCredentials(proof,{kind:"email",email:"new@example.test"});
  await store.applyBillingEvent(user.id,"lifetime",{provider:"stripe",eventId:"lifetime"});
  await store.createSession(session("other-device"));
  const replacement=session("replacement");
  const result=await store.changeCredentials(proof,{kind:"password",passwordHash:"new-hash",replacement});
  expect(result).toMatchObject({email:"new@example.test",plan:"lifetime",passwordHash:"new-hash"});
  for(const id of ["old-session","other-device"])expect(await store.getSession(id)).toBeNull();
  expect(await store.getSession("replacement")).toEqual(replacement);
  expect((await store.getSync(user.id))?.blob.items[0].chapter).toBe(12);
 });
 it.each(["revoked","expired","wrong-user","password-changed"])("rejects stale proof: %s",async kind=>{
  if(kind==="revoked")await store.revokeSession(proof.sessionId);
  if(kind==="expired"){await store.revokeSession(proof.sessionId);await store.createSession({...session(proof.sessionId),expiresAt:1});}
  if(kind==="wrong-user"){await store.revokeSession(proof.sessionId);await store.createSession(session(proof.sessionId,"other"));}
  if(kind==="password-changed")await store.updateUser({...user,passwordHash:"new-hash"});
  const before=await store.getUserById(user.id);
  expect(await store.changeCredentials(proof,{kind:"email",email:"changed@example.test"})).toBeNull();
  expect(await store.changeCredentials(proof,{kind:"password",passwordHash:"attacker-hash",replacement:session("bad")})).toBeNull();
  expect(await store.deleteAuthenticatedUser(proof)).toBe("unauthorized");
  expect(await store.getUserById(user.id)).toEqual(before);expect(await store.getSession("bad")).toBeNull();
 });
 it("allows only one competing password rotation and rejects a delayed old-password login",async()=>{
  const results=await Promise.all(["a","b"].map(id=>store.changeCredentials(proof,{kind:"password",passwordHash:id,replacement:session(id)})));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await store.createVerifiedSession(user,session("late-login"))).toBeNull();
  expect(await store.getSession("late-login")).toBeNull();
 });
 it("does not create a late session after an email change or account deletion",async()=>{
  await store.changeCredentials(proof,{kind:"email",email:"new@example.test"});
  expect(await store.createVerifiedSession(user,session("late-email"))).toBeNull();
  expect(await store.deleteAuthenticatedUser(proof)).toBe("deleted");
  expect(await store.createVerifiedSession({...user,email:"new@example.test"},session("late-delete"))).toBeNull();
  expect(await store.getSync(user.id)).toBeNull();
 });
 it("returns current paid rights when creating a verified session",async()=>{
  await store.applyBillingEvent(user.id,"pro",{provider:"stripe",eventId:"paid"});
  expect(await store.createVerifiedSession(user,session("login"))).toMatchObject({plan:"pro"});
  expect(await store.createVerifiedSession(user,session("wrong","other"))).toBeNull();
 });
 it("rejects a duplicate email without changing password, rights or sessions",async()=>{
  await store.createUser({...user,id:"other",email:"taken@example.test"});
  await expect(store.changeCredentials(proof,{kind:"email",email:"TAKEN@example.test"})).rejects.toThrow("email_exists");
  expect(await store.getUserById(user.id)).toEqual(user);expect(await store.getSession(proof.sessionId)).not.toBeNull();
 });
 it("refuses a replacement session for another account without changing anything",async()=>{
  await expect(store.changeCredentials(proof,{kind:"password",passwordHash:"new",replacement:session("bad","other")})).rejects.toThrow("invalid_replacement_session");
  expect(await store.getUserById(user.id)).toEqual(user);expect(await store.getSession("bad")).toBeNull();
 });
 it("rechecks paid subscription state at the deletion commit",async()=>{
  await store.applyBillingEvent(user.id,"pro",{provider:"stripe",eventId:"late-payment"});
  expect(await store.deleteAuthenticatedUser(proof)).toBe("subscription_active");
  expect(await store.getUserById(user.id)).toMatchObject({plan:"pro"});
  expect((await store.getSync(user.id))?.blob.items[0].chapter).toBe(12);
 });
});
