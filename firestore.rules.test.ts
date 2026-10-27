/**
 * Phase 0 & Phase 5 Security Rules Verification Suite ("Dirty Dozen" Payloads)
 * Verifies that all 12 adversarial payloads defined in security_spec.md are rejected.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on PublicProfile',
    collectionPath: '/publicProfiles/u1',
    operation: 'create',
    authUid: 'u1',
    payload: {
      uid: 'u1',
      username: 'Rahim',
      avatar: 'emerald_lotus',
      preferredLanguage: 'bn',
      status: 'online',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      isAdmin: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-User Profile Spoofing',
    collectionPath: '/publicProfiles/u1',
    operation: 'update',
    authUid: 'u2',
    payload: { username: 'Spoofed' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'PII Leak Attempt on /userPrivate/u1 by u2',
    collectionPath: '/userPrivate/u1',
    operation: 'get',
    authUid: 'u2',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Client Timestamp Forgery on PublicProfile',
    collectionPath: '/publicProfiles/u1',
    operation: 'create',
    authUid: 'u1',
    payload: {
      uid: 'u1',
      username: 'Rahim',
      avatar: 'emerald_lotus',
      preferredLanguage: 'bn',
      status: 'online',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Denial-of-Wallet Oversized Username String',
    collectionPath: '/publicProfiles/u1',
    operation: 'create',
    authUid: 'u1',
    payload: {
      uid: 'u1',
      username: 'A'.repeat(5000),
      avatar: 'emerald_lotus',
      preferredLanguage: 'bn',
      status: 'online',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Negative Statistics Injection',
    collectionPath: '/publicProfiles/u1',
    operation: 'update',
    authUid: 'u1',
    payload: { wins: -5, gamesPlayed: -1 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Unauthorized Friend Request Acceptance by Sender',
    collectionPath: '/friendRequests/req1',
    operation: 'update',
    authUid: 'u1',
    payload: { status: 'accepted' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Mutating Terminal Declined Friend Request',
    collectionPath: '/friendRequests/req_declined',
    operation: 'update',
    authUid: 'u2',
    payload: { status: 'accepted' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Unfiltered List Scraping on /matchHistory',
    collectionPath: '/matchHistory',
    operation: 'list',
    authUid: 'u3',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Unfiltered List Scraping on /friendRequests',
    collectionPath: '/friendRequests',
    operation: 'list',
    authUid: 'u3',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Mutating Immutable createdAt on Profile Update',
    collectionPath: '/publicProfiles/u1',
    operation: 'update',
    authUid: 'u1',
    payload: { createdAt: '2026-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Orphaned MatchHistory Write Without Profile',
    collectionPath: '/matchHistory/m1',
    operation: 'create',
    authUid: 'nonexistent_user',
    payload: { ownerUid: 'nonexistent_user', result: 'win' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
