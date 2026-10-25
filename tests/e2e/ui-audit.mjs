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
 // Long unbroken provider labels must not widen a mobile drawer.
 await page.setViewportSize({width:320,height:900});
 await page.evaluate(()=>{
  const text="LongUnbrokenLabel".repeat(18);
  items=[{...items[0],title:text,synopsis:text+" "+text,alternativeTitles:[text],genres:[text],authors:[text],rating:0,cast:[],identityVersion:1}];
  lists=[{id:"audit-long",name:text,itemIds:[]}];renderAll();openDrawer("audit-work");
 });
 await page.locator("#dr-close").waitFor({state:"visible"});
 await page.locator("#dr-syn-toggle").click();
 const detailGeometry=await page.locator("#drawer").evaluate(panel=>{
  const box=panel.getBoundingClientRect();
  return {width:panel.clientWidth,scroll:panel.scrollWidth,overflow:[...panel.querySelectorAll(".drawer-title,.synopsis,.tag,.chip-toggle")].filter(n=>n.getClientRects().length).filter(n=>{const r=n.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1;}).map(n=>n.className)};
 });
 assert(detailGeometry.scroll<=detailGeometry.width+1,JSON.stringify(detailGeometry));assert.deepEqual(detailGeometry.overflow,[]);
 await page.screenshot({path:"test-results/audit-long-detail-320.png",fullPage:true});
 await page.evaluate(()=>{
  globalThis.ratingTransport=api.runtime.sendMessage;
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="UPDATE_ITEM"){callback({ok:true,items:items.map(item=>item.id===message.id?{...item,...message.patch}:item)});return;}
   return globalThis.ratingTransport.call(api.runtime,message,callback);
  };
 });
 const star=page.locator('#dr-rate button[data-v="4"]');
 await star.focus();await page.keyboard.press("Enter");
 await page.waitForFunction(()=>items[0].rating===4);
 assert.equal(await star.getAttribute("aria-pressed"),"true");
 assert(await star.evaluate(node=>node===document.activeElement));
 await page.keyboard.press("Space");await page.waitForFunction(()=>items[0].rating===0);
 assert.equal(await star.getAttribute("aria-pressed"),"false");
 await page.evaluate(()=>{api.runtime.sendMessage=globalThis.ratingTransport;delete globalThis.ratingTransport;closeDrawer();});
 await page.setViewportSize({width:1440,height:900});

 // A silent membership save must not block the serialized queue forever.
 const membership=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,savedLists=lists;
  let late,mode="silent";
  requestMetadata=(message,callback)=>request(message,callback,20);
  lists=[{id:"retry-list",name:"Retry list",itemIds:[]}];
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="LIST_MEMBERSHIP"){
    if(mode==="silent")late=callback;
    else callback({ok:true,lists:[{id:"retry-list",name:"Retry list",itemIds:[message.itemId]}]});
    return;
   }
   return original.call(api.runtime,message,callback);
  };
  try{
   openDrawer("audit-work");document.querySelector('#dr-lists [data-list="retry-list"]').click();
   await new Promise(r=>setTimeout(r,50));
   const enabled=!document.querySelector('#dr-lists [data-list="retry-list"]').disabled;
   const intact=lists[0].itemIds.length===0;
   mode="success";document.querySelector('#dr-lists [data-list="retry-list"]').click();
   await new Promise(r=>setTimeout(r,30));
   const recovered=lists[0].itemIds.includes("audit-work");
   late({ok:true,lists:[]});
   return {enabled,intact,recovered,lateIgnored:lists.length===1};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;lists=savedLists;closeDrawer();}
 });
 assert.deepEqual(membership,{enabled:true,intact:true,recovered:true,lateIgnored:true});
 const gameState=await page.evaluate(()=>{
  globalThis.gameOriginalItems=items;globalThis.gameTransport=api.runtime.sendMessage;
  items=[{id:"keyboard-game",type:"game",title:"Keyboard game",gameEnrichedAt:Date.now(),synopsis:"Game",preregistered:false}];
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="UPDATE_ITEM"){callback({ok:true,items:items.map(item=>({...item,...message.patch}))});return;}
   return globalThis.gameTransport.call(api.runtime,message,callback);
  };
  openDrawer("keyboard-game");return true;
 });
 const prereg=page.locator("#dr-prereg");
 await prereg.focus();await page.keyboard.press("Enter");
 await page.waitForFunction(()=>items[0].preregistered===true);
 assert.equal(await prereg.getAttribute("aria-pressed"),"true");assert(await prereg.evaluate(n=>n===document.activeElement));
 await page.keyboard.press("Space");await page.waitForFunction(()=>items[0].preregistered===false);
 await page.evaluate(()=>{api.runtime.sendMessage=globalThis.gameTransport;items=globalThis.gameOriginalItems;delete globalThis.gameTransport;delete globalThis.gameOriginalItems;closeDrawer();});

 // A failed profile save must retain the user's draft and offer a real retry.
 await page.locator("#avatar").click();
 await page.evaluate(()=>{
  globalThis.nameTransport=api.runtime.sendMessage;
  api.runtime.sendMessage=(message,callback)=>message.type==="SET_SETTINGS"&&message.patch?.profile?callback({ok:false}):globalThis.nameTransport.call(api.runtime,message,callback);
 });
 await page.locator("#set-name").fill("My retained profile draft");
 await page.locator("#set-name").press("Tab");
 await page.locator("#set-name-retry").waitFor({state:"visible"});
 assert.equal(await page.locator("#set-name").inputValue(),"My retained profile draft");
 assert.equal(await page.locator("#set-name").isEnabled(),true);
 assert.equal(await page.locator("#set-name").getAttribute("aria-invalid"),"true");
 await page.evaluate(()=>{
  api.runtime.sendMessage=(message,callback)=>message.type==="SET_SETTINGS"&&message.patch?.profile?callback({ok:true,settings:{...settings,profile:message.patch.profile}}):globalThis.nameTransport.call(api.runtime,message,callback);
 });
 await page.locator("#set-name-retry").click();
 await page.waitForFunction(()=>settings.profile?.name==="My retained profile draft");
 assert.equal(await page.locator("#set-name-retry").isHidden(),true);
 assert.equal(await page.locator("#set-name").getAttribute("aria-invalid"),"false");
 await page.evaluate(()=>{api.runtime.sendMessage=globalThis.nameTransport;delete globalThis.nameTransport;});

 // Settings must show confirmed values, release failed controls, and ignore late replies.
 await page.locator("#avatar").click();
 const settingFailures=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata;
  let mode="failure",late;
  requestMetadata=(message,callback)=>request(message,callback,20);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="SET_SETTINGS"){
    if(mode==="silent")late=callback;else callback(mode==="failure"?{ok:false}:{ok:true,settings:{...settings,...message.patch}});
    return;
   }
   return original.call(api.runtime,message,callback);
  };
  try{
   settings.notifyNew=true;settings.autoTrack=true;settings.translateLang="en";renderSettings();
   document.getElementById("sw-notify").click();
   await new Promise(r=>setTimeout(r,30));
   const failedSwitch={value:settings.notifyNew,checked:document.getElementById("sw-notify").getAttribute("aria-checked"),enabled:!document.getElementById("sw-notify").disabled};
   const language=document.getElementById("set-trlang");language.value="fr";language.dispatchEvent(new Event("change"));
   await new Promise(r=>setTimeout(r,30));
   const failedLanguage={value:settings.translateLang,display:language.value,enabled:!language.disabled};
   mode="silent";const tracking=document.getElementById("set-autotrack");tracking.click();
   await new Promise(r=>setTimeout(r,50));
   const timeout={checked:tracking.checked,enabled:!tracking.disabled};
   late({ok:true,settings:{autoTrack:false}});
   const lateIgnored=settings.autoTrack===true;
   mode="success";document.getElementById("sw-notify").click();
   await new Promise(r=>setTimeout(r,30));
   const saved=settings.notifyNew===false&&document.getElementById("sw-notify").getAttribute("aria-checked")==="false";
   return {failedSwitch,failedLanguage,timeout,lateIgnored,saved};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;}
 });
 assert.deepEqual(settingFailures.failedSwitch,{value:true,checked:"true",enabled:true});
 assert.deepEqual(settingFailures.failedLanguage,{value:"en",display:"en",enabled:true});
 assert.deepEqual(settingFailures.timeout,{checked:true,enabled:true});assert(settingFailures.lateIgnored&&settingFailures.saved);
 for(const selector of ["#set-name","#set-uilang","#set-trlang","#sw-notify"])assert(await page.locator(selector).getAttribute("aria-label"));
 await page.locator('#nav [data-v="library"]').click();
 await page.locator('#grid h3 button[data-open="audit-work"]').click();
 assert.equal(await page.locator("#dr-close").getAttribute("aria-label"),"Close");
 assert(await page.locator("#dr-cover").getAttribute("aria-label"));
 await page.locator("#dr-close").click();
 assert.equal(await page.locator("#drawer").evaluate(node=>node.inert),true);

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
 await fs.writeFile("test-results/ui-audit.json",JSON.stringify({report,settingFailures,queue,discovery,transport,staleStatus,errors},null,2));
 console.log("PASS: five views at four widths; navigation/header geometry; silent discovery and metadata recovery; options timeout and stale-response isolation");
}finally{await context.close();}
