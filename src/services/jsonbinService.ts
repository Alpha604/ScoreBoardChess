import {
  FideGame,
  MonthlyRatingRecord,
  OpponentPlayer,
  PlayerProfile,
  Tournament,
} from '../types/fide';
import {
  formatPlayerNameLastFirst,
  FREE_GAME_TOURNAMENT_ID,
  FREE_GAME_TOURNAMENT_NAME,
  hasQuestionMarkInName,
  stripQuestionMarkFromName,
} from '../utils/fideValidation';

// BIN #1 : Base Officielle des Parties Classées FIDE
export const DEFAULT_JSONBIN_BIN_ID = '6ac7d7e6ac6210605a20528d';
export const DEFAULT_JSONBIN_MASTER_KEY =
  '$2a$10$JryE9oeTsODdtBZ1Bw4H1upy2iTTEu3lKWoCGYVNoGXylvwIZHDwG';

// BIN #2 : Base Indépendante des Parties Amicales
export const DEFAULT_FRIENDLY_JSONBIN_BIN_ID = '6aca804bffd5d160535fa90f';
export const DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY =
  '$2a$10$JryE9oeTsODdtBZ1Bw4H1upy2iTTEu3lKWoCGYVNoGXylvwIZHDwG';

const LOCAL_STORAGE_FIDE_CACHE_KEY = 'fide_chess_ledger_jsonbin_cache_v2';
const LOCAL_STORAGE_FRIENDLY_CACHE_KEY = 'friendly_chess_ledger_jsonbin_cache_v1';
const LOCAL_STORAGE_AUTH_KEY = 'fide_chess_ledger_session_v2';
const LOCAL_STORAGE_DELETED_VAULT_KEY = 'chess_ledger_deleted_vault_v1';
const LOCAL_STORAGE_SNAPSHOTS_KEY = 'chess_ledger_local_snapshots_v1';

export interface FideLedgerDatabase {
  version: number;
  updatedAt: string;
  profile: PlayerProfile;
  opponents: OpponentPlayer[];
  tournaments: Tournament[];
  games: FideGame[];
  ratingHistory: MonthlyRatingRecord[];
}

export interface FriendlyLedgerDatabase {
  version: number;
  ledgerType: 'friendly_chess_ledger';
  updatedAt: string;
  opponents: OpponentPlayer[];
  tournaments: Tournament[];
  games: FideGame[];
}

export interface SessionConfig {
  isAuthenticated: boolean;
  playerName: string;
  binId: string;
  masterKey: string;
  friendlyBinId: string;
  friendlyMasterKey: string;
}

export interface BinSyncStatus {
  binId: string;
  state: 'idle' | 'synced' | 'syncing' | 'local_cache' | 'error';
  lastSyncedAt: string | null;
  lastError: string | null;
  getRequestsCount: number;
  putRequestsCount: number;
}

export interface DeletedVaultItem {
  id: string;
  deletedAt: string;
  ledger: 'fide' | 'friendly';
  itemType: 'tournament' | 'game' | 'opponent' | 'rating';
  label: string;
  details: string;
  data: unknown;
  associatedGames?: FideGame[];
}

export interface LocalSnapshotItem {
  id: string;
  createdAt: string;
  ledger: 'fide' | 'friendly';
  reason: string;
  summary: string;
  payload: FideLedgerDatabase | FriendlyLedgerDatabase;
}

export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  uid: 'default_player',
  displayName: 'Mon Profil Échecs',
  fideId: '65104823',
  ffeId: 'K59412',
  federation: 'FRA',
  club: 'Club d’Échecs',
  fideTitle: 'None',
  birthYear: 2003,
  kFactor: 20,
  standardElo: 1868,
  rapidElo: 1905,
  blitzElo: 1932,
  targetElo: 2000,
};

export function getSavedSession(): SessionConfig {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
    if (!raw) {
      return {
        isAuthenticated: false,
        playerName: '',
        binId: DEFAULT_JSONBIN_BIN_ID,
        masterKey: DEFAULT_JSONBIN_MASTER_KEY,
        friendlyBinId: DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
        friendlyMasterKey: DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      isAuthenticated: Boolean(parsed.isAuthenticated),
      playerName: parsed.playerName || 'Mon Profil Échecs',
      binId: parsed.binId || DEFAULT_JSONBIN_BIN_ID,
      masterKey: parsed.masterKey || DEFAULT_JSONBIN_MASTER_KEY,
      friendlyBinId: parsed.friendlyBinId || DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
      friendlyMasterKey:
        parsed.friendlyMasterKey ||
        parsed.masterKey ||
        DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY,
    };
  } catch {
    return {
      isAuthenticated: false,
      playerName: '',
      binId: DEFAULT_JSONBIN_BIN_ID,
      masterKey: DEFAULT_JSONBIN_MASTER_KEY,
      friendlyBinId: DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
      friendlyMasterKey: DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY,
    };
  }
}

