import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Plus,
  Search,
  Trash2,
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsModalOpen(true);
  };

  const computedResult = useMemo(
    () => getResultFromPlayerScore(myScore, playerColor),
    [myScore, playerColor]
  );

  const computedEloDelta = useMemo(() => {
    if (isFriendlyMode || opponentEloUnknown) return 0;
    return calculateFideEloChange(
      playerElo,
      opponentElo,
      myScore,
      kFactorUsed
    );
  }, [isFriendlyMode, opponentEloUnknown, playerElo, opponentElo, myScore, kFactorUsed]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          eloChange: isFriendlyMode || opponentEloUnknown ? 0 : computedEloDelta,
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectTournamentFilter('')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              selectedTournamentFilter === ''
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Toutes les parties ({games.length})
          </button>

          {(isFriendlyMode || freeGamesCount > 0) && (
            <button
              type="button"
              onClick={() =>
                onSelectTournamentFilter(FREE_GAME_TOURNAMENT_ID)
              }
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                selectedTournamentFilter === FREE_GAME_TOURNAMENT_ID
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Parties libres / Hors tournoi ({freeGamesCount})
            </button>
          )}

          {tournaments.map((t) => {
            const count = games.filter((g) => g.tournamentId === t.id).length;
            const active = selectedTournamentFilter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTournamentFilter(t.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors text-left cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.name}{' '}
                <span
                  className={
                    active
                      ? 'text-slate-300 font-mono'
                      : 'text-slate-500 font-mono'
                  }
                >
                  ({count})
                </span>
              </button>
            );
          })}
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

      {/* Modal Ajouter / Modifier une Partie */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingGameId ? 'Modifier la partie' : 'Ajouter une partie'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isFriendlyMode
                    ? 'Partie amicale libre ou rattachée à une session (aucun gain/perte d’Elo).'
                    : 'Renseignez les détails de la ronde. Vous pouvez cocher « ? » si le nom ou l’Elo adverse est incertain.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cadre / Tournoi
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={FREE_GAME_TOURNAMENT_ID}>
                      Partie libre (Hors tournoi / Sans tournoi)
                    </option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.timeControl})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    <option value="Standard">Classique</option>
                    <option value="Rapid">Rapide</option>
                    <option value="Blitz">Blitz</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={datePlayed}
                    onChange={(e) => setDatePlayed(e.target.value)}
                    className="w-full px-2.5 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Adversaire avec sélection A-Z et options "?" pour Nom et Elo */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-slate-600" />
                    Adversaire affronté
                  </span>
                  {sortedOpponents.length > 0 && (
                    <select
                      value={opponentId}
                      onChange={(e) => {
                        const found = opponents.find(
                          (o) => o.id === e.target.value
                        );
                        if (found) linkOpponentFields(found);
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-slate-900"
                    >
                      <option value="">
                        -- Sélectionner un joueur déjà affronté (A → Z) --
                      </option>
                      {sortedOpponents.map((o) => (
                        <option key={o.id} value={o.id}>
                          {formatPlayerNameLastFirst(
                            o.name,
                            o.isNameUncertain
                          )}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">
                        NOM, Prénom de l’adversaire
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setOpponentNameUncertain(!opponentNameUncertain)
                        }
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                          opponentNameUncertain
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                        title="Ajouter un point d'interrogation (?) à côté du nom si vous n'êtes pas sûr"
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
                              stripQuestionMarkFromName(
                                o.name
                              ).toLowerCase() ===
                              stripQuestionMarkFromName(
                                e.target.value
                              ).toLowerCase()
                          );
                          if (m) linkOpponentFields(m);
                        }}
                        placeholder={
                          opponentNameUncertain
                            ? 'Ex: DUBOIS ? (ou laisser vide si inconnu)'
                            : 'Ex: VANDENBERGHE, Lucas'
                        }
                        required={!opponentNameUncertain}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                      />
                      {opponentNameUncertain && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-amber-700">
                          ?
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ID FIDE
                    </label>
                    <input
                      type="text"
                      value={opponentFideId}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '');
                        setOpponentFideId(clean);
                        const m = opponents.find(
                          (o) => o.fideId === clean && clean.length >= 4
                        );
                        if (m) linkOpponentFields(m);
                      }}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ID FFE
                    </label>
                    <input
                      type="text"
                      value={opponentFfeId}
                      onChange={(e) => {
                        const clean = e.target.value.toUpperCase().trim();
                        setOpponentFfeId(clean);
                        const m = opponents.find(
                          (o) =>
                            o.ffeId.toUpperCase() === clean &&
                            clean.length >= 3
                        );
                        if (m) linkOpponentFields(m);
                      }}
                      className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">
                        Elo Adverse
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setOpponentEloUnknown(!opponentEloUnknown)
                        }
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                          opponentEloUnknown
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                        title="Indiquer '?' si vous ne connaissez pas son Elo"
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
                        onChange={(e) =>
                          setOpponentElo(Number(e.target.value))
                        }
                        required
                        className="w-full px-3 py-2 font-mono font-semibold bg-white border border-slate-300 rounded-lg"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Titre FIDE
                    </label>
                    <select
                      value={opponentTitle}
                      onChange={(e) =>
                        setOpponentTitle(e.target.value as FideTitle)
                      }
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg"
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
                      onChange={(e) =>
                        setPlayerColor(e.target.value as PlayerColor)
                      }
                      className="w-full px-3 py-2 font-semibold bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="White">Blancs</option>
                      <option value="Black">Noirs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {tournamentId === FREE_GAME_TOURNAMENT_ID
                        ? 'N° Partie'
                        : 'Ronde n°'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={round}
                      onChange={(e) => setRound(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono font-semibold bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* MON SCORE (Toujours par rapport à moi : 3 boutons Victoire / Nulle / Défaite) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-900 text-xs">
                    Mon résultat (par rapport à moi) *
                  </label>
                  {!isFriendlyMode && (
                    <span className="font-mono text-xs font-semibold">
                      Variation Elo :{' '}
                      {opponentEloUnknown ? (
                        <span className="text-slate-500">
                          Non calculée (Elo adverse ?)
                        </span>
                      ) : (
                        <span
                          className={
                            computedEloDelta >= 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }
                        >
                          {computedEloDelta >= 0
                            ? `+${computedEloDelta.toFixed(1)}`
                            : computedEloDelta.toFixed(1)}{' '}
                          pts
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setMyScore(1)}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-xs border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      myScore === 1
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    1 · Victoire
                  </button>

                  <button
                    type="button"
                    onClick={() => setMyScore(0.5)}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-xs border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      myScore === 0.5
                        ? 'bg-amber-600 text-white border-amber-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    2 · Nulle
                  </button>

                  <button
                    type="button"
                    onClick={() => setMyScore(0)}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-xs border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      myScore === 0
                        ? 'bg-rose-700 text-white border-rose-800'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    3 · Défaite
                  </button>
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
                      className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-300 rounded-lg"
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
                      className="w-1/2 px-3 py-2 border border-slate-300 rounded-lg"
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
                    placeholder="https://www.chess.com/analysis/..."
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Texte PGN à copier/coller (Facultatif)
                  </label>
                  <textarea
                    rows={3}
                    value={pgn}
                    onChange={(e) => setPgn(e.target.value)}
                    placeholder="1. e4 c5 2. Nf3 d6..."
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer la partie'}
                </button>
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
