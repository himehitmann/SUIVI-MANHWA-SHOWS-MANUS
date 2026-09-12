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
 console.log('PASS: bulk copy preserves source; move; keyboard reorder; remove preserves library; mobile width');
}finally{await context.close();}
