import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'yomu-bulk-test-'));const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${process.cwd()}`,`--load-extension=${process.cwd()}`]});
try {
 const w=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 await w.evaluate(()=>{getDiscover=async()=>({ts:Date.now(),discoveryVersion:3,manga:[],manhwa:[],manhua:[],anime:[],kdrama:[],cdrama:[],jdrama:[],series:[],gamesSoon:[],gamesHot:[],gamesNew:[]});});

 const p=await context.newPage();await p.goto(`chrome-extension://${new URL(w.url()).host}/library.html`);await p.waitForFunction(()=>typeof hydrate==='function');
 await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:'GET_STATE'},r=>{hydrate(r);resolve();})));
 await w.evaluate(async()=>{await chrome.storage.local.set({'dasi.schema':3,'dasi.settings':{lang:'fr'},'dasi.items':[{id:'a',title:'Alpha',type:'reading',chapter:2},{id:'b',title:'Beta',type:'reading',chapter:8},{id:'c',title:'Gamma',type:'reading',chapter:4}],'dasi.lists':[{id:'source',name:'Source',itemIds:['a','b','c']},{id:'destination',name:'Destination',itemIds:[]}]});});
 await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:'GET_STATE'},r=>{hydrate(r);resolve();})));
 await p.waitForFunction(()=>items.length===3&&lists.some(l=>l.id==='source'));
 await p.evaluate(()=>switchView('library'));
 await p.locator('[data-list="source"] .list-open').focus();await p.keyboard.press('Enter');
 await p.locator('#list-name').waitFor();
 // Creating a list with a work is one write; failed creation cannot add it to an existing list.
 const beforeQuickCreate=await w.evaluate(()=>chrome.storage.local.get("dasi.lists"));
 await p.evaluate(()=>{
   openQuickAdd("a",document.getElementById("list-duplicate"));
   globalThis.quickCreateOriginal=chrome.runtime.sendMessage;
   chrome.runtime.sendMessage=(m,cb)=>m.type==="LIST_CREATE"?cb({ok:false,error:"storage_failed"}):globalThis.quickCreateOriginal(m,cb);
 });
 p.once("dialog",dialog=>dialog.accept("Failed list"));
 await p.locator("[data-ql-new]").click();
 assert.deepEqual(await w.evaluate(()=>chrome.storage.local.get("dasi.lists")),beforeQuickCreate);
 assert.equal(await p.locator("[data-ql-new]").isEnabled(),true);
 await p.evaluate(()=>{chrome.runtime.sendMessage=globalThis.quickCreateOriginal;delete globalThis.quickCreateOriginal;});
 p.once("dialog",dialog=>dialog.accept("New queue"));
 await p.locator("[data-ql-new]").click();
 await p.waitForFunction(()=>lists.some(l=>l.name==="New queue"&&l.itemIds.includes("a")));
 const createdQueue=await w.evaluate(async()=>(await chrome.storage.local.get("dasi.lists"))["dasi.lists"].find(l=>l.name==="New queue"));
 assert.deepEqual(createdQueue.itemIds,["a"]);
 const badCreation=await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:"LIST_CREATE",name:"Invalid",itemIds:["not-saved"]},resolve)));
 assert.equal(badCreation.ok,false);
 await p.evaluate(id=>new Promise(resolve=>chrome.runtime.sendMessage({type:"LIST_DELETE",id},r=>{lists=r.lists;closeQuickAdd();renderListDetail();resolve();})),createdQueue.id);
 // The saved-work drawer uses the same membership operation for add and remove.
 await p.evaluate(()=>openDrawer("a"));
 await p.locator('#dr-lists [data-list="destination"]').click();
 await p.waitForFunction(()=>lists.find(l=>l.id==="destination").itemIds.includes("a"));
 await p.locator('#dr-lists [data-list="destination"]').click();
 await p.waitForFunction(()=>!lists.find(l=>l.id==="destination").itemIds.includes("a"));
 await p.locator("#dr-close").click();
 // Concurrent member edits from different views must merge in the service worker.
 const memberChanges=await p.evaluate(async()=>{
   const send=message=>new Promise(resolve=>chrome.runtime.sendMessage(message,resolve));
   return Promise.all([send({type:"LIST_MEMBERSHIP",id:"destination",itemId:"a",adding:true}),send({type:"LIST_MEMBERSHIP",id:"destination",itemId:"b",adding:true})]);
 });
 assert(memberChanges.every(r=>r.ok));
 const mergedMembers=await w.evaluate(async()=>(await chrome.storage.local.get("dasi.lists"))["dasi.lists"].find(l=>l.id==="destination").itemIds);
 assert.deepEqual([...mergedMembers].sort(),["a","b"]);
 const rejectedMember=await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:"LIST_MEMBERSHIP",id:"destination",itemId:"missing",adding:true},resolve)));
 assert.equal(rejectedMember.ok,false);
 await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:"LIST_SET_ITEMS",id:"destination",itemIds:[]},r=>{lists=r.lists;renderListDetail();resolve();})));
 await p.locator('[data-id="a"] .list-select').check();await p.locator('[data-id="b"] .list-select').check();await p.locator('#bulk-destination').selectOption('destination');await p.locator('#bulk-copy').click();
 await p.waitForFunction(()=>lists.find(l=>l.id==='destination').itemIds.length===2);
 assert.deepEqual(await w.evaluate(async()=>(await chrome.storage.local.get('dasi.lists'))['dasi.lists'].find(l=>l.id==='source').itemIds),['a','b','c']);
 await p.locator('[data-id="c"] .list-select').check();await p.locator('#bulk-destination').selectOption('destination');await p.evaluate(()=>{globalThis.bulkOriginalSend=chrome.runtime.sendMessage;chrome.runtime.sendMessage=(m,cb)=>{if(m.type==='LIST_TRANSFER')return cb({ok:false,error:'storage_failed'});return globalThis.bulkOriginalSend(m,cb);};});
 await p.locator('#bulk-move').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('La liste n’a pas été enregistrée'));
 assert.deepEqual(await p.evaluate(()=>lists.find(l=>l.id==='source').itemIds),['a','b','c']);
 assert.deepEqual(await p.evaluate(()=>lists.find(l=>l.id==='destination').itemIds),['a','b']);
 await p.evaluate(()=>{chrome.runtime.sendMessage=globalThis.bulkOriginalSend;});
 await w.evaluate(()=>{globalThis.transferWriteOriginal=chrome.storage.local.set;chrome.storage.local.set=async function(value){if(value["dasi.lists"])throw Error("simulated_storage_failure");return globalThis.transferWriteOriginal.call(chrome.storage.local,value);};});
 try {
   const failed=await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:"LIST_TRANSFER",sourceId:"source",destinationId:"destination",itemIds:["c"],action:"move"},resolve)));
   assert.equal(failed.ok,false);
   const unchanged=await w.evaluate(async()=>(await chrome.storage.local.get("dasi.lists"))["dasi.lists"]);
   assert.deepEqual(unchanged.find(l=>l.id==="source").itemIds,["a","b","c"]);
   assert.deepEqual(unchanged.find(l=>l.id==="destination").itemIds,["a","b"]);
 } finally {await w.evaluate(()=>{chrome.storage.local.set=globalThis.transferWriteOriginal;delete globalThis.transferWriteOriginal;});}
 await p.locator('#bulk-move').click();
 await p.waitForFunction(()=>lists.find(l=>l.id==='source').itemIds.length===2);
 assert.deepEqual(await p.evaluate(()=>lists.find(l=>l.id==='destination').itemIds),['a','b','c']);
 const invalidTransfer=await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:'LIST_TRANSFER',sourceId:'source',destinationId:'destination',itemIds:['c'],action:'move'},resolve)));
 assert.equal(invalidTransfer.ok,false,"Cannot transfer a work absent from the source");
 assert.deepEqual(await w.evaluate(async()=>(await chrome.storage.local.get('dasi.lists'))['dasi.lists'].find(l=>l.id==='source').itemIds),['a','b']);
 await p.locator('[data-id="b"] .list-select').check();await p.locator('#bulk-up').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>lists.find(l=>l.id==='source').itemIds[0]==='b');
 await p.locator('#bulk-remove').click();await p.waitForFunction(()=>lists.find(l=>l.id==='source').itemIds.length===1);
 assert.equal(await w.evaluate(async()=>(await chrome.storage.local.get('dasi.items'))['dasi.items'].length),3);
 await p.setViewportSize({width:375,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
 await p.screenshot({path:'test-results/bulk-lists-mobile.png'});
 // Duplicate, rename, archive, restore and delete a list without changing its source or works.
 await p.locator("#list-duplicate").click();
 await p.waitForFunction(()=>currentListId!=="source"&&lists.some(l=>l.id===currentListId));
 const duplicateId=await p.evaluate(()=>currentListId);
 await p.locator("#list-name").fill("My restored queue");await p.locator("#list-name").press("Tab");
 await p.waitForFunction(id=>lists.find(l=>l.id===id)?.name==="My restored queue",duplicateId);
 await p.locator("#list-archive").click();
 await p.waitForFunction(id=>lists.find(l=>l.id===id)?.archived===true&&!currentListId,duplicateId);
 assert.equal(await p.locator('[data-list="'+duplicateId+'"]').count(),0);
 await p.locator("#toggle-archived").focus();await p.keyboard.press("Enter");
 assert.equal(await p.locator("#toggle-archived").getAttribute("aria-pressed"),"true");
 assert.equal(await p.locator("#toggle-archived").evaluate(node=>node===document.activeElement),true);
 assert((await p.locator("#library-lists-title").innerText()).includes("(1)"));
 await p.locator('[data-list="'+duplicateId+'"]').click();
 await p.locator("#list-archive").click();
 await p.waitForFunction(id=>lists.find(l=>l.id===id)?.archived===false&&!currentListId,duplicateId);
 assert.equal(await p.locator("#list-strip .list-empty-help").count(),1,"Restoring the last archived list must explain the empty archive");
 assert((await p.locator("#library-lists-title").innerText()).includes("(0)"));
 await p.locator("#toggle-archived").click();
 assert.equal(await p.locator("#toggle-archived").getAttribute("aria-pressed"),"false");
 assert.equal(await p.locator("#list-strip .list-empty-help").count(),0);
 await p.locator('[data-delete-list="'+duplicateId+'"]').click();await p.locator("#list-delete-yes").click();
 await p.waitForFunction(id=>!lists.some(l=>l.id===id),duplicateId);
 const lifecycle=await w.evaluate(async()=>chrome.storage.local.get(["dasi.lists","dasi.items"]));
 assert.deepEqual(lifecycle["dasi.lists"].find(l=>l.id==="source").itemIds,["a"]);
 assert.equal(lifecycle["dasi.items"].length,3);

 // Imported missing/duplicate IDs must not create invisible reorder steps.
 await w.evaluate(async()=>{const state=await chrome.storage.local.get("dasi.lists");await chrome.storage.local.set({"dasi.lists":[...state["dasi.lists"],{id:"reorder-import",name:"Imported",itemIds:["missing","a","b","a"]}]});});
 await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:"GET_STATE"},r=>{hydrate(r);openList("reorder-import");resolve();})));
 await p.locator('[data-id="a"] .list-select').check();
 assert.equal(await p.locator("#bulk-up").isDisabled(),true,"First visible work must not move into a missing record");
 await p.locator("#bulk-down").click();
 await p.waitForFunction(()=>lists.find(l=>l.id==="reorder-import").itemIds.join(",")==="b,a");
 assert.deepEqual(await p.locator("#list-items [data-id]").evaluateAll(rows=>rows.map(r=>r.dataset.id)),["b","a"]);
 assert.equal(await p.locator("#bulk-down").isDisabled(),true);
 await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:"LIST_DELETE",id:"reorder-import"},r=>{lists=r.lists;backToLists();resolve();})));


 await p.setViewportSize({width:1440,height:1000});
 await w.evaluate(async()=>{
   mangaSearchResilient=async()=>[];
   catalogDetail=async item=>({...item,synopsis:"A magical academy adventure",cast:[{name:"Actor",character:"Hero"}],trailerUrl:"https://www.youtube.com/watch?v=abcdefghijk"});
   await chrome.storage.local.set({"dasi.items":Array.from({length:7},(_,n)=>({id:"fixture"+n,title:"Fixture "+n,type:n<4?"reading":"watching",chapter:1,episode:1,total:3,enrichedAt:1,identityVersion:1,synopsis:"Magic academy"}))});
 });
 await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:"GET_STATE"},r=>{hydrate(r);query="";filter="all";clearSearchResults();switchView("library");resolve();})));
 assert.equal(await p.locator("#grid .card").count(),7,"All seven tracked works must remain visible");
 assert.equal(await p.locator("#grid .quick-add").count(),0);
 await p.locator("#library-sort").selectOption("title");
 assert.equal(await p.locator("#grid .card").first().getAttribute("data-open"),"fixture0");
 await p.evaluate(()=>{items[0].format="MANGA";items[1].format="ANIME";lists=[...lists,{id:"filter-test",itemIds:["fixture0"]}];renderGrid();});
 await p.locator("#library-format").selectOption("MANGA");
 assert.equal(await p.locator("#grid .card").count(),1);
 await p.locator("#library-unlisted").check();
 assert.equal(await p.locator("#grid .card").count(),0);
 assert((await p.locator("#grid .empty").innerText()).includes("Aucune œuvre ne correspond"),"Filtered library must not look like an empty account");
 await p.locator("#reset-library-filters").click();
 assert.equal(await p.locator("#grid .card").count(),7);
 assert.equal(await p.locator("#library-format").inputValue(),"all");
 assert.equal(await p.locator("#library-unlisted").isChecked(),false);
 await p.locator('#grid [data-rate="fixture0"][data-v="4"]').focus();await p.keyboard.press("Enter");
 await p.waitForFunction(()=>items.find(i=>i.id==="fixture0").rating===4);
 assert.equal(await p.locator('#grid [data-rate="fixture0"][data-v="4"]').getAttribute("aria-pressed"),"true");
 assert.equal(await p.locator('#grid [data-rate="fixture0"][data-v="4"]').evaluate(node=>node===document.activeElement),true);
 await p.keyboard.press("Enter");await p.waitForFunction(()=>items.find(i=>i.id==="fixture0").rating===0);
 await p.locator('#grid [data-fav="fixture0"]').focus();await p.keyboard.press("Enter");
 await p.waitForFunction(()=>items.find(i=>i.id==="fixture0").favorite===true);
 assert.equal(await p.locator("#stats .chip b").nth(3).innerText(),"1");
 await p.locator('#filters [data-f="favorites"]').click();
 assert.equal(await p.locator("#grid .card").count(),1);
 await p.locator('#grid [data-fav="fixture0"]').focus();await p.keyboard.press("Enter");
 await p.waitForFunction(()=>!items.find(i=>i.id==="fixture0").favorite);
 assert.equal(await p.locator("#grid .card").count(),0);
 assert.equal(await p.locator("#stats .chip b").nth(3).innerText(),"0");
 assert.equal(await p.locator('#filters [data-f="favorites"]').evaluate(node=>node===document.activeElement),true);
 await p.locator("#reset-library-filters").click();
 const controlsSaved=await w.evaluate(async()=>(await chrome.storage.local.get("dasi.items"))["dasi.items"].find(i=>i.id==="fixture0"));
 assert.equal(controlsSaved.rating,0);assert.equal(controlsSaved.favorite,false);

 await p.evaluate(()=>{items[2].alternativeTitles=["Étoile du soir"];items[2].authors=["Auteur test"];renderGrid();globalThis.localSearchOriginal=api.runtime.sendMessage;globalThis.localSearchCalls=0;api.runtime.sendMessage=function(...args){globalThis.localSearchCalls++;return globalThis.localSearchOriginal.apply(api.runtime,args);};});
 try {
   await p.locator("#library-search").fill("etoile du soir");
   assert.equal(await p.locator("#grid .card").count(),1);
   assert.equal(await p.locator("#grid .card").getAttribute("data-open"),"fixture2");
   await p.locator("#library-search").fill("auteur test");
   assert.equal(await p.locator("#grid .card").count(),1);
   assert.equal(await p.locator("#library-search").evaluate(node=>node===document.activeElement),true);
   assert.equal(await p.locator("#q").inputValue(),"");
   assert.equal(await p.evaluate(()=>globalThis.localSearchCalls),0,"Local library search must not request a catalog");
   await p.locator("#reset-library-filters").click();
   assert.equal(await p.locator("#library-search").inputValue(),"");
   assert.equal(await p.locator("#grid .card").count(),7);
 } finally {await p.evaluate(()=>{api.runtime.sendMessage=globalThis.localSearchOriginal;delete globalThis.localSearchOriginal;delete globalThis.localSearchCalls;});}

 await p.evaluate(()=>{query="catalog kept";document.getElementById("q").value=query;libraryQuery=" ";renderGrid();});
 assert.equal(await p.locator("#grid .card").count(),7);
 assert.equal(await p.locator("#reset-library-filters").count(),1,"An active filter remains clearable even when all works match");
 await p.locator("#reset-library-filters").focus();await p.keyboard.press("Enter");
 assert.equal(await p.locator("#library-search").inputValue(),"");
 assert.equal(await p.locator("#library-search").evaluate(node=>node===document.activeElement),true);
 assert.equal(await p.locator("#q").inputValue(),"catalog kept","Clearing library filters must preserve catalog input");
 assert.equal(await p.evaluate(()=>query),"catalog kept","Clearing library filters must preserve catalog state");
 assert.equal(await p.locator("#reset-library-filters").count(),0);
 await p.evaluate(()=>{query="";document.getElementById("q").value="";});

 const layout=await p.locator("#grid .library-result-count").evaluate(node=>({count:node.getBoundingClientRect().width,grid:node.parentElement.getBoundingClientRect().width}));
 assert(Math.abs(layout.count-layout.grid)<4,"Result count must not consume a poster column");
 await p.evaluate(()=>{globalThis.libraryEmptyBefore=items;items=[{id:"only-game",title:"Game",type:"game"}];renderGrid();});
 await p.locator("#library-start-search").click();
 assert.equal(await p.locator("#q").evaluate(node=>node===document.activeElement),true);
 await p.locator("#library-open-games").click();
 assert.equal(await p.locator("#view-games").isVisible(),true);
 await p.evaluate(()=>{items=globalThis.libraryEmptyBefore;delete globalThis.libraryEmptyBefore;switchView("library");});


 await p.evaluate(()=>openCatalogPreview({title:"Unsaved fixture",type:"reading",externalIds:{anilist:"999"},cover:"",genres:["Fantasy"]}));
 assert(await p.locator("#preview-add").isDisabled(),"A destination must be selected");
 await p.waitForFunction(()=>document.querySelector("#preview-info").textContent.includes("Actor"));
 assert.equal(await p.locator("#preview-info iframe").count(),1,"Trailer is embedded directly in the details");
 assert.equal(await p.locator("#preview-info [data-trailer-src]").count(),0,"No redundant activation button");
 assert.equal(await p.locator("#drawer a[target='_blank']").count(),0,"Preview must not redirect to a catalog");
 assert.equal(await w.evaluate(async()=>(await chrome.storage.local.get("dasi.items"))["dasi.items"].length),7,"Browsing must not save");
 await p.locator("#preview-list").selectOption("destination");
 await p.locator("#preview-add").click();
 await p.waitForFunction(()=>items.length===8&&document.querySelectorAll("#grid .card").length===8).catch(async error=>{console.log("SAVE_DIAGNOSTIC",await p.evaluate(()=>({items:items.map(i=>({id:i.id,title:i.title,externalIds:i.externalIds})),toast:document.querySelector("#toast")?.textContent,status:document.querySelector("#preview-status")?.textContent,grid:document.querySelectorAll("#grid .card").length,query,filter,currentListId})));throw error;});
 assert(await p.evaluate(()=>!document.getElementById("lib-main").classList.contains("searching")));
 const savedId=await p.evaluate(()=>items.find(i=>i.title==="Unsaved fixture").id);
 assert(await p.evaluate(id=>lists.find(l=>l.id==="destination").itemIds.includes(id),savedId));
 await p.evaluate(()=>{closeDrawer();openCatalogPreview({title:"Unsaved fixture",type:"reading",externalIds:{anilist:"999"}});});
 assert.equal(await p.locator("#preview-add").count(),0,"Already-saved work opens its library record");
 assert.equal(await p.evaluate(()=>document.getElementById("drawer").dataset.itemId),savedId);
 assert(await p.evaluate(()=>!isNew({type:"watching",episode:2,total:2,updatedAt:Date.now()})),"Saving is not a new release");
 assert(await p.evaluate(()=>isNew({type:"watching",season:1,episode:2,recentEpisodes:[{season:1,episode:3,at:Date.now()-1000}]})));
 assert(await p.evaluate(()=>!isNew({type:"watching",season:1,episode:3,recentEpisodes:[{season:1,episode:3,at:Date.now()-1000}]})),"Caught-up work leaves new releases");
 await p.evaluate(()=>{closeDrawer();discover={manga:[1,2,3].map(n=>({title:"Manga "+n,type:"reading",cover:"cover",genres:[]})),anime:[1,2,3].map(n=>({title:"Anime "+n,type:"watching",cover:"cover",genres:[]}))};switchView("home");});
 assert.equal(await p.locator("#view-home [data-add-disco]").count(),0);
 assert.equal(await p.locator("#view-home .disco-tabs").count(),0,"Categories must not be mixed into an all-time ranking");
 assert.equal(await p.locator("#view-home .disco-wrap").count(),2);
 await p.locator("#view-home [data-preview-disco]").first().click();
 assert(await p.locator("#preview-add").isDisabled());
 await p.screenshot({path:"test-results/internal-discovery.png"});
 await p.evaluate(()=>{closeDrawer();openDrawer("fixture0");});
 await p.locator("#dr-home-toggle").click();
 await p.waitForFunction(()=>items.find(i=>i.id==="fixture0").homeHidden===true);
 assert.equal(await p.locator('#view-home [data-open="fixture0"]').count(),0);
 assert(await w.evaluate(async()=>(await chrome.storage.local.get("dasi.items"))["dasi.items"].some(i=>i.id==="fixture0")));
 await p.locator("#dr-home-toggle").click();
 await p.waitForFunction(()=>items.find(i=>i.id==="fixture0").homeHidden===false);
 assert(await p.locator('#view-home [data-open="fixture0"]').count()>0);
 await p.evaluate(()=>{items.push({id:"game-trailer",title:"Game",type:"game",trailer:"https://media.example/unsupported.m3u8",trailerUrl:"https://www.youtube.com/watch?v=abcdefghijk"});openDrawer("game-trailer");});
 assert.equal(await p.locator("#drawer [data-trailer-src]").count(),0);
 assert.equal(await p.locator("#drawer iframe").count(),1);
 assert.equal(await p.locator('#drawer a[href*="youtube.com"]').count(),0);


 await p.evaluate(()=>{closeDrawer();settings.homeCats=[];renderHome();});
 assert.equal(await p.locator("#view-home .disco-wrap").count(),0,"An empty selection must stay empty");
 await p.locator('[data-home-category="manga"]').click();
 await p.waitForFunction(()=>settings.homeCats.length===1&&settings.homeCats[0]==="manga");
 assert.deepEqual(await p.evaluate(()=>discoPools().map(pool=>pool.key)),["manga"]);
 assert(await p.evaluate(()=>discoItems.every(item=>item.title.startsWith("Manga "))));
 assert(await p.locator("#view-home .carousel-arrow").count()>0);
 await p.evaluate(()=>openCatalogPreview({title:"Store fixture",type:"game",news:[{id:"recent",title:"Recent patch fixture",publishedAt:Date.now()-1000,url:"https://steamcommunity.com/games/123/announcements/detail/1"},{id:"old",title:"Expired news fixture",publishedAt:Date.now()-40*86400000},{id:"future",title:"Future news fixture",publishedAt:Date.now()+86400000}],externalIds:{rawg:"123"},gameEnrichedAt:1,storeLinks:["https://store.steampowered.com/app/123/Example/?utm_source=test","https://www.gog.com/game/example","https://store.epicgames.com/en-US/p/example","https://www.gog.com/game/example","javascript:alert(1)","https://www.gog.com.evil.test/game/x"],url:"https://store.steampowered.com/app/123/",price:"$12.99",platform:"Nintendo Switch · PlayStation 5",releaseDate:"2028-04-12",genres:["Adventure"],alternativeTitles:["Other title"]}));
 await p.locator('#preview-info a[href="https://store.steampowered.com/app/123/"]').waitFor();
 assert.equal(await p.locator('#preview-info a[href="https://store.steampowered.com/app/123/"]').count(),1);
 assert.equal(await p.locator("#preview-info details").count(),0);
 assert.equal(await p.locator("#preview-info .detail-price").textContent(),"$12.99");
 assert(await p.locator("#preview-info .game-detail-facts").textContent().then(s=>s.includes("Nintendo Switch")&&s.includes("PlayStation 5")&&s.includes("2028-04-12")));
 assert.equal(await p.evaluate(()=>safeStoreLink("https://www.gog.com:444/game/example")),"");
 assert.equal(await p.evaluate(()=>safeStoreLink("https://store.epicgames.com/en-US/p/example")),"https://store.epicgames.com/en-US/p/example");
 assert.equal(await p.evaluate(()=>safeStoreLink("https://www.gog.com/game/example")),"https://www.gog.com/game/example");
 assert.equal(await p.evaluate(()=>safeStoreLink("javascript:alert(1)")),"");
 assert.equal(await p.evaluate(()=>safeStoreLink("https://store.steampowered.com.evil.example/app/1")),"");
 assert(await p.evaluate(()=>!discoCard({title:"Game",type:"game",price:"$12.99"},0).includes("$12.99")));
 assert.equal(await p.locator("#preview-info .game-store-links a").count(),3);
 assert.equal(await p.locator('#preview-info .game-store-links a[href="https://www.gog.com/game/example"]').textContent().then(s=>s.trim()),"GOG");
 await p.screenshot({path:"test-results/visual-refinement.png"});
 await p.locator("#preview-list").selectOption("destination");await p.locator("#preview-add").click();
 await p.waitForFunction(()=>items.some(i=>i.title==="Store fixture")&&document.querySelector("#drawer").dataset.itemId);
 await p.locator('#drawer .game-store-links a[href="https://www.gog.com/game/example"]').waitFor();
 assert.equal(await p.locator("#drawer .game-store-links a").count(),3,"Every verified store remains after saving");
 assert.equal(await p.locator('#drawer .game-store-links a[href="https://store.epicgames.com/en-US/p/example"]').count(),1);
 assert.equal(await p.locator("#drawer .game-news-card").count(),1,"Only recent news stays visible after saving");
 assert((await p.locator("#drawer .game-news-card").innerText()).includes("Recent patch fixture"));
 assert.equal(await p.locator("#drawer .game-rewards").count(),1,"Reward availability remains visible in saved details");
 const storedGame=await w.evaluate(async()=>(await chrome.storage.local.get("dasi.items"))["dasi.items"].find(i=>i.title==="Store fixture"));
 assert.equal(storedGame.news[0].title,"Recent patch fixture","News survives library persistence");
 assert.equal(storedGame.externalIds.rawg,"123");assert.deepEqual([...storedGame.storeLinks].sort(),["https://store.steampowered.com/app/123/","https://www.gog.com/game/example","https://store.epicgames.com/en-US/p/example"].sort());
 assert(await p.evaluate(()=>!gameStoreButtons({url:"javascript:alert(1)",storeLinks:["https://www.gog.com.evil.test/game/x"]}).includes("href")));


 await p.evaluate(()=>{closeDrawer();switchView("library");showArchivedLists=false;renderLists();});
 const beforeCount=await w.evaluate(async()=>(await chrome.storage.local.get("dasi.items"))["dasi.items"].length);
 await p.locator('[data-delete-list="destination"]').click();
 assert(await p.locator("#list-delete-confirm").isVisible());
 await p.locator("#list-delete-cancel").click();
 assert(await p.locator('[data-delete-list="destination"]').isVisible());
 await p.locator('[data-delete-list="destination"]').click();
 await p.locator("#list-delete-yes").click();
 await p.waitForFunction(()=>!lists.some(l=>l.id==="destination"));
 assert.equal(await w.evaluate(async()=>(await chrome.storage.local.get("dasi.items"))["dasi.items"].length),beforeCount);

 await p.evaluate(()=>{
   closeDrawer();switchView("library");
   lastResults=[
    {title:"Future drama",type:"watching",format:"KDRAMA",year:2028,genres:["Comedy"],releaseStatus:"NOT_YET_RELEASED"},
    {title:"Finished show",type:"watching",format:"SERIES",country:"US",year:2020,releaseStatus:"Ended"},
    {title:"Free game",type:"game",price:"Free"},
    {title:"Paid game",type:"game",price:"$19.99"},
    {title:"Unknown price",type:"game"}
   ];searchFacets={kind:"all",genre:"all",year:"",release:"all",price:200};renderSearchResults("fixture");
 });
 await p.locator("#sf-kind").selectOption("KDRAMA");
 await p.locator("#sf-year").fill("2028");await p.locator("#sf-year").press("Tab");
 await p.locator("#sf-release").selectOption("upcoming");
 assert.equal(await p.locator("#search-results .sr-row").count(),1);
 await p.locator("#sf-reset").click();await p.locator("#sf-kind").selectOption("GAME");
 await p.locator("#sf-price").evaluate(el=>{el.value="0";el.dispatchEvent(new Event("change",{bubbles:true}));});
 assert.equal(await p.locator("#search-results .sr-row").count(),1);
 assert(await p.locator("#search-results .sr-row").textContent().then(s=>s.includes("Free game")));
 assert.equal(await p.evaluate(()=>publicationState({status:"completed"})),"unknown");
 await p.evaluate(()=>{clearSearchResults();openDrawer("fixture0");});
 await p.locator("#dr-notify").uncheck();
 await p.waitForFunction(()=>items.find(i=>i.id==="fixture0").notifyUpdates===false);

 await p.evaluate(()=>{
   closeDrawer();query="";settings.homeCats=null;homeShowAll=false;items=[];
   const art="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#38586c"/><circle cx="150" cy="170" r="80" fill="#ded3b4"/><path d="M0 450L150 260L300 450" fill="#172631"/></svg>');
   const works=(prefix,type)=>Array.from({length:8},(_,n)=>({title:prefix+" "+n,type,cover:art,year:2028,synopsis:"Un voyage, des rencontres et un nouveau départ.",genres:["Adventure"]}));
   discover={manga:works("Manga","reading"),manhwa:works("Manhwa","reading"),anime:works("Anime","watching"),gamesHot:works("Game","game")};
   switchView("home");spotPaused=true;renderHome();
 });
 assert.equal(await p.locator("#view-home .disco-wrap").count(),3,"Default home offers reading, watching and games");
 assert.deepEqual(await p.evaluate(()=>homeFeaturedPools(discoPools()).map(pool=>pool.key)),["manhwa","anime","games"]);
 assert.equal(await p.locator(".home-feature-backdrop").getAttribute("aria-hidden"),"true");
 assert.equal(await p.locator(".home-feature-art img").evaluate(el=>getComputedStyle(el).objectFit),"contain");
 await p.setViewportSize({width:1440,height:1000});
 await p.screenshot({path:"test-results/home-desktop.png",fullPage:true});
 const before=await p.locator(".home-feature h2").textContent();
 await p.locator('[data-feature-step="1"]').click();
 assert.notEqual(await p.locator(".home-feature h2").textContent(),before);
 await p.locator(".home-feature-copy [data-feature-details]").click();
 await p.locator("#preview-add").waitFor();
 assert(await p.locator("#preview-add").isDisabled(),"Featured discoveries require an explicit list");
 await p.evaluate(()=>closeDrawer());
 await p.setViewportSize({width:390,height:844});
 await p.screenshot({path:"test-results/home-mobile.png",fullPage:true});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Home must fit a narrow screen");
 assert(await p.locator(".home-feature-art").isVisible());
 await p.emulateMedia({reducedMotion:"reduce"});
 await p.evaluate(()=>{spotPaused=false;renderHome();});
 assert(await p.locator(".home-feature-copy [data-feature-details]").isVisible());

 const activity=await p.evaluate(()=>{
   const now=Date.now();
   const base={type:"reading",chapter:2,total:10,state:"current"};
   const source=[
     {...base,id:"old",lastReleaseAt:now-30*86400000},
     {...base,id:"future",lastReleaseAt:now+86400000},
     {...base,id:"new",lastReleaseAt:now-1000},
     {...base,id:"caught",chapter:10,lastReleaseAt:now-1000},
     {...base,id:"completed",state:"completed",lastReleaseAt:now-1000},
     {...base,id:"hidden",homeHidden:true,lastReleaseAt:now-1000},
     {...base,id:"paused",state:"on_hold",lastReleaseAt:now-1000},
     {id:"video",type:"watching",episode:0,position:45,state:"current"},
     {id:"next-season",type:"watching",season:"1",episode:12,state:"current",recentEpisodes:[{season:"2",episode:"1",at:now-1000}]}
   ];
   const result=homeActivity(source,now);
   return {catchUp:result.catchUp.map(i=>i.id),continuing:result.continuing.map(i=>i.id),future:isNew(source[1],now),malformed:isNew({type:"watching",recentEpisodes:[null,{season:2,episode:1,at:now+1}]},now)};
 });
 assert.deepEqual([...activity.catchUp].sort(),["new","next-season"]);
 assert(activity.continuing.includes("old"),"Old backlog stays in continue, not recent releases");
 assert(activity.continuing.includes("video"),"An unfinished first episode can be resumed");
 assert(!activity.continuing.includes("completed"));
 assert(!activity.continuing.includes("hidden"));
 assert.equal(activity.future,false);
 assert.equal(activity.malformed,false);
 await p.evaluate(()=>{closeDrawer();items=[];discover=null;discoverTried=true;switchView("home");});
 assert(await p.locator(".home-welcome").isVisible());
 assert(await p.locator("#view-home [data-discover-refresh]").isVisible());
 assert.equal(await p.locator(".home-feature").count(),0,"No fabricated feature when catalogs are unavailable");
 await p.locator("#home-library").click();
 assert.equal(await p.evaluate(()=>view),"library");

 const taste=await p.evaluate(()=>{
   const original=items;
   items=[
     {type:"reading",favorite:true,genres:[" Mystery ","Mystery"],tags:["mystery"],synopsis:"An investigation inside a mountain monastery.",activityAt:Date.now()},
     {type:"reading",favorite:true,homeHidden:true,tags:["Hidden"]},
     {type:"reading",favorite:true,state:"dropped",tags:["Dropped"]},
     {type:"reading",rating:1,tags:["Disliked"]}
   ];
   const weights=tasteWeights();
   const relevant=scoreTaste({tags:["Mystery"],synopsis:"An investigation at the monastery."},weights);
   const unrelated=scoreTaste({genres:["Sports"],synopsis:"A championship tournament."},weights);
   const duplicate=scoreTaste({genres:["Mystery"],tags:["mystery"," Mystery "]},weights);
   const single=scoreTaste({genres:["Mystery"]},weights);
   items=original;
   return {keys:Object.keys(weights),relevant,unrelated,duplicate,single};
 });
 assert(taste.keys.includes("genre:mystery"));
 assert(!taste.keys.some(key=>["genre:hidden","genre:dropped","genre:disliked"].includes(key)));
 assert(taste.relevant>taste.unrelated,"Synopsis and provider tags should improve matching");
 assert.equal(taste.duplicate,taste.single,"Repeated tags must not inflate recommendations");
 await p.evaluate(()=>{
   settings.homeCats=null;discover={manga:[{title:"One",type:"reading",cover:"cover"},{title:"Two",type:"reading",cover:"cover"}],anime:[{title:"Anime",type:"watching",cover:"cover"}]};
   switchView("home");spotPaused=true;renderHome();
 });
 await p.locator('[data-feature-step="1"]').focus();
 await p.keyboard.press("Enter");
 assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute("data-feature-step")),"1","Carousel keeps keyboard focus");
 assert.equal(await p.locator("#feature-pause").count(),0,"Manual carousel does not need a pause control");

 const recognition=await p.evaluate(()=>{
   const saved=discoverySavedMatcher([
     {title:"Titre français",type:"reading",format:"MANGA",externalIds:{anilist:"123",mal:"456"},alternativeTitles:["English title"]},
     {title:"Shared name",type:"reading",format:"MANGA"},
     {title:"Novel",type:"reading",format:"NOVEL",year:2020}
   ]);
   return [
     saved({title:"Autre traduction",type:"reading",externalIds:{mal:"456"}}),
     saved({title:"English title",type:"reading",format:"MANGA"}),
     saved({title:"Shared name",type:"watching",format:"ANIME"}),
     saved({title:"English title",type:"reading",externalIds:{anilist:"999"}}),
     saved({title:"Novel",type:"reading",format:"MANGA",year:2020}),
     saved({title:"Novel",type:"reading",format:"NOVEL",year:2028})
   ];
 });
 assert.deepEqual(recognition,[true,true,false,false,false,false],"Discover recognizes aliases without hiding adaptations or conflicting identities");
 const recommendations=await p.evaluate(()=>{
   const pools=[{list:[{title:"Book",type:"reading",genres:["Mystery"]},{title:"Anime",type:"watching",genres:["Mystery"]},{title:"Game",type:"game",tags:["Puzzle"]}]}];
   return homeRecommendations(pools,{"genre:mystery":1,"genre:puzzle":3});
 });
 assert.equal(recommendations.type,"game");
 assert.deepEqual(recommendations.items.map(item=>item.title),["Game"]);
 assert(await p.evaluate(()=>homeRecommendations([{list:[{title:"Unrelated",type:"reading",genres:["Sport"]}]}],{"genre:mystery":1}).items.length===0));

 const refresh=await p.evaluate(()=>{
   const original=api.runtime.sendMessage;
   let pending,calls=0;
   const result={};
   try{
     api.runtime.sendMessage=(message,callback)=>{
       if(message.type==="DISCOVER"){calls++;pending=callback;return;}
       return original.call(api.runtime,message,callback);
     };
     discoverLoading=false;discoverTried=true;
     discover={ts:Date.now(),manga:[{title:"Refresh fixture",type:"reading",cover:"cover"}]};
     switchView("home");
     document.querySelector("#view-home [data-discover-refresh]").click();
     loadDiscover(true);
     result.calls=calls;
     result.busy=document.querySelector("#view-home [data-discover-refresh]").disabled;
     renderHome();
     result.busyAfterRender=document.querySelector("#view-home [data-discover-refresh]").getAttribute("aria-busy");
     pending({ok:false});
     result.recovered=!discoverLoading&&!document.querySelector("#view-home [data-discover-refresh]").disabled;
     result.retained=discover.stale&&discover.manga[0].title==="Refresh fixture";
     document.querySelector("#view-home [data-discover-refresh]").click();
     pending({ok:true,data:{ts:Date.now(),manga:[{title:"Fresh fixture",type:"reading",cover:"cover"}]}});
     result.fresh=discover.manga[0].title;
     result.ready=!discoverLoading&&!document.querySelector("#view-home [data-discover-refresh]").disabled;
   }finally{api.runtime.sendMessage=original;}
   return result;
 });
 assert.deepEqual(refresh,{calls:1,busy:true,busyAfterRender:"true",recovered:true,retained:true,fresh:"Fresh fixture",ready:true},"Refresh coalesces clicks, survives redraw, and recovers after failure");

 const gameDiscovery=await p.evaluate(()=>{
   discoverLoading=false;discoverTried=true;discover=null;
   const offline=renderGamesDiscover();
   discoverLoading=true;const loading=renderGamesDiscover();discoverLoading=false;
   items=[{id:"saved-game",title:"Titre traduit",type:"game",externalIds:{steam:"123"},alternativeTitles:["English game"]},{id:"book",title:"Shared title",type:"reading"}];
   discover={stale:true,gamesSoon:[{title:"English game",type:"game",externalIds:{steam:"123"}},{title:"Shared title",type:"game"},{title:"No artwork yet",type:"game"}]};
   const available=renderGamesDiscover();
   return {retry:offline.includes('data-discover-refresh'),offline:offline.includes('role="status"'),busy:loading.includes('aria-busy="true"'),titles:discoItems.map(i=>i.title),warning:available.includes('role="status"')};
 });
 assert.deepEqual(gameDiscovery,{retry:true,offline:true,busy:true,titles:["Shared title","No artwork yet"],warning:true},"Game discovery stays usable offline and matches identities across languages without hiding other formats");

 await p.evaluate(()=>{
   items=[];settings.lang="fr";settings.homeCats=["manga"];discoverTried=true;discoverLoading=false;
   discover={manga:[{title:"Manga filtre",type:"reading",cover:"cover"}],anime:[{title:"Anime filtre",type:"watching",cover:"cover"}]};
   switchView("home");
 });
 await p.locator('#view-home [data-home-category="manga"]').focus();
 await p.keyboard.press("Enter");
 await p.waitForFunction(()=>!homeCategorySaving&&settings.homeCats.length===0);
 assert.equal(await p.locator("#view-home .disco-wrap").count(),0,"Deselecting all removes every discovery row");
 assert.equal(await p.evaluate(()=>document.activeElement?.dataset.homeCategory),"manga","Saving a category keeps keyboard focus");
 assert(await p.locator("#view-home").textContent().then(text=>text.includes("Choisissez au moins une catégorie")));
 assert.deepEqual(await w.evaluate(async()=>(await chrome.storage.local.get("dasi.settings"))["dasi.settings"].homeCats),[],"Empty preference persists");
 await p.locator('#view-home [data-home-category="anime"]').click();
 await p.waitForFunction(()=>!homeCategorySaving&&settings.homeCats.includes("anime"));
 assert.deepEqual(await p.evaluate(()=>discoPools().map(pool=>pool.key)),["anime"]);
 const preferenceFailure=await p.evaluate(()=>{
   const original=api.runtime.sendMessage;let pending,calls=0;
   try{
     api.runtime.sendMessage=(message,cb)=>{
       if(message.type==="SET_SETTINGS"){calls++;pending=cb;return;}
       return original.call(api.runtime,message,cb);
     };
     document.querySelector('[data-home-category="anime"]').click();
     document.querySelector('[data-home-category="manga"]').click();
     const busy=document.querySelector(".home-category-chips").getAttribute("aria-busy");
     pending({ok:false});
     return {calls,busy,categories:settings.homeCats,ready:!homeCategorySaving,enabled:!document.querySelector('[data-home-category="anime"]').disabled};
   }finally{api.runtime.sendMessage=original;}
 });
 assert.deepEqual(preferenceFailure,{calls:1,busy:"true",categories:["anime"],ready:true,enabled:true},"Failed preference save preserves the selection and allows retry");
 await p.evaluate(()=>{discover=null;renderHome();});
 assert.equal(await p.locator("#view-home [data-home-category]").count(),9,"Preferences remain accessible during a catalog outage");

 const landscapeArt="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240"><rect width="600" height="240" fill="#304657"/></svg>');
 await p.evaluate(cover=>{
   closeDrawer();items=[{id:"landscape-test",title:"Landscape artwork",type:"watching",episode:1,total:10,state:"current",cover}];discover=null;discoverTried=true;
   switchView("home");
 },landscapeArt);
 const activityImage=p.locator("#view-home .poster .art img.cov");
 await activityImage.evaluate(image=>image.decode());
 const dimensions=await activityImage.evaluate(image=>{
   const box=image.getBoundingClientRect(),frame=image.parentElement.getBoundingClientRect();
   return {ratio:box.width/box.height,extraHeight:frame.height-box.height,background:getComputedStyle(image).backgroundImage,fit:getComputedStyle(image).objectFit};
 });
 assert.equal(dimensions.fit,"contain","Continue artwork is fully visible without stretching");
 assert(Math.abs(dimensions.ratio-2/3)<0.02,"Continue cards share a fixed portrait frame");
 assert(Math.abs(dimensions.extraHeight)<1,"Continue artwork has no letterbox");
 assert.equal(dimensions.background,"none");
 await p.evaluate(cover=>openCatalogPreviewResolved({title:"Landscape detail",type:"game",cover,manual:true}),landscapeArt);
 const detailImage=p.locator("#drawer .drawer-cover img.cov");
 await detailImage.evaluate(image=>image.decode());
 const detail=await detailImage.evaluate(image=>{
   const box=image.getBoundingClientRect(),frame=image.parentElement.getBoundingClientRect();
   return {ratio:box.width/box.height,extraHeight:frame.height-box.height,extraWidth:frame.width-box.width};
 });
 assert(Math.abs(detail.ratio-2.5)<0.02,"Detail artwork keeps its full aspect ratio");
 assert(Math.abs(detail.extraHeight)<1&&Math.abs(detail.extraWidth)<1,"Detail artwork has no artificial frame");
 await p.screenshot({path:"test-results/artwork-landscape-detail.png"});
 await p.evaluate(()=>closeDrawer());

 await p.evaluate(()=>{
   items=[];settings.homeCats=["games"];
   const art=(width,height)=>"data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><rect width="100%" height="100%" fill="#345"/></svg>');
   discover={gamesHot:[{title:"Portrait game",type:"game",cover:art(300,450)},{title:"Landscape game",type:"game",cover:art(600,240)}]};
   switchView("home");
 });
 await p.locator("#view-home .disco-game img").evaluateAll(images=>Promise.all(images.map(image=>image.decode())));

 const gameArt=await p.locator("#view-home .disco-game img").evaluateAll(images=>images.map(image=>{const r=image.getBoundingClientRect();return {width:r.width,height:r.height,ratio:image.naturalWidth/image.naturalHeight,fit:getComputedStyle(image).objectFit,top:r.top};}));
 assert(Math.abs(gameArt[0].height-gameArt[1].height)<1,"Mixed game formats share a consistent artwork height");
 assert(Math.abs(gameArt[0].width-gameArt[1].width)<1,"Mixed game sources share a consistent card width");
 assert(Math.abs(gameArt[0].top-gameArt[1].top)<1,"Mixed game sources align at the top");
 for(const art of gameArt)assert.equal(art.fit,"contain","Game artwork remains whole without stretching");
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Uniform cards stay inside their carousel");

 // The search UI keeps existing matches and filters while requesting the next page.
 await w.evaluate(()=>{
   globalThis.searchPageCalls=0;
   catalogSearchAll=async(q,publish,report)=>{
     if(q==="replacement")return [{title:"Replacement result",type:"reading",format:"MANGA",genres:["Fantasy"],externalIds:{mal:"801"}}];
     report("steam",1,true);
     return [{title:"Pagination first",type:"game",format:"Game",genres:["Action"],externalIds:{steam:"701"}}];
   };
   steamSearch=(q,page,report)=>{globalThis.searchPageCalls++;return new Promise(resolve=>{
     globalThis.finishSearchPage=()=>{report("steam",page,false);resolve([
       {title:"Pagination first",type:"game",format:"Game",genres:["Action"],externalIds:{steam:"701"}},
       {title:"Pagination second",type:"game",format:"Game",genres:["Action"],externalIds:{steam:"702"}}
     ]);};
   });};
 });
 await p.evaluate(()=>{closeDrawer();searchFacets={kind:"all",genre:"all",year:"",release:"all",price:200};switchView("library");});
 await p.locator("#q").fill("pagination");
 await p.waitForFunction(()=>lastResults.length===1&&!searchPageState.pending);
 await p.locator("#sf-kind").selectOption("GAME");
 await p.locator("#sf-genre").selectOption("Action");
 await p.locator("#search-more").click();
 assert.equal(await p.locator("#search-results .sr-row").count(),1,"First-page results remain visible");
 assert(await p.locator("#search-more").isDisabled(),"Pagination cannot be submitted twice while loading");
 await p.waitForFunction(()=>searchPageState.pending);
 await w.evaluate(()=>globalThis.finishSearchPage());
 await p.waitForFunction(()=>lastResults.length===2&&!searchPageState.pending);
 assert.equal(await p.locator("#sf-kind").inputValue(),"GAME");
 assert.equal(await p.locator("#sf-genre").inputValue(),"Action");
 assert.equal(await p.locator("#search-results .sr-row").count(),2,"Duplicate identities across pages appear once");
 assert.equal(await p.locator("#search-more").count(),0,"Exhausted results have no misleading next button");
 assert.equal(await w.evaluate(()=>globalThis.searchPageCalls),1);
 // Saved badges also cover matches beyond the worker's 200-item message limit.
 const badgeBatches=await p.evaluate(()=>{
   const original=api.runtime.sendMessage,counts=[];
   api.runtime.sendMessage=(message,callback)=>{
     if(message.type==="CHECK_EXISTING_BATCH"){counts.push(message.items.length);callback({ok:true,matches:message.items.map(item=>item.title==="Saved late match"?"saved-id":null)});return;}
     return original(message,callback);
   };
   try{
     lastResults=Array.from({length:205},(_,i)=>({title:i===204?"Saved late match":"Badge fixture "+i,type:"game",format:"Game",genres:["Action"]}));
     renderSearchResults("pagination");return counts;
   }finally{api.runtime.sendMessage=original;}
 });
 assert.deepEqual(badgeBatches,[200,5]);
 assert.equal(await p.locator('[data-saved-label="204"]').textContent(),"Dans la bibliothèque");
 // A late page from an old query must never overwrite a new search.
 await p.locator("#q").fill("pagination other");
 await p.waitForFunction(()=>query==="pagination other"&&!searchPageState.pending&&lastResults.length===1);
 await p.locator("#search-more").click();
 await p.locator("#q").fill("replacement");
 await p.waitForFunction(()=>query==="replacement"&&!searchPageState.pending&&lastResults[0]?.title==="Replacement result");
 await w.evaluate(()=>globalThis.finishSearchPage());
 await p.waitForTimeout(600);
 assert.deepEqual(await p.evaluate(()=>lastResults.map(item=>item.title)),["Replacement result"]);
 await p.locator("#sf-reset").click();
 assert.equal(await p.locator("#search-results .sr-row").count(),1);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Paginated search fits the viewport");


 // Ranking understands separate words and accent variants, while preserving original result identities.
 const ranking=await p.evaluate(()=>{
   const results=[
     {title:"Heart",popularity:999999},
     {title:"Art of War",popularity:10},
     {title:"War and Art",popularity:20},
     {title:"Art",popularity:1},
     {title:"Different title",alternativeTitles:["Árt"],popularity:5},
     {title:"Unrelated",tags:["Art"],popularity:100}
   ];
   return {
     single:rankCatalogResults(results,"art").map(row=>row.item.title),
     multiple:rankCatalogResults(results,"war art").map(row=>row.item.title),
     identity:rankCatalogResults(results,"art").map(row=>results[row.index]===row.item),
     malformed:rankCatalogResults([{title:"Art",alternativeTitles:"bad",popularity:"Infinity"}],"art")[0].popularity
   };
 });
 assert.deepEqual(ranking.single,["Art","Different title","Art of War","War and Art","Unrelated","Heart"]);
 assert.deepEqual(ranking.multiple.slice(0,2),["War and Art","Art of War"]);
 assert(ranking.identity.every(Boolean));
 assert.equal(ranking.malformed,0);
 await p.evaluate(()=>{
   searchFacets={kind:"all",genre:"all",year:"",release:"all",price:200};
   lastResults=[{title:"Art future",type:"game",year:2028}];renderSearchResults("art");
 });
 await p.locator("#sf-year").fill("2028");
 // Incoming results can render before the field loses focus.
 await p.evaluate(()=>renderSearchResults("art"));
 assert.equal(await p.locator("#sf-year").inputValue(),"2028");
 assert.equal(await p.locator("#search-results .sr-row").count(),1);

 // Locale display never overwrites provider content and reuses completed translations.
 await p.waitForFunction(()=>!catalogLocaleBusy);
 await p.evaluate(()=>{
   closeDrawer();items=[];settings.homeCats=["manga","anime"];applyLanguage("ja");
   discover={manga:[{title:"Original title",type:"reading",cover:"cover",synopsis:"Original synopsis",genres:["Adventure"]}],anime:[{title:"Second title",type:"watching",cover:"cover"}]};switchView("home");
 });
 assert.equal(await p.locator(".home-heading h1").innerText(),"今日のおすすめ");
 await p.emulateMedia({reducedMotion:"no-preference"});
 await p.bringToFront();
 await p.mouse.move(0,0);
 const initialSpot=await p.evaluate(()=>spotIdx);
 await p.evaluate(()=>{document.activeElement?.blur();advanceSpot();});
 const afterSpot=await p.evaluate(()=>spotIdx);
 // Some feeds contain only one featured category, which intentionally has no rotation.
 assert.equal(await p.evaluate(()=>spotItems.length),2);assert.notEqual(afterSpot,initialSpot);
 await p.locator("#spot-wrap").hover();
 const hoveredSpot=await p.evaluate(()=>spotIdx);
 await p.evaluate(()=>advanceSpot());
 assert.equal(await p.evaluate(()=>spotIdx),hoveredSpot,"Hover pauses the featured rotation");
 await p.mouse.move(0,0);
 await p.emulateMedia({reducedMotion:"reduce"});
 await p.evaluate(()=>advanceSpot());
 assert.equal(await p.evaluate(()=>spotIdx),hoveredSpot,"Reduced motion disables automatic rotation");
 await p.evaluate(()=>{query="";document.getElementById("q").value="";clearSearchResults();switchView("library");});
 assert(await p.locator("#sites-help").innerText().then(text=>text.includes("お気に入り")));
 assert.equal(await p.locator("#collection-title").innerText(),"保存した作品");
 assert.equal(await p.locator("#sites-block").isVisible(),true);
 assert.equal(await p.locator("#dash-edit-banner").innerText(),"バナーを変更");
 assert.equal(await p.locator("#dash-bio").getAttribute("data-ph"),"自己紹介を書く…");
 assert.equal(await p.locator("#library-sort option[value=title]").innerText(),"タイトル");
 assert.equal(await p.locator("#library-unlisted").locator("..").innerText(),"リストに未登録");
 assert.equal(await p.locator("#skip-content").innerText(),"本文へ移動");
 const libraryLocales=await p.evaluate(()=>{
   const before=settings.lang,results=[];
   for(const code of ["en","fr","es","de","ja","ko","pt","zh-CN"]){
     settings.lang=code;renderNav();renderLibHeader();renderGrid();
     results.push({code,banner:document.getElementById("dash-edit-banner").textContent.trim(),sort:document.querySelector("#library-sort option[value=title]").textContent,missing:LIBRARY_LOCALE_KEYS.filter(key=>!LANGS[code][key])});
   }
   settings.lang=before;renderNav();renderLibHeader();renderGrid();return results;
 });
 assert(libraryLocales.every(row=>row.missing.length===0),"Library labels exist in every offered language");
 assert(libraryLocales.filter(row=>row.code!=="en").every(row=>row.banner!=="Change banner"),"Profile labels do not fall back to English");

 const aliases=await p.evaluate(()=>distinctAlternativeTitles({title:"Example",alternativeTitles:["Example","example","Different","Different","別名"]}));
 assert.deepEqual(aliases,["Different","別名"]);
 assert.deepEqual(await p.evaluate(()=>distinctAlternativeTitles({title:"Пример",alternativeTitles:["Пример","Другое","Ещё","Другое","عنوان"]})),["Другое","Ещё","عنوان"]);
 console.log("LIBRARY_JA_VISUAL "+(await p.screenshot({path:"test-results/library-japanese.png",type:"png",fullPage:true,animations:"disabled"})).toString("base64"));
 const localeProbe=await p.evaluate(async()=>{
   settings.lang="en";
   document.querySelectorAll(".view").forEach(node=>node.hidden=true);
   while(catalogLocaleBusy)await new Promise(resolve=>setTimeout(resolve,50));
   clearTimeout(catalogLocaleTimer);
   const original=api.runtime.sendMessage,probe=document.createElement("p");probe.className="home-feature-synopsis";probe.textContent="Probe synopsis";document.body.prepend(probe);
   let calls=0;
   api.runtime.sendMessage=(message,callback)=>{if(message.type==="DASI_MT"){calls++;callback({ok:true,translations:message.texts.map(text=>"翻訳 "+text)});return;}return original(message,callback);};
   try{
     settings.lang="ja";await localizeVisibleCatalog();
     const translated=probe.textContent,source=probe.dataset.catalogSource;
     await localizeVisibleCatalog();
     return {translated,source,calls};
   }finally{api.runtime.sendMessage=original;probe.remove();settings.lang="en";document.querySelectorAll(".view").forEach(node=>node.hidden=false);clearTimeout(catalogLocaleTimer);}
 });
 assert.equal(localeProbe.translated,"翻訳 Probe synopsis");
 assert.equal(localeProbe.source,"Probe synopsis");
 assert.equal(localeProbe.calls,1,"Repeat display reuses the locale cache");


 // Detail labels are localized without changing publication scope or provider identities.
 const detailLabels=await p.evaluate(()=>{
   const before=settings.lang,result=[];
   for(const code of ["en","fr","ja","es","de","ko","pt","zh-CN"]){
     settings.lang=code;
     result.push({code,missing:Object.keys(DETAIL_LOCALES).filter(key=>!LANGS[code][key]),
       part:publicationInformation({releaseStatus:"finished",releaseScope:"installment"}),
       series:publicationInformation({releaseStatus:"finished",releaseScope:"series"})});
   }
   settings.lang=before;return result;
 });
 assert(detailLabels.every(row=>row.missing.length===0));
 assert(detailLabels.every(row=>row.part!==row.series),"Finished seasons must remain distinct from finished series");
 await w.evaluate(()=>{
   catalogEpisodeGuide=async(item,seasonId)=>{
     const seasons=[{id:"ja-1",number:1,name:"Original season",episodeCount:42},{id:"ja-2",number:2,name:"Return",episodeCount:1}];
     return {supported:true,seasons,season:seasons.find(s=>s.id===seasonId)||seasons[0],episodes:seasonId==="ja-2"?[{number:1,name:"Original episode",runtime:20}]:Array.from({length:42},(_,n)=>({number:n+1,name:"Original episode "+(n+1),runtime:20}))};
   };
 });
 await p.evaluate(()=>{
   applyLanguage("ja");
   openCatalogPreviewResolved({manual:true,title:"Original work",type:"watching",externalIds:{tvmaze:"123"},releaseStatus:"finished",releaseScope:"installment",alternativeTitles:["Original alias"]});
 });
 await p.locator("#guide-season").waitFor();
 assert((await p.locator("#preview-info").innerText()).includes("シーズン・部が完結"));
 assert((await p.locator("#preview-info").innerText()).includes("シリーズ全体の完結を示すものではありません"));
 assert((await p.locator("#preview-info").innerText()).includes("別タイトル"));
 assert.equal(await p.locator("label[for=preview-list]").innerText(),"リストを選ぶ");
 assert.equal(await p.locator("#guide-season option").first().innerText(),"シーズン 1 — Original season");
 await p.locator(".guide-more").waitFor();
 assert.equal(await p.locator(".guide-list li").count(),40);
 assert.equal(await p.locator(".guide-more").innerText(),"エピソードをもっと見る");
 await p.locator(".guide-more").click();
 assert.equal(await p.locator(".guide-list li").count(),42);
 await p.locator("#guide-season").selectOption("ja-2");
 await p.waitForFunction(()=>document.querySelectorAll(".guide-list li").length===1);
 assert.equal(await p.locator(".guide-number").innerText(),"第 1 話");
 assert.equal(await p.locator(".guide-episode b").innerText(),"Original episode");
 await p.evaluate(()=>applyLanguage("fr"));
 await p.waitForFunction(()=>document.querySelector("#guide-season option")?.textContent==="Saison 1 — Original season");
 assert.equal(await p.locator("label[for=preview-list]").innerText(),"Choisir une liste");
 await p.evaluate(()=>closeDrawer());


 // Changing UI language redraws existing search results without restarting provider work.
 await p.evaluate(()=>{
   closeDrawer();settings.lang="en";switchView("library");
   query="locale query";document.getElementById("q").value=query;
   searchFacets={kind:"GAME",genre:"Action",year:"2028",release:"upcoming",price:50};
   searchPageState={pending:false,partial:true,hasMore:true,cursor:"preserved-cursor",limited:false,error:false};
   lastResults=[{title:"Original game",type:"game",format:"GAME",genres:["Action"],year:2028,releaseStatus:"UPCOMING",price:"$20"}];
   renderSearchResults(query);
 });
 const beforeLocaleSearch=await p.evaluate(()=>JSON.stringify({query,searchFacets,lastResults,searchPageState}));
 const providerCalls=await p.evaluate(()=>{
   const original=api.runtime.sendMessage;let calls=0;
   api.runtime.sendMessage=(message,callback)=>{if(message.type==="CATALOG_SEARCH")calls++;return original.call(api.runtime,message,callback);};
   try{applyLanguage("ja");return calls;}finally{api.runtime.sendMessage=original;}
 });
 assert.equal(providerCalls,0,"Language changes must not restart catalog queries");
 assert.equal(await p.evaluate(()=>JSON.stringify({query,searchFacets,lastResults,searchPageState})),beforeLocaleSearch);
 assert.equal(await p.locator("#sf-kind").inputValue(),"GAME");
 assert.equal(await p.locator("#sf-genre").inputValue(),"Action");
 assert.equal(await p.locator("#sf-year").inputValue(),"2028");
 assert.equal(await p.locator("#sf-release").inputValue(),"upcoming");
 assert.equal(await p.locator("#sf-price").inputValue(),"50");
 assert.equal(await p.locator("#sf-reset").innerText(),"フィルターを解除");
 assert.equal(await p.locator("#search-more").innerText(),"結果をさらに読み込む");
 assert((await p.locator("#search-progress").innerText()).includes("一部のカタログ"));
 assert.equal(await p.locator("#search-results .sr-row").count(),1);
 const translatedSearch=await p.evaluate(()=>Object.keys(SEARCH_LOCALES).every(key=>["en","fr","ja","es","de","ko","pt","zh-CN"].every(code=>Boolean(LANGS[code][key]))));
 assert(translatedSearch);
 await p.evaluate(()=>applyLanguage("fr"));
 assert.equal(await p.locator("#sf-reset").innerText(),"Effacer les filtres");
 assert.equal(await p.locator("#search-more").innerText(),"Charger plus de résultats");
 assert.equal(await p.evaluate(()=>JSON.stringify({query,searchFacets,lastResults,searchPageState})),beforeLocaleSearch);


 // Translate provider snippets and genre labels only; filters keep their raw values.
 await p.waitForFunction(()=>!catalogLocaleBusy);
 await p.setViewportSize({width:1440,height:1200});
 const translatedResults=await p.evaluate(async()=>{
   settings.lang="en";clearTimeout(catalogLocaleTimer);closeDrawer();switchView("library");
   query="translation fixture";document.getElementById("q").value=query;
   searchFacets={kind:"all",genre:"all",year:"",release:"all",price:200};
   searchPageState={pending:false,error:false,hasMore:false};
   lastResults=[{title:"Official title",type:"reading",format:"MANGA",year:2028,genres:["Adventure"],synopsis:"A complete synopsis."}];
   settings.lang="ja";renderSearchResults(query);
   document.getElementById("search-results").scrollIntoView();
   const original=api.runtime.sendMessage;let calls=0;
   api.runtime.sendMessage=(message,callback)=>{
     if(message.type==="DASI_MT"){calls++;callback({ok:true,translations:message.texts.map(text=>"訳 "+text)});return;}
     return original.call(api.runtime,message,callback);
   };
   try{
     for(let pass=0;pass<4;pass++)await localizeVisibleCatalog();
     const option=document.querySelector('#sf-genre option[value="Adventure"]');
     const translated=option.textContent;
     const snippet=document.querySelector(".sr-row small [data-catalog-text]").textContent;
     const title=document.querySelector(".sr-row .si b button").textContent;
     const beforeCache=calls;await localizeVisibleCatalog();const cached=calls===beforeCache;
     document.getElementById("sf-genre").value="Adventure";
     document.getElementById("sf-genre").dispatchEvent(new Event("change"));
     return {translated,snippet,title,cached,genre:searchFacets.genre,count:document.querySelectorAll(".sr-row").length,source:lastResults[0],year:document.querySelector(".sr-row small").textContent.startsWith("2028")};
   }finally{api.runtime.sendMessage=original;settings.lang="en";clearTimeout(catalogLocaleTimer);}
 });
 assert.equal(translatedResults.translated,"訳 Adventure");
 assert.equal(translatedResults.snippet,"訳 A complete synopsis.");
 assert.equal(translatedResults.title,"Official title");
 assert.equal(translatedResults.genre,"Adventure");
 assert.equal(translatedResults.count,1);
 assert(translatedResults.cached&&translatedResults.year);
 assert.equal(translatedResults.source.synopsis,"A complete synopsis.");
 assert.deepEqual(translatedResults.source.genres,["Adventure"]);

 // A late translation cannot modify replacement results or another language.
 const staleTranslation=await p.evaluate(async()=>{
   settings.lang="en";while(catalogLocaleBusy)await new Promise(resolve=>setTimeout(resolve,20));
   clearTimeout(catalogLocaleTimer);
   const original=api.runtime.sendMessage,panel=document.createElement("div");document.body.prepend(panel);
   document.querySelectorAll(".view").forEach(node=>node.hidden=true);
   panel.innerHTML='<span data-catalog-text>Old isolated snippet</span>';
   panel.scrollIntoView();const old=panel.firstElementChild;let pending;
   api.runtime.sendMessage=(message,callback)=>{if(message.type==="DASI_MT"){pending=()=>callback({ok:true,translations:message.texts.map(()=>"Late translation")});return;}return original.call(api.runtime,message,callback);};
   try{
     settings.lang="ja";const task=localizeVisibleCatalog();
     panel.innerHTML='<span data-catalog-text>Replacement snippet</span>';settings.lang="fr";
     if(!pending)throw Error("Expected translation request");
     pending();await task;
     return {replacement:panel.textContent,detached:!old.isConnected,original:old.textContent};
   }finally{api.runtime.sendMessage=original;panel.remove();settings.lang="en";document.querySelectorAll(".view").forEach(node=>node.hidden=false);clearTimeout(catalogLocaleTimer);}
 });
 assert.deepEqual(staleTranslation,{replacement:"Replacement snippet",detached:true,original:"Old isolated snippet"});


 // A silent or broken translation transport cannot hold the display queue forever.
 const transportRecovery=await p.evaluate(async()=>{
   settings.lang="en";while(catalogLocaleBusy)await new Promise(resolve=>setTimeout(resolve,20));
   clearTimeout(catalogLocaleTimer);
   const original=api.runtime.sendMessage;let late;
   try{
     api.runtime.sendMessage=(message,callback)=>{late=callback;};
     const timedOut=await requestCatalogTranslation(["Timeout fixture"],"ja",20);
     late({ok:true,translations:["Too late"]});
     api.runtime.sendMessage=(message,callback)=>callback({ok:true,translations:["Recovered"]});
     const recovered=await requestCatalogTranslation(["Recovery fixture"],"ja",1000);
     api.runtime.sendMessage=()=>{throw Error("Disconnected");};
     const disconnected=await requestCatalogTranslation(["Disconnected"],"ja",1000);
     return {timedOut,recovered,disconnected};
   }finally{api.runtime.sendMessage=original;clearTimeout(catalogLocaleTimer);}
 });
 assert.deepEqual(transportRecovery,{timedOut:null,recovered:{ok:true,translations:["Recovered"]},disconnected:null});
 const failureRecovery=await p.evaluate(async()=>{
   settings.lang="en";while(catalogLocaleBusy)await new Promise(resolve=>setTimeout(resolve,20));
   clearTimeout(catalogLocaleTimer);
   document.querySelectorAll(".view").forEach(node=>node.hidden=true);
   const probe=document.createElement("p");probe.dataset.catalogText="";probe.textContent="Failure recovery fixture";document.body.prepend(probe);probe.scrollIntoView();
   const original=api.runtime.sendMessage;let calls=0,succeed=false;
   api.runtime.sendMessage=(message,callback)=>{if(message.type==="DASI_MT"){calls++;callback(succeed?{ok:true,translations:message.texts.map(()=>"Recovered display")}:{ok:false,error:"unavailable"});return;}return original.call(api.runtime,message,callback);};
   try{
     settings.lang="ja";await localizeVisibleCatalog();
     const failure={text:probe.textContent,state:probe.dataset.translationState,busy:catalogLocaleBusy};
     const first=calls;await localizeVisibleCatalog();const throttled=calls===first;
     catalogLocaleFailures.set("ja\nFailure recovery fixture",Date.now()-1);succeed=true;
     await localizeVisibleCatalog();
     return {failure,throttled,text:probe.textContent,source:probe.dataset.catalogSource,busy:catalogLocaleBusy};
   }finally{api.runtime.sendMessage=original;probe.remove();settings.lang="en";document.querySelectorAll(".view").forEach(node=>node.hidden=false);clearTimeout(catalogLocaleTimer);}
 });
 assert.deepEqual(failureRecovery,{failure:{text:"Failure recovery fixture",state:"original",busy:false},throttled:true,text:"Recovered display",source:"Failure recovery fixture",busy:false});


 // Steam search miniatures use their larger sibling before legacy and original fallbacks.
 const artworkCandidates=await p.evaluate(()=>({
   steam:steamArtworkSources({type:"game",cover:"https://cdn.cloudflare.steamstatic.com/steam/apps/999991/library_600x900.jpg",coverFallback:"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/999991/hash/capsule_231x87.jpg?t=7"}),
   other:steamArtworkSources({type:"game",cover:"https://example.org/cover.jpg",coverFallback:"https://example.org/fallback.jpg"}),
   spoofed:steamArtworkSources({type:"game",cover:"https://steamstatic.com.evil.example/steam/apps/999991/capsule_231x87.jpg"})
 }));
 assert.equal(artworkCandidates.steam[0],"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/999991/hash/capsule_231x87_2x.jpg?t=7");
 assert.equal(artworkCandidates.steam[1],"https://cdn.cloudflare.steamstatic.com/steam/apps/999991/header.jpg");
 assert.equal(artworkCandidates.steam.length,4);
 assert.deepEqual(artworkCandidates.other,["https://example.org/cover.jpg","https://example.org/fallback.jpg"]);
 assert.equal(artworkCandidates.spoofed.length,1);
 const imageRequests=[];
 const artRoute=async route=>{
   const url=route.request().url();imageRequests.push(url);
   if(url.includes("/999992/")&&!url.includes("/capsule_231x87.jpg"))return route.fulfill({status:404,body:"missing"});
   return route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="462" height="174"><rect width="462" height="174" fill="#345"/></svg>'});
 };
 await p.route(/https:\/\/[^/]+\/(?:store_item_assets\/)?steam\/apps\/99999[12]\//,artRoute);
 await p.evaluate(()=>{
   closeDrawer();const probe=document.createElement("div");probe.id="steam-art-probe";
   probe.innerHTML=[999991,999992].map(id=>discoveryArtwork({type:"game",cover:"https://cdn.cloudflare.steamstatic.com/steam/apps/"+id+"/library_600x900.jpg",coverFallback:"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/"+id+"/hash/capsule_231x87.jpg"})).join("");
   document.body.prepend(probe);probe.querySelectorAll("img").forEach(image=>image.loading="eager");probe.scrollIntoView();
 });
 await p.waitForFunction(()=>[...document.querySelectorAll("#steam-art-probe img")].every(image=>image.complete&&image.naturalWidth===462));
 const loadedArtwork=await p.locator("#steam-art-probe img").evaluateAll(images=>images.map(image=>({src:image.src,failed:image.classList.contains("failed")})));
 assert(loadedArtwork[0].src.includes("capsule_231x87_2x.jpg"));
 assert(loadedArtwork[1].src.endsWith("/capsule_231x87.jpg"));
 assert(loadedArtwork.every(image=>!image.failed));
 assert.equal(imageRequests.filter(url=>url.includes("/999991/")).length,1,"Available high-resolution art needs no fallback requests");
 assert.equal(imageRequests.filter(url=>url.includes("/999992/")).length,3,"Missing larger art falls back through a bounded sequence");
 await p.evaluate(()=>document.getElementById("steam-art-probe").remove());
 await p.unroute(/https:\/\/[^/]+\/(?:store_item_assets\/)?steam\/apps\/99999[12]\//,artRoute);


 const trailerCases=await p.evaluate(()=>{
   const before=settings.lang;
   const id="AbCdEf123_-";
   const accepted=["https://www.youtube.com/watch?v="+id,"https://youtu.be/"+id+"?t=12","https://www.youtube-nocookie.com/embed/"+id,"https://youtube.com/shorts/"+id,"https://m.youtube.com/live/"+id];
   const rejected=["javascript:alert(1)","https://youtube.com.evil.example/watch?v="+id,"https://youtube.com/channel/"+id,"https://www.youtube.com:444/watch?v="+id,"https://user:secret@youtube.com/watch?v="+id,"https://youtu.be/invalid"];
   settings.lang="ja";
   const html=accepted.map(url=>trailerPlayer(url));
   settings.lang=before;
   return {html,rejected:rejected.map(url=>trailerPlayer(url))};
 });
 assert(trailerCases.html.every(html=>html.includes("https://www.youtube-nocookie.com/embed/AbCdEf123_-")&&html.includes("トレーラー")),"Supported YouTube forms render directly with the selected language");
 assert(trailerCases.rejected.every(html=>html===""),"Unsupported or unsafe trailer URLs must not embed");

 const refreshProbe=await p.evaluate(()=>{
   const savedItems=items,savedLang=settings.lang,original=api.runtime.sendMessage;
   let response;
   api.runtime.sendMessage=(message,callback)=>{if(["COMPLETE_ITEM_METADATA","GAME_ENRICH"].includes(message.type)){callback(response);return;}return original.call(api.runtime,message,callback);};
   const fixture={id:"refresh-probe",title:"Original",type:"watching",season:1,episode:4,cast:[{name:"Known"}],cover:"",synopsis:""};
   try {
     settings.lang="ja";items=[fixture];openDrawer(fixture.id);
     const label=document.getElementById("dr-refresh-info").textContent;
     response={ok:true,status:"partial",matched:false,item:{...fixture,synopsis:"Recovered summary"}};
     document.getElementById("dr-refresh-info").click();
     const partial={message:document.getElementById("dr-refresh-status").textContent,synopsis:items[0].synopsis,episode:items[0].episode};
     settings.lang="fr";openDrawer(fixture.id);response={ok:false,error:"offline"};
     document.getElementById("dr-refresh-info").click();
     const failed={message:document.getElementById("dr-refresh-status").textContent,enabled:!document.getElementById("dr-refresh-info").disabled,synopsis:items[0].synopsis};
     response={ok:true,status:"not_found",item:items[0]};
     document.getElementById("dr-refresh-info").click();
     const absent=document.getElementById("dr-refresh-status").textContent;
     settings.lang="en";response={ok:true,status:"matched",item:{...fixture,type:"game",synopsis:"Game",gameEnrichedAt:1}};
     items=[response.item];openDrawer(fixture.id);
     document.getElementById("dr-refresh-info").click();
     const success=document.getElementById("dr-refresh-status").textContent;
     return {label,partial,failed,absent,success};
   }finally{api.runtime.sendMessage=original;closeDrawer();items=savedItems;settings.lang=savedLang;}
 });
 assert(refreshProbe.label.includes("作品情報を更新"));
 assert.equal(refreshProbe.partial.message,"一部の情報を更新しました。未取得の情報があります。");
 assert.equal(refreshProbe.partial.synopsis,"Recovered summary");
 assert.equal(refreshProbe.partial.episode,4);
 assert.equal(refreshProbe.failed.message,"Actualisation impossible. Réessaie.");
 assert(refreshProbe.failed.enabled);
 assert.equal(refreshProbe.failed.synopsis,"Recovered summary");
 assert.equal(refreshProbe.absent,"Aucune nouvelle information disponible.");
 assert.equal(refreshProbe.success,"Details updated.");


 const metadataTransport=await p.evaluate(async()=>{
   const original=api.runtime.sendMessage;
   let late;
   try {
     api.runtime.sendMessage=(_message,callback)=>{late=callback;};
     let completions=0;
     const timeout=await new Promise(resolve=>requestMetadata({type:"CATALOG_DETAIL"},response=>{completions++;resolve(response);},20));
     late({ok:true,item:{title:"Too late"}});
     api.runtime.sendMessage=(_message,callback)=>callback({ok:true,item:{title:"Recovered"}});
     const recovered=await new Promise(resolve=>requestMetadata({type:"CATALOG_DETAIL"},resolve,20));
     api.runtime.sendMessage=()=>{throw Error("Disconnected");};
     const thrown=await new Promise(resolve=>requestMetadata({type:"CATALOG_DETAIL"},resolve,20));
     return {timeout,recovered,thrown,completions};
   }finally{api.runtime.sendMessage=original;}
 });
 assert.equal(metadataTransport.timeout.error,"metadata_timeout");
 assert.equal(metadataTransport.completions,1,"A late reply must not complete the same request twice");
 assert.equal(metadataTransport.recovered.item.title,"Recovered");
 assert.equal(metadataTransport.thrown.error,"metadata_transport");
 const refreshTimeout=await p.evaluate(async()=>{
   const savedItems=items,savedLang=settings.lang,originalSend=api.runtime.sendMessage,originalRequest=requestMetadata;
   let late;
   try {
     settings.lang="fr";
     items=[{id:"timeout-probe",title:"Saved",type:"watching",episode:3,cast:[{name:"Known"}],synopsis:"Keep"}];
     api.runtime.sendMessage=(message,callback)=>{
       if(message.type==="COMPLETE_ITEM_METADATA"){late=callback;return;}
       return originalSend.call(api.runtime,message,callback);
     };
     requestMetadata=(message,callback)=>originalRequest(message,callback,20);
     openDrawer("timeout-probe");
     document.getElementById("dr-refresh-info").click();
     await new Promise(resolve=>setTimeout(resolve,60));
     const enabled=!document.getElementById("dr-refresh-info").disabled;
     const message=document.getElementById("dr-refresh-status").textContent;
     late({ok:true,matched:true,status:"matched",item:{id:"timeout-probe",title:"Late replacement",type:"watching",episode:0}});
     return {enabled,message,title:items[0].title,episode:items[0].episode};
   }finally{requestMetadata=originalRequest;api.runtime.sendMessage=originalSend;closeDrawer();items=savedItems;settings.lang=savedLang;}
 });
 assert(refreshTimeout.enabled,"Timeout releases the refresh button");
 assert.equal(refreshTimeout.message,"Actualisation impossible. Réessaie.");
 assert.equal(refreshTimeout.title,"Saved");
 assert.equal(refreshTimeout.episode,3);


 const guideRecovery=await p.evaluate(async()=>{
   const originalSend=api.runtime.sendMessage,originalRequest=requestMetadata,savedLang=settings.lang;
   const drawer=document.getElementById("drawer");
   let mode="silent",late,episodeLate;
   const season={id:"11",number:1,name:"Official season",episodeCount:1};
   try{
     settings.lang="fr";drawer.innerHTML='<section id="episode-guide"></section>';drawer.classList.add("open");
     requestMetadata=(message,callback)=>originalRequest(message,callback,20);
     api.runtime.sendMessage=(message,callback)=>{
       if(message.type!=="CATALOG_EPISODE_GUIDE")return originalSend.call(api.runtime,message,callback);
       if(mode==="silent"){late=callback;return;}
       if(!message.seasonId){callback({ok:true,seasons:[season]});return;}
       if(mode==="episodes-silent"){episodeLate=callback;return;}
       callback({ok:true,seasons:[season],season,episodes:[{id:"1",number:1,name:"Recovered episode",airdate:"2020-01-01",runtime:25,special:false}]});
     };
     mountEpisodeGuide({type:"watching",externalIds:{tvmaze:"1"}});
     await new Promise(resolve=>setTimeout(resolve,60));
     const root=document.getElementById("episode-guide");
     const seasonsRetry=!!root.querySelector("button");
     mode="episodes-silent";root.querySelector("button").click();
     await new Promise(resolve=>setTimeout(resolve,60));
     const area=root.querySelector(".guide-episodes");
     const episodesRetry=!!area.querySelector("button"),busy=area.getAttribute("aria-busy");
     mode="success";area.querySelector("button").click();
     await new Promise(resolve=>setTimeout(resolve,0));
     late({ok:true,seasons:[]});
     episodeLate({ok:true,season,episodes:[]});
     return {seasonsRetry,episodesRetry,busy,text:root.textContent,rows:root.querySelectorAll(".guide-episode").length};
   }finally{requestMetadata=originalRequest;api.runtime.sendMessage=originalSend;settings.lang=savedLang;closeDrawer();}
 });
 assert(guideRecovery.seasonsRetry,"A silent seasons request must offer retry");
 assert(guideRecovery.episodesRetry,"A silent episodes request must offer retry");
 assert.equal(guideRecovery.busy,"false");
 assert.equal(guideRecovery.rows,1);
 assert(guideRecovery.text.includes("Recovered episode"),"Late timed-out replies cannot erase recovered episodes");


 const priceLabels=await p.evaluate(()=>{
   const previous=settings.lang;settings.lang="fr";
   try {
     const fresh={type:"game",price:"9,99€",priceStatus:"available",priceCheckedAt:Date.now()};
     return {fresh:gamePriceNote(fresh),absent:gamePriceNote({...fresh,priceStatus:"unavailable"}),old:gamePriceNote({...fresh,priceCheckedAt:Date.now()-600001}),legacy:gamePriceNote({price:"Free"}),html:catalogInformation({...fresh,priceStatus:"unavailable"})};
   }finally{settings.lang=previous;}
 });
 assert.equal(priceLabels.fresh,"Prix indicatif — vérifier en boutique");
 assert.equal(priceLabels.absent,"Dernier prix connu — à vérifier en boutique");
 assert.equal(priceLabels.old,priceLabels.absent);
 assert.equal(priceLabels.legacy,priceLabels.absent);
 assert(priceLabels.html.includes(priceLabels.absent));
 assert(priceLabels.html.includes("9,99€"));

 console.log('PASS: bulk copy preserves source; move; keyboard reorder; remove preserves library; mobile width');
}finally{await context.close();}
