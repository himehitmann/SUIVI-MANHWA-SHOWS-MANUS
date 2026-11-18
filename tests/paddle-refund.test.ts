import {describe,it,expect,vi,afterEach} from "vitest";
import {resolvePaddleRefund} from "../server/lib/paddle-refund";
import {createStore} from "../server/lib/store";
import {applyPlanIntent} from "../server/lib/billing";
const txn="txn_"+"a".repeat(26),adj="adj_"+"b".repeat(26),customer="ctm_"+"c".repeat(26);
const map={lifetime:"price_life"};
const event=()=>({event_id:"evt_refund",event_type:"adjustment.updated",occurred_at:"2026-10-16T00:00:00Z",
  data:{id:adj,action:"refund",status:"approved",type:"full",transaction_id:txn,subscription_id:null,customer_id:customer,currency_code:"EUR",totals:{total:"5000"}}});
const transaction=()=>({id:txn,status:"completed",customer_id:customer,subscription_id:null,currency_code:"EUR",
  custom_data:{userId:"buyer"},items:[{price:{id:"price_life"}}],details:{totals:{grand_total:"5000"}}});
const response=(data:any=transaction())=>new Response(JSON.stringify({data}));
describe("Paddle full Lifetime refunds",()=>{
  it.each(["adjustment.created","adjustment.updated"])("resolves %s to its original transaction",async type=>{
    const input={...event(),event_type:type},request=vi.fn().mockResolvedValue(response());
    expect(await resolvePaddleRefund(input,map,"server-key","live",request)).toEqual({
      intent:{userId:"buyer",email:undefined,plan:"free"},
      receipt:{provider:"paddle",eventId:"evt_refund",resourceId:txn,occurredAt:Date.parse(input.occurred_at),revokeLifetime:true},
    });
    expect(request).toHaveBeenCalledOnce();
    const [url,options]=request.mock.calls[0];
    expect(url).toBe("https://api.paddle.com/transactions/"+txn);
    expect(options.headers.Authorization).toBe("Bearer server-key");
    expect(options.redirect).toBe("error");expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it("uses only the selected Paddle environment",async()=>{
    const request=vi.fn().mockResolvedValue(response());
    await resolvePaddleRefund(event(),map,"server-key","sandbox",request);
    expect(request.mock.calls[0][0]).toBe("https://sandbox-api.paddle.com/transactions/"+txn);
    for(const environment of ["https://attacker.test","staging"]){
      const rejected=vi.fn();await expect(resolvePaddleRefund(event(),map,"key",environment,rejected)).rejects.toThrow();expect(rejected).not.toHaveBeenCalled();
    }
  });
  it("ignores unapproved, credit and recurring adjustments without fetching",async()=>{
    const request=vi.fn();
    for(const patch of [{status:"pending_approval"},{status:"rejected"},{action:"credit"},{action:"chargeback"},{subscription_id:"sub_recurring"}]){
      expect(await resolvePaddleRefund({...event(),data:{...event().data,...patch}},map,"key","live",request)).toBeNull();
    }
    expect(await resolvePaddleRefund({...event(),event_type:"transaction.updated"},map,"key","live",request)).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
  it("does not revoke unrelated products or incomplete purchases",async()=>{
    for(const patch of [{status:"billed"},{subscription_id:"sub_recurring"},{items:[{price:{id:"other"}}]},{items:[{price:{id:"price_life"}},{price:{id:"other"}}]}]){
      expect(await resolvePaddleRefund(event(),map,"key","live",vi.fn().mockResolvedValue(response({...transaction(),...patch})))).toBeNull();
    }
  });
  it("rejects mismatched customer, transaction, amount or currency for retry",async()=>{
    for(const patch of [{id:"txn_other"},{customer_id:"ctm_other"},{currency_code:"USD"},{details:{totals:{grand_total:"4000"}}},{details:{totals:{grand_total:"-5000"}}},{details:{}}]){
      await expect(resolvePaddleRefund(event(),map,"key","live",vi.fn().mockResolvedValue(response({...transaction(),...patch})))).rejects.toThrow("billing_lookup_unavailable");
    }
    for(const total of ["0","-5000","5000.0","NaN","1e3"]){
      const input=event();input.data.totals.total=total;
      await expect(resolvePaddleRefund(input,map,"key","live",vi.fn().mockResolvedValue(response()))).rejects.toThrow();
    }
  });
  it("rejects missing credentials, malicious ids, unavailable and oversized responses",async()=>{
    const input=event();input.data.transaction_id="../../private";
    const request=vi.fn();
    await expect(resolvePaddleRefund(input,map,"key","live",request)).rejects.toThrow();
    await expect(resolvePaddleRefund(event(),map,"","live",request)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    for(const upstream of [new Response("down",{status:503}),new Response("not json"),new Response("x".repeat(65537)),new Response("{}")])
      await expect(resolvePaddleRefund(event(),map,"key","live",vi.fn().mockResolvedValue(upstream))).rejects.toThrow("billing_lookup_unavailable");
  });
  it("preserves another provider subscription and blocks duplicate or late grants",async()=>{
    const store=createStore();await store.createUser({id:"buyer",email:"buyer@example.test",passwordHash:"x",plan:"free",createdAt:1});
    await store.applyBillingEvent("buyer","pro",{provider:"stripe",eventId:"evt_pro",resourceId:"sub_other",occurredAt:1});
    await store.applyBillingEvent("buyer","lifetime",{provider:"paddle",eventId:"evt_purchase",resourceId:txn,occurredAt:2});
    const refund=await resolvePaddleRefund(event(),map,"key","live",vi.fn().mockResolvedValue(response()));
    expect(refund).not.toBeNull();
    await applyPlanIntent(store,refund!.intent,refund!.receipt);
    await applyPlanIntent(store,refund!.intent,refund!.receipt);
    await store.applyBillingEvent("buyer","lifetime",{provider:"paddle",eventId:"evt_late",resourceId:txn,occurredAt:Date.now()+1000});
    expect((await store.getUserById("buyer"))?.plan).toBe("pro");
  });
});

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});
it("verifies HTTP signature before lookup and retries a failed Paddle lookup",async()=>{
  vi.stubEnv("PADDLE_WEBHOOK_SECRET","paddle-test-signature");
  vi.stubEnv("PADDLE_API_KEY","paddle-test-api");
  vi.stubEnv("PADDLE_ENVIRONMENT","sandbox");
  vi.stubEnv("PADDLE_PRICE_LIFETIME","price_life");
  vi.resetModules();
  const [{createApiRouter},{createHmac},{default:express}]=await Promise.all([import("../server/api"),import("node:crypto"),import("express")]);
  const store=createStore();await store.createUser({id:"buyer",email:"buyer@example.test",passwordHash:"x",plan:"free",createdAt:1});
  await store.applyBillingEvent("buyer","lifetime",{provider:"paddle",eventId:"evt_purchase",resourceId:txn,occurredAt:1});
  const realFetch=globalThis.fetch,upstream=vi.fn().mockResolvedValueOnce(new Response("down",{status:503})).mockImplementation(()=>Promise.resolve(response()));
  vi.stubGlobal("fetch",vi.fn((url:any,options:any)=>String(url).startsWith("https://sandbox-api.paddle.com/")?upstream(url,options):realFetch(url,options)));
  const app=express();app.use("/api",createApiRouter(store));
  const server=await new Promise<any>(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  try{
    const send=async(valid=true)=>{
      const raw=JSON.stringify(event()),ts=Math.floor(Date.now()/1000);
      const signature=createHmac("sha256","paddle-test-signature").update(ts+":"+raw).digest("hex");
      return realFetch("http://127.0.0.1:"+server.address().port+"/api/webhooks/paddle",{method:"POST",headers:{"Content-Type":"application/json","Paddle-Signature":"ts="+ts+";h1="+(valid?signature:"invalid")},body:raw});
    };
    expect((await send(false)).status).toBe(400);expect(upstream).not.toHaveBeenCalled();
    expect((await send()).status).toBe(503);expect((await store.getUserById("buyer"))?.plan).toBe("lifetime");
    const result=await send();expect(result.status).toBe(200);expect((await result.json()).applied).toBe(true);
    expect((await store.getUserById("buyer"))?.plan).toBe("free");
    expect((await send()).status).toBe(200);expect((await store.getUserById("buyer"))?.plan).toBe("free");
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

describe("cumulative Paddle partial refunds",()=>{
  const partial=(id=adj,total="2500")=>({...event().data,id,type:"partial",totals:{total}});
  const page=(data:any[],has_more=false)=>({data,meta:{pagination:{has_more}}});
  const run=async(entries:any[],has_more=false)=>{
    const request=vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response(JSON.stringify(page(entries,has_more))));
    return resolvePaddleRefund({...event(),data:partial()},map,"key","live",request);
  };
  it("revokes only once approved partials cover the entire purchase",async()=>{
    expect(await run([partial()])).toBeNull();
    const result=await run([partial(),partial("adj_"+"d".repeat(26))]);
    expect(result?.intent.plan).toBe("free");
    expect(result?.receipt.resourceId).toBe(txn);
    expect(result?.receipt.revokeLifetime).toBe(true);
  });
  it("does not count pending/rejected refunds, credits or disputes as returned money",async()=>{
    for(const patch of [{status:"pending_approval"},{status:"rejected"},{action:"credit"},{action:"chargeback"}]){
      expect(await run([partial(),{...partial("adj_"+"d".repeat(26)),...patch}])).toBeNull();
    }
  });
  it("requires complete, unique and consistent provider evidence",async()=>{
    const other=partial("adj_"+"d".repeat(26));
    for(const entries of [
      [partial(),partial()],
      [other],
      [partial(),{...other,transaction_id:"txn_"+"z".repeat(26)}],
      [partial(),{...other,customer_id:"ctm_"+"z".repeat(26)}],
      [partial(),{...other,currency_code:"USD"}],
      [partial(),{...other,totals:{total:"3000"}}],
      [{...partial(),status:"pending_approval"},other],
    ])await expect(run(entries)).rejects.toThrow("billing_lookup_unavailable");
    await expect(run([partial(),other],true)).rejects.toThrow("billing_lookup_unavailable");
  });
  it("preserves access after the first partial, then revokes and ignores an old purchase",async()=>{
    const store=createStore();await store.createUser({id:"buyer",email:"buyer@example.test",passwordHash:"x",plan:"free",createdAt:1});
    await store.applyBillingEvent("buyer","lifetime",{provider:"paddle",resourceId:txn,eventId:"purchase",occurredAt:1});
    const first=await run([partial()]);expect(first).toBeNull();
    expect((await store.getUserById("buyer"))?.plan).toBe("lifetime");
    const final=await run([partial(),partial("adj_"+"d".repeat(26))]);
    await applyPlanIntent(store,final!.intent,final!.receipt);
    await applyPlanIntent(store,final!.intent,final!.receipt);
    await store.applyBillingEvent("buyer","lifetime",{provider:"paddle",resourceId:txn,eventId:"late",occurredAt:Date.now()+1000});
    expect((await store.getUserById("buyer"))?.plan).toBe("free");
  });
});
