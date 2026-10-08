import {
  FideGame,
  FideTitle,
  GameResult,
  GameTermination,
  MonthlyRatingRecord,
  OpponentPlayer,
  PlayerColor,
  PlayerProfile,
  TimeControlCategory,
  Tournament,
  TournamentFormat,
  TournamentStatus,
} from '../types/fide';
import { getPlayerScoreFromResult } from './fideMath';

const VALID_TITLES: FideTitle[] = [
  'None',
  'CM',
  'FM',
  'IM',
  'GM',
  'WCM',
  'WFM',
  'WIM',
  'WGM',
];
const VALID_K: (10 | 20 | 40)[] = [10, 20, 40];
const VALID_TIME_CONTROLS: TimeControlCategory[] = ['Standard', 'Rapid', 'Blitz'];
const VALID_FORMATS: TournamentFormat[] = [
  'Swiss',
  'Round Robin',
  'Team',
  'Knockout',
];
const VALID_STATUSES: TournamentStatus[] = ['upcoming', 'ongoing', 'completed'];
const VALID_COLORS: PlayerColor[] = ['White', 'Black'];
const VALID_RESULTS: GameResult[] = ['1-0', '0-1', '1/2-1/2'];
const VALID_TERMINATIONS: GameTermination[] = [
  'Checkmate',
  'Resignation',
  'Time Forfeit',
  'Agreement',
  'Stalemate',
  'Threefold Repetition',
  'Insufficient Material',
];

function clampNumber(
  val: number,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

function sanitizeString(val: string | undefined, maxLen: number, fallback = ''): string {
  const trimmed = (val ?? '').trim();
  if (!trimmed && fallback) return fallback;
  return trimmed.slice(0, maxLen);
}

export function sanitizePlayerProfilePayload(
  uid: string,
  input: Omit<PlayerProfile, 'uid'>
): PlayerProfile {
  const fed = (input.federation || 'FRA')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);
  const rawFideId = (input.fideId || '').replace(/[^0-9]/g, '').slice(0, 20);
  const rawFfeId = (input.ffeId || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15);
  const validTitle = VALID_TITLES.includes(input.fideTitle)
    ? input.fideTitle
    : 'None';
  const validK = VALID_K.includes(input.kFactor) ? input.kFactor : 20;

  return {
    uid,
    displayName: sanitizeString(input.displayName, 80, 'Mon Profil FIDE'),
    fideId: rawFideId,
    ffeId: rawFfeId,
    federation: fed || 'FRA',
    club: sanitizeString(input.club, 100, ''),
    fideTitle: validTitle,
    birthYear: Math.round(clampNumber(Number(input.birthYear), 1900, 2026, 2000)),
    kFactor: validK,
    standardElo: Math.round(
      clampNumber(Number(input.standardElo), 800, 3500, 1500)
    ),
    rapidElo: Math.round(clampNumber(Number(input.rapidElo), 800, 3500, 1500)),
    blitzElo: Math.round(clampNumber(Number(input.blitzElo), 800, 3500, 1500)),
    targetElo: Math.round(
      clampNumber(Number(input.targetElo), 800, 3500, 1800)
    ),
  };
}

export function getOpponentEloForCadence(
  opp: Pick<OpponentPlayer, 'elo' | 'standardElo' | 'rapidElo' | 'blitzElo'>,
  cadence: TimeControlCategory
): number {
  if (cadence === 'Rapid') {
    return Number(opp.rapidElo) || Number(opp.standardElo) || Number(opp.elo) || 1500;
  }
  if (cadence === 'Blitz') {
    return Number(opp.blitzElo) || Number(opp.standardElo) || Number(opp.elo) || 1500;
  }
  return Number(opp.standardElo) || Number(opp.elo) || 1500;
}

export function sanitizeOpponentPayload(
  input: Omit<OpponentPlayer, 'id'>
): Omit<OpponentPlayer, 'id'> {
  const fallbackElo = Math.round(
    clampNumber(Number(input.standardElo || input.elo), 800, 3500, 1500)
  );
  const standardElo = Math.round(
    clampNumber(Number(input.standardElo ?? input.elo), 800, 3500, fallbackElo)
  );
  const rapidElo = Math.round(
    clampNumber(Number(input.rapidElo ?? standardElo), 800, 3500, standardElo)
  );
  const blitzElo = Math.round(
    clampNumber(Number(input.blitzElo ?? standardElo), 800, 3500, standardElo)
  );

  return {
    name: sanitizeString(input.name, 80, 'Adversaire'),
    fideId: (input.fideId || '').replace(/[^0-9]/g, '').slice(0, 20),
    ffeId: (input.ffeId || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 15),
    elo: standardElo,
    standardElo,
    rapidElo,
    blitzElo,
    title: VALID_TITLES.includes(input.title) ? input.title : 'None',
    federation:
      (input.federation || 'FRA')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 3) || 'FRA',
    club: sanitizeString(input.club, 100, ''),
    notes: sanitizeString(input.notes, 1000, ''),
  };
}

