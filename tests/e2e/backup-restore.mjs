import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root=process.env.YOMU_EXTENSION_DIR || process.cwd();
async function freshInstall(test) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"yomu-backup-restore-"));
  let context;
  try {
    context=await chromium.launchPersistentContext(directory,{channel:"chromium",headless:true,
      args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await worker.evaluate(()=>serializeLibrary(()=>migrateStorage()));
    const page=await context.newPage(), errors=[];
    page.on("pageerror",err=>errors.push(err.message));
    await page.goto(new URL("library.html",worker.url()).href);
    await page.locator("#avatar").click();
    await page.locator("#export").waitFor();
    const result=await test(page,worker);
    assert.deepEqual(errors,[]);
    return result;
  } finally {
    if(context)await context.close();
    await fs.rm(directory,{recursive:true,force:true});
  }
}
async function downloadBackup(page) {
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#export").click()]);
  return fs.readFile(await download.path());
}
async function restoreBackup(page,buffer) {
  await page.locator("#file").setInputFiles({name:"yomu-backup.json",mimeType:"application/json",buffer});
  await page.waitForFunction(()=>!importPending && document.querySelector("#file")?.files.length===0);
}

const files=await freshInstall(async(page,worker)=>{
  await worker.evaluate(()=>chrome.storage.local.set({
    "dasi.items":[{id:"bonus",title:"Bonus",type:"reading",chapter:12.75,page:8,notes:"Keep",favorite:true,tags:["Mine"],cover:"https://example.test/art.png",synopsis:"Story",enrichedAt:1,identityVersion:1}],
    "dasi.lists":[{id:"reading-list",name:"Weekend",itemIds:["bonus"]}],
    "dasi.sites":[{id:"reader-site",name:"Reader",url:"https://reader.example/"}],
    "dasi.notifications":[{id:"notice",title:"Bonus",message:"New chapter",itemId:"bonus",ts:123,read:false}],
    "dasi.settings":{lang:"fr",notifyNew:false,profile:{name:"Lectrice",bio:"My profile"},ocrKey:"source-private-key"}
  }));
  // The page's cached view must never determine what gets exported.
  await page.evaluate(()=>{items=[];notifications=[];lists=[];sites=[];});
  const full=await downloadBackup(page), copy=JSON.parse(full);
  assert.equal(copy.items[0].chapter,12.75);assert.equal(copy.notifications[0].id,"notice");
  assert.equal(copy.settings.ocrKey,undefined);assert(!full.includes("source-private-key"));
  await worker.evaluate(()=>chrome.storage.local.set({"dasi.items":[],"dasi.lists":[],"dasi.sites":[],
    "dasi.notifications":[{id:"standalone",title:"Updates",message:"Earlier news",read:true,ts:100}],
    "dasi.settings":{lang:"en",profile:{name:"Another profile"}}
  }));
  const history=await downloadBackup(page);
  await worker.evaluate(()=>chrome.storage.local.set({"dasi.notifications":[],"dasi.settings":{profile:{banner:"Imported banner"}}}));
  const profile=await downloadBackup(page);
  return {full,history,profile};
});

await freshInstall(async(page,worker)=>{
  const keys=["dasi.items","dasi.lists","dasi.sites","dasi.notifications","dasi.settings"];
  const original=await worker.evaluate(async()=>chrome.storage.local.get("dasi.items"));
  assert.equal((original["dasi.items"]||[]).length,0);
  await worker.evaluate(()=>chrome.storage.local.set({"dasi.settings":{profile:{name:"",avatar:""},ocrKey:"destination-private-key"}}));
  await restoreBackup(page,files.full);
  let data=await worker.evaluate(keys=>chrome.storage.local.get(keys),keys);
  assert.equal(data["dasi.items"].length,1);assert.equal(data["dasi.items"][0].chapter,12.75);
  assert.equal(data["dasi.items"][0].page,8);assert.equal(data["dasi.items"][0].notes,"Keep");assert.equal(data["dasi.items"][0].favorite,true);
  assert.deepEqual(data["dasi.items"][0].tags,["Mine"]);assert.deepEqual(data["dasi.lists"][0].itemIds,["bonus"]);
  assert.equal(data["dasi.sites"][0].url,"https://reader.example/");
  assert.equal(data["dasi.settings"].lang,"fr");assert.equal(data["dasi.settings"].notifyNew,false);
  assert.equal(data["dasi.settings"].profile.name,"Lectrice");assert.equal(data["dasi.settings"].profile.bio,"My profile");
  assert.equal(data["dasi.settings"].ocrKey,"destination-private-key");
  assert.equal(data["dasi.notifications"][0].itemId,"bonus");assert.equal(data["dasi.notifications"][0].read,false);
  await page.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:"NOTIF_READ_ALL"},resolve)));
  await restoreBackup(page,files.full);
  await restoreBackup(page,files.history);
  await restoreBackup(page,files.profile);
  await page.reload();await page.waitForFunction(()=>items.some(item=>item.id==="bonus")&&notifications.length===2);
  data=await worker.evaluate(keys=>chrome.storage.local.get(keys),keys);
  assert.deepEqual(data["dasi.notifications"].map(n=>[n.id,n.read]),[["notice",true],["standalone",true]]);
  assert.equal(data["dasi.settings"].profile.name,"Lectrice");assert.equal(data["dasi.settings"].profile.banner,"Imported banner");
  assert.equal(data["dasi.items"].length,1);assert.equal(data["dasi.lists"].length,1);assert.equal(data["dasi.sites"].length,1);
  assert.deepEqual(await worker.evaluate(()=>chrome.notifications.getAll()),{});

  await page.locator("#avatar").click();
  const before=await worker.evaluate(keys=>chrome.storage.local.get(keys),keys);
  const invalid=Buffer.from(JSON.stringify({version:2,items:[{id:"bad-work",title:"Should not appear",type:"reading"}],sites:[null]}));
  await restoreBackup(page,invalid);
  assert.match(await page.locator("#toast").textContent(),/Aucun import/);
  assert.deepEqual(await worker.evaluate(keys=>chrome.storage.local.get(keys),keys),before);
  await page.locator("#file").setInputFiles([
    {name:"good.json",mimeType:"application/json",buffer:files.full},
    {name:"truncated.json",mimeType:"application/json",buffer:Buffer.from('{"version":2,"items":[')}
  ]);
  await page.waitForFunction(()=>!importPending&&document.querySelector("#file").files.length===0);
  assert.match(await page.locator("#toast").textContent(),/Aucun import/);
  assert.deepEqual(await worker.evaluate(keys=>chrome.storage.local.get(keys),keys),before);

  const retry=Buffer.from(JSON.stringify({version:2,items:[{id:"retry-work",title:"Retry work",type:"reading",chapter:9,cover:"https://example.test/art.png",synopsis:"Story",identityVersion:1,enrichedAt:1}]}));
  await worker.evaluate(()=>{
    globalThis.backupTestSet=chrome.storage.local.set;
    chrome.storage.local.set=async values=>{
      if(values["dasi.items"]?.some(item=>item.id==="retry-work"))throw Error("quota_exceeded");
      return globalThis.backupTestSet.call(chrome.storage.local,values);
    };
  });
  try{
    await restoreBackup(page,retry);
    assert.match(await page.locator("#toast").textContent(),/Import non confirmé/);
    assert.deepEqual(await worker.evaluate(keys=>chrome.storage.local.get(keys),keys),before);
    assert.equal(await page.locator("#import").isEnabled(),true);
  }finally{await worker.evaluate(()=>{chrome.storage.local.set=globalThis.backupTestSet;delete globalThis.backupTestSet;});}
  await restoreBackup(page,retry);
  assert.equal((await worker.evaluate(()=>chrome.storage.local.get("dasi.items")))["dasi.items"].find(item=>item.id==="retry-work")?.chapter,9);

  let downloads=0;const onDownload=()=>downloads++;page.on("download",onDownload);
  await worker.evaluate(()=>{
    globalThis.backupTestGet=chrome.storage.local.get;
    chrome.storage.local.get=async keys=>{
      if(Array.isArray(keys)&&keys.includes("dasi.items"))throw Error("storage_unavailable");
      return globalThis.backupTestGet.call(chrome.storage.local,keys);
    };
  });
  try{
    await page.locator("#export").click();await page.waitForFunction(()=>!exportPending);
    assert.equal(downloads,0);assert.match(await page.locator("#toast").textContent(),/Impossible de créer/);
    assert.equal(await page.locator("#export").isEnabled(),true);
  }finally{
    await worker.evaluate(()=>{chrome.storage.local.get=globalThis.backupTestGet;delete globalThis.backupTestGet;});
    page.off("download",onDownload);
  }
  const recovered=JSON.parse(await downloadBackup(page));
  assert.equal(recovered.items.length,2);assert.equal(recovered.items.find(item=>item.id==="bonus").chapter,12.75);
});
console.log("PASS: downloaded extension backup restores into a separate fresh Chromium profile, including title-free backups and read history");

