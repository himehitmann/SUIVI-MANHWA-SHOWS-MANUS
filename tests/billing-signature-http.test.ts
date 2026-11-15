import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {createHmac} from "node:crypto";
import type {Server} from "node:http";
import express from "express";
import {createStore,type Store} from "../server/lib/store";

const secret="synthetic-webhook-current",oldSecret="synthetic-webhook-old";
let createApiRouter:typeof import("../server/api").createApiRouter;
let server:Server,base:string,store:Store;
beforeAll(async()=>{
  vi.stubEnv("STRIPE_WEBHOOK_SECRET",secret);vi.stubEnv("PADDLE_WEBHOOK_SECRET",secret);
  vi.stubEnv("STRIPE_PRICE_PRO_MONTH","price_month");vi.stubEnv("PADDLE_PRICE_PRO_MONTH","price_month");
  vi.resetModules();
  ({createApiRouter}=await import("../server/api"));
});
afterAll(()=>{vi.unstubAllEnvs();vi.resetModules();});
beforeEach(async()=>{
  store=createStore();
  await store.createUser({id:"rotation-user",email:"rotation@example.test",passwordHash:"not-used",plan:"free",createdAt:1});
  const app=express();app.use("/api",createApiRouter(store));
  await new Promise<void>(resolve=>{server=app.listen(0,"127.0.0.1",resolve);});
  base="http://127.0.0.1:"+String((server.address() as {port:number}).port)+"/api";
});
afterEach(async()=>{
  await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  vi.restoreAllMocks();
});

describe.each(["stripe","paddle"] as const)("%s verified webhook delivery",provider=>{
  const delimiter=provider==="stripe"?",":";",tsKey=provider==="stripe"?"t":"ts",sigKey=provider==="stripe"?"v1":"h1",separator=provider==="stripe"?".":":";
  const event=(id:string,status="active",time=1_800_000_000)=>{
    const object={id:"sub_rotation",status,metadata:{userId:"rotation-user"},items:{data:[{price:{id:"price_month"}}]}};
    return provider==="stripe"
      ?{id,created:time,type:"customer.subscription.updated",data:{object}}
      :{event_id:id,occurred_at:new Date(time*1000).toISOString(),event_type:"subscription.updated",data:{id:object.id,status,custom_data:{userId:"rotation-user"},items:object.items.data}};
  };
  const header=(raw:string,keys=[secret],time=Math.floor(Date.now()/1000))=>[
    tsKey+"="+time,
    ...keys.map(key=>sigKey+"="+createHmac("sha256",key).update(time+separator+raw).digest("hex")),
  ].join(delimiter);
  const send=(raw:string,signature:string)=>fetch(base+"/webhooks/"+provider,{
    method:"POST",headers:{"Content-Type":"application/json",[provider+"-signature"]:signature},body:raw,
  });
  it("accepts either signature order and ignores duplicate activation after cancellation",async()=>{
    const activation=JSON.stringify(event("evt_rotation_active"));
    const first=await send(activation,header(activation,[secret,oldSecret]));
    expect(first.status).toBe(200);expect(await first.json()).toMatchObject({received:true,applied:true,plan:"pro"});
    expect((await store.getUserById("rotation-user"))?.plan).toBe("pro");
    const reversed=await send(activation,header(activation,[oldSecret,secret]));
    expect(reversed.status).toBe(200);expect((await reversed.json()).plan).toBeUndefined();
    const cancellation=JSON.stringify(event("evt_rotation_cancel","canceled",1_800_000_001));
    expect((await send(cancellation,header(cancellation,[secret,oldSecret]))).status).toBe(200);
    expect((await store.getUserById("rotation-user"))?.plan).toBe("free");
    expect((await send(activation,header(activation,[oldSecret,secret]))).status).toBe(200);
    expect((await store.getUserById("rotation-user"))?.plan).toBe("free");
  });
  it("rejects forged, ambiguous and stale deliveries before consuming the event",async()=>{
    const apply=vi.spyOn(store,"applyBillingEvent");
    const raw=JSON.stringify(event("evt_rotation_retry"));
    const now=Math.floor(Date.now()/1000),valid=header(raw,[secret,oldSecret],now);
    const cases=[
      {body:raw+" ",signature:valid},
      {body:raw,signature:header(raw,[oldSecret],now)},
      {body:raw,signature:valid+delimiter+tsKey+"="+now},
      {body:raw,signature:valid.replaceAll(sigKey+"=","v0=")},
      {body:raw,signature:header(raw,[secret,oldSecret],now-(provider==="stripe"?301:6))},
      {body:raw,signature:header(raw,[secret,oldSecret],now+1000)},
    ];
    for(const attempt of cases){
      const response=await send(attempt.body,attempt.signature);
      expect(response.status).toBe(400);expect(await response.json()).toEqual({error:"bad_signature"});
    }
    expect(apply).not.toHaveBeenCalled();
    expect((await store.getUserById("rotation-user"))?.plan).toBe("free");
    const retried=await send(raw,header(raw,[secret,oldSecret]));
    expect(retried.status).toBe(200);expect((await retried.json()).plan).toBe("pro");
    expect(apply).toHaveBeenCalledOnce();
  });
});

it("does not consume a truncated subscription delivery before complete product details arrive",async()=>{
  const apply=vi.spyOn(store,"applyBillingEvent");
  const event={id:"evt_truncated_products",created:1_800_000_000,type:"customer.subscription.updated",
    data:{object:{id:"sub_truncated",status:"active",metadata:{userId:"rotation-user"},items:{has_more:true,data:[{price:{id:"price_month"}}]}}}};
  const deliver=async()=>{
    const raw=JSON.stringify(event),time=Math.floor(Date.now()/1000);
    const signature=createHmac("sha256",secret).update(time+"."+raw).digest("hex");
    return fetch(base+"/webhooks/stripe",{method:"POST",headers:{"Content-Type":"application/json","Stripe-Signature":"t="+time+",v1="+signature},body:raw});
  };
  const truncated=await deliver();expect(truncated.status).toBe(200);
  expect(await truncated.json()).toMatchObject({received:true,applied:false});
  expect(apply).not.toHaveBeenCalled();expect((await store.getUserById("rotation-user"))?.plan).toBe("free");
  event.data.object.items.has_more=false;
  const complete=await deliver();expect(complete.status).toBe(200);expect((await complete.json()).plan).toBe("pro");
  expect(apply).toHaveBeenCalledOnce();
});
