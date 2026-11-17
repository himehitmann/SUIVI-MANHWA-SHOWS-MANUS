import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {checkoutPending,rememberCheckout,forgetCheckout,hasProAccess} from "../client/src/lib/checkout-followup";
let memory:Map<string,string>;
beforeEach(()=>{
 memory=new Map();
 vi.stubGlobal("sessionStorage",{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key)});
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("checkout follow-up guard",()=>{
 it("keeps separate pending attempts for each service and account",()=>{
  rememberCheckout("https://one.test/api|reader");
  expect(checkoutPending("https://one.test/api|reader")).toBe(true);
  expect(checkoutPending("https://two.test/api|reader")).toBe(false);
  expect(checkoutPending("https://one.test/api|other")).toBe(false);
  rememberCheckout("https://one.test/api|other");
  forgetCheckout("https://one.test/api|reader");
  expect(checkoutPending("https://one.test/api|reader")).toBe(false);
  expect(checkoutPending("https://one.test/api|other")).toBe(true);
 });
 it("does not automatically authorize another purchase when time passes",()=>{
  rememberCheckout("/api|reader");
  vi.spyOn(Date,"now").mockReturnValue(Date.now()+7*24*3600*1000);
  expect(checkoutPending("/api|reader")).toBe(true);
 });
 it("does not prepare a checkout without a signed-in account scope",()=>{
  expect(()=>rememberCheckout(null)).toThrow("unauthorized");
  expect(checkoutPending(null)).toBe(false);expect(memory.size).toBe(0);
 });
 it("refuses navigation preparation if storage rejects or silently drops the marker",()=>{
  vi.stubGlobal("sessionStorage",{setItem(){throw Error("quota");}});
  expect(()=>rememberCheckout("/api|reader")).toThrow();
  vi.stubGlobal("sessionStorage",{setItem(){},getItem(){return null;}});
  expect(()=>rememberCheckout("/api|reader")).toThrow("checkout_guard_unavailable");
 });
 it("never infers Pro access from a pending marker or a cached payment result",()=>{
  rememberCheckout("/api|reader");
  expect(hasProAccess(null)).toBe(false);
  expect(hasProAccess({userId:"reader",email:"reader@example.test",plan:"free",role:"member"})).toBe(false);
 });
 it.each([
  {plan:"pro",role:"member"},{plan:"lifetime",role:"member"},
  {plan:"free",role:"owner"},{plan:"free",role:"admin"},
 ] as const)("recognizes account access without claiming a payment for %j",rights=>{
  expect(hasProAccess({userId:"reader",email:"reader@example.test",...rights})).toBe(true);
 });
});