console.log("PASS: invalid and truncated imports preserve all collections; failed storage import and export recover through the real buttons");

await freshInstall(async(page,worker)=>{
  const names=["Crimson Maple Saga","Lunar Harbor Chronicles"];
  const uploads=names.map((title,index)=>({name:"collision-"+index+".json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({
    version:2,
    items:[{id:"shared-id",title,type:"reading",chapter:index?9:4,cover:"https://example.test/art.png",synopsis:"Story",identityVersion:1,enrichedAt:1}],
    lists:[{id:"collision-list-"+index,name:"Collection "+index,itemIds:["shared-id"]}],
    notifications:[{id:"collision-notice-"+index,title,itemId:"shared-id",read:true,ts:index+1}]
  }))}));
  for(let pass=0;pass<2;pass++){
    await page.locator("#file").setInputFiles(uploads);
    await page.waitForFunction(()=>!importPending&&document.querySelector("#file").files.length===0);
    const data=await worker.evaluate(()=>chrome.storage.local.get(["dasi.items","dasi.lists","dasi.notifications"]));
    assert.equal(data["dasi.items"].length,2);assert.equal(data["dasi.lists"].length,2);
    for(let index=0;index<2;index++){
      const list=data["dasi.lists"].find(list=>list.id==="collision-list-"+index);
      const work=data["dasi.items"].find(item=>item.id===list.itemIds[0]);
      assert.equal(work.title,names[index]);assert.equal(work.chapter,index?9:4);
      assert.equal(data["dasi.notifications"].find(n=>n.id==="collision-notice-"+index).itemId,work.id);
    }
  }
  await page.reload();await page.locator("#avatar").click();
  const exported=JSON.parse(await downloadBackup(page));
  assert.equal(exported.items.length,2);
  for(let index=0;index<2;index++){
    const list=exported.lists.find(list=>list.id==="collision-list-"+index);
    assert.equal(exported.items.find(item=>item.id===list.itemIds[0]).title,names[index]);
  }
});
console.log("PASS: repeated multi-file imports with colliding work IDs preserve both works, their lists and notification destinations");

