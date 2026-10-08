/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Database,
  LogOut,
  Plus,
  RefreshCw,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { EloEvolutionChart } from './components/EloEvolutionChart';
import { GamesSection } from './components/GamesSection';
import { LoginSection } from './components/LoginSection';
import { PlayersSection } from './components/PlayersSection';
import { ProfileModal } from './components/ProfileModal';
import { StatisticsSection } from './components/StatisticsSection';
import { TournamentsSection } from './components/TournamentsSection';
import {
  clearSession,
  createEmptyDatabase,
  fetchDatabaseFromJsonBin,
  FideLedgerDatabase,
  getSavedSession,
  loadLocalCache,
  saveDatabaseToJsonBin,
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
  sanitizeFideGamePayload,
  sanitizeMonthlyRatingPayload,
  sanitizeOpponentPayload,
  sanitizePlayerProfilePayload,
  sanitizeTournamentPayload,
} from './utils/fideValidation';
import { buildSampleFideLedgerDatabase } from './utils/seedData';

type ActiveTab = 'dashboard' | 'tournaments' | 'games' | 'players' | 'statistics';

export default function App() {
  const [session, setSession] = useState<SessionConfig>(() => getSavedSession());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedTournamentFilter, setSelectedTournamentFilter] = useState<string>('');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [inspectedGame, setInspectedGame] = useState<FideGame | null>(null);

  const [dbState, setDbState] = useState<FideLedgerDatabase>(() => {
    return loadLocalCache() || createEmptyDatabase();
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const profile = dbState.profile;
  const opponents = dbState.opponents || [];
  const tournaments = dbState.tournaments || [];
  const games = dbState.games || [];
  const ratingHistory = dbState.ratingHistory || [];

  const loadFromJsonBin = useCallback(
    async (customSession?: SessionConfig) => {
      const target = customSession || session;
      setIsLoading(true);
      setErrorBanner(null);
      try {
        const remoteData = await fetchDatabaseFromJsonBin(
          target.binId,
          target.masterKey
        );
        setDbState(remoteData);
      } catch (err) {
        setErrorBanner(
          err instanceof Error
            ? err.message
            : 'Impossible de charger les données depuis JSONBin.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    if (session.isAuthenticated) {
      loadFromJsonBin(session);
    }
  }, [session.isAuthenticated]);

  const persistUpdate = async (nextDb: FideLedgerDatabase) => {
    const syncedOpponents = syncOpponentsWithGames(
      nextDb.opponents || [],
      nextDb.games || []
    );
    const updatedDb: FideLedgerDatabase = {
      ...nextDb,
      opponents: syncedOpponents,
    };
    setDbState(updatedDb);
    setIsSyncing(true);
    setErrorBanner(null);
    try {
      const saved = await saveDatabaseToJsonBin(
        updatedDb,
        session.binId,
        session.masterKey
      );
      setDbState(saved);
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la sauvegarde dans JSONBin.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = async (newSession: SessionConfig) => {
    const remoteData = await fetchDatabaseFromJsonBin(
      newSession.binId,
      newSession.masterKey
    );
    if (
      newSession.playerName &&
      remoteData.profile.displayName === 'Mon Profil FIDE'
    ) {
      remoteData.profile.displayName = newSession.playerName;
    }
    saveSession(newSession);
    setSession(newSession);
    setDbState(remoteData);
  };

  const handleLogout = () => {
    clearSession();
    setSession((prev) => ({ ...prev, isAuthenticated: false }));
  };

  // CRUD Handlers
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
    const nextOpponents = existingId
      ? opponents.map((o) =>
          o.id === existingId ? { ...clean, id: existingId } : o
        )
      : [
          ...opponents,
          {
            ...clean,
            id: `opp_${Date.now().toString(36)}`,
          },
        ];

    await persistUpdate({
      ...dbState,
      opponents: nextOpponents,
    });
  };

  const handleDeleteOpponent = async (id: string) => {
    const nextOpponents = opponents.filter((o) => o.id !== id);
    await persistUpdate({
      ...dbState,
      opponents: nextOpponents,
    });
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

    await persistUpdate({
      ...dbState,
      tournaments: nextTournaments,
    });
  };

  const handleDeleteTournament = async (id: string) => {
    const nextTournaments = tournaments.filter((t) => t.id !== id);
    await persistUpdate({
      ...dbState,
      tournaments: nextTournaments,
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

    await persistUpdate({
      ...dbState,
      games: nextGames,
    });
  };

  const handleDeleteGame = async (id: string) => {
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Top Navigation Bar (Strict 3-zone contract) */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white border-b-2 border-indigo-100 shadow-2xs">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-lg font-extrabold tracking-tight text-indigo-950 whitespace-nowrap"
        >
          FIDE Chess Ledger
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'tournaments', label: 'Tournois' },
            { id: 'games', label: 'Parties' },
            { id: 'players', label: 'Joueurs' },
            { id: 'statistics', label: 'Statistiques' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'players') setSelectedOpponentId(null);
                  setActiveTab(item.id as ActiveTab);
                }}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700 font-bold'
                    : 'border-transparent text-slate-600 hover:text-indigo-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadFromJsonBin()}
            disabled={isLoading || isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors whitespace-nowrap"
            title="Actualiser depuis JSONBin"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading || isSyncing ? 'animate-spin' : ''}`}
            />
            {isSyncing ? 'Sauvegarde...' : 'Sync'}
          </button>

          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors whitespace-nowrap shadow-2xs"
          >
            <UserCheck className="w-3.5 h-3.5" />
            {profile?.displayName || 'Mon Profil'}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 text-slate-500 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-xl transition-colors"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Navigation Mobile */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto px-4 py-2.5 bg-white border-b border-slate-200 text-xs">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'tournaments', label: 'Tournois' },
          { id: 'games', label: 'Parties' },
          { id: 'players', label: 'Joueurs' },
          { id: 'statistics', label: 'Statistiques' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.id === 'players') setSelectedOpponentId(null);
              setActiveTab(item.id as ActiveTab);
            }}
            className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap ${
              activeTab === item.id
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-indigo-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Contenu Principal */}
      <main className="flex-1 max-w-[1340px] w-full mx-auto px-4 sm:px-6 py-7 space-y-7">
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

        {/* Bannière si la base JSONBin est vide */}
        {!isLoading && games.length === 0 && tournaments.length === 0 && (
          <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-2xl">
              <h2 className="text-base font-bold text-indigo-950">
                Votre espace JSONBin est connecté et prêt à l’emploi
              </h2>
              <p className="text-sm text-slate-600">
                Vous pouvez commencer à créer vos tournois et vos joueurs dès maintenant, ou charger en 1 clic un exemple complet (3 tournois, 7 parties, 6 joueurs FIDE/FFE avec Elos Classique/Rapide/Blitz et 12 mois d’Elo) pour découvrir toutes les fonctions.
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

        {/* ONGLET 1 : DASHBOARD COLORÉ ET LISIBLE */}
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
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Rentrer un tournoi / une partie
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('players')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors"
                  >
                    <Users className="w-4 h-4 text-indigo-700" />
                    Voir mes adversaires ({opponents.length})
                  </button>
                </div>
              </div>

              {/* Les 6 Chiffres Clés du Dashboard avec Couleurs Sémantiques */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono tabular-nums">
                {/* 1. Elo Classique (Indigo) */}
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

                {/* 2. Elo Rapide (Ambre) */}
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

                {/* 3. Elo Blitz (Bleu Azur) */}
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

                {/* 4. Taux de Victoire (Émeraude + Barre W/D/L) */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <div className="text-xs font-sans font-bold text-emerald-900">
                    Taux de Victoire
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1">
                    {dashboardStats.winPct}%
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800 mt-1">
                    +{dashboardStats.wins}V · ={dashboardStats.draws}N · -{dashboardStats.losses}D
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

                {/* 5. Performance Moyenne (Violet) */}
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

                {/* 6. Total Elo Gagné (Émeraude ou Rose) */}
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
                    Courbes colorées : <strong className="text-indigo-700">Classique (Indigo)</strong>, <strong className="text-amber-700">Rapide (Ambre)</strong> et <strong className="text-sky-700">Blitz (Bleu)</strong>.
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
                    Mes Tournois Récents ({tournaments.length})
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
                        const tGames = games.filter((g) => g.tournamentId === t.id);
                        const score = tGames.reduce((acc, g) => acc + g.playerScore, 0);
                        const netElo =
                          Math.round(
                            tGames.reduce((acc, g) => acc + g.eloChange, 0) * 10
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
                              <div className="font-bold text-slate-900">{t.name}</div>
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
                                      {t.totalPlayers ? ` / ${t.totalPlayers}` : ''}
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
                                    netElo >= 0 ? 'text-emerald-700' : 'text-rose-700'
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
                    Joueurs Affrontés ({opponents.length})
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
                          g.opponentName.toLowerCase() === opp.name.toLowerCase()
                      );
                      const wins = oppGames.filter((g) => g.playerScore === 1).length;
                      const draws = oppGames.filter((g) => g.playerScore === 0.5).length;
                      const losses = oppGames.filter((g) => g.playerScore === 0).length;
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
                              {opp.name}
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
                                winRate >= 50 ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {winRate}% victoires
                            </div>
                            <div className="text-xs text-slate-600">
                              <span className="text-emerald-700 font-semibold">+{wins}</span>{' '}
                              <span className="text-amber-700 font-semibold">={draws}</span>{' '}
                              <span className="text-rose-700 font-semibold">-{losses}</span>
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

        {/* ONGLET 2 : TOURNOIS */}
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

        {/* ONGLET 3 : PARTIES */}
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

        {/* ONGLET 4 : JOUEURS AFFRONTÉS */}
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
      </main>

      {/* Footer discret */}
      <footer className="mt-12 border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <div>
          FIDE Chess Ledger — Sauvegarde automatique dans JSONBin ({session.binId})
        </div>
        <div className="font-mono">
          Dernière synchronisation :{' '}
          {dbState.updatedAt
            ? new Date(dbState.updatedAt).toLocaleString('fr-FR')
            : '—'}
        </div>
      </footer>

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
