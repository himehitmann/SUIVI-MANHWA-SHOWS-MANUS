import {describe,it,expect} from "vitest";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createStore} from "../server/lib/store";
import {applyPlanIntent,billingReceipt} from "../server/lib/billing";
const user={id:"billing-user",email:"billing@example.test",passwordHash:"hash",plan:"free" as const,createdAt:1};
describe("durable billing replay protection",()=>{
  it("applies concurrent duplicates once and does not restore a canceled plan",async()=>{
    const store=createStore();await store.createUser(user);
    const receipt={provider:"stripe" as const,eventId:"evt_paid"};
    const results=await Promise.all(Array.from({length:10},()=>applyPlanIntent(store,{userId:user.id,plan:"pro"},receipt)));
    expect(results.filter(r=>r.plan==="pro")).toHaveLength(1);
    await applyPlanIntent(store,{userId:user.id,plan:"free"},{provider:"stripe",eventId:"evt_canceled"});
    expect((await applyPlanIntent(store,{userId:user.id,plan:"pro"},receipt)).unchanged).toBe(true);
    expect((await store.getUserById(user.id))?.plan).toBe("free");
  });
  it("persists receipts across restart and preserves account credentials",async()=>{
    const dir=mkdtempSync(join(tmpdir(),"yomu-billing-"));
    try {
      const file=join(dir,"accounts.json"),store=createStore(file);
      await store.createUser(user);
      await applyPlanIntent(store,{userId:user.id,plan:"pro"},{provider:"paddle",eventId:"evt_paid"});
      await store.updateUser({...user,passwordHash:"changed",email:"changed@example.test",plan:"pro"});
      await applyPlanIntent(store,{userId:user.id,plan:"free"},{provider:"paddle",eventId:"evt_canceled"});
      const restarted=createStore(file);
      await applyPlanIntent(restarted,{userId:user.id,plan:"pro"},{provider:"paddle",eventId:"evt_paid"});
      expect(await restarted.getUserById(user.id)).toMatchObject({plan:"free",passwordHash:"changed",email:"changed@example.test"});
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
  it("does not consume an event before its account exists",async()=>{
    const store=createStore(),receipt={provider:"stripe" as const,eventId:"evt_retry"};
    expect((await applyPlanIntent(store,{userId:user.id,plan:"pro"},receipt)).ok).toBe(false);
    await store.createUser(user);
    expect((await applyPlanIntent(store,{userId:user.id,plan:"pro"},receipt)).plan).toBe("pro");
  });
  it("separates providers and validates receipt identifiers",()=>{
    expect(billingReceipt("stripe",{id:"evt_1",created:1,data:{object:{id:"sub_1"}}})).toEqual({provider:"stripe",eventId:"evt_1",resourceId:"sub_1",occurredAt:1000});
    expect(billingReceipt("paddle",{event_id:"evt_1",occurred_at:"2026-01-01T00:00:00Z",data:{id:"txn_1",subscription_id:"sub_1"}})).toEqual({provider:"paddle",eventId:"evt_1",resourceId:"sub_1",occurredAt:1767225600000});
    for(const id of [undefined,"","x".repeat(256),"a/b"])expect(billingReceipt("stripe",{id})).toBeNull();
  });
});

describe("billing event order",()=>{
  const receipt=(eventId:string,occurredAt:number)=>({provider:"stripe" as const,eventId,resourceId:"sub_order",occurredAt});
  it("ignores a distinct older activation after cancellation",async()=>{
    const store=createStore();await store.createUser(user);
    await store.applyBillingEvent(user.id,"free",receipt("evt_new_cancel",2000));
    expect((await store.applyBillingEvent(user.id,"pro",receipt("evt_old_active",1000))).unchanged).toBe(true);
    expect((await store.getUserById(user.id))?.plan).toBe("free");
    await store.applyBillingEvent(user.id,"pro",receipt("evt_new_active",3000));
    expect((await store.getUserById(user.id))?.plan).toBe("pro");
  });
  it("does not consume ambiguous events or reassign a subscription to another account",async()=>{
    const store=createStore();await store.createUser(user);await store.createUser({...user,id:"other",email:"other@example.test"});
    await store.applyBillingEvent(user.id,"pro",receipt("evt_first",1000));
    expect((await store.applyBillingEvent(user.id,"free",receipt("evt_tied",1000))).reason).toBe("billing_order_ambiguous");
    expect((await store.applyBillingEvent("other","free",receipt("evt_wrong_account",2000))).reason).toBe("billing_resource_conflict");
    expect((await store.getUserById(user.id))?.plan).toBe("pro");
  });
  it("retains the ordering watermark across file restart",async()=>{
    const dir=mkdtempSync(join(tmpdir(),"yomu-billing-order-"));
    try{
      const file=join(dir,"accounts.json"),store=createStore(file);await store.createUser(user);
      await store.applyBillingEvent(user.id,"free",receipt("evt_new",2000));
      const restarted=createStore(file);
      await restarted.applyBillingEvent(user.id,"pro",receipt("evt_old",1000));
      expect((await restarted.getUserById(user.id))?.plan).toBe("free");
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
  it("rejects missing or malformed provider timestamps and resource identifiers",()=>{
    for(const created of [undefined,"1",NaN,-1,Infinity]){
      expect(billingReceipt("stripe",{id:"evt_valid",created,data:{object:{id:"sub_valid"}}})).toBeNull();
    }
    expect(billingReceipt("stripe",{id:"evt_valid",created:1,data:{object:{}}})).toBeNull();
    expect(billingReceipt("paddle",{event_id:"evt_valid",occurred_at:"invalid",data:{id:"sub_valid"}})).toBeNull();
  });
});
