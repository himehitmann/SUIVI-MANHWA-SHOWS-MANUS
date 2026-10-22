/**
 * Firebase Spark email/password transport. No storage, privileged keys or
 * billing APIs. Call only from a trusted extension worker or app auth layer.
 * Not activated until the Firestore adapter and deployment are validated.
 */
export type FirebaseConfig = Readonly<{projectId:string;apiKey:string}>;
export type FirebaseSession = Readonly<{
  provider:"firebase";projectId:string;userId:string;email:string;
  token:string;refreshToken:string;expiresAt:number;
}>;
type Payload = Record<string,unknown>;
const AUTH="https://identitytoolkit.googleapis.com/v1/accounts:";
const TOKEN="https://securetoken.googleapis.com/v1/token";
const TIMEOUT_MS=15000;

export class FirebaseAuthError extends Error {
  constructor(public readonly code:string) {super(code);this.name="FirebaseAuthError";}
}
const fail=(code:string):never=>{throw new FirebaseAuthError(code);};
function emailAddress(value:string) {
  const email=typeof value==="string"?value.trim():"";
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))fail("invalid_email");
  return email;
}
function passwordValue(value:string,signup:boolean) {
  if(typeof value!=="string"||!value.length||value.length>4096)fail("invalid_password");
  if(signup&&value.length<8)fail("weak_password");
  return value;
}
function errorCode(body:Payload,status:number) {
  const nested=body.error as {message?:unknown}|undefined;
  const name=typeof nested?.message==="string"?nested.message.split(" : ")[0]:"";
  const codes:Record<string,string>={
    EMAIL_EXISTS:"email_taken",INVALID_EMAIL:"invalid_email",WEAK_PASSWORD:"weak_password",
    EMAIL_NOT_FOUND:"invalid_credentials",INVALID_PASSWORD:"invalid_credentials",
    INVALID_LOGIN_CREDENTIALS:"invalid_credentials",USER_DISABLED:"account_disabled",
    TOKEN_EXPIRED:"session_expired",INVALID_REFRESH_TOKEN:"session_expired",
    INVALID_ID_TOKEN:"session_expired",USER_NOT_FOUND:"session_expired",
    TOO_MANY_ATTEMPTS_TRY_LATER:"rate_limited",QUOTA_EXCEEDED:"quota_exceeded",
    OPERATION_NOT_ALLOWED:"provider_not_configured",
    API_KEY_INVALID:"provider_not_configured",PROJECT_NUMBER_MISMATCH:"project_mismatch",
  };
  return status===429?"rate_limited":codes[name]||(status>=500?"service_unavailable":"authentication_failed");
}

export function createFirebaseAuth(
  input:FirebaseConfig,
  fetcher:typeof fetch=globalThis.fetch,
  now:()=>number=Date.now,
) {
  // Copy configuration so callers cannot change a pending request's identity.
  const config={projectId:input.projectId,apiKey:input.apiKey};
  if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)||
     !/^[A-Za-z0-9_-]{20,200}$/.test(config.apiKey))fail("invalid_firebase_config");
  async function request(endpoint:string,body:Payload|string,locale?:string):Promise<Payload> {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try {
      const headers:Record<string,string>={"Content-Type":typeof body==="string"?"application/x-www-form-urlencoded":"application/json"};
      if(locale&&/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale))headers["X-Firebase-Locale"]=locale;
      const response=await fetcher(endpoint+"?key="+encodeURIComponent(config.apiKey),{
        method:"POST",headers,body:typeof body==="string"?body:JSON.stringify(body),
        redirect:"error",credentials:"omit",cache:"no-store",signal:controller.signal,
      });
      // Keep the timeout active while reading the body, not only the headers.
      const data:unknown=await response.json();
      if(!data||typeof data!=="object"||Array.isArray(data))fail("invalid_auth_response");
      const result=data as Payload;
      if(!response.ok)fail(errorCode(result,response.status));
      return result;
    } catch(error) {
      if(error instanceof FirebaseAuthError)throw error;
      fail(controller.signal.aborted?"request_timeout":"network_error");
    } finally {clearTimeout(timer);}
  }
  function session(data:Payload,refresh:boolean,email:string,expectedUser?:string):FirebaseSession {
    const token=data[refresh?"id_token":"idToken"];
    const refreshToken=data[refresh?"refresh_token":"refreshToken"];
    const userId=data[refresh?"user_id":"localId"];
    const seconds=Number(data[refresh?"expires_in":"expiresIn"]);
    if(typeof token!=="string"||token.length>20000||typeof refreshToken!=="string"||
       !refreshToken||refreshToken.length>20000||typeof userId!=="string"||!userId||
       userId.length>128||!Number.isFinite(seconds)||seconds<=0||seconds>86400)fail("invalid_auth_response");
    if(expectedUser&&expectedUser!==userId)fail("account_mismatch");
    let claims:Payload;
    try {
      const parts=(token as string).split(".");
      if(parts.length!==3)fail("invalid_auth_response");
      const base64=parts[1].replace(/-/g,"+").replace(/_/g,"/");
      claims=JSON.parse(atob(base64.padEnd(Math.ceil(base64.length/4)*4,"=")));
      if(!claims||typeof claims!=="object")fail("invalid_auth_response");
    } catch {return fail("invalid_auth_response");}
    // Sanity check HTTPS issuer metadata, not local signature verification.
    // Firestore must independently validate this ID token with security rules.
    if(claims.aud!==config.projectId||claims.iss!=="https://securetoken.google.com/"+config.projectId)fail("project_mismatch");
    if(claims.sub!==userId)fail("account_mismatch");
    const expiresAt=Math.min(now()+seconds*1000,Number(claims.exp)*1000);
    if(!Number.isFinite(expiresAt)||expiresAt<=now())fail("session_expired");
    const returnedEmail=refresh?email:emailAddress(String(data.email||""));
    return {provider:"firebase",projectId:config.projectId,userId:userId as string,
      email:returnedEmail,token:token as string,refreshToken:refreshToken as string,expiresAt};
  }
  return {
    async signIn(email:string,password:string) {
      const address=emailAddress(email);
      const result=await request(AUTH+"signInWithPassword",{email:address,password:passwordValue(password,false),returnSecureToken:true});
      return session(result,false,address);
    },
    async signUp(email:string,password:string) {
      const address=emailAddress(email);
      const result=await request(AUTH+"signUp",{email:address,password:passwordValue(password,true),returnSecureToken:true});
      return session(result,false,address);
    },
    async refresh(previous:FirebaseSession) {
      if(previous.provider!=="firebase"||previous.projectId!==config.projectId)fail("project_mismatch");
      if(typeof previous.refreshToken!=="string"||!previous.refreshToken||previous.refreshToken.length>20000)fail("session_expired");
      const body=new URLSearchParams({grant_type:"refresh_token",refresh_token:previous.refreshToken}).toString();
      return session(await request(TOKEN,body),true,previous.email,previous.userId);
    },
    async requestPasswordReset(email:string,locale="en"):Promise<void> {
      try {await request(AUTH+"sendOobCode",{requestType:"PASSWORD_RESET",email:emailAddress(email)},locale);}
      catch(error) {
        // Same visible result for unknown addresses. Never expose provider bodies.
        if(error instanceof FirebaseAuthError&&error.code==="invalid_credentials")return;
        throw error;
      }
    },
  };
}
