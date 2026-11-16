import {chromium} from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser=await chromium.launch({channel:"chromium",headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.setContent('<main><h1>Compte Yomu</h1><section id="portal" style="overflow-wrap:anywhere"></section></main>');
 await page.addScriptTag({path:"billing-portal.js"});
 const url="https://billing.stripe.com/p/login/test_4gw6oJchs69w47e7ss";
 // A failed response must offer a working retry, not a dead payment button.
 await page.evaluate(url=>{
  let calls=0;
  YomuBilling.mountBillingPortal(document.getElementById("portal"),"fr",async()=>++calls===1?{ok:false,error:"network_error"}:{ok:true,url});
 },url);
 await page.getByRole("button",{name:"Réessayer",exact:true}).click();
 const link=page.getByRole("link",{name:"Gérer ou résilier l’abonnement",exact:true});
 await link.waitFor();assert.equal(await link.getAttribute("href"),url);
 assert.equal(await link.getAttribute("rel"),"noopener noreferrer");
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Malicious replies cannot produce a navigation link.
 await page.evaluate(()=>YomuBilling.mountBillingPortal(document.getElementById("portal"),"fr",async()=>({ok:true,url:"https://evil.test"})));
 await page.getByRole("status").filter({hasText:"Impossible de charger"}).waitFor();
 assert.equal(await link.count(),0);
 // An obsolete render cannot install its link after the current account rendered.
 await page.evaluate(url=>{
  const element=document.getElementById("portal");
  YomuBilling.mountBillingPortal(element,"en",()=>new Promise(resolve=>{window.finishOld=()=>resolve({ok:true,url});}));
  YomuBilling.mountBillingPortal(element,"fr",async()=>({ok:false,error:"billing_portal_unavailable"}));
  window.finishOld();
 },url);
 await page.getByRole("status").filter({hasText:"n’est pas encore configurée"}).waitFor();
 assert.equal(await page.getByRole("link").count(),0);
 assert.equal(await page.getByRole("button").count(),0);
 await fs.mkdir("test-results",{recursive:true});
 await page.screenshot({path:"test-results/billing-portal-unconfigured-fr.png",fullPage:true});
 assert.deepEqual(errors,[]);
 console.log("PASS: extension billing UI retries safely, rejects unsafe links, ignores stale renders and fits a mobile viewport; no Stripe request made");
}finally{await browser.close();}
