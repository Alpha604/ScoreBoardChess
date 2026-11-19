/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Coffee,
  Crown,
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
  X,
} from 'lucide-react';
import { EloEvolutionChart } from './components/EloEvolutionChart';
import { FederationFlag } from './components/FederationFlag';
import { FriendlySection } from './components/FriendlySection';
import { GamesSection } from './components/GamesSection';
import { IconButton } from './components/IconButton';
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
  formatPlayerNameDisplay,
  formatPlayerNameLastFirst,
  hasQuestionMarkName,
  isOpponentEloUnknownForCadence,
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
    existingId?: string,
    initialGames?: Omit<
      FideGame,
      'id' | 'ownerId' | 'tournamentId' | 'tournamentName'
    >[]
  ) => {
    const clean = sanitizeTournamentPayload('default_player', input);
    const newTournamentId = existingId || `t_${Date.now().toString(36)}`;
    const nextTournaments = existingId
      ? tournaments.map((t) =>
          t.id === existingId ? { ...clean, id: existingId } : t
        )
      : [
          ...tournaments,
          {
            ...clean,
            id: newTournamentId,
          },
        ];

    const createdGames: FideGame[] =
      !existingId && initialGames && initialGames.length > 0
        ? initialGames.map((dg, idx) => ({
            ...sanitizeFideGamePayload('default_player', {
              ...dg,
              tournamentId: newTournamentId,
              tournamentName: clean.name,
            }),
            id: `g_${Date.now().toString(36)}_${idx}`,
          }))
        : [];

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
      : [...games, ...createdGames];

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
    existingId?: string,
    initialGames?: Omit<
      FideGame,
      'id' | 'ownerId' | 'tournamentId' | 'tournamentName'
    >[]
  ) => {
    const clean = sanitizeTournamentPayload('default_player', input);
    const newTournamentId = existingId || `ft_${Date.now().toString(36)}`;
    const nextTournaments = existingId
      ? friendlyTournaments.map((t) =>
          t.id === existingId ? { ...clean, id: existingId } : t
        )
      : [
          ...friendlyTournaments,
          {
            ...clean,
            id: newTournamentId,
          },
        ];

    const createdGames: FideGame[] =
      !existingId && initialGames && initialGames.length > 0
        ? initialGames.map((dg, idx) => ({
            ...sanitizeFideGamePayload('default_player', {
              ...dg,
              tournamentId: newTournamentId,
              tournamentName: clean.name,
              eloChange: 0,
            }),
            eloChange: 0,
            id: `fg_${Date.now().toString(36)}_${idx}`,
          }))
        : [];

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
      : [...friendlyGames, ...createdGames];

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
    const clean = {
      ...sanitizeFideGamePayload('default_player', input),
      eloChange: 0,
    };
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
    const manualTournamentIds = new Set(
      tournaments
        .filter(
          (t) =>
            t.manualEloDelta !== undefined &&
            t.manualEloDelta !== null &&
            !Number.isNaN(Number(t.manualEloDelta))
        )
        .map((t) => t.id)
    );
    const gamesNet = games
      .filter((g) => !manualTournamentIds.has(g.tournamentId))
      .reduce((acc, g) => acc + g.eloChange, 0);
    const manualTournamentsNet = tournaments.reduce(
      (acc, t) =>
        t.manualEloDelta !== undefined &&
        t.manualEloDelta !== null &&
        !Number.isNaN(Number(t.manualEloDelta))
          ? acc + Number(t.manualEloDelta)
          : acc,
      0
    );
    const netEloTotal =
      Math.round((gamesNet + manualTournamentsNet) * 10) / 10;
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
  }, [ratingHistory, profile, games, tournaments]);

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

  const activeSectionMeta: Record<ActiveTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Tableau de bord',
      subtitle: 'Vue synthétique du classement FIDE et des performances',
    },
    tournaments: {
      title: 'Tournois classés',
      subtitle: 'Suivi des compétitions officielles et rondes',
    },
    games: {
      title: 'Parties classées',
      subtitle: 'Historique PGN, ouvertures et variations Elo',
    },
    players: {
      title: 'Répertoire des joueurs',
      subtitle: 'Adversaires classés, fédérations et confrontations',
    },
    statistics: {
      title: 'Statistiques & Elo',
      subtitle: 'Analyses avancées, simulateur et historique mensuel',
    },
    friendly: {
      title: 'Parties amicales',
      subtitle: 'Espace hors classement isolé (Bin #2)',
    },
    settings: {
      title: 'Paramètres & Cache',
      subtitle: 'Synchronisation JSONBin, corbeille et instantanés locaux',
    },
  };

  const isAnySyncing = isLoading || isSyncing || isSyncingFriendly;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0B0E12] text-[#F1F4F8]">
      {/* BARRE D'ICÔNES LATÉRALE GAUCHE (Desktop — Icon Rail 76px) */}
      <aside className="hidden md:flex md:w-[76px] shrink-0 bg-[#0F131A] border-r border-[#1F2733] flex-col items-center justify-between py-4 sticky top-0 h-screen z-30 select-none">
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Marque */}
          <IconButton
            variant="surface"
            size="lg"
            tooltipPos="right"
            label="FIDE Chess Ledger — Accueil"
            onClick={() => setActiveTab('dashboard')}
            className="border-[#2E3A4D] bg-[#161D28]"
          >
            <Crown className="w-5 h-5 text-[#D4A853]" />
          </IconButton>

          {/* Drapeau & Profil Rapide */}
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            aria-label={`${profile?.displayName || 'Mon Profil'} · Std ${dashboardStats.currentStd}`}
            data-tooltip={`${profile?.displayName || 'Profil'} · Std ${dashboardStats.currentStd}`}
            data-tooltip-pos="right"
            className="w-11 h-11 rounded-xl bg-[#161D28] hover:bg-[#1E2634] border border-[#263142] flex items-center justify-center transition-colors cursor-pointer"
          >
            <FederationFlag code={profile?.federation || 'FRA'} size="sm" />
          </button>

          <div className="w-7 h-px bg-[#1F2733] my-1" />

          {/* Navigation FIDE (Bin #1) */}
          <nav className="flex flex-col items-center gap-2" aria-label="Navigation principale">
            {fideNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <IconButton
                  key={item.id}
                  variant={isActive ? 'active' : 'ghost'}
                  size="lg"
                  tooltipPos="right"
                  label={item.label}
                  badge={item.badge}
                  onClick={() => {
                    if (item.id === 'players') setSelectedOpponentId(null);
                    setActiveTab(item.id);
                  }}
                >
                  <Icon className="w-5 h-5" />
                </IconButton>
              );
            })}
          </nav>

          <div className="w-7 h-px bg-[#1F2733] my-1" />

          {/* Navigation Amical (Bin #2) & Paramètres */}
          <nav className="flex flex-col items-center gap-2" aria-label="Espaces secondaires">
            <IconButton
              variant={activeTab === 'friendly' ? 'active' : 'ghost'}
              size="lg"
              tooltipPos="right"
              label="Parties Amicales (Bin #2)"
              badge={friendlyGames.length}
              onClick={() => setActiveTab('friendly')}
            >
              <Coffee className="w-5 h-5" />
            </IconButton>

            <IconButton
              variant={activeTab === 'settings' ? 'active' : 'ghost'}
              size="lg"
              tooltipPos="right"
              label="Paramètres & Cache"
              badge={deletedVault.length > 0 ? deletedVault.length : undefined}
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="w-5 h-5" />
            </IconButton>
          </nav>
        </div>

        {/* Bas du Rail : Sync, Profil & Déconnexion */}
        <div className="flex flex-col items-center gap-2 pt-3 border-t border-[#1F2733] w-full">
          <IconButton
            variant="surface"
            size="md"
            tooltipPos="right"
            label={
              isAnySyncing
                ? 'Synchronisation en cours...'
                : 'Synchroniser le JSONBin actif'
            }
            disabled={isAnySyncing}
            onClick={() =>
              activeTab === 'friendly'
                ? loadFriendlyFromJsonBin()
                : loadFromJsonBin()
            }
          >
            <RefreshCw
              className={`w-4 h-4 ${
                isAnySyncing ? 'animate-spin text-emerald-400' : ''
              }`}
            />
          </IconButton>

          <IconButton
            variant="surface"
            size="md"
            tooltipPos="right"
            label={`Éditer le profil (${profile?.displayName || 'Joueur'})`}
            onClick={() => setIsProfileModalOpen(true)}
          >
            <UserCheck className="w-4 h-4" />
          </IconButton>

          <IconButton
            variant="danger"
            size="md"
            tooltipPos="right"
            label="Déconnexion"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
          </IconButton>
        </div>
      </aside>

      {/* Navigation Mobile Compacte (Icônes uniquement) */}
      <div className="md:hidden bg-[#0F131A] border-b border-[#1F2733] px-3 py-2.5 space-y-2.5 sticky top-0 z-30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#19202B] border border-[#2B3647] flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4 text-[#D4A853]" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-[#F1F4F8] truncate">
                {activeSectionMeta[activeTab].title}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <IconButton
              variant="surface"
              size="sm"
              tooltipPos="bottom"
              label="Synchroniser"
              disabled={isAnySyncing}
              onClick={() =>
                activeTab === 'friendly'
                  ? loadFriendlyFromJsonBin()
                  : loadFromJsonBin()
              }
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isAnySyncing ? 'animate-spin text-emerald-400' : ''
                }`}
              />
            </IconButton>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              aria-label="Profil joueur"
              data-tooltip={profile?.displayName || 'Profil'}
              data-tooltip-pos="bottom"
              className="w-8 h-8 rounded-lg bg-[#19202B] border border-[#2B3647] flex items-center justify-center cursor-pointer"
            >
              <FederationFlag code={profile?.federation || 'FRA'} size="xs" />
            </button>

            <IconButton
              variant="danger"
              size="sm"
              tooltipPos="bottom"
              label="Déconnexion"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-0.5">
          {fideNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <IconButton
                key={item.id}
                variant={active ? 'active' : 'ghost'}
                size="md"
                tooltipPos="bottom"
                label={item.label}
                badge={item.badge}
                onClick={() => {
                  if (item.id === 'players') setSelectedOpponentId(null);
                  setActiveTab(item.id);
                }}
              >
                <Icon className="w-4 h-4" />
              </IconButton>
            );
          })}
          <IconButton
            variant={activeTab === 'friendly' ? 'active' : 'ghost'}
            size="md"
            tooltipPos="bottom"
            label="Parties Amicales"
            badge={friendlyGames.length}
            onClick={() => setActiveTab('friendly')}
          >
            <Coffee className="w-4 h-4" />
          </IconButton>
          <IconButton
            variant={activeTab === 'settings' ? 'active' : 'ghost'}
            size="md"
            tooltipPos="bottom"
            label="Paramètres & Cache"
            badge={deletedVault.length > 0 ? deletedVault.length : undefined}
            onClick={() => setActiveTab('settings')}
          >
            <Settings className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      {/* Zone Principale de Contenu à Droite */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Barre Contextuelle Sticky (Desktop) */}
          <header className="hidden md:flex h-14 border-b border-[#1F2733] bg-[#0B0E12]/90 backdrop-blur-md sticky top-0 z-20 px-7 lg:px-10 items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="font-display text-sm font-bold text-[#F1F4F8] tracking-tight truncate">
                {activeSectionMeta[activeTab].title}
              </h2>
              <span className="text-[#334155]" aria-hidden="true">
                /
              </span>
              <span className="text-xs text-[#9BA7B8] truncate">
                {activeSectionMeta[activeTab].subtitle}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#9BA7B8]">
                <FederationFlag code={profile?.federation || 'FRA'} size="xs" />
                <span className="text-[#F1F4F8] font-semibold">
                  {profile?.displayName || 'Profil'}
                </span>
                <span className="text-[#475569]">·</span>
                <span className="text-emerald-400 font-bold">
                  Std {dashboardStats.currentStd}
                </span>
                <span className="text-[#475569]">·</span>
                <span className="text-[#D4A853]">
                  Rap {dashboardStats.currentRapid}
                </span>
                <span className="text-[#475569]">·</span>
                <span className="text-sky-400">
                  Blz {dashboardStats.currentBlitz}
                </span>
              </div>

              <div className="h-4 w-px bg-[#1F2733] hidden lg:block" />

              <div className="flex items-center gap-1.5">
                <IconButton
                  variant="primary"
                  size="sm"
                  tooltipPos="bottom"
                  label="Nouveau tournoi ou partie"
                  onClick={() => setActiveTab('tournaments')}
                >
                  <Plus className="w-4 h-4" />
                </IconButton>

                <IconButton
                  variant="surface"
                  size="sm"
                  tooltipPos="bottom"
                  label="Synchroniser JSONBin"
                  disabled={isAnySyncing}
                  onClick={() =>
                    activeTab === 'friendly'
                      ? loadFriendlyFromJsonBin()
                      : loadFromJsonBin()
                  }
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isAnySyncing ? 'animate-spin text-emerald-400' : ''
                    }`}
                  />
                </IconButton>
              </div>
            </div>
          </header>

          <main className="max-w-[1280px] w-full mx-auto px-4 sm:px-7 lg:px-10 py-6 space-y-6">
            {errorBanner && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <div className="font-mono break-all">{errorBanner}</div>
                </div>
                <IconButton
                  variant="danger"
                  size="xs"
                  label="Fermer l'alerte"
                  onClick={() => setErrorBanner(null)}
                >
                  <X className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            )}

            {/* Bannière si la base JSONBin #1 est vide (uniquement sur les onglets FIDE) */}
            {!isLoading &&
              activeTab !== 'friendly' &&
              activeTab !== 'settings' &&
              games.length === 0 &&
              tournaments.length === 0 && (
                <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-2xl">
                    <h2 className="font-display text-sm font-bold text-[#F1F4F8]">
                      Base JSONBin Classée (#1) prête à l’emploi
                    </h2>
                    <p className="text-xs text-[#9BA7B8]">
                      Enregistrez vos tournois et parties dès maintenant, ou chargez des données d’exemple pour explorer l’atelier.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <IconButton
                      variant="primary"
                      size="md"
                      label={
                        isSyncing
                          ? 'Chargement...'
                          : 'Charger des données d’exemple'
                      }
                      disabled={isSyncing}
                      onClick={handleLoadSampleData}
                    >
                      <Database className="w-4 h-4" />
                    </IconButton>
                    <IconButton
                      variant="gold"
                      size="md"
                      label="Créer mon premier tournoi"
                      onClick={() => setActiveTab('tournaments')}
                    >
                      <Plus className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>
              )}

            {/* ONGLET 1 : DASHBOARD CLASSÉ FIDE */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Carte Principale du Joueur */}
                <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-6 space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232C3A] pb-5">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#9BA7B8] font-mono">
                        <FederationFlag
                          code={profile?.federation || 'FRA'}
                          size="sm"
                          showCode
                        />
                        <span className="text-[#334155]" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          FIDE{' '}
                          <strong className="text-[#F1F4F8]">
                            {profile?.fideId || '—'}
                          </strong>
                        </span>
                        <span className="text-[#334155]" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          FFE{' '}
                          <strong className="text-[#F1F4F8]">
                            {profile?.ffeId || '—'}
                          </strong>
                        </span>
                        <span className="text-[#334155]" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[#D4A853]">
                          K={profile?.kFactor || 20}
                        </span>
                        {profile?.club && (
                          <>
                            <span className="text-[#334155]" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-sans text-[#CBD5E1]">
                              {profile.club}
                            </span>
                          </>
                        )}
                      </div>
                      <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F1F4F8] tracking-tight">
                        {profile?.displayName || 'Mon Profil Échecs'}
                      </h1>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <IconButton
                        variant="primary"
                        size="lg"
                        label="Enregistrer un tournoi ou une partie"
                        onClick={() => setActiveTab('tournaments')}
                      >
                        <Plus className="w-5 h-5" />
                      </IconButton>
                      <IconButton
                        variant="surface"
                        size="lg"
                        label="Ouvrir les Parties Amicales"
                        badge={friendlyGames.length}
                        onClick={() => setActiveTab('friendly')}
                      >
                        <Coffee className="w-5 h-5 text-[#D4A853]" />
                      </IconButton>
                      <IconButton
                        variant="surface"
                        size="lg"
                        label="Modifier mon profil joueur"
                        onClick={() => setIsProfileModalOpen(true)}
                      >
                        <UserCheck className="w-5 h-5" />
                      </IconButton>
                    </div>
                  </div>

                  {/* Les 6 Indicateurs Clés du Dashboard (Obsidian Matte) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono tabular-nums">
                    <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl hover:border-emerald-500/40 transition-colors">
                      <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#9BA7B8]">
                        Elo Classique
                      </div>
                      <div className="text-2xl font-bold text-emerald-400 mt-1.5">
                        {dashboardStats.currentStd}
                      </div>
                      <div className="text-[11px] font-sans text-[#6C788B] mt-1">
                        Cible :{' '}
                        <span className="font-mono text-[#D4A853]">
                          {profile?.targetElo || 2000}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl hover:border-[#D4A853]/40 transition-colors">
                      <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#9BA7B8]">
                        Elo Rapide
                      </div>
                      <div className="text-2xl font-bold text-[#D4A853] mt-1.5">
                        {dashboardStats.currentRapid}
                      </div>
                      <div className="text-[11px] font-sans text-[#6C788B] mt-1">
                        Cadence 10-25m
                      </div>
                    </div>

                    <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl hover:border-sky-400/40 transition-colors">
                      <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#9BA7B8]">
                        Elo Blitz
                      </div>
                      <div className="text-2xl font-bold text-sky-400 mt-1.5">
                        {dashboardStats.currentBlitz}
                      </div>
                      <div className="text-[11px] font-sans text-[#6C788B] mt-1">
                        Cadence 3-5m
                      </div>
                    </div>

                    <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl hover:border-[#36445A] transition-colors">
                      <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#9BA7B8]">
                        Victoires
                      </div>
                      <div className="text-2xl font-bold text-[#F1F4F8] mt-1.5">
                        {dashboardStats.winPct}%
                      </div>
                      <div className="text-[11px] font-mono text-[#9BA7B8] mt-1">
                        +{dashboardStats.wins} · ={dashboardStats.draws} · -
                        {dashboardStats.losses}
                      </div>
                    </div>

                    <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl hover:border-[#36445A] transition-colors">
                      <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#9BA7B8]">
                        Perf. FIDE
                      </div>
                      <div className="text-2xl font-bold text-[#F1F4F8] mt-1.5">
                        {dashboardStats.globalPerf || '—'}
                      </div>
                      <div className="text-[11px] font-sans text-[#6C788B] mt-1">
                        Sur {dashboardStats.totalGames} parties
                      </div>
                    </div>

                    <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl hover:border-[#36445A] transition-colors">
                      <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#9BA7B8]">
                        Bilan Net
                      </div>
                      <div
                        className={`text-2xl font-bold mt-1.5 ${
                          dashboardStats.netEloTotal >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {dashboardStats.netEloTotal >= 0
                          ? `+${dashboardStats.netEloTotal.toFixed(1)}`
                          : dashboardStats.netEloTotal.toFixed(1)}
                      </div>
                      <div className="text-[11px] font-sans text-[#6C788B] mt-1">
                        Variation cumulée
                      </div>
                    </div>
                  </div>
                </div>

                {/* Graphique d'évolution mensuelle sur le Dashboard */}
                <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-bold text-[#F1F4F8]">
                        Évolution mensuelle du classement Elo
                      </h2>
                      <p className="text-xs text-[#9BA7B8]">
                        Suivi comparatif des trois cadences (Classique, Rapide et Blitz).
                      </p>
                    </div>
                    <IconButton
                      variant="surface"
                      size="md"
                      label="Ouvrir les statistiques détaillées"
                      onClick={() => setActiveTab('statistics')}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </IconButton>
                  </div>

                  <EloEvolutionChart
                    records={ratingHistory}
                    targetElo={profile?.targetElo || 2000}
                  />
                </div>

                {/* Résumé des Derniers Tournois & Principaux Adversaires */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Derniers Tournois */}
                  <div className="lg:col-span-7 bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#232C3A] bg-[#19202B]/70 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-[#D4A853]" />
                        Tournois Classés Récents ({tournaments.length})
                      </h3>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        label="Voir tous les tournois"
                        onClick={() => setActiveTab('tournaments')}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </IconButton>
                    </div>

                    {tournaments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#6C788B]">
                        Aucun tournoi enregistré.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#232C3A] text-xs">
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
                            const gamesNetElo =
                              Math.round(
                                tGames.reduce((acc, g) => acc + g.eloChange, 0) *
                                  10
                              ) / 10;
                            const netElo =
                              t.manualEloDelta !== undefined &&
                              t.manualEloDelta !== null &&
                              !Number.isNaN(Number(t.manualEloDelta))
                                ? Math.round(Number(t.manualEloDelta) * 10) / 10
                                : gamesNetElo;
                            const perf =
                              t.manualPerformance &&
                              Number(t.manualPerformance) > 0
                                ? Math.round(Number(t.manualPerformance))
                                : calculateFidePerformanceRating(tGames);

                            return (
                              <div
                                key={t.id}
                                onClick={() => {
                                  setSelectedTournamentFilter(t.id);
                                  setActiveTab('games');
                                }}
                                className="p-4 hover:bg-[#19202B] cursor-pointer flex items-center justify-between gap-4 transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#F1F4F8] truncate">
                                    {t.name}
                                  </div>
                                  <div className="text-[11px] text-[#9BA7B8] mt-0.5 flex flex-wrap items-center gap-1.5">
                                    <span>{t.location}</span>
                                    <span className="text-[#475569]">·</span>
                                    <span className="text-[#CBD5E1]">
                                      {t.timeControl === 'Standard'
                                        ? 'Classique'
                                        : t.timeControl === 'Rapid'
                                        ? 'Rapide'
                                        : 'Blitz'}
                                    </span>
                                    {t.finalRank ? (
                                      <>
                                        <span className="text-[#475569]">·</span>
                                        <span className="font-mono text-[#D4A853]">
                                          {t.finalRank}e
                                          {t.totalPlayers
                                            ? ` / ${t.totalPlayers}`
                                            : ''}
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="text-right font-mono shrink-0">
                                  <div className="font-bold text-[#F1F4F8]">
                                    {score}/{tGames.length}{' '}
                                    <span
                                      className={
                                        netElo >= 0
                                          ? 'text-emerald-400'
                                          : 'text-rose-400'
                                      }
                                    >
                                      ({netElo >= 0 ? `+${netElo}` : netElo})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#6C788B]">
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
                  <div className="lg:col-span-5 bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#232C3A] bg-[#19202B]/70 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        Joueurs Affrontés ({opponents.length})
                      </h3>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        label="Ouvrir le répertoire des joueurs"
                        onClick={() => {
                          setSelectedOpponentId(null);
                          setActiveTab('players');
                        }}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </IconButton>
                    </div>

                    {opponents.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#6C788B]">
                        Aucun adversaire enregistré.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#232C3A] text-xs">
                        {opponents.slice(0, 5).map((opp) => {
                          const oppGames = games.filter(
                            (g) =>
                              g.opponentId === opp.id ||
                              (opp.fideId && g.opponentFideId === opp.fideId) ||
                              formatPlayerNameLastFirst(
                                g.opponentName
                              ).toLowerCase() ===
                                formatPlayerNameLastFirst(opp.name).toLowerCase()
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
                          const uncertain = Boolean(
                            opp.isNameUncertain || hasQuestionMarkName(opp.name)
                          );

                          const stdUnknown = isOpponentEloUnknownForCadence(
                            opp,
                            'Standard'
                          );
                          const rapidUnknown = isOpponentEloUnknownForCadence(
                            opp,
                            'Rapid'
                          );
                          const blitzUnknown = isOpponentEloUnknownForCadence(
                            opp,
                            'Blitz'
                          );

                          return (
                            <div
                              key={opp.id}
                              onClick={() => {
                                setSelectedOpponentId(opp.id);
                                setActiveTab('players');
                              }}
                              className="p-4 hover:bg-[#19202B] cursor-pointer flex items-center justify-between gap-4 transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-[#F1F4F8] flex items-center gap-2 min-w-0">
                                  <FederationFlag
                                    code={opp.federation || 'FRA'}
                                    size="xs"
                                  />
                                  {opp.title !== 'None' && (
                                    <span className="font-mono text-[10px] font-bold text-[#D4A853] shrink-0">
                                      {opp.title}
                                    </span>
                                  )}
                                  <span className="truncate">
                                    {formatPlayerNameLastFirst(opp.name)}
                                  </span>
                                  {uncertain && (
                                    <span className="text-[10px] font-mono font-bold text-[#D4A853] shrink-0">
                                      (?)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-[#9BA7B8] mt-1 flex flex-wrap items-center gap-2">
                                  <span>
                                    Std{' '}
                                    {stdUnknown
                                      ? '?'
                                      : opp.standardElo || opp.elo}
                                  </span>
                                  <span className="text-[#475569]">·</span>
                                  <span>
                                    Rap {rapidUnknown ? '?' : opp.rapidElo}
                                  </span>
                                  <span className="text-[#475569]">·</span>
                                  <span>
                                    Blz {blitzUnknown ? '?' : opp.blitzElo}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right font-mono shrink-0">
                                <div className="font-bold text-[#F1F4F8]">
                                  {winRate}%
                                </div>
                                <div className="text-[11px] text-[#6C788B]">
                                  +{wins} · ={draws} · -{losses}
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
              tournaments={tournaments}
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
        </div>

        {/* Footer discret Obsidian */}
        <footer className="mt-12 border-t border-[#1F2733] bg-[#0F131A] px-6 sm:px-8 py-4 text-xs text-[#6C788B] flex flex-wrap items-center justify-between gap-4">
          <div className="font-mono">
            FIDE Chess Ledger · Bin #1 : {session.binId} · Bin #2 :{' '}
            {session.friendlyBinId || DEFAULT_FRIENDLY_JSONBIN_BIN_ID}
          </div>
          <div className="font-mono">
            Synchro :{' '}
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
