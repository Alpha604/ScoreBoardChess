import {
  FideGame,
  MonthlyRatingRecord,
  OpponentPlayer,
  PlayerProfile,
  Tournament,
} from '../types/fide';

export const DEFAULT_JSONBIN_BIN_ID = '6ac7d7e6ac6210605a20528d';
export const DEFAULT_JSONBIN_MASTER_KEY =
  '$2a$10$JryE9oeTsODdtBZ1Bw4H1upy2iTTEu3lKWoCGYVNoGXylvwIZHDwG';

const LOCAL_STORAGE_BACKUP_KEY = 'fide_chess_ledger_jsonbin_cache_v2';
const LOCAL_STORAGE_AUTH_KEY = 'fide_chess_ledger_session_v2';

export interface FideLedgerDatabase {
  version: number;
  updatedAt: string;
  profile: PlayerProfile;
  opponents: OpponentPlayer[];
  tournaments: Tournament[];
  games: FideGame[];
  ratingHistory: MonthlyRatingRecord[];
}

export interface SessionConfig {
  isAuthenticated: boolean;
  playerName: string;
  binId: string;
  masterKey: string;
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
      };
    }
    const parsed = JSON.parse(raw);
    return {
      isAuthenticated: Boolean(parsed.isAuthenticated),
      playerName: parsed.playerName || '',
      binId: parsed.binId || DEFAULT_JSONBIN_BIN_ID,
      masterKey: parsed.masterKey || DEFAULT_JSONBIN_MASTER_KEY,
    };
  } catch {
    return {
      isAuthenticated: false,
      playerName: '',
      binId: DEFAULT_JSONBIN_BIN_ID,
      masterKey: DEFAULT_JSONBIN_MASTER_KEY,
    };
  }
}

