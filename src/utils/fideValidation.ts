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

export const FREE_GAME_TOURNAMENT_ID = 'free_game';
export const FREE_GAME_TOURNAMENT_NAME = 'Partie libre (Hors tournoi)';

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

function sanitizeString(
  val: string | undefined,
  maxLen: number,
  fallback = ''
): string {
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
    .slice(0, 4);
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
    birthYear: Math.round(
      clampNumber(Number(input.birthYear), 1900, 2026, 2000)
    ),
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

export function isOpponentEloUnknownForCadence(
  opp: Pick<
    OpponentPlayer,
    | 'elo'
    | 'standardElo'
    | 'rapidElo'
    | 'blitzElo'
    | 'isEloUnknown'
    | 'isStandardEloUnknown'
    | 'isRapidEloUnknown'
    | 'isBlitzEloUnknown'
  >,
  cadence: TimeControlCategory
): boolean {
  if (opp.isEloUnknown) return true;
  if (cadence === 'Rapid') {
    return (
      Boolean(opp.isRapidEloUnknown) ||
      opp.rapidElo === undefined ||
      opp.rapidElo === null ||
      Number(opp.rapidElo) <= 0
    );
  }
  if (cadence === 'Blitz') {
    return (
      Boolean(opp.isBlitzEloUnknown) ||
      opp.blitzElo === undefined ||
      opp.blitzElo === null ||
      Number(opp.blitzElo) <= 0
    );
  }
  return (
    Boolean(opp.isStandardEloUnknown) ||
    (!opp.standardElo && !opp.elo) ||
    Number(opp.standardElo || opp.elo) <= 0
  );
}

export function getOpponentEloForCadence(
  opp: Pick<
    OpponentPlayer,
    | 'elo'
    | 'standardElo'
    | 'rapidElo'
    | 'blitzElo'
    | 'isEloUnknown'
    | 'isStandardEloUnknown'
    | 'isRapidEloUnknown'
    | 'isBlitzEloUnknown'
  >,
  cadence: TimeControlCategory
): number {
  if (isOpponentEloUnknownForCadence(opp, cadence)) {
    return 0;
  }
  if (cadence === 'Rapid') {
    return Number(opp.rapidElo) || 0;
  }
  if (cadence === 'Blitz') {
    return Number(opp.blitzElo) || 0;
  }
  return Number(opp.standardElo) || Number(opp.elo) || 0;
}

export function formatEloDisplay(
  elo: number | undefined,
  isUnknown?: boolean
): string {
  if (isUnknown || elo === undefined || elo === null || Number(elo) <= 0) {
    return '?';
  }
  return String(Math.round(Number(elo)));
}

function capitalizeFirstName(raw: string): string {
  return raw
    .trim()
    .split(/(\s+|-)/)
    .map((part) => {
      if (!part || /^(\s+|-)$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

export function hasQuestionMarkInName(rawName: string | undefined): boolean {
  return Boolean(rawName && rawName.includes('?'));
}

export function hasQuestionMarkName(rawName: string | undefined): boolean {
  return hasQuestionMarkInName(rawName);
}

/**
 * Formate un nom de joueur sous la forme stricte : "NOM, Prénom" (sans ID FIDE ni FFE).
 * Si isUncertain === true, ajoute " ?" à la fin.
 */
export function formatPlayerNameLastFirst(
  rawName: string,
  isUncertain?: boolean
): string {
  const cleaned = (rawName || '')
    .replace(/\(.*?\)/g, '')
    .replace(/·.*$/g, '')
    .replace(/\?/g, '')
    .trim();

  const uncertainSuffix = isUncertain ? ' ?' : '';

  if (!cleaned) {
    return uncertainSuffix ? 'INCONNU ?' : 'ADVERSAIRE';
  }

  let baseFormatted = '';

  if (cleaned.includes(',')) {
    const [lastPart, ...firstParts] = cleaned.split(',');
    const lastName = lastPart.trim().toUpperCase();
    const firstName = capitalizeFirstName(firstParts.join(' '));
    baseFormatted = firstName ? `${lastName}, ${firstName}` : lastName;
  } else {
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      baseFormatted = words[0].toUpperCase();
    } else {
      const firstWord = words[0];
      const secondWord = words[1];
      if (
        firstWord.length > 1 &&
        firstWord === firstWord.toUpperCase() &&
        secondWord !== secondWord.toUpperCase()
      ) {
        const lastName = firstWord.toUpperCase();
        const firstName = capitalizeFirstName(words.slice(1).join(' '));
        baseFormatted = `${lastName}, ${firstName}`;
      } else {
        const lastName = words[words.length - 1].toUpperCase();
        const firstName = capitalizeFirstName(words.slice(0, -1).join(' '));
        baseFormatted = `${lastName}, ${firstName}`;
      }
    }
  }

  return `${baseFormatted}${uncertainSuffix}`;
}

export function formatPlayerNameDisplay(
  rawName: string,
  isUncertain?: boolean
): string {
  const uncertain = Boolean(isUncertain || hasQuestionMarkInName(rawName));
  return formatPlayerNameLastFirst(rawName, uncertain);
}

/**
 * Nettoie un nom sans le point d'interrogation pour l'édition dans un champ texte
 */
export function stripQuestionMarkFromName(rawName: string): string {
  return formatPlayerNameLastFirst(rawName, false).replace(/\s*\?$/, '').trim();
}

/**
 * Trie les joueurs affrontés par ordre alphabétique sur "NOM, Prénom"
 */
export function sortOpponentsAlphabetically(
  opponents: OpponentPlayer[]
): OpponentPlayer[] {
  return [...opponents].sort((a, b) =>
    stripQuestionMarkFromName(a.name).localeCompare(
      stripQuestionMarkFromName(b.name),
      'fr',
      { sensitivity: 'base' }
    )
  );
}

export function sanitizeOpponentPayload(
  input: Omit<OpponentPlayer, 'id'>
): Omit<OpponentPlayer, 'id'> {
  const isNameUncertain =
    Boolean(input.isNameUncertain) || hasQuestionMarkInName(input.name);

  const isEloUnknown = Boolean(input.isEloUnknown);
  const isStandardEloUnknown =
    isEloUnknown ||
    Boolean(input.isStandardEloUnknown) ||
    Number(input.standardElo ?? input.elo) <= 0;
  const isRapidEloUnknown =
    isEloUnknown ||
    Boolean(input.isRapidEloUnknown) ||
    input.rapidElo === undefined ||
    input.rapidElo === null ||
    Number(input.rapidElo) <= 0;
  const isBlitzEloUnknown =
    isEloUnknown ||
    Boolean(input.isBlitzEloUnknown) ||
    input.blitzElo === undefined ||
    input.blitzElo === null ||
    Number(input.blitzElo) <= 0;

  const standardElo = isStandardEloUnknown
    ? 0
    : Math.round(
        clampNumber(Number(input.standardElo ?? input.elo), 600, 3500, 1500)
      );
  const rapidElo = isRapidEloUnknown
    ? 0
    : Math.round(
        clampNumber(Number(input.rapidElo), 600, 3500, 0)
      );
  const blitzElo = isBlitzEloUnknown
    ? 0
    : Math.round(
        clampNumber(Number(input.blitzElo), 600, 3500, 0)
      );

  return {
    name: formatPlayerNameLastFirst(
      sanitizeString(input.name, 80, isNameUncertain ? 'INCONNU' : 'Adversaire'),
      isNameUncertain
    ),
    isNameUncertain,
    fideId: (input.fideId || '').replace(/[^0-9]/g, '').slice(0, 20),
    ffeId: (input.ffeId || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 15),
    elo: standardElo,
    standardElo,
    rapidElo,
    blitzElo,
    isEloUnknown:
      isStandardEloUnknown && isRapidEloUnknown && isBlitzEloUnknown,
    isStandardEloUnknown,
    isRapidEloUnknown,
    isBlitzEloUnknown,
    title: VALID_TITLES.includes(input.title) ? input.title : 'None',
    federation:
      (input.federation || 'FRA')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 4) || 'FRA',
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
    name: sanitizeString(input.name, 120, 'Tournoi'),
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
      .slice(0, 4) || 'FRA';
  const res = VALID_RESULTS.includes(input.result) ? input.result : '1/2-1/2';
  const score = getPlayerScoreFromResult(res, color);
  const validK = VALID_K.includes(input.kFactorUsed) ? input.kFactorUsed : 20;
  const validTerm = VALID_TERMINATIONS.includes(input.termination)
    ? input.termination
    : 'Resignation';

  const opponentNameUncertain =
    Boolean(input.opponentNameUncertain) ||
    hasQuestionMarkInName(input.opponentName);
  const opponentEloUnknown =
    Boolean(input.opponentEloUnknown) || Number(input.opponentElo) <= 0;

  const isFreeGame =
    !input.tournamentId || input.tournamentId === FREE_GAME_TOURNAMENT_ID;

  return {
    ownerId,
    tournamentId: isFreeGame
      ? FREE_GAME_TOURNAMENT_ID
      : sanitizeString(input.tournamentId, 128, FREE_GAME_TOURNAMENT_ID),
    tournamentName: isFreeGame
      ? sanitizeString(input.tournamentName, 120, FREE_GAME_TOURNAMENT_NAME)
      : sanitizeString(input.tournamentName, 120, 'Tournoi'),
    round: Math.round(clampNumber(Number(input.round), 1, 50, 1)),
    datePlayed,
    timeControl: tc,
    playerColor: color,
    playerElo: Math.round(clampNumber(Number(input.playerElo), 600, 3500, 1500)),
    opponentId: input.opponentId || undefined,
    opponentName: formatPlayerNameLastFirst(
      sanitizeString(
        input.opponentName,
        80,
        opponentNameUncertain ? 'INCONNU' : 'Adversaire'
      ),
      opponentNameUncertain
    ),
    opponentNameUncertain,
    opponentFideId: (input.opponentFideId || '')
      .replace(/[^0-9]/g, '')
      .slice(0, 20),
    opponentFfeId: (input.opponentFfeId || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 15),
    opponentTitle: oppTitle,
    opponentElo: opponentEloUnknown
      ? 0
      : Math.round(clampNumber(Number(input.opponentElo), 600, 3500, 1500)),
    opponentEloUnknown,
    opponentFederation: oppFed,
    result: res,
    playerScore: score,
    eloChange: Math.round(clampNumber(Number(input.eloChange || 0), -150, 150, 0) * 10) / 10,
    kFactorUsed: validK,
    ecoCode: sanitizeString((input.ecoCode || '').toUpperCase(), 6, ''),
    openingName: sanitizeString(input.openingName, 120, ''),
    movesCount: Math.round(clampNumber(Number(input.movesCount), 0, 300, 0)),
    termination: validTerm,
    pgn: sanitizeString(input.pgn, 12000, ''),
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
