import {describe,it,expect} from "vitest";
import {accountDeletionMessage} from "../client/src/lib/account-deletion";
describe("deletion guidance",()=>{
 it.each(["billing_subscription_active","billing_checkout_pending","billing_review_required","billing_check_unavailable","account_delete_unconfirmed","owner_account_protected","account_changed"])("explains %s in both website languages without blaming the password",code=>{
  for(const lang of ["fr","en"]){const copy=accountDeletionMessage(code,lang);expect(copy?.length).toBeGreaterThan(20);expect(copy).not.toMatch(/password|mot de passe/i);}
 });
 it("leaves unrelated errors to the existing account handler",()=>expect(accountDeletionMessage("invalid_credentials","fr")).toBeNull());
});
