import {createFirebaseAuth,type FirebaseConfig,type FirebaseSession,FirebaseAuthError} from "./firebase-auth";
export type FirebaseSessionStore={
  read():Promise<FirebaseSession|null>;
  write(session:FirebaseSession|null):Promise<void>;
};
type Auth=Pick<ReturnType<typeof createFirebaseAuth>,"signIn"|"signUp"|"refresh">;
/** Worker-only store: use trusted chrome.storage.local, never sync or page storage.
 * Writes are serialized; network requests are not allowed to resurrect older accounts.
 */
export function createFirebaseSessionManager(config:FirebaseConfig,store:FirebaseSessionStore,
  auth:Auth=createFirebaseAuth(config),now:()=>number=Date.now){
  const projectId=config.projectId;
  let current:FirebaseSession|null=null,epoch=0;
  let tail:Promise<unknown>=Promise.resolve();
  let refreshing:{epoch:number;promise:Promise<FirebaseSession>}|null=null;
  function valid(value:FirebaseSession){
    if(value.provider!=="firebase"||value.projectId!==projectId||
       !/^[A-Za-z0-9_-]{1,128}$/.test(value.userId)||typeof value.email!=="string"||
       typeof value.token!=="string"||!value.token||typeof value.refreshToken!=="string"||
       !value.refreshToken||!Number.isFinite(value.expiresAt))throw new FirebaseAuthError("invalid_session");
    // Explicit fields: do not persist passwords or unrelated account metadata.
    return {provider:"firebase" as const,projectId,userId:value.userId,email:value.email,
      token:value.token,refreshToken:value.refreshToken,expiresAt:value.expiresAt};
  }
  const ready=Promise.resolve().then(()=>store.read()).then(value=>{current=value?valid(value):null;});
  function serial<T>(job:()=>Promise<T>):Promise<T>{
    const result=tail.then(job);tail=result.catch(()=>{});return result;
  }
  function unchanged(expected:number){if(epoch!==expected)throw new FirebaseAuthError("account_changed");}
  async function login(method:"signIn"|"signUp",email:string,password:string){
    await ready;
    const ticket=await serial(async()=>++epoch);
    const next=valid(await auth[method](email,password));
    return serial(async()=>{
      unchanged(ticket);
      await store.write({...next});
      current=next;
      return {...next};
    });
  }
  return {
    signIn:(email:string,password:string)=>login("signIn",email,password),
    signUp:(email:string,password:string)=>login("signUp",email,password),
    async signOut(){
      await ready;
      await serial(async()=>{
        ++epoch;
        // A failed durable deletion is reported, never shown as successful logout.
        await store.write(null);current=null;
      });
    },
    async getSession():Promise<FirebaseSession|null>{
      await ready;await tail;
      if(!current)return null;
      if(current.expiresAt>now()+60000)return {...current};
      const ticket=epoch,previous={...current};
      if(refreshing?.epoch===ticket)return {...await refreshing.promise};
      const promise=(async()=>{
        const next=valid(await auth.refresh(previous));
        if(next.userId!==previous.userId)throw new FirebaseAuthError("account_mismatch");
        return serial(async()=>{
          unchanged(ticket);
          await store.write({...next});current=next;return {...next};
        });
      })();
      const active={epoch:ticket,promise};refreshing=active;
      try{return {...await promise};}
      finally{if(refreshing===active)refreshing=null;}
    },
  };
}
