import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  LayoutDashboard,
  Plus,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import {
  BinSyncStatus,
  FriendlyLedgerDatabase,
} from '../services/jsonbinService';
import {
  FideGame,
  OpponentPlayer,
  PlayerColor,
  PlayerProfile,
  TimeControlCategory,
  Tournament,
} from '../types/fide';
import {
  formatPlayerNameDisplay,
  formatPlayerNameLastFirst,
  FREE_GAME_TOURNAMENT_ID,
  hasQuestionMarkName,
} from '../utils/fideValidation';
import { GamesSection } from './GamesSection';
import { PlayersSection } from './PlayersSection';
import { TournamentsSection } from './TournamentsSection';

type FriendlySubTab = 'overview' | 'games' | 'tournaments' | 'players';

interface FriendlySectionProps {
  friendlyDb: FriendlyLedgerDatabase;
  friendlyStatus: BinSyncStatus;
  profile: PlayerProfile;
  isSyncingFriendly: boolean;
  onRefreshFriendlyBin: () => Promise<void>;
  onSaveTournament: (
    input: Omit<Tournament, 'id' | 'ownerId'>,
    existingId?: string,
    initialGames?: Omit<
      FideGame,
      'id' | 'ownerId' | 'tournamentId' | 'tournamentName'
    >[]
  ) => Promise<void>;
  onDeleteTournament: (id: string) => Promise<void>;
  onSaveGame: (
    input: Omit<FideGame, 'id' | 'ownerId'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteGame: (id: string) => Promise<void>;
  onSaveOpponent: (
    input: Omit<OpponentPlayer, 'id'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteOpponent: (id: string) => Promise<void>;
  onLoadSampleFriendlyData: () => Promise<void>;
  onInitializeEmptyFriendlyBin: () => Promise<void>;
}

export const FriendlySection: React.FC<FriendlySectionProps> = ({
  friendlyDb,
  friendlyStatus,
  profile,
  isSyncingFriendly,
  onRefreshFriendlyBin,
  onSaveTournament,
  onDeleteTournament,
  onSaveGame,
  onDeleteGame,
  onSaveOpponent,
  onDeleteOpponent,
  onLoadSampleFriendlyData,
  onInitializeEmptyFriendlyBin,
}) => {
  const [subTab, setSubTab] = useState<FriendlySubTab>('overview');
  const [selectedTournamentFilter, setSelectedTournamentFilter] =
    useState<string>('');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(
    null
  );
  const [inspectedGame, setInspectedGame] = useState<FideGame | null>(null);

  const tournaments = friendlyDb.tournaments || [];
  const games = friendlyDb.games || [];
  const opponents = friendlyDb.opponents || [];

  const stats = useMemo(() => {
    const total = games.length;
    const wins = games.filter((g) => g.playerScore === 1).length;
    const draws = games.filter((g) => g.playerScore === 0.5).length;
    const losses = games.filter((g) => g.playerScore === 0).length;
    const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
    const drawPct = total > 0 ? Math.round((draws / total) * 100) : 0;
    const lossPct = total > 0 ? Math.max(0, 100 - winPct - drawPct) : 0;

    const freeGamesCount = games.filter(
      (g) => !g.tournamentId || g.tournamentId === FREE_GAME_TOURNAMENT_ID
    ).length;
    const stdGames = games.filter((g) => g.timeControl === 'Standard').length;
    const rapidGames = games.filter((g) => g.timeControl === 'Rapid').length;
    const blitzGames = games.filter((g) => g.timeControl === 'Blitz').length;

    return {
      total,
      wins,
      draws,
      losses,
      winPct,
      drawPct,
      lossPct,
      freeGamesCount,
      stdGames,
      rapidGames,
      blitzGames,
    };
  }, [games]);

  // Statistiques détaillées par cadence (sans Elo)
  const cadenceBreakdown = useMemo(() => {
    const getSubStats = (tc: TimeControlCategory) => {
      const list = games.filter((g) => g.timeControl === tc);
      const total = list.length;
      const wins = list.filter((g) => g.playerScore === 1).length;
      const draws = list.filter((g) => g.playerScore === 0.5).length;
      const losses = list.filter((g) => g.playerScore === 0).length;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      return { total, wins, draws, losses, winRate };
    };
    return {
      standard: getSubStats('Standard'),
      rapid: getSubStats('Rapid'),
      blitz: getSubStats('Blitz'),
    };
  }, [games]);

  // Saisie express de partie amicale (enregistrement rapide sans quitter la page)
  const [isQuickLoggerOpen, setIsQuickLoggerOpen] = useState(false);
  const [quickOpponentName, setQuickOpponentName] = useState('');
  const [quickOpponentUncertain, setQuickOpponentUncertain] = useState(false);
  const [quickScore, setQuickScore] = useState<0 | 0.5 | 1>(1);
  const [quickColor, setQuickColor] = useState<PlayerColor>('White');
  const [quickCadence, setQuickCadence] = useState<TimeControlCategory>('Blitz');
  const [quickDate, setQuickDate] = useState(new Date().toISOString().slice(0, 10));
  const [quickTournamentId, setQuickTournamentId] = useState(FREE_GAME_TOURNAMENT_ID);
  const [quickChessComUrl, setQuickChessComUrl] = useState('');
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);

  const handleQuickSaveFriendlyGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickOpponentName.trim()) return;
    setIsQuickSubmitting(true);
    try {
      const oppName = formatPlayerNameLastFirst(quickOpponentName);
      const uncertain = quickOpponentUncertain || hasQuestionMarkName(oppName);
      const result =
        quickScore === 1
          ? quickColor === 'White'
            ? '1-0'
            : '0-1'
          : quickScore === 0
          ? quickColor === 'White'
            ? '0-1'
            : '1-0'
          : '1/2-1/2';

      const selectedTourn = tournaments.find((t) => t.id === quickTournamentId);
      const tId = quickTournamentId || FREE_GAME_TOURNAMENT_ID;
      const tName = selectedTourn ? selectedTourn.name : 'Partie Libre (Hors tournoi)';

      await onSaveGame({
        tournamentId: tId,
        tournamentName: tName,
        round: 1,
        datePlayed: quickDate,
        timeControl: quickCadence,
        playerColor: quickColor,
        playerElo: profile.standardElo,
        opponentName: oppName,
        opponentNameUncertain: uncertain,
        opponentFideId: '',
        opponentFfeId: '',
        opponentElo: 0,
        opponentEloUnknown: true,
        opponentTitle: 'None',
        opponentFederation: 'FRA',
        result,
        playerScore: quickScore,
        termination: 'Agreement',
        kFactorUsed: 20,
        eloChange: 0,
        ecoCode: 'B00',
        openingName: 'Partie amicale',
        movesCount: 25,
        chessComUrl: quickChessComUrl.trim() || undefined,
        pgn: '',
        keyMomentNote: 'Partie amicale d\'entraînement',
      });

      setQuickOpponentName('');
      setQuickOpponentUncertain(false);
      setQuickChessComUrl('');
      setIsQuickLoggerOpen(false);
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const subNavItems: {
    id: FriendlySubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
    {
      id: 'games',
      label: 'Parties Amicales (Libres & Sessions)',
      icon: Swords,
      count: games.length,
    },
    {
      id: 'tournaments',
      label: 'Sessions & Tournois Amicaux',
      icon: Trophy,
      count: tournaments.length,
    },
    {
      id: 'players',
      label: 'Joueurs Affrontés',
      icon: Users,
      count: opponents.length,
    },
  ];

  return (
    <div className="space-y-5">
      {/* En-tête sobre et professionnel de l'Espace Parties Amicales */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[11px] font-mono font-bold text-slate-800">
              BASE INDÉPENDANTE · JSONBIN #2 ({friendlyStatus.binId}) · AUCUN IMPACT ELO
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Registre des Parties Amicales & Entraînement
            </h1>
            <p className="text-xs text-slate-600">
              Enregistrez vos parties amicales libres (sans tournoi) ou vos sessions d’entraînement. Les parties amicales ne génèrent ni gain ni perte d’Elo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsQuickLoggerOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md transition-colors cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-700" />
              {isQuickLoggerOpen ? 'Masquer saisie express' : '⚡ Saisie express (1 clic)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTournamentFilter(FREE_GAME_TOURNAMENT_ID);
                setSubTab('games');
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Parties libres (hors tournoi)
            </button>
            <button
              type="button"
              onClick={onRefreshFriendlyBin}
              disabled={isSyncingFriendly}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              title="Synchroniser uniquement le JSONBin des parties amicales (1 requête GET)"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-600 ${
                  isSyncingFriendly ? 'animate-spin' : ''
                }`}
              />
              {isSyncingFriendly ? 'Synchronisation...' : 'Actualiser Bin #2'}
            </button>
          </div>
        </div>

        {/* Formulaire de saisie express de partie amicale */}
        {isQuickLoggerOpen && (
          <form
            onSubmit={handleQuickSaveFriendlyGame}
            className="p-4 bg-amber-50/80 border border-amber-300 rounded-lg space-y-3 pt-3"
          >
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                  Enregistrement Express d'une Partie Amicale (Sans impact Elo)
                </h3>
              </div>
              <span className="text-[11px] text-amber-800 font-mono">
                Sauvegarde directe dans le Bin Amical
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs">
              {/* Choix adversaire ou saisie */}
              <div className="lg:col-span-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800">
                    Adversaire (NOM, Prénom) *
                  </label>
                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quickOpponentUncertain}
                      onChange={(e) => setQuickOpponentUncertain(e.target.checked)}
                      className="rounded border-amber-400"
                    />
                    Incertain (?)
                  </label>
                </div>
                <div className="space-y-1.5">
                  {opponents.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const matched = opponents.find((o) => o.id === e.target.value);
                          if (matched) {
                            setQuickOpponentName(matched.name);
                            setQuickOpponentUncertain(Boolean(matched.isNameUncertain));
                          }
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-800"
                    >
                      <option value="">-- Choisir un joueur déjà affronté --</option>
                      {opponents.slice().sort((a, b) => a.name.localeCompare(b.name)).map((o) => (
                        <option key={o.id} value={o.id}>
                          {formatPlayerNameDisplay(o.name, o.isNameUncertain)}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    required
                    value={quickOpponentName}
                    onChange={(e) => setQuickOpponentName(e.target.value)}
                    placeholder="Ex: DUPONT, Jean"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Résultat par rapport à moi : 3 boutons */}
              <div className="lg:col-span-3">
                <label className="block font-bold text-slate-800 mb-1">
                  Mon Résultat
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setQuickScore(1)}
                    className={`py-1.5 px-1 rounded font-bold text-xs border text-center transition-all cursor-pointer ${
                      quickScore === 1
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    Victoire
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickScore(0.5)}
                    className={`py-1.5 px-1 rounded font-bold text-xs border text-center transition-all cursor-pointer ${
                      quickScore === 0.5
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    Nulle
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickScore(0)}
                    className={`py-1.5 px-1 rounded font-bold text-xs border text-center transition-all cursor-pointer ${
                      quickScore === 0
                        ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                        : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50'
                    }`}
                  >
                    Défaite
                  </button>
                </div>
              </div>

              {/* Couleur */}
              <div className="lg:col-span-2">
                <label className="block font-bold text-slate-800 mb-1">
                  Ma couleur
                </label>
                <select
                  value={quickColor}
                  onChange={(e) => setQuickColor(e.target.value as PlayerColor)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold"
                >
                  <option value="White">Blancs</option>
                  <option value="Black">Noirs</option>
                </select>
              </div>

              {/* Cadence */}
              <div className="lg:col-span-3">
                <label className="block font-bold text-slate-800 mb-1">
                  Cadence
                </label>
                <select
                  value={quickCadence}
                  onChange={(e) => setQuickCadence(e.target.value as TimeControlCategory)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold"
                >
                  <option value="Blitz">Blitz (3m, 5m...)</option>
                  <option value="Rapid">Rapide (10m, 15m...)</option>
                  <option value="Standard">Classique</option>
                </select>
              </div>

              {/* Session / Libre */}
              <div className="lg:col-span-4">
                <label className="block font-bold text-slate-800 mb-1">
                  Cadre / Session
                </label>
                <select
                  value={quickTournamentId}
                  onChange={(e) => setQuickTournamentId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold"
                >
                  <option value={FREE_GAME_TOURNAMENT_ID}>
                    Partie Libre (Hors tournoi / Soirée club)
                  </option>
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.startDate})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="lg:col-span-3">
                <label className="block font-bold text-slate-800 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono"
                />
              </div>

              {/* Bouton de validation rapide */}
              <div className="lg:col-span-5 flex items-end">
                <button
                  type="submit"
                  disabled={isQuickSubmitting || !quickOpponentName.trim()}
                  className="w-full py-2 px-4 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-md transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {isQuickSubmitting ? 'Enregistrement...' : 'Enregistrer immédiatement la partie amicale'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Barre de sous-navigation de l'espace amical */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-200">
          {subNavItems.map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'players') setSelectedOpponentId(null);
                  setSubTab(item.id);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                      active
                        ? 'bg-slate-700 text-slate-100'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bannière d'initialisation si le Bin Amical est vide */}
      {games.length === 0 && tournaments.length === 0 && opponents.length === 0 && (
        <div className="bg-white border border-slate-300 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              Base JSONBin Amicale ({friendlyStatus.binId}) prête
            </h2>
            <p className="text-xs text-slate-600">
              Vous pouvez initialiser une structure vide sur ce JSONBin, charger des données d’exemple, ou saisir directement une partie amicale libre.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onInitializeEmptyFriendlyBin}
              disabled={isSyncingFriendly}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5 text-slate-600" />
              Initialiser Bin vide
            </button>
            <button
              type="button"
              onClick={onLoadSampleFriendlyData}
              disabled={isSyncingFriendly}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Charger un exemple
            </button>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 1 : VUE D'ENSEMBLE AMICALE */}
      {subTab === 'overview' && (
        <div className="space-y-5">
          {/* Chiffres Clés Amicaux (Sans Elo Gagné) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono tabular-nums">
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
                Total Parties
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {stats.total}
              </div>
              <div className="text-[11px] font-sans text-slate-500 mt-1">
                Dont {stats.freeGamesCount} libre(s)
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
                Taux de Victoires
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {stats.winPct}%
              </div>
              <div className="text-[11px] font-semibold text-slate-600 mt-1">
                +{stats.wins}V · ={stats.draws}N · -{stats.losses}D
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
                Joueurs Affrontés
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {opponents.length}
              </div>
              <div className="text-[11px] font-sans text-slate-500 mt-1">
                Répertoire isolé
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
                Classique
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {stats.stdGames}
              </div>
              <div className="text-[11px] font-sans text-slate-500 mt-1">
                Sans impact Elo
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
                Rapide
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {stats.rapidGames}
              </div>
              <div className="text-[11px] font-sans text-slate-500 mt-1">
                Sans impact Elo
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
                Blitz
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {stats.blitzGames}
              </div>
              <div className="text-[11px] font-sans text-slate-500 mt-1">
                Sans impact Elo
              </div>
            </div>
          </div>

          {/* Répartition détaillée par Cadence : Classique, Rapide, Blitz */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Classique (Standard)</span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {cadenceBreakdown.standard.total} partie(s)
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-emerald-700">
                  {cadenceBreakdown.standard.winRate}% victoires
                </span>
                <span className="text-[11px] font-mono text-slate-600">
                  +{cadenceBreakdown.standard.wins} · ={cadenceBreakdown.standard.draws} · -{cadenceBreakdown.standard.losses}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full"
                  style={{ width: `${cadenceBreakdown.standard.winRate}%` }}
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Rapide</span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {cadenceBreakdown.rapid.total} partie(s)
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-emerald-700">
                  {cadenceBreakdown.rapid.winRate}% victoires
                </span>
                <span className="text-[11px] font-mono text-slate-600">
                  +{cadenceBreakdown.rapid.wins} · ={cadenceBreakdown.rapid.draws} · -{cadenceBreakdown.rapid.losses}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full"
                  style={{ width: `${cadenceBreakdown.rapid.winRate}%` }}
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Blitz</span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {cadenceBreakdown.blitz.total} partie(s)
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-emerald-700">
                  {cadenceBreakdown.blitz.winRate}% victoires
                </span>
                <span className="text-[11px] font-mono text-slate-600">
                  +{cadenceBreakdown.blitz.wins} · ={cadenceBreakdown.blitz.draws} · -{cadenceBreakdown.blitz.losses}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full"
                  style={{ width: `${cadenceBreakdown.blitz.winRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Grille : Dernières Parties Amicales (Libres ou Sessions) & Joueurs Affrontés */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Dernières Parties Amicales */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-slate-600" />
                  Dernières Parties Amicales ({games.length})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTournamentFilter('');
                    setSubTab('games');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 hover:underline cursor-pointer"
                >
                  Ajouter / Voir tout
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {games.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Aucune partie amicale enregistrée.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 text-xs">
                  {games
                    .slice()
                    .sort((a, b) => b.datePlayed.localeCompare(a.datePlayed))
                    .slice(0, 6)
                    .map((g) => {
                      const uncertain = Boolean(
                        g.opponentNameUncertain ||
                          hasQuestionMarkName(g.opponentName)
                      );
                      const isFree =
                        !g.tournamentId ||
                        g.tournamentId === FREE_GAME_TOURNAMENT_ID;
                      return (
                        <div
                          key={g.id}
                          onClick={() => {
                            setSelectedTournamentFilter(
                              isFree ? FREE_GAME_TOURNAMENT_ID : g.tournamentId
                            );
                            setInspectedGame(g);
                            setSubTab('games');
                          }}
                          className="p-3.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-4 transition-colors"
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>
                                vs {formatPlayerNameLastFirst(g.opponentName)}
                              </span>
                              {uncertain && (
                                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded">
                                  ?
                                </span>
                              )}
                              <span className="font-mono text-slate-500 font-normal">
                                (Elo : {g.opponentEloUnknown ? '?' : g.opponentElo})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {g.datePlayed} ·{' '}
                              {isFree
                                ? 'Partie libre (Hors tournoi)'
                                : g.tournamentName}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                g.playerScore === 1
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : g.playerScore === 0
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {g.playerScore === 1
                                ? 'Victoire'
                                : g.playerScore === 0.5
                                ? 'Nulle'
                                : 'Défaite'}
                            </span>
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Joueurs Amicaux */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-600" />
                  Joueurs Affrontés ({opponents.length})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOpponentId(null);
                    setSubTab('players');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 hover:underline cursor-pointer"
                >
                  Répertoire complet
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {opponents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Aucun joueur amical enregistré.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 text-xs">
                  {opponents.slice(0, 6).map((opp) => {
                    const oppGames = games.filter(
                      (g) =>
                        g.opponentId === opp.id ||
                        formatPlayerNameLastFirst(g.opponentName).toLowerCase() ===
                          formatPlayerNameLastFirst(opp.name).toLowerCase()
                    );
                    const wins = oppGames.filter((g) => g.playerScore === 1).length;
                    const draws = oppGames.filter(
                      (g) => g.playerScore === 0.5
                    ).length;
                    const losses = oppGames.filter((g) => g.playerScore === 0).length;
                    const winRate =
                      oppGames.length > 0
                        ? Math.round((wins / oppGames.length) * 100)
                        : 0;
                    const uncertain = Boolean(
                      opp.isNameUncertain || hasQuestionMarkName(opp.name)
                    );

                    return (
                      <div
                        key={opp.id}
                        onClick={() => {
                          setSelectedOpponentId(opp.id);
                          setSubTab('players');
                        }}
                        className="p-3.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-4 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{formatPlayerNameLastFirst(opp.name)}</span>
                            {uncertain && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded">
                                ?
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            Std{' '}
                            {opp.isStandardEloUnknown || opp.isEloUnknown
                              ? '?'
                              : opp.standardElo || opp.elo}{' '}
                            · Rap{' '}
                            {opp.isRapidEloUnknown || opp.isEloUnknown
                              ? '?'
                              : opp.rapidElo || opp.elo}{' '}
                            · Blz{' '}
                            {opp.isBlitzEloUnknown || opp.isEloUnknown
                              ? '?'
                              : opp.blitzElo || opp.elo}
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <div className="font-bold text-slate-900">
                            {winRate}% victoires
                          </div>
                          <div className="text-[11px] text-slate-500">
                            +{wins}V · ={draws}N · -{losses}D
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

      {/* SOUS-ONGLET 2 : PARTIES AMICALES (AVEC PARTIES LIBRES HORS TOURNOI & SANS ELO) */}
      {subTab === 'games' && (
        <GamesSection
          games={games}
          tournaments={tournaments}
          opponents={opponents}
          profile={profile}
          selectedTournamentFilter={selectedTournamentFilter}
          onSelectTournamentFilter={setSelectedTournamentFilter}
          inspectedGame={inspectedGame}
          onSetInspectedGame={setInspectedGame}
          onSaveGame={onSaveGame}
          onDeleteGame={onDeleteGame}
          onSelectOpponentProfile={(oppId) => {
            setSelectedOpponentId(oppId);
            setSubTab('players');
          }}
          onGoToTournaments={() => setSubTab('tournaments')}
          isFriendlyMode={true}
        />
      )}

      {/* SOUS-ONGLET 3 : SESSIONS & TOURNOIS AMICAUX (SANS GAIN D'ELO) */}
      {subTab === 'tournaments' && (
        <TournamentsSection
          tournaments={tournaments}
          games={games}
          opponents={opponents}
          profile={profile}
          onSaveTournament={onSaveTournament}
          onDeleteTournament={onDeleteTournament}
          onSaveGame={onSaveGame}
          onDeleteGame={onDeleteGame}
          onSelectOpponentProfile={(oppId) => {
            setSelectedOpponentId(oppId);
            setSubTab('players');
          }}
          onOpenGameInViewer={(game) => {
            setSelectedTournamentFilter(
              !game.tournamentId || game.tournamentId === FREE_GAME_TOURNAMENT_ID
                ? FREE_GAME_TOURNAMENT_ID
                : game.tournamentId
            );
            setInspectedGame(game);
            setSubTab('games');
          }}
          isFriendlyMode={true}
        />
      )}

      {/* SOUS-ONGLET 4 : JOUEURS AFFRONTÉS EN AMICAL (SANS GAIN D'ELO) */}
      {subTab === 'players' && (
        <PlayersSection
          opponents={opponents}
          games={games}
          selectedOpponentId={selectedOpponentId}
          onSelectOpponent={setSelectedOpponentId}
          onSaveOpponent={onSaveOpponent}
          onDeleteOpponent={onDeleteOpponent}
          onOpenGameInViewer={(game) => {
            setSelectedTournamentFilter(
              !game.tournamentId || game.tournamentId === FREE_GAME_TOURNAMENT_ID
                ? FREE_GAME_TOURNAMENT_ID
                : game.tournamentId
            );
            setInspectedGame(game);
            setSubTab('games');
          }}
          isFriendlyMode={true}
        />
      )}
    </div>
  );
};
