import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'yomu-crop-'));
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${process.cwd()}`,`--load-extension=${process.cwd()}`]});
try {
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const page=await context.newPage();
 await page.goto(`chrome-extension://${new URL(worker.url()).host}/library.html`);
 await page.waitForFunction(()=>typeof openCropper==='function');
 const failure=await page.evaluate(async()=>{
   const original=chrome.runtime.sendMessage;
   items=[{id:"failure-check",title:"Original",chapter:3}];
   lists=[{id:"list-check",name:"Original list",itemIds:["failure-check"]}];
   chrome.runtime.sendMessage=(message,callback)=>callback({ok:false,error:"storage_failed"});
   try {
     const itemSaved=await update("failure-check",{chapter:8});
     const oldProfile=JSON.stringify(settings.profile); const profileSaved=await saveProfilePatch({name:"Should fail"}); if(profileSaved!==false||JSON.stringify(settings.profile)!==oldProfile)throw Error("Failed profile save changed state");
     const listSaved=await listMsg("LIST_UPDATE",{id:"list-check",patch:{name:"Changed"}});
     return {itemSaved,listSaved,chapter:items[0].chapter,name:lists[0].name};
   }finally{chrome.runtime.sendMessage=original;}
 });
 assert.deepEqual(failure,{itemSaved:false,listSaved:false,chapter:3,name:"Original list"});
 for(const width of [1280,375]) {
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=400;const x=c.getContext('2d');x.fillStyle='#6353b8';x.fillRect(0,0,800,400);x.fillStyle='#8bd4bf';x.fillRect(200,100,300,200);openCropper({shape:'banner',initial:c.toDataURL(),onSave:()=>{}});});
  await page.waitForFunction(()=>!document.querySelector('#crop-save').disabled);
  await page.waitForTimeout(250);
  const dialog=await page.locator('#cropper').boundingBox(),view=await page.locator('#crop-view').boundingBox();
  assert(view.x>=dialog.x&&view.x+view.width<=dialog.x+dialog.width,'Preview overflow');
  await page.locator('#crop-view').hover();await page.mouse.wheel(0,-150);
  await page.waitForFunction(()=>Number(document.querySelector('#crop-zoom').value)>1);
  assert(await page.evaluate(()=>cropState.ox<=0&&cropState.oy<=0),'Crop left empty margins');
  await page.screenshot({path:`test-results/crop-banner-${width}.png`});
  await page.locator('#crop-cancel').click();
 }
 const selection=await page.evaluate(()=>{
  const originalImage=window.Image,originalDraw=drawCrop,pending=[];
  openCropper({initial:"",onSave:()=>true});
  window.Image=class {naturalWidth=800;naturalHeight=400;set src(value){this.url=value;pending.push(this);}};
  drawCrop=()=>{};
  try{
   loadCropImage("old");loadCropImage("new");
   pending[1].onload();const chosen=cropState.img;
   pending[0].onload();pending[0].onerror();
   const newest=cropState.img===chosen&&chosen.url==="new";
   loadCropImage("broken");pending[2].onerror();
   return {newest,disabled:document.getElementById("crop-save").disabled,empty:cropState.img===null};
  }finally{window.Image=originalImage;drawCrop=originalDraw;closeCropper();}
 });
 assert.deepEqual(selection,{newest:true,disabled:true,empty:true});
 await page.evaluate(()=>{
  const canvas=document.createElement("canvas");canvas.width=100;canvas.height=100;
  globalThis.cropCalls=0;globalThis.cropResolve=null;
  openCropper({initial:canvas.toDataURL(),allowClear:true,onSave:()=>{cropCalls++;return new Promise(resolve=>cropResolve=resolve);}});
 });
 await page.waitForFunction(()=>!!cropState.img);
 await page.locator("#crop-save").click();
 await page.evaluate(()=>{document.getElementById("crop-remove").click();document.getElementById("crop-save").click();});
 assert.equal(await page.evaluate(()=>cropCalls),1);
 await page.evaluate(()=>cropResolve(false));
 await page.waitForFunction(()=>!document.getElementById("crop-save").disabled);
 assert(await page.locator("#cropper").evaluate(n=>n.classList.contains("open")));
 assert(await page.evaluate(()=>!!cropState.img));
 await page.locator("#crop-save").click();
 assert.equal(await page.evaluate(()=>cropCalls),2);
 await page.evaluate(()=>cropResolve(true));
 await page.waitForFunction(()=>cropState===null);

 console.log('PASS: desktop/mobile bounds; wheel zoom; crop bounds; cancel');
} finally {await context.close();}
