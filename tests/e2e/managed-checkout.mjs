import {chromium} from "playwright";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {randomBytes} from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const probe=createServer();await new Promise(r=>probe.listen(0,"127.0.0.1",r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),"yomu-managed-checkout-")),base="http://127.0.0.1:"+port;
const server=spawn(process.execPath,["dist/index.js"],{env:{...process.env,NODE_ENV:"production",YOMU_ACCESS_MODE:"paid",YOMU_OWNER_IDS:"",DATABASE_URL:"",PORT:String(port),SYNC_JWT_SECRET:randomBytes(32).toString("hex"),SYNC_DB_FILE:path.join(temp,"accounts.json"),FORCE_HTTPS:"false"},stdio:["ignore","pipe","pipe"],windowsHide:true});
let log="",browser;server.stdout.on("data",d=>log+=d);server.stderr.on("data",d=>log+=d);
try{
 for(let i=0;i<100;i++){if(await fetch(base+"/healthz").then(r=>r.ok).catch(()=>false))break;if(i===99)throw Error(log);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:"chromium",headless:true});
 const page=await browser.newPage({viewport:{width:390,height:850}}),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto(base+"/pricing");
 const account=await(await fetch(base+"/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"checkout@example.test",password:"test-password-123"})})).json();
 const guard="yomu.checkout.pending:"+encodeURIComponent("/api|"+account.user.id);
 await page.evaluate(({account})=>{
  localStorage.setItem("dasi.sync.token:"+encodeURIComponent("/api"),account.token);
  localStorage.setItem("dasi.sync.session:"+encodeURIComponent("/api"),JSON.stringify({userId:account.user.id,email:account.user.email,plan:"free",role:"member"}));
 },{account});
 await page.route("**/api/billing/offers",r=>r.fulfill({json:{offers:["month","year"]}}));
 let purchases=0,closed=true;
 await page.route("**/api/billing/checkout",r=>{
  assert.deepEqual(r.request().postDataJSON(),{offer:"month"});
  if(closed)return r.fulfill({status:503,json:{error:"checkout_closed"}});
  purchases++;
  return r.fulfill({json:{url:"https://checkout.stripe.com/c/pay/cs_fixture#test",offer:"month"}});
 });
 // No real Stripe navigation: fulfill the destination entirely inside Playwright.
 await page.route("https://checkout.stripe.com/**",r=>r.fulfill({contentType:"text/html",body:"<h1>Synthetic checkout</h1>"}));
 await page.reload();await page.locator(".pricing-card button").first().waitFor();
 await page.waitForFunction(()=>!document.querySelector(".pricing-card button")?.disabled);
 await page.locator(".pricing-card button").first().click();
 await page.getByRole("status").filter({hasText:"Sales are not open"}).waitFor();
 assert.equal(await page.locator(".pricing-card button:enabled").count(),0);
 assert.equal(await page.evaluate(guard=>sessionStorage.getItem(guard),guard),null);
 assert.equal(purchases,0);
 closed=false;await page.reload();
 await page.waitForFunction(()=>document.querySelector(".pricing-card button")&&!document.querySelector(".pricing-card button").disabled);
 await page.locator(".pricing-card button").first().click();
 await page.getByRole("heading",{name:"Synthetic checkout"}).waitFor();assert.equal(purchases,1);
 await page.goto(base+"/pricing");
 await page.getByRole("status").filter({hasText:"payment attempt is in progress"}).waitFor();
 assert.equal(await page.locator(".pricing-card button:enabled").count(),0);
 assert.equal(purchases,1);
 // Server refusal to expire a completed checkout must keep the guard.
 await page.route("**/api/me",r=>r.fulfill({status:503,json:{error:"unavailable"}}));
 await page.route("**/api/billing/checkout/expire",r=>r.fulfill({status:409,json:{error:"checkout_pending"}}));
 await page.goto(base+"/billing/return");
 await page.getByRole("alert").filter({hasText:"does not mean your payment failed"}).waitFor();
 page.once("dialog",d=>d.accept());
 const rejected=page.waitForResponse(r=>r.url().endsWith("/billing/checkout/expire"));
 await page.getByRole("button",{name:"I did not complete payment",exact:true}).click();await rejected;
 assert(await page.evaluate(guard=>sessionStorage.getItem(guard)!==null,guard));
 assert(page.url().endsWith("/billing/return"));
 await page.unroute("**/api/billing/checkout/expire");
 await page.route("**/api/billing/checkout/expire",r=>r.fulfill({json:{ok:true,managed:true}}));
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="I did not complete payment")?.disabled);
 page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"I did not complete payment",exact:true}).click();
 await page.waitForURL(base+"/pricing");assert.equal(await page.evaluate(guard=>sessionStorage.getItem(guard),guard),null);
 // A gift or administrator access received since sign-in blocks purchasing.
 await page.unroute("**/api/me");
 await page.route("**/api/me",r=>r.fulfill({json:{user:{...account.user,plan:"pro",role:"admin",syncAccess:"read_write"}}}));
 await page.reload();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll(".pricing-card button")).every(b=>b.disabled));
 await page.getByRole("status").filter({hasText:"already"}).waitFor();
 assert.equal(purchases,1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 console.log("PASS: browser handles server sale closure without a false pending payment, uses authenticated checkout, preserves repeat guard, refuses unsafe reset, clears only after expiry and blocks purchases for fresh administrator access.");
}finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.exitCode!==null?r():server.once("exit",r));await fs.rm(temp,{recursive:true,force:true});}
