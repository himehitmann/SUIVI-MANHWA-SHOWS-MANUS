/**
 * Enrich only signature-verified checkout events. Secret keys stay server-side.
 * Missing upstream evidence raises an error so the webhook is retried.
 */
export async function completeStripeCheckout(
  event: any,
  secretKey: string,
  request: typeof fetch = fetch,
): Promise<any> {
  const object = event?.data?.object;
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event?.type) ||
      object?.mode !== "payment" ||
      !["paid", "no_payment_required"].includes(object?.payment_status)) return event;
  if (object.line_items !== undefined) return event;
  if (!secretKey || !/^cs_[A-Za-z0-9_]{1,200}$/.test(object.id || "")) throw new Error("billing_lookup_unavailable");
  const response = await request(
    "https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(object.id) + "/line_items?limit=2",
    {headers:{Authorization:"Bearer "+secretKey},signal:AbortSignal.timeout(5000),redirect:"error"},
  );
  if (!response.ok || !response.body) throw new Error("billing_lookup_unavailable");
  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];let size=0;
  try {
    for (;;) {
      const result=await reader.read();
      if(result.done)break;
      size+=result.value.byteLength;
      if(size>65536)throw new Error("billing_lookup_unavailable");
      chunks.push(result.value);
    }
  } finally { await reader.cancel().catch(()=>{}); }
  let items:any;
  try { items=JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("billing_lookup_unavailable"); }
  if(items?.object!=="list"||!Array.isArray(items.data)||typeof items.has_more!=="boolean")throw new Error("billing_lookup_unavailable");
  // Never mistake a partial provider response for a single-product purchase.
  const lineItems=items.has_more?{data:[],has_more:true}:items;
  return {...event,data:{...event.data,object:{...object,line_items:lineItems}}};
}
