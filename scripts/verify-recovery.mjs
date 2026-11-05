/** Synthetic recovery drill: never accepts production hosts or databases. */
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import express from "express";
import pg from "pg";
import {ensureSchema,createPostgresStore} from "../server/lib/store-postgres.ts";
import {ensureAccessSchema,createPostgresAccessStore} from "../server/lib/access.ts";

assert.equal(process.env.CI,"true","Recovery drill is CI-only");
const url=new URL(process.env.RECOVERY_DATABASE_URL||"http://invalid");
assert(["localhost","127.0.0.1"].includes(url.hostname)&&url.pathname==="/yomu_recovery","Use the isolated recovery fixture only");
process.env.SYNC_JWT_SECRET=randomBytes(32).toString("hex");
const {createApiRouter}=await import("../server/api.ts");
const run=promisify(execFile),directory=await mkdtemp(path.join(tmpdir(),"yomu-recovery-"));
const admin=new pg.Pool({connectionString:url.toString(),max:2});
const names=["recovery_source_","recovery_target_"].map(prefix=>prefix+randomBytes(6).toString("hex"));
const created=[];let pool,server,base;
const report={kind:"Synthetic PostgreSQL backup/restore and fresh account login; not a production or browser reinstall certification",commit:process.env.GITHUB_SHA,checks:[]};
const password="synthetic-recovery-password",email="recovery@example.test";
const fixture={items:[{id:"series",title:"Series",type:"watching",season:3,episode:7,updatedAt:100},{id:"webtoon",title:"Webtoon",type:"reading",chapter:42,updatedAt:101},{id:"film",title:"Film",type:"watching",state:"completed",updatedAt:102}],lists:[{id:"favorites",name:"Favorites",itemIds:["series","webtoon"],updatedAt:103}],sites:[{id:"reader",url:"https://example.test",updatedAt:104}],profile:{name:"Recovery fixture",bio:"Personal library",updatedAt:105},tombstones:[{kind:"items",id:"removed-work",deletedAt:106}],updatedAt:106};
function dbUrl(name){const value=new URL(url);value.pathname="/"+name;return value.toString();}
async function stop(){
 if(server){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));server=null;}
 if(pool){await pool.end();pool=null;}
}
async function start(name){
 pool=new pg.Pool({connectionString:dbUrl(name),max:3});
 await ensureSchema(pool);await ensureAccessSchema(pool);
 const app=express();app.use("/api",createApiRouter(createPostgresStore(pool),createPostgresAccessStore(pool)));
 await new Promise(resolve=>{server=app.listen(0,"127.0.0.1",resolve);});
 base="http://127.0.0.1:"+server.address().port+"/api";
}
async function request(route,{token,body,method=body?"POST":"GET",status=200}={}){
 const response=await fetch(base+route,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,status,route+" status");return response.json();
}
async function restored(){
 const login=await request("/auth/login",{body:{email,password}});
 const result=await request("/sync",{token:login.token});
 for(const key of ["items","lists","sites","profile","tombstones"]){const canonical=value=>Array.isArray(value)?[...value].sort((a,b)=>a.id.localeCompare(b.id)):value;assert.deepEqual(canonical(result.blob[key]),canonical(fixture[key]),key+" restored");}
 await request("/auth/login",{body:{email,password:"wrong-password"},status:401});
 await request("/sync",{status:401});
 return login.token;
}
function pgEnv(database){return {...process.env,PGHOST:url.hostname,PGPORT:url.port||"5432",PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:database,PGSSLMODE:"disable"};}
try{
 for(const name of names){assert(/^recovery_(source|target)_[a-f0-9]{12}$/.test(name));await admin.query('CREATE DATABASE "'+name+'"');created.push(name);}
 await start(names[0]);
 const account=await request("/auth/signup",{body:{email,password}});
 await request("/sync",{token:account.token,method:"PUT",body:{blob:fixture}});
 // No browser cache or prior token is used for subsequent recovery.
 await stop();await start(names[0]);await restored();
 report.checks.push("Fresh login after API and connection-pool restart restores progress, lists, sites, profile and deletions");
 const other=await request("/auth/signup",{body:{email:"other@example.test",password}});
 assert.equal((await request("/sync",{token:other.token})).blob,null);
 report.checks.push("Another account and unauthenticated clients cannot retrieve this library");
 await stop();
 const archive=path.join(directory,"fixture.dump");
 await run("pg_dump",["--format=custom","--no-owner","--no-acl","--file",archive],{env:pgEnv(names[0]),timeout:60000});
 await run("pg_restore",["--exit-on-error","--no-owner","--no-acl","--dbname",names[1],archive],{env:pgEnv(names[1]),timeout:60000});
 // Remove the source database: all subsequent assertions rely on the restored copy.
 await admin.query('DROP DATABASE "'+names[0]+'"');created.splice(created.indexOf(names[0]),1);
 await start(names[1]);const freshToken=await restored();
 // An empty newly-installed client must not erase the server library.
 await request("/sync",{token:freshToken,method:"PUT",body:{blob:{items:[],updatedAt:200}}});
 await restored();
 report.checks.push("pg_dump/pg_restore into a separate database survives removal of the source");
 report.checks.push("An empty client sync preserves the remotely saved library");
 report.passed=true;
 await mkdir("test-results",{recursive:true});await writeFile("test-results/recovery-report.json",JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{
 await stop();
 for(const name of created)await admin.query('DROP DATABASE "'+name+'"');
 await admin.end();await rm(directory,{recursive:true,force:true});
}
