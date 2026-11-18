import {createPostgresStore,type SqlClient} from "./store-postgres";
import type {Store} from "./store";
import {createPostgresAccessStore,type AccessStore} from "./access";
import {createPostgresCheckoutStore,type CheckoutStore} from "./checkout-store";
import {createManagedCheckout,type CheckoutConfig,type ManagedCheckout} from "./managed-checkout";
export interface BillingAccountContext {store:Store;access:AccessStore;checkout:ManagedCheckout|null;attempts:CheckoutStore|null;}
export type BillingAccountRunner=<T>(userId:string,operation:(context:BillingAccountContext)=>Promise<T>)=>Promise<T>;
/** A single dedicated connection avoids nested pool acquisition. Session locks
 * serialize checkout/delete while every attempt write remains autocommitted
 * before the provider POST, including when that POST fails or times out. */
export function createPostgresBillingAccountRunner(pool:SqlClient,config:CheckoutConfig|null,request:typeof fetch=fetch):BillingAccountRunner{
 return async(userId,operation)=>{
  if(!pool.connect)throw Error("billing_lock_unavailable");
  const connection=await pool.connect(),key="yomu-checkout:"+userId;
  let locked=false,discard:Error|undefined;
  try{
   await connection.query("SELECT pg_advisory_lock(hashtextextended($1,0))",[key]);locked=true;
   const attempts=createPostgresCheckoutStore(connection);
   return await operation({store:createPostgresStore({query:(text,params)=>connection.query(text,params)}),access:createPostgresAccessStore(connection),attempts,checkout:config?createManagedCheckout(attempts,config,request):null});
  }catch(error){discard=error instanceof Error?error:new Error("billing_operation_failed");throw error;}
  finally{
   if(locked)try{
    const result=await connection.query("SELECT pg_advisory_unlock(hashtextextended($1,0)) AS released",[key]);
    if(result.rows[0]?.released!==true)discard=new Error("billing_lock_release_failed");
   }catch{discard=new Error("billing_lock_release_failed");}
   connection.release(discard);
  }
 };
}
