import React, { useMemo, useState } from 'react';
import {
  Edit3,
  ExternalLink,
  FileText,
  Info,
  Plus,
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
  const [normTarget, setNormTarget] = useState('');
  const [notes, setNotes] = useState('');

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
    const std = Number(opp.standardElo) || Number(opp.elo) || 1500;
    if (tc === 'Rapid') return Number(opp.rapidElo) || std;
    if (tc === 'Blitz') return Number(opp.blitzElo) || std;
    return std;
  };

  const isOpponentEloUnknownForCadence = (
    opp: OpponentPlayer,
    tc: TimeControlCategory
  ) => {
    if (opp.isEloUnknown) return true;
    if (tc === 'Rapid') return Boolean(opp.isRapidEloUnknown);
    if (tc === 'Blitz') return Boolean(opp.isBlitzEloUnknown);
    return Boolean(opp.isStandardEloUnknown);
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
        const effectiveEloDelta = isFriendlyMode ? 0 : gamesEloDelta;
        const effectivePerf = gamesPerf;

        return {
          ...t,
          games: tGames,
          wins,
          draws,
          losses,
          effectiveScore,
          effectiveEloDelta,
          effectivePerf,
        };
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [tournaments, games, isFriendlyMode]);

  const filteredTournaments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedTournaments.filter((t) => {
      if (cadenceFilter !== 'ALL' && t.timeControl !== cadenceFilter) {
        return false;
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        (t.normTarget || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedTournaments, searchQuery, cadenceFilter]);

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
    setNormTarget('');
    setNotes('');
    setDraftGames([]);
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
    setStatus(t.status || 'completed');
    setNormTarget(t.normTarget || '');
    setNotes(t.notes);
    setDraftGames([]);
    setIsModalOpen(true);
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

  const handleSubmitTournament = async (e: React.FormEvent) => {
    e.preventDefault();
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
          status,
          normTarget: normTarget.trim(),
          notes,
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

  return (
    <div className="space-y-5">
      {/* En-tête de la section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {isFriendlyMode
              ? 'Sessions & Tournois Amicaux'
              : 'Mes Tournois Officiels'}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {isFriendlyMode
              ? 'Regroupez vos soirées club ou tournois amicaux (sans impact Elo).'
              : 'Consultez vos tournois homologués, performances et rondes jouées.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {isFriendlyMode
            ? 'Créer une session amicale'
            : 'Enregistrer un tournoi'}
        </button>
      </div>

      {/* Filtres de recherche et cadence */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un tournoi par nom, ville..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-slate-900"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {(['ALL', 'Standard', 'Rapid', 'Blitz'] as const).map((cad) => {
            const active = cadenceFilter === cad;
            return (
              <button
                key={cad}
                type="button"
                onClick={() => setCadenceFilter(cad)}
                className={`px-3 py-1.5 rounded-md font-semibold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cad === 'ALL'
                  ? 'Toutes cadences'
                  : cad === 'Standard'
                  ? 'Classique'
                  : cad === 'Rapid'
                  ? 'Rapide'
                  : 'Blitz'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tableau des tournois */}
      {filteredTournaments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3 shadow-2xs">
          <Trophy className="w-7 h-7 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-900">
            Aucun tournoi enregistré.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Ajouter un tournoi
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
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
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredTournaments.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setInspectedTournamentId(t.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{t.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {t.location} · Du {t.startDate} au {t.endDate}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded border bg-slate-100 text-slate-800 border-slate-300">
                        {t.timeControl === 'Standard'
                          ? 'Classique'
                          : t.timeControl === 'Rapid'
                          ? 'Rapide'
                          : 'Blitz'}
                      </span>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {t.timeControlDetails}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center font-mono">
                      <div className="font-bold text-slate-900">
                        {t.effectiveScore} / {t.games.length || t.totalRounds}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        +{t.wins} ={t.draws} -{t.losses}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                      {t.finalRank
                        ? `${t.finalRank}e / ${t.totalPlayers || '?'}`
                        : '—'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {t.effectivePerf || '—'}
                    </td>

                    {!isFriendlyMode && (
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] border ${
                            t.effectiveEloDelta >= 0
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {t.effectiveEloDelta >= 0
                            ? `+${t.effectiveEloDelta.toFixed(1)}`
                            : t.effectiveEloDelta.toFixed(1)}
                        </span>
                      </td>
                    )}

                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectedTournamentId(t.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer"
                        >
                          <Info className="w-3.5 h-3.5 text-slate-600" />
                          Détails ({t.games.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(t)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
                          title="Modifier ce tournoi"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTournamentToDelete(t)}
                          className="p-1.5 text-slate-500 hover:text-rose-700 rounded-md hover:bg-rose-50 cursor-pointer"
                          title="Supprimer ce tournoi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALE COMPLÈTE D'INFORMATION SUR LE TOURNOI & SES PARTIES */}
      {inspectedTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-5xl w-full p-6 space-y-6 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded bg-slate-200 text-slate-800">
                    {inspectedTournament.timeControl === 'Standard'
                      ? 'Classique'
                      : inspectedTournament.timeControl === 'Rapid'
                      ? 'Rapide'
                      : 'Blitz'}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {inspectedTournament.timeControlDetails} · Format{' '}
                    {inspectedTournament.format}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {inspectedTournament.name}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {inspectedTournament.location} · Du{' '}
                  {inspectedTournament.startDate} au{' '}
                  {inspectedTournament.endDate}
                  {inspectedTournament.normTarget &&
                    ` · Objectif : ${inspectedTournament.normTarget}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickRoundOpenFor(
                      quickRoundOpenFor === inspectedTournament.id
                        ? null
                        : inspectedTournament.id
                    );
                    setQrRound(inspectedTournament.games.length + 1);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une ronde
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(inspectedTournament)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => setTournamentToDelete(inspectedTournament)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedTournamentId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cartes de statistiques du tournoi */}
            <div
              className={`grid grid-cols-2 ${
                isFriendlyMode ? 'sm:grid-cols-3' : 'sm:grid-cols-4'
              } gap-3 font-mono`}
            >
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] font-sans font-bold text-slate-500">
                  Score Final
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {inspectedTournament.effectiveScore} /{' '}
                  {inspectedTournament.games.length ||
                    inspectedTournament.totalRounds}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  +{inspectedTournament.wins}V · ={inspectedTournament.draws}N · -
                  {inspectedTournament.losses}D
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] font-sans font-bold text-slate-500">
                  Classement Final
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {inspectedTournament.finalRank
                    ? `${inspectedTournament.finalRank}e`
                    : '—'}
                </div>
                <div className="text-xs font-sans text-slate-500 mt-0.5">
                  sur {inspectedTournament.totalPlayers || '?'} joueurs
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] font-sans font-bold text-slate-500">
                  Performance
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {inspectedTournament.effectivePerf || '—'}
                </div>
                <div className="text-xs font-sans text-slate-500 mt-0.5">
                  Performance estimée
                </div>
              </div>

              {!isFriendlyMode && (
                <div
                  className={`p-3.5 rounded-lg border ${
                    inspectedTournament.effectiveEloDelta >= 0
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="text-[11px] font-sans font-bold text-slate-700">
                    Bilan Elo du Tournoi
                  </div>
                  <div
                    className={`text-xl font-bold mt-1 ${
                      inspectedTournament.effectiveEloDelta >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {inspectedTournament.effectiveEloDelta >= 0
                      ? `+${inspectedTournament.effectiveEloDelta.toFixed(1)}`
                      : inspectedTournament.effectiveEloDelta.toFixed(1)}
                  </div>
                  <div className="text-xs font-sans text-slate-500 mt-0.5">
                    Points Elo gagnés/perdus
                  </div>
                </div>
              )}
            </div>

            {inspectedTournament.notes && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                <strong className="text-slate-900">Notes du tournoi :</strong>{' '}
                {inspectedTournament.notes}
              </div>
            )}

            {/* Formulaire d'ajout rapide d'une ronde */}
            {quickRoundOpenFor === inspectedTournament.id && (
              <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Ajouter une ronde dans « {inspectedTournament.name} »
                  </h4>
                  <button
                    type="button"
                    onClick={() => setQuickRoundOpenFor(null)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ronde
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={qrRound}
                      onChange={(e) => setQrRound(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-md"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                      Choisir un joueur déjà affronté (A-Z)
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
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                    >
                      <option value="">-- Nouveau joueur (saisir) --</option>
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
                      <label className="font-bold text-slate-700">
                        NOM, Prénom *
                      </label>
                      <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qrOpponentNameUncertain}
                          onChange={(e) =>
                            setQrOpponentNameUncertain(e.target.checked)
                          }
                          className="rounded border-slate-300"
                        />
                        Incertain (?)
                      </label>
                    </div>
                    <input
                      type="text"
                      value={qrOpponentName}
                      onChange={(e) => setQrOpponentName(e.target.value)}
                      placeholder="Ex: VANDENBERGHE, Lucas"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-semibold"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">
                        Son Elo
                      </label>
                      <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qrOpponentEloUnknown}
                          onChange={(e) =>
                            setQrOpponentEloUnknown(e.target.checked)
                          }
                          className="rounded border-slate-300"
                        />
                        ?
                      </label>
                    </div>
                    {qrOpponentEloUnknown ? (
                      <div className="w-full px-3 py-2 font-mono font-bold bg-slate-100 border border-slate-300 rounded-md text-slate-600 text-center">
                        ?
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={qrOpponentElo}
                        onChange={(e) => setQrOpponentElo(Number(e.target.value))}
                        className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-md"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ma couleur
                    </label>
                    <select
                      value={qrColor}
                      onChange={(e) => setQrColor(e.target.value as PlayerColor)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
                    >
                      <option value="White">Blancs</option>
                      <option value="Black">Noirs</option>
                    </select>
                  </div>

                  {/* Résultat par rapport à moi : 3 boutons */}
                  <div className="lg:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Mon Résultat
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setQrScore(1)}
                        className={`py-2 px-3 rounded-md font-bold text-xs border transition-all cursor-pointer ${
                          qrScore === 1
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        1 · Victoire
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrScore(0.5)}
                        className={`py-2 px-3 rounded-md font-bold text-xs border transition-all cursor-pointer ${
                          qrScore === 0.5
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                        }`}
                      >
                        2 · Nulle
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrScore(0)}
                        className={`py-2 px-3 rounded-md font-bold text-xs border transition-all cursor-pointer ${
                          qrScore === 0
                            ? 'bg-rose-700 text-white border-rose-700'
                            : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50'
                        }`}
                      >
                        3 · Défaite
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Lien Chess.com (facultatif)
                    </label>
                    <input
                      type="url"
                      value={qrChessComUrl}
                      onChange={(e) => setQrChessComUrl(e.target.value)}
                      placeholder="https://www.chess.com/analysis/..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
                    />
                  </div>

                  <div className="lg:col-span-6">
                    <label className="block font-bold text-slate-700 mb-1">
                      PGN de la partie (facultatif — copier/coller)
                    </label>
                    <textarea
                      rows={2}
                      value={qrPgn}
                      onChange={(e) => setQrPgn(e.target.value)}
                      placeholder="1. e4 e5 2. Nf3 Nc6..."
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickRoundOpenFor(null)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveQuickRound(inspectedTournament)}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                  >
                    Enregistrer la ronde
                  </button>
                </div>
              </div>
            )}

            {/* Liste des rondes du tournoi */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Rondes jouées dans ce tournoi ({inspectedTournament.games.length})
              </h3>

              {inspectedTournament.games.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                  Aucune ronde détaillée pour ce tournoi. Cliquez sur « Ajouter une ronde » ci-dessus.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="py-2.5 px-4">Ronde</th>
                        <th className="py-2.5 px-4">Adversaire (NOM, Prénom)</th>
                        <th className="py-2.5 px-4 text-right">Son Elo</th>
                        <th className="py-2.5 px-4">Ma Couleur</th>
                        <th className="py-2.5 px-4 text-center">Mon Résultat</th>
                        {!isFriendlyMode && (
                          <th className="py-2.5 px-4 text-right">Elo Gagné</th>
                        )}
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
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
                          <tr key={g.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
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
                                className="font-bold text-slate-900 hover:underline text-left flex items-center gap-1.5 cursor-pointer"
                              >
                                {g.opponentTitle !== 'None' && (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                                    {g.opponentTitle}
                                  </span>
                                )}
                                <span>
                                  {formatPlayerNameLastFirst(g.opponentName)}
                                </span>
                                {uncertain && (
                                  <span
                                    className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded"
                                    title="Nom incertain"
                                  >
                                    ?
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                              {eloUnknown ? (
                                <span
                                  className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300 rounded"
                                  title="Elo inconnu"
                                >
                                  ?
                                </span>
                              ) : (
                                g.opponentElo
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-700">
                              {g.playerColor === 'White' ? 'Blancs' : 'Noirs'}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono font-bold">
                              <span
                                className={
                                  g.playerScore === 1
                                    ? 'text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200'
                                    : g.playerScore === 0
                                    ? 'text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200'
                                    : 'text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200'
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
                              <td className="py-2.5 px-4 text-right font-mono font-bold">
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
                            )}
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspectedTournamentId(null);
                                    onOpenGameInViewer(g);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  PGN & Détails
                                </button>
                                {g.chessComUrl && (
                                  <a
                                    href={g.chessComUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md"
                                    title="Analyser sur Chess.com"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setGameToDelete(g)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
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

      {/* Modal Créer / Modifier un Tournoi */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full p-6 space-y-6 my-8 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingId
                    ? 'Modifier les informations du tournoi'
                    : isFriendlyMode
                    ? 'Créer une session ou un tournoi amical'
                    : 'Enregistrer un nouveau tournoi'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Renseignez les informations générales et ajoutez vos rondes si vous le souhaitez.
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

            <form onSubmit={handleSubmitTournament} className="space-y-6 text-xs">
              {/* 1. Infos générales du tournoi */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nom du tournoi / de la session *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Open International d'Échecs de Cappelle-la-Grande"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Lieu / Ville *
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: Lille, FRA"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cadence *
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white font-semibold"
                  >
                    <option value="Standard">Classique (Standard)</option>
                    <option value="Rapid">Rapide</option>
                    <option value="Blitz">Blitz</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Détails de la cadence
                  </label>
                  <input
                    type="text"
                    value={timeControlDetails}
                    onChange={(e) => setTimeControlDetails(e.target.value)}
                    placeholder="90m + 30s/coup"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Format
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Swiss">Système Suisse</option>
                    <option value="Round Robin">Toutes rondes</option>
                    <option value="Team">Interclubs / Équipes</option>
                    <option value="Knockout">Coupe / KO</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md"
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
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md"
                  />
                </div>

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
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nombre total de joueurs
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={totalPlayers}
                    onChange={(e) => setTotalPlayers(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mon classement final (Place)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={finalStanding}
                    onChange={(e) => setFinalStanding(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Objectif du tournoi
                  </label>
                  <input
                    type="text"
                    value={normTarget}
                    onChange={(e) => setNormTarget(e.target.value)}
                    placeholder="Ex: Podium, Top 10..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Notes / Bilan personnel
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Bonne préparation d'ouverture..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              {/* 2. Ajouter les parties du tournoi */}
              {!editingId && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Parties jouées dans ce tournoi ({draftGames.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Cochez « ? » si vous n’êtes pas sûr du nom de l’adversaire ou de son Elo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addDraftRound}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-900 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter une ronde
                    </button>
                  </div>

                  {draftGames.length > 0 && (
                    <div className="space-y-4">
                      {draftGames.map((dg) => (
                        <div
                          key={dg.tempId}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-900">
                              Ronde #{dg.round}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeDraftRound(dg.tempId)}
                              className="text-rose-600 hover:underline text-xs font-bold cursor-pointer"
                            >
                              Retirer cette ronde
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                            <div className="lg:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                                Choisir un joueur existant (A-Z)
                              </label>
                              <select
                                value={dg.opponentId}
                                onChange={(e) =>
                                  handleSelectOpponentForDraft(
                                    dg.tempId,
                                    e.target.value
                                  )
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                              >
                                <option value="">
                                  -- Nouveau joueur (saisir) --
                                </option>
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
                                <label className="text-[11px] font-bold text-slate-700">
                                  NOM, Prénom *
                                </label>
                                <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={dg.opponentNameUncertain}
                                    onChange={(e) =>
                                      updateDraftRound(dg.tempId, {
                                        opponentNameUncertain: e.target.checked,
                                      })
                                    }
                                    className="rounded border-slate-300"
                                  />
                                  Nom incertain (?)
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
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                ID FIDE
                              </label>
                              <input
                                type="text"
                                value={dg.opponentFideId}
                                onChange={(e) =>
                                  handleFideOrFfeLookupInDraft(
                                    dg.tempId,
                                    'fideId',
                                    e.target.value
                                  )
                                }
                                placeholder="Ex: 65104823"
                                className="w-full px-2.5 py-1.5 font-mono bg-white border border-slate-300 rounded-md"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                ID FFE
                              </label>
                              <input
                                type="text"
                                value={dg.opponentFfeId}
                                onChange={(e) =>
                                  handleFideOrFfeLookupInDraft(
                                    dg.tempId,
                                    'ffeId',
                                    e.target.value
                                  )
                                }
                                placeholder="Ex: K59412"
                                className="w-full px-2.5 py-1.5 font-mono uppercase bg-white border border-slate-300 rounded-md"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-slate-600">
                                  Son Elo
                                </label>
                                <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={dg.opponentEloUnknown}
                                    onChange={(e) =>
                                      updateDraftRound(dg.tempId, {
                                        opponentEloUnknown: e.target.checked,
                                      })
                                    }
                                    className="rounded border-slate-300"
                                  />
                                  ?
                                </label>
                              </div>
                              {dg.opponentEloUnknown ? (
                                <div className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-100 border border-slate-300 rounded-md text-slate-600 text-center">
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
                                  className="w-full px-2.5 py-1.5 font-mono bg-white border border-slate-300 rounded-md"
                                />
                              )}
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Ma Couleur
                              </label>
                              <select
                                value={dg.playerColor}
                                onChange={(e) =>
                                  updateDraftRound(dg.tempId, {
                                    playerColor: e.target.value as PlayerColor,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                              >
                                <option value="White">Blancs</option>
                                <option value="Black">Noirs</option>
                              </select>
                            </div>

                            {/* Score par rapport à moi : 3 boutons */}
                            <div className="lg:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
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
                                  className={`py-1.5 px-2 rounded-md font-bold text-[11px] border cursor-pointer ${
                                    dg.playerScore === 1
                                      ? 'bg-emerald-700 text-white border-emerald-700'
                                      : 'bg-white text-emerald-800 border-emerald-300'
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
                                  className={`py-1.5 px-2 rounded-md font-bold text-[11px] border cursor-pointer ${
                                    dg.playerScore === 0.5
                                      ? 'bg-amber-600 text-white border-amber-600'
                                      : 'bg-white text-amber-800 border-amber-300'
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
                                  className={`py-1.5 px-2 rounded-md font-bold text-[11px] border cursor-pointer ${
                                    dg.playerScore === 0
                                      ? 'bg-rose-700 text-white border-rose-700'
                                      : 'bg-white text-rose-800 border-rose-300'
                                  }`}
                                >
                                  3 · Défaite
                                </button>
                              </div>
                            </div>

                            <div className="lg:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Lien d’analyse Chess.com (facultatif)
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
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                              />
                            </div>

                            <div className="lg:col-span-6">
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                PGN de la partie (facultatif — copier/coller)
                              </label>
                              <textarea
                                rows={2}
                                value={dg.pgn}
                                onChange={(e) =>
                                  updateDraftRound(dg.tempId, {
                                    pgn: e.target.value,
                                  })
                                }
                                placeholder="1. d4 Nf6 2. c4 e6..."
                                className="w-full px-2.5 py-1.5 font-mono bg-white border border-slate-300 rounded-md"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Enregistrement...'
                    : editingId
                    ? 'Enregistrer les modifications'
                    : 'Enregistrer'}
                </button>
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
