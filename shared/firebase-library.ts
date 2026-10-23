import type {FirebaseSession} from "./firebase-auth";
import {collections,mergeBlobs,type SyncBlob} from "./sync-core";

// Two application-level versions, not a provider-managed or independent backup.
const CHUNK_BYTES=256*1024;
export const FIREBASE_LIBRARY_MAX_BYTES=4*1024*1024;
const MAX_CHUNKS=FIREBASE_LIBRARY_MAX_BYTES/CHUNK_BYTES;
type Descriptor={id:string;chunks:number;bytes:number;hash:string};
type Head={current:Descriptor;previous:Descriptor|null;updateTime:string};
type Value={stringValue?:string;integerValue?:string;mapValue?:{fields:Record<string,Value>};nullValue?:null};
type Document={name?:string;fields?:Record<string,Value>;updateTime?:string};
export type LibrarySnapshot=Readonly<{blob:SyncBlob|null;previousAvailable:boolean}>;
export class FirebaseLibraryError extends Error {
  constructor(public readonly code:string){super(code);this.name="FirebaseLibraryError";}
}
function fail(code:string):never{throw new FirebaseLibraryError(code);}
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>
  v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])):v);
const timestamp=(value:unknown):value is string=>typeof value==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value);
async function digest(bytes:Uint8Array){
  const result=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(result),n=>n.toString(16).padStart(2,"0")).join("");
}
function base64(bytes:Uint8Array){
  let result="";
  for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(result);
}
function descriptorFields(d:Descriptor):Value {
  return {mapValue:{fields:{id:{stringValue:d.id},chunks:{integerValue:String(d.chunks)},bytes:{integerValue:String(d.bytes)},hash:{stringValue:d.hash}}}};
}
function descriptor(value:Value|undefined):Descriptor {
  const fields=value?.mapValue?.fields;
  const id=fields?.id?.stringValue,hash=fields?.hash?.stringValue;
  const chunks=Number(fields?.chunks?.integerValue),bytes=Number(fields?.bytes?.integerValue);
  if(typeof id!=="string"||!/^v-[a-f0-9-]{36}$/.test(id)||typeof hash!=="string"||!/^([a-f0-9]{64})$/.test(hash)||
     !Number.isInteger(chunks)||chunks<1||chunks>MAX_CHUNKS||!Number.isInteger(bytes)||bytes<1||
     bytes>FIREBASE_LIBRARY_MAX_BYTES||Math.ceil(bytes/CHUNK_BYTES)!==chunks)fail("invalid_library_manifest");
  return {id,chunks,bytes,hash};
}
function cleanBlob(value:unknown):SyncBlob {
  if(!value||typeof value!=="object"||Array.isArray(value))fail("invalid_library");
  const input=value as Record<string,unknown>,result:Record<string,unknown>={};
  for(const key of collections){
    const rows=input[key]??[];
    if(!Array.isArray(rows)||rows.length>20000||rows.some(row=>!row||typeof row!=="object"||Array.isArray(row)||typeof row.id!=="string"||!row.id||row.id.length>500))fail("invalid_library");
    result[key]=rows;
  }
  const tombstones=input.tombstones??[];
  if(!Array.isArray(tombstones)||tombstones.length>100000||tombstones.some(d=>!d||!collections.includes(d.kind)||typeof d.id!=="string"||!d.id||!Number.isFinite(d.deletedAt)||d.deletedAt<0))fail("invalid_library");
  result.tombstones=tombstones;
  result.updatedAt=typeof input.updatedAt==="number"&&Number.isFinite(input.updatedAt)&&input.updatedAt>=0?input.updatedAt:0;
  if(input.profile!==undefined){
    if(!input.profile||typeof input.profile!=="object"||Array.isArray(input.profile))fail("invalid_library");
    const profile=input.profile as Record<string,unknown>,safe:Record<string,unknown>={};
    for(const key of ["name","bio","avatar","banner"]){if(profile[key]!==undefined){if(typeof profile[key]!=="string")fail("invalid_library");safe[key]=profile[key];}}
    if(profile.updatedAt!==undefined){if(typeof profile.updatedAt!=="number"||!Number.isFinite(profile.updatedAt)||profile.updatedAt<0)fail("invalid_library");safe.updatedAt=profile.updatedAt;}
    result.profile=safe;
  }
  // Deliberately exclude settings, service keys, plan and role fields.
  return result as unknown as SyncBlob;
}

