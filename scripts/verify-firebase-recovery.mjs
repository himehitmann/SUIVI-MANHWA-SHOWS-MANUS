import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {createFirebaseAuth} from "../shared/firebase-auth.ts";
import {createFirebaseLibrary} from "../shared/firebase-library.ts";

if(process.env.CI!=="true"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||
  process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099")throw Error("Isolated CI emulators required");
const project="demo-yomu-backup";
const report={project,checks:[],productionAccess:false};
const nativeFetch=globalThis.fetch;
// Never fall through to the network: both auth and storage must target loopback.
async function emulatorFetch(input,init){
  const url=new URL(input);
  let target;
  if(url.protocol!=="https:")throw Error("Unexpected test destination");
  if(url.hostname==="firestore.googleapis.com"){
    if(!url.pathname.startsWith("/v1/projects/"+project+"/"))throw Error("Unexpected project");
    target="http://127.0.0.1:8080"+url.pathname+url.search;
  }else if(["identitytoolkit.googleapis.com","securetoken.googleapis.com"].includes(url.hostname)){
    target="http://127.0.0.1:9099/"+url.hostname+url.pathname+url.search;
  }else throw Error("Unexpected test host");
  return nativeFetch(target,{...init,redirect:"error"});
}
const check=(name)=>{report.checks.push(name);console.log("PASS "+name);};
const auth=createFirebaseAuth({projectId:project,apiKey:"synthetic-emulator-api-key"},emulatorFetch);
const password="synthetic-test-password";
const a=await auth.signUp("a@example.test",password),b=await auth.signUp("b@example.test",password);
const base="projects/"+project+"/databases/(default)/documents";
const head=base+"/users/"+a.userId+"/library/head";
async function raw(name,token,method="GET",body){
  return emulatorFetch("https://firestore.googleapis.com/v1/"+name,{
    method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),
  });
}
const first=createFirebaseLibrary(a,emulatorFetch);
const original={items:[{id:"series",title:"Series",type:"watching",season:3,episode:7,updatedAt:1},
  {id:"webtoon",title:"Webtoon",type:"reading",chapter:42,updatedAt:1}],
  lists:[{id:"favorites",itemIds:["series","webtoon"],updatedAt:1}],
  sites:[{id:"reader",url:"https://reader.example",updatedAt:1}],
  profile:{name:"Reader",updatedAt:1},updatedAt:1};
const saved=await first.save(await first.read(),original);
const freshSession=await auth.signIn("a@example.test",password);
assert.equal(freshSession.userId,a.userId);
const fresh=createFirebaseLibrary(freshSession,emulatorFetch);
assert.deepEqual((await fresh.read()).blob.items,saved.blob.items);
check("fresh_login_restores_library");
const renewed=await auth.refresh(freshSession);
assert.equal(renewed.userId,a.userId);
assert.equal((await createFirebaseLibrary(renewed,emulatorFetch).read()).blob.items.length,2);
check("refreshed_session_restores_library");

assert.equal((await raw(head,b.token)).status,403);
assert.equal((await raw(head,null)).status,403);
const headDoc=await (await raw(head,a.token)).json();
const fields=headDoc.fields;
assert.equal((await raw(base+":commit",b.token,"POST",{writes:[{update:{name:head,fields}}]})).status,403);
assert.equal((await raw(base+"/users/"+a.userId+"/chunks",a.token)).status,403);
assert.equal((await raw(base+"/users/"+a.userId,a.token,"PATCH",{fields:{role:{stringValue:"admin"}}})).status,403);
assert.equal((await raw(head,a.token,"DELETE")).status,403);
check("cross_account_anonymous_listing_role_and_pointer_deletion_denied");

const currentId=fields.current.mapValue.fields.id.stringValue;
const currentChunk=base+"/users/"+a.userId+"/chunks/"+currentId+"-0";
assert.equal((await raw(currentChunk,a.token,"DELETE")).status,403);
assert.equal((await raw(currentChunk,a.token,"PATCH",{fields:{payload:{stringValue:"changed"}}})).status,403);
assert.equal((await raw(currentChunk,b.token)).status,403);
const invalidFields=structuredClone(fields);
invalidFields.current.mapValue.fields.chunks.integerValue="17";
assert.equal((await raw(head,a.token,"PATCH",{fields:invalidFields})).status,403);
check("immutable_chunks_and_manifest_bounds_enforced");

const left=await fresh.read(),other=createFirebaseLibrary(a,emulatorFetch),right=await other.read();
const newer=await fresh.save(left,{...original,items:[{...original.items[0],episode:8,updatedAt:2}],updatedAt:2});
await assert.rejects(()=>other.save(right,{...original,items:[{id:"extra",title:"Extra",updatedAt:3}],updatedAt:3}),/sync_conflict/);
assert.equal((await fresh.readPrevious(newer)).items.find(i=>i.id==="series").episode,7);
assert.equal((await other.read()).blob.items.find(i=>i.id==="series").episode,8);
check("concurrent_write_rejected_and_previous_version_readable");

// Exercise the maximum number of chunks, including retention cleanup in a single commit.
const large="界".repeat(1300000);
let largeSnapshot=await fresh.save(await fresh.read(),{items:[{id:"large",title:"Large",synopsis:large,updatedAt:4}],updatedAt:4});
largeSnapshot=await fresh.save(largeSnapshot,{items:[{id:"large",title:"Large",synopsis:large,updatedAt:5}],updatedAt:5});
largeSnapshot=await fresh.save(largeSnapshot,{items:[{id:"large",title:"Large",synopsis:large,updatedAt:6}],updatedAt:6});
const recovered=await createFirebaseLibrary(a,emulatorFetch).read();
assert.equal(recovered.blob.items.find(i=>i.id==="large").synopsis,large);
assert.equal((await fresh.readPrevious(largeSnapshot)).items.find(i=>i.id==="large").updatedAt,5);
check("sixteen_chunk_commit_and_retention_rules_pass");

await mkdir("test-results",{recursive:true});
await writeFile("test-results/firebase-recovery-report.json",JSON.stringify(report,null,2)+"\n");
