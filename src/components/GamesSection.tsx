import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Plus,
  Search,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  FideGame,
  FideTitle,
  GameResult,
  OpponentPlayer,
  PlayerColor,
  PlayerProfile,
  Tournament,
} from '../types/fide';
import {
  calculateFideEloChange,
  calculateFidePerformanceRating,
  ECO_OPENINGS_CATALOG,
  getPlayerScoreFromResult,
} from '../utils/fideMath';
import { getOpponentEloForCadence } from '../utils/fideValidation';
import { ChessboardViewer } from './ChessboardViewer';

interface GamesSectionProps {
  games: FideGame[];
  tournaments: Tournament[];
  opponents: OpponentPlayer[];
  profile: PlayerProfile | null;
  selectedTournamentFilter: string;
  onSelectTournamentFilter: (tournamentId: string) => void;
  inspectedGame: FideGame | null;
  onSetInspectedGame: (game: FideGame | null) => void;
  onSaveGame: (
    gameData: Omit<FideGame, 'id' | 'ownerId'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteGame: (gameId: string) => Promise<void>;
  onSelectOpponentProfile: (opponentId: string) => void;
  onGoToTournaments: () => void;
}

const FIDE_TITLES: FideTitle[] = ['None', 'CM', 'FM', 'IM', 'GM', 'WCM', 'WFM', 'WIM', 'WGM'];

export const GamesSection: React.FC<GamesSectionProps> = ({
  games,
  tournaments,
  opponents,
  profile,
  selectedTournamentFilter,
  onSelectTournamentFilter,
  inspectedGame,
  onSetInspectedGame,
  onSaveGame,
  onDeleteGame,
  onSelectOpponentProfile,
  onGoToTournaments,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPgnId, setCopiedPgnId] = useState<string | null>(null);

  // Modal d'ajout/édition de partie
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | undefined>(undefined);
  const [tournamentId, setTournamentId] = useState(
    selectedTournamentFilter || tournaments[0]?.id || ''
  );
  const [round, setRound] = useState(1);
  const [datePlayed, setDatePlayed] = useState(new Date().toISOString().slice(0, 10));
  const [playerColor, setPlayerColor] = useState<PlayerColor>('White');
  const [playerElo, setPlayerElo] = useState(profile?.standardElo || 1800);
  const [opponentId, setOpponentId] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [opponentFideId, setOpponentFideId] = useState('');
  const [opponentFfeId, setOpponentFfeId] = useState('');
  const [opponentTitle, setOpponentTitle] = useState<FideTitle>('None');
  const [opponentElo, setOpponentElo] = useState(1600);
  const [opponentFederation, setOpponentFederation] = useState('FRA');
  const [result, setResult] = useState<GameResult>('1-0');
  const [kFactorUsed, setKFactorUsed] = useState<10 | 20 | 40>(profile?.kFactor || 20);
  const [ecoCode, setEcoCode] = useState('');
  const [openingName, setOpeningName] = useState('');
  const [pgn, setPgn] = useState('');
  const [chessComUrl, setChessComUrl] = useState('');
  const [keyMomentNote, setKeyMomentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const linkOpponentFields = (opp: OpponentPlayer, targetTourneyId?: string) => {
    const tId = targetTourneyId ?? tournamentId;
    const chosenTourney = tournaments.find((t) => t.id === tId);
    const cadence = chosenTourney?.timeControl || 'Standard';
    setOpponentId(opp.id);
    setOpponentName(opp.name);
    setOpponentFideId(opp.fideId || '');
    setOpponentFfeId(opp.ffeId || '');
    setOpponentElo(getOpponentEloForCadence(opp, cadence));
    setOpponentTitle(opp.title || 'None');
    setOpponentFederation(opp.federation || 'FRA');
  };

  const openNewGameModal = () => {
    const targetTourney =
      tournaments.find((t) => t.id === selectedTournamentFilter) || tournaments[0];
    if (!targetTourney) {
      onGoToTournaments();
      return;
    }
    const existingInTourney = games.filter((g) => g.tournamentId === targetTourney.id);
    setEditingGameId(undefined);
    setTournamentId(targetTourney.id);
    setRound(existingInTourney.length + 1);
    setDatePlayed(new Date().toISOString().slice(0, 10));
    setPlayerColor(existingInTourney.length % 2 === 0 ? 'White' : 'Black');
    setPlayerElo(targetTourney.startingElo || profile?.standardElo || 1800);
    setOpponentId('');
    setOpponentName('');
    setOpponentFideId('');
    setOpponentFfeId('');
    setOpponentTitle('None');
    setOpponentElo(1600);
    setOpponentFederation('FRA');
    setResult('1-0');
    setKFactorUsed(profile?.kFactor || 20);
    setEcoCode('');
    setOpeningName('');
    setPgn('');
    setChessComUrl('');
    setKeyMomentNote('');
    setIsModalOpen(true);
  };

  const openEditGameModal = (g: FideGame) => {
    setEditingGameId(g.id);
    setTournamentId(g.tournamentId);
    setRound(g.round);
    setDatePlayed(g.datePlayed);
    setPlayerColor(g.playerColor);
    setPlayerElo(g.playerElo);
    setOpponentId(g.opponentId || '');
    setOpponentName(g.opponentName);
    setOpponentFideId(g.opponentFideId);
    setOpponentFfeId(g.opponentFfeId || '');
    setOpponentTitle(g.opponentTitle);
    setOpponentElo(g.opponentElo);
    setOpponentFederation(g.opponentFederation);
    setResult(g.result);
    setKFactorUsed(g.kFactorUsed);
    setEcoCode(g.ecoCode);
    setOpeningName(g.openingName);
    setPgn(g.pgn);
    setChessComUrl(g.chessComUrl || '');
    setKeyMomentNote(g.keyMomentNote);
    setIsModalOpen(true);
  };

  const computedScore = useMemo(
    () => getPlayerScoreFromResult(result, playerColor),
    [result, playerColor]
  );

  const computedEloDelta = useMemo(
    () => calculateFideEloChange(playerElo, opponentElo, computedScore, kFactorUsed),
    [playerElo, opponentElo, computedScore, kFactorUsed]
  );

  const activeTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentFilter) || null,
    [tournaments, selectedTournamentFilter]
  );

