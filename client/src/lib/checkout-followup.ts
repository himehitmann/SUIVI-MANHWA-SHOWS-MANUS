import type {SyncSession} from "./sync";

export function hasProAccess(session:SyncSession|null):boolean {
  return Boolean(session && (session.role==="owner" || session.role==="admin" || session.plan==="pro" || session.plan==="lifetime"));
}
const PREFIX="yomu.checkout.pending:";
const key=(scope:string)=>PREFIX+encodeURIComponent(scope);
/** A tab-local navigation guard, never a payment receipt or entitlement. */
export function checkoutPending(scope:string|null):boolean {
  if(!scope)return false;
  try{return sessionStorage.getItem(key(scope))!==null;}catch{return false;}
}
export function rememberCheckout(scope:string|null):void {
  if(!scope)throw new Error("unauthorized");
  // Refuse to navigate if this tab cannot retain the guard.
  const record=JSON.stringify({startedAt:Date.now()});
  sessionStorage.setItem(key(scope),record);
  if(sessionStorage.getItem(key(scope))!==record)throw new Error("checkout_guard_unavailable");
}
export function forgetCheckout(scope:string|null):void {
  if(!scope)return;
  try{sessionStorage.removeItem(key(scope));}catch{/* The guard can remain; no rights depend on it. */}
}

export const CHECKOUT_CHECK_DELAYS=[0,2000,4000,8000] as const;
export const checkoutFollowupCopy=(lang:string)=>lang==="fr"?{
 title:"Vérifier mon accès Pro",
 checking:"Vérification des droits de ton compte…",
 active:"L’accès Pro est actif sur ce compte.",
 pending:"L’accès Pro n’est pas encore confirmé. Si tu as payé, ne repaie pas : la confirmation peut prendre du temps.",
 failed:"Impossible de vérifier ton accès pour le moment. Cela ne signifie pas que ton paiement a échoué. Ne repaie pas avant vérification.",
 changed:"Le compte a changé pendant la vérification. Recommence pour vérifier le compte actuellement connecté.",
 unavailable:"Le service de compte n’est pas configuré sur cette installation.",
 signIn:"Connecte-toi au compte Yomu utilisé avant le paiement pour vérifier son accès.",
 retry:"Vérifier à nouveau",settings:"Ouvrir les paramètres du compte",library:"Ouvrir ma bibliothèque",
 review:"Vérifier l’accès après paiement",inProgress:"Une tentative de paiement est en cours dans cet onglet. Vérifie l’accès avant de recommencer.",
 stop:"Je n’ai pas terminé le paiement",
 confirm:"Revenir aux offres ? Fais-le uniquement si tu n’as pas effectué le paiement. Cette action n’annule aucun paiement ni abonnement. Si tu as payé, vérifie ton accès ou ta facturation avant tout nouvel achat.",
 detail:"Cet écran vérifie les droits Yomu. Il ne constitue pas une facture ni une confirmation de prélèvement.",
}:{
 title:"Check my Pro access",
 checking:"Checking your account access…",
 active:"Pro access is active on this account.",
 pending:"Pro access is not confirmed yet. If you paid, do not pay again: confirmation can take time.",
 failed:"Your access could not be checked right now. This does not mean your payment failed. Do not pay again before checking.",
 changed:"The account changed during verification. Try again to check the account currently signed in.",
 unavailable:"The account service is not configured on this installation.",
 signIn:"Sign in to the Yomu account used before payment to check its access.",
 retry:"Check again",settings:"Open account settings",library:"Open my library",
 review:"Check access after payment",inProgress:"A payment attempt is in progress in this tab. Check access before trying again.",
 stop:"I did not complete payment",
 confirm:"Return to the offers? Only do this if you did not make the payment. This does not cancel any payment or subscription. If you paid, check your access or billing before another purchase.",
 detail:"This screen checks Yomu access. It is not an invoice or confirmation of a charge.",
};
