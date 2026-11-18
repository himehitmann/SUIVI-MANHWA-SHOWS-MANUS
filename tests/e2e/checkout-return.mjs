import {chromium} from "playwright";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {randomBytes} from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const probe=createServer();await new Promise(r=>probe.listen(0,"127.0.0.1",r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),"yomu-checkout-return-")),base="http://127.0.0.1:"+port;
const server=spawn(process.execPath,["dist/index.js"],{env:{...process.env,NODE_ENV:"production",YOMU_ACCESS_MODE:"paid",YOMU_OWNER_IDS:"",DATABASE_URL:"",PORT:String(port),SYNC_JWT_SECRET:randomBytes(32).toString("hex"),SYNC_DB_FILE:path.join(temp,"accounts.json"),FORCE_HTTPS:"false"},stdio:["ignore","pipe","pipe"],windowsHide:true});
let log="",browser;server.stdout.on("data",d=>log+=d);server.stderr.on("data",d=>log+=d);
try{
 for(let i=0;i<100;i++){if(await fetch(base+"/healthz").then(r=>r.ok).catch(()=>false))break;if(i===99)throw Error(log);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:"chromium",headless:true});
 const page=await browser.newPage({viewport:{width:375,height:850}}),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto(base+"/billing/return?success=true&plan=pro");
 await page.getByRole("status").filter({hasText:"Sign in to the Yomu account"}).waitFor();
 assert.equal(await page.getByText("Pro access is active on this account.",{exact:true}).count(),0);
 const account=await(await fetch(base+"/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"followup@example.test",password:"test-password-123"})})).json();
 const scope="/api|"+account.user.id,guard="yomu.checkout.pending:"+encodeURIComponent(scope);
 await page.evaluate(({account,guard})=>{
  localStorage.setItem("dasi.sync.token:"+encodeURIComponent("/api"),account.token);
  localStorage.setItem("dasi.sync.session:"+encodeURIComponent("/api"),JSON.stringify({userId:account.user.id,email:account.user.email,plan:"free",role:"member"}));
  sessionStorage.setItem(guard,JSON.stringify({startedAt:Date.now()}));
 },{account,guard});
 // URL parameters cannot activate access. Automatic checking stops after four reads.
 let calls=0;
 await page.route("**/api/me",route=>{calls++;return route.continue();});
 await page.reload();
 await page.getByRole("status").filter({hasText:"Pro access is not confirmed yet"}).waitFor({timeout:25000});
 assert.equal(calls,4);assert(await page.evaluate(guard=>sessionStorage.getItem(guard)!==null,guard));
 const user=await(await fetch(base+"/api/me",{headers:{Authorization:"Bearer "+account.token}})).json();
 assert.equal(user.user.plan,"free");
 await page.goto(base+"/pricing");await page.getByRole("status").filter({hasText:"payment attempt is in progress"}).waitFor();
 assert.equal(await page.locator(".pricing-card button:enabled").count(),0);
 const pendingCheck=page.waitForResponse(response=>response.url()===base+"/api/me");
 await page.getByRole("link",{name:"Check access after payment",exact:true}).click();
 await pendingCheck;
 await page.getByRole("heading",{name:"Check my Pro access",exact:true}).waitFor();
 // Leaving the screen must cancel its scheduled checks.
 await page.getByRole("link",{name:"Open account settings",exact:true}).click();
 const stopped=calls;await page.waitForTimeout(2300);assert.equal(calls,stopped);
 await page.unroute("**/api/me");
 // Failure is not presented as declined payment; a manual retry can confirm access.
 await page.route("**/api/me",route=>route.fulfill({status:503,json:{error:"unavailable"}}));
 await page.goto(base+"/billing/return");
 await page.getByRole("alert").filter({hasText:"does not mean your payment failed"}).waitFor();
 assert(await page.evaluate(guard=>sessionStorage.getItem(guard)!==null,guard));
 await page.unroute("**/api/me");
 let activationChecks=0;
 await page.route("**/api/me",route=>route.fulfill({json:{user:{...account.user,role:"member",plan:++activationChecks>=2?"pro":"free",syncAccess:activationChecks>=2?"read_write":"read_only"}}}));
 await page.getByRole("button",{name:"Check again",exact:true}).click();
 await page.getByRole("status").filter({hasText:"Pro access is active on this account."}).waitFor();
 assert.equal(activationChecks,2);assert.equal(await page.evaluate(guard=>sessionStorage.getItem(guard),guard),null);
 await page.getByRole("link",{name:"Open my library",exact:true}).waitFor();
 // A caller cannot use a response about another account as confirmation.
 await page.unroute("**/api/me");
 await page.route("**/api/me",route=>route.fulfill({json:{user:{...account.user,id:"another-account",role:"member",plan:"pro"}}}));
 await page.reload();await page.getByRole("alert").filter({hasText:"could not be checked"}).waitFor();
 assert.equal(await page.getByText("Pro access is active on this account.",{exact:true}).count(),0);
 await page.unroute("**/api/me");
 await page.route("**/api/me",route=>route.fulfill({status:503,json:{error:"unavailable"}}));
 await page.evaluate(guard=>{sessionStorage.setItem(guard,"pending");localStorage.setItem("dasi.language","fr");},guard);
 await page.reload();
 await page.getByRole("alert").filter({hasText:"Cela ne signifie pas que ton paiement a échoué"}).waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await fs.mkdir("test-results",{recursive:true});await page.screenshot({path:"test-results/checkout-return-fr-mobile.png",fullPage:true});
 // Returning to offers needs an explicit acknowledgement and does not cancel a payment.
 page.once("dialog",dialog=>dialog.dismiss());
 await page.getByRole("button",{name:"Je n’ai pas terminé le paiement",exact:true}).click();
 assert(await page.evaluate(guard=>sessionStorage.getItem(guard)!==null,guard));
 page.once("dialog",dialog=>dialog.accept());
 await page.getByRole("button",{name:"Je n’ai pas terminé le paiement",exact:true}).click();
 await page.waitForURL(base+"/pricing");assert.equal(await page.evaluate(guard=>sessionStorage.getItem(guard),guard),null);
 assert.deepEqual(errors,[]);
 console.log("PASS: checkout return rejects URL claims, bounds polling, stops on leave, retries outage, confirms only current-account rights, retains pending guard and supports explicit recovery");
}finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.exitCode!==null?r():server.once("exit",r));await fs.rm(temp,{recursive:true,force:true});}