export function saveSession(session: SessionConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(session));
  } catch {
    // Ignore
  }
}

export function clearSession(): void {
  try {
    const current = getSavedSession();
    localStorage.setItem(
      LOCAL_STORAGE_AUTH_KEY,
      JSON.stringify({
        ...current,
        isAuthenticated: false,
      })
    );
  } catch {
    // Ignore
  }
}

export function createEmptyDatabase(): FideLedgerDatabase {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: { ...DEFAULT_PLAYER_PROFILE },
    opponents: [],
    tournaments: [],
    games: [],
    ratingHistory: [],
  };
}

export function createEmptyFriendlyDatabase(): FriendlyLedgerDatabase {
  return {
    version: 1,
    ledgerType: 'friendly_chess_ledger',
    updatedAt: new Date().toISOString(),
    opponents: [],
    tournaments: [],
    games: [],
  };
}

/**
 * Fusionne les éventuels doublons de joueurs (même ID, même ID FIDE, même ID FFE ou même "NOM, Prénom")
 * en conservant les informations les plus récentes (Elos modifiés, notes, club...).
 */
export function deduplicateOpponents(opponents: OpponentPlayer[]): OpponentPlayer[] {
  const result: OpponentPlayer[] = [];

  for (const opp of opponents) {
    const isNameUncertain =
      Boolean(opp.isNameUncertain) || hasQuestionMarkInName(opp.name);
    const formattedName = formatPlayerNameLastFirst(opp.name, isNameUncertain);
    const baseName = stripQuestionMarkFromName(formattedName).toLowerCase();
    const cleanFide = (opp.fideId || '').trim();
    const cleanFfe = (opp.ffeId || '').trim().toUpperCase();

    const existingIdx = result.findIndex(
      (item) =>
        item.id === opp.id ||
        (cleanFide && item.fideId === cleanFide) ||
        (cleanFfe && item.ffeId.toUpperCase() === cleanFfe) ||
        stripQuestionMarkFromName(item.name).toLowerCase() === baseName
    );

    if (existingIdx === -1) {
      result.push({
        ...opp,
        name: formattedName,
        isNameUncertain,
      });
    } else {
      const prev = result[existingIdx];
      result[existingIdx] = {
        ...prev,
        ...opp,
        id: prev.id,
        name: formattedName,
        isNameUncertain,
        fideId: cleanFide || prev.fideId,
        ffeId: cleanFfe || prev.ffeId,
        club: opp.club || prev.club,
        notes: opp.notes || prev.notes,
      };
    }
  }

  return result;
}

/**
 * Reconstruit ou synchronise automatiquement la liste des joueurs affrontés
 * à partir des parties existantes UNIQUEMENT si un joueur n'est pas encore dans `opponents`.
 * Ne remplace jamais les Elos ou le nom d'un joueur déjà existant !
 */
