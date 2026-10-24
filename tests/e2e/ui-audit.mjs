import {chromium} from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const profile=await fs.mkdtemp(path.join(os.tmpdir(),"yomu-ui-audit-"));
const context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${process.cwd()}`,`--load-extension=${process.cwd()}`]});
const errors=[],report=[];
try {
 const worker=context.serviceWorkers()[0]||await context.waitForEvent("serviceworker");
 await worker.evaluate(async()=>{
  getDiscover=async()=>({ts:Date.now(),discoveryVersion:3,manga:[],manhwa:[],manhua:[],anime:[],kdrama:[],cdrama:[],jdrama:[],series:[],gamesSoon:[],gamesHot:[],gamesNew:[]});
  await chrome.storage.local.set({"dasi.settings":{lang:"en"},"dasi.items":[{id:"audit-work",title:"A saved work with a long title for layout verification",type:"reading",chapter:12,total:30,synopsis:"Saved description",identityVersion:1,enrichedAt:1,metadataStatus:{state:"partial"}}],"dasi.lists":[{id:"audit-list",name:"My long personal reading list",itemIds:["audit-work"]}]});
 });
 const base=`chrome-extension://${new URL(worker.url()).host}/`;
 const page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
 await page.goto(base+"library.html");await page.waitForFunction(()=>items.length===1&&!discoverLoading);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const target of ["home","library","games","plans","settings"]){
   if(["home","library","games"].includes(target))await page.locator('#nav [data-v="'+target+'"]').click();
   else await page.locator(target==="plans"?"#go-pro":"#avatar").click();
   await page.locator("#view-"+target).waitFor({state:"visible"});
   const geometry=await page.evaluate(()=>{
    const root=document.querySelector(".view.active"),r=root.getBoundingClientRect();
    const controls=[...document.querySelectorAll("#nav button,.top-right>button")].filter(n=>n.getClientRects().length).map(n=>({id:n.id||n.dataset.v,r:n.getBoundingClientRect()}));
    const overlaps=[];
    for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
     const a=controls[i],b=controls[j];if(Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1)overlaps.push([a.id,b.id]);
    }
    return {left:r.left,right:r.right,width:innerWidth,overlaps,buttons:[...root.querySelectorAll("button")].filter(n=>n.getClientRects().length).length};
   });
   assert(geometry.left>=-1&&geometry.right<=width+1,JSON.stringify({width,target,geometry}));
   assert.deepEqual(geometry.overlaps,[],target+" header controls overlap at "+width);
   report.push({width,target,...geometry});
   if(width===320)await page.screenshot({path:"test-results/audit-"+target+"-320.png",fullPage:true});
  }
 }
 await page.evaluate(()=>{settings.lang="fr";switchView("library");});
 // A failed or silent metadata queue must release both retry controls and explain the result.
 const queue=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata;let mode="failure",late;
  requestMetadata=(message,callback)=>request(message,callback,20);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="QUEUE_MISSING_METADATA"){if(mode==="failure")callback({ok:false});else if(mode==="silent")late=callback;else callback({ok:true,items});return;}
   return original.call(api.runtime,message,callback);
  };
  try{
   document.getElementById("retry-library-metadata").click();
   await new Promise(r=>setTimeout(r,40));
   const failed={enabled:!document.getElementById("retry-library-metadata").disabled,text:document.getElementById("library-metadata-status").textContent};
   mode="silent";document.getElementById("retry-library-metadata").click();
   await new Promise(r=>setTimeout(r,50));
   const timeout=!completingMetadata&&!document.getElementById("retry-library-metadata").disabled;
   late({ok:true,items:[]});
   const retained=items.length;
   mode="success";await completeMissingMetadata();
   return {failed,timeout,retained,recovered:!metadataQueueError&&!completingMetadata};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;}
 });
 assert(queue.failed.enabled&&queue.failed.text.includes("confirmée"));assert(queue.timeout);assert.equal(queue.retained,1);assert(queue.recovered);
 const discovery=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata;let late;
  requestMetadata=(message,callback)=>request(message,callback,20);
  api.runtime.sendMessage=(message,callback)=>message.type==="DISCOVER"?(late=callback):original.call(api.runtime,message,callback);
  try{
   switchView("home");loadDiscover(true);
   await new Promise(r=>setTimeout(r,50));
   const released=!discoverLoading&&[...document.querySelectorAll("[data-discover-refresh]")].every(b=>!b.disabled);
   const before=discover;late({ok:true,data:{unexpected:true}});
   return {released,lateIgnored:discover===before};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;}
 });
 assert(discovery.released&&discovery.lateIgnored,JSON.stringify(discovery));
 const options=await context.newPage();options.on("pageerror",error=>errors.push(error.message));
 await options.goto(base+"options.html");await options.waitForFunction(()=>typeof send==="function");
 const transport=await options.evaluate(async()=>{
  const original=api.runtime.sendMessage;let late;
  try{
   api.runtime.sendMessage=(_message,callback)=>{late=callback;};
   const timeout=await send({type:"SYNC_NOW"},20);late({ok:true});
   api.runtime.sendMessage=()=>{throw Error("Disconnected");};
   const disconnected=await send({type:"SYNC_NOW"},20);
   api.runtime.sendMessage=(_message,callback)=>callback({ok:true});
   const recovered=await send({type:"SYNC_NOW"},20);
   return {timeout,disconnected,recovered};
  }finally{api.runtime.sendMessage=original;}
 });
 assert.equal(transport.timeout.error,"response_timeout");assert.equal(transport.disconnected.error,"connection_unavailable");assert(transport.recovered.ok);
 const staleStatus=await options.evaluate(async()=>{
  const original=api.runtime.sendMessage,pending=[];
  api.runtime.sendMessage=(_message,callback)=>pending.push(callback);
  try{
   const old=render(),fresh=render();
   pending[1]({configured:true,email:"new@example.test",state:"pending",lang:"en"});
   await fresh;
   pending[0]({configured:false,lang:"en"});await old;
   return {visible:!document.getElementById("signed-in").classList.contains("hidden"),email:document.getElementById("who").textContent};
  }finally{api.runtime.sendMessage=original;}
 });
 assert(staleStatus.visible);assert.equal(staleStatus.email,"new@example.test");
 assert.deepEqual(errors,[],"Unhandled browser errors");
 await fs.writeFile("test-results/ui-audit.json",JSON.stringify({report,queue,discovery,transport,staleStatus,errors},null,2));
 console.log("PASS: five views at four widths; navigation/header geometry; silent discovery and metadata recovery; options timeout and stale-response isolation");
}finally{await context.close();}