await freshInstall(async(page,worker)=>{
  const sender=await page.context().newPage();
  await sender.goto(new URL("tests/fixtures/reader.html",worker.url()).href);
  const before=await worker.evaluate(async()=>{
    const config=id=>({provider:"firebase",apiUrl:"https://accounts.example/api",userId:id,email:id+"@example.test",token:id});
    const a={"dasi.items":[{id:"shared",title:"Account A work",type:"reading",chapter:4,notes:"A notes"}],"dasi.lists":[],"dasi.sites":[],"dasi.notifications":[],"dasi.settings":{profile:{name:"Account A"}},"yomu.tombstones.v1":[]};
    const b={"dasi.items":[{id:"shared",title:"Account B work",type:"reading",chapter:9,notes:"B notes"}],"dasi.lists":[{id:"b-list",name:"B list",itemIds:["shared"]}],"dasi.sites":[],"dasi.notifications":[],"dasi.settings":{profile:{name:"Account B"}},"yomu.tombstones.v1":[]};
    // No external account or network access is needed for this worker queue fixture.
    autoSync=()=>{};checkTrackedReleases=async()=>{};
    await serializeLibrary(()=>chrome.storage.local.set({...a,[SYNC_CFG_KEY]:config("a"),[ACCOUNT_CACHE_KEY]:{[scopeOf(config("b"))]:b}}));
    globalThis.accountQueueReady=new Promise(resolve=>{globalThis.accountQueueReadyResolve=resolve;});
    let received=0;
    globalThis.accountQueueObserver=message=>{if(message.queueTest===true&&++received===3)globalThis.accountQueueReadyResolve();};
    chrome.runtime.onMessage.addListener(globalThis.accountQueueObserver);
    globalThis.accountQueueGate=new Promise(resolve=>{globalThis.accountQueueRelease=resolve;});
    void serializeLibrary(()=>globalThis.accountQueueGate);
    globalThis.accountSwitchDone=serializeLibrary(()=>switchSyncAccount(config("b")));
    return {a,b};
  });
  await sender.evaluate(()=>{
    globalThis.oldAccountRequests=Promise.all([
      {type:"UPDATE_ITEM",id:"shared",patch:{chapter:99,notes:"Wrong account"}},
      {type:"IMPORT_MERGE",payload:{items:[{id:"wrong-import",title:"Wrong import",type:"reading"}]}},
      {type:"SET_SETTINGS",patch:{profile:{name:"Wrong profile"}}},
    ].map(message=>chrome.runtime.sendMessage({...message,queueTest:true})));
  });
  await worker.evaluate(()=>globalThis.accountQueueReady);
  await worker.evaluate(()=>globalThis.accountQueueRelease());
  const responses=await sender.evaluate(()=>globalThis.oldAccountRequests);
  assert(responses.every(response=>response.ok===false&&response.error==="account_changed"),JSON.stringify(responses));
  await worker.evaluate(()=>globalThis.accountSwitchDone);
  const destination=await worker.evaluate(keys=>chrome.storage.local.get(keys),Object.keys(before.b));
  assert.deepEqual(destination,before.b);
  const source=await worker.evaluate(async()=>{
    chrome.runtime.onMessage.removeListener(globalThis.accountQueueObserver);
    const cfg={provider:"firebase",apiUrl:"https://accounts.example/api",userId:"a",email:"a@example.test",token:"a"};
    await serializeLibrary(()=>switchSyncAccount(cfg));
    return chrome.storage.local.get(["dasi.items","dasi.settings"]);
  });
  assert.deepEqual(source["dasi.items"],before.a["dasi.items"]);assert.deepEqual(source["dasi.settings"],before.a["dasi.settings"]);
  await sender.close();
});
console.log("PASS: queued edits, imports and preferences from account A cannot change account B; account A data remains intact");

