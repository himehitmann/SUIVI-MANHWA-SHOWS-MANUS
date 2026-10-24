import {describe,it,expect,vi} from "vitest";
import {createFirebaseLibrary,FIREBASE_LIBRARY_MAX_BYTES} from "../shared/firebase-library";
import type {FirebaseSession} from "../shared/firebase-auth";
import type {SyncBlob} from "../shared/sync-core";
const now=()=>1_800_000_000_000;
const session:FirebaseSession={provider:"firebase",projectId:"yomu-test-project",userId:"user-a",email:"reader@example.com",token:"synthetic-token",refreshToken:"synthetic-refresh",expiresAt:now()+3600000};
const blob=(chapter=1,more:Record<string,unknown>={}):SyncBlob=>({items:[{id:"book",type:"reading",title:"Livre 日本語",chapter,updatedAt:chapter}],updatedAt:chapter,...more});
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
function provider(){
  const docs=new Map<string,any>();let revision=0,rejectCommit=0;
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async(url,init)=>{
    const name=String(url).replace("https://firestore.googleapis.com/v1/","");
    if(init?.method!=="POST")return docs.has(name)?response(structuredClone(docs.get(name))):response({error:{status:"NOT_FOUND"}},404);
    if(rejectCommit)return response({error:{status:"RESOURCE_EXHAUSTED"}},rejectCommit);
    const writes=JSON.parse(String(init.body)).writes;
    // Check every precondition before applying any write, like atomic commit.
    for(const w of writes){
      const key=w.update?.name||w.delete,current=docs.get(key),condition=w.currentDocument;
      if(condition?.exists===false&&current)return response({error:{status:"ALREADY_EXISTS"}},409);
      if(condition?.updateTime&&condition.updateTime!==current?.updateTime)return response({error:{status:"FAILED_PRECONDITION"}},400);
    }
    const updateTime="2026-10-22T10:00:00."+String(++revision).padStart(9,"0")+"Z";
    for(const w of writes){if(w.delete)docs.delete(w.delete);else docs.set(w.update.name,{...structuredClone(w.update),updateTime});}
    return response({commitTime:updateTime,writeResults:writes.map(()=>({updateTime}))});
  });
  return {docs,fetcher,block:(status:number)=>{rejectCommit=status;},client:()=>createFirebaseLibrary(session,fetcher,now)};
}
describe("Firebase library transport with atomic provider simulation",()=>{
  it("recovers works, progress, lists, profile and tombstones in a fresh client",async()=>{
    const p=provider(),first=p.client();
    const initial=await first.read();expect(initial.blob).toBeNull();
    const data=blob(7,{lists:[{id:"favorites",itemIds:["book"],updatedAt:7}],sites:[{id:"site",url:"https://reader.example",updatedAt:7}],profile:{name:"Reader",updatedAt:7},tombstones:[{kind:"items",id:"removed",deletedAt:3}]});
    await first.save(initial,data);
    const restored=await p.client().read();
    expect(restored.blob).toMatchObject(data);
    expect(restored.previousAvailable).toBe(false);
    for(const [url,init] of p.fetcher.mock.calls){
      expect(String(url)).toMatch(/^https:\/\/firestore.googleapis.com\/v1\/projects\/yomu-test-project\//);
      expect(String(url)).not.toContain(session.token);
      expect(init).toMatchObject({credentials:"omit",redirect:"error",headers:{"Authorization":"Bearer "+session.token}});
    }
  });
  it("round-trips a Unicode library larger than a Firestore document",async()=>{
    const p=provider(),client=p.client(),description="物語🌸".repeat(120000);
    const saved=await client.save(await client.read(),blob(2,{items:[{id:"large",title:"長い物語",synopsis:description,updatedAt:2}]}));
    expect(saved.blob?.items[0].synopsis).toBe(description);
    expect(p.docs.size).toBeGreaterThan(5);
    for(const doc of p.docs.values())expect(Buffer.byteLength(JSON.stringify(doc))).toBeLessThan(1024*1024);
    expect((await p.client().read()).blob?.items[0].synopsis).toBe(description);
  });
  it("rejects a stale writer and preserves the other device's saved progress",async()=>{
    const p=provider(),a=p.client(),b=p.client();
    const left=await a.read(),right=await b.read();
    await a.save(left,blob(7));
    const before=structuredClone([...p.docs]);
    await expect(b.save(right,blob(3))).rejects.toThrow("sync_conflict");
    expect([...p.docs]).toEqual(before); // no orphan chunks on conflict
    const fresh=await b.read();
    const updated=await b.save(fresh,{items:[{id:"second",title:"Second",updatedAt:8}],updatedAt:8});
    expect(updated.blob?.items.map(x=>x.id)).toEqual(["book","second"]);
    expect(updated.blob?.items.find(x=>x.id==="book")?.chapter).toBe(7);
  });
  it("preserves the latest data when a newly installed client submits an empty library",async()=>{
    const p=provider(),client=p.client();await client.save(await client.read(),blob(7));
    const reinstalled=p.client();await reinstalled.save(await reinstalled.read(),{items:[],updatedAt:0});
    expect((await p.client().read()).blob?.items[0].chapter).toBe(7);
  });
  it("retains exactly two versions and can read the previous one",async()=>{
    const p=provider(),client=p.client();
    let current=await client.save(await client.read(),blob(1));
    current=await client.save(current,blob(2));
    current=await client.save(current,blob(3));
    expect(current.previousAvailable).toBe(true);
    expect((await client.readPrevious(current))?.items[0].chapter).toBe(2);
    expect((await p.client().read()).blob?.items[0].chapter).toBe(3);
    expect(p.docs.size).toBe(3); // head + one chunk per retained version
  });
  it("does not write unchanged data and still checks for a newer remote version",async()=>{
    const p=provider(),client=p.client();
    const saved=await client.save(await client.read(),blob(1));
    const commits=()=>p.fetcher.mock.calls.filter(([,init])=>init?.method==="POST").length;
    const before=commits();await client.save(saved,blob(1));expect(commits()).toBe(before);
    const other=p.client();await other.save(await other.read(),blob(2));
    await expect(client.save(saved,blob(1))).rejects.toThrow("sync_conflict");
  });
  it("never erases a previous version when quota blocks the new commit",async()=>{
    const p=provider(),client=p.client(),saved=await client.save(await client.read(),blob(2));
    const before=structuredClone([...p.docs]);p.block(429);
    await expect(client.save(saved,blob(3))).rejects.toThrow("quota_exceeded");
    expect([...p.docs]).toEqual(before);
    expect((await p.client().read()).blob?.items[0].chapter).toBe(2);
  });
  it("rejects oversized libraries without silently truncating or sending a commit",async()=>{
    const p=provider(),client=p.client(),initial=await client.read();
    await expect(client.save(initial,blob(1,{items:[{id:"huge",synopsis:"x".repeat(FIREBASE_LIBRARY_MAX_BYTES)}]}))).rejects.toThrow("library_too_large");
    expect(p.fetcher.mock.calls.filter(([,init])=>init?.method==="POST")).toHaveLength(0);
    expect(p.docs.size).toBe(0);
  });
  it("refuses corrupted chunks rather than importing a partial library",async()=>{
    const p=provider(),client=p.client();await client.save(await client.read(),blob(2));
    const chunk=[...p.docs.values()].find(doc=>doc.fields.payload);
    const text=Buffer.from(chunk.fields.payload.stringValue,"base64");
    text[0]=text[0]===123?91:123;chunk.fields.payload.stringValue=text.toString("base64");
    await expect(p.client().read()).rejects.toThrow("library_integrity_failed");
  });
  it("rejects missing chunks and malformed manifests without writing anything",async()=>{
    const p=provider(),client=p.client();await client.save(await client.read(),blob(2));
    const chunk=[...p.docs.keys()].find(name=>name.includes("/chunks/"))!;p.docs.delete(chunk);
    await expect(p.client().read()).rejects.toThrow("snapshot_missing");
    const head=[...p.docs.values()][0];head.fields.current.mapValue.fields.chunks.integerValue="900000";
    await expect(p.client().read()).rejects.toThrow("invalid_library_manifest");
  });
  it("does not treat denied access as a new empty account",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response({error:{status:"PERMISSION_DENIED"}},403));
    await expect(createFirebaseLibrary(session,fetcher,now).read()).rejects.toThrow("access_denied");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rejects foreign or fabricated write receipts and expired sessions",async()=>{
    const p=provider(),a=p.client(),b=p.client(),receipt=await a.read();
    await expect(b.save(receipt,blob())).rejects.toThrow("invalid_snapshot_receipt");
    await expect(a.save({blob:null,previousAvailable:false},blob())).rejects.toThrow("invalid_snapshot_receipt");
    const expired=createFirebaseLibrary({...session,expiresAt:now()-1},p.fetcher,now);
    await expect(expired.read()).rejects.toThrow("session_expired");
    expect(()=>createFirebaseLibrary({...session,userId:"../other"},p.fetcher,now)).toThrow("invalid_library_session");
  });
  it("excludes account privileges and technical settings from stored snapshots",async()=>{
    const p=provider(),client=p.client();
    await client.save(await client.read(),blob(1,{settings:{ocrKey:"local-secret"},plan:"admin",role:"owner",profile:{name:"Reader",apiKey:"private-profile-key"}}));
    const restored=await p.client().read(),serialized=JSON.stringify(restored.blob);
    expect(serialized).not.toContain("local-secret");expect(serialized).not.toContain("private-profile-key");
    expect(restored.blob).not.toHaveProperty("plan");expect(restored.blob).not.toHaveProperty("role");
    expect(restored.blob?.profile?.name).toBe("Reader");
  });
  it("keeps deletions effective when an older device submits a removed work",async()=>{
    const p=provider(),client=p.client();
    const first=await client.save(await client.read(),blob(1));
    const deleted=await client.save(first,{items:[],tombstones:[{kind:"items",id:"book",deletedAt:10}],updatedAt:10});
    const stale=await client.save(deleted,blob(1));
    expect(stale.blob?.items).toEqual([]);
  });
});

describe("Firebase permission failures during concurrent writes",()=>{
  it("reports a conflict only when an authorized reread proves the head changed",async()=>{
    const p=provider(),client=p.client(),old=await client.save(await client.read(),blob(1));
    const other=p.client();await other.save(await other.read(),blob(2));
    p.block(403);
    await expect(client.save(old,blob(3))).rejects.toThrow("sync_conflict");
    expect((await other.read()).blob?.items[0].chapter).toBe(2);
  });
  it("keeps a genuine permission denial when the head did not change",async()=>{
    const p=provider(),client=p.client(),old=await client.save(await client.read(),blob(1));
    p.block(403);
    await expect(client.save(old,blob(2))).rejects.toThrow("access_denied");
    expect((await client.read()).blob?.items[0].chapter).toBe(1);
  });
});
