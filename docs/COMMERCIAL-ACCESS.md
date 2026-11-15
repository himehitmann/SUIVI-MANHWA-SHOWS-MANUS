# Commercial synchronization access

## Server policy

`YOMU_ACCESS_MODE` accepts only `paid` or `personal`. Production defaults to
`paid`; development/test defaults to `personal`. An invalid value fails startup.
A self-hosted personal installation may explicitly select `personal`. This is a
server deployment setting; no client request or stored plan can change it.

In paid mode, `PUT /api/sync` checks the current effective account rights before
merging data. Pro, Lifetime, server-configured owners, administrators and active
gifts can write. A member without active rights receives HTTP 403 with
`subscription_required`. Submitted plan, role or gift fields do not grant access.
The existing server backup is not mutated on this denial.

The check uses the rights observed for that request; it is not a transaction
shared with all billing/administration operations. An already authorized in-flight
write may finish while rights are being changed. The next request reads rights
again. Provider event processing still determines the underlying paid plan.

## Recovery remains available

Account creation/login, password and email management, account deletion,
`GET /api/me`, `GET /api/license` and authenticated `GET /api/sync` remain
available without payment. A lapsed subscriber can retrieve an existing backup
and export it. Account isolation and session validation still apply.
No library is deleted because a plan expires.

The web app separates successful login from successful backup. A refused upload
still attempts to retrieve the existing backup; a network failure keeps the
account signed in and local edits available. Settings distinguishes read-only
online access from network failure. “Connected” is no longer presented as proof
that the backup succeeded.

The extension already downloads and merges before upload. A commercial refusal
now receives a specific message, retains the session, downloaded records and
local edits, and does not advance the confirmed-backup fingerprint. A later
successful retry can save the pending edits.

## Scope and deployment

This protects the managed HTTP synchronization service. It is not a complete
paywall for all local extension tools, the public catalog, translation providers,
or a user's separately configured Firebase project. Those paths need their own
commercial policy and acceptance before release. The personal Firebase backup
option is unchanged.

Existing production installations without paid rights must deliberately choose
personal hosting or configure owner/paid access before adopting this version;
otherwise new uploads will be refused while existing backups remain readable.
Persistent administrator/gift state uses PostgreSQL. Do not infer owner rights
from a client edition flag.

No real account provider, live payment or public deployment was configured.
Automated evidence uses synthetic accounts and isolated databases.
