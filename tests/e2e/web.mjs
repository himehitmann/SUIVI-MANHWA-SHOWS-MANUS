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
 await page.goto(base+'/welcome');await page.locator('.land-sub').waitFor();
 const contrast=await page.evaluate(()=>{
  const lum=c=>{const v=c.match(/[0-9.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
  return ['.land-sub','.primary-cta'].map(selector=>{const el=document.querySelector(selector),fg=getComputedStyle(el).color;let node=el,bg='rgb(255, 255, 255)';while(node){const color=getComputedStyle(node).backgroundColor;if(!color.startsWith('rgba')&&color!=='transparent'){bg=color;break;}node=node.parentElement;}const a=lum(fg),b=lum(bg);return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
 });
 for(const sample of contrast)assert(sample.ratio>=4.5,JSON.stringify(sample));
 await page.locator('.primary-cta').first().focus();assert.equal(await page.locator('.primary-cta').first().evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
 assert.deepEqual(errors,[]);

 await page.locator('#guide').getByRole('button',{name:'4. Read in your language',exact:true}).click();
 await page.locator('#guide').getByRole('link',{name:'Explore the catalogue',exact:true}).waitFor();
 await page.locator('#guide').getByRole('button',{name:'Previous',exact:true}).click();
 await page.locator('#guide').getByRole('heading',{name:'Keep your place',exact:true}).waitFor();
 await page.setViewportSize({width:375,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'test-results/onboarding-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});

 // UI contract fixture; real authorization and transaction checks live in admin-api and PostgreSQL tests.
 let adminChanges=[];
 await page.route('**/api/admin/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop();
  if(name==='me')return route.fulfill({json:{user:{id:'owner-fixture',email:'owner@example.test',role:'owner',plan:'pro',giftUntil:0,accessVersion:0}}});
  if(name==='lookup')return route.fulfill({json:{user:{id:'reader-fixture',email:'reader@example.test',role:'member',plan:'free',giftUntil:0,accessVersion:0}}});
  if(name==='access'){adminChanges.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});}
  return route.fulfill({json:{events:[]}});
 });
 await page.goto(base+'/admin');await page.getByLabel('Exact email address',{exact:true}).fill('reader@example.test');await page.getByRole('button',{name:'Find account',exact:true}).click();await page.getByRole('heading',{name:'reader@example.test',exact:true}).waitFor();
 await page.getByLabel('Days (0 to remove)',{exact:true}).fill('14');await page.getByLabel('Reason for the audit log',{exact:true}).fill('Browser gift fixture');await page.getByLabel('Your current password',{exact:true}).fill('synthetic-fixture-password');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Review and confirm',exact:true}).click();assert.equal(adminChanges.length,0);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Review and confirm',exact:true}).click();await page.getByRole('status').filter({hasText:'Change saved'}).waitFor();assert.equal(adminChanges.length,1);assert.equal(adminChanges[0].days,14);assert.equal(adminChanges[0].targetId,'reader-fixture');assert.match(adminChanges[0].requestId,/^[0-9a-f-]{36}$/);
 await page.setViewportSize({width:375,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/admin-mobile.png',fullPage:true});assert.deepEqual(errors,[]);

 console.log('Web browser journeys passed: account creation, extension backup import, bounded progress, notes, real API sync, sign-out isolation, sign-in restoration, mobile game detail.');
}finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await fs.rm(temp,{recursive:true,force:true});}
