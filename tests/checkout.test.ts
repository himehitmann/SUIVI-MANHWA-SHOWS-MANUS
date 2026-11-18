import { describe, expect, it } from "vitest";
import { buildCheckoutUrl, validCheckoutBase } from "../client/src/lib/checkout";

describe("buildCheckoutUrl", () => {
  it("appends the account reference to a hosted checkout link", () => {
    const url = buildCheckoutUrl("https://buy.stripe.com/test_abc", { userId: "u123", email: "a@b.c" });
    const u = new URL(url);
    expect(u.searchParams.get("client_reference_id")).toBe("u123");
    expect(u.searchParams.get("prefilled_email")).toBe("a@b.c");
  });

  it("preserves existing query params on the base URL", () => {
    const url = buildCheckoutUrl("https://buy.stripe.com/x?locale=fr", { userId: "u1" });
    const u = new URL(url);
    expect(u.searchParams.get("locale")).toBe("fr");
    expect(u.searchParams.get("client_reference_id")).toBe("u1");
  });

  it("requires an account reference", () => {
    expect(() => buildCheckoutUrl("https://buy.stripe.com/x", {})).toThrow("Sign in");
  });
  it.each(["javascript:alert(1)", "http://buy.stripe.com/x", "https://buy.stripe.com.evil.test/x", "https://user:secret@buy.stripe.com/x", "https://buy.stripe.com:444/x", "https://buy.stripe.com/x#redirect", "https://example.test/x", "https://buy.stripe.com/"])("rejects unsafe or unsupported destination %s", url => {
    expect(validCheckoutBase(url)).toBe(false);
    expect(() => buildCheckoutUrl(url, { userId: "u1" })).toThrow("destination");
  });
  it("replaces stale account information from configured links", () => {
    const u = new URL(buildCheckoutUrl("https://buy.stripe.com/x?client_reference_id=old&prefilled_email=old%40example.test", { userId: "new" }));
    expect(u.searchParams.get("client_reference_id")).toBe("new");
    expect(u.searchParams.has("prefilled_email")).toBe(false);
  });
});
