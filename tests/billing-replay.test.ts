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
    expect(billingReceipt("stripe",{id:"evt_1"})).toEqual({provider:"stripe",eventId:"evt_1"});
    expect(billingReceipt("paddle",{event_id:"evt_1"})).toEqual({provider:"paddle",eventId:"evt_1"});
    for(const id of [undefined,"","x".repeat(256),"a/b"])expect(billingReceipt("stripe",{id})).toBeNull();
  });
});