export function syncOpponentsWithGames(
  opponents: OpponentPlayer[],
  games: FideGame[]
): OpponentPlayer[] {
  const list = deduplicateOpponents(opponents);

  for (const g of games) {
    const rawName = (g.opponentName || '').trim();
    if (!rawName) continue;

    const isUncertain =
      Boolean(g.opponentNameUncertain) || hasQuestionMarkInName(rawName);
    const formattedGameOppName = formatPlayerNameLastFirst(rawName, isUncertain);
    const baseGameOppName = stripQuestionMarkFromName(
      formattedGameOppName
    ).toLowerCase();
    const cleanFide = (g.opponentFideId || '').trim();
    const cleanFfe = (g.opponentFfeId || '').trim().toUpperCase();

    const foundIdx = list.findIndex(
      (o) =>
        (g.opponentId && o.id === g.opponentId) ||
        (cleanFide && o.fideId === cleanFide) ||
        (cleanFfe && o.ffeId.toUpperCase() === cleanFfe) ||
        stripQuestionMarkFromName(o.name).toLowerCase() === baseGameOppName
    );

    if (foundIdx === -1) {
      const isUnknownElo =
        Boolean(g.opponentEloUnknown) || Number(g.opponentElo) <= 0;
      const gameElo = isUnknownElo ? 0 : Number(g.opponentElo) || 1500;
      const isStd = g.timeControl === 'Standard';
      const isRap = g.timeControl === 'Rapid';
      const isBlz = g.timeControl === 'Blitz';

      list.push({
        id:
          g.opponentId ||
          `opp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: formattedGameOppName,
        isNameUncertain: isUncertain,
        fideId: cleanFide,
        ffeId: cleanFfe,
        elo: isStd ? gameElo : 0,
        standardElo: isStd ? gameElo : 0,
        rapidElo: isRap ? gameElo : 0,
        blitzElo: isBlz ? gameElo : 0,
        isEloUnknown: isUnknownElo && (isStd || isRap || isBlz),
        isStandardEloUnknown: isStd ? isUnknownElo : true,
        isRapidEloUnknown: isRap ? isUnknownElo : true,
        isBlitzEloUnknown: isBlz ? isUnknownElo : true,
        title: g.opponentTitle || 'None',
        federation: g.opponentFederation || 'FRA',
        club: '',
        notes: '',
      });
    } else {
      const existing = list[foundIdx];
      list[foundIdx] = {
        ...existing,
        fideId: existing.fideId || cleanFide,
        ffeId: existing.ffeId || cleanFfe,
        title:
          existing.title !== 'None'
            ? existing.title
            : g.opponentTitle || 'None',
      };
    }
  }

  return deduplicateOpponents(list);
}

function normalizeTournamentsArray(rawTournaments: unknown, defaultElo = 1500): Tournament[] {
  if (!Array.isArray(rawTournaments)) return [];
  return rawTournaments.map((t: Partial<Tournament>, idx: number) => ({
    id: t.id || `tourney_${idx + 1}`,
    ownerId: 'default_player',
    name: t.name || 'Tournoi',
    location: t.location || 'France',
    startDate: t.startDate || new Date().toISOString().slice(0, 10),
    endDate: t.endDate || new Date().toISOString().slice(0, 10),
    timeControl: t.timeControl || 'Standard',
    timeControlDetails: t.timeControlDetails || '90 min + 30 sec/coup',
    format: t.format || 'Swiss',
    totalRounds: Number(t.totalRounds) || 9,
    totalPlayers: t.totalPlayers ? Number(t.totalPlayers) : undefined,
    finalRank: t.finalRank ? Number(t.finalRank) : undefined,
    startingElo: Number(t.startingElo) || defaultElo,
    status: t.status || 'ongoing',
    normTarget: t.normTarget || '',
    notes: t.notes || '',
  }));
}

function normalizeGamesArray(
  rawGames: unknown,
  tournaments: Tournament[],
  defaultElo = 1500,
  isFriendly = false
): FideGame[] {
  if (!Array.isArray(rawGames)) return [];
  return rawGames.map((g: Partial<FideGame>, idx: number) => {
    const isNameUncertain =
      Boolean(g.opponentNameUncertain) ||
      hasQuestionMarkInName(g.opponentName);
    const isEloUnknown =
      Boolean(g.opponentEloUnknown) ||
      (g.opponentElo !== undefined && Number(g.opponentElo) <= 0);
    const isFree =
      !g.tournamentId || g.tournamentId === FREE_GAME_TOURNAMENT_ID;

    return {
      id: g.id || `game_${idx + 1}`,
      ownerId: 'default_player',
      tournamentId: isFree
        ? FREE_GAME_TOURNAMENT_ID
        : g.tournamentId || (tournaments[0]?.id ?? FREE_GAME_TOURNAMENT_ID),
      tournamentName: isFree
        ? g.tournamentName || FREE_GAME_TOURNAMENT_NAME
        : g.tournamentName || (tournaments[0]?.name ?? FREE_GAME_TOURNAMENT_NAME),
      round: Number(g.round) || 1,
      datePlayed: g.datePlayed || new Date().toISOString().slice(0, 10),
      timeControl: g.timeControl || 'Standard',
      playerColor: g.playerColor || 'White',
      playerElo: Number(g.playerElo) || defaultElo,
      opponentId: g.opponentId || undefined,
      opponentName: formatPlayerNameLastFirst(
        g.opponentName || 'Adversaire',
        isNameUncertain
      ),
      opponentNameUncertain: isNameUncertain,
      opponentFideId: g.opponentFideId || '',
      opponentFfeId: g.opponentFfeId || '',
      opponentTitle: g.opponentTitle || 'None',
      opponentElo: isEloUnknown ? 0 : Number(g.opponentElo) || 1500,
      opponentEloUnknown: isEloUnknown,
      opponentFederation: g.opponentFederation || 'FRA',
      result: g.result || '1/2-1/2',
      playerScore:
        g.playerScore === 1 || g.playerScore === 0 || g.playerScore === 0.5
          ? g.playerScore
          : 0.5,
      eloChange: isFriendly || isEloUnknown ? 0 : Number(g.eloChange) || 0,
      kFactorUsed:
        g.kFactorUsed === 10 || g.kFactorUsed === 40 ? g.kFactorUsed : 20,
      ecoCode: g.ecoCode || '',
      openingName: g.openingName || '',
      movesCount: Number(g.movesCount) || 0,
      termination: g.termination || 'Resignation',
      pgn: g.pgn || '',
      chessComUrl: g.chessComUrl || '',
      keyMomentNote: g.keyMomentNote || '',
    };
  });
}

function normalizeOpponentsArray(rawOpps: unknown): OpponentPlayer[] {
  if (!Array.isArray(rawOpps)) return [];
  return rawOpps.map((o: Partial<OpponentPlayer>, idx: number) => {
    const isNameUncertain =
      Boolean(o.isNameUncertain) || hasQuestionMarkInName(o.name);
    const isEloUnknown = Boolean(o.isEloUnknown);
    const isStandardEloUnknown =
      isEloUnknown ||
      Boolean(o.isStandardEloUnknown) ||
      (o.standardElo === undefined && o.elo === undefined) ||
      (Number(o.standardElo ?? o.elo) <= 0);

    const isRapidEloUnknown =
      isEloUnknown ||
      Boolean(o.isRapidEloUnknown) ||
      o.rapidElo === undefined ||
      o.rapidElo === null ||
      Number(o.rapidElo) <= 0;

    const isBlitzEloUnknown =
      isEloUnknown ||
      Boolean(o.isBlitzEloUnknown) ||
      o.blitzElo === undefined ||
      o.blitzElo === null ||
      Number(o.blitzElo) <= 0;

    const stdElo = isStandardEloUnknown
      ? 0
      : Number(o.standardElo ?? o.elo) || 0;
    const rapidElo = isRapidEloUnknown
      ? 0
      : Number(o.rapidElo) || 0;
    const blitzElo = isBlitzEloUnknown
      ? 0
      : Number(o.blitzElo) || 0;

    return {
      id: o.id || `opp_${idx + 1}`,
      name: formatPlayerNameLastFirst(o.name || 'Joueur', isNameUncertain),
      isNameUncertain,
      fideId: o.fideId || '',
      ffeId: o.ffeId || '',
      elo: stdElo,
      standardElo: stdElo,
      rapidElo,
      blitzElo,
      isEloUnknown:
        isStandardEloUnknown && isRapidEloUnknown && isBlitzEloUnknown,
      isStandardEloUnknown,
      isRapidEloUnknown,
      isBlitzEloUnknown,
      title: o.title || 'None',
      federation: o.federation || 'FRA',
      club: o.club || '',
      notes: o.notes || '',
    };
  });
}

function normalizeDatabasePayload(raw: unknown): FideLedgerDatabase {
  if (!raw || typeof raw !== 'object') {
    return createEmptyDatabase();
  }

  const obj = raw as Record<string, unknown>;
  const payload =
    obj.record && typeof obj.record === 'object'
      ? (obj.record as Record<string, unknown>)
      : obj;

  const rawProfile =
    payload.profile && typeof payload.profile === 'object'
      ? (payload.profile as Partial<PlayerProfile>)
      : DEFAULT_PLAYER_PROFILE;

  const profile: PlayerProfile = {
    uid: 'default_player',
    displayName: rawProfile.displayName || DEFAULT_PLAYER_PROFILE.displayName,
    fideId: rawProfile.fideId ?? '',
    ffeId: rawProfile.ffeId ?? '',
    federation: rawProfile.federation || 'FRA',
    club: rawProfile.club ?? '',
    fideTitle: rawProfile.fideTitle || 'None',
    birthYear: Number(rawProfile.birthYear) || 2000,
    kFactor:
      rawProfile.kFactor === 10 || rawProfile.kFactor === 40
        ? rawProfile.kFactor
        : 20,
    standardElo: Number(rawProfile.standardElo) || 1500,
    rapidElo: Number(rawProfile.rapidElo) || 1500,
    blitzElo: Number(rawProfile.blitzElo) || 1500,
    targetElo: Number(rawProfile.targetElo) || 1800,
  };

  const tournaments = normalizeTournamentsArray(
    payload.tournaments,
    profile.standardElo
  );
  const games = normalizeGamesArray(
    payload.games,
    tournaments,
    profile.standardElo
  );
  const rawOpponents = normalizeOpponentsArray(payload.opponents);
  const opponents = syncOpponentsWithGames(rawOpponents, games);

  const ratingHistory: MonthlyRatingRecord[] = Array.isArray(payload.ratingHistory)
    ? payload.ratingHistory.map((r: Partial<MonthlyRatingRecord>, idx: number) => ({
        id: r.id || `rating_${idx + 1}`,
        ownerId: 'default_player',
        period: r.period || new Date().toISOString().slice(0, 7),
        standardElo: Number(r.standardElo) || profile.standardElo,
        rapidElo: Number(r.rapidElo) || profile.rapidElo,
        blitzElo: Number(r.blitzElo) || profile.blitzElo,
        standardGamesCount: Number(r.standardGamesCount) || 0,
        standardDelta: Number(r.standardDelta) || 0,
        fideRankNational: Number(r.fideRankNational) || 0,
        notes: r.notes || '',
      }))
    : [];

  return {
    version: typeof payload.version === 'number' ? payload.version : 1,
    updatedAt:
      typeof payload.updatedAt === 'string'
        ? payload.updatedAt
        : new Date().toISOString(),
    profile,
    opponents,
    tournaments,
    games,
    ratingHistory,
  };
}

export function normalizeFriendlyDatabasePayload(raw: unknown): FriendlyLedgerDatabase {
  if (!raw || typeof raw !== 'object') {
    return createEmptyFriendlyDatabase();
  }

  const obj = raw as Record<string, unknown>;
  const payload =
    obj.record && typeof obj.record === 'object'
      ? (obj.record as Record<string, unknown>)
      : obj;

  const tournaments = normalizeTournamentsArray(payload.tournaments, 1500);
  const games = normalizeGamesArray(payload.games, tournaments, 1500, true);
  const rawOpponents = normalizeOpponentsArray(payload.opponents);
  const opponents = syncOpponentsWithGames(rawOpponents, games);

  return {
    version: typeof payload.version === 'number' ? payload.version : 1,
    ledgerType: 'friendly_chess_ledger',
    updatedAt:
      typeof payload.updatedAt === 'string'
        ? payload.updatedAt
        : new Date().toISOString(),
    opponents,
    tournaments,
    games,
  };
}

// ==========================================
// CACHE LOCAL (FIDE & AMICAL)
// ==========================================

export function loadLocalCache(): FideLedgerDatabase | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FIDE_CACHE_KEY);
    if (!raw) return null;
    return normalizeDatabasePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocalCache(dbData: FideLedgerDatabase): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_FIDE_CACHE_KEY, JSON.stringify(dbData));
  } catch {
    // Ignore
  }
}

export function loadFriendlyLocalCache(): FriendlyLedgerDatabase | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FRIENDLY_CACHE_KEY);
    if (!raw) return null;
    return normalizeFriendlyDatabasePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveFriendlyLocalCache(dbData: FriendlyLedgerDatabase): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_FRIENDLY_CACHE_KEY, JSON.stringify(dbData));
  } catch {
    // Ignore
  }
}

// ==========================================
// CORBEILLE DE SECOURS & POINTS DE RESTAURATION LOCAUX
// ==========================================

export function getDeletedVaultItems(): DeletedVaultItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addDeletedItemToVault(
  item: Omit<DeletedVaultItem, 'id' | 'deletedAt'>
): DeletedVaultItem[] {
  try {
    const current = getDeletedVaultItems();
    const newItem: DeletedVaultItem = {
      ...item,
      id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      deletedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...current].slice(0, 40);
    localStorage.setItem(LOCAL_STORAGE_DELETED_VAULT_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeDeletedItemFromVault(id: string): DeletedVaultItem[] {
  try {
    const current = getDeletedVaultItems();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(LOCAL_STORAGE_DELETED_VAULT_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearDeletedVault(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_DELETED_VAULT_KEY);
  } catch {
    // Ignore
  }
}

export function getLocalSnapshots(): LocalSnapshotItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createLocalSnapshot(
  ledger: 'fide' | 'friendly',
  reason: string,
  payload: FideLedgerDatabase | FriendlyLedgerDatabase
): LocalSnapshotItem[] {
  try {
    const current = getLocalSnapshots();
    const summary = `${payload.tournaments.length} tournoi(s) · ${payload.games.length} partie(s) · ${payload.opponents.length} joueur(s)`;
    const snap: LocalSnapshotItem = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      ledger,
      reason,
      summary,
      payload: JSON.parse(JSON.stringify(payload)),
    };
    const updated = [snap, ...current].slice(0, 15);
    localStorage.setItem(LOCAL_STORAGE_SNAPSHOTS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function deleteLocalSnapshot(id: string): LocalSnapshotItem[] {
  try {
    const current = getLocalSnapshots();
    const updated = current.filter((s) => s.id !== id);
    localStorage.setItem(LOCAL_STORAGE_SNAPSHOTS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

// ==========================================
// REQUÊTES JSONBIN #1 (PARTIES CLASSÉES FIDE)
// ==========================================

export async function fetchDatabaseFromJsonBin(
  binId = DEFAULT_JSONBIN_BIN_ID,
  masterKey = DEFAULT_JSONBIN_MASTER_KEY
): Promise<FideLedgerDatabase> {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    method: 'GET',
    headers: {
      'X-Master-Key': masterKey,
      'X-Bin-Meta': 'false',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Erreur lecture JSONBin FIDE (${response.status}): ${errorText || response.statusText}`
    );
  }

  const json = await response.json();
  const normalized = normalizeDatabasePayload(json);
  saveLocalCache(normalized);
  return normalized;
}

export async function saveDatabaseToJsonBin(
  dbData: FideLedgerDatabase,
  binId = DEFAULT_JSONBIN_BIN_ID,
  masterKey = DEFAULT_JSONBIN_MASTER_KEY
): Promise<FideLedgerDatabase> {
  const payloadToSave: FideLedgerDatabase = {
    ...dbData,
    opponents: deduplicateOpponents(dbData.opponents),
    version: (dbData.version || 1) + 1,
    updatedAt: new Date().toISOString(),
  };

  saveLocalCache(payloadToSave);

  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': masterKey,
    },
    body: JSON.stringify(payloadToSave),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Erreur sauvegarde JSONBin FIDE (${response.status}): ${errorText || response.statusText}`
    );
  }

  return payloadToSave;
}

// ==========================================
// REQUÊTES JSONBIN #2 (PARTIES AMICALES - INDÉPENDANT)
// ==========================================

export async function fetchFriendlyDatabaseFromJsonBin(
  binId = DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
  masterKey = DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY
): Promise<FriendlyLedgerDatabase> {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    method: 'GET',
    headers: {
      'X-Master-Key': masterKey,
      'X-Bin-Meta': 'false',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Erreur lecture JSONBin Amical (${response.status}): ${errorText || response.statusText}`
    );
  }

  const json = await response.json();
  const normalized = normalizeFriendlyDatabasePayload(json);
  saveFriendlyLocalCache(normalized);
  return normalized;
}

export async function saveFriendlyDatabaseToJsonBin(
  dbData: FriendlyLedgerDatabase,
  binId = DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
  masterKey = DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY
): Promise<FriendlyLedgerDatabase> {
  const payloadToSave: FriendlyLedgerDatabase = {
    ...dbData,
    ledgerType: 'friendly_chess_ledger',
    opponents: deduplicateOpponents(dbData.opponents),
    version: (dbData.version || 1) + 1,
    updatedAt: new Date().toISOString(),
  };

  saveFriendlyLocalCache(payloadToSave);

  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': masterKey,
    },
    body: JSON.stringify(payloadToSave),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Erreur sauvegarde JSONBin Amical (${response.status}): ${errorText || response.statusText}`
    );
  }

  return payloadToSave;
}
