# VahanLedger Firestore Security Specification

## 1. Data Invariants
1. **User Ownership Invariant**: Every vehicle document in `/vehicles/{vehicleId}` must carry an `ownerId` matching `request.auth.uid` at creation, and `ownerId` and `id` are permanently immutable after creation.
2. **Verified Identity Invariant**: All reads and writes require a verified Firebase Auth session (either verified phone OTP session or verified email/Google session).
3. **Private PII Isolation**: User profiles in `/users/{userId}` (containing verified mobile numbers and emails) can only be read, created, or updated by the owning `userId` (`request.auth.uid == userId`). Cross-user listing of `/users` is strictly denied.
4. **Strict Schema & Bounded Payloads**: No unvalidated or shadow keys are allowed (`keys().hasAll(...)` + `keys().hasOnly(...)`). All strings have strict `.size()` caps, `partners` is bounded to `1..10` items, and `mediaAttachments` is bounded to `0..20` items.
5. **Server Timestamp Integrity**: `createdAt` and `updatedAt` must equal `request.time`, and `createdAt` is immutable on updates.
6. **Query Enforcement**: Listing `/vehicles` enforces `resource.data.ownerId == request.auth.uid` inside the rule itself so client queries cannot scrape other users' records.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: Creating `/vehicles/v1` with `request.auth == null` → `PERMISSION_DENIED`.
2. **Identity Spoofing on Create**: User A (`uidA`) attempts to create `/vehicles/v2` with `ownerId: "uidB"` → `PERMISSION_DENIED`.
3. **Cross-User Read (`get`)**: User A attempts `get(/vehicles/vOwnedByB)` → `PERMISSION_DENIED`.
4. **Unscoped List Scraping**: User A queries `collection('vehicles')` without `where('ownerId', '==', uidA)` → `PERMISSION_DENIED`.
5. **Shadow Field Injection**: User A creates `/vehicles/v3` adding an extra field `isAdmin: true` → `PERMISSION_DENIED` (`hasOnly` check).
6. **Owner Reassignment on Update**: User A updates `/vehicles/vOwnedByA` attempting to change `ownerId` to `"uidB"` → `PERMISSION_DENIED`.
7. **Client Timestamp Forgery**: User A creates `/vehicles/v4` with a hardcoded past ISO string or timestamp instead of `request.time` → `PERMISSION_DENIED`.
8. **CreatedAt Tampering on Update**: User A updates `/vehicles/vOwnedByA` modifying `createdAt` → `PERMISSION_DENIED`.
9. **Oversized Document ID Poisoning**: User A attempts `create` on `/vehicles/` with a 500-char or `..` invalid ID → `PERMISSION_DENIED` (`isValidId`).
10. **Unbounded Array Resource Attack**: User A attempts to write 25 partners or 50 media attachments → `PERMISSION_DENIED` (`size()` bounds).
11. **Oversized String Denial-of-Wallet**: User A injects a 50,000-character string into `notes` or `vehicleNumber` → `PERMISSION_DENIED` (`size() <= max`).
12. **Cross-User PII Access**: User A attempts `get(/users/uidB)` or `list(/users)` to read User B's phone number → `PERMISSION_DENIED`.
