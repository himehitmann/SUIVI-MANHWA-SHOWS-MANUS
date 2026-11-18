export function accountDeletionMessage(code:string,language:string):string|null{
 const fr=language==="fr";
 const messages:Record<string,[string,string]>={
  billing_subscription_active:["Your subscription must be fully ended before deleting this account. Manage billing first, then retry after the cancellation is confirmed. Your account and saved library have been kept.","Ton abonnement doit être terminé avant de supprimer ce compte. Gère d’abord la facturation, puis réessaie après confirmation de la fin de l’abonnement. Ton compte et ta bibliothèque sont conservés."],
  billing_checkout_pending:["A payment session is still open. Check the payment attempt before deleting your account. Your account and saved library have been kept.","Une session de paiement est encore ouverte. Vérifie cette tentative avant de supprimer ton compte. Ton compte et ta bibliothèque sont conservés."],
  billing_review_required:["The payment situation needs review before this account can be deleted. Check access and billing; do not start another payment. Your account and saved library have been kept.","Le paiement doit être vérifié avant la suppression du compte. Vérifie ton accès et la facturation sans recommencer un paiement. Ton compte et ta bibliothèque sont conservés."],
  billing_check_unavailable:["Billing could not be verified. No account data was deleted. Try again later.","Impossible de vérifier la facturation. Aucune donnée du compte n’a été supprimée. Réessaie plus tard."],
  account_delete_unconfirmed:["The deletion result could not be confirmed. Check whether you can still sign in before trying again.","Impossible de confirmer le résultat de la suppression. Vérifie si tu peux encore te connecter avant de réessayer."],
  owner_account_protected:["The owner account is protected from deletion.","Le compte propriétaire est protégé contre la suppression."],
  account_changed:["The signed-in account changed. Check the current account before trying again.","Le compte connecté a changé. Vérifie le compte actuel avant de réessayer."],
 };
 return messages[code]?.[fr?1:0]||null;
}
