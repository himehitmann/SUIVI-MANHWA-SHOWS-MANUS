import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'yomu-bulk-test-'));const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${process.cwd()}`,`--load-extension=${process.cwd()}`]});
try {
 const w=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');

 const p=await context.newPage();await p.goto(`chrome-extension://${new URL(w.url()).host}/library.html`);await p.waitForFunction(()=>typeof hydrate==='function');
 await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:'GET_STATE'},r=>{hydrate(r);resolve();})));
 await w.evaluate(async()=>{await chrome.storage.local.set({'dasi.schema':3,'dasi.settings':{lang:'fr'},'dasi.items':[{id:'a',title:'Alpha',type:'reading',chapter:2},{id:'b',title:'Beta',type:'reading',chapter:8},{id:'c',title:'Gamma',type:'reading',chapter:4}],'dasi.lists':[{id:'source',name:'Source',itemIds:['a','b','c']},{id:'destination',name:'Destination',itemIds:[]}]});});
 await p.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:'GET_STATE'},r=>{hydrate(r);resolve();})));
 await p.waitForFunction(()=>items.length===3&&lists.some(l=>l.id==='source'));
 await p.evaluate(()=>{switchView('library');openList('source');});
 await p.locator('[data-id="a"] .list-select').check();await p.locator('[data-id="b"] .list-select').check();await p.locator('#bulk-destination').selectOption('destination');await p.locator('#bulk-copy').click();
 await p.waitForFunction(()=>lists.find(l=>l.id==='destination').itemIds.length===2);
 assert.deepEqual(await w.evaluate(async()=>(await chrome.storage.local.get('dasi.lists'))['dasi.lists'].find(l=>l.id==='source').itemIds),['a','b','c']);
 await p.locator('[data-id="c"] .list-select').check();await p.locator('#bulk-destination').selectOption('destination');await p.evaluate(()=>{globalThis.bulkOriginalSend=chrome.runtime.sendMessage;chrome.runtime.sendMessage=(m,cb)=>{if(m.type==='LIST_SET_ITEMS'&&m.id==='source')return cb({ok:false,error:'storage_failed'});return globalThis.bulkOriginalSend(m,cb);};});
 await p.locator('#bulk-move').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Retrait de la liste source échoué'));
 assert.deepEqual(await p.evaluate(()=>lists.find(l=>l.id==='source').itemIds),['a','b','c']);
 assert.deepEqual(await p.evaluate(()=>lists.find(l=>l.id==='destination').itemIds),['a','b','c']);
 await p.evaluate(()=>{chrome.runtime.sendMessage=globalThis.bulkOriginalSend;});
 await p.locator('#bulk-move').click();
 await p.waitForFunction(()=>lists.find(l=>l.id==='source').itemIds.length===2);
 assert.deepEqual(await p.evaluate(()=>lists.find(l=>l.id==='destination').itemIds),['a','b','c']);
 await p.locator('[data-id="b"] .list-select').check();await p.locator('#bulk-up').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>lists.find(l=>l.id==='source').itemIds[0]==='b');
 await p.locator('#bulk-remove').click();await p.waitForFunction(()=>lists.find(l=>l.id==='source').itemIds.length===1);
 assert.equal(await w.evaluate(async()=>(await chrome.storage.local.get('dasi.items'))['dasi.items'].length),3);
 await p.setViewportSize({width:375,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
 await p.screenshot({path:'test-results/bulk-lists-mobile.png'});

 await p.setViewportSize({width:1440,height:1000});
 await w.evaluate(async()=>{
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
 await p.locator("#reset-library-filters").click();
 assert.equal(await p.locator("#grid .card").count(),7);
 assert.equal(await p.locator("#library-format").inputValue(),"all");
 assert.equal(await p.locator("#library-unlisted").isChecked(),false);

 await p.evaluate(()=>openCatalogPreview({title:"Unsaved fixture",type:"reading",externalIds:{anilist:"999"},cover:"",genres:["Fantasy"]}));
 assert(await p.locator("#preview-add").isDisabled(),"A destination must be selected");
 await p.waitForFunction(()=>document.querySelector("#preview-info").textContent.includes("Actor"));
 assert.equal(await p.locator("#preview-info iframe").count(),0,"No third-party player before activation");
 await p.locator("#preview-info [data-trailer-src]").click();
 assert.equal(await p.locator("#preview-info iframe").count(),1,"Trailer stays inside Yomu after activation");
 assert.equal(await p.locator("#drawer a[target='_blank']").count(),0,"Preview must not redirect to a catalog");
 assert.equal(await w.evaluate(async()=>(await chrome.storage.local.get("dasi.items"))["dasi.items"].length),7,"Browsing must not save");
 await p.locator("#preview-list").selectOption("destination");
 await p.locator("#preview-add").click();
 await p.waitForFunction(()=>items.length===8&&document.querySelectorAll("#grid .card").length===8);
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
 await p.evaluate(()=>{items.push({id:"game-trailer",title:"Game",type:"game",trailer:"https://www.youtube.com/watch?v=abcdefghijk"});openDrawer("game-trailer");});
 assert.equal(await p.locator("#drawer iframe").count(),0);
 await p.locator("#drawer [data-trailer-src]").click();
 assert.equal(await p.locator("#drawer iframe").count(),1);
 assert.equal(await p.locator('#drawer a[href*="youtube.com"]').count(),0);


 await p.evaluate(()=>{closeDrawer();settings.homeCats=[];renderHome();});
 assert.equal(await p.locator("#view-home .disco-wrap").count(),0,"An empty selection must stay empty");
 await p.locator('[data-home-category="manga"]').click();
 await p.waitForFunction(()=>settings.homeCats.length===1&&settings.homeCats[0]==="manga");
 assert.deepEqual(await p.evaluate(()=>discoPools().map(pool=>pool.key)),["manga"]);
 assert(await p.evaluate(()=>discoItems.every(item=>item.title.startsWith("Manga "))));
 assert(await p.locator("#view-home .carousel-arrow").count()>0);
 await p.evaluate(()=>openCatalogPreview({title:"Store fixture",type:"game",externalIds:{rawg:"123"},gameEnrichedAt:1,storeLinks:["https://www.gog.com/game/example","https://store.epicgames.com/en-US/p/example","https://www.gog.com/game/example","javascript:alert(1)","https://www.gog.com.evil.test/game/x"],url:"https://store.steampowered.com/app/123/",price:"$12.99",platform:"Nintendo Switch · PlayStation 5",releaseDate:"2028-04-12",genres:["Adventure"],alternativeTitles:["Other title"]}));
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
 const storedGame=await w.evaluate(async()=>(await chrome.storage.local.get("dasi.items"))["dasi.items"].find(i=>i.title==="Store fixture"));
 assert.equal(storedGame.externalIds.rawg,"123");assert.equal(storedGame.storeLinks.length,3);
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
 console.log('PASS: bulk copy preserves source; move; keyboard reorder; remove preserves library; mobile width');
}finally{await context.close();}
