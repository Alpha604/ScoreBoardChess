import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
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
  Unlink,
  UserCheck,
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
import { POPULAR_FEDERATIONS } from '../utils/federationFlags';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { FederationFlag } from './FederationFlag';
import { IconButton } from './IconButton';

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
  const [stepError, setStepError] = useState<string | null>(null);

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

  const inputClass =
    'w-full px-3 py-2 text-xs bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder-[#6C788B] focus:outline-none focus:border-emerald-500 transition-colors';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 border-b border-[#232C3A] pb-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-[#F1F4F8]">
            {isFriendlyMode ? 'Parties Amicales' : 'Registre des Parties'}
          </h1>
          <p className="text-xs text-[#9BA7B8] mt-1">
            {isFriendlyMode
              ? 'Parties libres (hors tournoi) ou rattachées à une session amicale, sans variation Elo.'
              : 'Historique de vos rondes homologuées et notation PGN copiable.'}
          </p>
        </div>

        <IconButton
          variant="primary"
          size="lg"
          label={
            isFriendlyMode
              ? 'Ajouter une partie amicale'
              : 'Ajouter une nouvelle partie'
          }
          onClick={() => {
            setStepError(null);
            openNewGameModal();
          }}
        >
          <Plus className="w-5 h-5" />
        </IconButton>
      </div>

      {/* Filtre par tournoi / parties libres */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#9BA7B8]">
            Filtrer par cadre ou tournoi
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#6C788B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Adversaire, ouverture, ID..."
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <select
              value={selectedTournamentFilter}
              onChange={(e) => onSelectTournamentFilter(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">
                Toutes les parties enregistrées ({games.length})
              </option>
              {(isFriendlyMode || freeGamesCount > 0) && (
                <option value={FREE_GAME_TOURNAMENT_ID}>
                  Parties libres / Hors tournoi ({freeGamesCount})
                </option>
              )}
              {chronologicallySortedTournaments.map((t) => {
                const count = games.filter((g) => g.tournamentId === t.id).length;
                return (
                  <option key={t.id} value={t.id}>
                    [{t.startDate}] · {t.name} ({count} partie{count > 1 ? 's' : ''} · {t.timeControl})
                  </option>
                );
              })}
            </select>
          </div>

          {selectedTournamentFilter && (
            <IconButton
              variant="danger"
              size="md"
              label="Réinitialiser le filtre"
              onClick={() => onSelectTournamentFilter('')}
            >
              <RotateCcw className="w-4 h-4" />
            </IconButton>
          )}
        </div>

        {/* Résumé */}
        <div className="pt-3 border-t border-[#232C3A] flex flex-wrap items-center justify-between gap-4 text-xs text-[#9BA7B8]">
          <div>
            {selectedTournamentFilter === FREE_GAME_TOURNAMENT_ID ? (
              <span>
                Sélection :{' '}
                <strong className="text-[#F1F4F8]">
                  Parties libres (Hors tournoi)
                </strong>
              </span>
            ) : activeTournament ? (
              <span>
                Sélection :{' '}
                <strong className="text-[#F1F4F8]">
                  {activeTournament.name}
                </strong>{' '}
                ({activeTournament.location})
              </span>
            ) : (
              <span>Ensemble des parties enregistrées</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-[#CBD5E1]">
            <span>
              Score :{' '}
              <strong className="text-[#F1F4F8]">
                {summary.score} / {summary.count}
              </strong>
            </span>
            {!isFriendlyMode && (
              <>
                <span className="text-[#475569]" aria-hidden="true">
                  ·
                </span>
                <span>
                  Performance :{' '}
                  <strong className="text-[#D4A853]">
                    {summary.perf || '—'}
                  </strong>
                </span>
                <span className="text-[#475569]" aria-hidden="true">
                  ·
                </span>
                <span>
                  Bilan Elo :{' '}
                  <strong
                    className={
                      summary.netElo >= 0 ? 'text-emerald-400' : 'text-rose-400'
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

      {/* Tableau des Parties */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
        {filteredGames.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <Swords className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
            <p className="text-sm font-semibold text-[#F1F4F8]">
              Aucune partie enregistrée pour cette sélection.
            </p>
            <div className="flex justify-center">
              <IconButton
                variant="primary"
                size="lg"
                label="Ajouter une partie"
                onClick={() => {
                  setStepError(null);
                  openNewGameModal();
                }}
              >
                <Plus className="w-5 h-5" />
              </IconButton>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232C3A] bg-[#19202B]/70 text-[11px] font-bold uppercase tracking-wider text-[#9BA7B8]">
                  <th className="py-3 px-4">Date & Ronde</th>
                  <th className="py-3 px-4">Adversaire</th>
                  <th className="py-3 px-4 text-right">Elo Adv.</th>
                  <th className="py-3 px-4">Couleur</th>
                  <th className="py-3 px-4 text-center">Résultat</th>
                  {!isFriendlyMode && (
                    <th className="py-3 px-4 text-right">Variation</th>
                  )}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232C3A] text-xs">
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
                      className="cursor-pointer transition-colors hover:bg-[#19202B]"
                    >
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <div className="font-semibold text-[#F1F4F8]">
                          {g.datePlayed}
                        </div>
                        <div className="text-[11px] text-[#6C788B]">
                          {isFree ? 'Partie libre' : `Ronde ${g.round}`} ·{' '}
                          {g.timeControl === 'Standard'
                            ? 'Classique'
                            : g.timeControl === 'Rapid'
                            ? 'Rapide'
                            : 'Blitz'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#F1F4F8] flex items-center gap-2">
                          <FederationFlag
                            code={g.opponentFederation || 'FRA'}
                            size="xs"
                          />
                          {g.opponentTitle !== 'None' && (
                            <span className="font-mono text-[10px] font-bold text-[#D4A853]">
                              {g.opponentTitle}
                            </span>
                          )}
                          <span>{displayOppName}</span>
                        </div>
                        <div className="text-[11px] text-[#6C788B] mt-0.5">
                          {isFree
                            ? FREE_GAME_TOURNAMENT_NAME
                            : g.tournamentName}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#F1F4F8]">
                        {displayOppElo === '?' ? (
                          <span className="text-[#D4A853]">?</span>
                        ) : (
                          displayOppElo
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-[#CBD5E1]">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-xs border ${
                              g.playerColor === 'White'
                                ? 'bg-[#F1F4F8] border-[#CBD5E1]'
                                : 'bg-[#0B0E12] border-[#475569]'
                            }`}
                          />
                          {g.playerColor === 'White' ? 'Blancs' : 'Noirs'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        <span
                          className={
                            g.playerScore === 1
                              ? 'text-emerald-400'
                              : g.playerScore === 0
                              ? 'text-rose-400'
                              : 'text-[#D4A853]'
                          }
                        >
                          {g.playerScore === 1
                            ? '1 · Victoire'
                            : g.playerScore === 0.5
                            ? '½ · Nulle'
                            : '0 · Défaite'}
                        </span>
                      </td>

                      {!isFriendlyMode && (
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                          {g.opponentEloUnknown || g.opponentElo <= 0 ? (
                            <span className="text-[#6C788B]">—</span>
                          ) : (
                            <span
                              className={
                                g.eloChange >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
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
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <IconButton
                            variant="surface"
                            size="sm"
                            label="Infos & Notation PGN"
                            onClick={() => onSetInspectedGame(g)}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </IconButton>

                          <IconButton
                            variant="ghost"
                            size="sm"
                            label="Modifier la partie"
                            onClick={() => {
                              setStepError(null);
                              openEditGameModal(g);
                            }}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </IconButton>

                          <IconButton
                            variant="danger"
                            size="sm"
                            label="Supprimer la partie"
                            onClick={() => setGameToDelete(g)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
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

      {/* MODALE DÉTAILS DE LA PARTIE & NOTATION PGN COPIABLE */}
      {inspectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#131820] border border-[#2B3647] rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#232C3A] pb-4">
              <div>
                <div className="text-xs font-mono text-[#9BA7B8]">
                  {inspectedGame.tournamentId === FREE_GAME_TOURNAMENT_ID
                    ? FREE_GAME_TOURNAMENT_NAME
                    : `${inspectedGame.tournamentName} · Ronde ${inspectedGame.round}`}{' '}
                  · {inspectedGame.datePlayed}
                </div>
                <h2 className="font-display text-xl font-bold text-[#F1F4F8] mt-1 flex items-center gap-2 flex-wrap">
                  <FederationFlag
                    code={inspectedGame.opponentFederation || 'FRA'}
                    size="sm"
                  />
                  <span>
                    Contre{' '}
                    {formatPlayerNameLastFirst(
                      inspectedGame.opponentName,
                      inspectedGame.opponentNameUncertain
                    )}{' '}
                    (
                    {formatEloDisplay(
                      inspectedGame.opponentElo,
                      inspectedGame.opponentEloUnknown
                    )}
                    )
                  </span>
                </h2>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <IconButton
                  variant="surface"
                  size="md"
                  label="Modifier la partie"
                  onClick={() => {
                    const g = inspectedGame;
                    onSetInspectedGame(null);
                    setStepError(null);
                    openEditGameModal(g);
                  }}
                >
                  <Edit3 className="w-4 h-4" />
                </IconButton>
                <IconButton
                  variant="danger"
                  size="md"
                  label="Supprimer la partie"
                  onClick={() => setGameToDelete(inspectedGame)}
                >
                  <Trash2 className="w-4 h-4" />
                </IconButton>
                <IconButton
                  variant="ghost"
                  size="md"
                  label="Fermer"
                  onClick={() => onSetInspectedGame(null)}
                >
                  <X className="w-5 h-5" />
                </IconButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Colonne gauche */}
              <div className="md:col-span-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#19202B] border border-[#263142] rounded-xl">
                    <div className="text-[#9BA7B8] font-medium">Résultat</div>
                    <div
                      className={`text-sm font-mono font-bold mt-0.5 ${
                        inspectedGame.playerScore === 1
                          ? 'text-emerald-400'
                          : inspectedGame.playerScore === 0
                          ? 'text-rose-400'
                          : 'text-[#D4A853]'
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
                    <div className="p-3 bg-[#19202B] border border-[#263142] rounded-xl">
                      <div className="text-[#9BA7B8] font-medium">
                        Elo (K={inspectedGame.kFactorUsed})
                      </div>
                      <div
                        className={`text-sm font-mono font-bold mt-0.5 ${
                          inspectedGame.opponentEloUnknown ||
                          inspectedGame.opponentElo <= 0
                            ? 'text-[#6C788B]'
                            : inspectedGame.eloChange >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {inspectedGame.opponentEloUnknown ||
                        inspectedGame.opponentElo <= 0
                          ? 'Non calculé'
                          : `${
                              inspectedGame.eloChange >= 0
                                ? `+${inspectedGame.eloChange.toFixed(1)}`
                                : inspectedGame.eloChange.toFixed(1)
                            } pts`}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-[#19202B] border border-[#263142] rounded-xl">
                      <div className="text-[#9BA7B8] font-medium">Cadre</div>
                      <div className="text-sm font-semibold text-[#F1F4F8] mt-0.5">
                        Amical
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-[#19202B] border border-[#263142] rounded-xl">
                    <div className="text-[#9BA7B8] font-medium">Couleur</div>
                    <div className="font-mono font-semibold text-[#F1F4F8] mt-0.5">
                      {inspectedGame.playerColor === 'White'
                        ? 'Blancs'
                        : 'Noirs'}
                    </div>
                  </div>

                  <div className="p-3 bg-[#19202B] border border-[#263142] rounded-xl">
                    <div className="text-[#9BA7B8] font-medium">Cadence</div>
                    <div className="font-mono font-semibold text-[#F1F4F8] mt-0.5">
                      {inspectedGame.timeControl === 'Standard'
                        ? 'Classique'
                        : inspectedGame.timeControl === 'Rapid'
                        ? 'Rapide'
                        : 'Blitz'}
                    </div>
                  </div>
                </div>

                {/* Infos adversaire */}
                <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl space-y-2 text-xs">
                  <div className="font-semibold text-[#F1F4F8]">Adversaire</div>
                  <div className="space-y-1 text-[#9BA7B8] font-mono">
                    <div>
                      Nom :{' '}
                      <strong className="text-[#F1F4F8]">
                        {formatPlayerNameLastFirst(
                          inspectedGame.opponentName,
                          inspectedGame.opponentNameUncertain
                        )}
                      </strong>
                    </div>
                    <div>
                      Elo :{' '}
                      <strong className="text-[#F1F4F8]">
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
                    <div className="flex items-center gap-1.5">
                      <span>Fédération :</span>
                      <FederationFlag
                        code={inspectedGame.opponentFederation || 'FRA'}
                        size="xs"
                        showCode
                        showName
                      />
                    </div>
                  </div>
                  {findOpponentRecordId(inspectedGame) && (
                    <div className="pt-1">
                      <IconButton
                        variant="surface"
                        size="sm"
                        label="Ouvrir la fiche du joueur"
                        onClick={() => {
                          const oppId = findOpponentRecordId(inspectedGame);
                          if (oppId) {
                            onSetInspectedGame(null);
                            onSelectOpponentProfile(oppId);
                          }
                        }}
                      >
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </IconButton>
                    </div>
                  )}
                </div>

                {inspectedGame.openingName && (
                  <div className="p-3 bg-[#19202B] border border-[#263142] rounded-xl text-xs">
                    <div className="font-medium text-[#9BA7B8]">Ouverture</div>
                    <div className="font-semibold text-[#F1F4F8] mt-0.5">
                      {inspectedGame.ecoCode
                        ? `${inspectedGame.ecoCode} — `
                        : ''}
                      {inspectedGame.openingName}
                    </div>
                  </div>
                )}

                {inspectedGame.keyMomentNote && (
                  <div className="p-3 bg-[#19202B] border border-[#263142] rounded-xl text-xs text-[#CBD5E1] leading-relaxed">
                    <div className="font-semibold text-[#F1F4F8] mb-1">
                      Notes personnelles
                    </div>
                    {inspectedGame.keyMomentNote}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <IconButton
                    variant="gold"
                    size="md"
                    label="Ouvrir l’analyse sur Chess.com"
                    onClick={() => handleAnalyzeOnChessCom(inspectedGame)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </IconButton>
                  <span className="text-xs text-[#9BA7B8]">
                    Analyser sur Chess.com
                  </span>
                </div>
              </div>

              {/* Colonne droite : Texte PGN */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[#F1F4F8] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#D4A853]" />
                    Notation PGN
                  </div>
                  {inspectedGame.pgn && (
                    <IconButton
                      variant={
                        copiedPgnId === inspectedGame.id ? 'primary' : 'surface'
                      }
                      size="sm"
                      label={
                        copiedPgnId === inspectedGame.id
                          ? 'PGN copié !'
                          : 'Copier le PGN'
                      }
                      onClick={() => handleCopyPgnOnly(inspectedGame)}
                    >
                      {copiedPgnId === inspectedGame.id ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </IconButton>
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
                      className="w-full p-4 bg-[#19202B] border border-[#2B3647] rounded-xl font-mono text-xs text-[#F1F4F8] leading-relaxed focus:outline-none focus:border-emerald-500 select-all"
                    />
                    <p className="text-[11px] text-[#6C788B]">
                      Cliquez dans la zone ou sur l’icône de copie pour copier l’intégralité des coups.
                    </p>
                  </div>
                ) : (
                  <div className="p-8 bg-[#19202B]/50 border border-dashed border-[#323E52] rounded-xl text-center space-y-3">
                    <p className="text-sm font-semibold text-[#CBD5E1]">
                      Aucun PGN enregistré
                    </p>
                    <p className="text-xs text-[#6C788B]">
                      Ajoutez le PGN de votre partie en modifiant cette fiche.
                    </p>
                    <div className="flex justify-center">
                      <IconButton
                        variant="surface"
                        size="md"
                        label="Coller un PGN pour cette partie"
                        onClick={() => {
                          const g = inspectedGame;
                          onSetInspectedGame(null);
                          setStepError(null);
                          openEditGameModal(g);
                        }}
                      >
                        <Edit3 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRÉATION / ÉDITION D'UNE PARTIE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#131820] border border-[#2B3647] rounded-2xl max-w-3xl w-full p-6 sm:p-7 space-y-6 max-h-[94vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#232C3A] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono text-[#9BA7B8]">
                  <span className="text-emerald-400 font-semibold">
                    {isFriendlyMode ? 'Partie Amicale' : 'Partie FIDE'}
                  </span>
                  <span className="text-[#475569]">·</span>
                  <span>
                    K={kFactorUsed} · Elo {playerElo}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold tracking-tight text-[#F1F4F8]">
                  {editingGameId
                    ? 'Modifier la partie'
                    : 'Enregistrer une nouvelle partie'}
                </h2>
                <p className="text-xs text-[#9BA7B8]">
                  Étape {modalStep} sur 4 · Validation manuelle à la fin
                </p>
              </div>
              <IconButton
                variant="ghost"
                size="sm"
                label="Fermer"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </IconButton>
            </div>

            {/* Stepper 4 étapes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { step: 1, title: 'Cadre & Cadence', unlocked: true },
                { step: 2, title: 'Adversaire', unlocked: true },
                {
                  step: 3,
                  title: 'Résultat & Elo',
                  unlocked: Boolean(opponentName.trim() || opponentNameUncertain),
                },
                {
                  step: 4,
                  title: 'Vérification',
                  unlocked: Boolean(opponentName.trim() || opponentNameUncertain),
                },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => {
                    if (s.unlocked) {
                      setStepError(null);
                      setModalStep(s.step as 1 | 2 | 3 | 4);
                    }
                  }}
                  className={`py-2 px-3 rounded-xl text-left border transition-all cursor-pointer ${
                    modalStep === s.step
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/50'
                      : modalStep > s.step
                      ? 'bg-[#19202B] text-[#CBD5E1] border-[#323E52]'
                      : 'bg-[#0F131A] text-[#6C788B] border-[#232C3A]'
                  }`}
                >
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                    Étape {s.step}
                  </div>
                  <div className="text-xs font-semibold truncate">{s.title}</div>
                </button>
              ))}
            </div>

            {stepError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {stepError}
              </div>
            )}

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
                <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-[#D4A853]" />
                    1. Cadre du match, date & cadence
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Tournoi ou Session
                      </label>
                      <select
                        value={tournamentId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setTournamentId(nextId);
                          const chosenTourney = tournaments.find(
                            (t) => t.id === nextId
                          );
                          if (chosenTourney) {
                            setTimeControl(chosenTourney.timeControl);
                          }
                          const chosenOp = opponents.find(
                            (o) => o.id === opponentId
                          );
                          if (chosenOp) {
                            linkOpponentFields(
                              chosenOp,
                              nextId,
                              chosenTourney?.timeControl || timeControl
                            );
                          }
                        }}
                        className={`${inputClass} bg-[#131820]`}
                      >
                        <option value={FREE_GAME_TOURNAMENT_ID}>
                          Partie libre (Hors tournoi)
                        </option>
                        {chronologicallySortedTournaments.map((t) => (
                          <option key={t.id} value={t.id}>
                            [{t.startDate}] {t.name} ({t.timeControl})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
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
                          const chosenOp = opponents.find(
                            (o) => o.id === opponentId
                          );
                          if (chosenOp) {
                            linkOpponentFields(chosenOp, tournamentId, nextTc);
                          }
                        }}
                        className={`${inputClass} bg-[#131820] disabled:opacity-50`}
                      >
                        <option value="Standard">Classique (Standard)</option>
                        <option value="Rapid">Rapide</option>
                        <option value="Blitz">Blitz</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Date jouée
                      </label>
                      <input
                        type="date"
                        value={datePlayed}
                        onChange={(e) => setDatePlayed(e.target.value)}
                        className={`${inputClass} bg-[#131820] font-mono`}
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
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
                        className={`${inputClass} bg-[#131820] font-mono font-bold`}
                      />
                    </div>

                    <div className="sm:col-span-8">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Mon Elo lors de la partie
                      </label>
                      <input
                        type="number"
                        min={600}
                        max={3500}
                        value={playerElo}
                        onChange={(e) => setPlayerElo(Number(e.target.value))}
                        className={`${inputClass} bg-[#131820] font-mono font-bold`}
                      />
                    </div>

                    <div className="sm:col-span-12 pt-1">
                      <label className="block font-semibold text-[#9BA7B8] mb-1.5">
                        Ma couleur de pièces
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPlayerColor('White')}
                          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border font-bold transition-all cursor-pointer ${
                            playerColor === 'White'
                              ? 'bg-[#F1F4F8] text-[#0B0E12] border-white'
                              : 'bg-[#131820] text-[#9BA7B8] border-[#2B3647] hover:text-white'
                          }`}
                        >
                          <span className="text-xl leading-none">♔</span>
                          <span className="text-sm">Blancs</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPlayerColor('Black')}
                          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border font-bold transition-all cursor-pointer ${
                            playerColor === 'Black'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                              : 'bg-[#131820] text-[#9BA7B8] border-[#2B3647] hover:text-white'
                          }`}
                        >
                          <span className="text-xl leading-none">♚</span>
                          <span className="text-sm">Noirs</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2 : ADVERSAIRE & SES INFOS */}
              {modalStep === 2 && (
                <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      2. Adversaire & Fédération
                    </div>
                    {opponentId && (
                      <IconButton
                        variant="danger"
                        size="xs"
                        label="Délier ce joueur"
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
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </IconButton>
                    )}
                  </div>

                  {sortedOpponents.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-[#9BA7B8] mb-1">
                        Choisir parmi vos adversaires enregistrés (A → Z)
                      </label>
                      <select
                        value={opponentId}
                        onChange={(e) => {
                          const found = opponents.find(
                            (o) => o.id === e.target.value
                          );
                          if (found) {
                            linkOpponentFields(found);
                          } else {
                            setOpponentId('');
                          }
                        }}
                        className={`${inputClass} bg-[#131820]`}
                      >
                        <option value="">
                          -- Sélectionner un joueur existant --
                        </option>
                        {sortedOpponents.map((o) => (
                          <option key={o.id} value={o.id}>
                            {formatPlayerNameLastFirst(
                              o.name,
                              o.isNameUncertain
                            )}{' '}
                            (Std:{' '}
                            {o.isStandardEloUnknown
                              ? '?'
                              : o.standardElo || o.elo}
                            )
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                    <div className="sm:col-span-6">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-[#9BA7B8]">
                          NOM, Prénom *
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setOpponentNameUncertain(!opponentNameUncertain)
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                            opponentNameUncertain
                              ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/50'
                              : 'bg-[#131820] text-[#9BA7B8] border-[#2B3647]'
                          }`}
                        >
                          <HelpCircle className="w-3 h-3" />?
                        </button>
                      </div>
                      <input
                        type="text"
                        value={opponentName}
                        onChange={(e) => {
                          setOpponentName(e.target.value);
                          setStepError(null);
                          const m = opponents.find(
                            (o) =>
                              stripQuestionMarkFromName(o.name).toLowerCase() ===
                              stripQuestionMarkFromName(
                                e.target.value
                              ).toLowerCase()
                          );
                          if (m) linkOpponentFields(m);
                        }}
                        placeholder="Ex: VANDENBERGHE, Lucas"
                        required={!opponentNameUncertain}
                        className={`${inputClass} bg-[#131820]`}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-[#9BA7B8]">
                          Son Elo
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setOpponentEloUnknown(!opponentEloUnknown)
                          }
                          className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            opponentEloUnknown
                              ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/50'
                              : 'bg-[#131820] text-[#9BA7B8] border-[#2B3647]'
                          }`}
                        >
                          ?
                        </button>
                      </div>
                      {opponentEloUnknown ? (
                        <div className="w-full px-3 py-2 font-mono font-bold bg-[#131820] border border-[#2B3647] text-[#D4A853] rounded-xl text-center">
                          ?
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={600}
                          max={3500}
                          value={opponentElo}
                          onChange={(e) =>
                            setOpponentElo(Number(e.target.value))
                          }
                          required
                          className={`${inputClass} bg-[#131820] font-mono font-bold`}
                        />
                      )}
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Titre FIDE
                      </label>
                      <select
                        value={opponentTitle}
                        onChange={(e) =>
                          setOpponentTitle(e.target.value as FideTitle)
                        }
                        className={`${inputClass} bg-[#131820] font-mono`}
                      >
                        {FIDE_TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t === 'None' ? 'Aucun' : t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        ID FIDE
                      </label>
                      <input
                        type="text"
                        value={opponentFideId}
                        onChange={(e) =>
                          setOpponentFideId(
                            e.target.value.replace(/[^0-9]/g, '')
                          )
                        }
                        placeholder="65104823"
                        className={`${inputClass} bg-[#131820] font-mono`}
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        ID FFE
                      </label>
                      <input
                        type="text"
                        value={opponentFfeId}
                        onChange={(e) =>
                          setOpponentFfeId(e.target.value.toUpperCase())
                        }
                        placeholder="K59412"
                        className={`${inputClass} bg-[#131820] font-mono uppercase`}
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-[#9BA7B8]">
                          Fédération
                        </label>
                        <FederationFlag code={opponentFederation} size="xs" />
                      </div>
                      <input
                        type="text"
                        maxLength={4}
                        value={opponentFederation}
                        onChange={(e) =>
                          setOpponentFederation(e.target.value.toUpperCase())
                        }
                        placeholder="FRA ou FIDE"
                        className={`${inputClass} bg-[#131820] font-mono uppercase`}
                      />
                    </div>
                  </div>

                  {/* Fédérations rapides */}
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold text-[#6C788B] mb-1.5">
                      Fédérations courantes :
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_FEDERATIONS.slice(0, 8).map((fed) => {
                        const active = opponentFederation === fed.code;
                        return (
                          <button
                            key={fed.code}
                            type="button"
                            onClick={() => setOpponentFederation(fed.code)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                              active
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/50'
                                : 'bg-[#131820] text-[#9BA7B8] border-[#2B3647] hover:text-white'
                            }`}
                          >
                            <FederationFlag code={fed.code} size="xs" />
                            <span>{fed.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 : RÉSULTAT, FIN DE PARTIE & VARIATION ELO */}
              {modalStep === 3 && (
                <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    3. Score & Calcul FIDE
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#9BA7B8] mb-2">
                      Résultat de la partie (par rapport à vous) :
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setMyScore(1)}
                        className={`py-3.5 px-4 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                          myScore === 1
                            ? 'bg-emerald-500 text-[#06130E] border-emerald-400'
                            : 'bg-[#131820] text-emerald-400 border-[#2B3647]'
                        }`}
                      >
                        <div className="text-sm font-bold">1 · Victoire</div>
                        <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                          {playerColor === 'White' ? '1-0' : '0-1'}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMyScore(0.5)}
                        className={`py-3.5 px-4 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                          myScore === 0.5
                            ? 'bg-[#D4A853] text-[#141007] border-[#E5C178]'
                            : 'bg-[#131820] text-[#D4A853] border-[#2B3647]'
                        }`}
                      >
                        <div className="text-sm font-bold">½ · Nulle</div>
                        <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                          1/2 - 1/2
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMyScore(0)}
                        className={`py-3.5 px-4 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                          myScore === 0
                            ? 'bg-rose-500 text-white border-rose-400'
                            : 'bg-[#131820] text-rose-400 border-[#2B3647]'
                        }`}
                      >
                        <div className="text-sm font-bold">0 · Défaite</div>
                        <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                          {playerColor === 'White' ? '0-1' : '1-0'}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Bloc calcul Elo */}
                  <div className="p-4 bg-[#131820] border border-[#232C3A] rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#232C3A] pb-2.5">
                      <div>
                        <div className="font-semibold text-[#F1F4F8] text-sm">
                          Variation FIDE calculée
                        </div>
                        <div className="text-[11px] text-[#9BA7B8] font-mono">
                          {isFriendlyMode
                            ? 'Mode amical : variation nulle (0)'
                            : opponentEloUnknown
                            ? 'Adversaire non classé (?) : aucune variation'
                            : `Δ = K(${kFactorUsed}) × (S(${myScore}) - Pe(${expectedScore.toFixed(3)}))`}
                        </div>
                      </div>

                      {!isFriendlyMode && !opponentEloUnknown && (
                        <IconButton
                          variant={isManualEloOverride ? 'gold' : 'surface'}
                          size="sm"
                          label={
                            isManualEloOverride
                              ? 'Revenir au calcul automatique FIDE'
                              : 'Saisir manuellement la variation'
                          }
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
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </IconButton>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-[#9BA7B8] font-semibold">
                        Variation enregistrée :
                      </span>
                      {isManualEloOverride ? (
                        <input
                          type="text"
                          value={manualEloChange}
                          onChange={(e) => setManualEloChange(e.target.value)}
                          placeholder="+5.0 ou -3.2"
                          className="w-28 px-2.5 py-1 text-center font-mono font-bold text-sm border border-[#D4A853] rounded-lg bg-[#19202B] text-[#F1F4F8]"
                        />
                      ) : (
                        <span
                          className={`font-mono text-base font-bold ${
                            effectiveEloDelta >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {effectiveEloDelta >= 0
                            ? `+${effectiveEloDelta.toFixed(1)}`
                            : effectiveEloDelta.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ouverture */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Catalogue ECO
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
                        className={`${inputClass} bg-[#131820]`}
                      >
                        <option value="">-- Préréglages ECO --</option>
                        {ECO_OPENINGS_CATALOG.map((o) => (
                          <option key={o.eco} value={o.eco}>
                            {o.eco} - {o.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Nom de l'ouverture
                      </label>
                      <input
                        type="text"
                        value={openingName}
                        onChange={(e) => setOpeningName(e.target.value)}
                        placeholder="Ex: Défense Sicilienne, Najdorf"
                        className={`${inputClass} bg-[#131820]`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 4 : PGN, CHESS.COM & RÉCAPITULATIF */}
              {modalStep === 4 && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#D4A853]" />
                      4. PGN, analyse & Vérification
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-[#9BA7B8]">
                            PGN de la partie
                          </label>
                          <IconButton
                            variant="ghost"
                            size="xs"
                            label="Coller depuis le presse-papier"
                            onClick={async () => {
                              try {
                                const text =
                                  await navigator.clipboard?.readText();
                                if (text) setPgn(text);
                              } catch {}
                            }}
                          >
                            <ClipboardPaste className="w-3.5 h-3.5" />
                          </IconButton>
                        </div>
                        <textarea
                          rows={3}
                          value={pgn}
                          onChange={(e) => setPgn(e.target.value)}
                          placeholder="1. e4 c5 2. Nf3 d6 3. d4 cxd4..."
                          className={`${inputClass} bg-[#131820] font-mono`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[#9BA7B8] mb-1">
                          Notes personnelles
                        </label>
                        <textarea
                          rows={3}
                          value={keyMomentNote}
                          onChange={(e) => setKeyMomentNote(e.target.value)}
                          placeholder="Idées d'ouverture, tactiques manquées..."
                          className={`${inputClass} bg-[#131820]`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-[#9BA7B8]">
                            Lien d'analyse Chess.com
                          </label>
                          {chessComUrl && (
                            <a
                              href={chessComUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Tester le lien"
                              data-tooltip="Tester le lien"
                              className="text-[#D4A853] hover:text-white inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <input
                          type="url"
                          value={chessComUrl}
                          onChange={(e) => setChessComUrl(e.target.value)}
                          placeholder="https://www.chess.com/analysis/..."
                          className={`${inputClass} bg-[#131820] font-mono`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fiche récapitulative finale */}
                  <div className="p-4 bg-[#0B0E12] border border-[#2B3647] rounded-xl space-y-3">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                      Vérification finale · Aucune sauvegarde automatique
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-bold flex items-center gap-2 text-[#F1F4F8]">
                          <span>
                            {playerColor === 'White' ? '♔ Blancs' : '♚ Noirs'}
                          </span>
                          <span className="text-[#6C788B]">vs</span>
                          <span className="text-[#D4A853] inline-flex items-center gap-1.5">
                            <FederationFlag
                              code={opponentFederation || 'FRA'}
                              size="xs"
                            />
                            <span>
                              {opponentTitle !== 'None'
                                ? `[${opponentTitle}] `
                                : ''}
                              {formatPlayerNameLastFirst(
                                opponentName ||
                                  (opponentNameUncertain
                                    ? 'INCONNU'
                                    : 'Adversaire')
                              )}
                            </span>
                          </span>
                          {opponentNameUncertain && (
                            <span className="text-xs font-mono text-[#D4A853]">
                              (?)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#9BA7B8] mt-1 font-mono">
                          {tournamentId === FREE_GAME_TOURNAMENT_ID
                            ? 'Partie libre'
                            : tournaments.find((t) => t.id === tournamentId)
                                ?.name || 'Tournoi'}{' '}
                          · Ronde {round} · {timeControl} · {datePlayed}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <span
                          className={`text-sm font-bold ${
                            myScore === 1
                              ? 'text-emerald-400'
                              : myScore === 0.5
                              ? 'text-[#D4A853]'
                              : 'text-rose-400'
                          }`}
                        >
                          {myScore === 1
                            ? '1 · Victoire'
                            : myScore === 0.5
                            ? '½ · Nulle'
                            : '0 · Défaite'}
                        </span>

                        {!isFriendlyMode && (
                          <span
                            className={`text-sm font-bold ${
                              effectiveEloDelta >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            ({effectiveEloDelta >= 0
                              ? `+${effectiveEloDelta.toFixed(1)}`
                              : effectiveEloDelta.toFixed(1)}
                            )
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Barre de navigation Stepper (Icônes uniquement) */}
              <div className="flex items-center justify-between pt-4 border-t border-[#232C3A]">
                <div>
                  {modalStep > 1 && (
                    <IconButton
                      variant="surface"
                      size="md"
                      label="Étape précédente"
                      onClick={() => {
                        setStepError(null);
                        setModalStep((s) => (s - 1) as 1 | 2 | 3);
                      }}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </IconButton>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <IconButton
                    variant="ghost"
                    size="md"
                    label="Annuler"
                    onClick={() => setIsModalOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </IconButton>

                  {modalStep < 4 ? (
                    <IconButton
                      variant="surface"
                      size="md"
                      label="Étape suivante"
                      onClick={() => {
                        if (
                          modalStep === 2 &&
                          !opponentName.trim() &&
                          !opponentNameUncertain
                        ) {
                          setStepError(
                            "Veuillez renseigner le nom de l'adversaire ou cocher Nom incertain (?)."
                          );
                          return;
                        }
                        setStepError(null);
                        setModalStep((s) => (s + 1) as 2 | 3 | 4);
                      }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </IconButton>
                  ) : (
                    <IconButton
                      variant="primary"
                      size="lg"
                      label={
                        isSubmitting
                          ? 'Enregistrement en cours...'
                          : 'Confirmer et enregistrer la partie'
                      }
                      disabled={isSubmitting || !canConfirmSave}
                      onClick={() => handleSubmit()}
                    >
                      <Check className="w-5 h-5" />
                    </IconButton>
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
