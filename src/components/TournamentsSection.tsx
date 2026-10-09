import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Edit3,
  ExternalLink,
  Eye,
  Info,
  MapPin,
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
  getResultFromPlayerScore,
} from '../utils/fideMath';
import {
  formatPlayerNameLastFirst,
  getOpponentEloForCadence,
  sortOpponentsAlphabetically,
} from '../utils/fideValidation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

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
  // Modale Détails complets d'un Tournoi
  const [detailTournamentId, setDetailTournamentId] = useState<string | null>(null);

  // Modale Créer / Modifier un Tournoi
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

  // Modale Ajouter / Modifier une Partie dans un Tournoi
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
  // Score toujours par rapport à moi : 1 = Victoire, 0.5 = Nulle, 0 = Défaite
  const [myScore, setMyScore] = useState<0 | 0.5 | 1>(1);
  const [kFactorUsed, setKFactorUsed] = useState<10 | 20 | 40>(profile?.kFactor || 20);
  const [ecoCode, setEcoCode] = useState('');
  const [openingName, setOpeningName] = useState('');
  const [pgn, setPgn] = useState('');
  const [chessComUrl, setChessComUrl] = useState('');
  const [keyMomentNote, setKeyMomentNote] = useState('');
  const [isSubmittingGame, setIsSubmittingGame] = useState(false);

  // Modales de confirmation de suppression (3s)
  const [tourneyToDelete, setTourneyToDelete] = useState<Tournament | null>(null);
  const [gameToDelete, setGameToDelete] = useState<FideGame | null>(null);

  // Joueurs affrontés triés par ordre alphabétique "NOM, Prénom"
  const sortedOpponents = useMemo(
    () => sortOpponentsAlphabetically(opponents),
    [opponents]
  );

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

  // Ouvrir Modal Ajouter / Modifier Partie dans ce Tournoi
  const openAddGameInTourney = (t: Tournament, existingGame?: FideGame) => {
    setActiveTournamentForGame(t);
    if (existingGame) {
      setEditingGameId(existingGame.id);
      setRound(existingGame.round);
      setDatePlayed(existingGame.datePlayed);
      setPlayerColor(existingGame.playerColor);
      setPlayerElo(existingGame.playerElo);
      setOpponentId(existingGame.opponentId || '');
      setOpponentName(formatPlayerNameLastFirst(existingGame.opponentName));
      setOpponentFideId(existingGame.opponentFideId);
      setOpponentFfeId(existingGame.opponentFfeId || '');
      setOpponentTitle(existingGame.opponentTitle);
      setOpponentElo(existingGame.opponentElo);
      setOpponentFederation(existingGame.opponentFederation);
      setMyScore(existingGame.playerScore);
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
      setMyScore(1);
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
  const linkOpponentFields = (opp: OpponentPlayer) => {
    const cadence = activeTournamentForGame?.timeControl || 'Standard';
    setOpponentId(opp.id);
    setOpponentName(formatPlayerNameLastFirst(opp.name));
    setOpponentFideId(opp.fideId || '');
    setOpponentFfeId(opp.ffeId || '');
    setOpponentElo(getOpponentEloForCadence(opp, cadence));
    setOpponentTitle(opp.title || 'None');
    setOpponentFederation(opp.federation || 'FRA');
  };

  const handleOpponentNameChange = (val: string) => {
    setOpponentName(val);
    const match = opponents.find(
      (o) =>
        o.name.trim().toLowerCase() === val.trim().toLowerCase() ||
        formatPlayerNameLastFirst(o.name).toLowerCase() === val.trim().toLowerCase()
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
          (o.name.trim().toLowerCase() === opponentName.trim().toLowerCase() ||
            formatPlayerNameLastFirst(o.name).toLowerCase() ===
              opponentName.trim().toLowerCase()))
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

  const computedResult = useMemo(
    () => getResultFromPlayerScore(myScore, playerColor),
    [myScore, playerColor]
  );

  const computedEloDelta = useMemo(
    () => calculateFideEloChange(playerElo, opponentElo, myScore, kFactorUsed),
    [playerElo, opponentElo, myScore, kFactorUsed]
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
        const drawPct = playedCount > 0 ? Math.round((draws / playedCount) * 100) : 0;
        const lossPct = playedCount > 0 ? Math.max(0, 100 - winPct - drawPct) : 0;

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
          drawPct,
          lossPct,
        };
      });
  }, [tournaments, games]);

  const detailTournament = useMemo(
    () => enrichedTournaments.find((t) => t.id === detailTournamentId) || null,
    [enrichedTournaments, detailTournamentId]
  );

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
          opponentName: formatPlayerNameLastFirst(opponentName),
          opponentFideId,
          opponentFfeId,
          opponentTitle,
          opponentElo: Number(opponentElo),
          opponentFederation,
          result: computedResult,
          playerScore: myScore,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-indigo-950">
            Mes Tournois FIDE
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Vue épurée de vos tournois. Cliquez sur « Voir toutes les infos & parties » pour ouvrir la fiche complète d’un tournoi.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewTourneyModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Créer un nouveau tournoi
        </button>
      </div>

      {/* Liste épurée des Tournois (sans surcharge) */}
      {enrichedTournaments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <Trophy className="w-10 h-10 text-indigo-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Aucun tournoi enregistré pour le moment
            </h3>
            <p className="text-sm text-slate-600">
              Ajoutez votre premier tournoi pour y rentrer vos parties et calculer automatiquement vos gains d’Elo.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewTourneyModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Ajouter mon premier tournoi
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {enrichedTournaments.map((t) => {
            const topBorderClass =
              t.timeControl === 'Rapid'
                ? 'border-t-4 border-t-amber-500'
                : t.timeControl === 'Blitz'
                ? 'border-t-4 border-t-sky-500'
                : 'border-t-4 border-t-indigo-600';

            const cadenceBadgeClass =
              t.timeControl === 'Rapid'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : t.timeControl === 'Blitz'
                ? 'bg-sky-100 text-sky-900 border border-sky-300'
                : 'bg-indigo-100 text-indigo-900 border border-indigo-300';

            return (
              <div
                key={t.id}
                className={`bg-white border border-slate-200 ${topBorderClass} rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 hover:border-indigo-300 transition-colors`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-md ${cadenceBadgeClass}`}
                      >
                        {t.timeControl === 'Standard'
                          ? 'Classique'
                          : t.timeControl === 'Rapid'
                          ? 'Rapide'
                          : 'Blitz'}
                      </span>
                      <h2 className="text-lg font-extrabold text-slate-900 mt-1.5">
                        {t.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {t.location}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {t.startDate}
                        </span>
                        {t.finalRank && (
                          <span className="font-bold text-indigo-700">
                            Classé {t.finalRank}e
                            {t.totalPlayers ? ` / ${t.totalPlayers}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditTourneyModal(t)}
                        className="p-2 text-slate-500 hover:text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors"
                        title="Modifier ce tournoi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTourneyToDelete(t)}
                        className="p-2 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Supprimer ce tournoi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Résumé épuré en 3 blocs clés */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                      <div className="text-[11px] font-semibold text-slate-500">Score</div>
                      <div className="text-base font-mono font-extrabold text-slate-900 mt-0.5">
                        {t.score} / {t.playedCount}
                      </div>
                    </div>

                    <div className="p-2.5 bg-violet-50/60 border border-violet-200 rounded-xl text-center">
                      <div className="text-[11px] font-bold text-violet-800">Perf. FIDE</div>
                      <div className="text-base font-mono font-extrabold text-violet-950 mt-0.5">
                        {t.perfRating || '—'}
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border text-center ${
                        t.eloNet >= 0
                          ? 'bg-emerald-50/70 border-emerald-200'
                          : 'bg-rose-50/70 border-rose-200'
                      }`}
                    >
                      <div
                        className={`text-[11px] font-bold ${
                          t.eloNet >= 0 ? 'text-emerald-800' : 'text-rose-800'
                        }`}
                      >
                        Elo Gagné
                      </div>
                      <div
                        className={`text-base font-mono font-extrabold mt-0.5 ${
                          t.eloNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {t.eloNet >= 0 ? `+${t.eloNet.toFixed(1)}` : t.eloNet.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Boutons d'action : Modale Détails & Ajouter une partie */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailTournamentId(t.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-extrabold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <Info className="w-4 h-4 text-indigo-600" />
                    Voir toutes les infos & parties ({t.playedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => openAddGameInTourney(t)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter une partie
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALE DÉTAILS COMPLETS D'UN TOURNOI (Infos + Toutes ses parties) */}
      {detailTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl max-w-5xl w-full p-6 space-y-6 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      detailTournament.timeControl === 'Rapid'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : detailTournament.timeControl === 'Blitz'
                        ? 'bg-sky-100 text-sky-900 border border-sky-300'
                        : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                    }`}
                  >
                    {detailTournament.timeControl === 'Standard'
                      ? 'Classique'
                      : detailTournament.timeControl === 'Rapid'
                      ? 'Rapide'
                      : 'Blitz'}{' '}
                    ({detailTournament.timeControlDetails})
                  </span>
                  <span className="text-xs font-mono text-slate-600">
                    {detailTournament.location} · Du {detailTournament.startDate} au{' '}
                    {detailTournament.endDate}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-indigo-950 mt-2">
                  {detailTournament.name}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openAddGameInTourney(detailTournament)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une partie
                </button>
                <button
                  type="button"
                  onClick={() => openEditTourneyModal(detailTournament)}
                  className="p-2 text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 rounded-xl"
                  title="Modifier les infos du tournoi"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTourneyToDelete(detailTournament)}
                  className="p-2 text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-xl"
                  title="Supprimer ce tournoi"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTournamentId(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Grille complète des statistiques du tournoi */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-500">
                  Parties & Format
                </div>
                <div className="text-base font-mono font-extrabold text-slate-900 mt-0.5">
                  {detailTournament.playedCount} / {detailTournament.totalRounds} rondes
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Format {detailTournament.format} · Elo dép. {detailTournament.startingElo}
                </div>
              </div>

              <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl">
                <div className="text-[11px] font-bold text-indigo-800">Score & Bilan</div>
                <div className="text-base font-mono font-extrabold text-indigo-950 mt-0.5">
                  {detailTournament.score} / {detailTournament.playedCount} pts
                </div>
                <div className="text-[11px] font-mono space-x-1.5 mt-0.5">
                  <span className="text-emerald-700 font-bold">{detailTournament.wins}V</span>
                  <span className="text-amber-700 font-bold">{detailTournament.draws}N</span>
                  <span className="text-rose-700 font-bold">{detailTournament.losses}D</span>
                </div>
              </div>

              <div className="p-3 bg-violet-50/60 border border-violet-200 rounded-xl">
                <div className="text-[11px] font-bold text-violet-800">
                  Performance FIDE
                </div>
                <div className="text-base font-mono font-extrabold text-violet-950 mt-0.5">
                  {detailTournament.perfRating || '—'}
                </div>
                <div className="text-[11px] text-violet-700 font-medium">
                  Taux victoire : {detailTournament.winPct}%
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  detailTournament.eloNet >= 0
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-rose-50/70 border-rose-200'
                }`}
              >
                <div
                  className={`text-[11px] font-bold ${
                    detailTournament.eloNet >= 0 ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  Elo Gagné / Perdu
                </div>
                <div
                  className={`text-base font-mono font-extrabold mt-0.5 ${
                    detailTournament.eloNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {detailTournament.eloNet >= 0
                    ? `+${detailTournament.eloNet.toFixed(1)}`
                    : detailTournament.eloNet.toFixed(1)}{' '}
                  pts
                </div>
              </div>

              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl">
                <div className="text-[11px] font-bold text-amber-900">
                  Classement Final
                </div>
                <div className="text-base font-mono font-extrabold text-amber-950 mt-0.5">
                  {detailTournament.finalRank ? `${detailTournament.finalRank}e` : '—'}
                  {detailTournament.totalPlayers ? (
                    <span className="text-xs font-normal text-amber-800">
                      {' '}
                      / {detailTournament.totalPlayers} j.
                    </span>
                  ) : (
                    ''
                  )}
                </div>
                <div className="text-[11px] text-amber-800 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {detailTournament.totalPlayers
                    ? `${detailTournament.totalPlayers} participants`
                    : 'Non renseigné'}
                </div>
              </div>
            </div>

            {detailTournament.notes && (
              <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs text-slate-700">
                <strong className="text-indigo-950">Notes sur le tournoi :</strong>{' '}
                {detailTournament.notes}
              </div>
            )}

            {/* Liste des rondes / parties du tournoi */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-indigo-950">
                  Parties jouées dans ce tournoi ({detailTournament.tGames.length})
                </h3>
              </div>

              {detailTournament.tGames.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                  <p className="text-sm text-slate-600">
                    Aucune partie enregistrée dans ce tournoi pour le moment.
                  </p>
                  <button
                    type="button"
                    onClick={() => openAddGameInTourney(detailTournament)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter la Ronde 1
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-indigo-100 bg-indigo-50/60 text-xs font-bold text-indigo-950">
                        <th className="py-2.5 px-4">Ronde</th>
                        <th className="py-2.5 px-4">Adversaire (NOM, Prénom)</th>
                        <th className="py-2.5 px-4 text-right">Elo Adv.</th>
                        <th className="py-2.5 px-4">Ma Couleur</th>
                        <th className="py-2.5 px-4 text-center">Mon Résultat</th>
                        <th className="py-2.5 px-4 text-right">Elo Gagné</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {detailTournament.tGames.map((g) => {
                        const oppRecordId = findOpponentRecordId(g);
                        const rowAccent =
                          g.playerScore === 1
                            ? 'border-l-4 border-l-emerald-500 bg-emerald-50/15'
                            : g.playerScore === 0
                            ? 'border-l-4 border-l-rose-500 bg-rose-50/15'
                            : 'border-l-4 border-l-amber-500 bg-amber-50/15';
                        return (
                          <tr
                            key={g.id}
                            className={`${rowAccent} hover:bg-slate-50 transition-colors`}
                          >
                            <td className="py-3 px-4 font-mono text-xs font-bold text-indigo-950">
                              Ronde {g.round}
                              <div className="text-[11px] font-normal text-slate-500">
                                {g.datePlayed}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => {
                                  if (oppRecordId) {
                                    setDetailTournamentId(null);
                                    onSelectOpponentProfile(oppRecordId);
                                  }
                                }}
                                className="font-bold text-indigo-950 hover:text-indigo-600 hover:underline text-left cursor-pointer"
                              >
                                {formatPlayerNameLastFirst(g.opponentName)}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {g.opponentElo}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className={`w-3 h-3 rounded-sm border ${
                                    g.playerColor === 'White'
                                      ? 'bg-white border-slate-400'
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
                                  ? 'Victoire'
                                  : g.playerScore === 0.5
                                  ? 'Nulle'
                                  : 'Défaite'}
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
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDetailTournamentId(null);
                                    onOpenGameInViewer(g);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Détails & PGN
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
                                  onClick={() => openAddGameInTourney(detailTournament, g)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-700 rounded-lg hover:bg-indigo-50"
                                  title="Modifier cette partie"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setGameToDelete(g)}
                                  className="p-1.5 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                                  title="Supprimer cette partie"
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
          </div>
        </div>
      )}

      {/* MODAL 1 : CRÉER / MODIFIER UN TOURNOI */}
      {isTourneyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-indigo-950">
                  {editingTourneyId ? 'Modifier le tournoi' : 'Créer un nouveau tournoi'}
                </h2>
                <p className="text-xs text-slate-500">
                  Renseignez la cadence, le nombre de joueurs et votre classement final.
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Standard">Classique (Standard FIDE)</option>
                    <option value="Rapid">Rapide</option>
                    <option value="Blitz">Blitz</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                <label className="block font-bold text-slate-700 mb-1">
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
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTourney}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-indigo-950">
                  {editingGameId ? 'Modifier la partie' : 'Ajouter une partie au tournoi'}
                </h2>
                <p className="text-xs text-slate-600">
                  Tournoi : <strong>{activeTournamentForGame.name}</strong> ({activeTournamentForGame.timeControl}).
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
              {/* Sélection / Liaison automatique de l'Adversaire (Trié A-Z sous la forme "NOM, Prénom" sans ID) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    Adversaire affronté
                  </div>

                  {sortedOpponents.length > 0 && (
                    <select
                      value={opponentId}
                      onChange={(e) => {
                        const chosen = opponents.find((o) => o.id === e.target.value);
                        if (chosen) linkOpponentFields(chosen);
                      }}
                      className="px-3 py-2 bg-white border border-indigo-200 rounded-xl font-bold text-indigo-950 focus:outline-none focus:border-indigo-600"
                    >
                      <option value="">-- Sélectionner un joueur déjà affronté (A → Z) --</option>
                      {sortedOpponents.map((o) => (
                        <option key={o.id} value={o.id}>
                          {formatPlayerNameLastFirst(o.name)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      NOM, Prénom de l’adversaire *
                    </label>
                    <input
                      type="text"
                      value={opponentName}
                      onChange={(e) => handleOpponentNameChange(e.target.value)}
                      placeholder="Ex: DUBOIS, Quentin"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
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
                    <label className="block font-bold text-slate-700 mb-1">
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
                    <label className="block font-bold text-slate-700 mb-1">
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
                      className="w-full px-3 py-2 font-mono font-bold bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
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
                    <label className="block font-bold text-slate-700 mb-1">
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
                      Joueur reconnu :{' '}
                      <strong>{formatPlayerNameLastFirst(matchedOpponentStats.match.name)}</strong>
                    </span>
                    <span className="font-mono font-bold">
                      Historique contre lui : {matchedOpponentStats.winRate}% de victoires (+
                      {matchedOpponentStats.wins} ={matchedOpponentStats.draws} -
                      {matchedOpponentStats.losses})
                    </span>
                  </div>
                )}
              </div>

              {/* Ronde, Date, Ma Couleur & Mon Elo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ronde n°</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={round}
                    onChange={(e) => setRound(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={datePlayed}
                    onChange={(e) => setDatePlayed(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ma Couleur</label>
                  <select
                    value={playerColor}
                    onChange={(e) => setPlayerColor(e.target.value as PlayerColor)}
                    className="w-full px-3 py-2 font-bold border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="White">Blancs</option>
                    <option value="Black">Noirs</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mon Elo</label>
                  <input
                    type="number"
                    min={800}
                    max={3500}
                    value={playerElo}
                    onChange={(e) => setPlayerElo(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* MON SCORE (Toujours par rapport à moi : 3 boutons Victoire / Nulle / Défaite) */}
              <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-indigo-950 text-xs">
                    Mon résultat dans cette partie (toujours par rapport à moi) *
                  </label>
                  <span className="font-mono text-xs font-extrabold">
                    Variation Elo estimée (K={kFactorUsed}) :{' '}
                    <span
                      className={
                        computedEloDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }
                    >
                      {computedEloDelta >= 0
                        ? `+${computedEloDelta.toFixed(1)}`
                        : computedEloDelta.toFixed(1)}{' '}
                      pts
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setMyScore(1)}
                    className={`py-3 px-4 rounded-xl font-extrabold text-sm border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      myScore === 1
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm scale-[1.01]'
                        : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    1 · Victoire
                  </button>

                  <button
                    type="button"
                    onClick={() => setMyScore(0.5)}
                    className={`py-3 px-4 rounded-xl font-extrabold text-sm border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      myScore === 0.5
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm scale-[1.01]'
                        : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    2 · Nulle
                  </button>

                  <button
                    type="button"
                    onClick={() => setMyScore(0)}
                    className={`py-3 px-4 rounded-xl font-extrabold text-sm border-2 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      myScore === 0
                        ? 'bg-rose-600 text-white border-rose-700 shadow-sm scale-[1.01]'
                        : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    3 · Défaite
                  </button>
                </div>
              </div>

              {/* Ouverture & Lien Chess.com (Facultatifs) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
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
                  <label className="block font-bold text-slate-700 mb-1">
                    Coups de la partie PGN (Facultatif)
                  </label>
                  <textarea
                    rows={3}
                    value={pgn}
                    onChange={(e) => setPgn(e.target.value)}
                    placeholder="Collez votre PGN (1. e4 e5 2. Nf3...)"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
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
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGame}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingGame ? 'Enregistrement...' : 'Enregistrer la partie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION DE SUPPRESSION D'UN TOURNOI (3 secondes) */}
      <ConfirmDeleteModal
        isOpen={Boolean(tourneyToDelete)}
        title="Supprimer ce tournoi et ses parties ?"
        subtitle="Vous êtes sur le point de supprimer définitivement un tournoi ainsi que l'ensemble des parties qui y sont rattachées."
        itemName={tourneyToDelete?.name || ''}
        details={
          tourneyToDelete
            ? [
                { label: 'Lieu & Dates', value: `${tourneyToDelete.location} (${tourneyToDelete.startDate})` },
                {
                  label: 'Cadence',
                  value:
                    tourneyToDelete.timeControl === 'Standard'
                      ? 'Classique'
                      : tourneyToDelete.timeControl === 'Rapid'
                      ? 'Rapide'
                      : 'Blitz',
                },
                {
                  label: 'Parties associées supprimées',
                  value: `${games.filter((g) => g.tournamentId === tourneyToDelete.id).length} partie(s)`,
                },
                {
                  label: 'Mon Elo de départ',
                  value: `${tourneyToDelete.startingElo} Elo`,
                },
              ]
            : []
        }
        warningMessage={
          tourneyToDelete
            ? `Attention : ce tournoi ainsi que ses ${
                games.filter((g) => g.tournamentId === tourneyToDelete.id).length
              } partie(s) enregistrée(s) seront définitivement effacés.`
            : undefined
        }
        onCancel={() => setTourneyToDelete(null)}
        onConfirm={async () => {
          if (!tourneyToDelete) return;
          const id = tourneyToDelete.id;
          if (detailTournamentId === id) setDetailTournamentId(null);
          await onDeleteTournament(id);
          setTourneyToDelete(null);
        }}
      />

      {/* MODALE DE CONFIRMATION DE SUPPRESSION D'UNE PARTIE (3 secondes) */}
      <ConfirmDeleteModal
        isOpen={Boolean(gameToDelete)}
        title="Supprimer cette partie ?"
        subtitle="Vous êtes sur le point de supprimer définitivement cette ronde enregistrée."
        itemName={
          gameToDelete
            ? `Ronde ${gameToDelete.round} vs ${formatPlayerNameLastFirst(gameToDelete.opponentName)}`
            : ''
        }
        details={
          gameToDelete
            ? [
                { label: 'Tournoi', value: gameToDelete.tournamentName },
                { label: 'Date & Ronde', value: `Ronde ${gameToDelete.round} · ${gameToDelete.datePlayed}` },
                {
                  label: 'Mon résultat',
                  value:
                    gameToDelete.playerScore === 1
                      ? 'Victoire (1 pt)'
                      : gameToDelete.playerScore === 0.5
                      ? 'Nulle (½ pt)'
                      : 'Défaite (0 pt)',
                },
                {
                  label: 'Variation Elo',
                  value: `${gameToDelete.eloChange >= 0 ? '+' : ''}${gameToDelete.eloChange.toFixed(1)} pts`,
                },
              ]
            : []
        }
        onCancel={() => setGameToDelete(null)}
        onConfirm={async () => {
          if (!gameToDelete) return;
          await onDeleteGame(gameToDelete.id);
          setGameToDelete(null);
        }}
      />
    </div>
  );
};
