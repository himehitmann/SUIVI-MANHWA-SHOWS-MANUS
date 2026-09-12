import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'yomu-video-package-'));
const zip=vm.createContext({Uint8Array,Uint16Array,Uint32Array,Int32Array,TextEncoder,TextDecoder});vm.runInContext(await fs.readFile('vendor/fflate.min.js','utf8'),zip);
for(const [name,bytes] of Object.entries(zip.fflate.unzipSync(new Uint8Array(await fs.readFile('yomu-extension.zip'))))){const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
for(const name of ['popup.html','popup.js'])await fs.copyFile(name,path.join(root,name));
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));manifest.host_permissions.push('http://localhost/*');await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest));
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'yomu-video-'));
const c=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
try {
const w=c.serviceWorkers()[0]||await c.waitForEvent('serviceworker');const base=`chrome-extension://${new URL(w.url()).host}/`;
const player=await c.newPage();await player.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Video test</title>'}));await player.goto('http://localhost/video');
await player.evaluate(async()=>{const host=document.createElement('div');host.id='test-player';document.body.append(host);const root=host.attachShadow({mode:'open'});const v=document.createElement('video');root.append(v);const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').fillRect(0,0,320,180);const stream=canvas.captureStream(0),chunks=[],recorder=new MediaRecorder(stream,{mimeType:"video/webm;codecs=vp8"});const ended=new Promise(resolve=>recorder.onstop=resolve);recorder.ondataavailable=e=>chunks.push(e.data);const started=new Promise(resolve=>recorder.onstart=resolve);recorder.start();await started;for(let frame=0;frame<15;frame++){canvas.getContext('2d').fillStyle=frame%2?'#80bfb0':'#6652b8';canvas.getContext('2d').fillRect(0,0,320,180);stream.getVideoTracks()[0].requestFrame();await new Promise(r=>setTimeout(r,80));}recorder.stop();await ended;stream.getTracks().forEach(t=>t.stop());v.src=URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType}));v.loop=true;v.muted=true;await v.play();});
await player.waitForFunction(()=>document.querySelector('#test-player').shadowRoot.querySelector('video').readyState>0);
const target=await w.evaluate(async()=> (await chrome.tabs.query({})).find(t=>t.url==='http://localhost/video').id);
const p=await c.newPage();await p.goto(base+'popup.html');
await p.evaluate(id=>{chrome.tabs.query=async()=>[{id}];},target);
await p.locator('#faster').click();await p.waitForTimeout(1000);console.log(await p.locator('#video-status').innerText());
assert.equal(await player.evaluate(()=>document.querySelector('#test-player').shadowRoot.querySelector('video').playbackRate),1.25);
await p.locator('#pip').click();await p.waitForFunction(()=>document.querySelector('#video-status').textContent.includes('Picture-in-Picture'));
console.log(await p.locator('#video-status').innerText());
assert(await player.evaluate(()=>!!document.pictureInPictureElement),'PiP not entered');
console.log('PASS: shadow DOM speed and real Picture-in-Picture via popup');
}finally{await c.close();}