export function saveSession(session: SessionConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  try {
    const current = getSavedSession();
    localStorage.setItem(
      LOCAL_STORAGE_AUTH_KEY,
      JSON.stringify({ ...current, isAuthenticated: false })
    );
  } catch {
    // ignore
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

/**
 * Reconstruit ou synchronise automatiquement la liste des joueurs affrontés
 * à partir des parties existantes si un joueur n'est pas encore dans `opponents`.
 */
export function syncOpponentsWithGames(
  opponents: OpponentPlayer[],
  games: FideGame[]
): OpponentPlayer[] {
  const list = [...opponents];

  for (const g of games) {
    const cleanName = (g.opponentName || '').trim();
    if (!cleanName) continue;

    const cleanFide = (g.opponentFideId || '').trim();
    const cleanFfe = (g.opponentFfeId || '').trim().toUpperCase();

    const foundIdx = list.findIndex(
      (o) =>
        (g.opponentId && o.id === g.opponentId) ||
        (cleanFide && o.fideId === cleanFide) ||
        (cleanFfe && o.ffeId.toUpperCase() === cleanFfe) ||
        o.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (foundIdx === -1) {
      const gameElo = Number(g.opponentElo) || 1500;
      list.push({
        id: g.opponentId || `opp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        fideId: cleanFide,
        ffeId: cleanFfe,
        elo: gameElo,
        standardElo: gameElo,
        rapidElo: gameElo,
        blitzElo: gameElo,
        title: g.opponentTitle || 'None',
        federation: g.opponentFederation || 'FRA',
        club: '',
        notes: '',
      });
    } else {
      // Met à jour les IDs manquants et l'Elo de la cadence correspondante
      const existing = list[foundIdx];
      const gameElo = Number(g.opponentElo) || existing.standardElo || existing.elo || 1500;
      const nextStd =
        g.timeControl === 'Standard'
          ? gameElo
          : existing.standardElo || existing.elo || 1500;
      const nextRapid =
        g.timeControl === 'Rapid'
          ? gameElo
          : existing.rapidElo || existing.standardElo || existing.elo || 1500;
      const nextBlitz =
        g.timeControl === 'Blitz'
          ? gameElo
          : existing.blitzElo || existing.standardElo || existing.elo || 1500;

      list[foundIdx] = {
        ...existing,
        fideId: existing.fideId || cleanFide,
        ffeId: existing.ffeId || cleanFfe,
        elo: nextStd,
        standardElo: nextStd,
        rapidElo: nextRapid,
        blitzElo: nextBlitz,
        title: g.opponentTitle !== 'None' ? g.opponentTitle : existing.title,
      };
    }
  }

  return list;
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

  const tournaments: Tournament[] = Array.isArray(payload.tournaments)
    ? payload.tournaments.map((t: Partial<Tournament>, idx: number) => ({
        id: t.id || `tourney_${idx + 1}`,
        ownerId: 'default_player',
        name: t.name || 'Tournoi FIDE',
        location: t.location || 'France',
        startDate: t.startDate || new Date().toISOString().slice(0, 10),
        endDate: t.endDate || new Date().toISOString().slice(0, 10),
        timeControl: t.timeControl || 'Standard',
        timeControlDetails: t.timeControlDetails || '90 min + 30 sec/coup',
        format: t.format || 'Swiss',
        totalRounds: Number(t.totalRounds) || 9,
        totalPlayers: t.totalPlayers ? Number(t.totalPlayers) : undefined,
        finalRank: t.finalRank ? Number(t.finalRank) : undefined,
        startingElo: Number(t.startingElo) || profile.standardElo,
        status: t.status || 'ongoing',
        normTarget: t.normTarget || '',
        notes: t.notes || '',
      }))
    : [];

  const games: FideGame[] = Array.isArray(payload.games)
    ? payload.games.map((g: Partial<FideGame>, idx: number) => ({
        id: g.id || `game_${idx + 1}`,
        ownerId: 'default_player',
        tournamentId: g.tournamentId || (tournaments[0]?.id ?? 'default_tourney'),
        tournamentName: g.tournamentName || (tournaments[0]?.name ?? 'Tournoi FIDE'),
        round: Number(g.round) || 1,
        datePlayed: g.datePlayed || new Date().toISOString().slice(0, 10),
        timeControl: g.timeControl || 'Standard',
        playerColor: g.playerColor || 'White',
        playerElo: Number(g.playerElo) || profile.standardElo,
        opponentId: g.opponentId || undefined,
        opponentName: g.opponentName || 'Adversaire',
        opponentFideId: g.opponentFideId || '',
        opponentFfeId: g.opponentFfeId || '',
        opponentTitle: g.opponentTitle || 'None',
        opponentElo: Number(g.opponentElo) || 1500,
        opponentFederation: g.opponentFederation || 'FRA',
        result: g.result || '1/2-1/2',
        playerScore:
          g.playerScore === 1 || g.playerScore === 0 || g.playerScore === 0.5
            ? g.playerScore
            : 0.5,
        eloChange: Number(g.eloChange) || 0,
        kFactorUsed:
          g.kFactorUsed === 10 || g.kFactorUsed === 40 ? g.kFactorUsed : 20,
        ecoCode: g.ecoCode || '',
        openingName: g.openingName || '',
        movesCount: Number(g.movesCount) || 0,
        termination: g.termination || 'Resignation',
        pgn: g.pgn || '',
        chessComUrl: g.chessComUrl || '',
        keyMomentNote: g.keyMomentNote || '',
      }))
    : [];

  const rawOpponents: OpponentPlayer[] = Array.isArray(payload.opponents)
    ? payload.opponents.map((o: Partial<OpponentPlayer>, idx: number) => {
        const stdElo = Number(o.standardElo) || Number(o.elo) || 1500;
        const rapidElo = Number(o.rapidElo) || stdElo;
        const blitzElo = Number(o.blitzElo) || stdElo;
        return {
          id: o.id || `opp_${idx + 1}`,
          name: o.name || 'Joueur',
          fideId: o.fideId || '',
          ffeId: o.ffeId || '',
          elo: stdElo,
          standardElo: stdElo,
          rapidElo,
          blitzElo,
          title: o.title || 'None',
          federation: o.federation || 'FRA',
          club: o.club || '',
          notes: o.notes || '',
        };
      })
    : [];

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

export function loadLocalCache(): FideLedgerDatabase | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    if (!raw) return null;
    return normalizeDatabasePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocalCache(dbData: FideLedgerDatabase): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(dbData));
  } catch {
    // Ignore
  }
}

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
      `Erreur lecture JSONBin (${response.status}): ${errorText || response.statusText}`
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
  const syncedOpponents = syncOpponentsWithGames(dbData.opponents, dbData.games);
  const payloadToSave: FideLedgerDatabase = {
    ...dbData,
    opponents: syncedOpponents,
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
      `Erreur sauvegarde JSONBin (${response.status}): ${errorText || response.statusText}`
    );
  }

  return payloadToSave;
}
