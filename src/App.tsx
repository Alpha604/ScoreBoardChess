/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Coffee,
  Database,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Swords,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { EloEvolutionChart } from './components/EloEvolutionChart';
import { FriendlySection } from './components/FriendlySection';
import { GamesSection } from './components/GamesSection';
import { LoginSection } from './components/LoginSection';
import { PlayersSection } from './components/PlayersSection';
import { ProfileModal } from './components/ProfileModal';
import { SettingsSection } from './components/SettingsSection';
import { StatisticsSection } from './components/StatisticsSection';
import { TournamentsSection } from './components/TournamentsSection';
import {
  addDeletedItemToVault,
  BinSyncStatus,
  clearDeletedVault,
  clearSession,
  createEmptyDatabase,
  createEmptyFriendlyDatabase,
  createLocalSnapshot,
  deduplicateOpponents,
  DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
  DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY,
  DeletedVaultItem,
  deleteLocalSnapshot,
  fetchDatabaseFromJsonBin,
  fetchFriendlyDatabaseFromJsonBin,
  FideLedgerDatabase,
  FriendlyLedgerDatabase,
  getDeletedVaultItems,
  getLocalSnapshots,
  getSavedSession,
  loadFriendlyLocalCache,
  loadLocalCache,
  LocalSnapshotItem,
  removeDeletedItemFromVault,
  saveDatabaseToJsonBin,
  saveFriendlyDatabaseToJsonBin,
  saveSession,
  SessionConfig,
  syncOpponentsWithGames,
} from './services/jsonbinService';
import {
  FideGame,
  MonthlyRatingRecord,
  OpponentPlayer,
  PlayerProfile,
  Tournament,
} from './types/fide';
import { calculateFidePerformanceRating } from './utils/fideMath';
import {
  formatPlayerNameLastFirst,
  sanitizeFideGamePayload,
  sanitizeMonthlyRatingPayload,
  sanitizeOpponentPayload,
  sanitizePlayerProfilePayload,
  sanitizeTournamentPayload,
} from './utils/fideValidation';
import {
  buildSampleFideLedgerDatabase,
  buildSampleFriendlyLedgerDatabase,
} from './utils/seedData';

type ActiveTab =
  | 'dashboard'
  | 'tournaments'
  | 'games'
  | 'players'
  | 'statistics'
  | 'friendly'
  | 'settings';

