# FIDE Chess Ledger — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity**: Every read and write operation requires an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
3. **Path Variable Hardening**: Document IDs (`userId`, `tournamentId`, `gameId`, `ratingId`) on single-document operations (`get`, `create`, `update`, `delete`) must satisfy `isValidId(id)` (`1..128` chars matching `^[a-zA-Z0-9_\-]+$`).
4. **Strict Schema & Key Allowlisting**: Every `create` and `update` must pass `isValid[Entity](incoming())`, which enforces exact required/allowed keys via `hasAll` and `hasOnly`, strict data types, mandatory string `.size()` limits, and regex patterns synced verbatim with `firebase-blueprint.json`.
5. **Relational Integrity (Master Gate)**: A `FideGame` in `/games/{gameId}` cannot be created or updated unless `/tournaments/$(incoming().tournamentId)` exists and its `ownerId` equals `request.auth.uid`.
6. **Terminal State Locking**: Once a `Tournament` document reaches `status == 'completed'`, subsequent updates to that document are blocked.
7. **Temporal & Ownership Immutability**: On `create`, `createdAt == request.time && updatedAt == request.time`. On `update`, `createdAt == existing().createdAt && updatedAt == request.time` and `ownerId == existing().ownerId`.
8. **Query Enforcement (`allow list`)**: Every `allow list` rule enforces `resource.data.ownerId == request.auth.uid` without `get()`/`exists()` calls.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Shadow Field Injection on PlayerProfile)**: Injects an undeclared `"isAdmin": true` field into `/players/{userId}`. Rejected by `data.keys().hasOnly(...)`.
2. **Payload 2 (Identity Spoofing on Tournament Create)**: Authenticated as `user_A`, attempts to create `/tournaments/t_1` with `"ownerId": "user_B"`. Rejected by `data.ownerId == request.auth.uid`.
3. **Payload 3 (Unverified Email Write Attempt)**: Authenticated user with `email_verified: false` attempts to write to `/players/{userId}`. Rejected by `isVerifiedUser()`.
4. **Payload 4 (Orphaned Game Creation)**: Attempts to create `/games/g_1` referencing a non-existent `tournamentId: "missing_tourney"`. Rejected by `exists(/databases/$(database)/documents/tournaments/$(incoming().tournamentId))`.
5. **Payload 5 (Cross-Tenant Tournament Reference on Game)**: `user_A` attempts to create `/games/g_1` referencing `tournamentId` owned by `user_B`. Rejected by `get(...).data.ownerId == request.auth.uid`.
6. **Payload 6 (Terminal State Mutation on Completed Tournament)**: Attempts to update `/tournaments/t_1` when `existing().status == 'completed'`. Rejected by `existing().status != 'completed'`.
7. **Payload 7 (Value Poisoning on Game Update)**: Attempts to update `pgn` with a 10,000-character string (exceeding `maxLength: 5000`). Rejected by `isValidFideGame(incoming())`.
8. **Payload 8 (ID Poisoning Attack)**: Attempts to create a document with an invalid ID containing spaces or special characters (`tournaments/bad$id!`). Rejected by `isValidId(tournamentId)`.
9. **Payload 9 (Timestamp Forgery on Create)**: Attempts to create a `MonthlyRatingRecord` with a past `createdAt` timestamp instead of `request.time`. Rejected by `incoming().createdAt == request.time`.
10. **Payload 10 (Immortal Field Mutation on Update)**: Attempts to mutate `createdAt` or `ownerId` during an update to `/ratingHistory/{ratingId}`. Rejected by `incoming().createdAt == existing().createdAt` and `affectedKeys().hasOnly(...)`.
11. **Payload 11 (Invalid ECO Code Regex Bypass)**: Attempts to create a `FideGame` with `ecoCode: "Z99"` (outside `^[A-E][0-9]{2}$`). Rejected by `data.ecoCode.matches('^[A-E][0-9]{2}$')`.
12. **Payload 12 (Unauthorized Blanket List Scraping)**: Attempts an unfiltered `list` query across `/games` without constraining `where('ownerId', '==', uid)`. Rejected by `resource.data.ownerId == request.auth.uid`.