  const filteredGames = useMemo(() => {
    return games
      .filter((g) => {
        if (selectedTournamentFilter && g.tournamentId !== selectedTournamentFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            g.opponentName.toLowerCase().includes(q) ||
            g.opponentFideId.toLowerCase().includes(q) ||
            (g.opponentFfeId || '').toLowerCase().includes(q) ||
            g.tournamentName.toLowerCase().includes(q) ||
            g.openingName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (selectedTournamentFilter) {
          return a.round - b.round;
        }
        return b.datePlayed.localeCompare(a.datePlayed) || b.round - a.round;
      });
  }, [games, selectedTournamentFilter, searchQuery]);

  const summary = useMemo(() => {
    const count = filteredGames.length;
    const score = filteredGames.reduce((acc, g) => acc + g.playerScore, 0);
    const netElo =
      Math.round(filteredGames.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;
    const perf = calculateFidePerformanceRating(filteredGames);
    return { count, score, netElo, perf };
  }, [filteredGames]);

  const handleAnalyzeOnChessCom = (g: FideGame) => {
    if (g.pgn) {
      navigator.clipboard?.writeText(g.pgn).catch(() => {});
      setCopiedPgnId(g.id);
      setTimeout(() => setCopiedPgnId(null), 3000);
    }
    const targetUrl =
      g.chessComUrl && g.chessComUrl.trim()
        ? g.chessComUrl.trim()
        : 'https://www.chess.com/analysis';
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const findOpponentRecordId = (g: FideGame): string | null => {
    const found = opponents.find(
      (o) =>
        (g.opponentId && o.id === g.opponentId) ||
        (g.opponentFideId && o.fideId === g.opponentFideId) ||
        (g.opponentFfeId &&
          o.ffeId &&
          o.ffeId.toUpperCase() === g.opponentFfeId.toUpperCase()) ||
        o.name.trim().toLowerCase() === g.opponentName.trim().toLowerCase()
    );
    return found ? found.id : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenTourney = tournaments.find((t) => t.id === tournamentId);
    if (!chosenTourney) return;
    setIsSubmitting(true);
    try {
      await onSaveGame(
        {
          tournamentId: chosenTourney.id,
          tournamentName: chosenTourney.name,
          round: Number(round),
          datePlayed,
          timeControl: chosenTourney.timeControl,
          playerColor,
          playerElo: Number(playerElo),
          opponentId: opponentId || undefined,
          opponentName,
          opponentFideId,
          opponentFfeId,
          opponentTitle,
          opponentElo: Number(opponentElo),
          opponentFederation,
          result,
          playerScore: computedScore,
          eloChange: computedEloDelta,
          kFactorUsed,
          ecoCode,
          openingName,
          movesCount: pgn ? pgn.split(/\d+\./).length - 1 : 0,
          termination: 'Resignation',
          pgn,
          chessComUrl,
          keyMomentNote,
        },
        editingGameId
      );
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-indigo-950">
            Mes Parties par Tournoi
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Sélectionnez un tournoi ci-dessous pour retrouver toutes vos parties, voir contre qui vous avez joué, visionner l’échiquier ou lancer l’analyse sur Chess.com.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewGameModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Ajouter une partie
        </button>
      </div>

      {/* Sélecteur de Tournoi Clair et Visuel */}
      <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-indigo-950 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-indigo-600" />
            1. Choisissez un tournoi pour filtrer ses parties :
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Chercher un adversaire, ID FIDE..."
              className="w-full pl-10 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectTournamentFilter('')}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors ${
              selectedTournamentFilter === ''
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50/60 hover:text-indigo-950'
            }`}
          >
            Tous les tournois ({games.length} parties)
          </button>

          {tournaments.map((t) => {
            const count = games.filter((g) => g.tournamentId === t.id).length;
            const active = selectedTournamentFilter === t.id;
            const activeColor =
              t.timeControl === 'Rapid'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : t.timeControl === 'Blitz'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-indigo-600 text-white border-indigo-600 shadow-sm';
            const inactiveColor =
              t.timeControl === 'Rapid'
                ? 'bg-amber-50/40 text-amber-950 border-amber-200 hover:bg-amber-50'
                : t.timeControl === 'Blitz'
                ? 'bg-sky-50/40 text-sky-950 border-sky-200 hover:bg-sky-50'
                : 'bg-indigo-50/40 text-indigo-950 border-indigo-200 hover:bg-indigo-50';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTournamentFilter(t.id)}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors text-left ${
                  active ? activeColor : inactiveColor
                }`}
              >
                {t.name}{' '}
                <span className={active ? 'text-white/80 font-mono' : 'text-slate-500 font-mono'}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Résumé du tournoi sélectionné */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="text-slate-700">
            {activeTournament ? (
              <span>
                Tournoi sélectionné : <strong className="text-indigo-950">{activeTournament.name}</strong> ({activeTournament.location})
                {activeTournament.finalRank
                  ? ` · Classement final : ${activeTournament.finalRank}e${
                      activeTournament.totalPlayers ? ` / ${activeTournament.totalPlayers} joueurs` : ''
                    }`
                  : ''}
              </span>
            ) : (
              <span>Affichage de l’ensemble de vos parties enregistrées</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-950">
              Score : <strong>{summary.score} / {summary.count}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-100 text-violet-950">
              Performance : <strong>{summary.perf || '—'}</strong>
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg border font-bold ${
                summary.netElo >= 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              Elo gagné :{' '}
              <strong>
                {summary.netElo >= 0
                  ? `+${summary.netElo.toFixed(1)}`
                  : summary.netElo.toFixed(1)}{' '}
                pts
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Liste des Parties + Panneau Échiquier */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div
          className={`${
            inspectedGame ? 'xl:col-span-7' : 'xl:col-span-12'
          } bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden`}
        >
          {filteredGames.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-base font-bold text-slate-900">
                Aucune partie trouvée pour cette sélection.
              </p>
              <button
                type="button"
                onClick={openNewGameModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter une partie
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-indigo-100 bg-indigo-50/60 text-xs font-extrabold text-indigo-950">
                    <th className="py-3.5 px-4">Ronde & Date</th>
                    <th className="py-3.5 px-4">Contre qui j’ai joué</th>
                    <th className="py-3.5 px-4 text-right">Son Elo</th>
                    <th className="py-3.5 px-4">Couleur</th>
                    <th className="py-3.5 px-4 text-center">Résultat</th>
                    <th className="py-3.5 px-4 text-right">Elo Gagné</th>
                    <th className="py-3.5 px-4 text-right">Visionner & Analyser</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredGames.map((g) => {
                    const oppRecordId = findOpponentRecordId(g);
                    const isSelected = inspectedGame?.id === g.id;
                    const rowBorder =
                      g.playerScore === 1
                        ? 'border-l-4 border-l-emerald-500'
                        : g.playerScore === 0
                        ? 'border-l-4 border-l-rose-500'
                        : 'border-l-4 border-l-amber-500';
                    return (
                      <tr
                        key={g.id}
                        onClick={() => onSetInspectedGame(g)}
                        className={`cursor-pointer transition-colors ${rowBorder} ${
                          isSelected
                            ? 'bg-indigo-50/70'
                            : 'hover:bg-slate-50/90'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                          <div className="font-extrabold text-indigo-950">Ronde {g.round}</div>
                          <div className="text-slate-500">{g.datePlayed}</div>
                        </td>

                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (oppRecordId) onSelectOpponentProfile(oppRecordId);
                            }}
                            className="font-bold text-indigo-950 hover:text-indigo-600 hover:underline text-left"
                          >
                            {g.opponentTitle !== 'None' ? `${g.opponentTitle} ` : ''}
                            {g.opponentName}
                          </button>
                          <div className="text-xs text-slate-600 font-mono">
                            <span className="font-semibold text-indigo-700">{g.tournamentName}</span>
                            {g.opponentFideId ? ` · FIDE ${g.opponentFideId}` : ''}
                            {g.opponentFfeId ? ` · FFE ${g.opponentFfeId}` : ''}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                          {g.opponentElo}
                        </td>

                        <td className="py-3 px-4 text-xs font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`w-3 h-3 rounded-sm border ${
                                g.playerColor === 'White'
                                  ? 'bg-white border-slate-400 shadow-2xs'
                                  : 'bg-slate-900 border-slate-900'
                              }`}
                            />
                            {g.playerColor === 'White' ? 'Blancs' : 'Noirs'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-xs font-extrabold">
                          <span
                            className={
                              g.playerScore === 1
                                ? 'text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200'
                                : g.playerScore === 0
                                ? 'text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200'
                                : 'text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200'
                            }
                          >
                            {g.playerScore === 1
                              ? 'Victoire (1pt)'
                              : g.playerScore === 0.5
                              ? 'Nulle (½)'
                              : 'Défaite (0pt)'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-extrabold">
                          <span
                            className={
                              g.eloChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }
                          >
                            {g.eloChange >= 0
                              ? `+${g.eloChange.toFixed(1)}`
                              : g.eloChange.toFixed(1)}
                          </span>
                        </td>

                        <td
                          className="py-3 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSetInspectedGame(g)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Visionner
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAnalyzeOnChessCom(g)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                              title="Copie le PGN et ouvre Chess.com Analysis"
                            >
                              {copiedPgnId === g.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  PGN copié !
                                </>
                              ) : (
                                <>
                                  Chess.com
                                  <ExternalLink className="w-3 h-3" />
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditGameModal(g)}
                              className="p-1.5 text-slate-500 hover:text-indigo-700 rounded-lg hover:bg-indigo-50"
                              title="Modifier la partie"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteGame(g.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                              title="Supprimer la partie"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panneau de Visionnage de la Partie & Lien Chess.com */}
        {inspectedGame && (
          <div className="xl:col-span-5 bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-6 shadow-sm space-y-4 sticky top-20">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-mono font-semibold text-indigo-700">
                  {inspectedGame.tournamentName} · Ronde {inspectedGame.round} ({inspectedGame.datePlayed})
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  Contre {inspectedGame.opponentName} ({inspectedGame.opponentElo} Elo)
                </h3>
                {inspectedGame.openingName && (
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    <span className="font-mono font-bold text-indigo-700">
                      {inspectedGame.ecoCode ? `${inspectedGame.ecoCode} — ` : ''}
                    </span>
                    {inspectedGame.openingName}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSetInspectedGame(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inspectedGame.pgn ? (
              <ChessboardViewer
                pgn={inspectedGame.pgn}
                initialOrientation={inspectedGame.playerColor}
              />
            ) : (
              <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  Aucun coup PGN renseigné pour cette partie
                </p>
                <p className="text-xs text-slate-500">
                  Le PGN est facultatif. Vous pouvez cliquer sur « Modifier » si vous souhaitez ajouter les coups plus tard.
                </p>
                <button
                  type="button"
                  onClick={() => openEditGameModal(inspectedGame)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Ajouter le PGN de cette partie
                </button>
              </div>
            )}

            {/* Bouton Analyse Chess.com */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleAnalyzeOnChessCom(inspectedGame)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {inspectedGame.pgn
                  ? 'Copier le PGN & Analyser sur Chess.com'
                  : 'Ouvrir l’échiquier d’analyse Chess.com'}
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {inspectedGame.keyMomentNote && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                <div className="font-bold text-slate-900 mb-1">Mes notes sur la partie :</div>
                {inspectedGame.keyMomentNote}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Ajouter / Modifier une Partie */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingGameId ? 'Modifier la partie' : 'Ajouter une partie'}
                </h2>
                <p className="text-xs text-slate-500">
                  Le PGN et le lien Chess.com sont facultatifs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tournoi *
                  </label>
                  <select
                    value={tournamentId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setTournamentId(nextId);
                      const chosenOp = opponents.find((o) => o.id === opponentId);
                      if (chosenOp) {
                        linkOpponentFields(chosenOp, nextId);
                      }
                    }}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  >
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.timeControl})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ronde</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={round}
                      onChange={(e) => setRound(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={datePlayed}
                      onChange={(e) => setDatePlayed(e.target.value)}
                      className="w-full px-2.5 py-2 font-mono border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Adversaire avec liaison automatique */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">
                    Adversaire (Nom ↔ ID FIDE ↔ ID FFE)
                  </span>
                  {opponents.length > 0 && (
                    <select
                      value={opponentId}
                      onChange={(e) => {
                        const found = opponents.find((o) => o.id === e.target.value);
                        if (found) linkOpponentFields(found);
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">-- Choisir parmi mes adversaires --</option>
                      {opponents.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} (Std {o.standardElo || o.elo} · Rap {o.rapidElo || o.elo} · Blz {o.blitzElo || o.elo})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nom de l’adversaire *
                    </label>
                    <input
                      type="text"
                      value={opponentName}
                      onChange={(e) => {
                        setOpponentName(e.target.value);
                        const m = opponents.find(
                          (o) =>
                            o.name.trim().toLowerCase() ===
                            e.target.value.trim().toLowerCase()
                        );
                        if (m) linkOpponentFields(m);
                      }}
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID FIDE</label>
                    <input
                      type="text"
                      value={opponentFideId}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '');
                        setOpponentFideId(clean);
                        const m = opponents.find((o) => o.fideId === clean && clean.length >= 4);
                        if (m) linkOpponentFields(m);
                      }}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID FFE</label>
                    <input
                      type="text"
                      value={opponentFfeId}
                      onChange={(e) => {
                        const clean = e.target.value.toUpperCase().trim();
                        setOpponentFfeId(clean);
                        const m = opponents.find(
                          (o) => o.ffeId.toUpperCase() === clean && clean.length >= 3
                        );
                        if (m) linkOpponentFields(m);
                      }}
                      className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Elo Adverse *
                    </label>
                    <input
                      type="number"
                      min={800}
                      max={3500}
                      value={opponentElo}
                      onChange={(e) => setOpponentElo(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Titre FIDE
                    </label>
                    <select
                      value={opponentTitle}
                      onChange={(e) => setOpponentTitle(e.target.value as FideTitle)}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-xl"
                    >
                      {FIDE_TITLES.map((t) => (
                        <option key={t} value={t}>
                          {t === 'None' ? 'Aucun' : t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Ma Couleur
                    </label>
                    <select
                      value={playerColor}
                      onChange={(e) => setPlayerColor(e.target.value as PlayerColor)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    >
                      <option value="White">Blancs</option>
                      <option value="Black">Noirs</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Résultat</label>
                  <select
                    value={result}
                    onChange={(e) => setResult(e.target.value as GameResult)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  >
                    <option value="1-0">1-0 (Blancs gagnent)</option>
                    <option value="1/2-1/2">½-½ (Partie nulle)</option>
                    <option value="0-1">0-1 (Noirs gagnent)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mon Elo</label>
                  <input
                    type="number"
                    min={800}
                    max={3500}
                    value={playerElo}
                    onChange={(e) => setPlayerElo(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Elo Gagné / Perdu
                  </label>
                  <div className="px-3 py-2 font-mono font-bold bg-slate-100 border border-slate-200 rounded-xl">
                    {computedEloDelta >= 0
                      ? `+${computedEloDelta.toFixed(1)}`
                      : computedEloDelta.toFixed(1)}{' '}
                    pts
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ouverture (facultatif)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value=""
                      onChange={(e) => {
                        const found = ECO_OPENINGS_CATALOG.find(
                          (o) => o.eco === e.target.value
                        );
                        if (found) {
                          setEcoCode(found.eco);
                          setOpeningName(found.name);
                        }
                      }}
                      className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    >
                      <option value="">-- Catalogue ECO --</option>
                      {ECO_OPENINGS_CATALOG.map((o) => (
                        <option key={o.eco} value={o.eco}>
                          {o.eco} - {o.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={openingName}
                      onChange={(e) => setOpeningName(e.target.value)}
                      placeholder="Nom de l'ouverture"
                      className="w-1/2 px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lien Chess.com pour analyser (facultatif)
                  </label>
                  <input
                    type="url"
                    value={chessComUrl}
                    onChange={(e) => setChessComUrl(e.target.value)}
                    placeholder="https://www.chess.com/analysis/..."
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    PGN de la partie (Facultatif — surtout pour parties classiques)
                  </label>
                  <textarea
                    rows={3}
                    value={pgn}
                    onChange={(e) => setPgn(e.target.value)}
                    placeholder="1. e4 c5 2. Nf3 d6..."
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Notes personnelles (facultatif)
                  </label>
                  <textarea
                    rows={3}
                    value={keyMomentNote}
                    onChange={(e) => setKeyMomentNote(e.target.value)}
                    placeholder="Analyse, moment clé..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer la partie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
