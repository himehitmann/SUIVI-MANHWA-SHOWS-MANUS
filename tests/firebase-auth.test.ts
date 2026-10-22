import {afterEach,describe,expect,it,vi} from "vitest";
import {createFirebaseAuth,FirebaseAuthError} from "../shared/firebase-auth";
const config={projectId:"yomu-test-project",apiKey:"public-test-configuration-key"};
const now=()=>1_800_000_000_000;
const jwt=(claims:Record<string,unknown>={})=>[
  Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT"})).toString("base64url"),
  Buffer.from(JSON.stringify({aud:config.projectId,iss:"https://securetoken.google.com/"+config.projectId,sub:"user-a",exp:now()/1000+3600,...claims})).toString("base64url"),
  "synthetic-signature",
].join(".");
const payload=(more:Record<string,unknown>={})=>({localId:"user-a",email:"reader@example.com",idToken:jwt(),refreshToken:"synthetic-refresh",expiresIn:"3600",...more});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
afterEach(()=>vi.useRealTimers());
describe("Firebase free account transport (mocked provider)",()=>{
  it("signs in only at the fixed HTTPS endpoint without cookies or redirects",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response(payload()));
    const client=createFirebaseAuth(config,fetcher,now);
    const session=await client.signIn(" reader@example.com ","synthetic-password");
    expect(fetcher).toHaveBeenCalledOnce();
    const [url,init]=fetcher.mock.calls[0];
    expect(url).toBe("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="+config.apiKey);
    expect(init).toMatchObject({method:"POST",redirect:"error",credentials:"omit",cache:"no-store"});
    expect(JSON.parse(String(init?.body))).toEqual({email:"reader@example.com",password:"synthetic-password",returnSecureToken:true});
    expect(session).toMatchObject({provider:"firebase",projectId:config.projectId,userId:"user-a",expiresAt:now()+3600000});
    expect(session).not.toHaveProperty("password");
    expect(session).not.toHaveProperty("plan");
  });
  it("creates a persistent email account rather than an anonymous identity",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response(payload()));
    await createFirebaseAuth(config,fetcher,now).signUp("reader@example.com","synthetic-password");
    expect(fetcher.mock.calls[0][0]).toContain("/accounts:signUp?");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({email:"reader@example.com",password:"synthetic-password"});
  });
  it("validates configuration and credentials before contacting the provider",async()=>{
    const fetcher=vi.fn<typeof fetch>(),client=createFirebaseAuth(config,fetcher,now);
    expect(()=>createFirebaseAuth({...config,projectId:"../other"},fetcher,now)).toThrow("invalid_firebase_config");
    expect(()=>createFirebaseAuth({...config,apiKey:"x&key=other"},fetcher,now)).toThrow("invalid_firebase_config");
    await expect(client.signUp("reader@example.com","short")).rejects.toThrow("weak_password");
    await expect(client.signIn("bad-email","password")).rejects.toThrow("invalid_email");
    await expect(client.signIn("reader@example.com","")).rejects.toThrow("invalid_password");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refreshes with form encoding and retains only the returned credentials",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(payload()))
      .mockResolvedValueOnce(response({user_id:"user-a",id_token:jwt(),refresh_token:"new-refresh",expires_in:"3600"}));
    const client=createFirebaseAuth(config,fetcher,now),session=await client.signIn("reader@example.com","password");
    const updated=await client.refresh({...session,refreshToken:"token+with&symbols="});
    const [url,init]=fetcher.mock.calls[1];
    expect(url).toBe("https://securetoken.googleapis.com/v1/token?key="+config.apiKey);
    expect(new URLSearchParams(String(init?.body)).get("refresh_token")).toBe("token+with&symbols=");
    expect(init?.headers).toEqual({"Content-Type":"application/x-www-form-urlencoded"});
    expect(updated.refreshToken).toBe("new-refresh");
    expect(updated.email).toBe(session.email);
    expect(session.refreshToken).toBe("synthetic-refresh");
  });
  it("refuses cross-project refreshes before sending any credentials",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(payload()));
    const client=createFirebaseAuth(config,fetcher,now),session=await client.signIn("reader@example.com","password");
    await expect(client.refresh({...session,projectId:"other-project"})).rejects.toThrow("project_mismatch");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("refuses a refresh response that changes account",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(payload()))
      .mockResolvedValueOnce(response({user_id:"user-b",id_token:jwt({sub:"user-b"}),refresh_token:"new",expires_in:"3600"}));
    const client=createFirebaseAuth(config,fetcher,now),session=await client.signIn("reader@example.com","password");
    await expect(client.refresh(session)).rejects.toThrow("account_mismatch");
    expect(session.userId).toBe("user-a");
  });
  it.each([
    [{aud:"other-project"},"project_mismatch"],
    [{iss:"https://untrusted.example"},"project_mismatch"],
    [{sub:"user-b"},"account_mismatch"],
    [{exp:now()/1000-1},"session_expired"],
  ])("rejects inconsistent token metadata %j",async(claims,code)=>{
    const client=createFirebaseAuth(config,vi.fn<typeof fetch>().mockResolvedValue(response(payload({idToken:jwt(claims)}))),now);
    await expect(client.signIn("reader@example.com","password")).rejects.toThrow(code);
  });
  it("rejects malformed success responses without echoing their contents",async()=>{
    const client=createFirebaseAuth(config,vi.fn<typeof fetch>().mockResolvedValue(response(payload({idToken:"private-bad-token"}))),now);
    await expect(client.signIn("reader@example.com","password")).rejects.toThrow("invalid_auth_response");
  });
  it.each([
    ["INVALID_LOGIN_CREDENTIALS",400,"invalid_credentials"],
    ["INVALID_REFRESH_TOKEN",400,"session_expired"],
    ["USER_DISABLED",400,"account_disabled"],
    ["arbitrary-private-details",429,"rate_limited"],
    ["arbitrary-private-details",503,"service_unavailable"],
  ])("maps %s without leaking remote details",async(message,status,code)=>{
    const client=createFirebaseAuth(config,vi.fn<typeof fetch>().mockResolvedValue(response({error:{message}},status)),now);
    await expect(client.signIn("reader@example.com","password")).rejects.toEqual(new FirebaseAuthError(code));
  });
  it("requests localized password recovery and does not reveal unknown addresses",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({email:"reader@example.com"}))
      .mockResolvedValueOnce(response({error:{message:"EMAIL_NOT_FOUND"}},400));
    const client=createFirebaseAuth(config,fetcher,now);
    await client.requestPasswordReset("reader@example.com","fr");
    await expect(client.requestPasswordReset("missing@example.com","fr")).resolves.toBeUndefined();
    const [url,init]=fetcher.mock.calls[0];
    expect(url).toContain("/accounts:sendOobCode?");
    expect(init?.headers).toMatchObject({"X-Firebase-Locale":"fr"});
    expect(JSON.parse(String(init?.body))).toEqual({requestType:"PASSWORD_RESET",email:"reader@example.com"});
  });
  it("normalizes network errors without leaking URLs, passwords or refresh tokens",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockRejectedValue(Error("private credential at request URL"));
    const client=createFirebaseAuth(config,fetcher,now);
    await expect(client.signIn("reader@example.com","password")).rejects.toEqual(new FirebaseAuthError("network_error"));
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("times out a stalled response body, not just stalled headers",async()=>{
    vi.useFakeTimers();
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async(_url,init)=>({
      ok:true,status:200,json:()=>new Promise((_resolve,reject)=>{
        init?.signal?.addEventListener("abort",()=>reject(Error("aborted")),{once:true});
      }),
    } as Response));
    const pending=createFirebaseAuth(config,fetcher,now).signIn("reader@example.com","password");
    const assertion=expect(pending).rejects.toThrow("request_timeout");
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
