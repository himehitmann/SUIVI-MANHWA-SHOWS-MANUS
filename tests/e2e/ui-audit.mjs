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

 // Inline library biography must retain its text after failed blur-save.
 await page.locator('#nav [data-v="library"]').click();
 await page.evaluate(()=>{
  globalThis.bioTransport=api.runtime.sendMessage;
  api.runtime.sendMessage=(message,callback)=>message.type==="SET_SETTINGS"&&message.patch?.profile?callback({ok:false}):globalThis.bioTransport.call(api.runtime,message,callback);
 });
 await page.locator("#dash-bio").click();
 await page.locator("#dash-bio-ta").fill("My biography draft stays here");
 await page.locator("#dash-bio-ta").press("Tab");
 await page.waitForFunction(()=>document.getElementById("dash-bio-ta")?.getAttribute("aria-invalid")==="true");
 assert.equal(await page.locator("#dash-bio-ta").inputValue(),"My biography draft stays here");
 assert(await page.locator("#dash-bio-ta").isEnabled());
 await page.evaluate(()=>{
  api.runtime.sendMessage=(message,callback)=>message.type==="SET_SETTINGS"&&message.patch?.profile?callback({ok:true,settings:{...settings,profile:message.patch.profile}}):globalThis.bioTransport.call(api.runtime,message,callback);
 });
 await page.locator("#dash-bio-ta + small + button").click();
 await page.waitForFunction(()=>settings.profile?.bio==="My biography draft stays here");
 assert.equal(await page.locator("#dash-bio-ta").count(),0);
 assert((await page.locator("#dash-bio").innerText()).includes("My biography draft stays here"));
 await page.evaluate(()=>{api.runtime.sendMessage=globalThis.bioTransport;delete globalThis.bioTransport;});

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

 await page.evaluate(()=>{
  globalThis.tagTestItems=items;globalThis.tagTestSend=api.runtime.sendMessage;globalThis.tagTestFailure=true;
  items=items.map(item=>item.id==="audit-work"?{...item,tags:["Drama","Fantasy"]}:item);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="UPDATE_ITEM"&&message.patch.tags){
    if(tagTestFailure){callback({ok:false});return;}
    callback({ok:true,items:items.map(item=>item.id===message.id?{...item,...message.patch}:item)});return;
   }
   return tagTestSend.call(api.runtime,message,callback);
  };
  openDrawer("audit-work");
 });
 await page.locator('#dr-tags button[data-rm="Drama"]').focus();
 await page.keyboard.press("Enter");
 await page.waitForFunction(()=>document.activeElement?.dataset.rm==="Drama"&&!document.activeElement.disabled);
 assert.deepEqual(await page.evaluate(()=>items.find(item=>item.id==="audit-work").tags),["Drama","Fantasy"]);
 assert(await page.locator('#dr-tags button[data-rm="Drama"]').getAttribute("aria-label"));
 await page.evaluate(()=>{tagTestFailure=false;});
 await page.keyboard.press("Space");
 await page.waitForFunction(()=>document.activeElement?.dataset.rm==="Fantasy");
 assert.deepEqual(await page.evaluate(()=>items.find(item=>item.id==="audit-work").tags),["Fantasy"]);
 await page.keyboard.press("Enter");
 await page.waitForFunction(()=>document.activeElement?.id==="dr-addtag");
 assert.deepEqual(await page.evaluate(()=>items.find(item=>item.id==="audit-work").tags),[]);
 await page.evaluate(()=>{api.runtime.sendMessage=tagTestSend;items=tagTestItems;closeDrawer();renderAll();});
 const libraryPreferences=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,originalSites=sites,originalSettings=settings;
  let mode="failure",late,calls=0;
  requestMetadata=(message,callback)=>request(message,callback,25);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="REMOVE_SITE"||(message.type==="SET_SETTINGS"&&Object.hasOwn(message.patch,"librarySort"))){
    calls++;
    if(mode==="silent"){late=callback;return;}
    if(mode==="failure"){callback({ok:false});return;}
    callback(message.type==="REMOVE_SITE"?{ok:true,sites:sites.filter(site=>site.id!==message.id)}:{ok:true,settings:{librarySort:message.patch.librarySort}});return;
   }
   return original.call(api.runtime,message,callback);
  };
  const pause=()=>new Promise(resolve=>setTimeout(resolve,50));
  try{
   switchView("library");settings={...settings,librarySort:"recent"};
   sites=[{id:"site-a",name:"Site A",url:"https://example.com/a"},{id:"site-b",name:"Site B",url:"https://example.com/b"}];renderSites();renderGrid();
   document.querySelector('[data-rmsite="site-a"]').click();
   const failedSite=sites.length===2&&![...document.querySelectorAll("[data-rmsite]")].some(button=>button.disabled);
   mode="silent";document.querySelector('[data-rmsite="site-a"]').click();renderSites();
   document.querySelector('[data-rmsite="site-b"]').click();
   const guarded=calls===2&&[...document.querySelectorAll("[data-rmsite]")].every(button=>button.disabled);
   await pause();late({ok:true,sites:[]});
   const siteTimeout=sites.length===2&&!siteRemovalPending&&!document.querySelector("[data-rmsite]").disabled;
   mode="success";document.querySelector('[data-rmsite="site-a"]').click();
   const siteSaved=sites.length===1&&sites[0].id==="site-b";
   mode="failure";let select=document.getElementById("library-sort");select.value="title";select.dispatchEvent(new Event("change"));await pause();
   const sortFailed=settings.librarySort==="recent"&&document.getElementById("library-sort").value==="recent";
   mode="silent";select=document.getElementById("library-sort");select.value="rating";select.dispatchEvent(new Event("change"));renderGrid();
   const sortBusy=document.getElementById("library-sort").disabled;
   await pause();late({ok:true,settings:{librarySort:"rating"}});
   const sortTimeout=settings.librarySort==="recent"&&!librarySortSaving&&!document.getElementById("library-sort").disabled;
   mode="success";select=document.getElementById("library-sort");select.value="title";select.dispatchEvent(new Event("change"));await pause();
   const sortSaved=settings.librarySort==="title"&&document.getElementById("library-sort").value==="title";
   return {failedSite,guarded,siteTimeout,siteSaved,sortFailed,sortBusy,sortTimeout,sortSaved};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;sites=originalSites;settings=originalSettings;renderSites();renderGrid();}
 });
 assert.deepEqual(libraryPreferences,{failedSite:true,guarded:true,siteTimeout:true,siteSaved:true,sortFailed:true,sortBusy:true,sortTimeout:true,sortSaved:true});
 const notificationFailures=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,originalNotifications=notifications;
  let mode="failure",late;const pending=[],sent=[];
  requestMetadata=(message,callback)=>request(message,callback,30);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="NOTIF_CLEAR"||message.type==="NOTIF_READ_ALL"){
    sent.push(message.type);
    if(mode==="failure")callback({ok:false});
    else if(mode==="silent")late=callback;
    else pending.push({message,callback});
    return;
   }
   return original.call(api.runtime,message,callback);
  };
  try{
   notifications=[{id:"test-alert",title:"Saved alert",read:false,ts:Date.now()}];renderNotifMenu();renderBell();
   await changeNotifications("NOTIF_READ_ALL");
   const unreadRetained=notifications[0].read===false&&!!document.querySelector("#bell .badge-dot");
   document.getElementById("notif-clear").click();
   await new Promise(resolve=>setTimeout(resolve,10));
   const failedClear=notifications.length===1&&!document.getElementById("notif-clear").disabled;
   mode="silent";const button=document.getElementById("notif-clear");button.click();button.click();
   await new Promise(resolve=>setTimeout(resolve,60));
   const timeout=notifications.length===1&&!notificationClearPending&&!document.getElementById("notif-clear").disabled&&sent.filter(type=>type==="NOTIF_CLEAR").length===2;
   late({ok:true,notifications:[]});
   const lateIgnored=notifications.length===1;
   mode="controlled";const read=changeNotifications("NOTIF_READ_ALL"),clear=changeNotifications("NOTIF_CLEAR");
   await new Promise(resolve=>setTimeout(resolve,0));
   const serialized=pending.length===1&&pending[0].message.type==="NOTIF_READ_ALL";
   pending[0].callback({ok:true,notifications:[{...notifications[0],read:true}]});await read;
   await new Promise(resolve=>setTimeout(resolve,0));
   const nextIsClear=pending.length===2&&pending[1].message.type==="NOTIF_CLEAR";
   pending[1].callback({ok:true,notifications:[]});await clear;
   return {unreadRetained,failedClear,timeout,lateIgnored,serialized,nextIsClear,cleared:notifications.length===0&&!document.querySelector("#bell .badge-dot")};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;notifications=originalNotifications;renderNotifMenu();renderBell();}
 });
 assert.deepEqual(notificationFailures,{unreadRetained:true,failedClear:true,timeout:true,lateIgnored:true,serialized:true,nextIsClear:true,cleared:true});
 const titleDraft=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,savedItems=items;
  let mode="failure",late,calls=0;
  requestMetadata=(message,callback)=>request(message,callback,25);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="UPDATE_ITEM"){
    calls++;
    if(mode==="silent"){late=callback;return;}
    if(mode==="failure"){callback({ok:false,error:"storage_failed"});return;}
    callback({ok:true,items:items.map(item=>item.id===message.id?{...item,...message.patch}:item)});return;
   }
   return original.call(api.runtime,message,callback);
  };
  try{
   openDrawer("audit-work");const input=document.getElementById("dr-title");
   const initial=items.find(item=>item.id==="audit-work").title;
   input.value="My personal title";input.dispatchEvent(new Event("change"));
   await new Promise(resolve=>setTimeout(resolve,10));
   const retained=input.isConnected&&input.value==="My personal title"&&!input.disabled&&!document.getElementById("dr-title-retry").hidden&&items.find(item=>item.id==="audit-work").title===initial;
   mode="silent";document.getElementById("dr-title-retry").click();
   input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
   const single=calls===2&&input.disabled;
   await new Promise(resolve=>setTimeout(resolve,50));
   late({ok:true,items:[]});
   const timeout=input.value==="My personal title"&&!input.disabled&&items.length>0;
   mode="success";document.getElementById("dr-title-retry").click();
   await new Promise(resolve=>setTimeout(resolve,10));
   const saved=items.find(item=>item.id==="audit-work").title==="My personal title"&&document.getElementById("dr-title").value==="My personal title";
   const fresh=document.getElementById("dr-title");fresh.value="  ";fresh.dispatchEvent(new Event("change"));
   const emptyRejected=fresh.getAttribute("aria-invalid")==="true"&&calls===3;
   return {retained,single,timeout,saved,emptyRejected};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;items=savedItems;closeDrawer();renderAll();}
 });
 assert.deepEqual(titleDraft,{retained:true,single:true,timeout:true,saved:true,emptyRejected:true});
 const removal=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,originalConfirm=window.confirm;
  const savedItems=items;let pending,calls=0;
  requestMetadata=(message,callback)=>request(message,callback,30);
  window.confirm=()=>true;
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="REMOVE_ITEM"){calls++;pending=callback;return;}
   return original.call(api.runtime,message,callback);
  };
  try{
   openDrawer("audit-work");const button=document.getElementById("dr-remove");
   button.click();button.click();
   const single=calls===1&&button.disabled&&button.getAttribute("aria-busy")==="true";
   await new Promise(resolve=>setTimeout(resolve,60));
   const timeout=!button.disabled&&!button.hasAttribute("aria-busy")&&items.some(item=>item.id==="audit-work");
   pending({ok:true,items:[]});
   const lateIgnored=items.some(item=>item.id==="audit-work");
   button.click();pending({ok:false,error:"storage_failed"});
   const failureRetained=!button.disabled&&items.some(item=>item.id==="audit-work");
   button.click();
   const other={id:"other-detail",title:"Another work",type:"reading",chapter:1,identityVersion:1,enrichedAt:1};
   items=[...savedItems,other];openDrawer(other.id);
   pending({ok:true,items:[other]});
   const otherOpen=document.getElementById("drawer").classList.contains("open")&&document.getElementById("drawer").dataset.itemId===other.id;
   return {single,timeout,lateIgnored,failureRetained,otherOpen,removed:!items.some(item=>item.id==="audit-work")};
  }finally{
   api.runtime.sendMessage=original;requestMetadata=request;window.confirm=originalConfirm;
   items=savedItems;closeDrawer();renderAll();
  }
 });
 assert.deepEqual(removal,{single:true,timeout:true,lateIgnored:true,failureRetained:true,otherOpen:true,removed:true});

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
