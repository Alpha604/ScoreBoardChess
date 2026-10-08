import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  ExternalLink,
  Eye,
  Plus,
  Trash2,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  FideGame,
  FideTitle,
  GameResult,
  OpponentPlayer,
  PlayerColor,
  PlayerProfile,
  TimeControlCategory,
  Tournament,
  TournamentFormat,
  TournamentStatus,
} from '../types/fide';
import {
  calculateFideEloChange,
  calculateFidePerformanceRating,
  ECO_OPENINGS_CATALOG,
  getPlayerScoreFromResult,
} from '../utils/fideMath';
import { getOpponentEloForCadence } from '../utils/fideValidation';

interface TournamentsSectionProps {
  tournaments: Tournament[];
  games: FideGame[];
  opponents: OpponentPlayer[];
  profile: PlayerProfile | null;
  onSaveTournament: (
    data: Omit<Tournament, 'id' | 'ownerId'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteTournament: (id: string) => Promise<void>;
  onSaveGame: (
    gameData: Omit<FideGame, 'id' | 'ownerId'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteGame: (gameId: string) => Promise<void>;
  onSelectOpponentProfile: (opponentId: string) => void;
  onOpenGameInViewer: (game: FideGame) => void;
}

const FIDE_TITLES: FideTitle[] = ['None', 'CM', 'FM', 'IM', 'GM', 'WCM', 'WFM', 'WIM', 'WGM'];

export const TournamentsSection: React.FC<TournamentsSectionProps> = ({
  tournaments,
  games,
  opponents,
  profile,
  onSaveTournament,
  onDeleteTournament,
  onSaveGame,
  onDeleteGame,
  onSelectOpponentProfile,
  onOpenGameInViewer,
}) => {
  const [expandedTournamentId, setExpandedTournamentId] = useState<string | null>(
    tournaments[0]?.id || null
  );

  // Modal Tournoi
  const [isTourneyModalOpen, setIsTourneyModalOpen] = useState(false);
  const [editingTourneyId, setEditingTourneyId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [timeControl, setTimeControl] = useState<TimeControlCategory>('Standard');
  const [timeControlDetails, setTimeControlDetails] = useState('90 min + 30 sec/coup');
  const [format, setFormat] = useState<TournamentFormat>('Swiss');
  const [totalRounds, setTotalRounds] = useState(9);
  const [totalPlayers, setTotalPlayers] = useState<string>('80');
  const [finalRank, setFinalRank] = useState<string>('');
  const [startingElo, setStartingElo] = useState(profile?.standardElo || 1800);
  const [status, setStatus] = useState<TournamentStatus>('ongoing');
  const [normTarget, setNormTarget] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmittingTourney, setIsSubmittingTourney] = useState(false);

  // Modal Ajouter une Partie dans un Tournoi
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [activeTournamentForGame, setActiveTournamentForGame] = useState<Tournament | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | undefined>(undefined);
  const [round, setRound] = useState(1);
  const [datePlayed, setDatePlayed] = useState(new Date().toISOString().slice(0, 10));
  const [playerColor, setPlayerColor] = useState<PlayerColor>('White');
  const [playerElo, setPlayerElo] = useState(profile?.standardElo || 1800);
  const [opponentId, setOpponentId] = useState<string>('');
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
  const [isSubmittingGame, setIsSubmittingGame] = useState(false);

  // Ouvrir Modal Nouveau Tournoi
  const openNewTourneyModal = () => {
    setEditingTourneyId(undefined);
    setName('');
    setLocation('France');
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setEndDate(today);
    setTimeControl('Standard');
    setTimeControlDetails('90 min + 30 sec/coup');
    setFormat('Swiss');
    setTotalRounds(9);
    setTotalPlayers('80');
    setFinalRank('');
    setStartingElo(profile?.standardElo || 1800);
    setStatus('ongoing');
    setNormTarget('');
    setNotes('');
    setIsTourneyModalOpen(true);
  };

  const openEditTourneyModal = (t: Tournament) => {
    setEditingTourneyId(t.id);
    setName(t.name);
    setLocation(t.location);
    setStartDate(t.startDate);
    setEndDate(t.endDate);
    setTimeControl(t.timeControl);
    setTimeControlDetails(t.timeControlDetails);
    setFormat(t.format);
    setTotalRounds(t.totalRounds);
    setTotalPlayers(t.totalPlayers ? String(t.totalPlayers) : '');
    setFinalRank(t.finalRank ? String(t.finalRank) : '');
    setStartingElo(t.startingElo);
    setStatus(t.status);
    setNormTarget(t.normTarget);
    setNotes(t.notes);
    setIsTourneyModalOpen(true);
  };

  // Ouvrir Modal Ajouter Partie dans ce Tournoi
  const openAddGameInTourney = (t: Tournament, existingGame?: FideGame) => {
    setActiveTournamentForGame(t);
    if (existingGame) {
      setEditingGameId(existingGame.id);
      setRound(existingGame.round);
      setDatePlayed(existingGame.datePlayed);
      setPlayerColor(existingGame.playerColor);
      setPlayerElo(existingGame.playerElo);
      setOpponentId(existingGame.opponentId || '');
      setOpponentName(existingGame.opponentName);
      setOpponentFideId(existingGame.opponentFideId);
      setOpponentFfeId(existingGame.opponentFfeId || '');
      setOpponentTitle(existingGame.opponentTitle);
      setOpponentElo(existingGame.opponentElo);
      setOpponentFederation(existingGame.opponentFederation);
      setResult(existingGame.result);
      setKFactorUsed(existingGame.kFactorUsed);
      setEcoCode(existingGame.ecoCode);
      setOpeningName(existingGame.openingName);
      setPgn(existingGame.pgn);
      setChessComUrl(existingGame.chessComUrl || '');
      setKeyMomentNote(existingGame.keyMomentNote);
    } else {
      const existingRounds = games.filter((g) => g.tournamentId === t.id);
      setEditingGameId(undefined);
      setRound(existingRounds.length + 1);
      setDatePlayed(t.startDate || new Date().toISOString().slice(0, 10));
      setPlayerColor(existingRounds.length % 2 === 0 ? 'White' : 'Black');
      setPlayerElo(t.startingElo || profile?.standardElo || 1800);
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
    }
    setIsGameModalOpen(true);
  };

  // Auto-liaison bidirectionnelle : Nom <-> ID FIDE <-> ID FFE
  // Sélectionne automatiquement l'Elo du joueur dans la cadence du tournoi
  const linkOpponentFields = (opp: OpponentPlayer) => {
    const cadence = activeTournamentForGame?.timeControl || 'Standard';
    setOpponentId(opp.id);
    setOpponentName(opp.name);
    setOpponentFideId(opp.fideId || '');
    setOpponentFfeId(opp.ffeId || '');
    setOpponentElo(getOpponentEloForCadence(opp, cadence));
    setOpponentTitle(opp.title || 'None');
    setOpponentFederation(opp.federation || 'FRA');
  };

  const handleOpponentNameChange = (val: string) => {
    setOpponentName(val);
    const match = opponents.find(
      (o) => o.name.trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (match) linkOpponentFields(match);
  };

  const handleOpponentFideChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setOpponentFideId(clean);
    if (clean.length >= 4) {
      const match = opponents.find((o) => o.fideId === clean);
      if (match) linkOpponentFields(match);
    }
  };

  const handleOpponentFfeChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    setOpponentFfeId(clean);
    if (clean.length >= 3) {
      const match = opponents.find((o) => o.ffeId.toUpperCase() === clean);
      if (match) linkOpponentFields(match);
    }
  };

  // Historique face-à-face en direct contre le joueur sélectionné dans le formulaire
  const matchedOpponentStats = useMemo(() => {
    const match = opponents.find(
      (o) =>
        (opponentId && o.id === opponentId) ||
        (opponentFideId && o.fideId === opponentFideId) ||
        (opponentFfeId &&
          o.ffeId &&
          o.ffeId.toUpperCase() === opponentFfeId.toUpperCase()) ||
        (opponentName &&
          o.name.trim().toLowerCase() === opponentName.trim().toLowerCase())
    );
    if (!match) return null;

    const vsGames = games.filter(
      (g) =>
        g.id !== editingGameId &&
        ((g.opponentId && g.opponentId === match.id) ||
          (match.fideId && g.opponentFideId === match.fideId) ||
          g.opponentName.trim().toLowerCase() === match.name.trim().toLowerCase())
    );
    const total = vsGames.length;
    const wins = vsGames.filter((g) => g.playerScore === 1).length;
    const draws = vsGames.filter((g) => g.playerScore === 0.5).length;
    const losses = vsGames.filter((g) => g.playerScore === 0).length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    return {
      match,
      total,
      wins,
      draws,
      losses,
      winRate,
    };
  }, [opponents, games, opponentId, opponentFideId, opponentFfeId, opponentName, editingGameId]);

  const computedScore = useMemo(
    () => getPlayerScoreFromResult(result, playerColor),
    [result, playerColor]
  );

  const computedEloDelta = useMemo(
    () => calculateFideEloChange(playerElo, opponentElo, computedScore, kFactorUsed),
    [playerElo, opponentElo, computedScore, kFactorUsed]
  );

  // Enrichir chaque tournoi avec ses parties et ses stats
  const enrichedTournaments = useMemo(() => {
    return [...tournaments]
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map((t) => {
        const tGames = games
          .filter((g) => g.tournamentId === t.id)
          .sort((a, b) => a.round - b.round);
        const playedCount = tGames.length;
        const score = tGames.reduce((acc, g) => acc + g.playerScore, 0);
        const eloNet =
          Math.round(tGames.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;
        const perfRating = calculateFidePerformanceRating(tGames);
        const wins = tGames.filter((g) => g.playerScore === 1).length;
        const draws = tGames.filter((g) => g.playerScore === 0.5).length;
        const losses = tGames.filter((g) => g.playerScore === 0).length;
        const winPct = playedCount > 0 ? Math.round((wins / playedCount) * 100) : 0;

        return {
          ...t,
          tGames,
          playedCount,
          score,
          eloNet,
          perfRating,
          wins,
          draws,
          losses,
          winPct,
        };
      });
  }, [tournaments, games]);

  const handleSaveTourneySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTourney(true);
    try {
      await onSaveTournament(
        {
          name,
          location,
          startDate,
          endDate,
          timeControl,
          timeControlDetails,
          format,
          totalRounds: Number(totalRounds),
          totalPlayers: totalPlayers ? Number(totalPlayers) : undefined,
          finalRank: finalRank ? Number(finalRank) : undefined,
          startingElo: Number(startingElo),
          status,
          normTarget,
          notes,
        },
        editingTourneyId
      );
      setIsTourneyModalOpen(false);
    } finally {
      setIsSubmittingTourney(false);
    }
  };

  const handleSaveGameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTournamentForGame) return;
    setIsSubmittingGame(true);
    try {
      await onSaveGame(
        {
          tournamentId: activeTournamentForGame.id,
          tournamentName: activeTournamentForGame.name,
          round: Number(round),
          datePlayed,
          timeControl: activeTournamentForGame.timeControl,
          playerColor,
          playerElo: Number(playerElo),
          opponentId: matchedOpponentStats?.match.id || opponentId || undefined,
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
      setIsGameModalOpen(false);
    } finally {
      setIsSubmittingGame(false);
    }
  };

  // Helper pour trouver l'ID d'un joueur dans la liste Opponents afin d'ouvrir sa fiche
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

  // Helper pour calculer le taux de victoire contre cet adversaire
  const getVsWinRateLabel = (g: FideGame): string => {
    const oppGames = games.filter(
      (item) =>
        (g.opponentFideId && item.opponentFideId === g.opponentFideId) ||
        (g.opponentFfeId &&
          item.opponentFfeId &&
          item.opponentFfeId.toUpperCase() === g.opponentFfeId.toUpperCase()) ||
        item.opponentName.trim().toLowerCase() === g.opponentName.trim().toLowerCase()
    );
    if (oppGames.length === 0) return '—';
    const wins = oppGames.filter((item) => item.playerScore === 1).length;
    return `${Math.round((wins / oppGames.length) * 100)}% (${wins}/${oppGames.length})`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-indigo-950">
            Mes Tournois FIDE & FFE
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Créez vos tournois, renseignez votre classement final, vos parties (PGN facultatif) et voyez immédiatement les points Elo gagnés et votre performance.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewTourneyModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          Créer un nouveau tournoi
        </button>
      </div>

      {enrichedTournaments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <Trophy className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            Aucun tournoi enregistré pour le moment
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Cliquez sur « Créer un nouveau tournoi » pour rentrer les infos de votre tournoi, vos adversaires et calculer votre performance.
          </p>
          <button
            type="button"
            onClick={openNewTourneyModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Créer mon premier tournoi
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {enrichedTournaments.map((t) => {
            const isExpanded = expandedTournamentId === t.id;
            const topAccentBorder =
              t.timeControl === 'Rapid'
                ? 'border-t-4 border-t-amber-500'
                : t.timeControl === 'Blitz'
                ? 'border-t-4 border-t-sky-500'
                : 'border-t-4 border-t-indigo-600';
            const cadenceColorText =
              t.timeControl === 'Rapid'
                ? 'text-amber-700 font-bold'
                : t.timeControl === 'Blitz'
                ? 'text-sky-700 font-bold'
                : 'text-indigo-700 font-bold';

            return (
              <div
                key={t.id}
                className={`bg-white border border-slate-200 ${topAccentBorder} rounded-2xl overflow-hidden shadow-2xs`}
              >
                {/* En-tête lisible et coloré du Tournoi */}
                <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium">
                      <span className="font-mono text-slate-800 font-semibold">
                        {t.startDate} → {t.endDate}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-800">{t.location}</span>
                      <span aria-hidden="true">·</span>
                      <span className={cadenceColorText}>
                        Cadence{' '}
                        {t.timeControl === 'Standard'
                          ? 'Classique'
                          : t.timeControl === 'Rapid'
                          ? 'Rapide'
                          : 'Blitz'}{' '}
                        ({t.timeControlDetails})
                      </span>
                      {t.totalPlayers && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            {t.totalPlayers} joueurs
                          </span>
                        </>
                      )}
                    </div>

                    <h2
                      onClick={() =>
                        setExpandedTournamentId(isExpanded ? null : t.id)
                      }
                      className="text-xl font-extrabold text-slate-900 cursor-pointer hover:text-indigo-700 transition-colors"
                    >
                      {t.name}
                    </h2>

                    {t.notes && (
                      <p className="text-sm text-slate-600">{t.notes}</p>
                    )}
                  </div>

                  {/* Bloc de Statistiques Clés Colorées du Tournoi */}
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6 shrink-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                      <div className="px-3.5 py-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
                        <div className="text-[11px] font-sans font-bold text-amber-900">
                          Classement final
                        </div>
                        <div className="text-base font-extrabold text-amber-800 mt-0.5">
                          {t.finalRank
                            ? `${t.finalRank}e${
                                t.totalPlayers ? ` / ${t.totalPlayers}` : ''
                              }`
                            : 'En cours'}
                        </div>
                      </div>

                      <div className="px-3.5 py-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-center">
                        <div className="text-[11px] font-sans font-bold text-indigo-900">
                          Score & Rondes
                        </div>
                        <div className="text-base font-extrabold text-indigo-700 mt-0.5">
                          {t.score} / {t.playedCount}
                        </div>
                        <div className="text-[10px] font-semibold mt-0.5">
                          <span className="text-emerald-700">+{t.wins}</span>{' '}
                          <span className="text-amber-700">={t.draws}</span>{' '}
                          <span className="text-rose-700">-{t.losses}</span>
                        </div>
                      </div>

                      <div className="px-3.5 py-2.5 bg-violet-50/70 border border-violet-200 rounded-xl text-center">
                        <div className="text-[11px] font-sans font-bold text-violet-900">
                          Performance
                        </div>
                        <div className="text-base font-extrabold text-violet-700 mt-0.5">
                          {t.perfRating || '—'}
                        </div>
                        <div className="text-[10px] text-violet-800/80">
                          Départ : {t.startingElo}
                        </div>
                      </div>

                      <div
                        className={`px-3.5 py-2.5 border rounded-xl text-center ${
                          t.eloNet >= 0
                            ? 'bg-emerald-50/70 border-emerald-200'
                            : 'bg-rose-50/70 border-rose-200'
                        }`}
                      >
                        <div
                          className={`text-[11px] font-sans font-bold ${
                            t.eloNet >= 0 ? 'text-emerald-900' : 'text-rose-900'
                          }`}
                        >
                          Elo gagné
                        </div>
                        <div
                          className={`text-base font-extrabold mt-0.5 ${
                            t.eloNet > 0
                              ? 'text-emerald-700'
                              : t.eloNet < 0
                              ? 'text-rose-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {t.eloNet > 0
                            ? `+${t.eloNet.toFixed(1)}`
                            : t.eloNet.toFixed(1)}{' '}
                          pts
                        </div>
                      </div>
                    </div>

                    {/* Boutons d'action du Tournoi */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddGameInTourney(t)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter une partie
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditTourneyModal(t)}
                        className="p-2 text-indigo-700 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100 rounded-xl"
                        title="Modifier les infos du tournoi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTournament(t.id)}
                        className="p-2 text-slate-500 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-xl"
                        title="Supprimer ce tournoi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTournamentId(isExpanded ? null : t.id)
                        }
                        className="p-2 text-slate-700 hover:text-slate-900 bg-slate-100 rounded-xl"
                        title="Afficher / Masquer les parties du tournoi"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Liste des Parties & Adversaires de ce Tournoi */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                        Parties jouées & Adversaires affrontés dans ce tournoi ({t.playedCount} / {t.totalRounds} rondes)
                      </h3>
                      <button
                        type="button"
                        onClick={() => openAddGameInTourney(t)}
                        className="text-xs font-bold text-indigo-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter une ronde à ce tournoi
                      </button>
                    </div>

                    {t.tGames.length === 0 ? (
                      <div className="p-6 bg-white border border-dashed border-indigo-200 rounded-xl text-center text-xs text-slate-600">
                        Aucune partie enregistrée dans ce tournoi. Cliquez sur « Ajouter une partie » pour rentrer vos rondes.
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-indigo-100 bg-indigo-50/50 text-xs font-bold text-indigo-950">
                              <th className="py-3 px-4">Ronde</th>
                              <th className="py-3 px-4">Ma Couleur</th>
                              <th className="py-3 px-4">Adversaire (Nom + ID FIDE / FFE)</th>
                              <th className="py-3 px-4 text-right">Elo Adv.</th>
                              <th className="py-3 px-4 text-center">Taux Victoire vs lui</th>
                              <th className="py-3 px-4 text-center">Résultat</th>
                              <th className="py-3 px-4 text-right">Elo Gagné</th>
                              <th className="py-3 px-4 text-right">Partie / Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-sm">
                            {t.tGames.map((g) => {
                              const oppRecordId = findOpponentRecordId(g);
                              const rowResultBorder =
                                g.playerScore === 1
                                  ? 'border-l-4 border-l-emerald-500'
                                  : g.playerScore === 0
                                  ? 'border-l-4 border-l-rose-500'
                                  : 'border-l-4 border-l-amber-400';
                              return (
                                <tr
                                  key={g.id}
                                  className={`hover:bg-slate-50 transition-colors ${rowResultBorder}`}
                                >
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900">
                                    Ronde {g.round}
                                    <div className="text-[11px] font-normal text-slate-500">
                                      {g.datePlayed}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-xs font-bold">
                                    {g.playerColor === 'White' ? (
                                      <span className="text-slate-800">♔ Blancs</span>
                                    ) : (
                                      <span className="text-indigo-950">♚ Noirs</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (oppRecordId) onSelectOpponentProfile(oppRecordId);
                                      }}
                                      className="font-bold text-slate-900 hover:text-indigo-700 hover:underline text-left"
                                    >
                                      {g.opponentTitle !== 'None' && (
                                        <span className="text-amber-700 font-mono mr-1">
                                          {g.opponentTitle}
                                        </span>
                                      )}
                                      {g.opponentName}
                                    </button>
                                    <div className="text-[11px] font-mono text-slate-500">
                                      <span className="text-indigo-700 font-medium">
                                        {g.opponentFideId ? `FIDE: ${g.opponentFideId}` : 'FIDE: —'}
                                      </span>
                                      {' · '}
                                      <span className="text-amber-800 font-medium">
                                        {g.opponentFfeId ? `FFE: ${g.opponentFfeId}` : 'FFE: —'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                                    {g.opponentElo}
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono text-xs font-bold text-slate-700">
                                    {getVsWinRateLabel(g)}
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono text-xs font-extrabold">
                                    <span
                                      className={
                                        g.playerScore === 1
                                          ? 'text-emerald-700'
                                          : g.playerScore === 0
                                          ? 'text-rose-700'
                                          : 'text-amber-700'
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
                                        g.eloChange >= 0
                                          ? 'text-emerald-700'
                                          : 'text-rose-700'
                                      }
                                    >
                                      {g.eloChange >= 0
                                        ? `+${g.eloChange.toFixed(1)}`
                                        : g.eloChange.toFixed(1)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => onOpenGameInViewer(g)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        {g.pgn ? 'Voir PGN' : 'Détails'}
                                      </button>
                                      {g.chessComUrl && (
                                        <a
                                          href={g.chessComUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                          title="Analyser sur Chess.com"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => openAddGameInTourney(t, g)}
                                        className="p-1.5 text-slate-500 hover:text-indigo-700 rounded-lg hover:bg-indigo-50"
                                        title="Modifier cette ronde"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onDeleteGame(g.id)}
                                        className="p-1.5 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                                        title="Supprimer cette ronde"
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1 : CRÉER / MODIFIER UN TOURNOI */}
      {isTourneyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingTourneyId ? 'Modifier le tournoi' : 'Créer un nouveau tournoi'}
                </h2>
                <p className="text-xs text-slate-500">
                  Renseignez la cadence, le nombre de joueurs et votre classement final. Vous pourrez ensuite y ajouter toutes vos parties.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTourneyModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTourneySubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nom du tournoi *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Open International de Cappelle-la-Grande"
                    required
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ville / Lieu *
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: Lille, FRA"
                    required
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cadence *
                  </label>
                  <select
                    value={timeControl}
                    onChange={(e) => {
                      const nextTc = e.target.value as TimeControlCategory;
                      setTimeControl(nextTc);
                      if (!editingTourneyId && profile) {
                        if (nextTc === 'Rapid') {
                          setStartingElo(profile.rapidElo || profile.standardElo);
                          setTimeControlDetails('15 min + 10 sec/coup');
                        } else if (nextTc === 'Blitz') {
                          setStartingElo(profile.blitzElo || profile.standardElo);
                          setTimeControlDetails('3 min + 2 sec/coup');
                        } else {
                          setStartingElo(profile.standardElo);
                          setTimeControlDetails('90 min + 30 sec/coup');
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  >
                    <option value="Standard">Classique (Standard FIDE)</option>
                    <option value="Rapid">Rapide</option>
                    <option value="Blitz">Blitz</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Détail de la cadence (Pendule)
                  </label>
                  <input
                    type="text"
                    value={timeControlDetails}
                    onChange={(e) => setTimeControlDetails(e.target.value)}
                    placeholder="Ex: 90 min + 30 sec/coup ou 15 min + 10 sec"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nombre de rondes
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nombre de joueurs
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={5000}
                    value={totalPlayers}
                    onChange={(e) => setTotalPlayers(e.target.value)}
                    placeholder="Ex: 120"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mon classement final
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={finalRank}
                    onChange={(e) => setFinalRank(e.target.value)}
                    placeholder="Ex: 12 (pour 12e)"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mon Elo au départ
                  </label>
                  <input
                    type="number"
                    min={800}
                    max={3500}
                    value={startingElo}
                    onChange={(e) => setStartingElo(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bilan personnel / Notes sur le tournoi (facultatif)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Sensations, prix remporté, ouverture jouée..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTourneyModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTourney}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmittingTourney ? 'Enregistrement...' : 'Enregistrer le tournoi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2 : AJOUTER / MODIFIER UNE PARTIE DANS CE TOURNOI */}
      {isGameModalOpen && activeTournamentForGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingGameId ? 'Modifier la partie' : 'Ajouter une partie au tournoi'}
                </h2>
                <p className="text-xs text-slate-600">
                  Tournoi : <strong>{activeTournamentForGame.name}</strong> ({activeTournamentForGame.timeControl}). Cette partie sera automatiquement visible dans l’onglet « Parties ».
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGameModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGameSubmit} className="space-y-4 text-xs">
              {/* Sélection / Liaison automatique de l'Adversaire (Nom <-> ID FIDE <-> ID FFE) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-slate-700" />
                    Adversaire affronté (relié par Nom, ID FIDE ou ID FFE)
                  </div>

                  {opponents.length > 0 && (
                    <select
                      value={opponentId}
                      onChange={(e) => {
                        const chosen = opponents.find((o) => o.id === e.target.value);
                        if (chosen) linkOpponentFields(chosen);
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                    >
                      <option value="">-- Choisir un joueur déjà affronté --</option>
                      {opponents.map((o) => {
                        const cadenceElo = getOpponentEloForCadence(
                          o,
                          activeTournamentForGame.timeControl
                        );
                        return (
                          <option key={o.id} value={o.id}>
                            {o.name} (Elo {activeTournamentForGame.timeControl}: {cadenceElo}){' '}
                            {o.fideId ? `· FIDE ${o.fideId}` : ''}{' '}
                            {o.ffeId ? `· FFE ${o.ffeId}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nom & Prénom de l’adversaire *
                    </label>
                    <input
                      type="text"
                      value={opponentName}
                      onChange={(e) => handleOpponentNameChange(e.target.value)}
                      placeholder="Tapez son nom (ex: Dubois, Quentin)"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ID FIDE (auto-relié)
                    </label>
                    <input
                      type="text"
                      value={opponentFideId}
                      onChange={(e) => handleOpponentFideChange(e.target.value)}
                      placeholder="Ex: 65201943"
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ID FFE (auto-relié)
                    </label>
                    <input
                      type="text"
                      value={opponentFfeId}
                      onChange={(e) => handleOpponentFfeChange(e.target.value)}
                      placeholder="Ex: K20194"
                      className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Elo adverse (
                      {activeTournamentForGame.timeControl === 'Standard'
                        ? 'Classique'
                        : activeTournamentForGame.timeControl === 'Rapid'
                        ? 'Rapide'
                        : 'Blitz'}
                      ) *
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
                      Titre FIDE adverse
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
                      Fédération
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={opponentFederation}
                      onChange={(e) => setOpponentFederation(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                {matchedOpponentStats && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Joueur reconnu : <strong>{matchedOpponentStats.match.name}</strong>{' '}
                      <span className="font-mono text-[11px] text-emerald-800">
                        (Classique: {matchedOpponentStats.match.standardElo || matchedOpponentStats.match.elo} · Rapide: {matchedOpponentStats.match.rapidElo || matchedOpponentStats.match.elo} · Blitz: {matchedOpponentStats.match.blitzElo || matchedOpponentStats.match.elo})
                      </span>
                    </span>
                    <span className="font-mono font-semibold">
                      Historique contre lui : {matchedOpponentStats.winRate}% de victoires (+
                      {matchedOpponentStats.wins} ={matchedOpponentStats.draws} -
                      {matchedOpponentStats.losses})
                    </span>
                  </div>
                )}
              </div>

              {/* Ronde, Couleur, Résultat & Calcul Elo */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ronde n°</label>
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
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ma Couleur</label>
                  <select
                    value={playerColor}
                    onChange={(e) => setPlayerColor(e.target.value as PlayerColor)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  >
                    <option value="White">Blancs</option>
                    <option value="Black">Noirs</option>
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
              </div>

              {/* Bandeau Elo gagné en direct */}
              <div className="p-3 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <span>
                  Résultat pour vous :{' '}
                  <strong>
                    {computedScore === 1
                      ? 'VICTOIRE (1 pt)'
                      : computedScore === 0.5
                      ? 'NULLE (0.5 pt)'
                      : 'DÉFAITE (0 pt)'}
                  </strong>
                </span>
                <span>
                  Elo gagné/perdu sur cette partie (K={kFactorUsed}) :{' '}
                  <strong
                    className={
                      computedEloDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {computedEloDelta >= 0
                      ? `+${computedEloDelta.toFixed(1)}`
                      : computedEloDelta.toFixed(1)}{' '}
                    pts Elo
                  </strong>
                </span>
              </div>

              {/* Ouverture & Lien Chess.com (Facultatifs) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ouverture jouée (facultatif)
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
                      className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    >
                      <option value="">-- Choisir une ouverture --</option>
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
                      placeholder="Ex: Défense Sicilienne"
                      className="w-1/2 px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lien d’analyse Chess.com (facultatif)
                  </label>
                  <input
                    type="url"
                    value={chessComUrl}
                    onChange={(e) => setChessComUrl(e.target.value)}
                    placeholder="https://www.chess.com/analysis/game/..."
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* PGN Facultatif & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Coups de la partie PGN (Non obligatoire — utile en classique)
                  </label>
                  <textarea
                    rows={3}
                    value={pgn}
                    onChange={(e) => setPgn(e.target.value)}
                    placeholder="Laissez vide si vous n'avez pas noté les coups, ou collez votre PGN (1. e4 e5 2. Nf3...)"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Notes sur la partie (facultatif)
                  </label>
                  <textarea
                    rows={3}
                    value={keyMomentNote}
                    onChange={(e) => setKeyMomentNote(e.target.value)}
                    placeholder="Moment clé, finale à retravailler..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsGameModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGame}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmittingGame ? 'Enregistrement...' : 'Enregistrer la partie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
