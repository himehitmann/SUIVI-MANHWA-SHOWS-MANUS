/** Isolated CI capacity probe. Never point this at a production database. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {cpus,totalmem} from 'node:os';
import express from 'express';
import pg from 'pg';
import {ensureSchema,createPostgresStore} from '../server/lib/store-postgres.ts';
import {hashPasswordAsync,signToken} from '../server/lib/crypto.ts';

const url=new URL(process.env.LOAD_DATABASE_URL||'http://invalid');
assert.equal(process.env.CI,'true','This probe is restricted to isolated CI fixtures.');
assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.pathname==='/yomu_load','Use the isolated loopback yomu_load database only.');
process.env.SYNC_JWT_SECRET=randomBytes(32).toString('hex');
const {createApiRouter}=await import('../server/api.ts');
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const destination=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(destination.hostname!=='127.0.0.1')throw Error('External traffic is forbidden during load tests');
 return nativeFetch(input,init);
};
const report={kind:'CI burst probe, not a production user-capacity claim',commit:process.env.GITHUB_SHA,node:process.version,cpu:cpus()[0]?.model,cpuCount:cpus().length,hostMemoryMiB:Math.round(totalmem()/1048576),database:'PostgreSQL 16, pool max 10, loopback',clientAndApiShareProcess:true,results:[]};
const watchdog=setTimeout(()=>{console.error('Load probe exceeded five minutes');process.exit(1);},300000);
const admin=new pg.Pool({connectionString:url.toString(),max:2,connectionTimeoutMillis:5000});
const password='synthetic-capacity-password',passwordHash=await hashPasswordAsync(password);
const poolConfig={connectionString:url.toString(),max:10,connectionTimeoutMillis:5000,statement_timeout:10000,query_timeout:12000};
let pool,server;
let sampleNumber=0;
async function measure(name,concurrency,count,request,paceMs=0) {
 const lag=monitorEventLoopDelay({resolution:10});lag.enable();
 let peakRss=process.memoryUsage().rss;
 const sampler=setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage().rss);},20);
 const start=performance.now(),latencies=[],codes={};let next=0,failures=0;
 try {
  await Promise.all(Array.from({length:concurrency},async()=>{
   for(;;){const i=next++;if(i>=count)return;const t=performance.now();
    try{const status=await request(i);codes[status]=(codes[status]||0)+1;if(status<200||status>=300)failures++;}
    catch(error){codes.error=(codes.error||0)+1;throw error;}
    finally{latencies.push(performance.now()-t);}
    if(paceMs)await new Promise(resolve=>setTimeout(resolve,Math.max(0,paceMs-(performance.now()-t))));
   }
  }));
 } finally {clearInterval(sampler);lag.disable();}
 peakRss=Math.max(peakRss,process.memoryUsage().rss);latencies.sort((a,b)=>a-b);
 const elapsedMs=performance.now()-start,percentile=p=>Math.round(latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*p)-1)]||0);
 const result={name,concurrency,requests:count,elapsedMs:Math.round(elapsedMs),p50Ms:percentile(.5),p95Ms:percentile(.95),usefulPerSecond:Number(((count-failures)*1000/elapsedMs).toFixed(1)),codes,peakProcessRssMiB:Math.round(peakRss/1048576),eventLoopMaxMs:Math.round(lag.max/1e6)};
 report.results.push(result);console.log(JSON.stringify(result));
 assert(peakRss<1536*1048576,'Process memory exceeded 1.5 GiB safety budget');
 return result;
}
try {
 for(const scenario of [{total:100,accounts:10},{total:10000,accounts:100},{total:100000,accounts:200}]) {
  const schema='load_'+randomBytes(8).toString('hex');await admin.query('CREATE SCHEMA '+schema);
  pool=new pg.Pool({...poolConfig,options:'-c search_path='+schema});await ensureSchema(pool);
  const store=createPostgresStore(pool),itemsPerAccount=scenario.total/scenario.accounts;
  const tokens=[],accountIds=[];
  for(let a=0;a<scenario.accounts;a++) {
   const id='account-'+a;accountIds.push(id);
   await store.createUser({id,email:id+'@example.test',passwordHash,plan:'free',createdAt:1});
   await store.createSession({id:'session-'+a,userId:id,createdAt:1,expiresAt:Date.now()+3600000});
   tokens.push(signToken({sub:id,jti:'session-'+a},process.env.SYNC_JWT_SECRET));
   const blob={items:Array.from({length:itemsPerAccount},(_,i)=>({id:id+'-work-'+i,title:'Synthetic work '+i,type:'reading',synopsis:'Synthetic metadata '.repeat(10),chapter:i%100,updatedAt:1})),updatedAt:1};
   await store.setSync(id,{blob,updatedAt:1});
  }
  const volume=await pool.query("SELECT sum(jsonb_array_length(blob->'items'))::int AS items, sum(pg_column_size(blob))::bigint AS stored_bytes FROM sync");
  assert.equal(volume.rows[0].items,scenario.total);
  const app=express();app.set('trust proxy','loopback');app.get('/healthz',(_req,res)=>res.json({ok:true}));app.use('/api',createApiRouter(store));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});
  const base='http://127.0.0.1:'+server.address().port;
  const headers=(a)=>({'Content-Type':'application/json',Authorization:'Bearer '+tokens[a], 'X-Forwarded-For':'192.0.2.'+(a+1)});
  const get=async(a)=>{const r=await fetch(base+'/api/sync',{headers:headers(a),signal:AbortSignal.timeout(15000)});const body=await r.json();assert.equal(r.status,200);assert.equal(body.blob.items.length,itemsPerAccount);assert(body.blob.items.every(item=>item.id.startsWith(accountIds[a]+'-work-')));return r.status;};
  await get(0);
  report.results.push({name:'seed',...scenario,itemsPerAccount,storedBytes:Number(volume.rows[0].stored_bytes),sampleResponseBytes:Buffer.byteLength(JSON.stringify(await (await fetch(base+'/api/sync',{headers:headers(0)})).json()))});
  for(const concurrency of [10,50,200]) {
   const result=await measure('sync-read-'+scenario.total,concurrency,concurrency*3,i=>get(i%scenario.accounts));
   assert(result.p95Ms<5000,'Read p95 exceeded the CI regression budget of 5 seconds');
  }
  if(scenario.total===100000)await measure("sync-steady-200-clients-30-rounds",200,6000,i=>get(i%scenario.accounts),1000);
  const writeCount=20;
  await measure('same-account-concurrent-write-'+scenario.total,writeCount,writeCount,async(i)=>{
   const r=await fetch(base+'/api/sync',{method:'PUT',headers:headers(0),signal:AbortSignal.timeout(15000),body:JSON.stringify({blob:{items:[{id:'acknowledged-'+i,title:'Concurrent update '+i,updatedAt:100+i}],updatedAt:100+i}})});await r.json();assert.equal(r.status,200);return r.status;
  });
  // Replace the pool to verify writes independently of the original connections.
  const reader=new pg.Pool({...poolConfig,options:'-c search_path='+schema});
  try {const saved=await createPostgresStore(reader).getSync(accountIds[0]);assert.equal(saved.blob.items.length,itemsPerAccount+writeCount);for(let i=0;i<writeCount;i++)assert(saved.blob.items.some(item=>item.id==='acknowledged-'+i));}
  finally {await reader.end();}
  if(scenario.total===100000) {
   await measure('auth-burst-with-bounded-backpressure',50,50,async(i)=>{
    const r=await fetch(base+'/api/auth/login',{method:'POST',headers:headers(i),signal:AbortSignal.timeout(15000),body:JSON.stringify({email:accountIds[i]+'@example.test',password})});
    const body=await r.json();assert([200,503].includes(r.status));if(r.status===503)assert.equal(body.error,'auth_busy');else assert(body.token);return r.status;
   });
   const oversized=await fetch(base+'/api/sync',{method:'PUT',headers:headers(0),body:JSON.stringify({blob:{items:[],learn:'x'.repeat(2100000)}}),signal:AbortSignal.timeout(15000)});await oversized.text();assert.equal(oversized.status,413);
   const tooMany=await fetch(base+'/api/sync',{method:'PUT',headers:headers(0),body:JSON.stringify({blob:{items:Array.from({length:20001},(_,i)=>({id:'limit-'+i}))}}),signal:AbortSignal.timeout(15000)});await tooMany.text();assert.equal(tooMany.status,400);
   const healthy=await fetch(base+'/healthz');assert.equal(healthy.status,200);await healthy.json();
   report.results.push({name:'request-guardrails',oversized:413,over20000Records:400,healthAfterOverload:200});
  }
  await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));server=null;await pool.end();pool=null;sampleNumber++;
 }
 report.completedScenarios=sampleNumber;
} catch(error) {report.failure=String(error);process.exitCode=1;}
finally {
 clearTimeout(watchdog);
 if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();await admin.end();
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/load-report.json',JSON.stringify(report,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,"## Yomu isolated capacity probe\n\n"+report.kind+"\n\n```json\n"+JSON.stringify(report,null,2)+"\n```\n");
 if(report.failure)console.error(report.failure);
}

