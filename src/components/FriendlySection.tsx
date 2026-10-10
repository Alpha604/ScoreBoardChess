import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Coffee,
  Database,
  LayoutDashboard,
  Plus,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import {
  BinSyncStatus,
  FriendlyLedgerDatabase,
} from '../services/jsonbinService';
import {
  FideGame,
  OpponentPlayer,
  PlayerProfile,
  Tournament,
} from '../types/fide';
import { formatPlayerNameLastFirst } from '../utils/fideValidation';
import { GamesSection } from './GamesSection';
import { PlayersSection } from './PlayersSection';
import { TournamentsSection } from './TournamentsSection';

type FriendlySubTab = 'overview' | 'tournaments' | 'games' | 'players';

interface FriendlySectionProps {
  friendlyDb: FriendlyLedgerDatabase;
  friendlyStatus: BinSyncStatus;
  profile: PlayerProfile;
  isSyncingFriendly: boolean;
  onRefreshFriendlyBin: () => Promise<void>;
  onSaveTournament: (
    input: Omit<Tournament, 'id' | 'ownerId'>,
    existingId?: string
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
      stdGames,
      rapidGames,
      blitzGames,
    };
  }, [games]);

  const subNavItems: {
    id: FriendlySubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'overview', label: 'Vue d’ensemble Amicale', icon: LayoutDashboard },
    {
      id: 'tournaments',
      label: 'Tournois & Sessions Amicales',
      icon: Trophy,
      count: tournaments.length,
    },
    {
      id: 'games',
      label: 'Parties Amicales',
      icon: Swords,
      count: games.length,
    },
    {
      id: 'players',
      label: 'Amis & Joueurs Affrontés',
      icon: Users,
      count: opponents.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête de l'Espace Parties Amicales (100% Indépendant) */}
      <div className="bg-white border-2 border-emerald-200 border-t-4 border-t-emerald-600 rounded-2xl p-6 shadow-2xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-emerald-900">
              <Coffee className="w-3.5 h-3.5 text-emerald-600" />
              ESPACE 100% INDÉPENDANT · BASE JSONBIN #2 ({friendlyStatus.binId})
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Carnet des Parties Amicales & Entraînement
            </h1>
            <p className="text-sm text-slate-600">
              Gérez vos parties entre amis, soirées blitz au club et tournois non homologués.{' '}
              <strong className="text-emerald-800">
                Aucune partie, aucun joueur ni aucun tournoi de cet espace n’est mélangé avec vos parties classées FIDE.
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onRefreshFriendlyBin}
              disabled={isSyncingFriendly}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Synchroniser uniquement le JSONBin des parties amicales (1 requête GET)"
            >
              <RefreshCw
                className={`w-4 h-4 text-emerald-700 ${
                  isSyncingFriendly ? 'animate-spin' : ''
                }`}
              />
              {isSyncingFriendly ? 'Synchro Bin Amical...' : 'Actualiser le Bin Amical'}
            </button>
          </div>
        </div>

        {/* Barre de sous-navigation de l'espace amical */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
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
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`font-mono px-1.5 py-0.5 rounded-md text-[11px] ${
                      active
                        ? 'bg-emerald-800 text-emerald-100'
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
        <div className="bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Votre JSONBin Amical ({friendlyStatus.binId}) est prêt
            </h2>
            <p className="text-sm text-emerald-900/90">
              Vous pouvez initialiser la structure de base sur ce JSONBin en un clic, charger un petit exemple de parties amicales, ou directement créer votre première session/partie amicale.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onInitializeEmptyFriendlyBin}
              disabled={isSyncingFriendly}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-950 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <Database className="w-4 h-4 text-emerald-700" />
              Initialiser la structure vide dans le Bin
            </button>
            <button
              type="button"
              onClick={onLoadSampleFriendlyData}
              disabled={isSyncingFriendly}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Charger un exemple amical
            </button>
          </div>
        </div>
      )}

      {/* SOUS-ONGLET 1 : VUE D'ENSEMBLE AMICALE */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Chiffres Clés Amicaux */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono tabular-nums">
            <div className="p-4 bg-white border border-slate-200 border-l-4 border-l-emerald-600 rounded-xl">
              <div className="text-xs font-sans font-bold text-slate-700">
                Total Parties Amicales
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1">
                {stats.total}
              </div>
              <div className="text-[11px] font-sans font-medium text-slate-500 mt-1">
                Hors classement FIDE
              </div>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="text-xs font-sans font-bold text-emerald-900">
                Taux de Réussite
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1">
                {stats.winPct}%
              </div>
              <div className="text-[11px] font-semibold text-emerald-800 mt-1">
                +{stats.wins}V · ={stats.draws}N · -{stats.losses}D
              </div>
              {stats.total > 0 && (
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex mt-2">
                  <div
                    style={{ width: `${stats.winPct}%` }}
                    className="bg-emerald-500 h-full"
                  />
                  <div
                    style={{ width: `${stats.drawPct}%` }}
                    className="bg-amber-400 h-full"
                  />
                  <div
                    style={{ width: `${stats.lossPct}%` }}
                    className="bg-rose-500 h-full"
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-xs font-sans font-bold text-slate-700">
                Amis & Adversaires
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                {opponents.length}
              </div>
              <div className="text-[11px] font-sans font-medium text-slate-500 mt-1">
                Base joueurs isolée
              </div>
            </div>

            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <div className="text-xs font-sans font-bold text-indigo-900">
                Amical Classique
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mt-1">
                {stats.stdGames}
              </div>
              <div className="text-[11px] font-sans font-medium text-indigo-800/80 mt-1">
                Parties longues
              </div>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
              <div className="text-xs font-sans font-bold text-amber-900">
                Amical Rapide
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-1">
                {stats.rapidGames}
              </div>
              <div className="text-[11px] font-sans font-medium text-amber-800/80 mt-1">
                Cadence rapide
              </div>
            </div>

            <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl">
              <div className="text-xs font-sans font-bold text-sky-900">
                Amical Blitz
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-sky-700 mt-1">
                {stats.blitzGames}
              </div>
              <div className="text-[11px] font-sans font-medium text-sky-800/80 mt-1">
                Cadence blitz
              </div>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSubTab('tournaments')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Créer une session / un tournoi amical
            </button>
            <button
              type="button"
              onClick={() => setSubTab('games')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
            >
              <Swords className="w-4 h-4 text-emerald-700" />
              Ajouter ou voir les parties amicales ({games.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('players')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-slate-700" />
              Gérer mes amis / joueurs ({opponents.length})
            </button>
          </div>

          {/* Grille : Sessions Amicales & Amis Affrontés */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sessions / Tournois Amicaux */}
            <div className="lg:col-span-7 bg-white border border-slate-200 border-t-4 border-t-emerald-600 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-6 py-4 border-b border-slate-200 bg-emerald-50/40 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-600" />
                  Sessions & Tournois Amicaux ({tournaments.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setSubTab('tournaments')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  Tout gérer
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {tournaments.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Aucune session ou tournoi amical enregistré.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 text-sm">
                  {tournaments
                    .slice()
                    .sort((a, b) => b.startDate.localeCompare(a.startDate))
                    .slice(0, 5)
                    .map((t) => {
                      const tGames = games.filter((g) => g.tournamentId === t.id);
                      const score = tGames.reduce(
                        (acc, g) => acc + g.playerScore,
                        0
                      );
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setSelectedTournamentFilter(t.id);
                            setSubTab('games');
                          }}
                          className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-4 transition-colors border-l-4 border-l-emerald-500"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              {t.name}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {t.location} · {t.timeControlDetails}
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="font-bold text-emerald-800">
                              Score {score} / {tGames.length}
                            </div>
                            <div className="text-xs text-slate-500">
                              {tGames.length} partie(s)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Amis / Joueurs Amicaux */}
            <div className="lg:col-span-5 bg-white border border-slate-200 border-t-4 border-t-teal-600 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-6 py-4 border-b border-slate-200 bg-teal-50/40 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-700" />
                  Amis & Joueurs Affrontés ({opponents.length})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOpponentId(null);
                    setSubTab('players');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-teal-800 hover:underline cursor-pointer"
                >
                  Voir tous
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {opponents.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Aucun joueur amical enregistré.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 text-sm">
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

                    return (
                      <div
                        key={opp.id}
                        onClick={() => {
                          setSelectedOpponentId(opp.id);
                          setSubTab('players');
                        }}
                        className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-4 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-900 hover:text-emerald-700">
                            {formatPlayerNameLastFirst(opp.name)}
                          </div>
                          <div className="text-xs font-mono text-slate-500 mt-0.5">
                            Std {opp.standardElo || opp.elo} · Rap{' '}
                            {opp.rapidElo || opp.elo} · Blz{' '}
                            {opp.blitzElo || opp.elo}
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <div className="font-bold text-emerald-700">
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

      {/* SOUS-ONGLET 2 : SESSIONS & TOURNOIS AMICAUX */}
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
            setSelectedTournamentFilter(game.tournamentId);
            setInspectedGame(game);
            setSubTab('games');
          }}
        />
      )}

      {/* SOUS-ONGLET 3 : PARTIES AMICALES */}
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
        />
      )}

      {/* SOUS-ONGLET 4 : JOUEURS & AMIS AFFRONTÉS */}
      {subTab === 'players' && (
        <PlayersSection
          opponents={opponents}
          games={games}
          selectedOpponentId={selectedOpponentId}
          onSelectOpponent={setSelectedOpponentId}
          onSaveOpponent={onSaveOpponent}
          onDeleteOpponent={onDeleteOpponent}
          onOpenGameInViewer={(game) => {
            setSelectedTournamentFilter(game.tournamentId);
            setInspectedGame(game);
            setSubTab('games');
          }}
        />
      )}
    </div>
  );
};
