import type {SqlClient} from "./store-postgres";
export interface CheckoutAttempt {
 id:string;userId:string;offer:"month"|"year";priceId:string;createdAt:number;
 body:string;keyHash:string;sessionId?:string;
}
export interface CheckoutStore {
 reserve(draft:CheckoutAttempt):Promise<CheckoutAttempt>;
 read(userId:string):Promise<CheckoutAttempt|null>;
 attach(userId:string,id:string,sessionId:string):Promise<boolean>;
 clear(userId:string,id:string):Promise<boolean>;
}
export async function ensureCheckoutSchema(db:SqlClient){
 await db.query(`CREATE TABLE IF NOT EXISTS checkout_attempts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL UNIQUE,payload JSONB NOT NULL
 )`);
}
export function createPostgresCheckoutStore(db:SqlClient):CheckoutStore {
 return {
  async reserve(draft){
   const r=await db.query("INSERT INTO checkout_attempts (user_id,attempt_id,payload) VALUES ($1,$2,$3::jsonb) ON CONFLICT (user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING payload",[draft.userId,draft.id,JSON.stringify(draft)]);
   return r.rows[0].payload;
  },
  async read(userId){const r=await db.query("SELECT payload FROM checkout_attempts WHERE user_id=$1",[userId]);return r.rows[0]?.payload||null;},
  async attach(userId,id,sessionId){
   const r=await db.query("UPDATE checkout_attempts SET payload=jsonb_set(payload,'{sessionId}',to_jsonb($3::text)) WHERE user_id=$1 AND attempt_id=$2 AND (payload->>'sessionId' IS NULL OR payload->>'sessionId'=$3) RETURNING attempt_id",[userId,id,sessionId]);
   return r.rows.length===1;
  },
  async clear(userId,id){const r=await db.query("DELETE FROM checkout_attempts WHERE user_id=$1 AND attempt_id=$2 RETURNING attempt_id",[userId,id]);return r.rows.length===1;},
 };
}
/** Test adapter only. Production checkout is wired exclusively to PostgreSQL. */
export function createMemoryCheckoutStore():CheckoutStore {
 const rows=new Map<string,CheckoutAttempt>();
 return {
  async reserve(draft){if(!rows.has(draft.userId))rows.set(draft.userId,structuredClone(draft));return structuredClone(rows.get(draft.userId)!);},
  async read(userId){return structuredClone(rows.get(userId)||null);},
  async attach(userId,id,sessionId){const r=rows.get(userId);if(!r||r.id!==id||(r.sessionId&&r.sessionId!==sessionId))return false;r.sessionId=sessionId;return true;},
  async clear(userId,id){if(rows.get(userId)?.id!==id)return false;rows.delete(userId);return true;},
 };
}
