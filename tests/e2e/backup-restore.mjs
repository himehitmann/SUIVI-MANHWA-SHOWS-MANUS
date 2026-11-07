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