export default function App() {
  const [session, setSession] = useState<SessionConfig>(() => getSavedSession());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedTournamentFilter, setSelectedTournamentFilter] = useState<string>('');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [inspectedGame, setInspectedGame] = useState<FideGame | null>(null);

  // Base #1 : Parties Classées FIDE
  const [dbState, setDbState] = useState<FideLedgerDatabase>(() => {
    return loadLocalCache() || createEmptyDatabase();
  });

  // Base #2 : Parties Amicales (100% Indépendante)
  const [friendlyDbState, setFriendlyDbState] = useState<FriendlyLedgerDatabase>(() => {
    return loadFriendlyLocalCache() || createEmptyFriendlyDatabase();
  });

  // Statuts des 2 JSONBin (avec suivi économe des requêtes)
  const [fideStatus, setFideStatus] = useState<BinSyncStatus>(() => ({
    binId: getSavedSession().binId,
    state: loadLocalCache() ? 'local_cache' : 'idle',
    lastSyncedAt: loadLocalCache()?.updatedAt || null,
    lastError: null,
    getRequestsCount: 0,
    putRequestsCount: 0,
  }));

  const [friendlyStatus, setFriendlyStatus] = useState<BinSyncStatus>(() => ({
    binId: getSavedSession().friendlyBinId || DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
    state: loadFriendlyLocalCache() ? 'local_cache' : 'idle',
    lastSyncedAt: loadFriendlyLocalCache()?.updatedAt || null,
    lastError: null,
    getRequestsCount: 0,
    putRequestsCount: 0,
  }));

  // Cache local : Corbeille de secours & Points de restauration
  const [deletedVault, setDeletedVault] = useState<DeletedVaultItem[]>(() =>
    getDeletedVaultItems()
  );
  const [snapshots, setSnapshots] = useState<LocalSnapshotItem[]>(() =>
    getLocalSnapshots()
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSyncingFriendly, setIsSyncingFriendly] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Refs pour éviter toute requête automatique superflue
  const hasFetchedFideOnceRef = useRef(false);
  const hasFetchedFriendlyOnceRef = useRef(false);

  const profile = dbState.profile;
  const opponents = dbState.opponents || [];
  const tournaments = dbState.tournaments || [];
  const games = dbState.games || [];
  const ratingHistory = dbState.ratingHistory || [];

  // Lecture JSONBin #1 (Parties Classées FIDE)
  const loadFromJsonBin = useCallback(
    async (customSession?: SessionConfig) => {
      const target = customSession || session;
      setIsLoading(true);
      setErrorBanner(null);
      setFideStatus((prev) => ({
        ...prev,
        binId: target.binId,
        state: 'syncing',
        lastError: null,
      }));
      try {
        const remoteData = await fetchDatabaseFromJsonBin(
          target.binId,
          target.masterKey
        );
        setDbState(remoteData);
        setFideStatus((prev) => ({
          ...prev,
          binId: target.binId,
          state: 'synced',
          lastSyncedAt: new Date().toISOString(),
          lastError: null,
          getRequestsCount: prev.getRequestsCount + 1,
        }));
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Impossible de charger les données depuis le JSONBin Classé.';
        setErrorBanner(msg);
        setFideStatus((prev) => ({
          ...prev,
          binId: target.binId,
          state: 'error',
          lastError: msg,
          getRequestsCount: prev.getRequestsCount + 1,
        }));
      } finally {
        setIsLoading(false);
      }
    },
    [session]
  );

  // Lecture JSONBin #2 (Parties Amicales)
  const loadFriendlyFromJsonBin = useCallback(
    async (customSession?: SessionConfig) => {
      const target = customSession || session;
      const fBinId = target.friendlyBinId || DEFAULT_FRIENDLY_JSONBIN_BIN_ID;
      const fKey =
        target.friendlyMasterKey ||
        target.masterKey ||
        DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY;

      setIsSyncingFriendly(true);
      setFriendlyStatus((prev) => ({
        ...prev,
        binId: fBinId,
        state: 'syncing',
        lastError: null,
      }));
      try {
        const remoteFriendly = await fetchFriendlyDatabaseFromJsonBin(
          fBinId,
          fKey
        );
        setFriendlyDbState(remoteFriendly);
        setFriendlyStatus((prev) => ({
          ...prev,
          binId: fBinId,
          state: 'synced',
          lastSyncedAt: new Date().toISOString(),
          lastError: null,
          getRequestsCount: prev.getRequestsCount + 1,
        }));
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Impossible de lire le JSONBin des Parties Amicales.';
        setFriendlyStatus((prev) => ({
          ...prev,
          binId: fBinId,
          state: 'error',
          lastError: msg,
          getRequestsCount: prev.getRequestsCount + 1,
        }));
      } finally {
        setIsSyncingFriendly(false);
      }
    },
    [session]
  );

  // Une seule lecture au démarrage pour le Bin #1
  useEffect(() => {
    if (session.isAuthenticated && !hasFetchedFideOnceRef.current) {
      hasFetchedFideOnceRef.current = true;
      loadFromJsonBin(session);
    }
  }, [session.isAuthenticated, loadFromJsonBin, session]);

  // Lecture paresseuse (1 seule fois) du Bin #2 uniquement quand on ouvre l'onglet Amical
  useEffect(() => {
    if (
      session.isAuthenticated &&
      activeTab === 'friendly' &&
      !hasFetchedFriendlyOnceRef.current
    ) {
      hasFetchedFriendlyOnceRef.current = true;
      loadFriendlyFromJsonBin(session);
    }
  }, [
    session.isAuthenticated,
    activeTab,
    loadFriendlyFromJsonBin,
    session,
  ]);

  // Sauvegarde JSONBin #1 (Parties Classées FIDE)
  const persistUpdate = async (
    nextDb: FideLedgerDatabase,
    options?: { skipAutoCreateOpponentsFromGames?: boolean }
  ) => {
    const finalOpponents = options?.skipAutoCreateOpponentsFromGames
      ? deduplicateOpponents(nextDb.opponents || [])
      : syncOpponentsWithGames(nextDb.opponents || [], nextDb.games || []);

    const updatedDb: FideLedgerDatabase = {
      ...nextDb,
      opponents: finalOpponents,
    };
    setDbState(updatedDb);
    setIsSyncing(true);
    setErrorBanner(null);
    setFideStatus((prev) => ({
      ...prev,
      state: 'syncing',
      lastError: null,
    }));
    try {
      const saved = await saveDatabaseToJsonBin(
        updatedDb,
        session.binId,
        session.masterKey
      );
      setDbState(saved);
      setFideStatus((prev) => ({
        ...prev,
        binId: session.binId,
        state: 'synced',
        lastSyncedAt: saved.updatedAt,
        lastError: null,
        putRequestsCount: prev.putRequestsCount + 1,
      }));
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erreur lors de la sauvegarde dans le JSONBin Classé.';
      setErrorBanner(msg);
      setFideStatus((prev) => ({
        ...prev,
        state: 'error',
        lastError: msg,
        putRequestsCount: prev.putRequestsCount + 1,
      }));
    } finally {
      setIsSyncing(false);
    }
  };

  // Sauvegarde JSONBin #2 (Parties Amicales - 100% Indépendant)
  const persistFriendlyUpdate = async (
    nextFriendlyDb: FriendlyLedgerDatabase,
    options?: { skipAutoCreateOpponentsFromGames?: boolean }
  ) => {
    const finalOpponents = options?.skipAutoCreateOpponentsFromGames
      ? deduplicateOpponents(nextFriendlyDb.opponents || [])
      : syncOpponentsWithGames(
          nextFriendlyDb.opponents || [],
          nextFriendlyDb.games || []
        );

    const updatedFriendlyDb: FriendlyLedgerDatabase = {
      ...nextFriendlyDb,
      ledgerType: 'friendly_chess_ledger',
      opponents: finalOpponents,
    };
    setFriendlyDbState(updatedFriendlyDb);
    setIsSyncingFriendly(true);
    setErrorBanner(null);

    const fBinId = session.friendlyBinId || DEFAULT_FRIENDLY_JSONBIN_BIN_ID;
    const fKey =
      session.friendlyMasterKey ||
      session.masterKey ||
      DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY;

    setFriendlyStatus((prev) => ({
      ...prev,
      binId: fBinId,
      state: 'syncing',
      lastError: null,
    }));

    try {
      const saved = await saveFriendlyDatabaseToJsonBin(
        updatedFriendlyDb,
        fBinId,
        fKey
      );
      setFriendlyDbState(saved);
      setFriendlyStatus((prev) => ({
        ...prev,
        binId: fBinId,
        state: 'synced',
        lastSyncedAt: saved.updatedAt,
        lastError: null,
        putRequestsCount: prev.putRequestsCount + 1,
      }));
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erreur lors de la sauvegarde dans le JSONBin Amical.';
      setErrorBanner(msg);
      setFriendlyStatus((prev) => ({
        ...prev,
        binId: fBinId,
        state: 'error',
        lastError: msg,
        putRequestsCount: prev.putRequestsCount + 1,
      }));
    } finally {
      setIsSyncingFriendly(false);
    }
  };

  const handleLogin = async (newSession: SessionConfig) => {
    const remoteData = await fetchDatabaseFromJsonBin(
      newSession.binId,
      newSession.masterKey
    );
    if (
      newSession.playerName &&
      remoteData.profile.displayName === 'Mon Profil Échecs'
    ) {
      remoteData.profile.displayName = newSession.playerName;
    }
    saveSession(newSession);
    setSession(newSession);
    setDbState(remoteData);
    hasFetchedFideOnceRef.current = true;
    setFideStatus((prev) => ({
      ...prev,
      binId: newSession.binId,
      state: 'synced',
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      getRequestsCount: prev.getRequestsCount + 1,
    }));
  };

  const handleLogout = () => {
    clearSession();
    hasFetchedFideOnceRef.current = false;
    hasFetchedFriendlyOnceRef.current = false;
    setSession((prev) => ({ ...prev, isAuthenticated: false }));
  };

  // =========================================================
  // HANDLERS BASE #1 : PARTIES CLASSÉES FIDE
  // =========================================================

  const handleSaveProfile = async (input: Omit<PlayerProfile, 'uid'>) => {
    const cleanProfile = sanitizePlayerProfilePayload('default_player', input);
    await persistUpdate({
      ...dbState,
      profile: cleanProfile,
    });
  };

  const handleSaveOpponent = async (
    input: Omit<OpponentPlayer, 'id'>,
    existingId?: string
  ) => {
    const clean = sanitizeOpponentPayload(input);
    const targetExisting = existingId
      ? opponents.find((o) => o.id === existingId)
      : opponents.find(
          (o) =>
            (clean.fideId && o.fideId === clean.fideId) ||
            (clean.ffeId && o.ffeId.toUpperCase() === clean.ffeId.toUpperCase()) ||
            formatPlayerNameLastFirst(o.name).toLowerCase() ===
              clean.name.toLowerCase()
        );

    const targetId = targetExisting?.id || existingId;
    const nextOpponents = targetId
      ? opponents.map((o) =>
          o.id === targetId ? { ...clean, id: targetId } : o
        )
      : [
          ...opponents,
          {
            ...clean,
            id: `opp_${Date.now().toString(36)}`,
          },
        ];

    const nextGames = targetExisting
      ? games.map((g) => {
          const isSameOpponent =
            (g.opponentId && g.opponentId === targetExisting.id) ||
            (targetExisting.fideId &&
              g.opponentFideId &&
              g.opponentFideId === targetExisting.fideId) ||
            (targetExisting.ffeId &&
              g.opponentFfeId &&
              g.opponentFfeId.toUpperCase() ===
                targetExisting.ffeId.toUpperCase()) ||
            g.opponentName.trim().toLowerCase() ===
              targetExisting.name.trim().toLowerCase() ||
            formatPlayerNameLastFirst(g.opponentName).toLowerCase() ===
              formatPlayerNameLastFirst(targetExisting.name).toLowerCase();

          if (!isSameOpponent) return g;
          return {
            ...g,
            opponentId: targetExisting.id,
            opponentName: clean.name,
            opponentFideId: clean.fideId || g.opponentFideId,
            opponentFfeId: clean.ffeId || g.opponentFfeId,
            opponentTitle: clean.title,
            opponentFederation: clean.federation || g.opponentFederation,
          };
        })
      : games;

    await persistUpdate(
      {
        ...dbState,
        opponents: nextOpponents,
        games: nextGames,
      },
      { skipAutoCreateOpponentsFromGames: true }
    );
  };

  const handleDeleteOpponent = async (id: string) => {
    const target = opponents.find((o) => o.id === id);
    if (target) {
      setDeletedVault(
        addDeletedItemToVault({
          ledger: 'fide',
          itemType: 'opponent',
          label: formatPlayerNameLastFirst(target.name),
          details: `Std ${target.standardElo || target.elo} · Rap ${
            target.rapidElo || target.elo
          } · Blz ${target.blitzElo || target.elo}`,
          data: target,
        })
      );
    }
    const nextOpponents = opponents.filter((o) => o.id !== id);
    await persistUpdate(
      {
        ...dbState,
        opponents: nextOpponents,
      },
      { skipAutoCreateOpponentsFromGames: true }
    );
  };

  const handleSaveTournament = async (
    input: Omit<Tournament, 'id' | 'ownerId'>,
    existingId?: string
  ) => {
    const clean = sanitizeTournamentPayload('default_player', input);
    const nextTournaments = existingId
      ? tournaments.map((t) =>
          t.id === existingId ? { ...clean, id: existingId } : t
        )
      : [
          ...tournaments,
          {
            ...clean,
            id: `t_${Date.now().toString(36)}`,
          },
        ];

    const nextGames = existingId
      ? games.map((g) =>
          g.tournamentId === existingId
            ? {
                ...g,
                tournamentName: clean.name,
                timeControl: clean.timeControl,
              }
            : g
        )
      : games;

    await persistUpdate({
      ...dbState,
      tournaments: nextTournaments,
      games: nextGames,
    });
  };

  const handleDeleteTournament = async (id: string) => {
    const target = tournaments.find((t) => t.id === id);
    const associatedGames = games.filter((g) => g.tournamentId === id);
    if (target) {
      setDeletedVault(
        addDeletedItemToVault({
          ledger: 'fide',
          itemType: 'tournament',
          label: target.name,
          details: `${target.location} · ${associatedGames.length} partie(s) associée(s)`,
          data: target,
          associatedGames,
        })
      );
    }
    const nextTournaments = tournaments.filter((t) => t.id !== id);
    const nextGames = games.filter((g) => g.tournamentId !== id);
    await persistUpdate({
      ...dbState,
      tournaments: nextTournaments,
      games: nextGames,
    });
  };

  const handleSaveGame = async (
    input: Omit<FideGame, 'id' | 'ownerId'>,
    existingId?: string
  ) => {
    const clean = sanitizeFideGamePayload('default_player', input);
    const nextGames = existingId
      ? games.map((g) =>
          g.id === existingId ? { ...clean, id: existingId } : g
        )
      : [
          ...games,
          {
            ...clean,
            id: `g_${Date.now().toString(36)}`,
          },
        ];

    if (existingId && inspectedGame?.id === existingId) {
      setInspectedGame({ ...clean, id: existingId });
    }

    await persistUpdate({
      ...dbState,
      games: nextGames,
    });
  };

  const handleDeleteGame = async (id: string) => {
    const target = games.find((g) => g.id === id);
    if (target) {
      setDeletedVault(
        addDeletedItemToVault({
          ledger: 'fide',
          itemType: 'game',
          label: `Ronde ${target.round} vs ${formatPlayerNameLastFirst(
            target.opponentName
          )}`,
          details: `${target.tournamentName} (${target.datePlayed})`,
          data: target,
        })
      );
    }
    const nextGames = games.filter((g) => g.id !== id);
    if (inspectedGame?.id === id) setInspectedGame(null);
    await persistUpdate({
      ...dbState,
      games: nextGames,
    });
  };

  const handleSaveRatingRecord = async (
    input: Omit<MonthlyRatingRecord, 'id' | 'ownerId'>,
    existingId?: string
  ) => {
    const clean = sanitizeMonthlyRatingPayload('default_player', input);
    const targetId = existingId || `fide_${clean.period.replace('-', '_')}`;
    const existsAlready = ratingHistory.some(
      (r) => r.id === targetId || r.period === clean.period
    );

    const nextRatings = existsAlready
      ? ratingHistory.map((r) =>
          r.id === targetId || r.period === clean.period
            ? { ...clean, id: r.id }
            : r
        )
      : [...ratingHistory, { ...clean, id: targetId }];

    const sorted = [...nextRatings].sort((a, b) =>
      a.period.localeCompare(b.period)
    );
    const latest = sorted[sorted.length - 1];
    const nextProfile = latest
      ? {
          ...profile,
          standardElo: latest.standardElo,
          rapidElo: latest.rapidElo,
          blitzElo: latest.blitzElo,
        }
      : profile;

    await persistUpdate({
      ...dbState,
      profile: nextProfile,
      ratingHistory: nextRatings,
    });
  };

  const handleDeleteRatingRecord = async (id: string) => {
    const target = ratingHistory.find((r) => r.id === id);
    if (target) {
      setDeletedVault(
        addDeletedItemToVault({
          ledger: 'fide',
          itemType: 'rating',
          label: `Relevé mensuel ${target.period}`,
          details: `Classique ${target.standardElo} · Rapide ${target.rapidElo} · Blitz ${target.blitzElo}`,
          data: target,
        })
      );
    }
    const nextRatings = ratingHistory.filter((r) => r.id !== id);
    await persistUpdate({
      ...dbState,
      ratingHistory: nextRatings,
    });
  };

  const handleLoadSampleData = async () => {
    const sampleDb = buildSampleFideLedgerDatabase();
    await persistUpdate(sampleDb);
  };

  // =========================================================
  // HANDLERS BASE #2 : PARTIES AMICALES (100% INDÉPENDANT)
  // =========================================================

  const friendlyOpponents = friendlyDbState.opponents || [];
  const friendlyTournaments = friendlyDbState.tournaments || [];
  const friendlyGames = friendlyDbState.games || [];

  const handleSaveFriendlyOpponent = async (
    input: Omit<OpponentPlayer, 'id'>,
    existingId?: string
  ) => {
    const clean = sanitizeOpponentPayload(input);
    const targetExisting = existingId
      ? friendlyOpponents.find((o) => o.id === existingId)
      : friendlyOpponents.find(
          (o) =>
            formatPlayerNameLastFirst(o.name).toLowerCase() ===
            clean.name.toLowerCase()
        );

    const targetId = targetExisting?.id || existingId;
    const nextOpponents = targetId
      ? friendlyOpponents.map((o) =>
          o.id === targetId ? { ...clean, id: targetId } : o
        )
      : [
          ...friendlyOpponents,
          {
            ...clean,
            id: `f_opp_${Date.now().toString(36)}`,
          },
        ];

    const nextGames = targetExisting
      ? friendlyGames.map((g) => {
          const isSameOpponent =
            (g.opponentId && g.opponentId === targetExisting.id) ||
            formatPlayerNameLastFirst(g.opponentName).toLowerCase() ===
              formatPlayerNameLastFirst(targetExisting.name).toLowerCase();

          if (!isSameOpponent) return g;
          return {
            ...g,
            opponentId: targetExisting.id,
            opponentName: clean.name,
            opponentFideId: clean.fideId || g.opponentFideId,
            opponentFfeId: clean.ffeId || g.opponentFfeId,
            opponentTitle: clean.title,
            opponentFederation: clean.federation || g.opponentFederation,
          };
        })
      : friendlyGames;

    await persistFriendlyUpdate(
      {
        ...friendlyDbState,
        opponents: nextOpponents,
        games: nextGames,
      },
      { skipAutoCreateOpponentsFromGames: true }
    );
  };

  const handleDeleteFriendlyOpponent = async (id: string) => {
    const target = friendlyOpponents.find((o) => o.id === id);
    if (target) {
      setDeletedVault(
        addDeletedItemToVault({
          ledger: 'friendly',
          itemType: 'opponent',
          label: formatPlayerNameLastFirst(target.name),
          details: `Joueur Amical · Std ${target.standardElo || target.elo}`,
          data: target,
        })
      );
    }
    const nextOpponents = friendlyOpponents.filter((o) => o.id !== id);
    await persistFriendlyUpdate(
      {
        ...friendlyDbState,
        opponents: nextOpponents,
      },
      { skipAutoCreateOpponentsFromGames: true }
    );
  };

  const handleSaveFriendlyTournament = async (
    input: Omit<Tournament, 'id' | 'ownerId'>,
    existingId?: string
  ) => {
    const clean = sanitizeTournamentPayload('default_player', input);
    const nextTournaments = existingId
      ? friendlyTournaments.map((t) =>
          t.id === existingId ? { ...clean, id: existingId } : t
        )
      : [
          ...friendlyTournaments,
          {
            ...clean,
            id: `ft_${Date.now().toString(36)}`,
          },
        ];

    const nextGames = existingId
      ? friendlyGames.map((g) =>
          g.tournamentId === existingId
            ? {
                ...g,
                tournamentName: clean.name,
                timeControl: clean.timeControl,
              }
            : g
        )
      : friendlyGames;

    await persistFriendlyUpdate({
      ...friendlyDbState,
      tournaments: nextTournaments,
      games: nextGames,
    });
  };

  const handleDeleteFriendlyTournament = async (id: string) => {
    const target = friendlyTournaments.find((t) => t.id === id);
    const associatedGames = friendlyGames.filter((g) => g.tournamentId === id);
    if (target) {
      setDeletedVault(
        addDeletedItemToVault({
          ledger: 'friendly',
          itemType: 'tournament',
          label: target.name,
          details: `Session Amicale · ${associatedGames.length} partie(s)`,
          data: target,
          associatedGames,
        })
      );
    }
    const nextTournaments = friendlyTournaments.filter((t) => t.id !== id);
    const nextGames = friendlyGames.filter((g) => g.tournamentId !== id);
    await persistFriendlyUpdate({
      ...friendlyDbState,
      tournaments: nextTournaments,
      games: nextGames,
    });
  };

  const handleSaveFriendlyGame = async (
    input: Omit<FideGame, 'id' | 'ownerId'>,
    existingId?: string
  ) => {
    const clean = sanitizeFideGamePayload('default_player', input);
    const nextGames = existingId
      ? friendlyGames.map((g) =>
          g.id === existingId ? { ...clean, id: existingId } : g
        )
      : [
          ...friendlyGames,
          {
            ...clean,
            id: `fg_${Date.now().toString(36)}`,
          },
        ];

    await persistFriendlyUpdate({
      ...friendlyDbState,
      games: nextGames,
    });
  };

  const handleDeleteFriendlyGame = async (id: string) => {
    const target = friendlyGames.find((g) => g.id === id);
    if (target) {
      setDeletedVault(
        addDeletedItemToVault({
          ledger: 'friendly',
          itemType: 'game',
          label: `Partie Amicale R${target.round} vs ${formatPlayerNameLastFirst(
            target.opponentName
          )}`,
          details: `${target.tournamentName} (${target.datePlayed})`,
          data: target,
        })
      );
    }
    const nextGames = friendlyGames.filter((g) => g.id !== id);
    await persistFriendlyUpdate({
      ...friendlyDbState,
      games: nextGames,
    });
  };

  const handleLoadSampleFriendlyData = async () => {
    const sampleFriendly = buildSampleFriendlyLedgerDatabase();
    await persistFriendlyUpdate(sampleFriendly);
  };

  const handleInitializeEmptyFriendlyBin = async () => {
    const emptyFriendly = createEmptyFriendlyDatabase();
    await persistFriendlyUpdate(emptyFriendly);
  };

  // =========================================================
  // HANDLERS DE RESTAURATION LOCALE (CORBEILLE & SNAPSHOTS)
  // =========================================================

  const handleRestoreDeletedItem = async (item: DeletedVaultItem) => {
    if (item.ledger === 'fide') {
      if (item.itemType === 'opponent') {
        const opp = item.data as OpponentPlayer;
        const exists = opponents.some((o) => o.id === opp.id);
        const nextOpps = exists
          ? opponents.map((o) => (o.id === opp.id ? opp : o))
          : [...opponents, opp];
        await persistUpdate(
          { ...dbState, opponents: nextOpps },
          { skipAutoCreateOpponentsFromGames: true }
        );
      } else if (item.itemType === 'game') {
        const g = item.data as FideGame;
        const exists = games.some((x) => x.id === g.id);
        const nextGames = exists
          ? games.map((x) => (x.id === g.id ? g : x))
          : [...games, g];
        await persistUpdate({ ...dbState, games: nextGames });
      } else if (item.itemType === 'tournament') {
        const t = item.data as Tournament;
        const exists = tournaments.some((x) => x.id === t.id);
        const nextTournaments = exists
          ? tournaments.map((x) => (x.id === t.id ? t : x))
          : [...tournaments, t];
        const restoredGames = item.associatedGames || [];
        const existingGameIds = new Set(games.map((g) => g.id));
        const mergedGames = [
          ...games,
          ...restoredGames.filter((g) => !existingGameIds.has(g.id)),
        ];
        await persistUpdate({
          ...dbState,
          tournaments: nextTournaments,
          games: mergedGames,
        });
      } else if (item.itemType === 'rating') {
        const r = item.data as MonthlyRatingRecord;
        const exists = ratingHistory.some((x) => x.id === r.id);
        const nextRatings = exists
          ? ratingHistory.map((x) => (x.id === r.id ? r : x))
          : [...ratingHistory, r];
        await persistUpdate({ ...dbState, ratingHistory: nextRatings });
      }
    } else {
      // Restauration dans la base Parties Amicales
      if (item.itemType === 'opponent') {
        const opp = item.data as OpponentPlayer;
        const exists = friendlyOpponents.some((o) => o.id === opp.id);
        const nextOpps = exists
          ? friendlyOpponents.map((o) => (o.id === opp.id ? opp : o))
          : [...friendlyOpponents, opp];
        await persistFriendlyUpdate(
          { ...friendlyDbState, opponents: nextOpps },
          { skipAutoCreateOpponentsFromGames: true }
        );
      } else if (item.itemType === 'game') {
        const g = item.data as FideGame;
        const exists = friendlyGames.some((x) => x.id === g.id);
        const nextGames = exists
          ? friendlyGames.map((x) => (x.id === g.id ? g : x))
          : [...friendlyGames, g];
        await persistFriendlyUpdate({ ...friendlyDbState, games: nextGames });
      } else if (item.itemType === 'tournament') {
        const t = item.data as Tournament;
        const exists = friendlyTournaments.some((x) => x.id === t.id);
        const nextTournaments = exists
          ? friendlyTournaments.map((x) => (x.id === t.id ? t : x))
          : [...friendlyTournaments, t];
        const restoredGames = item.associatedGames || [];
        const existingGameIds = new Set(friendlyGames.map((g) => g.id));
        const mergedGames = [
          ...friendlyGames,
          ...restoredGames.filter((g) => !existingGameIds.has(g.id)),
        ];
        await persistFriendlyUpdate({
          ...friendlyDbState,
          tournaments: nextTournaments,
          games: mergedGames,
        });
      }
    }

    setDeletedVault(removeDeletedItemFromVault(item.id));
  };

  const handleRestoreSingleEntity = async (
    ledger: 'fide' | 'friendly',
    entityType: 'tournament' | 'game' | 'opponent',
    entity: Tournament | FideGame | OpponentPlayer
  ) => {
    if (ledger === 'fide') {
      if (entityType === 'tournament') {
        const t = entity as Tournament;
        const exists = tournaments.some((x) => x.id === t.id);
        const next = exists
          ? tournaments.map((x) => (x.id === t.id ? t : x))
          : [...tournaments, t];
        await persistUpdate({ ...dbState, tournaments: next });
      } else if (entityType === 'game') {
        const g = entity as FideGame;
        const exists = games.some((x) => x.id === g.id);
        const next = exists
          ? games.map((x) => (x.id === g.id ? g : x))
          : [...games, g];
        await persistUpdate({ ...dbState, games: next });
      } else {
        const o = entity as OpponentPlayer;
        const exists = opponents.some((x) => x.id === o.id);
        const next = exists
          ? opponents.map((x) => (x.id === o.id ? o : x))
          : [...opponents, o];
        await persistUpdate(
          { ...dbState, opponents: next },
          { skipAutoCreateOpponentsFromGames: true }
        );
      }
    } else {
      if (entityType === 'tournament') {
        const t = entity as Tournament;
        const exists = friendlyTournaments.some((x) => x.id === t.id);
        const next = exists
          ? friendlyTournaments.map((x) => (x.id === t.id ? t : x))
          : [...friendlyTournaments, t];
        await persistFriendlyUpdate({ ...friendlyDbState, tournaments: next });
      } else if (entityType === 'game') {
        const g = entity as FideGame;
        const exists = friendlyGames.some((x) => x.id === g.id);
        const next = exists
          ? friendlyGames.map((x) => (x.id === g.id ? g : x))
          : [...friendlyGames, g];
        await persistFriendlyUpdate({ ...friendlyDbState, games: next });
      } else {
        const o = entity as OpponentPlayer;
        const exists = friendlyOpponents.some((x) => x.id === o.id);
        const next = exists
          ? friendlyOpponents.map((x) => (x.id === o.id ? o : x))
          : [...friendlyOpponents, o];
        await persistFriendlyUpdate(
          { ...friendlyDbState, opponents: next },
          { skipAutoCreateOpponentsFromGames: true }
        );
      }
    }
  };

  // Dashboard Metrics
  const dashboardStats = useMemo(() => {
    const sortedRatings = [...ratingHistory].sort((a, b) =>
      a.period.localeCompare(b.period)
    );
    const latestRating = sortedRatings[sortedRatings.length - 1];
    const currentStd = latestRating?.standardElo ?? profile?.standardElo ?? 1500;
    const currentRapid = latestRating?.rapidElo ?? profile?.rapidElo ?? 1500;
    const currentBlitz = latestRating?.blitzElo ?? profile?.blitzElo ?? 1500;

    const totalGames = games.length;
    const wins = games.filter((g) => g.playerScore === 1).length;
    const draws = games.filter((g) => g.playerScore === 0.5).length;
    const losses = games.filter((g) => g.playerScore === 0).length;
    const winPct = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    const drawPct = totalGames > 0 ? Math.round((draws / totalGames) * 100) : 0;
    const lossPct = totalGames > 0 ? Math.max(0, 100 - winPct - drawPct) : 0;
    const netEloTotal =
      Math.round(games.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;
    const globalPerf = calculateFidePerformanceRating(games);

    return {
      currentStd,
      currentRapid,
      currentBlitz,
      totalGames,
      wins,
      draws,
      losses,
      winPct,
      drawPct,
      lossPct,
      netEloTotal,
      globalPerf,
    };
  }, [ratingHistory, profile, games]);

  // PAGE DE CONNEXION
  if (!session.isAuthenticated) {
    return (
      <LoginSection
        defaultName={profile?.displayName || session.playerName}
        onLogin={handleLogin}
      />
    );
  }

  const fideNavItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    {
      id: 'tournaments',
      label: 'Tournois classés',
      icon: Trophy,
      badge: tournaments.length,
    },
    { id: 'games', label: 'Parties classées', icon: Swords, badge: games.length },
    {
      id: 'players',
      label: 'Joueurs affrontés',
      icon: Users,
      badge: opponents.length,
    },
    { id: 'statistics', label: 'Statistiques & Elo', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#efece6] text-[#1c222b]">
      {/* BARRE DE NAVIGATION LATÉRALE GAUCHE (Desktop) */}
      <aside className="hidden md:flex md:w-68 xl:w-72 shrink-0 bg-[#1e2430] text-[#ebe8e0] flex-col justify-between sticky top-0 h-screen border-r border-[#2c3444] select-none">
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Marque / Titre */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-[#f7f5f0] leading-tight">
                FIDE Chess Ledger
              </div>
              <div className="text-xs text-[#9ca6b8]">
                Carnet Classé & Amical
              </div>
            </div>
          </div>

          {/* Carte résumé du joueur dans la barre latérale */}
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full text-left p-3.5 rounded-2xl bg-[#272f3d] hover:bg-[#2e3747] border border-[#364052] transition-colors cursor-pointer space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#f7f5f0] truncate">
                {profile?.displayName || 'Mon Profil'}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-400/25">
                K={profile?.kFactor || 20}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
              <div className="p-1.5 rounded-lg bg-[#1e2430]/80">
                <div className="text-[10px] text-[#9ca6b8] font-sans">Class.</div>
                <div className="text-xs font-bold text-indigo-300">
                  {dashboardStats.currentStd}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#1e2430]/80">
                <div className="text-[10px] text-[#9ca6b8] font-sans">Rapide</div>
                <div className="text-xs font-bold text-amber-300">
                  {dashboardStats.currentRapid}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#1e2430]/80">
                <div className="text-[10px] text-[#9ca6b8] font-sans">Blitz</div>
                <div className="text-xs font-bold text-sky-300">
                  {dashboardStats.currentBlitz}
                </div>
              </div>
            </div>
          </button>

          {/* Menu 1 : Base Classée FIDE */}
          <nav className="space-y-1">
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-indigo-300/90">
              1 · Parties Classées (Bin #1)
            </div>
            {fideNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'players') setSelectedOpponentId(null);
                    setActiveTab(item.id);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-[#c9c6be] hover:bg-[#28303f] hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-white' : 'text-[#9ca6b8]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-indigo-800/80 text-indigo-100'
                          : 'bg-[#28303f] text-[#aeb6c4]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Menu 2 : Espace Indépendant Parties Amicales */}
          <nav className="space-y-1 pt-2 border-t border-[#2c3444]">
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">
              2 · Espace Indépendant (Bin #2)
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('friendly')}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'friendly'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[#c9c6be] bg-emerald-950/30 border border-emerald-500/20 hover:bg-emerald-900/40 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <Coffee
                  className={`w-4 h-4 ${
                    activeTab === 'friendly' ? 'text-white' : 'text-emerald-400'
                  }`}
                />
                <span>Parties Amicales</span>
              </span>
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                  activeTab === 'friendly'
                    ? 'bg-emerald-800 text-emerald-100'
                    : 'bg-[#28303f] text-emerald-300'
                }`}
              >
                {friendlyGames.length}
              </span>
            </button>
          </nav>

          {/* Menu 3 : Paramètres, Statuts JSONBin & Cache Local */}
          <nav className="space-y-1 pt-2 border-t border-[#2c3444]">
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8c96a8]">
              Système & Restauration
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-[#c9c6be] hover:bg-[#28303f] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <Settings
                  className={`w-4 h-4 ${
                    activeTab === 'settings' ? 'text-white' : 'text-[#9ca6b8]'
                  }`}
                />
                <span>Paramètres & Cache</span>
              </span>
              {deletedVault.length > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {deletedVault.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Bas de la barre latérale : Statut rapide des 2 Bins & Déconnexion */}
        <div className="p-4 border-t border-[#2c3444] bg-[#191e28] space-y-2.5">
          <div className="space-y-1 px-1 text-[11px] text-[#9ca6b8]">
            <div className="flex items-center justify-between">
              <span>Bin #1 (Classé)</span>
              <span
                className={`font-mono ${
                  fideStatus.state === 'error'
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              >
                ● {fideStatus.state === 'syncing' ? 'Sync...' : 'Actif'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Bin #2 (Amical)</span>
              <span
                className={`font-mono ${
                  friendlyStatus.state === 'error'
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              >
                ● {friendlyStatus.state === 'syncing' ? 'Sync...' : 'Isolé'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                activeTab === 'friendly'
                  ? loadFriendlyFromJsonBin()
                  : loadFromJsonBin()
              }
              disabled={isLoading || isSyncing || isSyncingFriendly}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#e5e2da] bg-[#272f3d] hover:bg-[#323c4e] border border-[#364052] rounded-xl transition-colors cursor-pointer"
              title="Actualiser le JSONBin actif"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoading || isSyncing || isSyncingFriendly
                    ? 'animate-spin text-indigo-300'
                    : ''
                }`}
              />
              Actualiser
            </button>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#e5e2da] bg-[#272f3d] hover:bg-[#323c4e] border border-[#364052] rounded-xl transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-300" />
              Mon Profil
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-900/40 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Changer de compte / Déconnexion
          </button>
        </div>
      </aside>

      {/* Navigation Mobile (Bandeau supérieur uniquement sur petit écran) */}
      <div className="md:hidden bg-[#1e2430] text-[#f7f5f0] p-4 space-y-3 border-b border-[#2c3444]">
        <div className="flex items-center justify-between">
          <div className="font-bold text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-indigo-400" />
            FIDE Chess Ledger
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#272f3d] rounded-lg"
            >
              {profile?.displayName || 'Profil'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-rose-300 bg-[#272f3d] rounded-lg"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {fideNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'players') setSelectedOpponentId(null);
                  setActiveTab(item.id);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#272f3d] text-[#c9c6be]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveTab('friendly')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
              activeTab === 'friendly'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            Parties Amicales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-violet-600 text-white'
                : 'bg-[#272f3d] text-[#c9c6be]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Paramètres & Cache
          </button>
        </div>
      </div>

      {/* Zone Principale de Contenu à Droite */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <main className="max-w-[1260px] w-full mx-auto px-4 sm:px-7 lg:px-10 py-8 space-y-7">
          {errorBanner && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div className="font-mono break-all">{errorBanner}</div>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-rose-700 underline shrink-0 font-semibold"
              >
                Fermer
              </button>
            </div>
          )}

          {/* Bannière si la base JSONBin #1 est vide (uniquement sur les onglets FIDE) */}
          {!isLoading &&
            activeTab !== 'friendly' &&
            activeTab !== 'settings' &&
            games.length === 0 &&
            tournaments.length === 0 && (
              <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-1.5 max-w-2xl">
                  <h2 className="text-base font-bold text-indigo-950">
                    Votre espace JSONBin Classé (#1) est connecté et prêt à l’emploi
                  </h2>
                  <p className="text-sm text-slate-600">
                    Vous pouvez commencer à créer vos tournois et vos joueurs dès maintenant, ou charger en 1 clic un exemple complet (3 tournois, 7 parties, 6 joueurs FIDE/FFE avec Elos Classique/Rapide/Blitz et 12 mois d’Elo).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleLoadSampleData}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Database className="w-4 h-4" />
                    {isSyncing
                      ? 'Chargement...'
                      : 'Charger des données d’exemple (Modifiables)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tournaments')}
                    className="px-4 py-2.5 text-xs font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-xl"
                  >
                    Créer mon premier tournoi
                  </button>
                </div>
              </div>
            )}

          {/* ONGLET 1 : DASHBOARD CLASSÉ FIDE */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Carte Principale du Joueur */}
              <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-6 space-y-6 shadow-2xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono">
                      <span className="text-indigo-700 font-semibold">
                        ID FIDE : {profile?.fideId || 'Non renseigné'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-800 font-semibold">
                        Code FFE : {profile?.ffeId || 'Non renseigné'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-700 font-semibold">
                        Facteur K = {profile?.kFactor || 20}
                      </span>
                      {profile?.club && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-sans font-semibold text-slate-800">
                            {profile.club}
                          </span>
                        </>
                      )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5">
                      {profile?.displayName || 'Mon Profil Échecs'}
                    </h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('tournaments')}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Rentrer un tournoi / une partie
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('friendly')}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                    >
                      <Coffee className="w-4 h-4 text-emerald-700" />
                      Espace Parties Amicales ({friendlyGames.length})
                    </button>
                  </div>
                </div>

                {/* Les 6 Chiffres Clés du Dashboard avec Couleurs Sémantiques */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono tabular-nums">
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                    <div className="text-xs font-sans font-bold text-indigo-900">
                      Elo Classique
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mt-1">
                      {dashboardStats.currentStd}
                    </div>
                    <div className="text-[11px] font-sans font-medium text-indigo-800/80 mt-1">
                      Objectif : {profile?.targetElo || 2000}
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
                    <div className="text-xs font-sans font-bold text-amber-900">
                      Elo Rapide
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-1">
                      {dashboardStats.currentRapid}
                    </div>
                    <div className="text-[11px] font-sans font-medium text-amber-800/80 mt-1">
                      Cadence rapide
                    </div>
                  </div>

                  <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl">
                    <div className="text-xs font-sans font-bold text-sky-900">
                      Elo Blitz
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-sky-700 mt-1">
                      {dashboardStats.currentBlitz}
                    </div>
                    <div className="text-[11px] font-sans font-medium text-sky-800/80 mt-1">
                      Cadence blitz
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <div className="text-xs font-sans font-bold text-emerald-900">
                      Taux de Victoire
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1">
                      {dashboardStats.winPct}%
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-800 mt-1">
                      +{dashboardStats.wins}V · ={dashboardStats.draws}N · -
                      {dashboardStats.losses}D
                    </div>
                    {dashboardStats.totalGames > 0 && (
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex mt-2">
                        <div
                          style={{ width: `${dashboardStats.winPct}%` }}
                          className="bg-emerald-500 h-full"
                        />
                        <div
                          style={{ width: `${dashboardStats.drawPct}%` }}
                          className="bg-amber-400 h-full"
                        />
                        <div
                          style={{ width: `${dashboardStats.lossPct}%` }}
                          className="bg-rose-500 h-full"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-violet-50/70 border border-violet-200 rounded-xl">
                    <div className="text-xs font-sans font-bold text-violet-900">
                      Performance FIDE
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-violet-700 mt-1">
                      {dashboardStats.globalPerf || '—'}
                    </div>
                    <div className="text-[11px] font-sans font-medium text-violet-800/80 mt-1">
                      Sur {dashboardStats.totalGames} parties
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-xl border ${
                      dashboardStats.netEloTotal >= 0
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-rose-50/70 border-rose-200'
                    }`}
                  >
                    <div
                      className={`text-xs font-sans font-bold ${
                        dashboardStats.netEloTotal >= 0
                          ? 'text-emerald-900'
                          : 'text-rose-900'
                      }`}
                    >
                      Bilan Elo Total
                    </div>
                    <div
                      className={`text-2xl sm:text-3xl font-extrabold mt-1 ${
                        dashboardStats.netEloTotal >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {dashboardStats.netEloTotal >= 0
                        ? `+${dashboardStats.netEloTotal.toFixed(1)}`
                        : dashboardStats.netEloTotal.toFixed(1)}
                    </div>
                    <div
                      className={`text-[11px] font-sans font-medium mt-1 ${
                        dashboardStats.netEloTotal >= 0
                          ? 'text-emerald-800/80'
                          : 'text-rose-800/80'
                      }`}
                    >
                      Points gagnés
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphique d'évolution mensuelle sur le Dashboard */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Évolution de mon classement Elo au fil des mois
                    </h2>
                    <p className="text-xs text-slate-600">
                      Courbes colorées :{' '}
                      <strong className="text-indigo-700">
                        Classique (Indigo)
                      </strong>
                      ,{' '}
                      <strong className="text-amber-700">Rapide (Ambre)</strong>{' '}
                      et <strong className="text-sky-700">Blitz (Bleu)</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('statistics')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                  >
                    Voir toutes mes statistiques & ajouter un mois
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <EloEvolutionChart
                  records={ratingHistory}
                  targetElo={profile?.targetElo || 2000}
                />
              </div>

              {/* Résumé des Derniers Tournois & Principaux Adversaires */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Derniers Tournois */}
                <div className="lg:col-span-7 bg-white border border-slate-200 border-t-4 border-t-amber-500 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-6 py-4 border-b border-slate-200 bg-amber-50/30 flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-600" />
                      Mes Tournois Classés Récents ({tournaments.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('tournaments')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:underline"
                    >
                      Gérer mes tournois
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {tournaments.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      Aucun tournoi enregistré.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 text-sm">
                      {tournaments
                        .slice()
                        .sort((a, b) => b.startDate.localeCompare(a.startDate))
                        .slice(0, 4)
                        .map((t) => {
                          const tGames = games.filter(
                            (g) => g.tournamentId === t.id
                          );
                          const score = tGames.reduce(
                            (acc, g) => acc + g.playerScore,
                            0
                          );
                          const netElo =
                            Math.round(
                              tGames.reduce((acc, g) => acc + g.eloChange, 0) *
                                10
                            ) / 10;
                          const perf = calculateFidePerformanceRating(tGames);
                          const cadenceBorder =
                            t.timeControl === 'Rapid'
                              ? 'border-l-4 border-l-amber-500'
                              : t.timeControl === 'Blitz'
                              ? 'border-l-4 border-l-sky-500'
                              : 'border-l-4 border-l-indigo-600';
                          const cadenceText =
                            t.timeControl === 'Rapid'
                              ? 'text-amber-700 font-bold'
                              : t.timeControl === 'Blitz'
                              ? 'text-sky-700 font-bold'
                              : 'text-indigo-700 font-bold';

                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                setSelectedTournamentFilter(t.id);
                                setActiveTab('games');
                              }}
                              className={`p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-4 transition-colors ${cadenceBorder}`}
                            >
                              <div>
                                <div className="font-bold text-slate-900">
                                  {t.name}
                                </div>
                                <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span>{t.location}</span>
                                  <span>·</span>
                                  <span className={cadenceText}>
                                    {t.timeControl === 'Standard'
                                      ? 'Classique'
                                      : t.timeControl === 'Rapid'
                                      ? 'Rapide'
                                      : 'Blitz'}
                                  </span>
                                  {t.finalRank && (
                                    <>
                                      <span>·</span>
                                      <span className="font-semibold text-slate-800">
                                        Classement : {t.finalRank}e
                                        {t.totalPlayers
                                          ? ` / ${t.totalPlayers}`
                                          : ''}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="text-right font-mono shrink-0">
                                <div className="font-bold text-slate-900">
                                  Score {score}/{tGames.length}{' '}
                                  <span
                                    className={
                                      netElo >= 0
                                        ? 'text-emerald-700'
                                        : 'text-rose-700'
                                    }
                                  >
                                    ({netElo >= 0 ? `+${netElo}` : netElo} Elo)
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-violet-700">
                                  Perf : {perf || '—'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Derniers Joueurs Affrontés */}
                <div className="lg:col-span-5 bg-white border border-slate-200 border-t-4 border-t-emerald-500 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-6 py-4 border-b border-slate-200 bg-emerald-50/30 flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-700" />
                      Joueurs Classés Affrontés ({opponents.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOpponentId(null);
                        setActiveTab('players');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline"
                    >
                      Voir tous les joueurs
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {opponents.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      Aucun adversaire enregistré.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 text-sm">
                      {opponents.slice(0, 5).map((opp) => {
                        const oppGames = games.filter(
                          (g) =>
                            g.opponentId === opp.id ||
                            (opp.fideId && g.opponentFideId === opp.fideId) ||
                            g.opponentName.toLowerCase() ===
                              opp.name.toLowerCase()
                        );
                        const wins = oppGames.filter(
                          (g) => g.playerScore === 1
                        ).length;
                        const draws = oppGames.filter(
                          (g) => g.playerScore === 0.5
                        ).length;
                        const losses = oppGames.filter(
                          (g) => g.playerScore === 0
                        ).length;
                        const winRate =
                          oppGames.length > 0
                            ? Math.round((wins / oppGames.length) * 100)
                            : 0;

                        return (
                          <div
                            key={opp.id}
                            onClick={() => {
                              setSelectedOpponentId(opp.id);
                              setActiveTab('players');
                            }}
                            className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-4 transition-colors"
                          >
                            <div>
                              <div className="font-bold text-slate-900 hover:text-indigo-700">
                                {opp.title !== 'None' && (
                                  <span className="font-mono text-amber-700 mr-1">
                                    {opp.title}
                                  </span>
                                )}
                                {formatPlayerNameLastFirst(opp.name)}
                              </div>
                              <div className="text-xs font-mono mt-0.5 flex flex-wrap items-center gap-2">
                                <span className="text-indigo-700 font-semibold">
                                  Std {opp.standardElo || opp.elo}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="text-amber-700 font-semibold">
                                  Rap {opp.rapidElo || opp.elo}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="text-sky-700 font-semibold">
                                  Blz {opp.blitzElo || opp.elo}
                                </span>
                              </div>
                            </div>

                            <div className="text-right font-mono shrink-0">
                              <div
                                className={`font-bold ${
                                  winRate >= 50
                                    ? 'text-emerald-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {winRate}% victoires
                              </div>
                              <div className="text-xs text-slate-600">
                                <span className="text-emerald-700 font-semibold">
                                  +{wins}
                                </span>{' '}
                                <span className="text-amber-700 font-semibold">
                                  ={draws}
                                </span>{' '}
                                <span className="text-rose-700 font-semibold">
                                  -{losses}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ONGLET 2 : TOURNOIS CLASSÉS */}
          {activeTab === 'tournaments' && (
            <TournamentsSection
              tournaments={tournaments}
              games={games}
              opponents={opponents}
              profile={profile}
              onSaveTournament={handleSaveTournament}
              onDeleteTournament={handleDeleteTournament}
              onSaveGame={handleSaveGame}
              onDeleteGame={handleDeleteGame}
              onSelectOpponentProfile={(oppId) => {
                setSelectedOpponentId(oppId);
                setActiveTab('players');
              }}
              onOpenGameInViewer={(game) => {
                setSelectedTournamentFilter(game.tournamentId);
                setInspectedGame(game);
                setActiveTab('games');
              }}
            />
          )}

          {/* ONGLET 3 : PARTIES CLASSÉES */}
          {activeTab === 'games' && (
            <GamesSection
              games={games}
              tournaments={tournaments}
              opponents={opponents}
              profile={profile}
              selectedTournamentFilter={selectedTournamentFilter}
              onSelectTournamentFilter={setSelectedTournamentFilter}
              inspectedGame={inspectedGame}
              onSetInspectedGame={setInspectedGame}
              onSaveGame={handleSaveGame}
              onDeleteGame={handleDeleteGame}
              onSelectOpponentProfile={(oppId) => {
                setSelectedOpponentId(oppId);
                setActiveTab('players');
              }}
              onGoToTournaments={() => setActiveTab('tournaments')}
            />
          )}

          {/* ONGLET 4 : JOUEURS CLASSÉS AFFRONTÉS */}
          {activeTab === 'players' && (
            <PlayersSection
              opponents={opponents}
              games={games}
              selectedOpponentId={selectedOpponentId}
              onSelectOpponent={setSelectedOpponentId}
              onSaveOpponent={handleSaveOpponent}
              onDeleteOpponent={handleDeleteOpponent}
              onOpenGameInViewer={(game) => {
                setSelectedTournamentFilter(game.tournamentId);
                setInspectedGame(game);
                setActiveTab('games');
              }}
            />
          )}

          {/* ONGLET 5 : STATISTIQUES & ÉVOLUTION ELO */}
          {activeTab === 'statistics' && (
            <StatisticsSection
              records={ratingHistory}
              games={games}
              profile={profile}
              onSaveRatingRecord={handleSaveRatingRecord}
              onDeleteRatingRecord={handleDeleteRatingRecord}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
            />
          )}

          {/* ONGLET 6 : ESPACE INDÉPENDANT PARTIES AMICALES (BIN #2) */}
          {activeTab === 'friendly' && (
            <FriendlySection
              friendlyDb={friendlyDbState}
              friendlyStatus={friendlyStatus}
              profile={profile}
              isSyncingFriendly={isSyncingFriendly}
              onRefreshFriendlyBin={() => loadFriendlyFromJsonBin()}
              onSaveTournament={handleSaveFriendlyTournament}
              onDeleteTournament={handleDeleteFriendlyTournament}
              onSaveGame={handleSaveFriendlyGame}
              onDeleteGame={handleDeleteFriendlyGame}
              onSaveOpponent={handleSaveFriendlyOpponent}
              onDeleteOpponent={handleDeleteFriendlyOpponent}
              onLoadSampleFriendlyData={handleLoadSampleFriendlyData}
              onInitializeEmptyFriendlyBin={handleInitializeEmptyFriendlyBin}
            />
          )}

          {/* ONGLET 7 : PARAMÈTRES, STATUTS DES 2 JSONBIN & CACHE LOCAL */}
          {activeTab === 'settings' && (
            <SettingsSection
              session={session}
              fideDb={dbState}
              friendlyDb={friendlyDbState}
              fideStatus={fideStatus}
              friendlyStatus={friendlyStatus}
              deletedVault={deletedVault}
              snapshots={snapshots}
              onUpdateSessionConfig={(nextSession) => {
                saveSession(nextSession);
                setSession(nextSession);
                setFideStatus((prev) => ({
                  ...prev,
                  binId: nextSession.binId,
                }));
                setFriendlyStatus((prev) => ({
                  ...prev,
                  binId: nextSession.friendlyBinId,
                }));
              }}
              onSyncFideFromCloud={() => loadFromJsonBin()}
              onPushFideToCloud={() => persistUpdate(dbState)}
              onSyncFriendlyFromCloud={() => loadFriendlyFromJsonBin()}
              onPushFriendlyToCloud={() =>
                persistFriendlyUpdate(friendlyDbState)
              }
              onRestoreDeletedItem={handleRestoreDeletedItem}
              onRemoveDeletedItem={(id) =>
                setDeletedVault(removeDeletedItemFromVault(id))
              }
              onClearDeletedVault={() => {
                clearDeletedVault();
                setDeletedVault([]);
              }}
              onCreateSnapshot={(ledger, reason) => {
                const payload = ledger === 'fide' ? dbState : friendlyDbState;
                setSnapshots(createLocalSnapshot(ledger, reason, payload));
              }}
              onDeleteSnapshot={(id) =>
                setSnapshots(deleteLocalSnapshot(id))
              }
              onRestoreFullSnapshot={async (snap) => {
                if (snap.ledger === 'fide') {
                  await persistUpdate(snap.payload as FideLedgerDatabase);
                } else {
                  await persistFriendlyUpdate(
                    snap.payload as FriendlyLedgerDatabase
                  );
                }
              }}
              onRestoreSelectiveFromSnapshot={async (snap, part) => {
                if (snap.ledger === 'fide') {
                  const p = snap.payload as FideLedgerDatabase;
                  await persistUpdate({
                    ...dbState,
                    [part]: p[part],
                  });
                } else {
                  const p = snap.payload as FriendlyLedgerDatabase;
                  await persistFriendlyUpdate({
                    ...friendlyDbState,
                    [part]: p[part],
                  });
                }
              }}
              onRestoreSingleEntity={handleRestoreSingleEntity}
            />
          )}
        </main>

        {/* Footer discret */}
        <footer className="mt-12 border-t border-slate-200 bg-white px-8 py-4 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-4">
          <div>
            FIDE Chess Ledger — Bin Classé (#1 : {session.binId}) · Bin Amical (#2 :{' '}
            {session.friendlyBinId || DEFAULT_FRIENDLY_JSONBIN_BIN_ID})
          </div>
          <div className="font-mono">
            Cache local actif · Dernière synchro :{' '}
            {dbState.updatedAt
              ? new Date(dbState.updatedAt).toLocaleString('fr-FR')
              : '—'}
          </div>
        </footer>
      </div>

      {isProfileModalOpen && (
        <ProfileModal
          profile={profile}
          defaultDisplayName={profile?.displayName}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}
