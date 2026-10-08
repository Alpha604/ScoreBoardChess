/**
 * Verification test specification for the "Dirty Dozen" adversarial payloads
 * defined in security_spec.md against firestore.rules.
 */

export interface AdversarialPayloadTestCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'create' | 'update' | 'get' | 'list';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: AdversarialPayloadTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on PlayerProfile',
    collection: 'players',
    docId: 'user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      uid: 'user_1',
      displayName: 'Roméo Carlsen',
      fideId: '65104823',
      federation: 'FRA',
      club: 'Lille Echecs',
      fideTitle: 'None',
      birthYear: 2004,
      kFactor: 20,
      standardElo: 1850,
      rapidElo: 1890,
      blitzElo: 1920,
      targetElo: 2000,
      isAdmin: true, // Shadow field
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Tournament Create',
    collection: 'tournaments',
    docId: 'tourney_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      ownerId: 'user_2', // Spoofed ownerId
      name: 'Open de Cappelle',
      location: 'Cappelle, FRA',
      startDate: '2026-02-15',
      endDate: '2026-02-21',
      timeControl: 'Standard',
      timeControlDetails: '90m+30s',
      format: 'Swiss',
      totalRounds: 9,
      startingElo: 1850,
      status: 'ongoing',
      normTarget: 'Open A',
      notes: '',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Write Attempt',
    collection: 'players',
    docId: 'user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    payload: {
      uid: 'user_1',
      displayName: 'Unverified Player',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Orphaned Game Creation (Non-existent Tournament)',
    collection: 'games',
    docId: 'game_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      ownerId: 'user_1',
      tournamentId: 'non_existent_tourney_id',
      tournamentName: 'Ghost Tournament',
      round: 1,
      datePlayed: '2026-03-01',
      timeControl: 'Standard',
      playerColor: 'White',
      playerElo: 1850,
      opponentName: 'Dupont, Jean',
      opponentFideId: '12345678',
      opponentTitle: 'None',
      opponentElo: 1800,
      opponentFederation: 'FRA',
      result: '1-0',
      playerScore: 1,
      eloChange: 8.6,
      kFactorUsed: 20,
      ecoCode: 'B90',
      openingName: 'Sicilian Najdorf',
      movesCount: 40,
      termination: 'Resignation',
      pgn: '1. e4 c5',
      keyMomentNote: '',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-Tenant Tournament Reference on Game',
    collection: 'games',
    docId: 'game_2',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      ownerId: 'user_1',
      tournamentId: 'tourney_owned_by_user_2',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Terminal State Mutation on Completed Tournament',
    collection: 'tournaments',
    docId: 'completed_tourney_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      name: 'Mutated After Completion',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Value Poisoning on Game Update (Oversized PGN)',
    collection: 'games',
    docId: 'game_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      pgn: '1. e4 e5 '.repeat(1000), // > 5000 chars
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning Attack',
    collection: 'tournaments',
    docId: 'invalid$doc!id',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Timestamp Forgery on Create',
    collection: 'ratingHistory',
    docId: 'rating_2026_01',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      ownerId: 'user_1',
      period: '2026-01',
      standardElo: 1850,
      rapidElo: 1880,
      blitzElo: 1900,
      standardGamesCount: 9,
      standardDelta: 15,
      fideRankNational: 0,
      notes: 'Forged timestamp',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immortal Field Mutation on Update',
    collection: 'ratingHistory',
    docId: 'rating_2026_01',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      ownerId: 'user_2',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Invalid ECO Code Regex Bypass',
    collection: 'games',
    docId: 'game_3',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      ecoCode: 'Z99', // Must match ^[A-E][0-9]{2}$
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Blanket List Scraping',
    collection: 'games',
    docId: '*',
    operation: 'list',
    auth: { uid: 'attacker_uid', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
