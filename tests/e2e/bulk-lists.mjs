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
 await p.locator("#reset-library-filters").click();
 assert.equal(await p.locator("#grid .card").count(),7);
 assert.equal(await p.locator("#library-format").inputValue(),"all");
 assert.equal(await p.locator("#library-unlisted").isChecked(),false);

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
 await p.locator("#feature-pause").focus();await p.keyboard.press("Enter");
 assert.equal(await p.evaluate(()=>document.activeElement?.id),"feature-pause");

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
   return {ratio:box.width/box.height,extraHeight:frame.height-box.height,background:getComputedStyle(image).backgroundImage};
 });
 assert(Math.abs(dimensions.ratio-2.5)<0.02,"Continue artwork keeps its full aspect ratio");
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
 await p.waitForFunction(()=>[...document.querySelectorAll("#view-home .disco-game")].every(card=>card.style.getPropertyValue("--cover-aspect")));
 const gameArt=await p.locator("#view-home .disco-game img").evaluateAll(images=>images.map(image=>{const r=image.getBoundingClientRect();return {width:r.width,height:r.height,ratio:image.naturalWidth/image.naturalHeight};}));
 assert(Math.abs(gameArt[0].height-gameArt[1].height)<1,"Mixed game formats share a consistent artwork height");
 for(const art of gameArt)assert(Math.abs(art.width/art.height-art.ratio)<0.02,"Each game retains its full artwork proportions");
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Variable card widths stay inside their carousel");

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

 console.log('PASS: bulk copy preserves source; move; keyboard reorder; remove preserves library; mobile width');
}finally{await context.close();}
