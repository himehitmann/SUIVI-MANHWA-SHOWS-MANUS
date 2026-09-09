import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'yomu-web-')),base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['dist/index.js'],{env:{...process.env,NODE_ENV:'production',PORT:String(port),SYNC_JWT_SECRET:randomBytes(32).toString('hex'),SYNC_DB_FILE:path.join(temp,'test.json'),FORCE_HTTPS:'false'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='';server.stderr.on('data',d=>log+=d);server.stdout.on('data',d=>log+=d);
let browser;
try{
 for(let i=0;i<100;i++){if(await fetch(base+'/healthz').then(r=>r.ok).catch(()=>false))break;if(i===99)throw Error('Server unavailable: '+log);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chromium',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/settings');
 await page.getByRole('button',{name:'New here? Create an account',exact:true}).click();
 await page.getByPlaceholder('Email',{exact:true}).fill('web-user@example.test');await page.getByPlaceholder('Password',{exact:true}).fill('browser-test-password');
 await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();

 await page.getByLabel('Display name',{exact:true}).fill('Reader profile');await page.getByLabel('Biography',{exact:true}).fill('Manga and dramas');await page.getByRole('heading',{name:'My profile',exact:true}).click();
 const png=await page.screenshot();await page.getByLabel('Avatar',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:png});await page.getByRole('dialog').waitFor();await page.getByRole('slider').first().fill('1.5');await page.getByRole('button',{name:'Save image',exact:true}).click();
 const backup={version:2,items:[{id:'alchemy',title:'Alchemy of Souls',type:'watching',season:1,episode:2,total:20,url:'https://example.com/show',updatedAt:1},{id:'aniimo',title:'Aniimo',type:'game',tags:['RPG'],externalIds:{steam:4126040},updatedAt:1}],lists:[{id:'watch',name:'My imported list',itemIds:['alchemy']}]};
 await page.locator('input[type=file]').last().setInputFiles({name:'yomu.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.getByRole('status').filter({hasText:'2 added'}).waitFor();
 await page.goto(base+'/work/alchemy');await page.getByRole('heading',{name:'Alchemy of Souls',exact:true}).waitFor();
 await page.getByLabel('Episode / 20',{exact:true}).fill('847');
 await page.getByRole('button',{name:'Save my position',exact:true}).click();
 await page.reload();await page.getByRole('heading',{name:'Alchemy of Souls',exact:true}).waitFor();assert.equal(await page.getByLabel('Episode / 20',{exact:true}).inputValue(),'20');
 await page.getByLabel('Personal notes',{exact:true}).fill('Keep this note across devices');await page.getByRole('button',{name:'Save my position',exact:true}).click();
 await page.goto(base+'/settings');await page.getByRole('button',{name:'Sync now',exact:true}).click();await page.getByText('Library synced',{exact:true}).waitFor();
 const token=await page.evaluate(()=>localStorage.getItem('dasi.sync.token:'+encodeURIComponent('/api')));
 const remote=await (await fetch(base+'/api/sync',{headers:{Authorization:'Bearer '+token}})).json();
 assert.equal(remote.blob.profile.name,'Reader profile');assert.equal(remote.blob.profile.bio,'Manga and dramas');assert.match(remote.blob.profile.avatar,/^data:image\/webp/);
 assert.equal(remote.blob.items.find(i=>i.id==='alchemy').episode,20);assert.equal(remote.blob.items.find(i=>i.id==='alchemy').notes,'Keep this note across devices');assert.equal(remote.blob.items.find(i=>i.id==='aniimo').type,'game');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();await page.goto(base+'/');assert.equal(await page.getByRole('link',{name:'Alchemy of Souls',exact:true}).count(),0);
 await page.goto(base+'/settings');await page.getByPlaceholder('Email',{exact:true}).fill('web-user@example.test');await page.getByPlaceholder('Password',{exact:true}).fill('browser-test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
 await page.goto(base+'/work/aniimo');await page.getByRole('heading',{name:'Aniimo',exact:true}).waitFor();await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));

 await page.setViewportSize({width:1440,height:1000});
 await page.route('**/api/catalog?*',async route=>{const q=new URL(route.request().url()).searchParams.get('q');if(q==='Failure')return route.fulfill({status:503,json:{error:'Unavailable'}});return route.fulfill({json:{results:[{id:'steam-test',title:'Search fixture game',type:'game',format:'GAME',country:'JP',year:2026,source:'Fixture',externalIds:{steam:99999},synopsis:'Preview before adding',url:'https://example.com/game'}]}});});
 await page.goto(base+'/search');await page.getByRole('textbox',{name:'Search title',exact:true}).fill('Failure');await page.getByRole('alert').filter({hasText:'Search is unavailable'}).waitFor();
 await page.getByRole('textbox',{name:'Search title',exact:true}).fill('Fixture');await page.getByRole('button',{name:/Search fixture game/}).click();await page.getByRole('dialog').waitFor();await page.getByText('Preview before adding',{exact:true}).waitFor();await page.getByLabel('Destination list').selectOption('watch');await page.getByRole('dialog').getByRole('button',{name:'Add to library',exact:true}).click();
 await page.goto(base+'/list/watch');await page.getByRole('link',{name:'Search fixture game',exact:true}).waitFor();

 await page.goto(base+'/collections');const original=page.locator('article.list-card').filter({has:page.getByRole('link',{name:'My imported list',exact:true})});await original.getByRole('button',{name:'Duplicate',exact:true}).click();
 const copy=page.locator('article.list-card').filter({has:page.getByRole('link',{name:'My imported list (copy)',exact:true})});await copy.getByRole('button',{name:'Archive',exact:true}).click();assert.equal(await page.getByRole('link',{name:'My imported list (copy)',exact:true}).count(),0);await page.getByRole('button',{name:'Archived',exact:true}).click();await page.getByRole('link',{name:'My imported list (copy)',exact:true}).waitFor();await page.getByRole('button',{name:'Restore',exact:true}).click();await page.getByRole('button',{name:'Active',exact:true}).click();await page.getByRole('link',{name:'My imported list (copy)',exact:true}).click();await page.getByRole('button',{name:'Select all',exact:true}).click();await page.getByRole('button',{name:'Remove from this list',exact:true}).click();assert.equal(await page.getByRole('link',{name:'Alchemy of Souls',exact:true}).count(),0);
 await page.goto(base+'/list/watch');await page.getByRole('link',{name:'Alchemy of Souls',exact:true}).waitFor();await page.getByRole('link',{name:'Search fixture game',exact:true}).waitFor();
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/web-list-detail.png',fullPage:true});await page.goto(base+'/settings');await page.screenshot({path:'test-results/web-profile-settings.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('Web browser journeys passed: account creation, extension backup import, bounded progress, notes, real API sync, sign-out isolation, sign-in restoration, mobile game detail.');
}finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await fs.rm(temp,{recursive:true,force:true});}
