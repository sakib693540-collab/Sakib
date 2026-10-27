# Sholo Guti Cloud Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Split-Collection PII Isolation**:
   - `/publicProfiles/{userId}` NEVER stores `email`, `phone`, or private credentials. It only stores approved public fields (`uid`, `username`, `avatar`, `preferredLanguage`, `status`, `gamesPlayed`, `wins`, `losses`, `draws`, `createdAt`, `updatedAt`).
   - `/userPrivate/{userId}` stores the user's `email`, preferences, and `driveBackupFileId`, and is strictly accessible ONLY when `request.auth.uid == userId`.
2. **Strict Identity Ownership**:
   - Every write to `/publicProfiles/{userId}` and `/userPrivate/{userId}` requires `request.auth.uid == userId` and `incoming().uid == userId`.
   - Every write to `/matchHistory/{matchId}` requires `incoming().ownerUid == request.auth.uid` and `exists(/databases/$(database)/documents/publicProfiles/$(request.auth.uid))`.
   - Every write to `/playerReports/{reportId}` requires `incoming().reporterUid == request.auth.uid`.
3. **Immutable & Server-Timestamped Fields**:
   - `createdAt`, `uid`, `ownerUid`, `fromUid`, `toUid`, and `reporterUid` are strictly immutable on update.
   - `createdAt` must equal `request.time` on create; `updatedAt` must equal `request.time` on create and update.
4. **Terminal State & Action-Based Updates**:
   - In `/friendRequests/{requestId}`, status transitions from `'pending'` to `'accepted'` or `'declined'` can only be performed by the recipient (`toUid == request.auth.uid`). Once `'declined'`, no further updates are allowed.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on PublicProfile**:
   `{ uid: "u1", username: "Rahim", avatar: "lotus", preferredLanguage: "bn", status: "online", gamesPlayed: 0, wins: 0, losses: 0, draws: 0, createdAt: SERVER_TIME, updatedAt: SERVER_TIME, isAdmin: true }` -> Rejected by `hasOnly()`.
2. **Cross-User Profile Spoofing**:
   User `u2` writing to `/publicProfiles/u1` with `uid: "u1"` -> Rejected by `request.auth.uid == userId`.
3. **PII Leak Attempt on `/userPrivate/u1` by `u2`**:
   User `u2` calling `get` or `list` on `/userPrivate/u1` -> Rejected because `allow get: if isSignedIn() && request.auth.uid == userId` and `allow list: if false`.
4. **Client Timestamp Forgery**:
   Creating `/publicProfiles/u1` with a past or future `createdAt` instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
5. **Denial-of-Wallet 1MB Username String**:
   Setting `username` to a 5,000-character string -> Rejected by `data.username.size() <= 32`.
6. **Negative Statistics Injection**:
   Setting `wins: -5` or `gamesPlayed: -1` -> Rejected by `data.wins >= 0 && data.gamesPlayed >= 0`.
7. **Unauthorized Friend Request Acceptance by Sender**:
   Sender `u1` updating `/friendRequests/req1` (`fromUid: "u1", toUid: "u2"`) to `status: "accepted"` -> Rejected because status transition requires `existing().toUid == request.auth.uid`.
8. **Mutating Terminal Declined Friend Request**:
   Updating `/friendRequests/req1` after `existing().status == "declined"` -> Rejected by terminal state lock.
9. **Unfiltered List Scraping on `/matchHistory`**:
   User `u1` running an unconstrained `list` query across all users' `/matchHistory` -> Rejected by `allow list: if isSignedIn() && resource.data.ownerUid == request.auth.uid`.
10. **Unfiltered List Scraping on `/friendRequests`**:
    User `u3` querying `/friendRequests` where `u3` is neither `fromUid` nor `toUid` -> Rejected by `resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid`.
11. **Mutating Immutable `createdAt` or `uid` on Profile Update**:
    Updating `/publicProfiles/u1` with a modified `createdAt` -> Rejected by `incoming().createdAt == existing().createdAt` and `affectedKeys().hasOnly(...)`.
12. **Orphaned MatchHistory Write Without Profile**:
    Writing to `/matchHistory/m1` when `/publicProfiles/$(request.auth.uid)` does not exist -> Rejected by `exists(/databases/$(database)/documents/publicProfiles/$(request.auth.uid))`.
