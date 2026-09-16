// Conservative source/history scan. Reports locations only, never credentials.
import assert from "node:assert/strict";
import {execFileSync,spawn} from "node:child_process";
import {lstatSync,readFileSync,openSync,readSync,closeSync} from "node:fs";
const LIMIT=2*1024**2, HEAD=8192, BATCH=8*1024**2;
const rules=[
 ["PEM private key",/-----BEGIN ((?:(?:RSA|EC|DSA|OPENSSH|ENCRYPTED) )?PRIVATE KEY)-----\r?\n(?:[A-Za-z0-9+/=]{1,128}\r?\n){2,}-----END \1-----/],
 ["GitHub classic PAT",/(?<![A-Za-z0-9_])ghp_[A-Za-z0-9]{36}(?![A-Za-z0-9_])/],
 ["GitHub fine-grained PAT",/(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}(?![A-Za-z0-9_])/],
 ["Stripe live key",/(?<![A-Za-z0-9_])(?:sk|rk)_live_[A-Za-z0-9]{24,200}(?![A-Za-z0-9_])/],
 ["AWS access key ID",/(?<![A-Za-z0-9_])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9_])/],
 ["OpenAI project key",/(?<![A-Za-z0-9_-])sk-proj-[A-Za-z0-9_-]{80,256}(?![A-Za-z0-9_-])/],
];
const detect=text=>rules.filter(([,pattern])=>pattern.test(text)).map(([type])=>type);
function selfTest(){
 const samples=[
  ["PEM private key",["-----BEGIN ","PRIVATE KEY-----"].join("")+"\n"+"A".repeat(64)+"\n"+"B".repeat(64)+"\n"+["-----END ","PRIVATE KEY-----"].join("")],
  ["GitHub classic PAT",["gh","p_"].join("")+"aB1".repeat(12)],
  ["GitHub fine-grained PAT",["github","pat",""].join("_")+"a".repeat(22)+"_"+"b".repeat(59)],
  ["Stripe live key",["sk","live",""].join("_")+"aB1".repeat(8)],
  ["AWS access key ID",["AK","IA"].join("")+"A1".repeat(8)],
  ["OpenAI project key",["sk","proj",""].join("-")+"aB1_".repeat(24)],
 ];
 for(const [type,value] of samples)assert.deepEqual(detect(value),[type]);
 assert.deepEqual(detect("ordinary text and short placeholders"),[]);
 assert.deepEqual(detect(readFileSync(new URL(import.meta.url),"utf8")),[]);
}
const git=(args,input,maxBuffer=64*1024**2)=>execFileSync("git",args,{input,maxBuffer,windowsHide:true,stdio:["pipe","pipe","pipe"]});
const stats={worktree:{text:0,binary:0,large:0},history:{text:0,binary:0,large:0}};
let findings=0;
function binaryHead(head){
 const hex=head.subarray(0,4).toString("hex"),ascii=head.subarray(0,12).toString("latin1");
 if(/^(fffe|feff|0000feff)/.test(hex))return false;
 return head.includes(0)||/^(89504e47|ffd8ff|504b0304|504b0506|504b0708|1f8b)/.test(hex)||/^GIF8[79]a/.test(ascii)||(ascii.startsWith("RIFF")&&ascii.slice(8,12)==="WEBP");
}
function inspect(bytes,scope){
 if(binaryHead(bytes.subarray(0,HEAD))){stats[scope].binary++;return [];}
 let value;try{value=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{stats[scope].large++;return [];}
 stats[scope].text++;return detect(value);
}
function report(types,location){
 const safe=rules.reduce((s,[,re])=>s.replace(new RegExp(re.source,"g"),"[REDACTED]"),location);
 for(const type of types){console.error(JSON.stringify({type,location:safe}));findings++;}
}
function fileHead(file){const fd=openSync(file,"r");try{const buf=Buffer.alloc(HEAD);return buf.subarray(0,readSync(fd,buf,0,HEAD,0));}finally{closeSync(fd);}}
function blobHead(id){return new Promise((resolve,reject)=>{
 const child=spawn("git",["cat-file","blob",id],{windowsHide:true,stdio:["ignore","pipe","ignore"]});
 const chunks=[];let length=0,interrupted=false;
 const timer=setTimeout(()=>{child.kill();reject(Error("timeout"));},30000);
 child.once("error",()=>{clearTimeout(timer);reject(Error("read_failed"));});
 child.stdout.on("data",chunk=>{if(length===HEAD)return;const part=Buffer.from(chunk.subarray(0,HEAD-length));chunks.push(part);length+=part.length;if(length===HEAD)interrupted=child.kill();});
 child.once("close",code=>{clearTimeout(timer);if(length!==HEAD||(!interrupted&&code!==0))reject(Error("incomplete"));else resolve(Buffer.concat(chunks,length));});
});}
async function history(){
 const ids=[...new Set(git(["rev-list","--objects","--all","--no-object-names"]).toString("utf8").trim().split(/\s+/).filter(Boolean))];
 if(!ids.length)return;
 const rows=git(["cat-file","--batch-check=%(objectname) %(objecttype) %(objectsize)"],ids.join("\n")+"\n").toString("utf8").trim().split("\n"),blobs=[];
 for(const row of rows){
  const [id,type,sizeText]=row.trim().split(" ");if(type==="missing")throw Error("missing_object");if(type!=="blob")continue;
  const size=Number(sizeText);if(!Number.isSafeInteger(size)||size<0)throw Error("bad_size");
  if(size>LIMIT){if(binaryHead(await blobHead(id)))stats.history.binary++;else stats.history.large++;}else blobs.push({id,size});
 }
 for(let index=0;index<blobs.length;){
  const batch=[];let bytes=0;while(index<blobs.length&&bytes+blobs[index].size+128<=BATCH){const blob=blobs[index++];batch.push(blob);bytes+=blob.size+128;}
  const output=git(["cat-file","--batch"],batch.map(b=>b.id).join("\n")+"\n",bytes+4096);let offset=0;
  for(const expected of batch){
   const newline=output.indexOf(10,offset);if(newline<0)throw Error("bad_batch");
   const [id,type,size]=output.subarray(offset,newline).toString("ascii").split(" ");
   if(id!==expected.id||type!=="blob"||Number(size)!==expected.size)throw Error("bad_blob");
   offset=newline+1;const end=offset+expected.size;if(end>=output.length||output[end]!==10)throw Error("truncated_blob");
   const types=inspect(output.subarray(offset,end),"history");offset=end+1;
   if(types.length){const commit=git(["log","--all","--root","-m","--no-patch","--format=%H","-1","--find-object="+id]).toString("ascii").trim().split("\n")[0];if(!/^[a-f0-9]{40,64}$/.test(commit))throw Error("missing_commit");report(types,"commit:"+commit);}
  }
 }
}
try{
 selfTest();
 if(process.argv.includes("--self-test")){console.log("Security detector self-tests passed.");}
 else{
  if(git(["rev-parse","--is-shallow-repository"]).toString().trim()==="true")throw Error("shallow_history");
  process.chdir(git(["rev-parse","--show-toplevel"]).toString().trim());
  for(const file of git(["ls-files","-z"]).toString("utf8").split("\0").filter(Boolean)){
   let info;try{info=lstatSync(file);}catch(error){if(error.code==="ENOENT")continue;throw error;}
   if(!info.isFile())continue;
   if(info.size>LIMIT){if(binaryHead(fileHead(file)))stats.worktree.binary++;else stats.worktree.large++;continue;}
   report(inspect(readFileSync(file),"worktree"),"file:"+file);
  }
  await history();
  console.log(JSON.stringify({findings,stats,limitBytes:LIMIT,note:"Bounded patterns and reachable Git history only. Binary exclusions are not a guarantee of no secrets."}));
  process.exitCode=findings?1:stats.worktree.large+stats.history.large?2:0;
 }
}catch{console.error("Security scan incomplete: Git, I/O, self-test or unsupported text. No secret values logged.");process.exitCode=2;}

