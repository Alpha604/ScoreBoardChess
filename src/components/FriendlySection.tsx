import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Database,
  FileText,
  LayoutDashboard,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
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
  getOpponentEloForCadence,
  hasQuestionMarkName,
  isOpponentEloUnknownForCadence,
} from '../utils/fideValidation';
import { FederationFlag } from './FederationFlag';
import { GamesSection } from './GamesSection';
import { IconButton } from './IconButton';
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
        keyMomentNote: "Partie amicale d'entraînement",
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
    <div className="space-y-6">
      {/* En-tête de l'Espace Parties Amicales */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#D4A853]">
              Base isolée · JSONBin #2 ({friendlyStatus.binId}) · Sans impact Elo
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#F1F4F8]">
              Parties Amicales & Entraînement
            </h1>
            <p className="text-xs text-[#9BA7B8]">
              Enregistrez vos parties libres ou sessions amicales indépendamment de votre classement officiel.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <IconButton
              label={
                isQuickLoggerOpen
                  ? 'Masquer la saisie express'
                  : 'Saisie express en 1 clic'
              }
              variant={isQuickLoggerOpen ? 'gold' : 'surface'}
              size="md"
              tooltipPos="bottom"
              onClick={() => setIsQuickLoggerOpen((prev) => !prev)}
            >
              <Zap className="w-4 h-4" />
            </IconButton>

            <IconButton
              label="Voir les parties libres (hors tournoi)"
              variant="primary"
              size="md"
              tooltipPos="bottom"
              onClick={() => {
                setSelectedTournamentFilter(FREE_GAME_TOURNAMENT_ID);
                setSubTab('games');
              }}
            >
              <Plus className="w-4 h-4" />
            </IconButton>

            <IconButton
              label={
                isSyncingFriendly
                  ? 'Synchronisation en cours...'
                  : 'Actualiser Bin #2'
              }
              variant="surface"
              size="md"
              tooltipPos="bottom"
              disabled={isSyncingFriendly}
              onClick={onRefreshFriendlyBin}
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncingFriendly ? 'animate-spin' : ''}`}
              />
            </IconButton>
          </div>
        </div>

        {/* Formulaire de saisie express de partie amicale */}
        {isQuickLoggerOpen && (
          <form
            onSubmit={handleQuickSaveFriendlyGame}
            className="p-4 bg-[#19202B] border border-[#D4A853]/35 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[#232C3A] pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#D4A853]" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F1F4F8]">
                  Saisie Express · Sans impact Elo
                </h3>
              </div>
              <IconButton
                label="Fermer la saisie express"
                variant="ghost"
                size="xs"
                onClick={() => setIsQuickLoggerOpen(false)}
              >
                <X className="w-3.5 h-3.5" />
              </IconButton>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs">
              {/* Choix adversaire ou saisie */}
              <div className="lg:col-span-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-[#CBD5E1]">
                    Adversaire (NOM, Prénom) *
                  </label>
                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D4A853] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quickOpponentUncertain}
                      onChange={(e) => setQuickOpponentUncertain(e.target.checked)}
                      className="rounded border-[#2B3647] bg-[#131820]"
                    />
                    Incertain ?
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
                      className="w-full px-2.5 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-semibold text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Joueur déjà affronté --</option>
                      {opponents
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((o) => (
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
                    className="w-full px-2.5 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-semibold text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Résultat par rapport à moi : 3 boutons */}
              <div className="lg:col-span-3">
                <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                  Mon Résultat
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setQuickScore(1)}
                    className={`py-2 px-1 rounded-lg font-mono font-bold text-xs border text-center transition-all cursor-pointer ${
                      quickScore === 1
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-[#131820] text-[#9BA7B8] border-[#2B3647] hover:text-emerald-300'
                    }`}
                  >
                    1
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickScore(0.5)}
                    className={`py-2 px-1 rounded-lg font-mono font-bold text-xs border text-center transition-all cursor-pointer ${
                      quickScore === 0.5
                        ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/50'
                        : 'bg-[#131820] text-[#9BA7B8] border-[#2B3647] hover:text-[#D4A853]'
                    }`}
                  >
                    ½
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickScore(0)}
                    className={`py-2 px-1 rounded-lg font-mono font-bold text-xs border text-center transition-all cursor-pointer ${
                      quickScore === 0
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                        : 'bg-[#131820] text-[#9BA7B8] border-[#2B3647] hover:text-rose-300'
                    }`}
                  >
                    0
                  </button>
                </div>
              </div>

              {/* Couleur */}
              <div className="lg:col-span-2">
                <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                  Ma couleur
                </label>
                <select
                  value={quickColor}
                  onChange={(e) => setQuickColor(e.target.value as PlayerColor)}
                  className="w-full px-2.5 py-2 bg-[#131820] border border-[#2B3647] rounded-lg font-semibold text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                >
                  <option value="White">Blancs</option>
                  <option value="Black">Noirs</option>
                </select>
              </div>

              {/* Cadence */}
              <div className="lg:col-span-3">
                <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                  Cadence
                </label>
                <select
                  value={quickCadence}
                  onChange={(e) => setQuickCadence(e.target.value as TimeControlCategory)}
                  className="w-full px-2.5 py-2 bg-[#131820] border border-[#2B3647] rounded-lg font-semibold text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                >
                  <option value="Blitz">Blitz (3m, 5m...)</option>
                  <option value="Rapid">Rapide (10m, 15m...)</option>
                  <option value="Standard">Classique</option>
                </select>
              </div>

              {/* Session / Libre */}
              <div className="lg:col-span-5">
                <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                  Cadre / Session
                </label>
                <select
                  value={quickTournamentId}
                  onChange={(e) => setQuickTournamentId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#131820] border border-[#2B3647] rounded-lg font-semibold text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
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
                <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#131820] border border-[#2B3647] rounded-lg font-mono text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Lien Chess.com optionnel + Validation iconique */}
              <div className="lg:col-span-4 flex items-end gap-2">
                <input
                  type="url"
                  value={quickChessComUrl}
                  onChange={(e) => setQuickChessComUrl(e.target.value)}
                  placeholder="Lien Chess.com (optionnel)"
                  className="flex-1 px-2.5 py-2 bg-[#131820] border border-[#2B3647] rounded-lg font-mono text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                />
                <IconButton
                  type="submit"
                  label={
                    isQuickSubmitting
                      ? 'Enregistrement...'
                      : 'Enregistrer immédiatement la partie amicale'
                  }
                  variant="primary"
                  size="md"
                  disabled={isQuickSubmitting || !quickOpponentName.trim()}
                >
                  <Check className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
          </form>
        )}

        {/* Barre de sous-navigation responsive */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#232C3A]">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {subNavItems.map((item) => {
              const Icon = item.icon;
              const active = subTab === item.id;
              return (
                <IconButton
                  key={item.id}
                  label={item.label}
                  variant={active ? 'active' : 'surface'}
                  size="md"
                  tooltipPos="bottom"
                  badge={item.count !== undefined && item.count > 0 ? item.count : undefined}
                  onClick={() => {
                    if (item.id === 'players') setSelectedOpponentId(null);
                    setSubTab(item.id);
                  }}
                >
                  <Icon className="w-4 h-4" />
                </IconButton>
              );
            })}
          </div>
          <span className="text-xs font-mono text-[#9BA7B8] truncate">
            {subNavItems.find((i) => i.id === subTab)?.label}
          </span>
        </div>
      </div>

      {/* Bannière d'initialisation si le Bin Amical est vide */}
      {games.length === 0 && tournaments.length === 0 && opponents.length === 0 && (
        <div className="bg-[#131820] border border-[#2B3647] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-sm font-bold text-[#F1F4F8] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Base JSONBin Amicale ({friendlyStatus.binId}) prête
            </h2>
            <p className="text-xs text-[#9BA7B8]">
              Initialisez un Bin vide ou chargez un jeu d’exemple pour démarrer immédiatement.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <IconButton
              label="Initialiser le Bin vide"
              variant="surface"
              size="md"
              disabled={isSyncingFriendly}
              onClick={onInitializeEmptyFriendlyBin}
            >
              <Database className="w-4 h-4" />
            </IconButton>
            <IconButton
              label="Charger des données d'exemple"
              variant="gold"
              size="md"
              disabled={isSyncingFriendly}
              onClick={onLoadSampleFriendlyData}
            >
              <Sparkles className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 1 : VUE D'ENSEMBLE AMICALE */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Chiffres Clés Amicaux */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 font-mono tabular-nums">
            <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-2xl">
              <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#6C788B]">
                Total Parties
              </div>
              <div className="text-2xl font-bold text-[#F1F4F8] mt-1">
                {stats.total}
              </div>
              <div className="text-[11px] font-sans text-[#9BA7B8] mt-1">
                Dont {stats.freeGamesCount} libre(s)
              </div>
            </div>

            <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-2xl">
              <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#6C788B]">
                Victoires
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {stats.winPct}%
              </div>
              <div className="text-[11px] text-[#9BA7B8] mt-1">
                +{stats.wins}V · ={stats.draws}N · -{stats.losses}D
              </div>
            </div>

            <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-2xl">
              <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#6C788B]">
                Joueurs
              </div>
              <div className="text-2xl font-bold text-[#F1F4F8] mt-1">
                {opponents.length}
              </div>
              <div className="text-[11px] font-sans text-[#9BA7B8] mt-1">
                Répertoire isolé
              </div>
            </div>

            <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-2xl">
              <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#6C788B]">
                Classique
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {stats.stdGames}
              </div>
              <div className="text-[11px] font-sans text-[#9BA7B8] mt-1">
                Sans impact Elo
              </div>
            </div>

            <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-2xl">
              <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#6C788B]">
                Rapide
              </div>
              <div className="text-2xl font-bold text-[#D4A853] mt-1">
                {stats.rapidGames}
              </div>
              <div className="text-[11px] font-sans text-[#9BA7B8] mt-1">
                Sans impact Elo
              </div>
            </div>

            <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-2xl">
              <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#6C788B]">
                Blitz
              </div>
              <div className="text-2xl font-bold text-sky-400 mt-1">
                {stats.blitzGames}
              </div>
              <div className="text-[11px] font-sans text-[#9BA7B8] mt-1">
                Sans impact Elo
              </div>
            </div>
          </div>

          {/* Répartition détaillée par Cadence : Classique, Rapide, Blitz */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F1F4F8]">Classique (Standard)</span>
                <span className="text-[11px] font-mono text-[#6C788B]">
                  {cadenceBreakdown.standard.total} partie(s)
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono tabular-nums text-emerald-400">
                  {cadenceBreakdown.standard.winRate}% victoires
                </span>
                <span className="text-[11px] font-mono text-[#9BA7B8]">
                  +{cadenceBreakdown.standard.wins} · ={cadenceBreakdown.standard.draws} · -{cadenceBreakdown.standard.losses}
                </span>
              </div>
              <div className="w-full bg-[#19202B] rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${cadenceBreakdown.standard.winRate}%` }}
                />
              </div>
            </div>

            <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F1F4F8]">Rapide</span>
                <span className="text-[11px] font-mono text-[#6C788B]">
                  {cadenceBreakdown.rapid.total} partie(s)
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono tabular-nums text-[#D4A853]">
                  {cadenceBreakdown.rapid.winRate}% victoires
                </span>
                <span className="text-[11px] font-mono text-[#9BA7B8]">
                  +{cadenceBreakdown.rapid.wins} · ={cadenceBreakdown.rapid.draws} · -{cadenceBreakdown.rapid.losses}
                </span>
              </div>
              <div className="w-full bg-[#19202B] rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-[#D4A853] h-full"
                  style={{ width: `${cadenceBreakdown.rapid.winRate}%` }}
                />
              </div>
            </div>

            <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F1F4F8]">Blitz</span>
                <span className="text-[11px] font-mono text-[#6C788B]">
                  {cadenceBreakdown.blitz.total} partie(s)
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono tabular-nums text-sky-400">
                  {cadenceBreakdown.blitz.winRate}% victoires
                </span>
                <span className="text-[11px] font-mono text-[#9BA7B8]">
                  +{cadenceBreakdown.blitz.wins} · ={cadenceBreakdown.blitz.draws} · -{cadenceBreakdown.blitz.losses}
                </span>
              </div>
              <div className="w-full bg-[#19202B] rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="bg-sky-400 h-full"
                  style={{ width: `${cadenceBreakdown.blitz.winRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Grille : Dernières Parties Amicales & Joueurs Affrontés */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Dernières Parties Amicales */}
            <div className="lg:col-span-7 bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#232C3A] bg-[#0F131A] flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F1F4F8] flex items-center gap-2">
                  <Swords className="w-4 h-4 text-emerald-400" />
                  Dernières Parties Amicales ({games.length})
                </h3>
                <IconButton
                  label="Voir toutes les parties amicales"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setSelectedTournamentFilter('');
                    setSubTab('games');
                  }}
                >
                  <ArrowUpRight className="w-4 h-4" />
                </IconButton>
              </div>

              {games.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6C788B]">
                  Aucune partie amicale enregistrée.
                </div>
              ) : (
                <div className="divide-y divide-[#232C3A] text-xs">
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
                          className="p-4 hover:bg-[#19202B] cursor-pointer flex items-center justify-between gap-4 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#F1F4F8] flex items-center gap-2 flex-wrap">
                              <FederationFlag
                                code={g.opponentFederation || 'FRA'}
                                size="xs"
                              />
                              <span className="truncate">
                                vs {formatPlayerNameLastFirst(g.opponentName)}
                              </span>
                              {uncertain && (
                                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30 rounded">
                                  ?
                                </span>
                              )}
                              <span className="font-mono text-[#6C788B] font-normal">
                                ({g.opponentEloUnknown ? '?' : g.opponentElo})
                              </span>
                            </div>
                            <div className="text-[11px] text-[#9BA7B8] mt-1 font-mono">
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
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : g.playerScore === 0
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                  : 'bg-[#D4A853]/15 text-[#D4A853] border-[#D4A853]/30'
                              }`}
                            >
                              {g.playerScore === 1
                                ? 'Victoire'
                                : g.playerScore === 0.5
                                ? 'Nulle'
                                : 'Défaite'}
                            </span>
                            <FileText className="w-3.5 h-3.5 text-[#6C788B]" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Joueurs Amicaux */}
            <div className="lg:col-span-5 bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#232C3A] bg-[#0F131A] flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F1F4F8] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#D4A853]" />
                  Joueurs Affrontés ({opponents.length})
                </h3>
                <IconButton
                  label="Voir le répertoire complet"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setSelectedOpponentId(null);
                    setSubTab('players');
                  }}
                >
                  <ArrowUpRight className="w-4 h-4" />
                </IconButton>
              </div>

              {opponents.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6C788B]">
                  Aucun joueur amical enregistré.
                </div>
              ) : (
                <div className="divide-y divide-[#232C3A] text-xs">
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
                        className="p-4 hover:bg-[#19202B] cursor-pointer flex items-center justify-between gap-4 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#F1F4F8] flex items-center gap-2">
                            <FederationFlag
                              code={opp.federation || 'FRA'}
                              size="xs"
                            />
                            <span className="truncate">
                              {formatPlayerNameLastFirst(opp.name)}
                            </span>
                            {uncertain && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30 rounded">
                                ?
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-[#9BA7B8] mt-1">
                            Std{' '}
                            {isOpponentEloUnknownForCadence(opp, 'Standard')
                              ? '?'
                              : getOpponentEloForCadence(opp, 'Standard')}{' '}
                            · Rap{' '}
                            {isOpponentEloUnknownForCadence(opp, 'Rapid')
                              ? '?'
                              : getOpponentEloForCadence(opp, 'Rapid')}{' '}
                            · Blz{' '}
                            {isOpponentEloUnknownForCadence(opp, 'Blitz')
                              ? '?'
                              : getOpponentEloForCadence(opp, 'Blitz')}
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <div className="font-bold text-emerald-400">
                            {winRate}%
                          </div>
                          <div className="text-[11px] text-[#6C788B]">
                            +{wins}V·={draws}N·-{losses}D
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

      {/* SOUS-ONGLET 2 : PARTIES AMICALES */}
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

      {/* SOUS-ONGLET 3 : SESSIONS & TOURNOIS AMICAUX */}
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

      {/* SOUS-ONGLET 4 : JOUEURS AFFRONTÉS EN AMICAL */}
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
