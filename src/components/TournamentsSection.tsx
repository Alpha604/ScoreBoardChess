import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Edit3,
  ExternalLink,
  FileText,
  Info,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Trophy,
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
  TournamentFormat,
  TournamentStatus,
} from '../types/fide';
import {
  calculateFideEloChange,
  calculateFidePerformanceRating,
} from '../utils/fideMath';
import {
  formatPlayerNameDisplay,
  formatPlayerNameLastFirst,
  hasQuestionMarkName,
} from '../utils/fideValidation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { FederationFlag } from './FederationFlag';
import { IconButton } from './IconButton';

interface TournamentsSectionProps {
  tournaments: Tournament[];
  games: FideGame[];
  opponents: OpponentPlayer[];
  profile: PlayerProfile;
  onSaveTournament: (
    data: Omit<Tournament, 'id' | 'ownerId'>,
    existingId?: string,
    initialGames?: Omit<
      FideGame,
      'id' | 'ownerId' | 'tournamentId' | 'tournamentName'
    >[]
  ) => Promise<void>;
  onDeleteTournament: (id: string) => Promise<void>;
  onSaveGame: (
    data: Omit<FideGame, 'id' | 'ownerId'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteGame: (id: string) => Promise<void>;
  onSelectOpponentProfile: (opponentId: string) => void;
  onOpenGameInViewer: (game: FideGame) => void;
  isFriendlyMode?: boolean;
}

interface DraftRoundGame {
  tempId: string;
  round: number;
  datePlayed: string;
  playerColor: PlayerColor;
  opponentId: string;
  opponentName: string;
  opponentNameUncertain: boolean;
  opponentFideId: string;
  opponentFfeId: string;
  opponentElo: number;
  opponentEloUnknown: boolean;
  opponentTitle: FideTitle;
  playerScore: 1 | 0.5 | 0;
  kFactor: 10 | 20 | 40;
  chessComUrl: string;
  pgn: string;
  notes: string;
}

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
  isFriendlyMode = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cadenceFilter, setCadenceFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTournamentFilterId, setSelectedTournamentFilterId] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Modale de détails complets d'un tournoi
  const [inspectedTournamentId, setInspectedTournamentId] = useState<string | null>(
    null
  );

  // Modale de confirmation de suppression (3s)
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(
    null
  );
  const [gameToDelete, setGameToDelete] = useState<FideGame | null>(null);

  // Modale de création / édition de tournoi
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [federation, setFederation] = useState('FRA');
  const [fideTournamentId, setFideTournamentId] = useState('');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [timeControl, setTimeControl] =
    useState<TimeControlCategory>('Standard');
  const [timeControlDetails, setTimeControlDetails] =
    useState('90m + 30s/coup');
  const [format, setFormat] = useState<TournamentFormat>('Swiss');
  const [totalRounds, setTotalRounds] = useState(9);
  const [totalPlayers, setTotalPlayers] = useState(120);
  const [finalStanding, setFinalStanding] = useState(15);
  const [status, setStatus] = useState<TournamentStatus>('completed');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [pausedNotes, setPausedNotes] = useState<string>('');
  const [pausedFields, setPausedFields] = useState<string[]>(['Rondes & Appariements']);
  const [normTarget, setNormTarget] = useState('');
  const [notes, setNotes] = useState('');
  const [manualPerformance, setManualPerformance] = useState('');
  const [manualEloDelta, setManualEloDelta] = useState('');
  const [modalStep, setModalStep] = useState<1 | 2 | 3 | 4>(1);
  const [canConfirmSave, setCanConfirmSave] = useState(false);

  // Sécurité anti-sauvegarde automatique : empêche tout double-clic ou validation involontaire à l'étape 4
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

  // Rondes saisies directement lors de la création d'un tournoi
  const [draftGames, setDraftGames] = useState<DraftRoundGame[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ajout rapide d'une ronde depuis la modale de détails du tournoi
  const [quickRoundOpenFor, setQuickRoundOpenFor] = useState<string | null>(
    null
  );
  const [qrRound, setQrRound] = useState(1);
  const [qrColor, setQrColor] = useState<PlayerColor>('White');
  const [qrOpponentId, setQrOpponentId] = useState('');
  const [qrOpponentName, setQrOpponentName] = useState('');
  const [qrOpponentNameUncertain, setQrOpponentNameUncertain] = useState(false);
  const [qrOpponentFideId, setQrOpponentFideId] = useState('');
  const [qrOpponentFfeId, setQrOpponentFfeId] = useState('');
  const [qrOpponentElo, setQrOpponentElo] = useState(1650);
  const [qrOpponentEloUnknown, setQrOpponentEloUnknown] = useState(false);
  const [qrOpponentTitle, setQrOpponentTitle] = useState<FideTitle>('None');
  const [qrScore, setQrScore] = useState<1 | 0.5 | 0>(1);
  const [qrChessComUrl, setQrChessComUrl] = useState('');
  const [qrPgn, setQrPgn] = useState('');

  // Liste des joueurs classée par ordre alphabétique "NOM, Prénom"
  const sortedOpponents = useMemo(() => {
    return [...opponents].sort((a, b) =>
      formatPlayerNameLastFirst(a.name).localeCompare(
        formatPlayerNameLastFirst(b.name),
        'fr',
        { sensitivity: 'base' }
      )
    );
  }, [opponents]);

  const getPlayerEloForCadence = (tc: TimeControlCategory) => {
    if (tc === 'Rapid') return profile.rapidElo;
    if (tc === 'Blitz') return profile.blitzElo;
    return profile.standardElo;
  };

  const getOpponentEloForCadence = (
    opp: OpponentPlayer,
    tc: TimeControlCategory
  ) => {
    if (isOpponentEloUnknownForCadence(opp, tc)) return 0;
    if (tc === 'Rapid') return Number(opp.rapidElo) || 0;
    if (tc === 'Blitz') return Number(opp.blitzElo) || 0;
    return Number(opp.standardElo) || Number(opp.elo) || 0;
  };

  const isOpponentEloUnknownForCadence = (
    opp: OpponentPlayer,
    tc: TimeControlCategory
  ) => {
    if (opp.isEloUnknown) return true;
    if (tc === 'Rapid') {
      return (
        Boolean(opp.isRapidEloUnknown) ||
        opp.rapidElo === undefined ||
        opp.rapidElo === null ||
        Number(opp.rapidElo) <= 0
      );
    }
    if (tc === 'Blitz') {
      return (
        Boolean(opp.isBlitzEloUnknown) ||
        opp.blitzElo === undefined ||
        opp.blitzElo === null ||
        Number(opp.blitzElo) <= 0
      );
    }
    return (
      Boolean(opp.isStandardEloUnknown) ||
      (!opp.standardElo && !opp.elo) ||
      Number(opp.standardElo || opp.elo) <= 0
    );
  };

  const enrichedTournaments = useMemo(() => {
    return tournaments
      .map((t) => {
        const tGames = games
          .filter((g) => g.tournamentId === t.id)
          .sort((a, b) => a.round - b.round);

        const gamesScore = tGames.reduce((acc, g) => acc + g.playerScore, 0);
        const gamesEloDelta = isFriendlyMode
          ? 0
          : Math.round(
              tGames.reduce((acc, g) => acc + g.eloChange, 0) * 10
            ) / 10;

        const knownEloGames = tGames.filter((g) => !g.opponentEloUnknown);
        const gamesPerf = calculateFidePerformanceRating(
          knownEloGames.map((g) => ({
            opponentElo: g.opponentElo,
            playerScore: g.playerScore,
          }))
        );

        const wins = tGames.filter((g) => g.playerScore === 1).length;
        const draws = tGames.filter((g) => g.playerScore === 0.5).length;
        const losses = tGames.filter((g) => g.playerScore === 0).length;

        const effectiveScore = gamesScore;
        const hasManualPerf =
          t.manualPerformance !== undefined &&
          t.manualPerformance !== null &&
          Number(t.manualPerformance) > 0;
        const hasManualEloDelta =
          !isFriendlyMode &&
          t.manualEloDelta !== undefined &&
          t.manualEloDelta !== null &&
          !Number.isNaN(Number(t.manualEloDelta));

        const effectiveEloDelta = isFriendlyMode
          ? 0
          : hasManualEloDelta
          ? Math.round(Number(t.manualEloDelta) * 10) / 10
          : gamesEloDelta;
        const effectivePerf = hasManualPerf
          ? Math.round(Number(t.manualPerformance))
          : gamesPerf;

        return {
          ...t,
          games: tGames,
          wins,
          draws,
          losses,
          effectiveScore,
          effectiveEloDelta,
          effectivePerf,
          hasManualPerf,
          hasManualEloDelta,
        };
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [tournaments, games, isFriendlyMode]);

  const filteredTournaments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = enrichedTournaments.filter((t) => {
      if (selectedTournamentFilterId && t.id !== selectedTournamentFilterId) {
        return false;
      }
      if (cadenceFilter !== 'ALL' && t.timeControl !== cadenceFilter) {
        return false;
      }
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'paused' && !(t.status === 'paused' || t.isPaused)) {
          return false;
        }
        if (statusFilter === 'upcoming' && (t.status !== 'upcoming' || t.isPaused)) {
          return false;
        }
        if (statusFilter === 'ongoing' && t.status !== 'ongoing') {
          return false;
        }
        if (statusFilter === 'completed' && t.status !== 'completed') {
          return false;
        }
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        (t.normTarget || '').toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.startDate.localeCompare(a.startDate);
      } else {
        return a.startDate.localeCompare(b.startDate);
      }
    });
  }, [enrichedTournaments, searchQuery, cadenceFilter, statusFilter, selectedTournamentFilterId, sortOrder]);

  const inspectedTournament = useMemo(
    () =>
      enrichedTournaments.find((t) => t.id === inspectedTournamentId) || null,
    [enrichedTournaments, inspectedTournamentId]
  );

  const openCreateModal = () => {
    setEditingId(undefined);
    setName('');
    setLocation('');
    setFederation('FRA');
    setFideTournamentId('');
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setEndDate(today);
    setTimeControl('Standard');
    setTimeControlDetails('90m + 30s/coup');
    setFormat('Swiss');
    setTotalRounds(7);
    setTotalPlayers(80);
    setFinalStanding(10);
    setStatus('completed');
    setIsPaused(false);
    setPausedNotes('');
    setPausedFields(['Rondes & Appariements']);
    setNormTarget('');
    setNotes('');
    setManualPerformance('');
    setManualEloDelta('');
    setDraftGames([]);
    setModalStep(1);
    setIsModalOpen(true);
  };

  const openEditModal = (t: Tournament) => {
    setEditingId(t.id);
    setName(t.name);
    setLocation(t.location);
    setFederation('FRA');
    setFideTournamentId('');
    setStartDate(t.startDate);
    setEndDate(t.endDate);
    setTimeControl(t.timeControl);
    setTimeControlDetails(t.timeControlDetails);
    setFormat(t.format);
    setTotalRounds(t.totalRounds);
    setTotalPlayers(t.totalPlayers || 60);
    setFinalStanding(t.finalRank || 1);
    const paused = Boolean(t.isPaused || t.status === 'paused');
    setStatus(t.status || 'completed');
    setIsPaused(paused);
    setPausedNotes(t.pausedNotes || '');
    setPausedFields(t.pausedFields || ['Rondes & Appariements']);
    setNormTarget(t.normTarget || '');
    setNotes(t.notes);
    setManualPerformance(
      t.manualPerformance !== undefined &&
        t.manualPerformance !== null &&
        Number(t.manualPerformance) > 0
        ? String(t.manualPerformance)
        : ''
    );
    setManualEloDelta(
      t.manualEloDelta !== undefined &&
        t.manualEloDelta !== null &&
        !Number.isNaN(Number(t.manualEloDelta))
        ? String(t.manualEloDelta)
        : ''
    );
    setDraftGames([]);
    setModalStep(1);
    setIsModalOpen(true);
  };

  const handleTogglePauseTournament = async (t: Tournament) => {
    const nextPaused = !(t.isPaused || t.status === 'paused');
    const nextStatus: TournamentStatus = nextPaused
      ? 'paused'
      : t.status === 'paused'
      ? 'upcoming'
      : t.status;
    await onSaveTournament(
      {
        name: t.name,
        location: t.location,
        startDate: t.startDate,
        endDate: t.endDate,
        timeControl: t.timeControl,
        timeControlDetails: t.timeControlDetails,
        format: t.format,
        totalRounds: t.totalRounds,
        totalPlayers: t.totalPlayers,
        finalRank: t.finalRank,
        startingElo: t.startingElo,
        status: nextStatus,
        isPaused: nextPaused,
        pausedNotes: nextPaused ? (t.pausedNotes || 'Tournoi et calendrier en pause') : '',
        pausedFields: nextPaused ? (t.pausedFields || ['Rondes & Appariements']) : [],
        normTarget: t.normTarget,
        notes: t.notes,
        manualPerformance: t.manualPerformance,
        manualEloDelta: t.manualEloDelta,
      },
      t.id
    );
  };

  const addDraftRound = () => {
    const nextRound = draftGames.length + 1;
    setDraftGames((prev) => [
      ...prev,
      {
        tempId: `draft-${Date.now()}-${nextRound}`,
        round: nextRound,
        datePlayed: startDate,
        playerColor: nextRound % 2 === 1 ? 'White' : 'Black',
        opponentId: '',
        opponentName: '',
        opponentNameUncertain: false,
        opponentFideId: '',
        opponentFfeId: '',
        opponentElo: 1600,
        opponentEloUnknown: false,
        opponentTitle: 'None',
        playerScore: 1,
        kFactor: 20,
        chessComUrl: '',
        pgn: '',
        notes: '',
      },
    ]);
  };

  const updateDraftRound = (
    tempId: string,
    patch: Partial<DraftRoundGame>
  ) => {
    setDraftGames((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, ...patch } : row))
    );
  };

  const removeDraftRound = (tempId: string) => {
    setDraftGames((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const handleSelectOpponentForDraft = (
    tempId: string,
    opponentId: string
  ) => {
    const found = opponents.find((o) => o.id === opponentId);
    if (!found) {
      updateDraftRound(tempId, { opponentId: '' });
      return;
    }
    const uncertain = Boolean(
      found.isNameUncertain || hasQuestionMarkName(found.name)
    );
    updateDraftRound(tempId, {
      opponentId: found.id,
      opponentName: formatPlayerNameLastFirst(found.name),
      opponentNameUncertain: uncertain,
      opponentFideId: found.fideId,
      opponentFfeId: found.ffeId,
      opponentElo: getOpponentEloForCadence(found, timeControl),
      opponentEloUnknown: isOpponentEloUnknownForCadence(found, timeControl),
      opponentTitle: found.title,
    });
  };

  const handleFideOrFfeLookupInDraft = (
    tempId: string,
    field: 'fideId' | 'ffeId',
    value: string
  ) => {
    const clean = value.trim();
    if (field === 'fideId') {
      updateDraftRound(tempId, { opponentFideId: clean });
      const match = opponents.find((o) => o.fideId && o.fideId === clean);
      if (match) {
        updateDraftRound(tempId, {
          opponentId: match.id,
          opponentName: formatPlayerNameLastFirst(match.name),
          opponentNameUncertain: Boolean(
            match.isNameUncertain || hasQuestionMarkName(match.name)
          ),
          opponentFfeId: match.ffeId,
          opponentElo: getOpponentEloForCadence(match, timeControl),
          opponentEloUnknown: isOpponentEloUnknownForCadence(match, timeControl),
          opponentTitle: match.title,
        });
      }
    } else {
      updateDraftRound(tempId, { opponentFfeId: clean.toUpperCase() });
      const match = opponents.find(
        (o) => o.ffeId && o.ffeId.toUpperCase() === clean.toUpperCase()
      );
      if (match) {
        updateDraftRound(tempId, {
          opponentId: match.id,
          opponentName: formatPlayerNameLastFirst(match.name),
          opponentNameUncertain: Boolean(
            match.isNameUncertain || hasQuestionMarkName(match.name)
          ),
          opponentFideId: match.fideId,
          opponentElo: getOpponentEloForCadence(match, timeControl),
          opponentEloUnknown: isOpponentEloUnknownForCadence(match, timeControl),
          opponentTitle: match.title,
        });
      }
    }
  };

  const handleExplicitSaveTournament = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (modalStep !== 4) return;
    if (!name.trim()) return;
    setIsSubmitting(true);

    try {
      const playerElo = getPlayerEloForCadence(timeControl);
      const validDrafts = draftGames.filter((d) => d.opponentName.trim());

      const initialGamesToSave: Omit<
        FideGame,
        'id' | 'ownerId' | 'tournamentId' | 'tournamentName'
      >[] = validDrafts.map((d) => {
        const eloChange =
          isFriendlyMode || d.opponentEloUnknown
            ? 0
            : calculateFideEloChange(
                playerElo,
                d.opponentElo,
                d.playerScore,
                d.kFactor
              );
        const result =
          d.playerScore === 1
            ? d.playerColor === 'White'
              ? '1-0'
              : '0-1'
            : d.playerScore === 0
            ? d.playerColor === 'White'
              ? '0-1'
              : '1-0'
            : '1/2-1/2';
        const uncertain =
          d.opponentNameUncertain || hasQuestionMarkName(d.opponentName);
        return {
          round: d.round,
          datePlayed: d.datePlayed || startDate,
          timeControl,
          playerColor: d.playerColor,
          playerElo,
          opponentId: d.opponentId || undefined,
          opponentName: formatPlayerNameLastFirst(d.opponentName),
          opponentNameUncertain: uncertain,
          opponentFideId: d.opponentFideId,
          opponentFfeId: d.opponentFfeId,
          opponentElo: d.opponentEloUnknown ? 0 : Number(d.opponentElo) || 1500,
          opponentEloUnknown: d.opponentEloUnknown,
          opponentTitle: d.opponentTitle,
          opponentFederation: 'FRA',
          result,
          playerScore: d.playerScore,
          termination: 'Agreement',
          kFactorUsed: d.kFactor,
          eloChange,
          ecoCode: 'C50',
          openingName: 'Ouverture',
          movesCount: 35,
          chessComUrl: d.chessComUrl.trim() || undefined,
          pgn: d.pgn.trim(),
          keyMomentNote: d.notes || '',
        };
      });

      const parsedManualPerf =
        manualPerformance.trim() !== '' &&
        Number.isFinite(Number(manualPerformance)) &&
        Number(manualPerformance) > 0
          ? Math.round(Number(manualPerformance))
          : undefined;
      const parsedManualDelta =
        !isFriendlyMode &&
        manualEloDelta.trim() !== '' &&
        Number.isFinite(Number(manualEloDelta))
          ? Math.round(Number(manualEloDelta) * 10) / 10
          : undefined;

      await onSaveTournament(
        {
          name: name.trim(),
          location: location.trim() || 'France',
          startDate,
          endDate,
          timeControl,
          timeControlDetails,
          format,
          totalRounds: Number(totalRounds) || Math.max(validDrafts.length, 1),
          totalPlayers: Number(totalPlayers) || 0,
          finalRank: Number(finalStanding) || 0,
          startingElo: playerElo,
          status: isPaused ? 'paused' : status,
          isPaused,
          pausedNotes: isPaused ? pausedNotes : '',
          pausedFields: isPaused ? pausedFields : [],
          normTarget: normTarget.trim(),
          notes,
          manualPerformance: parsedManualPerf,
          manualEloDelta: parsedManualDelta,
        },
        editingId,
        initialGamesToSave
      );

      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveQuickRound = async (tournament: Tournament) => {
    if (!qrOpponentName.trim()) return;
    const playerElo = getPlayerEloForCadence(tournament.timeControl);
    const eloChange =
      isFriendlyMode || qrOpponentEloUnknown
        ? 0
        : calculateFideEloChange(playerElo, qrOpponentElo, qrScore, 20);
    const result =
      qrScore === 1
        ? qrColor === 'White'
          ? '1-0'
          : '0-1'
        : qrScore === 0
        ? qrColor === 'White'
          ? '0-1'
          : '1-0'
        : '1/2-1/2';

    const uncertain =
      qrOpponentNameUncertain || hasQuestionMarkName(qrOpponentName);

    await onSaveGame({
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      round: qrRound,
      datePlayed: tournament.startDate,
      timeControl: tournament.timeControl,
      playerColor: qrColor,
      playerElo,
      opponentId: qrOpponentId || undefined,
      opponentName: formatPlayerNameLastFirst(qrOpponentName),
      opponentNameUncertain: uncertain,
      opponentFideId: qrOpponentFideId,
      opponentFfeId: qrOpponentFfeId,
      opponentElo: qrOpponentEloUnknown ? 0 : Number(qrOpponentElo) || 1500,
      opponentEloUnknown: qrOpponentEloUnknown,
      opponentTitle: qrOpponentTitle,
      opponentFederation: 'FRA',
      result,
      playerScore: qrScore,
      termination: 'Agreement',
      kFactorUsed: 20,
      eloChange,
      ecoCode: 'C50',
      openingName: 'Ouverture',
      movesCount: 35,
      chessComUrl: qrChessComUrl.trim() || undefined,
      pgn: qrPgn.trim(),
      keyMomentNote: '',
    });

    setQuickRoundOpenFor(null);
    setQrOpponentId('');
    setQrOpponentName('');
    setQrOpponentNameUncertain(false);
    setQrOpponentFideId('');
    setQrOpponentFfeId('');
    setQrOpponentEloUnknown(false);
    setQrPgn('');
    setQrChessComUrl('');
  };

  const inputClass =
    'w-full px-3 py-2 text-xs bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder-[#6C788B] focus:outline-none focus:border-emerald-500 transition-colors';

  return (
    <div className="space-y-5">
      {/* En-tête de la section */}
      <div className="flex items-center justify-between gap-4 border-b border-[#232C3A] pb-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-[#F1F4F8]">
            {isFriendlyMode
              ? 'Sessions & Tournois Amicaux'
              : 'Mes Tournois Officiels'}
          </h1>
          <p className="text-xs text-[#9BA7B8] mt-1">
            {isFriendlyMode
              ? 'Regroupez vos soirées club ou tournois amicaux (sans impact Elo).'
              : 'Consultez vos tournois homologués, performances et rondes jouées.'}
          </p>
        </div>

        <IconButton
          variant="primary"
          size="lg"
          label={
            isFriendlyMode
              ? 'Créer une session amicale'
              : 'Enregistrer un nouveau tournoi'
          }
          onClick={openCreateModal}
        >
          <Plus className="w-5 h-5" />
        </IconButton>
      </div>

      {/* Filtres des tournois */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9BA7B8] mb-1.5">
              Filtrer par tournoi
            </label>
            <select
              value={selectedTournamentFilterId}
              onChange={(e) => setSelectedTournamentFilterId(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">
                Tous les tournois ({enrichedTournaments.length})
              </option>
              {enrichedTournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.startDate} · {t.name} ({t.location}) ·{' '}
                  {t.timeControl === 'Standard' ? 'Classique' : t.timeControl}
                  {t.isPaused || t.status === 'paused' ? ' [En pause]' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9BA7B8] mb-1.5">
              Recherche libre
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6C788B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, ville, objectif..."
                className={`${inputClass} pl-8.5`}
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9BA7B8] mb-1.5">
              Statut
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="ALL">Tous les statuts</option>
              <option value="paused">
                En pause (
                {
                  enrichedTournaments.filter(
                    (t) => t.isPaused || t.status === 'paused'
                  ).length
                }
                )
              </option>
              <option value="upcoming">
                À venir (
                {
                  enrichedTournaments.filter(
                    (t) => t.status === 'upcoming' && !t.isPaused
                  ).length
                }
                )
              </option>
              <option value="ongoing">
                En cours (
                {
                  enrichedTournaments.filter((t) => t.status === 'ongoing')
                    .length
                }
                )
              </option>
              <option value="completed">
                Terminés (
                {
                  enrichedTournaments.filter(
                    (t) => t.status === 'completed' && !t.isPaused
                  ).length
                }
                )
              </option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#232C3A] text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-[#9BA7B8] mr-1">
              Cadence :
            </span>
            {(['ALL', 'Standard', 'Rapid', 'Blitz'] as const).map((cad) => {
              const active = cadenceFilter === cad;
              return (
                <button
                  key={cad}
                  type="button"
                  onClick={() => setCadenceFilter(cad)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#19202B] text-[#9BA7B8] border-[#2B3647] hover:text-[#F1F4F8]'
                  }`}
                >
                  {cad === 'ALL'
                    ? 'Toutes'
                    : cad === 'Standard'
                    ? 'Classique'
                    : cad === 'Rapid'
                    ? 'Rapide'
                    : 'Blitz'}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
              }
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono text-[#9BA7B8] bg-[#19202B] border border-[#2B3647] hover:text-[#F1F4F8] cursor-pointer"
            >
              Tri : {sortOrder === 'desc' ? 'Récents ↓' : 'Anciens ↑'}
            </button>

            {(selectedTournamentFilterId ||
              statusFilter !== 'ALL' ||
              cadenceFilter !== 'ALL' ||
              searchQuery) && (
              <IconButton
                variant="danger"
                size="xs"
                label="Réinitialiser tous les filtres"
                onClick={() => {
                  setSelectedTournamentFilterId('');
                  setStatusFilter('ALL');
                  setCadenceFilter('ALL');
                  setSearchQuery('');
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {/* Tableau des tournois */}
      {filteredTournaments.length === 0 ? (
        <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-12 text-center space-y-4">
          <Trophy className="w-8 h-8 text-[#D4A853] mx-auto opacity-80" />
          <p className="text-sm font-semibold text-[#F1F4F8]">
            Aucun tournoi enregistré.
          </p>
          <div className="flex justify-center">
            <IconButton
              variant="primary"
              size="lg"
              label="Ajouter un tournoi"
              onClick={openCreateModal}
            >
              <Plus className="w-5 h-5" />
            </IconButton>
          </div>
        </div>
      ) : (
        <div className="bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
          {/* Vue Mobile : Cartes tactiles */}
          <div className="md:hidden divide-y divide-[#232C3A]">
            {filteredTournaments.map((t) => {
              const paused = Boolean(t.isPaused || t.status === 'paused');
              return (
                <div
                  key={t.id}
                  onClick={() => setInspectedTournamentId(t.id)}
                  className="p-4 space-y-3 active:bg-[#19202B] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-[#F1F4F8] flex items-center gap-2 flex-wrap">
                        <span className="truncate">{t.name}</span>
                        {paused && (
                          <span className="text-[10px] font-mono text-[#D4A853]">
                            [Pause]
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9BA7B8] mt-0.5 font-mono truncate">
                        {t.location} · {t.startDate} → {t.endDate}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-[#19202B] border border-[#2B3647] text-[10px] font-mono font-bold text-[#CBD5E1] shrink-0">
                      {t.timeControl === 'Standard'
                        ? 'Classique'
                        : t.timeControl === 'Rapid'
                        ? 'Rapide'
                        : 'Blitz'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                    <div className="p-2 rounded-xl bg-[#19202B] border border-[#232C3A]">
                      <div className="text-[10px] font-sans text-[#6C788B]">Score</div>
                      <div className="font-bold text-[#F1F4F8] mt-0.5">
                        {t.effectiveScore}/{t.games.length || t.totalRounds}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#19202B] border border-[#232C3A]">
                      <div className="text-[10px] font-sans text-[#6C788B]">
                        Perf{t.hasManualPerf ? ' · saisie' : ''}
                      </div>
                      <div className="font-bold text-[#D4A853] mt-0.5">
                        {t.effectivePerf || '—'}
                      </div>
                    </div>
                    {!isFriendlyMode ? (
                      <div className="p-2 rounded-xl bg-[#19202B] border border-[#232C3A]">
                        <div className="text-[10px] font-sans text-[#6C788B]">
                          Elo{t.hasManualEloDelta ? ' · saisi' : ''}
                        </div>
                        <div
                          className={`font-bold mt-0.5 ${
                            t.effectiveEloDelta >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {t.effectiveEloDelta >= 0
                            ? `+${t.effectiveEloDelta.toFixed(1)}`
                            : t.effectiveEloDelta.toFixed(1)}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-[#19202B] border border-[#232C3A]">
                        <div className="text-[10px] font-sans text-[#6C788B]">Place</div>
                        <div className="font-bold text-[#D4A853] mt-0.5">
                          {t.finalRank ? `${t.finalRank}e` : '—'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className="flex items-center justify-between gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-[11px] font-mono text-[#6C788B]">
                      {t.finalRank
                        ? `Rang ${t.finalRank}e / ${t.totalPlayers || '?'}`
                        : `${t.games.length} ronde(s)`}
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <IconButton
                        variant="surface"
                        size="sm"
                        label={`Détails et rondes (${t.games.length})`}
                        badge={t.games.length}
                        onClick={() => setInspectedTournamentId(t.id)}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </IconButton>
                      <IconButton
                        variant={paused ? 'gold' : 'ghost'}
                        size="sm"
                        label={paused ? 'Reprendre' : 'Mettre en pause'}
                        onClick={() => handleTogglePauseTournament(t)}
                      >
                        {paused ? (
                          <Play className="w-3.5 h-3.5" />
                        ) : (
                          <Pause className="w-3.5 h-3.5" />
                        )}
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        label="Modifier ce tournoi"
                        onClick={() => openEditModal(t)}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </IconButton>
                      <IconButton
                        variant="danger"
                        size="sm"
                        label="Supprimer ce tournoi"
                        onClick={() => setTournamentToDelete(t)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vue Desktop : Tableau complet */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232C3A] bg-[#19202B]/70 text-[11px] font-bold uppercase tracking-wider text-[#9BA7B8]">
                  <th className="py-3 px-4">Tournoi & Lieu</th>
                  <th className="py-3 px-4">Cadence</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Classement</th>
                  <th className="py-3 px-4 text-right">Perf.</th>
                  {!isFriendlyMode && (
                    <th className="py-3 px-4 text-right">Elo Gagné</th>
                  )}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232C3A] text-xs">
                {filteredTournaments.map((t) => {
                  const paused = Boolean(t.isPaused || t.status === 'paused');
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setInspectedTournamentId(t.id)}
                      className="hover:bg-[#19202B] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#F1F4F8] flex items-center gap-2">
                          <span>{t.name}</span>
                          {paused && (
                            <span className="text-[10px] font-mono text-[#D4A853]">
                              [Pause]
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#9BA7B8] mt-0.5 font-mono">
                          {t.location} · {t.startDate} → {t.endDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#CBD5E1]">
                          {t.timeControl === 'Standard'
                            ? 'Classique'
                            : t.timeControl === 'Rapid'
                            ? 'Rapide'
                            : 'Blitz'}
                        </div>
                        <div className="text-[11px] text-[#6C788B] font-mono mt-0.5">
                          {t.timeControlDetails}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono">
                        <div className="font-bold text-[#F1F4F8]">
                          {t.effectiveScore} / {t.games.length || t.totalRounds}
                        </div>
                        <div className="text-[11px] text-[#6C788B]">
                          +{t.wins} ={t.draws} -{t.losses}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-[#D4A853]">
                        {t.finalRank
                          ? `${t.finalRank}e / ${t.totalPlayers || '?'}`
                          : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#F1F4F8]">
                        <div>{t.effectivePerf || '—'}</div>
                        {t.hasManualPerf && (
                          <div className="text-[10px] font-sans font-normal text-[#D4A853]">
                            saisie
                          </div>
                        )}
                      </td>

                      {!isFriendlyMode && (
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          <div
                            className={
                              t.effectiveEloDelta >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            {t.effectiveEloDelta >= 0
                              ? `+${t.effectiveEloDelta.toFixed(1)}`
                              : t.effectiveEloDelta.toFixed(1)}
                          </div>
                          {t.hasManualEloDelta && (
                            <div className="text-[10px] font-sans font-normal text-[#D4A853]">
                              saisi
                            </div>
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
                            label={`Détails et rondes (${t.games.length})`}
                            badge={t.games.length}
                            onClick={() => setInspectedTournamentId(t.id)}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </IconButton>
                          <IconButton
                            variant={paused ? 'gold' : 'ghost'}
                            size="sm"
                            label={
                              paused
                                ? 'Reprendre ce tournoi'
                                : 'Mettre ce tournoi en pause'
                            }
                            onClick={() => handleTogglePauseTournament(t)}
                          >
                            {paused ? (
                              <Play className="w-3.5 h-3.5" />
                            ) : (
                              <Pause className="w-3.5 h-3.5" />
                            )}
                          </IconButton>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            label="Modifier ce tournoi"
                            onClick={() => openEditModal(t)}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </IconButton>
                          <IconButton
                            variant="danger"
                            size="sm"
                            label="Supprimer ce tournoi"
                            onClick={() => setTournamentToDelete(t)}
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
        </div>
      )}

      {/* MODALE COMPLÈTE D'INFORMATION SUR LE TOURNOI & SES PARTIES */}
      {inspectedTournament && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
          <div className="bg-[#131820] border border-[#2B3647] rounded-t-3xl sm:rounded-2xl max-w-5xl w-full p-4 sm:p-6 space-y-5 sm:space-y-6 max-h-[92dvh] overflow-y-auto shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#232C3A] pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#9BA7B8]">
                  <span className="font-bold uppercase text-emerald-400">
                    {inspectedTournament.timeControl === 'Standard'
                      ? 'Classique'
                      : inspectedTournament.timeControl === 'Rapid'
                      ? 'Rapide'
                      : 'Blitz'}
                  </span>
                  <span className="text-[#475569]">·</span>
                  <span>
                    {inspectedTournament.timeControlDetails} ·{' '}
                    {inspectedTournament.format}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-[#F1F4F8] mt-1">
                  {inspectedTournament.name}
                </h2>
                <p className="text-xs text-[#9BA7B8] mt-0.5">
                  {inspectedTournament.location} · Du{' '}
                  {inspectedTournament.startDate} au{' '}
                  {inspectedTournament.endDate}
                  {inspectedTournament.normTarget &&
                    ` · Objectif : ${inspectedTournament.normTarget}`}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <IconButton
                  variant="primary"
                  size="md"
                  label="Ajouter une ronde"
                  onClick={() => {
                    setQuickRoundOpenFor(
                      quickRoundOpenFor === inspectedTournament.id
                        ? null
                        : inspectedTournament.id
                    );
                    setQrRound(inspectedTournament.games.length + 1);
                  }}
                >
                  <Plus className="w-4 h-4" />
                </IconButton>
                <IconButton
                  variant="surface"
                  size="md"
                  label="Modifier ce tournoi"
                  onClick={() => openEditModal(inspectedTournament)}
                >
                  <Edit3 className="w-4 h-4" />
                </IconButton>
                <IconButton
                  variant="danger"
                  size="md"
                  label="Supprimer ce tournoi"
                  onClick={() => setTournamentToDelete(inspectedTournament)}
                >
                  <Trash2 className="w-4 h-4" />
                </IconButton>
                <IconButton
                  variant="ghost"
                  size="md"
                  label="Fermer"
                  onClick={() => setInspectedTournamentId(null)}
                >
                  <X className="w-5 h-5" />
                </IconButton>
              </div>
            </div>

            {/* Cartes de statistiques du tournoi */}
            <div
              className={`grid grid-cols-2 ${
                isFriendlyMode ? 'sm:grid-cols-3' : 'sm:grid-cols-4'
              } gap-3 font-mono`}
            >
              <div className="p-3.5 bg-[#19202B] border border-[#263142] rounded-xl">
                <div className="text-[11px] font-sans font-semibold text-[#9BA7B8]">
                  Score Final
                </div>
                <div className="text-xl font-bold text-[#F1F4F8] mt-1">
                  {inspectedTournament.effectiveScore} /{' '}
                  {inspectedTournament.games.length ||
                    inspectedTournament.totalRounds}
                </div>
                <div className="text-xs text-[#6C788B] mt-0.5">
                  +{inspectedTournament.wins}V · ={inspectedTournament.draws}N · -
                  {inspectedTournament.losses}D
                </div>
              </div>

              <div className="p-3.5 bg-[#19202B] border border-[#263142] rounded-xl">
                <div className="text-[11px] font-sans font-semibold text-[#9BA7B8]">
                  Classement Final
                </div>
                <div className="text-xl font-bold text-[#D4A853] mt-1">
                  {inspectedTournament.finalRank
                    ? `${inspectedTournament.finalRank}e`
                    : '—'}
                </div>
                <div className="text-xs font-sans text-[#6C788B] mt-0.5">
                  sur {inspectedTournament.totalPlayers || '?'} joueurs
                </div>
              </div>

              <div className="p-3.5 bg-[#19202B] border border-[#263142] rounded-xl">
                <div className="text-[11px] font-sans font-semibold text-[#9BA7B8]">
                  Performance
                </div>
                <div className="text-xl font-bold text-[#F1F4F8] mt-1">
                  {inspectedTournament.effectivePerf || '—'}
                </div>
                <div className="text-xs font-sans text-[#6C788B] mt-0.5">
                  {inspectedTournament.hasManualPerf
                    ? 'Saisie manuellement'
                    : 'Calculée sur les rondes'}
                </div>
              </div>

              {!isFriendlyMode && (
                <div className="p-3.5 bg-[#19202B] border border-[#263142] rounded-xl">
                  <div className="text-[11px] font-sans font-semibold text-[#9BA7B8]">
                    Bilan Elo
                  </div>
                  <div
                    className={`text-xl font-bold mt-1 ${
                      inspectedTournament.effectiveEloDelta >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {inspectedTournament.effectiveEloDelta >= 0
                      ? `+${inspectedTournament.effectiveEloDelta.toFixed(1)}`
                      : inspectedTournament.effectiveEloDelta.toFixed(1)}
                  </div>
                  <div className="text-xs font-sans text-[#6C788B] mt-0.5">
                    {inspectedTournament.hasManualEloDelta
                      ? 'Saisi manuellement'
                      : 'Points gagnés / perdus'}
                  </div>
                </div>
              )}
            </div>

            {inspectedTournament.notes && (
              <div className="p-3.5 bg-[#19202B] border border-[#263142] rounded-xl text-xs text-[#CBD5E1]">
                <strong className="text-[#F1F4F8]">Notes :</strong>{' '}
                {inspectedTournament.notes}
              </div>
            )}

            {/* Formulaire d'ajout rapide d'une ronde */}
            {quickRoundOpenFor === inspectedTournament.id && (
              <div className="p-4 bg-[#19202B] border border-[#2B3647] rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#F1F4F8]">
                    Ajouter une ronde — {inspectedTournament.name}
                  </h4>
                  <IconButton
                    variant="ghost"
                    size="xs"
                    label="Fermer le formulaire"
                    onClick={() => setQuickRoundOpenFor(null)}
                  >
                    <X className="w-4 h-4" />
                  </IconButton>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-[#9BA7B8] mb-1">
                      Ronde
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={qrRound}
                      onChange={(e) => setQrRound(Number(e.target.value))}
                      className={`${inputClass} bg-[#131820] font-mono`}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block font-semibold text-[#9BA7B8] mb-1 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Joueur connu (A-Z)
                    </label>
                    <select
                      value={qrOpponentId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setQrOpponentId(id);
                        const found = opponents.find((o) => o.id === id);
                        if (found) {
                          setQrOpponentName(
                            formatPlayerNameLastFirst(found.name)
                          );
                          setQrOpponentNameUncertain(
                            Boolean(
                              found.isNameUncertain ||
                                hasQuestionMarkName(found.name)
                            )
                          );
                          setQrOpponentFideId(found.fideId);
                          setQrOpponentFfeId(found.ffeId);
                          setQrOpponentElo(
                            getOpponentEloForCadence(
                              found,
                              inspectedTournament.timeControl
                            )
                          );
                          setQrOpponentEloUnknown(
                            isOpponentEloUnknownForCadence(
                              found,
                              inspectedTournament.timeControl
                            )
                          );
                          setQrOpponentTitle(found.title);
                        }
                      }}
                      className={`${inputClass} bg-[#131820]`}
                    >
                      <option value="">-- Nouveau joueur --</option>
                      {sortedOpponents.map((opp) => (
                        <option key={opp.id} value={opp.id}>
                          {formatPlayerNameDisplay(
                            opp.name,
                            opp.isNameUncertain
                          )}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-[#9BA7B8]">
                        NOM, Prénom *
                      </label>
                      <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D4A853] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qrOpponentNameUncertain}
                          onChange={(e) =>
                            setQrOpponentNameUncertain(e.target.checked)
                          }
                        />
                        Incertain (?)
                      </label>
                    </div>
                    <input
                      type="text"
                      value={qrOpponentName}
                      onChange={(e) => setQrOpponentName(e.target.value)}
                      placeholder="DUPONT, Jean"
                      className={`${inputClass} bg-[#131820]`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-[#9BA7B8]">
                        Son Elo
                      </label>
                      <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9BA7B8] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qrOpponentEloUnknown}
                          onChange={(e) =>
                            setQrOpponentEloUnknown(e.target.checked)
                          }
                        />
                        ?
                      </label>
                    </div>
                    {qrOpponentEloUnknown ? (
                      <div className="w-full px-3 py-2 font-mono font-bold bg-[#131820] border border-[#2B3647] rounded-xl text-[#D4A853] text-center">
                        ?
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={qrOpponentElo}
                        onChange={(e) =>
                          setQrOpponentElo(Number(e.target.value))
                        }
                        className={`${inputClass} bg-[#131820] font-mono`}
                      />
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-[#9BA7B8] mb-1">
                      Ma couleur
                    </label>
                    <select
                      value={qrColor}
                      onChange={(e) =>
                        setQrColor(e.target.value as PlayerColor)
                      }
                      className={`${inputClass} bg-[#131820]`}
                    >
                      <option value="White">Blancs</option>
                      <option value="Black">Noirs</option>
                    </select>
                  </div>

                  <div className="lg:col-span-3">
                    <label className="block font-semibold text-[#9BA7B8] mb-1">
                      Mon Résultat
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setQrScore(1)}
                        className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                          qrScore === 1
                            ? 'bg-emerald-500 text-[#06130E] border-emerald-400'
                            : 'bg-[#131820] text-emerald-400 border-[#2B3647]'
                        }`}
                      >
                        1 · Victoire
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrScore(0.5)}
                        className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                          qrScore === 0.5
                            ? 'bg-[#D4A853] text-[#141007] border-[#E5C178]'
                            : 'bg-[#131820] text-[#D4A853] border-[#2B3647]'
                        }`}
                      >
                        2 · Nulle
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrScore(0)}
                        className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                          qrScore === 0
                            ? 'bg-rose-500 text-white border-rose-400'
                            : 'bg-[#131820] text-rose-400 border-[#2B3647]'
                        }`}
                      >
                        3 · Défaite
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block font-semibold text-[#9BA7B8] mb-1">
                      Lien Chess.com
                    </label>
                    <input
                      type="url"
                      value={qrChessComUrl}
                      onChange={(e) => setQrChessComUrl(e.target.value)}
                      placeholder="https://www.chess.com/analysis/..."
                      className={`${inputClass} bg-[#131820]`}
                    />
                  </div>

                  <div className="lg:col-span-6">
                    <label className="block font-semibold text-[#9BA7B8] mb-1">
                      PGN de la partie
                    </label>
                    <textarea
                      rows={2}
                      value={qrPgn}
                      onChange={(e) => setQrPgn(e.target.value)}
                      placeholder="1. e4 e5 2. Nf3 Nc6..."
                      className={`${inputClass} bg-[#131820] font-mono`}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <IconButton
                    variant="ghost"
                    size="md"
                    label="Annuler"
                    onClick={() => setQuickRoundOpenFor(null)}
                  >
                    <X className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    variant="primary"
                    size="md"
                    label="Enregistrer la ronde"
                    onClick={() => handleSaveQuickRound(inspectedTournament)}
                  >
                    <Check className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            )}

            {/* Liste des rondes du tournoi */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9BA7B8]">
                Rondes jouées ({inspectedTournament.games.length})
              </h3>

              {inspectedTournament.games.length === 0 ? (
                <div className="p-8 bg-[#19202B] border border-[#263142] rounded-xl text-center text-xs text-[#6C788B]">
                  Aucune ronde détaillée pour ce tournoi.
                </div>
              ) : (
                <>
                  {/* Rondes Mobile */}
                  <div className="md:hidden space-y-2.5">
                    {inspectedTournament.games.map((g) => {
                      const matchedOpponent = opponents.find(
                        (o) =>
                          (g.opponentId && o.id === g.opponentId) ||
                          (g.opponentFideId && o.fideId === g.opponentFideId) ||
                          formatPlayerNameLastFirst(o.name).toLowerCase() ===
                            formatPlayerNameLastFirst(g.opponentName).toLowerCase()
                      );
                      const uncertain = Boolean(
                        g.opponentNameUncertain ||
                          matchedOpponent?.isNameUncertain ||
                          hasQuestionMarkName(g.opponentName)
                      );
                      const eloUnknown = Boolean(g.opponentEloUnknown);
                      return (
                        <div
                          key={g.id}
                          className="p-3.5 rounded-xl bg-[#19202B] border border-[#263142] space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-[#9BA7B8]">
                                R{g.round}
                              </span>
                              <FederationFlag
                                code={
                                  matchedOpponent?.federation ||
                                  g.opponentFederation ||
                                  'FRA'
                                }
                                size="xs"
                              />
                              <span className="font-semibold text-[#F1F4F8] truncate">
                                {formatPlayerNameLastFirst(g.opponentName)}
                                {uncertain ? ' (?)' : ''}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-[#F1F4F8] shrink-0">
                              {eloUnknown ? '?' : g.opponentElo}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-[#9BA7B8]">
                                {g.playerColor === 'White' ? 'Blancs' : 'Noirs'}
                              </span>
                              <span
                                className={`font-bold ${
                                  g.playerScore === 1
                                    ? 'text-emerald-400'
                                    : g.playerScore === 0
                                    ? 'text-rose-400'
                                    : 'text-[#D4A853]'
                                }`}
                              >
                                {g.playerScore === 1
                                  ? '1 · Victoire'
                                  : g.playerScore === 0.5
                                  ? '½ · Nulle'
                                  : '0 · Défaite'}
                              </span>
                              {!isFriendlyMode && (
                                <span
                                  className={`font-bold ${
                                    g.eloChange >= 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {g.eloChange >= 0
                                    ? `+${g.eloChange.toFixed(1)}`
                                    : g.eloChange.toFixed(1)}
                                </span>
                              )}
                            </div>
                            <div className="inline-flex items-center gap-1">
                              <IconButton
                                variant="surface"
                                size="xs"
                                label="Voir PGN & Détails"
                                onClick={() => {
                                  setInspectedTournamentId(null);
                                  onOpenGameInViewer(g);
                                }}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </IconButton>
                              <IconButton
                                variant="danger"
                                size="xs"
                                label="Supprimer cette partie"
                                onClick={() => setGameToDelete(g)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </IconButton>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Rondes Desktop */}
                  <div className="hidden md:block overflow-x-auto border border-[#232C3A] rounded-xl">
                    <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#232C3A] bg-[#19202B]/70 text-[11px] font-bold uppercase tracking-wider text-[#9BA7B8]">
                        <th className="py-2.5 px-4">Ronde</th>
                        <th className="py-2.5 px-4">Adversaire</th>
                        <th className="py-2.5 px-4 text-right">Son Elo</th>
                        <th className="py-2.5 px-4">Couleur</th>
                        <th className="py-2.5 px-4 text-center">Résultat</th>
                        {!isFriendlyMode && (
                          <th className="py-2.5 px-4 text-right">Elo</th>
                        )}
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232C3A] text-xs">
                      {inspectedTournament.games.map((g) => {
                        const matchedOpponent = opponents.find(
                          (o) =>
                            (g.opponentId && o.id === g.opponentId) ||
                            (g.opponentFideId &&
                              o.fideId === g.opponentFideId) ||
                            formatPlayerNameLastFirst(o.name).toLowerCase() ===
                              formatPlayerNameLastFirst(
                                g.opponentName
                              ).toLowerCase()
                        );
                        const uncertain = Boolean(
                          g.opponentNameUncertain ||
                            matchedOpponent?.isNameUncertain ||
                            hasQuestionMarkName(g.opponentName)
                        );
                        const eloUnknown = Boolean(g.opponentEloUnknown);

                        return (
                          <tr key={g.id} className="hover:bg-[#19202B]">
                            <td className="py-2.5 px-4 font-mono font-bold text-[#F1F4F8]">
                              R{g.round}
                            </td>
                            <td className="py-2.5 px-4">
                              <button
                                type="button"
                                onClick={() => {
                                  if (matchedOpponent) {
                                    setInspectedTournamentId(null);
                                    onSelectOpponentProfile(matchedOpponent.id);
                                  }
                                }}
                                className="font-semibold text-[#F1F4F8] hover:text-emerald-400 text-left flex items-center gap-2 cursor-pointer"
                              >
                                <FederationFlag
                                  code={
                                    matchedOpponent?.federation ||
                                    g.opponentFederation ||
                                    'FRA'
                                  }
                                  size="xs"
                                />
                                {g.opponentTitle !== 'None' && (
                                  <span className="text-[10px] font-mono font-bold text-[#D4A853]">
                                    {g.opponentTitle}
                                  </span>
                                )}
                                <span>
                                  {formatPlayerNameLastFirst(g.opponentName)}
                                </span>
                                {uncertain && (
                                  <span className="text-[10px] font-mono font-bold text-[#D4A853]">
                                    (?)
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-[#F1F4F8]">
                              {eloUnknown ? (
                                <span className="text-[#D4A853]">?</span>
                              ) : (
                                g.opponentElo
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-[#CBD5E1]">
                              {g.playerColor === 'White' ? 'Blancs' : 'Noirs'}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono font-bold">
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
                              <td className="py-2.5 px-4 text-right font-mono font-bold">
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
                              </td>
                            )}
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <IconButton
                                  variant="surface"
                                  size="xs"
                                  label="Voir PGN & Détails"
                                  onClick={() => {
                                    setInspectedTournamentId(null);
                                    onOpenGameInViewer(g);
                                  }}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </IconButton>
                                {g.chessComUrl && (
                                  <a
                                    href={g.chessComUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Analyser sur Chess.com"
                                    data-tooltip="Analyser sur Chess.com"
                                    className="w-7 h-7 rounded-lg bg-[#19202B] border border-[#2B3647] text-[#9BA7B8] hover:text-white inline-flex items-center justify-center"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <IconButton
                                  variant="danger"
                                  size="xs"
                                  label="Supprimer cette partie"
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Créer / Modifier un Tournoi */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
          <div className="bg-[#131820] border border-[#2B3647] rounded-t-3xl sm:rounded-2xl max-w-4xl w-full p-4 sm:p-6 space-y-5 sm:my-8 max-h-[92dvh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#232C3A] pb-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#F1F4F8]">
                  {editingId
                    ? 'Modifier les informations du tournoi'
                    : isFriendlyMode
                    ? 'Créer une session ou un tournoi amical'
                    : 'Enregistrer un nouveau tournoi'}
                </h2>
                <p className="text-xs text-[#9BA7B8] mt-0.5">
                  Assistant en 4 étapes · Validation manuelle finale
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

            {/* Stepper à 4 étapes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { step: 1, title: 'Cadre & Cadence' },
                { step: 2, title: 'Statut & Pause' },
                { step: 3, title: `Rondes (${draftGames.length})` },
                { step: 4, title: 'Vérification' },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setModalStep(s.step as 1 | 2 | 3 | 4)}
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

            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              className="space-y-6 text-xs"
            >
              {/* ÉTAPE 1 : INFOS GÉNÉRALES & CADENCE */}
              {modalStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Nom du tournoi / de la session *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Open International de parties classiques"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Lieu / Ville *
                      </label>
                      <input
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Ex: Paris, FRA"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Cadence de jeu *
                      </label>
                      <select
                        value={timeControl}
                        onChange={(e) => {
                          const tc = e.target.value as TimeControlCategory;
                          setTimeControl(tc);
                          if (tc === 'Standard') setTimeControlDetails('90m + 30s/coup');
                          if (tc === 'Rapid') setTimeControlDetails('15m + 5s/coup');
                          if (tc === 'Blitz') setTimeControlDetails('3m + 2s/coup');
                        }}
                        className={inputClass}
                      >
                        <option value="Standard">Classique (Standard)</option>
                        <option value="Rapid">Rapide</option>
                        <option value="Blitz">Blitz</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Précision de cadence
                      </label>
                      <input
                        type="text"
                        value={timeControlDetails}
                        onChange={(e) => setTimeControlDetails(e.target.value)}
                        placeholder="90m + 30s/coup"
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Format
                      </label>
                      <select
                        value={format}
                        onChange={(e) =>
                          setFormat(e.target.value as TournamentFormat)
                        }
                        className={inputClass}
                      >
                        <option value="Swiss">Système Suisse</option>
                        <option value="Round Robin">Toutes rondes</option>
                        <option value="Team">Interclubs / Par équipes</option>
                        <option value="Knockout">Élimination directe</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Date de début
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Date de fin
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Nombre de rondes prévues
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={totalRounds}
                        onChange={(e) => setTotalRounds(Number(e.target.value))}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2 : STATUT, GESTION DE LA PAUSE & OBJECTIFS */}
              {modalStep === 2 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Statut général du tournoi
                      </label>
                      <select
                        value={status}
                        onChange={(e) => {
                          const nextSt = e.target.value as TournamentStatus;
                          setStatus(nextSt);
                          if (nextSt === 'paused') {
                            setIsPaused(true);
                          } else if (
                            nextSt === 'ongoing' ||
                            nextSt === 'completed'
                          ) {
                            setIsPaused(false);
                          }
                        }}
                        className={inputClass}
                      >
                        <option value="upcoming">À venir (non débuté)</option>
                        <option value="paused">En pause</option>
                        <option value="ongoing">En cours</option>
                        <option value="completed">Terminé</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Participants estimés
                      </label>
                      <input
                        type="number"
                        min={2}
                        value={totalPlayers}
                        onChange={(e) =>
                          setTotalPlayers(Number(e.target.value))
                        }
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </div>

                  {/* Bloc spécial Pause */}
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      isPaused || status === 'paused'
                        ? 'bg-[#D4A853]/10 border-[#D4A853]/40 text-[#F1F4F8]'
                        : 'bg-[#19202B] border-[#263142] text-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Pause className="w-4 h-4 text-[#D4A853]" />
                        <span className="font-bold text-xs uppercase tracking-wider">
                          Mise en Pause (Standby)
                        </span>
                      </div>
                      <label className="inline-flex items-center gap-2 font-semibold cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isPaused}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setIsPaused(val);
                            if (val && status !== 'paused') {
                              setStatus('paused');
                            } else if (!val && status === 'paused') {
                              setStatus('upcoming');
                            }
                          }}
                        />
                        <span>
                          {isPaused ? 'Pause active' : 'Activer la pause'}
                        </span>
                      </label>
                    </div>

                    {isPaused && (
                      <div className="space-y-3 pt-3 border-t border-[#D4A853]/25">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            'Rondes & Appariements officiels',
                            'Horaires et salle de jeu',
                            'Grille de départ / Elo des inscrits',
                            'Confirmation de participation',
                          ].map((field) => {
                            const checked = pausedFields.includes(field);
                            return (
                              <label
                                key={field}
                                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer ${
                                  checked
                                    ? 'bg-[#D4A853]/15 border-[#D4A853]/50 text-[#F1F4F8]'
                                    : 'bg-[#131820] border-[#232C3A] text-[#9BA7B8]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setPausedFields([...pausedFields, field]);
                                    } else {
                                      setPausedFields(
                                        pausedFields.filter((f) => f !== field)
                                      );
                                    }
                                  }}
                                />
                                <span>{field}</span>
                              </label>
                            );
                          })}
                        </div>

                        <input
                          type="text"
                          value={pausedNotes}
                          onChange={(e) => setPausedNotes(e.target.value)}
                          placeholder="Motif de la mise en pause..."
                          className={`${inputClass} bg-[#131820]`}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Objectif du tournoi
                      </label>
                      <input
                        type="text"
                        value={normTarget}
                        onChange={(e) => setNormTarget(e.target.value)}
                        placeholder="Ex: Viser 5/7 ou Top 10"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Classement final (Place)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={finalStanding}
                        onChange={(e) =>
                          setFinalStanding(Number(e.target.value))
                        }
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-[#9BA7B8] mb-1">
                        Notes et préparation
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Préparation sur la Caro-Kann..."
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Bloc saisie manuelle de la Performance et de l'Elo gagné */}
                  <div className="p-4 rounded-xl bg-[#19202B] border border-[#263142] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-[#F1F4F8]">
                          Performance & Bilan Elo (saisie manuelle optionnelle)
                        </div>
                        <p className="text-[11px] text-[#9BA7B8] mt-0.5">
                          Laissez vide pour calculer automatiquement à partir des rondes enregistrées.
                        </p>
                      </div>
                    </div>

                    <div
                      className={`grid grid-cols-1 ${
                        isFriendlyMode ? '' : 'sm:grid-cols-2'
                      } gap-4`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-[#9BA7B8]">
                            Performance réalisée (Elo)
                          </label>
                          {manualPerformance.trim() !== '' && (
                            <button
                              type="button"
                              onClick={() => setManualPerformance('')}
                              className="text-[11px] text-[#D4A853] hover:underline cursor-pointer"
                            >
                              Auto
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          min={400}
                          max={3800}
                          step={1}
                          value={manualPerformance}
                          onChange={(e) => setManualPerformance(e.target.value)}
                          placeholder="Auto (ex: 1842)"
                          className={`${inputClass} bg-[#131820] font-mono`}
                        />
                      </div>

                      {!isFriendlyMode && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-semibold text-[#9BA7B8]">
                              Elo gagné / perdu (pts)
                            </label>
                            {manualEloDelta.trim() !== '' && (
                              <button
                                type="button"
                                onClick={() => setManualEloDelta('')}
                                className="text-[11px] text-[#D4A853] hover:underline cursor-pointer"
                              >
                                Auto
                              </button>
                            )}
                          </div>
                          <input
                            type="number"
                            min={-500}
                            max={500}
                            step="0.1"
                            value={manualEloDelta}
                            onChange={(e) => setManualEloDelta(e.target.value)}
                            placeholder="Auto (ex: +18.4 ou -12.5)"
                            className={`${inputClass} bg-[#131820] font-mono`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 : RONDES & PARTIES DU TOURNOI */}
              {modalStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 p-3.5 bg-[#19202B] border border-[#263142] rounded-xl">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#F1F4F8]">
                        {editingId
                          ? 'Rondes du tournoi'
                          : `Rondes à enregistrer (${draftGames.length})`}
                      </h3>
                      <p className="text-xs text-[#9BA7B8]">
                        {editingId
                          ? 'Modifiables depuis la fiche détaillée du tournoi.'
                          : 'Ajoutez vos parties avec le résultat (1 Victoire, 2 Nulle, 3 Défaite).'}
                      </p>
                    </div>

                    {!editingId && (
                      <IconButton
                        variant="primary"
                        size="md"
                        label="Ajouter une ronde"
                        onClick={addDraftRound}
                      >
                        <Plus className="w-4 h-4" />
                      </IconButton>
                    )}
                  </div>

                  {editingId ? (
                    <div className="p-6 bg-[#19202B] border border-[#263142] rounded-xl text-center space-y-2">
                      <p className="text-xs font-semibold text-[#F1F4F8]">
                        Tournoi en cours de modification
                      </p>
                      <p className="text-xs text-[#9BA7B8]">
                        Passez à l'étape 4 pour vérifier puis sauvegarder vos modifications.
                      </p>
                    </div>
                  ) : draftGames.length === 0 ? (
                    <div className="p-8 bg-[#19202B]/50 border border-dashed border-[#323E52] rounded-xl text-center space-y-3">
                      <p className="text-xs font-semibold text-[#CBD5E1]">
                        Aucune ronde ajoutée pour l'instant.
                      </p>
                      <div className="flex justify-center">
                        <IconButton
                          variant="surface"
                          size="lg"
                          label="Ajouter la 1re ronde"
                          onClick={addDraftRound}
                        >
                          <Plus className="w-5 h-5" />
                        </IconButton>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {draftGames.map((dg) => (
                        <div
                          key={dg.tempId}
                          className="p-4 bg-[#19202B] border border-[#263142] rounded-xl space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-[#F1F4F8]">
                              Ronde #{dg.round}
                            </span>
                            <IconButton
                              variant="danger"
                              size="xs"
                              label="Retirer cette ronde"
                              onClick={() => removeDraftRound(dg.tempId)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                            <div className="lg:col-span-2">
                              <label className="block text-[11px] font-semibold text-[#9BA7B8] mb-1 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                Adversaire connu (A-Z)
                              </label>
                              <select
                                value={dg.opponentId}
                                onChange={(e) =>
                                  handleSelectOpponentForDraft(
                                    dg.tempId,
                                    e.target.value
                                  )
                                }
                                className={`${inputClass} bg-[#131820]`}
                              >
                                <option value="">-- Nouveau joueur --</option>
                                {sortedOpponents.map((opp) => (
                                  <option key={opp.id} value={opp.id}>
                                    {formatPlayerNameDisplay(
                                      opp.name,
                                      opp.isNameUncertain
                                    )}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="lg:col-span-2">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-semibold text-[#9BA7B8]">
                                  NOM, Prénom *
                                </label>
                                <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D4A853] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={dg.opponentNameUncertain}
                                    onChange={(e) =>
                                      updateDraftRound(dg.tempId, {
                                        opponentNameUncertain: e.target.checked,
                                      })
                                    }
                                  />
                                  Incertain (?)
                                </label>
                              </div>
                              <input
                                type="text"
                                value={dg.opponentName}
                                onChange={(e) =>
                                  updateDraftRound(dg.tempId, {
                                    opponentName: e.target.value,
                                  })
                                }
                                placeholder="NOM, Prénom"
                                className={`${inputClass} bg-[#131820]`}
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-semibold text-[#9BA7B8]">
                                  Son Elo
                                </label>
                                <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#9BA7B8] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={dg.opponentEloUnknown}
                                    onChange={(e) =>
                                      updateDraftRound(dg.tempId, {
                                        opponentEloUnknown: e.target.checked,
                                      })
                                    }
                                  />
                                  ?
                                </label>
                              </div>
                              {dg.opponentEloUnknown ? (
                                <div className="w-full px-2.5 py-2 font-mono font-bold bg-[#131820] border border-[#2B3647] rounded-xl text-[#D4A853] text-center">
                                  ?
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  value={dg.opponentElo}
                                  onChange={(e) =>
                                    updateDraftRound(dg.tempId, {
                                      opponentElo: Number(e.target.value),
                                    })
                                  }
                                  className={`${inputClass} bg-[#131820] font-mono`}
                                />
                              )}
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-[#9BA7B8] mb-1">
                                Ma Couleur
                              </label>
                              <select
                                value={dg.playerColor}
                                onChange={(e) =>
                                  updateDraftRound(dg.tempId, {
                                    playerColor: e.target.value as PlayerColor,
                                  })
                                }
                                className={`${inputClass} bg-[#131820]`}
                              >
                                <option value="White">Blancs</option>
                                <option value="Black">Noirs</option>
                              </select>
                            </div>

                            <div className="lg:col-span-3">
                              <label className="block text-[11px] font-semibold text-[#9BA7B8] mb-1">
                                Mon Résultat
                              </label>
                              <div className="grid grid-cols-3 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftRound(dg.tempId, {
                                      playerScore: 1,
                                    })
                                  }
                                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border cursor-pointer ${
                                    dg.playerScore === 1
                                      ? 'bg-emerald-500 text-[#06130E] border-emerald-400'
                                      : 'bg-[#131820] text-emerald-400 border-[#2B3647]'
                                  }`}
                                >
                                  1 · Victoire
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftRound(dg.tempId, {
                                      playerScore: 0.5,
                                    })
                                  }
                                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border cursor-pointer ${
                                    dg.playerScore === 0.5
                                      ? 'bg-[#D4A853] text-[#141007] border-[#E5C178]'
                                      : 'bg-[#131820] text-[#D4A853] border-[#2B3647]'
                                  }`}
                                >
                                  2 · Nulle
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftRound(dg.tempId, {
                                      playerScore: 0,
                                    })
                                  }
                                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border cursor-pointer ${
                                    dg.playerScore === 0
                                      ? 'bg-rose-500 text-white border-rose-400'
                                      : 'bg-[#131820] text-rose-400 border-[#2B3647]'
                                  }`}
                                >
                                  3 · Défaite
                                </button>
                              </div>
                            </div>

                            <div className="lg:col-span-3">
                              <label className="block text-[11px] font-semibold text-[#9BA7B8] mb-1">
                                Lien Chess.com
                              </label>
                              <input
                                type="url"
                                value={dg.chessComUrl}
                                onChange={(e) =>
                                  updateDraftRound(dg.tempId, {
                                    chessComUrl: e.target.value,
                                  })
                                }
                                placeholder="https://www.chess.com/analysis/..."
                                className={`${inputClass} bg-[#131820]`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ÉTAPE 4 : RÉCAPITULATIF & CONFIRMATION */}
              {modalStep === 4 && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[#F1F4F8] text-xs flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-emerald-300">
                        Vérification finale avant enregistrement
                      </div>
                      <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
                        Aucune modification n'est enregistrée automatiquement. Relisez les informations puis cliquez sur le bouton de validation vert en bas à droite.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#19202B] border border-[#263142] rounded-xl space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#F1F4F8]">
                      Récapitulatif des paramètres
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[#9BA7B8]">Nom :</span>{' '}
                        <strong className="text-[#F1F4F8]">
                          {name || 'Sans titre'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#9BA7B8]">Lieu :</span>{' '}
                        <strong className="text-[#F1F4F8]">
                          {location || 'Non précisé'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#9BA7B8]">Cadence :</span>{' '}
                        <strong className="text-[#F1F4F8]">
                          {timeControl} ({timeControlDetails})
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#9BA7B8]">Format :</span>{' '}
                        <strong className="text-[#F1F4F8]">{format}</strong>
                      </div>
                      <div>
                        <span className="text-[#9BA7B8]">Dates :</span>{' '}
                        <strong className="font-mono text-[#F1F4F8]">
                          {startDate} → {endDate}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#9BA7B8]">Statut :</span>{' '}
                        <strong className="text-[#D4A853]">
                          {isPaused || status === 'paused'
                            ? 'En pause'
                            : status === 'upcoming'
                            ? 'À venir'
                            : status === 'ongoing'
                            ? 'En cours'
                            : 'Terminé'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#9BA7B8]">Performance :</span>{' '}
                        <strong className="font-mono text-[#F1F4F8]">
                          {manualPerformance.trim() !== '' &&
                          Number(manualPerformance) > 0
                            ? `${Math.round(Number(manualPerformance))} (saisie)`
                            : 'Calcul automatique'}
                        </strong>
                      </div>
                      {!isFriendlyMode && (
                        <div>
                          <span className="text-[#9BA7B8]">Elo gagné :</span>{' '}
                          <strong
                            className={`font-mono ${
                              manualEloDelta.trim() !== '' &&
                              Number.isFinite(Number(manualEloDelta))
                                ? Number(manualEloDelta) >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                                : 'text-[#F1F4F8]'
                            }`}
                          >
                            {manualEloDelta.trim() !== '' &&
                            Number.isFinite(Number(manualEloDelta))
                              ? `${Number(manualEloDelta) >= 0 ? '+' : ''}${(
                                  Math.round(Number(manualEloDelta) * 10) / 10
                                ).toFixed(1)} (saisi)`
                              : 'Calcul automatique'}
                          </strong>
                        </div>
                      )}
                    </div>

                    {(isPaused || status === 'paused') && (
                      <div className="p-3 bg-[#D4A853]/10 border border-[#D4A853]/30 rounded-lg text-xs text-[#F1F4F8] space-y-1">
                        <div className="font-bold text-[#D4A853]">
                          Détails de la pause :
                        </div>
                        <div>
                          Éléments suspendus :{' '}
                          {pausedFields.join(', ') || 'Tournoi global'}
                        </div>
                        {pausedNotes && <div>Motif : « {pausedNotes} »</div>}
                      </div>
                    )}

                    {!editingId && (
                      <div className="text-xs text-[#9BA7B8]">
                        Rondes associées à créer :{' '}
                        <strong className="font-mono text-[#F1F4F8]">
                          {draftGames.length}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pied du modal avec Icônes Uniquement */}
              <div className="flex items-center justify-between pt-4 border-t border-[#232C3A]">
                <div>
                  {modalStep > 1 && (
                    <IconButton
                      variant="surface"
                      size="md"
                      label="Étape précédente"
                      onClick={() =>
                        setModalStep((prev) =>
                          prev > 1 ? ((prev - 1) as any) : 1
                        )
                      }
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
                      onClick={() =>
                        setModalStep((prev) =>
                          prev < 4 ? ((prev + 1) as any) : 4
                        )
                      }
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
                          : editingId
                          ? 'Confirmer les modifications'
                          : 'Confirmer et enregistrer le tournoi'
                      }
                      disabled={isSubmitting || !canConfirmSave}
                      onClick={() => handleExplicitSaveTournament()}
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

      {/* MODALE DE CONFIRMATION DE SUPPRESSION D'UN TOURNOI (3 secondes) */}
      <ConfirmDeleteModal
        isOpen={Boolean(tournamentToDelete)}
        title="Supprimer ce tournoi et toutes ses parties ?"
        subtitle="Cette action supprimera le tournoi ainsi que toutes les parties qui y sont rattachées."
        itemName={tournamentToDelete ? tournamentToDelete.name : ''}
        details={
          tournamentToDelete
            ? [
                {
                  label: 'Lieu & Dates',
                  value: `${tournamentToDelete.location} (${tournamentToDelete.startDate} → ${tournamentToDelete.endDate})`,
                },
                {
                  label: 'Cadence',
                  value: `${tournamentToDelete.timeControl} (${tournamentToDelete.timeControlDetails})`,
                },
              ]
            : []
        }
        onCancel={() => setTournamentToDelete(null)}
        onConfirm={async () => {
          if (!tournamentToDelete) return;
          const id = tournamentToDelete.id;
          if (inspectedTournamentId === id) setInspectedTournamentId(null);
          await onDeleteTournament(id);
          setTournamentToDelete(null);
        }}
      />

      {/* MODALE DE CONFIRMATION DE SUPPRESSION D'UNE PARTIE (3 secondes) */}
      <ConfirmDeleteModal
        isOpen={Boolean(gameToDelete)}
        title="Supprimer cette ronde ?"
        subtitle="Vous êtes sur le point de supprimer cette partie du tournoi."
        itemName={
          gameToDelete
            ? `Ronde ${gameToDelete.round} vs ${formatPlayerNameDisplay(
                gameToDelete.opponentName,
                gameToDelete.opponentNameUncertain
              )}`
            : ''
        }
        details={
          gameToDelete
            ? [
                { label: 'Tournoi', value: gameToDelete.tournamentName },
                { label: 'Date', value: gameToDelete.datePlayed },
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
