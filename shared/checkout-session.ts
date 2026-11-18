/** Only Stripe-hosted Checkout; no caller-supplied navigation destination. */
export function checkoutSessionUrl(value:unknown):string|null {
 if(typeof value!=="string"||value.length>8192||/[\s\\]/.test(value))return null;
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&u.hostname==="checkout.stripe.com"&&!u.port&&!u.username&&!u.password&&
   /^\/c\/pay\/cs_[A-Za-z0-9_]+$/.test(u.pathname)&&!u.search?u.href:null;
 }catch{return null;}
}
