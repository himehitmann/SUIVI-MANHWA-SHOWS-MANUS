import type {SqlClient} from "./store-postgres";
export type Access={role:"member"|"admin";giftUntil:number;version:number};
export type AccessChange={requestId:string;expectedVersion:number;kind:"role"|"gift";role?:"member"|"admin";days?:number;reason:string};
export type AuditEvent=AccessChange&{actorId:string;targetId:string;at:number;before:Access;after:Access};
type VerifyActor=(client?:SqlClient)=>Promise<boolean>;
export interface AccessStore {get(id:string):Promise<Access>;change(actorId:string,targetId:string,change:AccessChange,owners:ReadonlySet<string>,verify?:VerifyActor):Promise<Access>;audit():Promise<AuditEvent[]>;}
export class AccessError extends Error {constructor(readonly code:string,readonly status=400){super(code);}}
const empty=():Access=>({role:"member",giftUntil:0,version:0});
const copy=(a:Access):Access=>({...a});
const copyEvent=(e:AuditEvent):AuditEvent=>({...e,before:copy(e.before),after:copy(e.after)});
export function effectiveRole(id:string,a:Access,owners:ReadonlySet<string>):"owner"|"admin"|"member" {return owners.has(id)?"owner":a.role;}
export function effectivePlan(base:"free"|"pro"|"lifetime",id:string,a:Access,owners:ReadonlySet<string>,now=Date.now()):"free"|"pro"|"lifetime" {return base==="lifetime"?base:effectiveRole(id,a,owners)!=="member"||a.giftUntil>now?"pro":base;}
function validate(c:AccessChange):AccessChange {
 if(!c||typeof c.requestId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(c.requestId)||!Number.isSafeInteger(c.expectedVersion)||c.expectedVersion<0||c.expectedVersion>=Number.MAX_SAFE_INTEGER||typeof c.reason!=="string"||c.reason.trim().length<3||c.reason.length>200)throw new AccessError("invalid_access_change");
 const out:AccessChange={requestId:c.requestId,expectedVersion:c.expectedVersion,kind:c.kind,reason:c.reason};
 if(c.kind==="role"&&(c.role==="member"||c.role==="admin")&&c.days===undefined)out.role=c.role;
 else if(c.kind==="gift"&&Number.isInteger(c.days)&&c.days!>=0&&c.days!<=366&&c.role===undefined)out.days=c.days;
 else throw new AccessError("invalid_access_change");return out;
}
function authorize(id:string,a:Access,owners:ReadonlySet<string>){if(effectiveRole(id,a,owners)==="member")throw new AccessError("admin_required",403);}
function prepare(actorId:string,targetId:string,c:AccessChange,before:Access,previous:AuditEvent|undefined,owners:ReadonlySet<string>,now:()=>number):{access:Access;event?:AuditEvent}{
 if(previous){if(previous.actorId!==actorId||previous.targetId!==targetId||["requestId","expectedVersion","kind","role","days","reason"].some(k=>(previous as any)[k]!==(c as any)[k]))throw new AccessError("idempotency_conflict",409);return {access:copy(previous.after)};}
 if(actorId===targetId||owners.has(targetId))throw new AccessError("protected_access_target",403);
 if(before.version!==c.expectedVersion)throw new AccessError("access_version_conflict",409);
 const at=now();if(!Number.isSafeInteger(at)||at<0||at>Number.MAX_SAFE_INTEGER-366*86400000)throw new AccessError("invalid_access_clock",500);
 const after={...before,version:before.version+1};if(c.kind==="role")after.role=c.role!;else after.giftUntil=c.days===0?0:at+c.days!*86400000;
 return {access:after,event:{...c,actorId,targetId,at,before:copy(before),after:copy(after)}};
}
export function createMemoryAccessStore(now:()=>number=Date.now):AccessStore{
 const states=new Map<string,Access>(),requests=new Map<string,AuditEvent>(),events:AuditEvent[]=[];let tail=Promise.resolve();
 return {async get(id){return copy(states.get(id)||empty());},async change(actor,target,input,owners,verify){const c=validate(input);const result=tail.then(async()=>{if(verify&&!await verify())throw new AccessError("actor_session_invalid",403);authorize(actor,states.get(actor)||empty(),owners);const out=prepare(actor,target,c,states.get(target)||empty(),requests.get(c.requestId),owners,now);if(out.event){states.set(target,copy(out.access));requests.set(c.requestId,out.event);events.push(out.event);}return copy(out.access);});tail=result.then(()=>{},()=>{});return result;},async audit(){return events.slice(-50).reverse().map(copyEvent);}};
}
export async function ensureAccessSchema(client:SqlClient){
 await client.query("CREATE TABLE IF NOT EXISTS access_state (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),gift_until BIGINT NOT NULL DEFAULT 0 CHECK(gift_until BETWEEN 0 AND 9007199254740991),version BIGINT NOT NULL DEFAULT 0 CHECK(version BETWEEN 0 AND 9007199254740991))");
 await client.query("CREATE TABLE IF NOT EXISTS access_audit (sequence BIGSERIAL PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,event JSONB NOT NULL)");
}
async function readAccess(client:SqlClient,id:string):Promise<Access>{const {rows}=await client.query("SELECT role,gift_until,version FROM access_state WHERE user_id=$1",[id]);return rows.length?{role:rows[0].role,giftUntil:Number(rows[0].gift_until),version:Number(rows[0].version)}:empty();}
export function createPostgresAccessStore(client:SqlClient,now:()=>number=Date.now):AccessStore{
 return {get:id=>readAccess(client,id),async change(actor,target,input,owners,verify){
  const c=validate(input);if(!client.connect)throw new AccessError("transaction_connection_required",500);const tx=await client.connect();
  try {await tx.query("BEGIN");await tx.query("SELECT pg_advisory_xact_lock($1::bigint)",[1498361173]);
   if(verify&&!await verify(tx))throw new AccessError("actor_session_invalid",403);
   authorize(actor,await readAccess(tx,actor),owners);
   const users=await tx.query("SELECT id FROM users WHERE id=$1 OR id=$2 FOR KEY SHARE",[actor,target]),ids=new Set(users.rows.map(r=>r.id));if(!ids.has(actor)||!ids.has(target))throw new AccessError("access_user_not_found",404);
   const prior=await tx.query("SELECT event FROM access_audit WHERE request_id=$1",[c.requestId]);
   const out=prepare(actor,target,c,await readAccess(tx,target),prior.rows[0]?.event,owners,now);
   if(out.event){await tx.query("INSERT INTO access_state(user_id,role,gift_until,version) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role,gift_until=EXCLUDED.gift_until,version=EXCLUDED.version",[target,out.access.role,out.access.giftUntil,out.access.version]);await tx.query("INSERT INTO access_audit(request_id,event) VALUES($1,$2::jsonb)",[c.requestId,JSON.stringify(out.event)]);}
   await tx.query("COMMIT");return copy(out.access);
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 },async audit(){const {rows}=await client.query("SELECT event FROM access_audit ORDER BY sequence DESC LIMIT 50");return rows.map(r=>copyEvent(r.event));}};
}

