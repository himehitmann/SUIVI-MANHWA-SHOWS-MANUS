# Stripe recurring purchase account binding

Prepared 2026-11-17. Backend correction; extension package version remains 0.4.31.

## Problem
Yomu Payment Links append the signed-in account ID as client_reference_id. Stripe places that reference on the Checkout Session. It is not automatically a userId on the Subscription object.

Recurring entitlements are driven by subscription events. Previously, a Payment Link subscription without subscription.metadata.userId could remain unassigned. A payer email supplied on a payload was not a reliable substitute for the Yomu account reference.

## Resolution
For a recognized, signature-verified subscription event:
- An existing valid subscription.metadata.userId remains supported.
- Without that reference, the server reads the exact subscription's Checkout Session using Stripe's subscription filter and limit=2.
- The response must be a complete list containing exactly one completed subscription Checkout Session. Its subscription and customer identities must match the event. Its client_reference_id must be a valid Yomu account ID. Conflicting Checkout metadata is refused.
- The resulting account reference is applied through the existing receipt, resource ownership, deduplication and event-order rules. A subscription already assigned to another account cannot move to a different one.
- Payer email is never the fallback identity for these recurring events. A subsequent change to the Yomu email does not break cancellation.
- Current-subscription reconciliation uses the same binding rules when conflicting events require a provider read.

This is a read-only Stripe integration. It does not write metadata, create a customer, open checkout, charge, refund or cancel a subscription.

## Failures and retries
Missing/incomplete Checkout evidence, provider failure or conflicting identities return HTTP 503 without consuming the event or granting rights. Stripe can retry after the Checkout Session becomes available and complete. This also handles a subscription notification arriving before checkout completion.

The server key STRIPE_SECRET_KEY needs read access to Checkout Sessions as well as subscriptions. The fixed provider endpoint uses the existing bounded response reader, five-second timeout and redirect rejection. Unrecognized products and events with explicit valid subscription identity do not add a Checkout lookup.

No persistent lookup cache was added: current provider evidence is checked for metadata-free deliveries. This adds a provider read per such delivery (including duplicate delivery). Activation depends on successful delivery/processing of a recognized subscription event; checkout completion alone does not grant recurring rights.

## Verification scope
Tests cover the pure resolver and signed HTTP webhook delivery with simulated Stripe responses: activation, cancellation, late/duplicate activation, email differences, account email changes, malformed and ambiguous evidence, missing evidence followed by retry, invalid signatures, unknown products, resource ownership conflict and equal-timestamp reconciliation. Saved library data is retained.

Real Stripe products, subscriptions, webhooks and publication remain unconfigured and unverified. No successful real payment or deployed cancellation cycle is claimed.

The account reference identifies the intended beneficiary; it does not authenticate the browser that visited a shareable Payment Link. Full server-created checkout and duplicate-subscription prevention remain separate release work.

## Primary references
- [Stripe Payment Link URL parameters](https://docs.stripe.com/payment-links/url-parameters): client_reference_id belongs to the Checkout Session.
- [List Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/list): exact subscription filter.
- [Stripe metadata](https://docs.stripe.com/metadata): metadata is attached to specific provider objects.
