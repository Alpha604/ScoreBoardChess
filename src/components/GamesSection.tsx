import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
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
} from '../types/fide';
import {
  calculateFideEloChange,
  calculateFideExpectedScore,
  calculateFidePerformanceRating,
  ECO_OPENINGS_CATALOG,
  getResultFromPlayerScore,
} from '../utils/fideMath';
import {
  formatEloDisplay,
  formatPlayerNameLastFirst,
  FREE_GAME_TOURNAMENT_ID,
  FREE_GAME_TOURNAMENT_NAME,
  getOpponentEloForCadence,
  hasQuestionMarkInName,
  isOpponentEloUnknownForCadence,
  sortOpponentsAlphabetically,
  stripQuestionMarkFromName,
} from '../utils/fideValidation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

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
  isFriendlyMode?: boolean;
}

const FIDE_TITLES: FideTitle[] = [
  'None',
  'CM',
  'FM',
  'IM',
  'GM',
  'WCM',
  'WFM',
  'WIM',
  'WGM',
];

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
  isFriendlyMode = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPgnId, setCopiedPgnId] = useState<string | null>(null);
  const [gameToDelete, setGameToDelete] = useState<FideGame | null>(null);

  // Modal d'ajout/édition de partie
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | undefined>(
    undefined
  );
  const [tournamentId, setTournamentId] = useState(
    selectedTournamentFilter ||
      (isFriendlyMode
        ? FREE_GAME_TOURNAMENT_ID
        : tournaments[0]?.id || FREE_GAME_TOURNAMENT_ID)
  );
  const [timeControl, setTimeControl] =
    useState<TimeControlCategory>('Standard');
  const [round, setRound] = useState(1);
  const [datePlayed, setDatePlayed] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [playerColor, setPlayerColor] = useState<PlayerColor>('White');
  const [playerElo, setPlayerElo] = useState(profile?.standardElo || 1800);
  const [opponentId, setOpponentId] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [opponentNameUncertain, setOpponentNameUncertain] = useState(false);
  const [opponentFideId, setOpponentFideId] = useState('');
  const [opponentFfeId, setOpponentFfeId] = useState('');
  const [opponentTitle, setOpponentTitle] = useState<FideTitle>('None');
  const [opponentElo, setOpponentElo] = useState(1600);
  const [opponentEloUnknown, setOpponentEloUnknown] = useState(false);
  const [opponentFederation, setOpponentFederation] = useState('FRA');
  // Score toujours par rapport à moi : 1 = Victoire, 0.5 = Nulle, 0 = Défaite
  const [myScore, setMyScore] = useState<0 | 0.5 | 1>(1);
  const [kFactorUsed, setKFactorUsed] = useState<10 | 20 | 40>(
    profile?.kFactor || 20
  );
  const [ecoCode, setEcoCode] = useState('');
  const [openingName, setOpeningName] = useState('');
  const [pgn, setPgn] = useState('');
  const [chessComUrl, setChessComUrl] = useState('');
  const [keyMomentNote, setKeyMomentNote] = useState('');
  const [modalStep, setModalStep] = useState<1 | 2 | 3 | 4>(1);
  const [canConfirmSave, setCanConfirmSave] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (modalStep === 4) {
      setCanConfirmSave(false);
      const timer = setTimeout(() => {
        setCanConfirmSave(true);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setCanConfirmSave(false);
    }
  }, [modalStep]);

  // Variation Elo : calcul automatique FIDE avec possibilité de modification manuelle
  const [manualEloChange, setManualEloChange] = useState<string>('');
  const [isManualEloOverride, setIsManualEloOverride] = useState<boolean>(false);

  // Tournois triés chronologiquement du plus récent au plus vieux pour les menus déroulants
  const chronologicallySortedTournaments = useMemo(() => {
    return [...tournaments].sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [tournaments]);

  // Adversaires triés par ordre alphabétique "NOM, Prénom"
  const sortedOpponents = useMemo(
    () => sortOpponentsAlphabetically(opponents),
    [opponents]
  );

  const linkOpponentFields = (
    opp: OpponentPlayer,
    targetTourneyId?: string,
    customCadence?: TimeControlCategory
  ) => {
    const tId = targetTourneyId ?? tournamentId;
    const chosenTourney = tournaments.find((t) => t.id === tId);
    const cadence = customCadence || chosenTourney?.timeControl || timeControl;
    const eloUnknown = isOpponentEloUnknownForCadence(opp, cadence);
    const eloVal = getOpponentEloForCadence(opp, cadence);

    setOpponentId(opp.id);
    setOpponentName(stripQuestionMarkFromName(opp.name));
    setOpponentNameUncertain(
      Boolean(opp.isNameUncertain) || hasQuestionMarkInName(opp.name)
    );
    setOpponentFideId(opp.fideId || '');
    setOpponentFfeId(opp.ffeId || '');
    setOpponentEloUnknown(eloUnknown);
    setOpponentElo(eloUnknown ? 1500 : eloVal);
    setOpponentTitle(opp.title || 'None');
    setOpponentFederation(opp.federation || 'FRA');
  };

  const openNewGameModal = () => {
    const defaultTourney =
      tournaments.find((t) => t.id === selectedTournamentFilter) ||
      (isFriendlyMode ? undefined : tournaments[0]);

    const nextTourneyId = defaultTourney
      ? defaultTourney.id
      : FREE_GAME_TOURNAMENT_ID;
    const existingInContext = games.filter(
      (g) => g.tournamentId === nextTourneyId
    );

    setEditingGameId(undefined);
    setTournamentId(nextTourneyId);
    setTimeControl(
      defaultTourney?.timeControl || (isFriendlyMode ? 'Rapid' : 'Standard')
    );
    setRound(existingInContext.length + 1);
    setDatePlayed(new Date().toISOString().slice(0, 10));
    setPlayerColor(existingInContext.length % 2 === 0 ? 'White' : 'Black');
    setPlayerElo(
      defaultTourney?.startingElo || profile?.standardElo || 1800
    );
    setOpponentId('');
    setOpponentName('');
    setOpponentNameUncertain(false);
    setOpponentFideId('');
    setOpponentFfeId('');
    setOpponentTitle('None');
    setOpponentElo(1600);
    setOpponentEloUnknown(false);
    setOpponentFederation('FRA');
    setMyScore(1);
    setKFactorUsed(profile?.kFactor || 20);
    setEcoCode('');
    setOpeningName('');
    setPgn('');
    setChessComUrl('');
    setKeyMomentNote('');
    setManualEloChange('');
    setIsManualEloOverride(false);
    setModalStep(1);
    setIsModalOpen(true);
  };

  const openEditGameModal = (g: FideGame) => {
    const unknownElo =
      Boolean(g.opponentEloUnknown) || Number(g.opponentElo) <= 0;
    setEditingGameId(g.id);
    setTournamentId(g.tournamentId || FREE_GAME_TOURNAMENT_ID);
    setTimeControl(g.timeControl || 'Standard');
    setRound(g.round);
    setDatePlayed(g.datePlayed);
    setPlayerColor(g.playerColor);
    setPlayerElo(g.playerElo);
    setOpponentId(g.opponentId || '');
    setOpponentName(stripQuestionMarkFromName(g.opponentName));
    setOpponentNameUncertain(
      Boolean(g.opponentNameUncertain) ||
        hasQuestionMarkInName(g.opponentName)
    );
    setOpponentFideId(g.opponentFideId);
    setOpponentFfeId(g.opponentFfeId || '');
    setOpponentTitle(g.opponentTitle);
    setOpponentEloUnknown(unknownElo);
    setOpponentElo(unknownElo ? 1500 : g.opponentElo);
    setOpponentFederation(g.opponentFederation);
    setMyScore(g.playerScore);
    setKFactorUsed(g.kFactorUsed);
    setEcoCode(g.ecoCode);
    setOpeningName(g.openingName);
    setPgn(g.pgn);
    setChessComUrl(g.chessComUrl || '');
    setKeyMomentNote(g.keyMomentNote);
    setManualEloChange(
      g.eloChange >= 0 ? `+${g.eloChange.toFixed(1)}` : g.eloChange.toFixed(1)
    );
    setIsManualEloOverride(true);
    setModalStep(1);
    setIsModalOpen(true);
  };

  const computedResult = useMemo(
    () => getResultFromPlayerScore(myScore, playerColor),
    [myScore, playerColor]
  );

  const expectedScore = useMemo(() => {
    return calculateFideExpectedScore(playerElo, opponentElo);
  }, [playerElo, opponentElo]);

  const computedEloDelta = useMemo(() => {
    if (isFriendlyMode || opponentEloUnknown) return 0;
    return calculateFideEloChange(
      playerElo,
      opponentElo,
      myScore,
      kFactorUsed
    );
  }, [isFriendlyMode, opponentEloUnknown, playerElo, opponentElo, myScore, kFactorUsed]);

  const effectiveEloDelta = useMemo(() => {
    if (isManualEloOverride && manualEloChange.trim() !== '') {
      const parsed = parseFloat(manualEloChange.replace('+', ''));
      if (!isNaN(parsed)) return Math.round(parsed * 10) / 10;
    }
    return isFriendlyMode || opponentEloUnknown ? 0 : computedEloDelta;
  }, [
    isManualEloOverride,
    manualEloChange,
    isFriendlyMode,
    opponentEloUnknown,
    computedEloDelta,
  ]);

  const activeTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentFilter) || null,
    [tournaments, selectedTournamentFilter]
  );

  const freeGamesCount = useMemo(
    () =>
      games.filter(
        (g) => !g.tournamentId || g.tournamentId === FREE_GAME_TOURNAMENT_ID
      ).length,
    [games]
  );

  const filteredGames = useMemo(() => {
    return games
      .filter((g) => {
        if (selectedTournamentFilter === FREE_GAME_TOURNAMENT_ID) {
          if (g.tournamentId && g.tournamentId !== FREE_GAME_TOURNAMENT_ID) {
            return false;
          }
        } else if (
          selectedTournamentFilter &&
          g.tournamentId !== selectedTournamentFilter
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            g.opponentName.toLowerCase().includes(q) ||
            formatPlayerNameLastFirst(
              g.opponentName,
              g.opponentNameUncertain
            )
              .toLowerCase()
              .includes(q) ||
            g.opponentFideId.toLowerCase().includes(q) ||
            (g.opponentFfeId || '').toLowerCase().includes(q) ||
            g.tournamentName.toLowerCase().includes(q) ||
            g.openingName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (
          selectedTournamentFilter &&
          selectedTournamentFilter !== FREE_GAME_TOURNAMENT_ID
        ) {
          return a.round - b.round;
        }
        return (
          b.datePlayed.localeCompare(a.datePlayed) || b.round - a.round
        );
      });
  }, [games, selectedTournamentFilter, searchQuery]);

  const summary = useMemo(() => {
    const count = filteredGames.length;
    const score = filteredGames.reduce((acc, g) => acc + g.playerScore, 0);
    const ratedGames = filteredGames.filter(
      (g) => !g.opponentEloUnknown && g.opponentElo > 0
    );
    const netElo =
      Math.round(
        filteredGames.reduce((acc, g) => acc + g.eloChange, 0) * 10
      ) / 10;
    const perf = calculateFidePerformanceRating(ratedGames);
    return { count, score, netElo, perf };
  }, [filteredGames]);

  const handleCopyPgnOnly = (g: FideGame) => {
    if (!g.pgn) return;
    navigator.clipboard?.writeText(g.pgn).catch(() => {});
    setCopiedPgnId(g.id);
    setTimeout(() => setCopiedPgnId(null), 2500);
  };

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
    const baseTarget = stripQuestionMarkFromName(g.opponentName).toLowerCase();
    const found = opponents.find(
      (o) =>
        (g.opponentId && o.id === g.opponentId) ||
        (g.opponentFideId && o.fideId === g.opponentFideId) ||
        (g.opponentFfeId &&
          o.ffeId &&
          o.ffeId.toUpperCase() === g.opponentFfeId.toUpperCase()) ||
        stripQuestionMarkFromName(o.name).toLowerCase() === baseTarget
    );
    return found ? found.id : null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (modalStep !== 4) return;
    const isFree =
      !tournamentId || tournamentId === FREE_GAME_TOURNAMENT_ID;
    const chosenTourney = isFree
      ? undefined
      : tournaments.find((t) => t.id === tournamentId);

    const finalTourneyId = chosenTourney
      ? chosenTourney.id
      : FREE_GAME_TOURNAMENT_ID;
    const finalTourneyName = chosenTourney
      ? chosenTourney.name
      : FREE_GAME_TOURNAMENT_NAME;
    const finalCadence = chosenTourney
      ? chosenTourney.timeControl
      : timeControl;

    setIsSubmitting(true);
    try {
      await onSaveGame(
        {
          tournamentId: finalTourneyId,
          tournamentName: finalTourneyName,
          round: Number(round) || 1,
          datePlayed,
          timeControl: finalCadence,
          playerColor,
          playerElo: Number(playerElo) || 1500,
          opponentId: opponentId || undefined,
          opponentName: formatPlayerNameLastFirst(
            opponentName || (opponentNameUncertain ? 'INCONNU' : 'Adversaire'),
            opponentNameUncertain
          ),
          opponentNameUncertain,
          opponentFideId,
          opponentFfeId,
          opponentTitle,
          opponentElo: opponentEloUnknown ? 0 : Number(opponentElo),
          opponentEloUnknown,
          opponentFederation,
          result: computedResult,
          playerScore: myScore,
          eloChange: effectiveEloDelta,
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isFriendlyMode ? 'Parties Amicales' : 'Registre des Parties'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isFriendlyMode
              ? 'Parties libres (hors tournoi) ou rattachées à une session amicale, sans variation Elo.'
              : 'Historique de vos rondes homologuées et notation PGN copiable.'}
          </p>
        </div>
        <button
          type="button"
          onClick={openNewGameModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {isFriendlyMode
            ? 'Ajouter une partie amicale (libre ou session)'
            : 'Ajouter une partie'}
        </button>
      </div>

      {/* Filtre par tournoi / parties libres */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Filtrer par cadre ou tournoi
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un adversaire, une ouverture..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-slate-900"
            />
          </div>
        </div>

        {/* Menu déroulant de filtre des tournois classé du plus récent au plus vieux */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <select
              value={selectedTournamentFilter}
              onChange={(e) => onSelectTournamentFilter(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
            >
              <option value="">
                Toutes les parties enregistrées ({games.length})
              </option>
              {(isFriendlyMode || freeGamesCount > 0) && (
                <option value={FREE_GAME_TOURNAMENT_ID}>
                  ⚡ Parties libres / Hors tournoi ({freeGamesCount})
                </option>
              )}
              {chronologicallySortedTournaments.map((t) => {
                const count = games.filter((g) => g.tournamentId === t.id).length;
                return (
                  <option key={t.id} value={t.id}>
                    📅 [{t.startDate}] · {t.name} ({count} partie{count > 1 ? 's' : ''} · {t.timeControl})
                  </option>
                );
              })}
            </select>
          </div>

          {selectedTournamentFilter && (
            <button
              type="button"
              onClick={() => onSelectTournamentFilter('')}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Afficher toutes les parties"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              Réinitialiser le filtre
            </button>
          )}
        </div>

        {/* Résumé sobre */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div>
            {selectedTournamentFilter === FREE_GAME_TOURNAMENT_ID ? (
              <span>
                Sélection :{' '}
                <strong className="text-slate-900">
                  Parties libres (Hors tournoi)
                </strong>
              </span>
            ) : activeTournament ? (
              <span>
                Sélection :{' '}
                <strong className="text-slate-900">
                  {activeTournament.name}
                </strong>{' '}
                ({activeTournament.location})
              </span>
            ) : (
              <span>Ensemble des parties enregistrées</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-slate-800">
            <span>
              Score :{' '}
              <strong className="text-slate-900">
                {summary.score} / {summary.count}
              </strong>
            </span>
            {!isFriendlyMode && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Performance :{' '}
                  <strong className="text-slate-900">
                    {summary.perf || '—'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Bilan Elo :{' '}
                  <strong
                    className={
                      summary.netElo >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }
                  >
                    {summary.netElo >= 0
                      ? `+${summary.netElo.toFixed(1)}`
                      : summary.netElo.toFixed(1)}
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tableau professionnel des Parties */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredGames.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              Aucune partie enregistrée pour cette sélection.
            </p>
            <button
              type="button"
              onClick={openNewGameModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Ajouter une partie
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date & Ronde</th>
                  <th className="py-3 px-4">Adversaire (NOM, Prénom)</th>
                  <th className="py-3 px-4 text-right">Elo Adv.</th>
                  <th className="py-3 px-4">Couleur</th>
                  <th className="py-3 px-4 text-center">Résultat</th>
                  {!isFriendlyMode && (
                    <th className="py-3 px-4 text-right">Variation Elo</th>
                  )}
                  <th className="py-3 px-4 text-right">Fiche & PGN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredGames.map((g) => {
                  const displayOppName = formatPlayerNameLastFirst(
                    g.opponentName,
                    g.opponentNameUncertain
                  );
                  const displayOppElo = formatEloDisplay(
                    g.opponentElo,
                    g.opponentEloUnknown
                  );
                  const isFree =
                    !g.tournamentId ||
                    g.tournamentId === FREE_GAME_TOURNAMENT_ID;

                  return (
                    <tr
                      key={g.id}
                      onClick={() => onSetInspectedGame(g)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {g.datePlayed}
                        </div>
                        <div className="text-slate-500">
                          {isFree ? 'Partie libre' : `Ronde ${g.round}`} ·{' '}
                          {g.timeControl === 'Standard'
                            ? 'Classique'
                            : g.timeControl === 'Rapid'
                            ? 'Rapide'
                            : 'Blitz'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{displayOppName}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {isFree
                            ? FREE_GAME_TOURNAMENT_NAME
                            : g.tournamentName}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {displayOppElo}
                      </td>

                      <td className="py-3 px-4 text-xs font-medium text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-xs border ${
                              g.playerColor === 'White'
                                ? 'bg-white border-slate-400'
                                : 'bg-slate-900 border-slate-900'
                            }`}
                          />
                          {g.playerColor === 'White' ? 'Blancs' : 'Noirs'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-xs font-semibold">
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
                            ? 'Victoire'
                            : g.playerScore === 0.5
                            ? 'Nulle'
                            : 'Défaite'}
                        </span>
                      </td>

                      {!isFriendlyMode && (
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          {g.opponentEloUnknown || g.opponentElo <= 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
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
                          )}
                        </td>
                      )}

                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSetInspectedGame(g)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5 text-slate-600" />
                            Infos & PGN
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditGameModal(g)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Modifier la partie"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setGameToDelete(g)}
                            className="p-1.5 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
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

      {/* MODALE DÉTAILS DE LA PARTIE & NOTATION PGN COPIABLE (SANS ÉCHIQUIER VISUEL) */}
      {inspectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-lg">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  {inspectedGame.tournamentId === FREE_GAME_TOURNAMENT_ID
                    ? FREE_GAME_TOURNAMENT_NAME
                    : `${inspectedGame.tournamentName} · Ronde ${inspectedGame.round}`}{' '}
                  · {inspectedGame.datePlayed}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Contre{' '}
                  {formatPlayerNameLastFirst(
                    inspectedGame.opponentName,
                    inspectedGame.opponentNameUncertain
                  )}{' '}
                  (Elo :{' '}
                  {formatEloDisplay(
                    inspectedGame.opponentElo,
                    inspectedGame.opponentEloUnknown
                  )}
                  )
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const g = inspectedGame;
                    onSetInspectedGame(null);
                    openEditGameModal(g);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => setGameToDelete(inspectedGame)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={() => onSetInspectedGame(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Colonne gauche : Informations de la partie */}
              <div className="md:col-span-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-slate-500 font-medium">Résultat</div>
                    <div
                      className={`text-sm font-mono font-bold mt-0.5 ${
                        inspectedGame.playerScore === 1
                          ? 'text-emerald-700'
                          : inspectedGame.playerScore === 0
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {inspectedGame.playerScore === 1
                        ? 'Victoire (1 pt)'
                        : inspectedGame.playerScore === 0.5
                        ? 'Nulle (½ pt)'
                        : 'Défaite (0 pt)'}
                    </div>
                  </div>

                  {!isFriendlyMode ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-slate-500 font-medium">
                        Variation Elo (K={inspectedGame.kFactorUsed})
                      </div>
                      <div
                        className={`text-sm font-mono font-bold mt-0.5 ${
                          inspectedGame.opponentEloUnknown ||
                          inspectedGame.opponentElo <= 0
                            ? 'text-slate-500'
                            : inspectedGame.eloChange >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {inspectedGame.opponentEloUnknown ||
                        inspectedGame.opponentElo <= 0
                          ? 'Non calculé (Elo ?)'
                          : `${
                              inspectedGame.eloChange >= 0
                                ? `+${inspectedGame.eloChange.toFixed(1)}`
                                : inspectedGame.eloChange.toFixed(1)
                            } pts`}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-slate-500 font-medium">Cadre</div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">
                        Amical (Sans Elo)
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-slate-500 font-medium">Ma Couleur</div>
                    <div className="font-mono font-semibold text-slate-900 mt-0.5">
                      {inspectedGame.playerColor === 'White'
                        ? 'Blancs'
                        : 'Noirs'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-slate-500 font-medium">Cadence</div>
                    <div className="font-mono font-semibold text-slate-900 mt-0.5">
                      {inspectedGame.timeControl === 'Standard'
                        ? 'Classique'
                        : inspectedGame.timeControl === 'Rapid'
                        ? 'Rapide'
                        : 'Blitz'}
                    </div>
                  </div>
                </div>

                {/* Infos sur l'adversaire */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                  <div className="font-semibold text-slate-900">
                    Adversaire
                  </div>
                  <div className="space-y-1 text-slate-600 font-mono">
                    <div>
                      Nom :{' '}
                      <strong className="text-slate-900">
                        {formatPlayerNameLastFirst(
                          inspectedGame.opponentName,
                          inspectedGame.opponentNameUncertain
                        )}
                      </strong>
                    </div>
                    <div>
                      Elo :{' '}
                      <strong className="text-slate-900">
                        {formatEloDisplay(
                          inspectedGame.opponentElo,
                          inspectedGame.opponentEloUnknown
                        )}
                      </strong>
                    </div>
                    {inspectedGame.opponentFideId && (
                      <div>ID FIDE : {inspectedGame.opponentFideId}</div>
                    )}
                    {inspectedGame.opponentFfeId && (
                      <div>ID FFE : {inspectedGame.opponentFfeId}</div>
                    )}
                    <div>
                      Fédération : {inspectedGame.opponentFederation || 'FRA'}
                    </div>
                  </div>
                  {findOpponentRecordId(inspectedGame) && (
                    <button
                      type="button"
                      onClick={() => {
                        const oppId = findOpponentRecordId(inspectedGame);
                        if (oppId) {
                          onSetInspectedGame(null);
                          onSelectOpponentProfile(oppId);
                        }
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline cursor-pointer"
                    >
                      Voir la fiche complète de ce joueur →
                    </button>
                  )}
                </div>

                {inspectedGame.openingName && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="font-medium text-slate-500">Ouverture</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {inspectedGame.ecoCode
                        ? `${inspectedGame.ecoCode} — `
                        : ''}
                      {inspectedGame.openingName}
                    </div>
                  </div>
                )}

                {inspectedGame.keyMomentNote && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                    <div className="font-semibold text-slate-900 mb-1">
                      Notes personnelles
                    </div>
                    {inspectedGame.keyMomentNote}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleAnalyzeOnChessCom(inspectedGame)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir l’analyse sur Chess.com
                </button>
              </div>

              {/* Colonne droite : Texte PGN à copier-coller (sans échiquier) */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-600" />
                    Notation PGN (Copier / Coller)
                  </div>
                  {inspectedGame.pgn && (
                    <button
                      type="button"
                      onClick={() => handleCopyPgnOnly(inspectedGame)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedPgnId === inspectedGame.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          PGN copié !
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copier le PGN
                        </>
                      )}
                    </button>
                  )}
                </div>

                {inspectedGame.pgn ? (
                  <div className="space-y-2">
                    <textarea
                      readOnly
                      rows={12}
                      value={inspectedGame.pgn}
                      onClick={(e) =>
                        (e.target as HTMLTextAreaElement).select()
                      }
                      className="w-full p-4 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-slate-900 select-all"
                    />
                    <p className="text-[11px] text-slate-500">
                      Cliquez dans la zone ou sur « Copier le PGN » pour copier l’intégralité des coups.
                    </p>
                  </div>
                ) : (
                  <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center space-y-3">
                    <p className="text-sm font-semibold text-slate-800">
                      Aucun PGN enregistré pour cette partie
                    </p>
                    <p className="text-xs text-slate-500">
                      Vous pouvez coller le texte PGN de votre partie à tout moment en modifiant cette fiche.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const g = inspectedGame;
                        onSetInspectedGame(null);
                        openEditGameModal(g);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Coller un PGN pour cette partie
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRÉATION / ÉDITION D'UNE PARTIE (BEAU, PRATIQUE, COMPLET) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 sm:p-7 space-y-6 max-h-[94vh] overflow-y-auto shadow-2xl">
            {/* En-tête coloré et élégant */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isFriendlyMode
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-blue-100 text-blue-900 border border-blue-200'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    {isFriendlyMode
                      ? 'Partie Amicale (Sans impact Elo)'
                      : 'Partie Homologuée FIDE'}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    K = {kFactorUsed} · Elo Joueur = {playerElo}
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {editingGameId ? 'Modifier la partie' : 'Enregistrer une nouvelle partie'}
                </h2>
                <p className="text-xs text-slate-600">
                  Étape {modalStep} sur 4 · Saisie claire et structurée pas à pas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper visuel à 4 étapes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setModalStep(1)}
                className={`py-2 px-3 rounded-lg text-left border transition-all cursor-pointer ${
                  modalStep === 1
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : modalStep > 1
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                  Étape 1
                </div>
                <div className="text-xs font-bold truncate">Cadre & Cadence</div>
              </button>

              <button
                type="button"
                onClick={() => setModalStep(2)}
                className={`py-2 px-3 rounded-lg text-left border transition-all cursor-pointer ${
                  modalStep === 2
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : modalStep > 2
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                  Étape 2
                </div>
                <div className="text-xs font-bold truncate">Adversaire</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (opponentName.trim() || opponentNameUncertain) setModalStep(3);
                }}
                className={`py-2 px-3 rounded-lg text-left border transition-all cursor-pointer ${
                  modalStep === 3
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : modalStep > 3
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                  Étape 3
                </div>
                <div className="text-xs font-bold truncate">Résultat & Elo</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (opponentName.trim() || opponentNameUncertain) setModalStep(4);
                }}
                className={`py-2 px-3 rounded-lg text-left border transition-all cursor-pointer ${
                  modalStep === 4
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                  Étape 4
                </div>
                <div className="text-xs font-bold truncate">Confirmation</div>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              className="space-y-5 text-xs"
            >
              {/* ÉTAPE 1 : CADRE, CADENCE & MA COULEUR */}
              {modalStep === 1 && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-blue-600" />
                      1. Cadre du match, date & cadence
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-6">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Tournoi ou Session
                        </label>
                        <select
                          value={tournamentId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setTournamentId(nextId);
                            const chosenTourney = tournaments.find((t) => t.id === nextId);
                            if (chosenTourney) {
                              setTimeControl(chosenTourney.timeControl);
                            }
                            const chosenOp = opponents.find((o) => o.id === opponentId);
                            if (chosenOp) {
                              linkOpponentFields(
                                chosenOp,
                                nextId,
                                chosenTourney?.timeControl || timeControl
                              );
                            }
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                        >
                          <option value={FREE_GAME_TOURNAMENT_ID}>
                            ⚡ Partie libre (Hors tournoi / Entraînement)
                          </option>
                          {chronologicallySortedTournaments.map((t) => (
                            <option key={t.id} value={t.id}>
                              🏆 [{t.startDate}] {t.name} ({t.timeControl})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Cadence
                        </label>
                        <select
                          value={
                            tournamentId !== FREE_GAME_TOURNAMENT_ID
                              ? tournaments.find((t) => t.id === tournamentId)
                                  ?.timeControl || timeControl
                              : timeControl
                          }
                          disabled={tournamentId !== FREE_GAME_TOURNAMENT_ID}
                          onChange={(e) => {
                            const nextTc = e.target.value as TimeControlCategory;
                            setTimeControl(nextTc);
                            const chosenOp = opponents.find((o) => o.id === opponentId);
                            if (chosenOp) {
                              linkOpponentFields(chosenOp, tournamentId, nextTc);
                            }
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="Standard">Classique (Standard)</option>
                          <option value="Rapid">Rapide</option>
                          <option value="Blitz">Blitz</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Date jouée
                        </label>
                        <input
                          type="date"
                          value={datePlayed}
                          onChange={(e) => setDatePlayed(e.target.value)}
                          className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block font-semibold text-slate-800 mb-1">
                          {tournamentId === FREE_GAME_TOURNAMENT_ID
                            ? 'N° de la partie'
                            : 'Ronde n°'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={round}
                          onChange={(e) => setRound(Number(e.target.value))}
                          className="w-full px-3 py-2 font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-8">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Mon Elo lors de la partie
                        </label>
                        <input
                          type="number"
                          min={600}
                          max={3500}
                          value={playerElo}
                          onChange={(e) => setPlayerElo(Number(e.target.value))}
                          className="w-full px-3 py-2 font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      {/* Choix visuel Blancs / Noirs avec pièces */}
                      <div className="sm:col-span-12 pt-1">
                        <label className="block font-semibold text-slate-800 mb-1.5">
                          Ma couleur de pièces
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPlayerColor('White')}
                            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                              playerColor === 'White'
                                ? 'bg-white text-slate-950 border-slate-900 ring-2 ring-slate-900/10 shadow-sm'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-xl leading-none">♔</span>
                            <span className="text-sm">Blancs (1er coup)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPlayerColor('Black')}
                            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                              playerColor === 'Black'
                                ? 'bg-slate-950 text-white border-slate-950 ring-2 ring-slate-950/20 shadow-sm'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-xl leading-none">♚</span>
                            <span className="text-sm">Noirs (2e coup)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2 : ADVERSAIRE & SES INFOS */}
              {modalStep === 2 && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        2. Sélection ou saisie de l'adversaire
                      </div>
                      {opponentId && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpponentId('');
                            setOpponentName('');
                            setOpponentNameUncertain(false);
                            setOpponentFideId('');
                            setOpponentFfeId('');
                            setOpponentTitle('None');
                            setOpponentElo(1600);
                            setOpponentEloUnknown(false);
                          }}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Délier ce joueur
                        </button>
                      )}
                    </div>

                    {sortedOpponents.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Choisir parmi vos adversaires déjà enregistrés (A → Z)
                        </label>
                        <select
                          value={opponentId}
                          onChange={(e) => {
                            const found = opponents.find((o) => o.id === e.target.value);
                            if (found) {
                              linkOpponentFields(found);
                            } else {
                              setOpponentId('');
                            }
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                        >
                          <option value="">
                            -- Sélectionner un joueur existant (ou saisir manuellement ci-dessous) --
                          </option>
                          {sortedOpponents.map((o) => (
                            <option key={o.id} value={o.id}>
                              {formatPlayerNameLastFirst(o.name, o.isNameUncertain)} (Std:{' '}
                              {o.isStandardEloUnknown ? '?' : o.standardElo || o.elo})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                      <div className="sm:col-span-6">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-slate-800">
                            NOM, Prénom de l'adversaire *
                          </label>
                          <button
                            type="button"
                            onClick={() => setOpponentNameUncertain(!opponentNameUncertain)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                              opponentNameUncertain
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                            title="Cocher si vous n'êtes pas certain de l'orthographe ou du nom"
                          >
                            <HelpCircle className="w-3 h-3" />
                            Nom incertain (?)
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={opponentName}
                            onChange={(e) => {
                              setOpponentName(e.target.value);
                              const m = opponents.find(
                                (o) =>
                                  stripQuestionMarkFromName(o.name).toLowerCase() ===
                                  stripQuestionMarkFromName(e.target.value).toLowerCase()
                              );
                              if (m) linkOpponentFields(m);
                            }}
                            placeholder="Ex: VANDENBERGHE, Lucas"
                            required={!opponentNameUncertain}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                          />
                          {opponentNameUncertain && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-xs border border-amber-300">
                              ?
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-slate-800">
                            Son classement Elo
                          </label>
                          <button
                            type="button"
                            onClick={() => setOpponentEloUnknown(!opponentEloUnknown)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                              opponentEloUnknown
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                            title="Indiquer ? si l'Elo de l'adversaire est inconnu ou non classé"
                          >
                            Elo ?
                          </button>
                        </div>
                        {opponentEloUnknown ? (
                          <div className="w-full px-3 py-2 font-mono font-bold bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-center">
                            ? (Inconnu)
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={600}
                            max={3500}
                            value={opponentElo}
                            onChange={(e) => setOpponentElo(Number(e.target.value))}
                            required
                            className="w-full px-3 py-2 font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
                          />
                        )}
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Titre FIDE
                        </label>
                        <select
                          value={opponentTitle}
                          onChange={(e) => setOpponentTitle(e.target.value as FideTitle)}
                          className="w-full px-3 py-2 font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
                        >
                          {FIDE_TITLES.map((t) => (
                            <option key={t} value={t}>
                              {t === 'None' ? 'Aucun' : t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block font-semibold text-slate-800 mb-1">
                          ID FIDE
                        </label>
                        <input
                          type="text"
                          value={opponentFideId}
                          onChange={(e) =>
                            setOpponentFideId(e.target.value.replace(/[^0-9]/g, ''))
                          }
                          placeholder="65104823"
                          className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block font-semibold text-slate-800 mb-1">
                          ID FFE
                        </label>
                        <input
                          type="text"
                          value={opponentFfeId}
                          onChange={(e) =>
                            setOpponentFfeId(e.target.value.toUpperCase())
                          }
                          placeholder="K59412"
                          className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Fédération
                        </label>
                        <input
                          type="text"
                          maxLength={3}
                          value={opponentFederation}
                          onChange={(e) =>
                            setOpponentFederation(e.target.value.toUpperCase())
                          }
                          placeholder="FRA"
                          className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 : RÉSULTAT, FIN DE PARTIE & VARIATION ELO */}
              {modalStep === 3 && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      3. Score par rapport à vous & Calcul FIDE
                    </div>

                    {/* 3 boutons de score clairs */}
                    <div>
                      <div className="text-xs font-bold text-slate-900 mb-2">
                        Résultat de la partie (par rapport à vous) :
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setMyScore(1)}
                          className={`py-3.5 px-4 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                            myScore === 1
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                              : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          <div className="text-xl">🏆</div>
                          <div className="text-sm font-bold mt-1">1 Victoire</div>
                          <div className="text-[11px] opacity-80 mt-0.5">
                            {playerColor === 'White' ? '1-0' : '0-1'}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMyScore(0.5)}
                          className={`py-3.5 px-4 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                            myScore === 0.5
                              ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/20'
                              : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
                          }`}
                        >
                          <div className="text-xl">🤝</div>
                          <div className="text-sm font-bold mt-1">1/2 Nulle</div>
                          <div className="text-[11px] opacity-80 mt-0.5">1/2 - 1/2</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMyScore(0)}
                          className={`py-3.5 px-4 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                            myScore === 0
                              ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/20'
                              : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-50'
                          }`}
                        >
                          <div className="text-xl">❌</div>
                          <div className="text-sm font-bold mt-1">0 Défaite</div>
                          <div className="text-[11px] opacity-80 mt-0.5">
                            {playerColor === 'White' ? '0-1' : '1-0'}
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Bloc calcul Elo et override */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            Variation FIDE Elo calculée
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {isFriendlyMode
                              ? 'Mode amical actif : variation nulle (0) sur le classement officiel.'
                              : opponentEloUnknown
                              ? 'Adversaire non classé (?) : aucune variation Elo FIDE.'
                              : `Formule FIDE : Δ = K(${kFactorUsed}) × (Score(${myScore}) - P_e(${expectedScore.toFixed(3)}))`}
                          </div>
                        </div>

                        {!isFriendlyMode && !opponentEloUnknown && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isManualEloOverride) {
                                setIsManualEloOverride(false);
                                setManualEloChange('');
                              } else {
                                setIsManualEloOverride(true);
                                setManualEloChange(
                                  computedEloDelta >= 0
                                    ? `+${computedEloDelta.toFixed(1)}`
                                    : computedEloDelta.toFixed(1)
                                );
                              }
                            }}
                            className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                          >
                            {isManualEloOverride
                              ? 'Calcul auto FIDE'
                              : 'Modifier manuellement'}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-slate-600 font-semibold">
                          Variation enregistrée :
                        </span>
                        <div className="flex items-center gap-2">
                          {isManualEloOverride ? (
                            <input
                              type="text"
                              value={manualEloChange}
                              onChange={(e) => setManualEloChange(e.target.value)}
                              placeholder="+5.0 ou -3.2"
                              className="w-28 px-2.5 py-1 text-center font-mono font-bold text-sm border-2 border-indigo-400 rounded-lg bg-white"
                            />
                          ) : (
                            <span
                              className={`font-mono text-base font-bold px-3 py-1 rounded-lg ${
                                effectiveEloDelta >= 0
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-900 border border-rose-300'
                              }`}
                            >
                              {effectiveEloDelta >= 0
                                ? `+${effectiveEloDelta.toFixed(1)}`
                                : effectiveEloDelta.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ouverture */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block font-semibold text-slate-800 mb-1">
                          Catalogue des ouvertures (ECO)
                        </label>
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
                          className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                        >
                          <option value="">-- Préréglages ECO rapides --</option>
                          {ECO_OPENINGS_CATALOG.map((o) => (
                            <option key={o.eco} value={o.eco}>
                              {o.eco} - {o.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-800 mb-1">
                          Nom de l'ouverture
                        </label>
                        <input
                          type="text"
                          value={openingName}
                          onChange={(e) => setOpeningName(e.target.value)}
                          placeholder="Ex: Défense Sicilienne, Najdorf"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 4 : PGN, CHESS.COM, NOTES & RÉCAPITULATIF FINAL */}
              {modalStep === 4 && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      4. PGN, analyse & Récapitulatif
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-slate-800">
                            PGN de la partie (copier/coller)
                          </label>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const text = await navigator.clipboard?.readText();
                                if (text) setPgn(text);
                              } catch {}
                            }}
                            className="text-[10px] font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer"
                          >
                            Coller depuis presse-papier
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={pgn}
                          onChange={(e) => setPgn(e.target.value)}
                          placeholder="1. e4 c5 2. Nf3 d6 3. d4 cxd4..."
                          className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-800 mb-1">
                          Notes personnelles / Moments clés
                        </label>
                        <textarea
                          rows={3}
                          value={keyMomentNote}
                          onChange={(e) => setKeyMomentNote(e.target.value)}
                          placeholder="Idées d'ouverture, tactiques manquées, finales..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-slate-800">
                            Lien d'analyse Chess.com (facultatif)
                          </label>
                          {chessComUrl && (
                            <a
                              href={chessComUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              Tester le lien <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <input
                          type="url"
                          value={chessComUrl}
                          onChange={(e) => setChessComUrl(e.target.value)}
                          placeholder="https://www.chess.com/analysis/..."
                          className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Grande fiche récapitulative de confirmation */}
                  <div className="p-4 bg-slate-900 text-white rounded-xl shadow-md space-y-3">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Récapitulatif de la partie avant enregistrement
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-bold flex items-center gap-2">
                          <span className="text-lg">
                            {playerColor === 'White' ? '♔ Blancs' : '♚ Noirs'}
                          </span>
                          <span>vs</span>
                          <span className="text-amber-300">
                            {opponentTitle !== 'None' ? `[${opponentTitle}] ` : ''}
                            {formatPlayerNameLastFirst(
                              opponentName || (opponentNameUncertain ? 'INCONNU' : 'Adversaire')
                            )}
                          </span>
                          {opponentNameUncertain && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded font-mono">
                              ?
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          {tournamentId === FREE_GAME_TOURNAMENT_ID
                            ? 'Partie libre'
                            : tournaments.find((t) => t.id === tournamentId)?.name || 'Tournoi'}{' '}
                          · Ronde {round} · Cadence {timeControl} · {datePlayed}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <span
                          className={`px-3 py-1 rounded-lg text-sm font-bold ${
                            myScore === 1
                              ? 'bg-emerald-500 text-slate-950'
                              : myScore === 0.5
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-rose-500 text-white'
                          }`}
                        >
                          {myScore === 1 ? '1 Victoire' : myScore === 0.5 ? '1/2 Nulle' : '0 Défaite'}
                        </span>

                        {!isFriendlyMode && (
                          <span
                            className={`px-2.5 py-1 rounded-lg text-sm font-bold ${
                              effectiveEloDelta >= 0
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : 'bg-rose-950 text-rose-300 border border-rose-700'
                            }`}
                          >
                            {effectiveEloDelta >= 0
                              ? `+${effectiveEloDelta.toFixed(1)}`
                              : effectiveEloDelta.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Barre de navigation Stepper */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Annuler
                </button>

                <div className="flex items-center gap-2">
                  {modalStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setModalStep((s) => (s - 1) as 1 | 2 | 3)}
                      className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      ← Précédent
                    </button>
                  )}

                  {modalStep < 4 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (modalStep === 2 && !opponentName.trim() && !opponentNameUncertain) {
                          alert("Veuillez renseigner le nom de l'adversaire ou cocher Nom incertain (?).");
                          return;
                        }
                        setModalStep((s) => (s + 1) as 2 | 3 | 4);
                      }}
                      className="px-5 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      Suivant →
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting || !canConfirmSave}
                      onClick={() => handleSubmit()}
                      className="px-6 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {isSubmitting ? 'Enregistrement...' : '✓ Confirmer & Enregistrer'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION DE SUPPRESSION D'UNE PARTIE (3 secondes) */}
      <ConfirmDeleteModal
        isOpen={Boolean(gameToDelete)}
        title="Supprimer cette partie ?"
        subtitle="Vous êtes sur le point de supprimer définitivement cette partie de votre historique."
        itemName={
          gameToDelete
            ? `Contre ${formatPlayerNameLastFirst(
                gameToDelete.opponentName,
                gameToDelete.opponentNameUncertain
              )}`
            : ''
        }
        details={
          gameToDelete
            ? [
                {
                  label: 'Cadre / Tournoi',
                  value:
                    gameToDelete.tournamentId === FREE_GAME_TOURNAMENT_ID
                      ? FREE_GAME_TOURNAMENT_NAME
                      : gameToDelete.tournamentName,
                },
                {
                  label: 'Date',
                  value: gameToDelete.datePlayed,
                },
                {
                  label: 'Mon résultat',
                  value:
                    gameToDelete.playerScore === 1
                      ? 'Victoire (1 pt)'
                      : gameToDelete.playerScore === 0.5
                      ? 'Nulle (½ pt)'
                      : 'Défaite (0 pt)',
                },
              ]
            : []
        }
        onCancel={() => setGameToDelete(null)}
        onConfirm={async () => {
          if (!gameToDelete) return;
          if (inspectedGame?.id === gameToDelete.id) {
            onSetInspectedGame(null);
          }
          await onDeleteGame(gameToDelete.id);
          setGameToDelete(null);
        }}
      />
    </div>
  );
};