export function sanitizeTournamentPayload(
  ownerId: string,
  input: Omit<Tournament, 'id' | 'ownerId'>
): Omit<Tournament, 'id'> {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = input.startDate || today;
  const endDate = input.endDate || startDate;
  const tc = VALID_TIME_CONTROLS.includes(input.timeControl)
    ? input.timeControl
    : 'Standard';
  const fmt = VALID_FORMATS.includes(input.format) ? input.format : 'Swiss';
  const st = VALID_STATUSES.includes(input.status) ? input.status : 'ongoing';

  return {
    ownerId,
    name: sanitizeString(input.name, 120, 'Tournoi FIDE'),
    location: sanitizeString(input.location, 100, 'France'),
    startDate,
    endDate,
    timeControl: tc,
    timeControlDetails: sanitizeString(
      input.timeControlDetails,
      100,
      '90 min + 30 sec/coup'
    ),
    format: fmt,
    totalRounds: Math.round(clampNumber(Number(input.totalRounds), 1, 30, 9)),
    totalPlayers: input.totalPlayers
      ? Math.round(clampNumber(Number(input.totalPlayers), 2, 5000, 60))
      : undefined,
    finalRank: input.finalRank
      ? Math.round(clampNumber(Number(input.finalRank), 1, 5000, 1))
      : undefined,
    startingElo: Math.round(
      clampNumber(Number(input.startingElo), 800, 3500, 1500)
    ),
    status: st,
    normTarget: sanitizeString(input.normTarget, 80, ''),
    notes: sanitizeString(input.notes, 1000, ''),
  };
}

export function sanitizeFideGamePayload(
  ownerId: string,
  input: Omit<FideGame, 'id' | 'ownerId'>
): Omit<FideGame, 'id'> {
  const today = new Date().toISOString().slice(0, 10);
  const datePlayed = input.datePlayed || today;
  const tc = VALID_TIME_CONTROLS.includes(input.timeControl)
    ? input.timeControl
    : 'Standard';
  const color = VALID_COLORS.includes(input.playerColor)
    ? input.playerColor
    : 'White';
  const oppTitle = VALID_TITLES.includes(input.opponentTitle)
    ? input.opponentTitle
    : 'None';
  const oppFed =
    (input.opponentFederation || 'FRA')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 3) || 'FRA';
  const res = VALID_RESULTS.includes(input.result) ? input.result : '1/2-1/2';
  const score = getPlayerScoreFromResult(res, color);
  const validK = VALID_K.includes(input.kFactorUsed) ? input.kFactorUsed : 20;
  const validTerm = VALID_TERMINATIONS.includes(input.termination)
    ? input.termination
    : 'Resignation';

  return {
    ownerId,
    tournamentId: sanitizeString(input.tournamentId, 128, 'default_tourney'),
    tournamentName: sanitizeString(input.tournamentName, 120, 'Tournoi FIDE'),
    round: Math.round(clampNumber(Number(input.round), 1, 30, 1)),
    datePlayed,
    timeControl: tc,
    playerColor: color,
    playerElo: Math.round(clampNumber(Number(input.playerElo), 800, 3500, 1500)),
    opponentId: input.opponentId || undefined,
    opponentName: sanitizeString(input.opponentName, 80, 'Adversaire'),
    opponentFideId: (input.opponentFideId || '')
      .replace(/[^0-9]/g, '')
      .slice(0, 20),
    opponentFfeId: (input.opponentFfeId || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 15),
    opponentTitle: oppTitle,
    opponentElo: Math.round(
      clampNumber(Number(input.opponentElo), 800, 3500, 1500)
    ),
    opponentFederation: oppFed,
    result: res,
    playerScore: score,
    eloChange:
      Math.round(clampNumber(Number(input.eloChange), -150, 150, 0) * 10) / 10,
    kFactorUsed: validK,
    ecoCode: sanitizeString((input.ecoCode || '').toUpperCase(), 6, ''),
    openingName: sanitizeString(input.openingName, 120, ''),
    movesCount: Math.round(clampNumber(Number(input.movesCount), 0, 300, 0)),
    termination: validTerm,
    pgn: sanitizeString(input.pgn, 8000, ''),
    chessComUrl: sanitizeString(input.chessComUrl, 500, ''),
    keyMomentNote: sanitizeString(input.keyMomentNote, 1000, ''),
  };
}

export function sanitizeMonthlyRatingPayload(
  ownerId: string,
  input: Omit<MonthlyRatingRecord, 'id' | 'ownerId'>
): Omit<MonthlyRatingRecord, 'id'> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const period = input.period || currentMonth;

  return {
    ownerId,
    period,
    standardElo: Math.round(
      clampNumber(Number(input.standardElo), 800, 3500, 1500)
    ),
    rapidElo: Math.round(clampNumber(Number(input.rapidElo), 800, 3500, 1500)),
    blitzElo: Math.round(clampNumber(Number(input.blitzElo), 800, 3500, 1500)),
    standardGamesCount: Math.round(
      clampNumber(Number(input.standardGamesCount), 0, 200, 0)
    ),
    standardDelta:
      Math.round(clampNumber(Number(input.standardDelta), -500, 500, 0) * 10) /
      10,
    fideRankNational: Math.round(
      clampNumber(Number(input.fideRankNational), 0, 1000000, 0)
    ),
    notes: sanitizeString(input.notes, 400, ''),
  };
}