await freshInstall(async(page,worker)=>{
  const initialReload=page.waitForEvent("framenavigated",frame=>frame===page.mainFrame());
  await worker.evaluate(async()=>{
    autoSync=()=>{};checkTrackedReleases=async()=>{};
    getDiscover=async()=>({manga:[],manhwa:[],manhua:[],anime:[],series:[],gamesHot:[],gamesSoon:[]});
    const config=id=>({apiUrl:"https://accounts.example/api",userId:id,email:id+"@example.test",token:id});
    const data=id=>({"dasi.items":[{id:"shared",title:"Private work "+id,type:"reading",chapter:id==="a"?4:9,notes:"Notes "+id,cover:"https://example.test/art.png",synopsis:"Story",identityVersion:1,enrichedAt:1}],"dasi.lists":[],"dasi.sites":[],"dasi.notifications":[],"dasi.settings":{lang:"en",profile:{name:"Reader "+id}},"yomu.tombstones.v1":[]});
    await serializeLibrary(()=>chrome.storage.local.set({...data("a"),[SYNC_CFG_KEY]:config("a"),[ACCOUNT_CACHE_KEY]:{[scopeOf(config("b"))]:data("b")}}));
  });
  await initialReload;await page.waitForFunction(()=>typeof accountChanging!=="undefined"&&!accountChanging&&settings.profile.name==="Reader a"&&items[0]?.title==="Private work a");
  const second=await page.context().newPage(),otherErrors=[];
  second.on("pageerror",error=>otherErrors.push(error.message));
  await second.goto(new URL("library.html",worker.url()).href);
  await second.waitForFunction(()=>items[0]?.title==="Private work a");
  await second.evaluate(()=>{openDrawer("shared");globalThis.sameAccountMarker=true;globalThis.refreshObserved=false;chrome.storage.onChanged.addListener(changes=>{if(changes["dasi.sync.config"])globalThis.refreshObserved=true;});});
  await second.locator("#dr-title").fill("Unsaved title");
  await worker.evaluate(async()=>{const config=await getSyncConfig();await chrome.storage.local.set({[SYNC_CFG_KEY]:{...config,token:"renewed-a",plan:"pro"}});});
  await second.waitForFunction(()=>globalThis.refreshObserved===true);
  assert.equal(await second.evaluate(()=>globalThis.sameAccountMarker),true);
  assert.equal(await second.locator("#dr-title").inputValue(),"Unsaved title");
  const scopes=await second.evaluate(()=>({
    firebaseSame:libraryAccountScope({provider:"firebase",projectId:"one",userId:"reader",token:"old"})===libraryAccountScope({provider:"firebase",projectId:"one",userId:"reader",token:"new"}),
    firebaseOther:libraryAccountScope({provider:"firebase",projectId:"one",userId:"reader",token:"token"})!==libraryAccountScope({provider:"firebase",projectId:"two",userId:"reader",token:"token"}),
    otherServer:libraryAccountScope({apiUrl:"https://one.example/api",userId:"reader",token:"token"})!==libraryAccountScope({apiUrl:"https://two.example/api",userId:"reader",token:"token"})
  }));
  assert.deepEqual(scopes,{firebaseSame:true,firebaseOther:true,otherServer:true});

  await page.locator("#avatar").click();
  await page.evaluate(()=>{
    globalThis.pendingOldParser=true;
    window.YomuImport.parseFiles=()=>new Promise(resolve=>{globalThis.finishOldParser=()=>resolve({count:1,items:[{title:"Old account import",type:"reading"}],warnings:[]});});
  });
  await page.locator("#file").setInputFiles({name:"waiting.json",mimeType:"application/json",buffer:Buffer.from("[]")});
  await page.waitForFunction(()=>importPending);
  const reloaded=[page,second].map(tab=>tab.waitForEvent("framenavigated",frame=>frame===tab.mainFrame()));
  await worker.evaluate(()=>serializeLibrary(()=>switchSyncAccount({apiUrl:"https://accounts.example/api",userId:"b",email:"b@example.test",token:"b"})));
  await Promise.all(reloaded);
  for(const tab of [page,second]){
    await tab.waitForFunction(()=>typeof accountChanging!=="undefined"&&!accountChanging&&!importPending&&settings.profile.name==="Reader b"&&items[0]?.title==="Private work b");
    assert.equal(await tab.locator("#drawer.open").count(),0);
    assert.equal(await tab.evaluate(()=>typeof globalThis.pendingOldParser),"undefined");
    assert.equal(await tab.evaluate(()=>getComputedStyle(document.documentElement).visibility),"visible");
  }
  const after=await worker.evaluate(()=>chrome.storage.local.get(["dasi.items","dasi.settings"]));
  assert.equal(after["dasi.items"].length,1);assert.equal(after["dasi.items"][0].chapter,9);assert.equal(after["dasi.items"][0].notes,"Notes b");assert.equal(after["dasi.settings"].profile.name,"Reader b");
  const signedOut=[page,second].map(tab=>tab.waitForEvent("framenavigated",frame=>frame===tab.mainFrame()));
  await worker.evaluate(()=>serializeLibrary(()=>switchSyncAccount(null)));
  await Promise.all(signedOut);
  for(const tab of [page,second])await tab.waitForFunction(()=>typeof accountChanging!=="undefined"&&!accountChanging&&!libraryLoadPending&&items.length===0&&settings.profile.name==="");
  const back=page.waitForEvent("framenavigated",frame=>frame===page.mainFrame());
  await worker.evaluate(()=>serializeLibrary(()=>switchSyncAccount({apiUrl:"https://accounts.example/api",userId:"a",email:"a@example.test",token:"new-a"})));
  await back;await page.waitForFunction(()=>typeof settings!=="undefined"&&settings.profile.name==="Reader a"&&items[0]?.chapter===4);
  assert.equal(await page.evaluate(()=>items[0].title),"Private work a");
  assert.equal(await page.evaluate(()=>items[0].notes),"Notes a");
  assert.deepEqual(otherErrors,[]);
  await second.close();
});
console.log("PASS: open library tabs discard old-account drafts and pending file parsing on switch/sign-out while same-account token renewal preserves the draft");
