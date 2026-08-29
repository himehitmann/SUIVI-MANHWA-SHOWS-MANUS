import { describe, expect, it } from "vitest";
import { buildCheckoutUrl } from "../client/src/lib/checkout";

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

  it("omits reference fields that are absent", () => {
    const url = buildCheckoutUrl("https://buy.stripe.com/x", {});
    const u = new URL(url);
    expect(u.searchParams.has("client_reference_id")).toBe(false);
    expect(u.searchParams.has("prefilled_email")).toBe(false);
  });
});
