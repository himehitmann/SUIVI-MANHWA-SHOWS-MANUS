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
 const searchRecovery=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,originalNow=Date.now,previousFacets=searchFacets;
  const waiting=[];let mode="silent",sent=0,previewLate;
  requestMetadata=(message,callback)=>request(message,callback,25);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="CATALOG_SEARCH"){
    sent++;
    if(mode==="malformed"){callback({ok:true,results:null});return;}
    if(mode==="success"){callback({ok:true,results:[{title:"Recovered result",type:"reading"}],pending:false});return;}
    if(mode==="pending"){callback({ok:true,results:[{title:"Partial result",type:"reading"}],pending:true});return;}
    waiting.push(callback);return;
   }
   if(message.type==="CHECK_EXISTING"){previewLate=callback;return;}
   return original.call(api.runtime,message,callback);
  };
  const pause=()=>new Promise(resolve=>setTimeout(resolve,50));
  try{
   switchView("library");searchFacets={kind:"all",genre:"all",year:"",release:"all",price:200};
   query="test";lastResults=[{title:"Retained result",type:"reading"}];
   searchPageState={pending:false,hasMore:true,cursor:"page-2",error:false};renderSearchResults(query);
   catalogSearch(query,"page-2");await pause();
   const timeout=!searchPageState.pending&&searchPageState.error&&lastResults[0].title==="Retained result"&&!document.getElementById("search-more").disabled&&searchPageState.retryMore==="page-2";
   waiting[0]({ok:true,results:[],pending:false});
   const lateIgnored=lastResults[0].title==="Retained result";
   mode="malformed";document.getElementById("search-more").click();await pause();
   const malformed=searchPageState.error&&lastResults[0].title==="Retained result";
   mode="success";document.getElementById("search-more").click();await pause();
   const recovered=!searchPageState.error&&lastResults[0].title==="Recovered result";
   mode="silent";query="old";catalogSearch(query);query="new";catalogSearch(query);
   waiting[2]({ok:true,results:[{title:"Newest result",type:"reading"}],pending:false});
   waiting[1]({ok:true,results:[{title:"Obsolete result",type:"reading"}],pending:false});
   const newest=lastResults[0].title==="Newest result";
   mode="pending";const now=originalNow();Date.now=()=>now;query="partial";catalogSearch(query);
   Date.now=()=>now+46000;
   await new Promise(resolve=>setTimeout(resolve,550));
   const deadline=!searchPageState.pending&&searchPageState.error&&lastResults[0].title==="Partial result";
   Date.now=originalNow;clearSearchResults();
   openCatalogPreview({title:"Preview after timeout",manual:true,type:"reading"});await pause();
   const preview=document.querySelector("#drawer .drawer-title")?.textContent==="Preview after timeout";
   previewLate({existing:{id:"obsolete",title:"Obsolete",type:"reading"}});
   const previewProtected=!items.some(item=>item.id==="obsolete");
   return {timeout,lateIgnored,malformed,recovered,newest,deadline,preview,previewProtected,sent};
  }finally{Date.now=originalNow;api.runtime.sendMessage=original;requestMetadata=request;searchFacets=previousFacets;query="";clearSearchResults();closeDrawer();renderAll();}
 });
 assert(searchRecovery.timeout&&searchRecovery.lateIgnored&&searchRecovery.malformed&&searchRecovery.recovered&&searchRecovery.newest&&searchRecovery.deadline&&searchRecovery.preview&&searchRecovery.previewProtected,JSON.stringify(searchRecovery));
 const catalogAddRecovery=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,originalItems=items,originalLists=lists;
  let mode="failure",saveCalls=0,stateCalls=0,late;
  const entry={id:"catalog-added",title:"Catalog addition",type:"reading",chapter:0,identityVersion:1,enrichedAt:1};
  requestMetadata=(message,callback)=>request(message,callback,25);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="SAVE_PROGRESS"){
    saveCalls++;
    if(mode==="silent"){late=callback;return;}
    if(mode==="failure"){callback({ok:false});return;}
    if(mode==="list-failure"){callback({ok:false,error:"list_save_failed",item:entry});return;}
    callback({ok:true,item:entry});return;
   }
   if(message.type==="GET_STATE"){
    stateCalls++;
    if(mode==="refresh-failure"){callback({ok:false});return;}
    callback({items:[...originalItems,entry],lists:originalLists,settings:{lang:"stale"}});return;
   }
   return original.call(api.runtime,message,callback);
  };
  const button=document.createElement("button");button.textContent="Add";document.body.appendChild(button);
  const work={title:entry.title,type:"reading",listId:"audit-list"};
  try{
   const failed=await addFromCatalog(work,button);
   const failure=failed===false&&!button.disabled&&button.textContent==="Add"&&items===originalItems;
   mode="silent";const pending=addFromCatalog(work,button);
   const savingLabel=!button.textContent.includes("✓")&&button.disabled;
   const repeated=await addFromCatalog(work,button);await pending;
   late({ok:true,item:entry});
   const timeout=repeated===false&&saveCalls===2&&!button.disabled&&items===originalItems;
   mode="refresh-failure";const beforeSettings=settings;
   const refresh=await addFromCatalog(work,button);
   const retained=refresh===false&&items.some(item=>item.id==="audit-work")&&items.some(item=>item.id===entry.id)&&settings===beforeSettings;
   const writes=saveCalls;mode="success";const recovered=await addFromCatalog(work,button);
   const refreshOnly=recovered===true&&saveCalls===writes&&stateCalls===2&&document.getElementById("drawer").dataset.itemId===entry.id;
   closeDrawer();catalogAddStates.delete(button);mode="list-failure";
   const partial=await addFromCatalog(work,button);
   const partialRetained=partial===false&&items.some(item=>item.id===entry.id)&&!button.disabled&&!catalogAddStates.get(button).saved;
   mode="success";const repaired=await addFromCatalog(work,button);
   return {failure,savingLabel,timeout,retained,refreshOnly,partialRetained,repaired};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;button.remove();items=originalItems;lists=originalLists;closeDrawer();renderAll();}
 });
 assert.deepEqual(catalogAddRecovery,{failure:true,savingLabel:true,timeout:true,retained:true,refreshOnly:true,partialRetained:true,repaired:true});
 const languageChanges=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,originalSettings=settings;
  let mode="failure",pending,calls=0;
  requestMetadata=(message,callback)=>request(message,callback,30);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="SET_SETTINGS"&&Object.hasOwn(message.patch,"lang")){
    calls++;
    if(mode==="silent"||mode==="controlled"){pending=callback;return;}
    if(mode==="failure"){callback({ok:false});return;}
    callback({ok:true,settings:{lang:message.patch.lang,librarySort:"stale-value",profile:{name:"Stale profile"}}});return;
   }
   return original.call(api.runtime,message,callback);
  };
  try{
   settings={...settings,lang:"en",librarySort:"title",profile:{...settings.profile,name:"Current profile"}};
   document.documentElement.lang="en";switchView("settings");renderLangMenu();
   const select=document.getElementById("set-uilang");select.value="fr";select.dispatchEvent(new Event("change"));
   await new Promise(resolve=>setTimeout(resolve,10));
   const failure=settings.lang==="en"&&document.documentElement.lang==="en"&&select.value==="en"&&!select.disabled;
   mode="silent";const count=calls,save=applyLanguage("fr");
   renderLangMenu();renderSettings();
   const guarded=document.getElementById("set-uilang").disabled&&[...document.querySelectorAll("#lang-menu [data-lang]")].every(button=>button.disabled);
   const duplicate=await applyLanguage("ja");
   const timedOut=await save;
   pending({ok:true,settings:{lang:"fr"}});
   const timeout=timedOut===false&&duplicate===false&&calls===count+1&&settings.lang==="en"&&!document.getElementById("set-uilang").disabled;
   mode="controlled";const next=applyLanguage("fr");switchView("library");openDrawer("audit-work");
   pending({ok:true,settings:{lang:"fr",librarySort:"stale-value",profile:{name:"Stale profile"}}});await next;
   const navigation=view==="library"&&document.getElementById("drawer").classList.contains("open")&&document.getElementById("drawer").dataset.itemId==="audit-work";
   const preserved=settings.librarySort==="title"&&settings.profile.name==="Current profile";
   closeDrawer();mode="success";const languages=[];
   for(const code of Object.keys(LANGS)){
    const saved=await applyLanguage(code);
    languages.push({code,saved,applied:settings.lang===code&&document.documentElement.lang===code});
   }
   const before=calls;const invalid=await applyLanguage("unsupported");
   return {failure,guarded,timeout,navigation,preserved,languages,invalidRejected:invalid===false&&calls===before};
  }finally{
   api.runtime.sendMessage=original;requestMetadata=request;settings=originalSettings;
   document.documentElement.lang=settings.lang||"en";renderLangMenu();renderAll();switchView("library");
  }
 });
 assert(languageChanges.failure&&languageChanges.guarded&&languageChanges.timeout&&languageChanges.navigation&&languageChanges.preserved&&languageChanges.invalidRejected,JSON.stringify(languageChanges));
 assert(languageChanges.languages.every(result=>result.saved&&result.applied),JSON.stringify(languageChanges.languages));
 const drawerEdits=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,savedItems=items;
  let mode="failure",pending,calls=0,lastPatch;
  requestMetadata=(message,callback)=>request(message,callback,25);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="UPDATE_ITEM"){
    calls++;lastPatch=message.patch;
    if(mode==="silent"){pending=callback;return;}
    if(mode==="failure"){callback({ok:false});return;}
    callback({ok:true,items:items.map(item=>item.id===message.id?{...item,...message.patch}:item)});return;
   }
   return original.call(api.runtime,message,callback);
  };
  const pause=()=>new Promise(resolve=>setTimeout(resolve,45));
  const results=[];
  try{
   for(const [type,field,key,value] of [["reading","dr-num","chapter",17],["reading","dr-total","total",50],["reading","dr-season","volume",4],["watching","dr-num","episode",6],["watching","dr-season","season",3]]){
    items=[{id:"edit-work",title:"Edit work",type,chapter:2,episode:2,total:30,volume:2,season:1,identityVersion:1,enrichedAt:1}];openDrawer("edit-work");
    const input=document.getElementById(field),before=items[0][key],initial=input.value;
    mode="failure";input.value=String(value);input.dispatchEvent(new Event("change"));await pause();
    const retained=input.isConnected&&input.value===String(value)&&items[0][key]===before&&!input.disabled&&!document.getElementById(field+"-retry").hidden;
    mode="silent";const count=calls;document.getElementById(field+"-retry").click();input.dispatchEvent(new Event("change"));
    const guarded=calls===count+1&&input.disabled;
    await pause();pending({ok:true,items:[]});
    const timeout=input.isConnected&&!input.disabled&&items.length===1;
    mode="success";document.getElementById(field+"-retry").click();await pause();
    results.push({field,type,retained,guarded,timeout,saved:items[0][key]===value,initial});
   }
   const toggles=[];
   for(const [type,id,key] of [["reading","dr-notify","notifyUpdates"],["game","dr-notify-game-updates","notifyGameUpdates"],["game","dr-notify-game-events","notifyGameEvents"],["game","dr-notify-game-rewards","notifyGameRewards"],["reading","dr-home-toggle","homeHidden"]]){
    items=[{id:"edit-work",title:"Edit work",type,gameEnrichedAt:1,[key]:key==="homeHidden"?false:true,identityVersion:1,enrichedAt:1}];openDrawer("edit-work");
    mode="silent";const button=document.getElementById(id),before=items[0][key],count=calls;
    button.focus();button.click();button.click();
    const guarded=calls===count+1&&button.disabled;
    await pause();pending({ok:true,items:[]});
    const restored=items[0][key]===before&&!document.getElementById(id).disabled&&document.activeElement.id===id;
    mode="success";document.getElementById(id).click();await pause();
    toggles.push({id,guarded,restored,saved:items[0][key]===!before});
   }
   items=[{id:"edit-work",title:"Edit work",type:"reading",chapter:2,total:30,identityVersion:1,enrichedAt:1}];openDrawer("edit-work");
   mode="silent";const status=document.querySelector('#dr-status [data-status="completed"]');status.focus();status.click();
   const statusBusy=[...document.querySelectorAll("#dr-status button")].every(button=>button.disabled);
   await pause();pending({ok:true,items:[]});
   const statusRestored=!items[0].state&&document.activeElement.dataset.status==="completed";
   mode="success";document.querySelector('#dr-status [data-status="completed"]').click();await pause();
   const statusSaved=items[0].state==="completed"&&items[0].progress===100;
   return {results,toggles,statusBusy,statusRestored,statusSaved,lastPatch};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;items=savedItems;closeDrawer();renderAll();}
 });
 for(const result of drawerEdits.results){assert(result.retained&&result.guarded&&result.timeout&&result.saved,JSON.stringify(result));}
 assert.equal(drawerEdits.results.find(result=>result.key==="volume"||(result.field==="dr-season"&&result.type==="reading")).initial,"2");
 for(const result of drawerEdits.toggles){assert(result.guarded&&result.restored&&result.saved,JSON.stringify(result));}
 assert(drawerEdits.statusBusy&&drawerEdits.statusRestored&&drawerEdits.statusSaved,JSON.stringify(drawerEdits));
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
 // Import confirmation must never hydrate an absent or malformed snapshot.
 const importRecovery=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,parser=window.YomuImport;
  const before={items,lists,sites,notifications,settings};
  let mode="silent",late,writes=0,reads=0;
  requestMetadata=(message,callback)=>request(message,callback,20);
  window.YomuImport={parseFiles:async()=>({count:1,items:[],warnings:[]})};
  const input={files:[{}],value:"backup.json"};
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="IMPORT_MERGE"){writes++;if(mode==="silent"){late=callback;return;}callback({ok:true,added:1,updated:0});return;}
   if(message.type==="GET_STATE"){reads++;callback(mode==="malformed"?{items:[]}:before);return;}
   return original.call(api.runtime,message,callback);
  };
  try{
   switchView("settings");
   const pending=doImport({target:input});await doImport({target:input});
   renderSettings();
   const busy=importPending&&document.getElementById("import").disabled;
   await pending;
   const timeout=!importPending&&writes===1&&items===before.items&&!document.getElementById("import").disabled;
   late({ok:true,added:1,updated:0});await new Promise(resolve=>setTimeout(resolve,5));
   const ignored=reads===0&&items===before.items;
   mode="malformed";await doImport({target:input});
   const retained=items===before.items&&lists===before.lists&&document.getElementById("toast").textContent.includes("Import");
   mode="success";await doImport({target:input});
   return {busy,timeout,ignored,retained,recovered:!importPending&&items.length===before.items.length&&input.value==="",writes};
  }finally{
   api.runtime.sendMessage=original;requestMetadata=request;window.YomuImport=parser;
   ({items,lists,sites,notifications,settings}=before);importPending=false;renderAll();
  }
 });
 assert.deepEqual(importRecovery,{busy:true,timeout:true,ignored:true,retained:true,recovered:true,writes:3});
 // Failed initial/retry reads must not clear a previously confirmed library.
 const libraryLoading=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata;
  const saved={items,sites,notifications,lists,settings};let mode="silent",late,calls=0;
  requestMetadata=(message,callback)=>request(message,callback,20);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="GET_STATE"){calls++;if(mode==="silent"){late=callback;return;}callback(mode==="malformed"?{items:[]}:saved);return;}
   return original.call(api.runtime,message,callback);
  };
  try{
   const pending=loadLibraryState();await loadLibraryState();await pending;
   const failed=!libraryLoadPending&&!document.getElementById("library-load-retry").hidden&&items===saved.items&&calls===1;
   late({...saved,items:[]});await new Promise(resolve=>setTimeout(resolve,5));
   const lateIgnored=items===saved.items;
   mode="malformed";await loadLibraryState();
   const retained=items===saved.items&&lists===saved.lists&&settings===saved.settings;
   hydrate(undefined);const invalidHydrate=items===saved.items;
   mode="success";await loadLibraryState();
   const recovered=document.getElementById("library-load-status").hidden&&!libraryLoadPending;
   mode="silent";const stale=loadLibraryState();hydrate(saved);late({...saved,items:[]});await stale;
   return {failed,lateIgnored,retained,invalidHydrate,recovered,newerRetained:items===saved.items&&!libraryLoadPending};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;hydrate(saved);}
 });
 assert.deepEqual(libraryLoading,{failed:true,lateIgnored:true,retained:true,invalidHydrate:true,recovered:true,newerRetained:true});
 // Both category controls share confirmed state and the same "all" semantics.
 const categories=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,savedSettings=settings;
  let mode="silent",late,writes=0,lastPatch;
  requestMetadata=(message,callback)=>request(message,callback,20);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="SET_SETTINGS"&&message.patch.homeCats){
    writes++;lastPatch=message.patch.homeCats;
    if(mode==="silent"){late=callback;return;}
    if(mode==="failure"){callback({ok:false});return;}
    callback({ok:true,settings:{...settings,profile:{name:"Obsolete profile"},homeCats:mode==="invalid"?null:message.patch.homeCats}});return;
   }
   return original.call(api.runtime,message,callback);
  };
  try{
   settings={...settings,homeCats:["anime"],profile:{name:"Keep my profile"}};switchView("home");
   openHomeCats(document.getElementById("brand"));
   const pending=saveHomeCategories(["manga"]);await saveHomeCategories(["games"]);
   renderHome();
   const busy=homeCategorySaving&&[...document.querySelectorAll("[data-home-category],.cats-menu button")].every(button=>button.disabled);
   await pending;
   const timeout=!homeCategorySaving&&writes===1&&homeCatAllowed("anime")&&!homeCatAllowed("manga");
   late({ok:true,settings:{homeCats:["manga"]}});await new Promise(resolve=>setTimeout(resolve,5));
   const ignored=homeCatAllowed("anime")&&!homeCatAllowed("manga");
   mode="failure";await saveHomeCategories(["games"]);
   const failed=homeCatAllowed("anime");
   mode="invalid";await saveHomeCategories(["games"]);
   const invalid=homeCatAllowed("anime");
   mode="success";await homeCatsMenuEl.querySelector("[data-cat-all]").onclick();
   const all=HOME_CAT_KEYS.every(homeCatAllowed)&&lastPatch.length===HOME_CAT_KEYS.length&&homeCatsMenuEl===null;
   await saveHomeCategories([]);
   openHomeCats(document.getElementById("brand"));
   const empty=[...homeCatsMenuEl.querySelectorAll("[data-cat-toggle]")].every(button=>button.getAttribute("aria-pressed")==="false");
   await homeCatsMenuEl.querySelector('[data-cat-toggle="manga"]').onclick();
   const one=HOME_CAT_KEYS.filter(homeCatAllowed).join(",")==="manga";
   return {busy,timeout,ignored,failed,invalid,all,empty,one,profile:settings.profile.name};
  }finally{closeHomeCats();api.runtime.sendMessage=original;requestMetadata=request;settings=savedSettings;homeCategorySaving=false;renderAll();}
 });
 assert.deepEqual(categories,{busy:true,timeout:true,ignored:true,failed:true,invalid:true,all:true,empty:true,one:true,profile:"Keep my profile"});
 // Automatic game details cannot replace newer edits or another open fiche.
 const gameDetails=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,savedItems=items;
  let late,calls=0;
  requestMetadata=(message,callback)=>request(message,callback,20);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="GAME_ENRICH"){calls++;late=callback;return;}
   return original.call(api.runtime,message,callback);
  };
  const game=()=>({id:"audit-auto-game",title:"Game details",type:"game",url:"https://store.steampowered.com/app/123/",favorite:false});
  const result=item=>({...item,gameEnrichedAt:1,synopsis:"Confirmed game details"});
  try{
   let item=game();items=[item];openDrawer(item.id);openDrawer(item.id);
   await new Promise(resolve=>setTimeout(resolve,35));
   const bounded=calls===1&&!pendingGameDetails.has(item.id);
   late({ok:true,item:result(item)});
   const ignored=items[0]===item;
   openDrawer(item.id);const previous=late;
   items=[{...item,favorite:true}];previous({ok:true,item:result(item)});
   await new Promise(resolve=>setTimeout(resolve,5));
   const editPreserved=items[0].favorite===true&&!items[0].gameEnrichedAt;
   item=game();items=[item];openDrawer(item.id);
   late({ok:true,item:{...result(item),id:"wrong-game"}});
   await new Promise(resolve=>setTimeout(resolve,5));
   const identity=items[0]===item&&document.getElementById("dr-refresh-status").textContent===t("refreshFailed");
   openDrawer(item.id);
   const title=document.getElementById("dr-title");title.focus();title.value="Unsaved title";
   late({ok:true,item:result(item)});
   await new Promise(resolve=>setTimeout(resolve,5));
   const draft=title.isConnected&&title.value==="Unsaved title"&&items[0].synopsis==="Confirmed game details";
   item=game();const other={id:"other-game-test",title:"Other work",type:"reading",chapter:1};
   items=[item,other];openDrawer(item.id);const pending=late;openDrawer(other.id);
   pending({ok:true,item:result(item)});await new Promise(resolve=>setTimeout(resolve,5));
   return {bounded,ignored,editPreserved,identity,draft,otherOpen:document.getElementById("drawer").dataset.itemId===other.id};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;items=savedItems;closeDrawer();renderAll();}
 });
 assert.deepEqual(gameDetails,{bounded:true,ignored:true,editPreserved:true,identity:true,draft:true,otherOpen:true});
 // Manual metadata refresh preserves drafts/newer state and validates merge identities.
 const manualDetails=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,savedItems=items,savedLists=lists;
  let callback,calls=0;
  requestMetadata=(message,done)=>request(message,done,20);
  api.runtime.sendMessage=(message,done)=>{
   if(message.type==="COMPLETE_ITEM_METADATA"){calls++;callback=done;return;}
   return original.call(api.runtime,message,done);
  };
  const make=()=>({id:"manual-details",title:"Manual details",type:"reading",chapter:2,total:10,enrichedAt:1,identityVersion:1});
  const begin=()=>{
   const button=document.getElementById("dr-refresh-info");button.focus();
   return {button,promise:button.onclick({currentTarget:button})};
  };
  const reply=item=>({ok:true,matched:true,status:"matched",item:{...item,synopsis:"Fresh information"}});
  try{
   let item=make();items=[item];openDrawer(item.id);
   let request=begin();await request.button.onclick({currentTarget:request.button});await request.promise;
   const timeout=calls===1&&!request.button.disabled&&items[0]===item;
   callback(reply(item));const lateIgnored=items[0]===item;
   request=begin();document.getElementById("dr-title").value="My unsaved title";
   callback(reply(item));await request.promise;
   const draft=document.getElementById("dr-title").value==="My unsaved title"&&items[0]===item&&document.getElementById("dr-refresh-status").textContent===t("refreshDeferred");
   openDrawer(item.id);request=begin();items=[{...item,favorite:true}];
   callback(reply(item));await request.promise;
   const newer=items[0].favorite&&!items[0].synopsis;
   item=make();items=[item];openDrawer(item.id);request=begin();
   callback({...reply(item),item:{...item,id:"unrelated"}});await request.promise;
   const identity=items[0]===item&&document.getElementById("dr-refresh-status").textContent===t("refreshFailed");
   request=begin();callback({...reply(item),lists:{invalid:true}});await request.promise;
   const invalidLists=items[0]===item&&lists===savedLists;
   request=begin();callback(reply(item));await request.promise;
   const success=items[0].synopsis==="Fresh information"&&document.activeElement.id==="dr-refresh-info";
   return {timeout,lateIgnored,draft,newer,identity,invalidLists,success};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;items=savedItems;lists=savedLists;closeDrawer();renderAll();}
 });
 assert.deepEqual(manualDetails,{timeout:true,lateIgnored:true,draft:true,newer:true,identity:true,invalidLists:true,success:true});
 // The two create-list entry points share a lock and preserve later navigation.
 const listCreation=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,savedLists=lists;
  let pending,calls=0;
  requestMetadata=(message,callback)=>request(message,callback,20);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="LIST_CREATE"){calls++;pending=callback;return;}
   return original.call(api.runtime,message,callback);
  };
  try{
   switchView("library");backToLists();
   const first=newListFlow();await newListFlow();renderLists();
   const busy=["new-list","add-list-inline"].every(id=>document.getElementById(id).disabled);
   await first;
   const timeout=!listCreationPending&&calls===1&&lists===savedLists;
   const created={id:"creation-audit",name:"Created",itemIds:[]};
   pending({ok:true,list:created,lists:[...lists,created]});
   const lateIgnored=lists===savedLists;
   let next=newListFlow();pending({ok:true,list:created,lists:[]});await next;
   const malformed=lists===savedLists&&!listCreationPending;
   next=newListFlow();const newer={id:"newer-list-audit",name:"Newer change",itemIds:[]};
   lists=[...lists,newer];switchView("games");
   pending({ok:true,list:created,lists:[...savedLists,created]});await next;
   const navigation=view==="games"&&lists.some(list=>list.id===newer.id)&&lists.some(list=>list.id===created.id);
   switchView("library");backToLists();
   next=newListFlow();const final={id:"creation-final-audit",name:"Final",itemIds:[]};
   pending({ok:true,list:final,lists:[...lists,final]});await next;
   return {busy,timeout,lateIgnored,malformed,navigation,opened:currentListId===final.id&&document.activeElement.id==="list-name",released:!listCreationPending&&!document.getElementById("add-list-inline").disabled};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;lists=savedLists;listCreationPending=false;currentListId=null;backToLists();renderAll();}
 });
 assert.deepEqual(listCreation,{busy:true,timeout:true,lateIgnored:true,malformed:true,navigation:true,opened:true,released:true});
 // Duplicate/archive share a per-list lock, preserving other lists and navigation.
 const listActions=await page.evaluate(async()=>{
  const original=api.runtime.sendMessage,request=requestMetadata,savedLists=lists;
  let pending,calls=0;
  requestMetadata=(message,callback)=>request(message,callback,20);
  api.runtime.sendMessage=(message,callback)=>{
   if(message.type==="LIST_DUPLICATE"||message.type==="LIST_UPDATE"){calls++;pending=callback;return;}
   return original.call(api.runtime,message,callback);
  };
  const source={id:"action-source",name:"Source",itemIds:[],archived:false};
  try{
   lists=[source];switchView("library");openList(source.id);
   const first=runListAction(source,true);await runListAction(source,false);renderListDetail();
   const busy=document.getElementById("list-duplicate").disabled&&document.getElementById("list-archive").disabled;
   await first;
   const timeout=calls===1&&!pendingListActions.has(source.id)&&lists.length===1&&!document.getElementById("list-duplicate").disabled;
   const copy={...source,id:"action-copy"};
   pending({ok:true,list:copy,lists:[source,copy]});const ignored=lists.length===1;
   let next=runListAction(source,true);pending({ok:true,list:source,lists:[source]});await next;
   const invalid=lists.length===1;
   next=runListAction(source,true);switchView("games");
   const other={...source,id:"action-other",name:"New list"};lists=[source,other];
   pending({ok:true,list:copy,lists:[source,copy]});await next;
   const navigation=view==="games"&&lists.some(entry=>entry.id===other.id)&&lists.some(entry=>entry.id===copy.id);
   switchView("library");openList(source.id);
   next=runListAction(source,false);
   lists=lists.map(entry=>entry.id===source.id?{...entry,name:"New name"}:entry);
   pending({ok:true,lists:[{...source,archived:true}]});await next;
   const archive=lists.find(entry=>entry.id===source.id).archived&&lists.find(entry=>entry.id===source.id).name==="New name"&&lists.length===3&&currentListId===null;
   const archived=lists.find(entry=>entry.id===source.id);openList(archived.id);
   next=runListAction(archived,false);pending({ok:true,lists:[{...archived,archived:false}]});await next;
   return {busy,timeout,ignored,invalid,navigation,archive,restore:!lists.find(entry=>entry.id===source.id).archived&&!pendingListActions.size};
  }finally{api.runtime.sendMessage=original;requestMetadata=request;lists=savedLists;currentListId=null;backToLists();renderAll();}
 });
 assert.deepEqual(listActions,{busy:true,timeout:true,ignored:true,invalid:true,navigation:true,archive:true,restore:true});
 // G13 acceptance: independent fixture expectations across the complete library filter matrix.
 const libraryAcceptance=await page.evaluate(()=>{
  const saved={items,lists,sites,settings,filter,libraryFormat,libraryUnlisted,libraryQuery,currentListId,showArchivedLists};
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const ids=()=>[...document.querySelectorAll("#grid article.card")].map(card=>card.dataset.open);
  const eq=(actual,expected,label)=>check(JSON.stringify(actual)===JSON.stringify(expected),label+": "+JSON.stringify(actual));
  const stats=()=>[...document.querySelectorAll("#stats b")].map(node=>Number(node.textContent));
  const shortcuts=()=>[...document.querySelectorAll("#library-shortcuts strong")].map(node=>Number(node.textContent));
  const rows=[
   {id:"a",title:"Alpha 10",type:"reading",format:"MANGA",state:"current",favorite:true,chapter:1,total:10,rating:3,tags:["quux"]},
   {id:"b",title:"Beta",type:"reading",format:"WEBTOON",state:"planned",chapter:0,total:5,rating:5,alternativeTitles:["Aliasneedle"]},
   {id:"c",title:"Gamma",type:"watching",format:"ANIME",state:"completed",favorite:true,episode:12,total:12,rating:4},
   {id:"d",title:"Delta",type:"watching",format:"SERIES",state:"on_hold",episode:2,total:10,rating:1,authors:["Authorneedle"]},
   {id:"e",title:"Epsilon",type:"reading",format:"MANGA",state:"dropped",chapter:3,total:6,rating:2},
   {id:"f",title:"Zeta",type:"watching",format:"SERIES",progress:100,favorite:true,episode:8,total:8,tags:["quux"]},
   {id:"g",title:"Game excluded from collection",type:"game",favorite:true,state:"completed"}
  ].map((item,index)=>({...item,createdAt:(index+1)*10,activityAt:(6-index)*10,enrichedAt:1,identityVersion:1}));
  const filterSets={all:"abcdef",reading:"abe",watching:"cdf",favorites:"acf",current:"a",planned:"b",completed:"cf",on_hold:"d",dropped:"e"};
  const formatSets={all:"abcdef",MANGA:"ae",SERIES:"df"};
  const querySets={"":"abcdef",aliasneedle:"b",authorneedle:"d",quux:"af"};
  let combinations=0;
  try{
   items=rows;lists=[{id:"active-audit",name:"Active list",itemIds:["a","c","g","a","missing"]},{id:"archive-audit",name:"Archived list",archived:true,itemIds:["b"]}];
   sites=[{host:"one.example",name:"One",url:"https://one.example"},{host:"two.example",name:"Two",url:"https://two.example"}];
   settings={...settings,lang:"en",librarySort:"title"};currentListId=null;showArchivedLists=false;switchView("library");
   eq(stats(),[6,3,3,3,2],"global counts");eq(shortcuts(),[6,1,2],"section counts");
   eq(listMembers(lists[0]).map(item=>item.id),["a","c","g"],"list excludes orphan and duplicate members");
   for(const [f,fset] of Object.entries(filterSets))for(const [format,mset] of Object.entries(formatSets))for(const unlisted of [false,true])for(const [query,qset] of Object.entries(querySets)){
    filter=f;libraryFormat=format;libraryUnlisted=unlisted;libraryQuery=query;renderFilters();renderGrid();
    const expected=[...fset].filter(id=>mset.includes(id)&&qset.includes(id)&&(!unlisted||!"ac".includes(id))).sort();
    eq(ids().sort(),expected,"combined filters "+[f,format,unlisted,query].join("/"));
    check(document.querySelector(".library-result-count").textContent.startsWith(expected.length+" / 6 "),"result count");
    check(document.querySelector('#filters [aria-pressed="true"]').dataset.f===f,"selected status");
    check(document.getElementById("library-format").value===format,"selected format");
    check(document.getElementById("library-unlisted").checked===unlisted,"unlisted control");
    eq(stats(),[6,3,3,3,2],"global counts remain global");combinations++;
   }
   filter="all";libraryFormat="all";libraryUnlisted=false;libraryQuery="";
   const sorts={title:["a","b","d","e","c","f"],rating:["b","c","a","e","d","f"],recent:["a","b","c","d","e","f"],added:["f","e","d","c","b","a"],remaining:["a","d","b","e","c","f"]};
   for(const [sort,expected] of Object.entries(sorts)){settings.librarySort=sort;renderGrid();eq(ids(),expected,"sort "+sort);}
   filter="favorites";libraryFormat="MANGA";libraryUnlisted=true;libraryQuery="no-match";renderFilters();renderGrid();
   check(!ids().length&&document.querySelector("#grid .empty").textContent.includes("filters"),"filtered empty state");
   document.getElementById("reset-library-filters").click();
   check(ids().length===6&&filter==="all"&&libraryFormat==="all"&&!libraryUnlisted&&!libraryQuery,"reset all filters");
   libraryFormat="ANIME";items=items.filter(item=>item.id!=="c");renderAll();
   check(document.getElementById("library-format").value==="ANIME"&&!ids().length,"removed format stays visible");
   eq(stats(),[5,3,2,2,1],"counts after removal");eq(listMembers(lists[0]).map(item=>item.id),["a","g"],"members after removal");
   items=items.map(item=>item.id==="b"?{...item,type:"game"}:item);libraryFormat="all";renderAll();eq(stats(),[4,2,2,2,1],"counts after type change");
   lists=lists.map(list=>({...list,archived:true}));libraryUnlisted=true;renderAll();
   check(ids().length===4,"archive releases unlisted membership");eq(shortcuts(),[4,0,2],"archive counts");
   items=[...items,{id:"h",title:"Imported reading",type:"reading",chapter:1,total:2}];renderAll();eq(stats(),[5,3,2,2,1],"counts after imported addition");
   sites=sites.slice(0,1);renderAll();eq(shortcuts(),[5,0,1],"site removal count");
   items=[rows[6]];renderAll();check(document.getElementById("library-open-games")&&document.getElementById("library-start-search"),"game-only library offers both paths");eq(stats(),[0,0,0,0,0],"game-only counts");
   items=[];renderAll();check(!document.getElementById("library-open-games")&&document.getElementById("library-start-search"),"empty library action");
   return {combinations,sorts:Object.keys(sorts).length,counts:true,emptyStates:true,formatRetention:true};
  }finally{
   ({items,lists,sites,settings,filter,libraryFormat,libraryUnlisted,libraryQuery,currentListId,showArchivedLists}=saved);renderAll();
  }
 });
 assert.equal(libraryAcceptance.combinations,216);assert.equal(libraryAcceptance.sorts,5);
 await fs.writeFile("test-results/library-acceptance.json",JSON.stringify(libraryAcceptance,null,2));
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