/** Fixed account scope; recreate after token refresh, then read again before saving. */
export function createFirebaseLibrary(input:FirebaseSession,fetcher:typeof fetch=globalThis.fetch,now:()=>number=Date.now){
  const session={...input};
  if(session.provider!=="firebase"||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(session.projectId)||
     !/^[A-Za-z0-9_-]{1,128}$/.test(session.userId)||typeof session.token!=="string"||!session.token)fail("invalid_library_session");
  const root="projects/"+session.projectId+"/databases/(default)/documents";
  const scope=root+"/users/"+session.userId;
  const headName=scope+"/library/head";
  const chunkName=(d:Descriptor,index:number)=>scope+"/chunks/"+d.id+"-"+index;
  // Receipts cannot be forged, reused across accounts, or changed by editing the returned blob.
  const receipts=new WeakMap<LibrarySnapshot,{head:Head|null;blob:SyncBlob|null}>();
  function receipt(blob:SyncBlob|null,head:Head|null):LibrarySnapshot{
    const snapshot=Object.freeze({blob:structuredClone(blob),previousAvailable:Boolean(head?.previous)});
    receipts.set(snapshot,{head,blob:structuredClone(blob)});
    return snapshot;
  }
  async function request(name:string,method="GET",body?:unknown,missing=false):Promise<any>{
    if(!Number.isFinite(session.expiresAt)||session.expiresAt<=now())fail("session_expired");
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetcher("https://firestore.googleapis.com/v1/"+name,{
        method,headers:{"Authorization":"Bearer "+session.token,"Content-Type":"application/json"},
        ...(body===undefined?{}:{body:JSON.stringify(body)}),credentials:"omit",redirect:"error",cache:"no-store",signal:controller.signal,
      });
      if(response.status===404&&missing)return null;
      if(!response.ok){
        const codes:Record<number,string>={401:"session_expired",403:"access_denied",404:"snapshot_missing",409:"sync_conflict",412:"sync_conflict",429:"quota_exceeded"};
        if(response.status===400){const error=await response.json().catch(()=>null);if(error?.error?.status==="FAILED_PRECONDITION")fail("sync_conflict");}
        fail(codes[response.status]||(response.status>=500?"service_unavailable":"storage_request_failed"));
      }
      const data=await response.json();
      if(!data||typeof data!=="object"||Array.isArray(data))fail("invalid_storage_response");
      return data;
    }catch(error){
      if(error instanceof FirebaseLibraryError)throw error;
      return fail(controller.signal.aborted?"request_timeout":"network_error");
    }finally{clearTimeout(timer);}
  }
  async function readVersion(d:Descriptor):Promise<SyncBlob>{
    const bytes=new Uint8Array(d.bytes);
    // Four requests at a time; no unbounded fan-out for large imports.
    for(let start=0;start<d.chunks;start+=4){
      await Promise.all(Array.from({length:Math.min(4,d.chunks-start)},async(_,offset)=>{
        const index=start+offset,name=chunkName(d,index),doc:Document=await request(name);
        const value=doc.fields?.payload?.stringValue;
        if(doc.name!==name||typeof value!=="string"||value.length>Math.ceil(CHUNK_BYTES/3)*4)fail("invalid_library_chunk");
        let decoded:string;try{decoded=atob(value);}catch{return fail("invalid_library_chunk");}
        const expected=Math.min(CHUNK_BYTES,d.bytes-index*CHUNK_BYTES);
        if(decoded.length!==expected)fail("invalid_library_chunk");
        for(let i=0;i<decoded.length;i++)bytes[index*CHUNK_BYTES+i]=decoded.charCodeAt(i);
      }));
    }
    if(await digest(bytes)!==d.hash)fail("library_integrity_failed");
    let decoded:unknown;try{decoded=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}catch{return fail("invalid_library");}
    return cleanBlob(decoded);
  }
  return {
    async read():Promise<LibrarySnapshot>{
      const doc:Document|null=await request(headName,"GET",undefined,true);
      if(!doc)return receipt(null,null);
      if(doc.name!==headName||doc.fields?.schema?.integerValue!=="1"||!timestamp(doc.updateTime))fail("invalid_library_manifest");
      const current=descriptor(doc.fields?.current);
      const previous=doc.fields?.previous?.nullValue===null?null:descriptor(doc.fields?.previous);
      if(previous?.id===current.id)fail("invalid_library_manifest");
      return receipt(await readVersion(current),{current,previous,updateTime:doc.updateTime});
    },
    async readPrevious(snapshot:LibrarySnapshot):Promise<SyncBlob|null>{
      const stored=receipts.get(snapshot);if(!stored)fail("invalid_snapshot_receipt");
      return stored.head?.previous?readVersion(stored.head.previous):null;
    },
    async save(snapshot:LibrarySnapshot,incoming:SyncBlob):Promise<LibrarySnapshot>{
      const stored=receipts.get(snapshot);if(!stored)fail("invalid_snapshot_receipt");
      const merged=cleanBlob(mergeBlobs(stored.blob,cleanBlob(incoming)));
      const bytes=new TextEncoder().encode(canonical(merged));
      if(bytes.length>FIREBASE_LIBRARY_MAX_BYTES)fail("library_too_large");
      const hash=await digest(bytes);
      // Confirmation is from the prior read, not proof that no other device has since changed it.
      if(stored.head?.current.hash===hash){
        const latest:Document=await request(headName);
        if(latest.updateTime!==stored.head.updateTime)fail("sync_conflict");
        return receipt(merged,stored.head);
      }
      const current:Descriptor={id:"v-"+crypto.randomUUID(),chunks:Math.ceil(bytes.length/CHUNK_BYTES),bytes:bytes.length,hash};
      const writes:Record<string,unknown>[]=[];
      for(let i=0;i<current.chunks;i++)writes.push({update:{name:chunkName(current,i),fields:{
        payload:{stringValue:base64(bytes.subarray(i*CHUNK_BYTES,(i+1)*CHUNK_BYTES))},
      }},currentDocument:{exists:false}});
      const headIndex=writes.length;
      writes.push({update:{name:headName,fields:{schema:{integerValue:"1"},current:descriptorFields(current),
        previous:stored.head?descriptorFields(stored.head.current):{nullValue:null}}},
        currentDocument:stored.head?{updateTime:stored.head.updateTime}:{exists:false}});
      // Retain current + previous only, atomically with the pointer change.
      if(stored.head?.previous)for(let i=0;i<stored.head.previous.chunks;i++)writes.push({delete:chunkName(stored.head.previous,i)});
      let result;
      try {result=await request(root+":commit","POST",{writes});}
      catch(error){
        // Rules can reject a stale previous-version pointer before Firestore
        // evaluates updateTime. Only classify it as conflict after an authorized reread.
        if(error instanceof FirebaseLibraryError&&error.code==="access_denied"){
          let latest:Document|null;
          try{latest=await request(headName,"GET",undefined,true);}catch{throw error;}
          if((latest===null&&stored.head!==null)||(latest?.name===headName&&timestamp(latest.updateTime)&&latest.updateTime!==stored.head?.updateTime))fail("sync_conflict");
        }
        throw error;
      }
      const updateTime=result.writeResults?.[headIndex]?.updateTime;
      if(!timestamp(updateTime)||!timestamp(result.commitTime))fail("commit_not_confirmed");
      return receipt(merged,{current,previous:stored.head?.current||null,updateTime});
    },
  };
}
