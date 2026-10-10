import {describe,it,expect,vi} from "vitest";
import {completeStripeCheckout} from "../server/lib/stripe-checkout";
import {planFromStripeEvent} from "../server/lib/billing";
const event=()=>({type:"checkout.session.completed",data:{object:{id:"cs_test_example",mode:"payment",payment_status:"paid",client_reference_id:"u1"}}});
const body=()=>({object:"list",has_more:false,data:[{price:{id:"price_lifetime"}}]});
describe("Stripe checkout enrichment",()=>{
  it("retrieves missing items from the fixed provider endpoint before granting access",async()=>{
    const request=vi.fn().mockResolvedValue(new Response(JSON.stringify(body())));
    const original=event(),resolved=await completeStripeCheckout(original,"synthetic-key",request);
    expect(request).toHaveBeenCalledOnce();
    const [url,options]=request.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions/cs_test_example/line_items?limit=2");
    expect(options.headers.Authorization).toBe("Bearer synthetic-key");
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(planFromStripeEvent(resolved,{lifetime:"price_lifetime"})?.plan).toBe("lifetime");
    expect(original.data.object).not.toHaveProperty("line_items");
  });
  it("does not call the provider for unpaid, subscription or already expanded events",async()=>{
    const request=vi.fn();
    for(const patch of [{payment_status:"unpaid"},{mode:"subscription"},{line_items:body()}]){
      const input=event();Object.assign(input.data.object,patch);
      expect(await completeStripeCheckout(input,"synthetic-key",request)).toBe(input);
    }
    expect(request).not.toHaveBeenCalled();
  });
  it.each(["", "https://attacker.invalid/session", "cs_test/../../other"])("rejects an invalid session id: %s",async id=>{
    const input=event();input.data.object.id=id;const request=vi.fn();
    await expect(completeStripeCheckout(input,"synthetic-key",request)).rejects.toThrow("billing_lookup_unavailable");
    expect(request).not.toHaveBeenCalled();
  });
  it("requires a server credential",async()=>{
    const request=vi.fn();
    await expect(completeStripeCheckout(event(),"",request)).rejects.toThrow("billing_lookup_unavailable");
    expect(request).not.toHaveBeenCalled();
  });
  it.each([new Response("unavailable",{status:503}),new Response("not json"),new Response(JSON.stringify({data:[]})),new Response("x".repeat(65537))])("fails closed on invalid upstream responses",async response=>{
    await expect(completeStripeCheckout(event(),"synthetic-key",vi.fn().mockResolvedValue(response))).rejects.toThrow("billing_lookup_unavailable");
  });
  it("propagates network failure for webhook retry",async()=>{
    await expect(completeStripeCheckout(event(),"synthetic-key",vi.fn().mockRejectedValue(new Error("timeout")))).rejects.toThrow();
  });
  it("does not grant lifetime from a truncated or unknown product list",async()=>{
    for(const items of [{...body(),has_more:true},{...body(),data:[{price:{id:"unknown"}}]}]){
      const resolved=await completeStripeCheckout(event(),"synthetic-key",vi.fn().mockResolvedValue(new Response(JSON.stringify(items))));
      expect(planFromStripeEvent(resolved,{lifetime:"price_lifetime"})).toBeNull();
    }
  });
});
