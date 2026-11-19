import React, { useMemo, useRef, useState } from 'react';
import {
  Calculator,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  Plus,
  RotateCcw,
  ShieldCheck,
  Table2,
  Trash2,
  TrendingUp,
  Trophy,
  UserCheck,
  X,
} from 'lucide-react';
import {
  FideGame,
  MonthlyRatingRecord,
  PlayerProfile,
  TimeControlCategory,
  Tournament,
  TwoFactorAuthConfig,
} from '../types/fide';
import {
  calculateFideEloChange,
  calculateFideExpectedScore,
  calculateFidePerformanceRating,
  formatPeriodLabel,
  getFidePublicationPeriodFromDate,
} from '../utils/fideMath';
import { formatPlayerNameDisplay } from '../utils/fideValidation';
import { EloEvolutionChart } from './EloEvolutionChart';
import { FederationFlag } from './FederationFlag';
import { IconButton } from './IconButton';
import { TwoFactorChallengeModal } from './TwoFactorChallengeModal';

function formatFideMatrixPeriod(period: string): string {
  const [year, month] = period.split('-');
  const shortMonths = [
    'Jan',
    'Fév',
    'Mar',
    'Avr',
    'Mai',
    'Juin',
    'Juil',
    'Août',
    'Sep',
    'Oct',
    'Nov',
    'Déc',
  ];
  const mIdx = parseInt(month, 10) - 1;
  if (year && mIdx >= 0 && mIdx < 12) {
    return `${year}-${shortMonths[mIdx]}`;
  }
  return period;
}

function isCadencePlayed(
  rec: MonthlyRatingRecord,
  cadence: TimeControlCategory
): boolean {
  if (cadence === 'Standard') {
    return typeof rec.standardPlayed === 'boolean'
      ? rec.standardPlayed
      : rec.standardGamesCount > 0 || rec.standardDelta !== 0;
  }
  if (cadence === 'Rapid') {
    return typeof rec.rapidPlayed === 'boolean'
      ? rec.rapidPlayed
      : (rec.rapidGamesCount ?? 0) > 0 || (rec.rapidDelta ?? 0) !== 0;
  }
  return typeof rec.blitzPlayed === 'boolean'
    ? rec.blitzPlayed
    : (rec.blitzGamesCount ?? 0) > 0 || (rec.blitzDelta ?? 0) !== 0;
}

function getCadenceDelta(
  rec: MonthlyRatingRecord,
  cadence: TimeControlCategory
): number {
  if (cadence === 'Standard') return Math.round((rec.standardDelta || 0) * 10) / 10;
  if (cadence === 'Rapid') return Math.round((rec.rapidDelta || 0) * 10) / 10;
  return Math.round((rec.blitzDelta || 0) * 10) / 10;
}

function getCadenceGamesCount(
  rec: MonthlyRatingRecord,
  cadence: TimeControlCategory
): number {
  if (cadence === 'Standard') return rec.standardGamesCount || 0;
  if (cadence === 'Rapid') return rec.rapidGamesCount || 0;
  return rec.blitzGamesCount || 0;
}

interface MonthlyDraft {
  id: string;
  period: string;
  standardElo: string;
  rapidElo: string;
  blitzElo: string;
  standardPlayed: boolean;
  standardDelta: string;
  standardGamesCount: string;
  rapidPlayed: boolean;
  rapidDelta: string;
  rapidGamesCount: string;
  blitzPlayed: boolean;
  blitzDelta: string;
  blitzGamesCount: string;
  fideRankNational: number;
  notes: string;
}

function recordToDraft(r: MonthlyRatingRecord): MonthlyDraft {
  return {
    id: r.id,
    period: r.period,
    standardElo: String(r.standardElo),
    rapidElo: String(r.rapidElo),
    blitzElo: String(r.blitzElo),
    standardPlayed: isCadencePlayed(r, 'Standard'),
    standardDelta: String(r.standardDelta ?? 0),
    standardGamesCount: String(r.standardGamesCount ?? 0),
    rapidPlayed: isCadencePlayed(r, 'Rapid'),
    rapidDelta: String(r.rapidDelta ?? 0),
    rapidGamesCount: String(r.rapidGamesCount ?? 0),
    blitzPlayed: isCadencePlayed(r, 'Blitz'),
    blitzDelta: String(r.blitzDelta ?? 0),
    blitzGamesCount: String(r.blitzGamesCount ?? 0),
    fideRankNational: r.fideRankNational || 0,
    notes: r.notes || '',
  };
}

function draftToRecordInput(
  d: MonthlyDraft
): Omit<MonthlyRatingRecord, 'id' | 'ownerId'> {
  const parseNum = (s: string, fallback = 0) => {
    const n = parseFloat(String(s).replace(',', '.').replace('+', ''));
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    period: d.period,
    standardElo: Math.round(parseNum(d.standardElo, 1500)),
    rapidElo: Math.round(parseNum(d.rapidElo, 1500)),
    blitzElo: Math.round(parseNum(d.blitzElo, 1500)),
    standardPlayed: d.standardPlayed,
    standardDelta: d.standardPlayed
      ? Math.round(parseNum(d.standardDelta, 0) * 10) / 10
      : 0,
    standardGamesCount: d.standardPlayed
      ? Math.max(0, Math.round(parseNum(d.standardGamesCount, 0)))
      : 0,
    rapidPlayed: d.rapidPlayed,
    rapidDelta: d.rapidPlayed
      ? Math.round(parseNum(d.rapidDelta, 0) * 10) / 10
      : 0,
    rapidGamesCount: d.rapidPlayed
      ? Math.max(0, Math.round(parseNum(d.rapidGamesCount, 0)))
      : 0,
    blitzPlayed: d.blitzPlayed,
    blitzDelta: d.blitzPlayed
      ? Math.round(parseNum(d.blitzDelta, 0) * 10) / 10
      : 0,
    blitzGamesCount: d.blitzPlayed
      ? Math.max(0, Math.round(parseNum(d.blitzGamesCount, 0)))
      : 0,
    fideRankNational: d.fideRankNational || 0,
    notes: d.notes || '',
  };
}

interface MonthlyCadenceCell {
  cadence: TimeControlCategory;
  hasActivity: boolean;
  delta: number;
  isManualRecord: boolean;
  games: FideGame[];
  manualTournaments: Tournament[];
  recordFallback?: {
    gamesCount: number;
    delta: number;
    notes: string;
  };
}

interface PendingMonthlySaveAction {
  mode: 'add' | 'single' | 'bulk';
  title: string;
  subtitle: string;
  itemLabel: string;
  details: { label: string; value: string }[];
  updates: Array<{
    input: Omit<MonthlyRatingRecord, 'id' | 'ownerId'>;
    existingId?: string;
  }>;
}

interface StatisticsSectionProps {
  records: MonthlyRatingRecord[];
  games: FideGame[];
  tournaments?: Tournament[];
  profile: PlayerProfile;
  onSaveRatingRecord: (
    input: Omit<MonthlyRatingRecord, 'id' | 'ownerId'>,
    existingId?: string
  ) => Promise<void>;
  onSaveRatingRecordsBulk: (
    updates: Array<{
      input: Omit<MonthlyRatingRecord, 'id' | 'ownerId'>;
      existingId?: string;
    }>
  ) => Promise<void>;
  onDeleteRatingRecord: (id: string) => Promise<void>;
  onOpenProfileModal: () => void;
  twoFactorAuth?: TwoFactorAuthConfig;
  onUpdateTwoFactorAuth: (
    next: TwoFactorAuthConfig | undefined
  ) => Promise<void>;
}

export const StatisticsSection: React.FC<StatisticsSectionProps> = ({
  records,
  games,
  tournaments = [],
  profile,
  onSaveRatingRecord,
  onSaveRatingRecordsBulk,
  onDeleteRatingRecord,
  onOpenProfileModal,
  twoFactorAuth,
  onUpdateTwoFactorAuth,
}) => {
  const editorSectionRef = useRef<HTMLDivElement | null>(null);

  // Éditeur en ligne (par ligne ou tout le tableau)
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draftsById, setDraftsById] = useState<Record<string, MonthlyDraft>>({});

  // Modale d'ajout d'un nouveau mois
  const [isAddMonthOpen, setIsAddMonthOpen] = useState(false);
  const [newMonthDraft, setNewMonthDraft] = useState<MonthlyDraft>(() => ({
    id: '',
    period: new Date().toISOString().slice(0, 7),
    standardElo: String(profile.standardElo),
    rapidElo: String(profile.rapidElo),
    blitzElo: String(profile.blitzElo),
    standardPlayed: true,
    standardDelta: '0',
    standardGamesCount: '0',
    rapidPlayed: false,
    rapidDelta: '0',
    rapidGamesCount: '0',
    blitzPlayed: false,
    blitzDelta: '0',
    blitzGamesCount: '0',
    fideRankNational: 0,
    notes: '',
  }));

  // Actions protégées par A2F Microsoft Authenticator
  const [pendingMonthlySave, setPendingMonthlySave] =
    useState<PendingMonthlySaveAction | null>(null);
  const [recordToDelete, setRecordToDelete] =
    useState<MonthlyRatingRecord | null>(null);

  // Simulateur Elo interactif
  const [simPlayerElo, setSimPlayerElo] = useState(profile.standardElo);
  const [simOppElo, setSimOppElo] = useState(1750);
  const [simKFactor, setSimKFactor] = useState<10 | 20 | 40>(profile.kFactor);

  // Matrice des variations mensuelles (style FIDE)
  const [showAllMonthlyPeriods, setShowAllMonthlyPeriods] = useState(false);
  const [selectedVariationCell, setSelectedVariationCell] = useState<{
    period: string;
    cadence: TimeControlCategory;
  } | null>(null);

  const sortedRatings = useMemo(
    () => [...records].sort((a, b) => b.period.localeCompare(a.period)),
    [records]
  );

  // Statistiques par cadence
  const cadenceStats = useMemo(() => {
    const computeFor = (tc: 'Standard' | 'Rapid' | 'Blitz', currentElo: number) => {
      const list = games.filter((g) => g.timeControl === tc);
      const count = list.length;
      const wins = list.filter((g) => g.playerScore === 1).length;
      const draws = list.filter((g) => g.playerScore === 0.5).length;
      const losses = list.filter((g) => g.playerScore === 0).length;
      const score = list.reduce((acc, g) => acc + g.playerScore, 0);
      const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;
      const drawRate = count > 0 ? Math.round((draws / count) * 100) : 0;
      const lossRate = count > 0 ? Math.max(0, 100 - winRate - drawRate) : 0;

      const manualTourneysForTc = tournaments.filter(
        (t) =>
          t.timeControl === tc &&
          t.manualEloDelta !== undefined &&
          t.manualEloDelta !== null &&
          !Number.isNaN(Number(t.manualEloDelta))
      );
      const manualIds = new Set(manualTourneysForTc.map((t) => t.id));
      const gamesNet = list
        .filter((g) => !manualIds.has(g.tournamentId))
        .reduce((acc, g) => acc + g.eloChange, 0);
      const manualNet = manualTourneysForTc.reduce(
        (acc, t) => acc + Number(t.manualEloDelta),
        0
      );
      const netElo = Math.round((gamesNet + manualNet) * 10) / 10;

      const perf = calculateFidePerformanceRating(list);
      const avgOpp =
        count > 0
          ? Math.round(list.reduce((acc, g) => acc + g.opponentElo, 0) / count)
          : 0;
      return {
        tc,
        currentElo,
        count,
        wins,
        draws,
        losses,
        score,
        winRate,
        drawRate,
        lossRate,
        netElo,
        perf,
        avgOpp,
      };
    };

    const latestRecord = sortedRatings[0];

    return [
      {
        label: 'Classique (Standard)',
        accentText: 'text-emerald-400',
        eloColor: 'text-emerald-400',
        ...computeFor(
          'Standard',
          latestRecord ? latestRecord.standardElo : profile.standardElo
        ),
      },
      {
        label: 'Rapide',
        accentText: 'text-[#D4A853]',
        eloColor: 'text-[#D4A853]',
        ...computeFor(
          'Rapid',
          latestRecord ? latestRecord.rapidElo : profile.rapidElo
        ),
      },
      {
        label: 'Blitz',
        accentText: 'text-sky-400',
        eloColor: 'text-sky-400',
        ...computeFor(
          'Blitz',
          latestRecord ? latestRecord.blitzElo : profile.blitzElo
        ),
      },
    ];
  }, [games, tournaments, sortedRatings, profile]);

  // Tableau des variations d'Elo par mois et par cadence :
  // Un tournoi ou une partie joué(e) au mois M compte pour la mise à jour FIDE du mois suivant (M+1).
  const monthlyVariations = useMemo(() => {
    const periodSet = new Set<string>();
    const isValidPeriod = (p: string | undefined): p is string =>
      Boolean(p && /^\d{4}-\d{2}$/.test(p));

    const tournamentFidePeriodMap = new Map<string, string>();
    tournaments.forEach((t) => {
      const fidePeriod = getFidePublicationPeriodFromDate(
        t.endDate || t.startDate
      );
      if (isValidPeriod(fidePeriod)) {
        tournamentFidePeriodMap.set(t.id, fidePeriod);
      }
    });

    const getGameFidePeriod = (g: FideGame): string => {
      if (g.tournamentId && tournamentFidePeriodMap.has(g.tournamentId)) {
        return tournamentFidePeriodMap.get(g.tournamentId)!;
      }
      return getFidePublicationPeriodFromDate(g.datePlayed);
    };

    games.forEach((g) => {
      const p = getGameFidePeriod(g);
      if (isValidPeriod(p)) periodSet.add(p);
    });
    tournaments.forEach((t) => {
      const p = getFidePublicationPeriodFromDate(t.endDate || t.startDate);
      if (isValidPeriod(p)) periodSet.add(p);
    });
    records.forEach((r) => {
      if (isValidPeriod(r.period)) periodSet.add(r.period);
    });

    const periods = Array.from(periodSet).sort((a, b) => b.localeCompare(a));
    const recordsByPeriod = new Map<string, MonthlyRatingRecord>();
    records.forEach((r) => {
      if (isValidPeriod(r.period)) {
        recordsByPeriod.set(r.period, r);
      }
    });

    const manualTournamentIds = new Set(
      tournaments
        .filter(
          (t) =>
            t.manualEloDelta !== undefined &&
            t.manualEloDelta !== null &&
            !Number.isNaN(Number(t.manualEloDelta))
        )
        .map((t) => t.id)
    );

    const buildCell = (
      period: string,
      cadence: TimeControlCategory
    ): MonthlyCadenceCell => {
      const periodGames = games
        .filter(
          (g) => getGameFidePeriod(g) === period && g.timeControl === cadence
        )
        .sort((a, b) => b.datePlayed.localeCompare(a.datePlayed));

      const manualTourneys = tournaments.filter(
        (t) =>
          t.timeControl === cadence &&
          getFidePublicationPeriodFromDate(t.endDate || t.startDate) ===
            period &&
          t.manualEloDelta !== undefined &&
          t.manualEloDelta !== null &&
          !Number.isNaN(Number(t.manualEloDelta))
      );

      const rec = recordsByPeriod.get(period);

      // Si un relevé mensuel existe et que la cadence est marquée comme jouée manuellement,
      // l'écart provient à 100% des valeurs saisies par l'utilisateur, tout en rattachant
      // les parties & tournois du mois précédent à cette mise à jour FIDE.
      if (rec && isCadencePlayed(rec, cadence)) {
        const delta = getCadenceDelta(rec, cadence);
        const gamesCount = getCadenceGamesCount(rec, cadence);

        return {
          cadence,
          hasActivity: true,
          delta,
          isManualRecord: true,
          games: periodGames,
          manualTournaments: manualTourneys,
          recordFallback: {
            gamesCount,
            delta,
            notes: rec.notes || '',
          },
        };
      }

      // Tournois / parties joués le mois précédent (comptant pour cette liste FIDE)
      if (periodGames.length > 0 || manualTourneys.length > 0) {
        const gamesDelta = periodGames
          .filter((g) => !manualTournamentIds.has(g.tournamentId))
          .reduce((acc, g) => acc + g.eloChange, 0);
        const manualDelta = manualTourneys.reduce(
          (acc, t) => acc + Number(t.manualEloDelta),
          0
        );
        const totalDelta = Math.round((gamesDelta + manualDelta) * 10) / 10;

        return {
          cadence,
          hasActivity: true,
          delta: totalDelta,
          isManualRecord: false,
          games: periodGames,
          manualTournaments: manualTourneys,
        };
      }

      return {
        cadence,
        hasActivity: false,
        delta: 0,
        isManualRecord: Boolean(rec),
        games: [],
        manualTournaments: [],
      };
    };

    return periods.map((period) => ({
      period,
      label: formatFideMatrixPeriod(period),
      record: recordsByPeriod.get(period),
      Standard: buildCell(period, 'Standard'),
      Rapid: buildCell(period, 'Rapid'),
      Blitz: buildCell(period, 'Blitz'),
    }));
  }, [games, tournaments, records]);

  const activeVariationDetail = useMemo(() => {
    if (!selectedVariationCell) return null;
    const row = monthlyVariations.find(
      (r) => r.period === selectedVariationCell.period
    );
    if (!row) return null;
    return {
      period: row.period,
      periodLabel: row.label,
      record: row.record,
      cell: row[selectedVariationCell.cadence],
    };
  }, [selectedVariationCell, monthlyVariations]);

  // Statistiques par couleur (Blancs vs Noirs)
  const colorStats = useMemo(() => {
    const computeColor = (col: 'White' | 'Black') => {
      const list = games.filter((g) => g.playerColor === col);
      const count = list.length;
      const wins = list.filter((g) => g.playerScore === 1).length;
      const draws = list.filter((g) => g.playerScore === 0.5).length;
      const losses = list.filter((g) => g.playerScore === 0).length;
      const score = list.reduce((acc, g) => acc + g.playerScore, 0);
      const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;
      const drawRate = count > 0 ? Math.round((draws / count) * 100) : 0;
      const lossRate = count > 0 ? Math.max(0, 100 - winRate - drawRate) : 0;
      const perf = calculateFidePerformanceRating(list);
      const netElo =
        Math.round(list.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;
      return {
        count,
        wins,
        draws,
        losses,
        score,
        winRate,
        drawRate,
        lossRate,
        perf,
        netElo,
      };
    };
    return {
      white: computeColor('White'),
      black: computeColor('Black'),
    };
  }, [games]);

  // Statistiques par Ouverture
  const openingStats = useMemo(() => {
    const map = new Map<
      string,
      {
        eco: string;
        name: string;
        count: number;
        score: number;
        wins: number;
        draws: number;
        losses: number;
        netElo: number;
      }
    >();
    games.forEach((g) => {
      if (!g.openingName) return;
      const key = `${g.ecoCode || ''}__${g.openingName}`;
      const existing = map.get(key) || {
        eco: g.ecoCode || '—',
        name: g.openingName,
        count: 0,
        score: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        netElo: 0,
      };
      existing.count += 1;
      existing.score += g.playerScore;
      if (g.playerScore === 1) existing.wins += 1;
      else if (g.playerScore === 0.5) existing.draws += 1;
      else existing.losses += 1;
      existing.netElo = Math.round((existing.netElo + g.eloChange) * 10) / 10;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [games]);

  // Helpers pour l'éditeur pratique des données du mois
  const startRowEdit = (r: MonthlyRatingRecord) => {
    setIsBulkEditMode(false);
    setEditingRowId(r.id);
    setDraftsById({ [r.id]: recordToDraft(r) });
  };

  const cancelRowEdit = () => {
    setEditingRowId(null);
    setDraftsById({});
  };

  const toggleBulkEditMode = () => {
    if (isBulkEditMode) {
      setIsBulkEditMode(false);
      setDraftsById({});
      return;
    }
    const nextDrafts: Record<string, MonthlyDraft> = {};
    sortedRatings.forEach((r) => {
      nextDrafts[r.id] = recordToDraft(r);
    });
    setEditingRowId(null);
    setDraftsById(nextDrafts);
    setIsBulkEditMode(true);
  };

  const updateRowDraft = (id: string, patch: Partial<MonthlyDraft>) => {
    setDraftsById((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return {
        ...prev,
        [id]: { ...existing, ...patch },
      };
    });
  };

  const changedBulkRecords = useMemo(() => {
    if (!isBulkEditMode) return [];
    return sortedRatings.filter((r) => {
      const draft = draftsById[r.id];
      if (!draft) return false;
      const orig = recordToDraft(r);
      return JSON.stringify(orig) !== JSON.stringify(draft);
    });
  }, [isBulkEditMode, sortedRatings, draftsById]);

  const openAddMonthModal = (prefillPeriod?: string) => {
    const latest = sortedRatings[0];
    setNewMonthDraft({
      id: '',
      period: prefillPeriod || new Date().toISOString().slice(0, 7),
      standardElo: String(latest?.standardElo ?? profile.standardElo),
      rapidElo: String(latest?.rapidElo ?? profile.rapidElo),
      blitzElo: String(latest?.blitzElo ?? profile.blitzElo),
      standardPlayed: true,
      standardDelta: '0',
      standardGamesCount: '0',
      rapidPlayed: false,
      rapidDelta: '0',
      rapidGamesCount: '0',
      blitzPlayed: false,
      blitzDelta: '0',
      blitzGamesCount: '0',
      fideRankNational: latest?.fideRankNational ?? 0,
      notes: '',
    });
    setIsAddMonthOpen(true);
  };

  const jumpToEditMonth = (periodTarget: string) => {
    const existing = sortedRatings.find((r) => r.period === periodTarget);
    if (existing) {
      startRowEdit(existing);
      editorSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    } else {
      openAddMonthModal(periodTarget);
    }
  };

  const requestSaveSingleRowWith2fa = (r: MonthlyRatingRecord) => {
    const draft = draftsById[r.id];
    if (!draft) return;
    const input = draftToRecordInput(draft);
    const fmt = (played: boolean | undefined, val: number | undefined) =>
      !played ? 'Aucune' : (val ?? 0) >= 0 ? `+${val ?? 0}` : String(val ?? 0);

    setPendingMonthlySave({
      mode: 'single',
      title: `Enregistrer les modifications de ${formatPeriodLabel(input.period)} ?`,
      subtitle:
        'La modification des Elos et écarts mensuels est protégée par Microsoft Authenticator (A2F).',
      itemLabel: formatPeriodLabel(input.period),
      details: [
        {
          label: 'Classique',
          value: `${input.standardElo} (${fmt(input.standardPlayed, input.standardDelta)})`,
        },
        {
          label: 'Rapide',
          value: `${input.rapidElo} (${fmt(input.rapidPlayed, input.rapidDelta)})`,
        },
        {
          label: 'Blitz',
          value: `${input.blitzElo} (${fmt(input.blitzPlayed, input.blitzDelta)})`,
        },
      ],
      updates: [{ input, existingId: r.id }],
    });
  };

  const requestBulkSaveWith2fa = () => {
    if (changedBulkRecords.length === 0) return;
    const updates = changedBulkRecords.map((r) => ({
      input: draftToRecordInput(draftsById[r.id]),
      existingId: r.id,
    }));

    setPendingMonthlySave({
      mode: 'bulk',
      title: `Enregistrer ${updates.length} mois modifié${
        updates.length > 1 ? 's' : ''
      } ?`,
      subtitle:
        'Toutes vos modifications d’Elos et d’écarts mensuels vont être sauvegardées après validation A2F.',
      itemLabel: updates
        .map((u) => formatFideMatrixPeriod(u.input.period))
        .join(' · '),
      details: updates.slice(0, 4).map((u) => ({
        label: formatFideMatrixPeriod(u.input.period),
        value: `Std ${u.input.standardElo} (${
          u.input.standardPlayed
            ? (u.input.standardDelta >= 0 ? '+' : '') + u.input.standardDelta
            : '—'
        }) · Rap ${u.input.rapidElo} · Blz ${u.input.blitzElo}`,
      })),
      updates,
    });
  };

  const handleSubmitNewMonthModal = (e: React.FormEvent) => {
    e.preventDefault();
    const input = draftToRecordInput(newMonthDraft);
    const fmt = (played: boolean | undefined, val: number | undefined) =>
      !played ? 'Aucune' : (val ?? 0) >= 0 ? `+${val ?? 0}` : String(val ?? 0);

    setPendingMonthlySave({
      mode: 'add',
      title: `Ajouter les données du mois (${formatPeriodLabel(input.period)}) ?`,
      subtitle:
        'L’ajout d’une nouvelle période mensuelle nécessite votre code Microsoft Authenticator (A2F).',
      itemLabel: formatPeriodLabel(input.period),
      details: [
        {
          label: 'Classique',
          value: `${input.standardElo} (${fmt(input.standardPlayed, input.standardDelta)})`,
        },
        {
          label: 'Rapide',
          value: `${input.rapidElo} (${fmt(input.rapidPlayed, input.rapidDelta)})`,
        },
        {
          label: 'Blitz',
          value: `${input.blitzElo} (${fmt(input.blitzPlayed, input.blitzDelta)})`,
        },
      ],
      updates: [{ input }],
    });
  };

  const simWinDelta = calculateFideEloChange(simPlayerElo, simOppElo, 1, simKFactor);
  const simDrawDelta = calculateFideEloChange(simPlayerElo, simOppElo, 0.5, simKFactor);
  const simLossDelta = calculateFideEloChange(simPlayerElo, simOppElo, 0, simKFactor);
  const simExpected = Math.round(calculateFideExpectedScore(simPlayerElo, simOppElo) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 border-b border-[#232C3A] pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#F1F4F8]">
            Statistiques & Évolution Elo
          </h1>
          <p className="text-xs text-[#9BA7B8] mt-1">
            Courbe mensuelle FIDE, performance par cadence, répertoire d’ouvertures et simulateur officiel.
          </p>
        </div>
        <IconButton
          label={`Modifier mes Elos actuels & Objectif (${profile.targetElo})`}
          variant="surface"
          size="md"
          tooltipPos="bottom"
          onClick={onOpenProfileModal}
        >
          <UserCheck className="w-4 h-4 text-emerald-400" />
        </IconButton>
      </div>

      {/* 1. Classement et bilan dans chacune des 3 cadences */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cadenceStats.map((c) => (
          <div
            key={c.tc}
            className="bg-[#131820] border border-[#232C3A] rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className={`text-[11px] font-mono font-bold uppercase tracking-wider ${c.accentText}`}>
                  {c.label}
                </div>
                <div className={`text-3xl font-mono tabular-nums font-bold mt-1.5 ${c.eloColor}`}>
                  {c.currentElo}{' '}
                  <span className="text-xs font-normal text-[#6C788B]">Elo</span>
                </div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-[11px] text-[#6C788B]">Bilan parties</div>
                <div
                  className={`text-sm font-bold mt-1 ${
                    c.netElo >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {c.netElo >= 0 ? `+${c.netElo.toFixed(1)}` : c.netElo.toFixed(1)} pts
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#232C3A] text-xs">
              <div className="p-2.5 rounded-xl bg-[#19202B] border border-[#232C3A]">
                <div className="text-[#6C788B] text-[11px]">Parties</div>
                <div className="font-mono tabular-nums font-bold text-[#F1F4F8] mt-0.5">
                  {c.count}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#19202B] border border-[#232C3A]">
                <div className="text-[#6C788B] text-[11px]">Victoires</div>
                <div className="font-mono tabular-nums font-bold text-emerald-400 mt-0.5">
                  {c.winRate}%
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#19202B] border border-[#232C3A]">
                <div className="text-[#6C788B] text-[11px]">Perf. FIDE</div>
                <div className="font-mono tabular-nums font-bold text-[#D4A853] mt-0.5">
                  {c.perf || '—'}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-emerald-400 font-bold">{c.wins}V</span>
                <span className="text-[#D4A853] font-bold">{c.draws}N</span>
                <span className="text-rose-400 font-bold">{c.losses}D</span>
                <span className="text-[#9BA7B8]">Moy. adv : {c.avgOpp || '—'}</span>
              </div>
              <div className="w-full h-1.5 bg-[#19202B] rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${c.winRate}%` }}
                  className="bg-emerald-500 h-full"
                />
                <div
                  style={{ width: `${c.drawRate}%` }}
                  className="bg-[#D4A853] h-full"
                />
                <div
                  style={{ width: `${c.lossRate}%` }}
                  className="bg-rose-500 h-full"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Graphique d'évolution mensuelle de l'Elo */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-[#F1F4F8] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Courbe d’évolution mensuelle FIDE
            </h2>
            <p className="text-xs text-[#9BA7B8] mt-0.5">
              Publication mensuelle au 1er du mois en Classique, Rapide et Blitz.
            </p>
          </div>
          <div className="text-xs font-mono font-bold text-[#D4A853]">
            Objectif : {profile.targetElo} Elo
          </div>
        </div>

        <EloEvolutionChart
          records={records}
          targetElo={profile.targetElo}
        />
      </div>

      {/* 2b. Tableau des variations d'Elo par mois et par cadence (style FIDE) */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#232C3A] bg-[#0F131A] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-[#F1F4F8] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#D4A853]" />
              Variations d’Elo par mois & cadence
            </h2>
            <p className="text-xs text-[#9BA7B8] mt-0.5">
              Les tournois joués un mois comptent pour la liste FIDE du mois suivant (ex. sept. → oct.) — cliquez sur « Voir » ou « Modifier ».
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#6C788B]">
              {monthlyVariations.length} période{monthlyVariations.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {monthlyVariations.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6C788B]">
            Aucune variation mensuelle enregistrée pour le moment.
          </div>
        ) : (
          <>
            {/* VUE MOBILE : Cartes mensuelles (< 640px) */}
            <div className="sm:hidden divide-y divide-[#232C3A]">
              {(showAllMonthlyPeriods
                ? monthlyVariations
                : monthlyVariations.slice(0, 6)
              ).map((row) => (
                <div key={row.period} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-[#F1F4F8]">
                      {row.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => jumpToEditMonth(row.period)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#19202B] border border-[#2B3647] text-[11px] font-semibold text-[#CBD5E1] cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{row.record ? 'Éditer' : 'Saisir'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        {
                          cad: 'Standard' as TimeControlCategory,
                          label: 'Classique',
                          titleColor: 'text-emerald-400',
                        },
                        {
                          cad: 'Rapid' as TimeControlCategory,
                          label: 'Rapide',
                          titleColor: 'text-[#D4A853]',
                        },
                        {
                          cad: 'Blitz' as TimeControlCategory,
                          label: 'Blitz',
                          titleColor: 'text-sky-400',
                        },
                      ]
                    ).map((item) => {
                      const cell = row[item.cad];
                      const isSelected =
                        selectedVariationCell?.period === row.period &&
                        selectedVariationCell?.cadence === item.cad;
                      return (
                        <button
                          key={item.cad}
                          type="button"
                          disabled={!cell.hasActivity && cell.games.length === 0}
                          onClick={() => {
                            if (!cell.hasActivity && cell.games.length === 0) return;
                            setSelectedVariationCell(
                              isSelected
                                ? null
                                : { period: row.period, cadence: item.cad }
                            );
                          }}
                          className={`p-2 rounded-xl border text-left transition-colors ${
                            !cell.hasActivity && cell.games.length === 0
                              ? 'bg-[#0F131A]/70 border-[#232C3A] opacity-60 cursor-default'
                              : isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/50 cursor-pointer'
                              : 'bg-[#19202B] border-[#263142] active:border-[#475569] cursor-pointer'
                          }`}
                        >
                          <div
                            className={`text-[10px] font-bold uppercase tracking-wider ${item.titleColor}`}
                          >
                            {item.label}
                          </div>
                          {!cell.hasActivity ? (
                            <div className="text-[11px] text-[#6C788B] mt-1 font-mono">
                              —
                            </div>
                          ) : (
                            <div className="mt-1 flex items-center justify-between gap-1">
                              <span
                                className={`font-mono tabular-nums text-xs font-bold ${
                                  cell.delta > 0
                                    ? 'text-emerald-400'
                                    : cell.delta < 0
                                    ? 'text-rose-400'
                                    : 'text-[#9BA7B8]'
                                }`}
                              >
                                {cell.delta > 0
                                  ? `▲+${cell.delta.toFixed(1)}`
                                  : cell.delta < 0
                                  ? `▼${cell.delta.toFixed(1)}`
                                  : '0.0'}
                              </span>
                              <Eye className="w-3 h-3 text-[#9BA7B8] shrink-0" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* VUE DESKTOP : Tableau (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#232C3A] text-xs font-bold tracking-wide">
                    <th className="py-3 px-5 bg-[#0F131A] text-[#9BA7B8] w-36">
                      Période
                    </th>
                    <th className="py-3 px-5 bg-emerald-500/12 text-emerald-400 border-l border-[#232C3A] text-center">
                      Classique
                    </th>
                    <th className="py-3 px-5 bg-[#D4A853]/12 text-[#D4A853] border-l border-[#232C3A] text-center">
                      Rapide
                    </th>
                    <th className="py-3 px-5 bg-sky-500/12 text-sky-400 border-l border-[#232C3A] text-center">
                      Blitz
                    </th>
                    <th className="py-3 px-4 bg-[#0F131A] text-[#6C788B] border-l border-[#232C3A] text-right w-24">
                      Éditer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232C3A] text-xs">
                  {(showAllMonthlyPeriods
                    ? monthlyVariations
                    : monthlyVariations.slice(0, 6)
                  ).map((row) => (
                    <tr
                      key={row.period}
                      className="hover:bg-[#19202B]/60 transition-colors"
                    >
                      <td className="py-3 px-5 font-mono tabular-nums font-bold text-[#F1F4F8] whitespace-nowrap">
                        {row.label}
                      </td>
                      {(['Standard', 'Rapid', 'Blitz'] as TimeControlCategory[]).map(
                        (cad) => {
                          const cell = row[cad];
                          const isSelected =
                            selectedVariationCell?.period === row.period &&
                            selectedVariationCell?.cadence === cad;

                          return (
                            <td
                              key={cad}
                              className="py-3 px-5 border-l border-[#232C3A]/70 whitespace-nowrap"
                            >
                              {!cell.hasActivity ? (
                                <span className="text-[#6C788B]">
                                  Aucune partie
                                </span>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedVariationCell(
                                        isSelected
                                          ? null
                                          : { period: row.period, cadence: cad }
                                      )
                                    }
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                        : 'bg-[#19202B] border-[#2B3647] text-[#F1F4F8] hover:border-[#475569]'
                                    }`}
                                  >
                                    <Eye className="w-3.5 h-3.5 opacity-80" />
                                    <span>Voir</span>
                                  </button>

                                  <span
                                    className={`font-mono tabular-nums font-bold inline-flex items-center gap-1 ${
                                      cell.delta > 0
                                        ? 'text-emerald-400'
                                        : cell.delta < 0
                                        ? 'text-rose-400'
                                        : 'text-[#9BA7B8]'
                                    }`}
                                  >
                                    {cell.delta > 0 && (
                                      <>
                                        <span aria-hidden="true">▲</span>
                                        <span>+{cell.delta.toFixed(1)}</span>
                                      </>
                                    )}
                                    {cell.delta < 0 && (
                                      <>
                                        <span aria-hidden="true">▼</span>
                                        <span>{cell.delta.toFixed(1)}</span>
                                      </>
                                    )}
                                    {cell.delta === 0 && <span>0.0</span>}
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        }
                      )}
                      <td className="py-3 px-4 border-l border-[#232C3A]/70 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => jumpToEditMonth(row.period)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#19202B] hover:bg-[#232C3A] border border-[#2B3647] text-[11px] font-semibold text-[#CBD5E1] cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{row.record ? 'Modifier' : 'Saisir'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Détail du mois + cadence sélectionné */}
            {activeVariationDetail && (
              <div className="border-t border-[#232C3A] bg-[#0F131A] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-[#F1F4F8]">
                      {activeVariationDetail.periodLabel}
                    </span>
                    <span className="text-[#475569]">·</span>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        activeVariationDetail.cell.cadence === 'Standard'
                          ? 'text-emerald-400'
                          : activeVariationDetail.cell.cadence === 'Rapid'
                          ? 'text-[#D4A853]'
                          : 'text-sky-400'
                      }`}
                    >
                      {activeVariationDetail.cell.cadence === 'Standard'
                        ? 'Classique'
                        : activeVariationDetail.cell.cadence === 'Rapid'
                        ? 'Rapide'
                        : 'Blitz'}
                    </span>
                    <span className="text-[#475569]">·</span>
                    <span
                      className={`font-mono tabular-nums text-xs font-bold ${
                        activeVariationDetail.cell.delta > 0
                          ? 'text-emerald-400'
                          : activeVariationDetail.cell.delta < 0
                          ? 'text-rose-400'
                          : 'text-[#9BA7B8]'
                      }`}
                    >
                      {activeVariationDetail.cell.delta > 0
                        ? `▲ +${activeVariationDetail.cell.delta.toFixed(1)} pts`
                        : activeVariationDetail.cell.delta < 0
                        ? `▼ ${activeVariationDetail.cell.delta.toFixed(1)} pts`
                        : '0.0 pt'}
                    </span>
                    {activeVariationDetail.cell.isManualRecord && (
                      <span className="px-2 py-0.5 rounded-md bg-[#19202B] border border-[#2B3647] text-[10px] font-mono text-[#9BA7B8]">
                        Écart manuel
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => jumpToEditMonth(activeVariationDetail.period)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#19202B] hover:bg-[#232C3A] border border-[#2B3647] text-[11px] font-semibold text-[#F1F4F8] cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-emerald-400" />
                      <span>Modifier cet écart</span>
                    </button>
                    <IconButton
                      label="Fermer le détail mensuel"
                      variant="ghost"
                      size="xs"
                      onClick={() => setSelectedVariationCell(null)}
                    >
                      <X className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>

                {(activeVariationDetail.cell.games.length > 0 ||
                  activeVariationDetail.cell.manualTournaments.length > 0) && (
                  <div className="text-[11px] text-[#9BA7B8] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#D4A853] shrink-0" />
                    <span>
                      Parties et tournois pris en compte pour la liste FIDE de{' '}
                      <strong className="text-[#F1F4F8]">
                        {formatPeriodLabel(activeVariationDetail.period)}
                      </strong>{' '}
                      (joués le mois précédent).
                    </span>
                  </div>
                )}

                {activeVariationDetail.cell.manualTournaments.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#9BA7B8]">
                      Tournois avec bilan Elo saisi manuellement
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeVariationDetail.cell.manualTournaments.map((t) => {
                        const d = Number(t.manualEloDelta || 0);
                        return (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl bg-[#19202B] border border-[#263142] flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-[#F1F4F8] flex items-center gap-1.5 truncate">
                                <Trophy className="w-3.5 h-3.5 text-[#D4A853] shrink-0" />
                                <span className="truncate">{t.name}</span>
                              </div>
                              <div className="text-[11px] font-mono text-[#6C788B] mt-0.5">
                                {t.startDate} → {t.endDate}
                                {t.manualPerformance
                                  ? ` · Perf ${t.manualPerformance}`
                                  : ''}
                              </div>
                            </div>
                            <span
                              className={`font-mono tabular-nums font-bold shrink-0 ${
                                d >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {d >= 0 ? `+${d.toFixed(1)}` : d.toFixed(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeVariationDetail.cell.games.length > 0 ? (
                  <>
                    {/* Cartes détail mobile (< 640px) */}
                    <div className="sm:hidden space-y-2">
                      {activeVariationDetail.cell.games.map((g) => (
                        <div
                          key={g.id}
                          className="p-3 rounded-xl bg-[#131820] border border-[#232C3A] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#F1F4F8] flex items-center gap-1.5">
                              <FederationFlag
                                code={g.opponentFederation || 'FRA'}
                                size="xs"
                              />
                              {g.opponentTitle !== 'None' && (
                                <span className="font-mono text-[10px] text-[#D4A853]">
                                  {g.opponentTitle}
                                </span>
                              )}
                              <span className="truncate">
                                {formatPlayerNameDisplay(
                                  g.opponentName,
                                  g.opponentNameUncertain
                                )}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-[#9BA7B8] mt-0.5 truncate">
                              {g.datePlayed} · Elo{' '}
                              {g.opponentEloUnknown || !g.opponentElo
                                ? '?'
                                : g.opponentElo}{' '}
                              · {g.tournamentName}
                            </div>
                          </div>

                          <div className="text-right font-mono shrink-0">
                            <div
                              className={`font-bold ${
                                g.playerScore === 1
                                  ? 'text-emerald-400'
                                  : g.playerScore === 0
                                  ? 'text-rose-400'
                                  : 'text-[#D4A853]'
                              }`}
                            >
                              {g.playerScore === 1
                                ? '1'
                                : g.playerScore === 0.5
                                ? '½'
                                : '0'}
                            </div>
                            <div
                              className={`text-[11px] font-bold ${
                                g.eloChange >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {g.eloChange >= 0
                                ? `+${g.eloChange.toFixed(1)}`
                                : g.eloChange.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tableau détail desktop (>= 640px) */}
                    <div className="hidden sm:block overflow-x-auto border border-[#232C3A] rounded-xl bg-[#131820]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#232C3A] bg-[#19202B]/70 text-[11px] font-mono uppercase tracking-wider text-[#6C788B]">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-4">Tournoi</th>
                            <th className="py-2.5 px-4">Adversaire</th>
                            <th className="py-2.5 px-4 text-right">Son Elo</th>
                            <th className="py-2.5 px-4 text-center">Score</th>
                            <th className="py-2.5 px-4 text-right">Variation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#232C3A] text-xs">
                          {activeVariationDetail.cell.games.map((g) => (
                            <tr key={g.id} className="hover:bg-[#19202B]">
                              <td className="py-2.5 px-4 font-mono text-[#9BA7B8] whitespace-nowrap">
                                {g.datePlayed}
                              </td>
                              <td className="py-2.5 px-4 text-[#CBD5E1] truncate max-w-[200px]">
                                {g.tournamentName}
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-[#F1F4F8]">
                                <span className="inline-flex items-center gap-2">
                                  <FederationFlag
                                    code={g.opponentFederation || 'FRA'}
                                    size="xs"
                                  />
                                  {g.opponentTitle !== 'None' && (
                                    <span className="font-mono text-[10px] text-[#D4A853]">
                                      {g.opponentTitle}
                                    </span>
                                  )}
                                  <span>
                                    {formatPlayerNameDisplay(
                                      g.opponentName,
                                      g.opponentNameUncertain
                                    )}
                                  </span>
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#F1F4F8]">
                                {g.opponentEloUnknown || !g.opponentElo
                                  ? '?'
                                  : g.opponentElo}
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
                                    ? '1'
                                    : g.playerScore === 0.5
                                    ? '½'
                                    : '0'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  activeVariationDetail.cell.recordFallback && (
                    <div className="p-3.5 rounded-xl bg-[#19202B] border border-[#263142] text-xs text-[#CBD5E1] flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Issue du relevé mensuel FIDE
                        {activeVariationDetail.cell.recordFallback.gamesCount > 0
                          ? ` (${activeVariationDetail.cell.recordFallback.gamesCount} parties)`
                          : ''}
                        {activeVariationDetail.cell.recordFallback.notes
                          ? ` — ${activeVariationDetail.cell.recordFallback.notes}`
                          : ''}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          activeVariationDetail.cell.recordFallback.delta >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {activeVariationDetail.cell.recordFallback.delta >= 0
                          ? `+${activeVariationDetail.cell.recordFallback.delta.toFixed(1)}`
                          : activeVariationDetail.cell.recordFallback.delta.toFixed(1)}{' '}
                        pts
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

            {monthlyVariations.length > 6 && (
              <div className="px-5 py-3 border-t border-[#232C3A] bg-[#0F131A]">
                <button
                  type="button"
                  onClick={() => setShowAllMonthlyPeriods((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#19202B] border border-[#2B3647] text-xs font-semibold text-[#CBD5E1] hover:text-[#F1F4F8] hover:border-[#475569] transition-colors cursor-pointer"
                >
                  {showAllMonthlyPeriods ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Réduire les périodes</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>
                        Voir plus de périodes ({monthlyVariations.length - 6} de plus)
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Bilan Blancs vs Noirs + Simulateur FIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-[#131820] border border-[#232C3A] rounded-2xl p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-[#F1F4F8]">
            Performance par Couleur
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-[#F1F4F8]">
                  <span className="w-3.5 h-3.5 rounded-sm bg-[#F1F4F8] border border-[#9BA7B8]" />
                  Avec les Blancs
                </span>
                <span className="text-xs font-mono text-[#9BA7B8]">
                  {colorStats.white.count} p.
                </span>
              </div>
              <div className="text-2xl font-mono tabular-nums font-bold text-[#F1F4F8]">
                {colorStats.white.score} / {colorStats.white.count} pts
              </div>
              <div className="text-xs font-mono tabular-nums space-x-2">
                <span className="text-emerald-400 font-bold">
                  {colorStats.white.wins}V ({colorStats.white.winRate}%)
                </span>
                <span className="text-[#D4A853] font-bold">{colorStats.white.draws}N</span>
                <span className="text-rose-400 font-bold">{colorStats.white.losses}D</span>
              </div>
              <div className="w-full h-1.5 bg-[#131820] rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${colorStats.white.winRate}%` }}
                  className="bg-emerald-500 h-full"
                />
                <div
                  style={{ width: `${colorStats.white.drawRate}%` }}
                  className="bg-[#D4A853] h-full"
                />
                <div
                  style={{ width: `${colorStats.white.lossRate}%` }}
                  className="bg-rose-500 h-full"
                />
              </div>
              <div className="pt-2 border-t border-[#232C3A] flex justify-between text-xs font-mono tabular-nums">
                <span className="text-[#9BA7B8]">
                  Perf : <strong className="text-[#D4A853]">{colorStats.white.perf || '—'}</strong>
                </span>
                <span
                  className={`font-bold ${
                    colorStats.white.netElo >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {colorStats.white.netElo >= 0
                    ? `+${colorStats.white.netElo.toFixed(1)}`
                    : colorStats.white.netElo.toFixed(1)}{' '}
                  Elo
                </span>
              </div>
            </div>

            <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-[#F1F4F8]">
                  <span className="w-3.5 h-3.5 rounded-sm bg-[#0B0E12] border border-[#475569]" />
                  Avec les Noirs
                </span>
                <span className="text-xs font-mono text-[#9BA7B8]">
                  {colorStats.black.count} p.
                </span>
              </div>
              <div className="text-2xl font-mono tabular-nums font-bold text-[#F1F4F8]">
                {colorStats.black.score} / {colorStats.black.count} pts
              </div>
              <div className="text-xs font-mono tabular-nums space-x-2">
                <span className="text-emerald-400 font-bold">
                  {colorStats.black.wins}V ({colorStats.black.winRate}%)
                </span>
                <span className="text-[#D4A853] font-bold">{colorStats.black.draws}N</span>
                <span className="text-rose-400 font-bold">{colorStats.black.losses}D</span>
              </div>
              <div className="w-full h-1.5 bg-[#131820] rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${colorStats.black.winRate}%` }}
                  className="bg-emerald-500 h-full"
                />
                <div
                  style={{ width: `${colorStats.black.drawRate}%` }}
                  className="bg-[#D4A853] h-full"
                />
                <div
                  style={{ width: `${colorStats.black.lossRate}%` }}
                  className="bg-rose-500 h-full"
                />
              </div>
              <div className="pt-2 border-t border-[#232C3A] flex justify-between text-xs font-mono tabular-nums">
                <span className="text-[#9BA7B8]">
                  Perf : <strong className="text-[#D4A853]">{colorStats.black.perf || '—'}</strong>
                </span>
                <span
                  className={`font-bold ${
                    colorStats.black.netElo >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {colorStats.black.netElo >= 0
                    ? `+${colorStats.black.netElo.toFixed(1)}`
                    : colorStats.black.netElo.toFixed(1)}{' '}
                  Elo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Simulateur Elo Officiel FIDE */}
        <div className="lg:col-span-6 bg-[#131820] border border-[#232C3A] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#F1F4F8] flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#D4A853]" />
              Simulateur FIDE d’une ronde
            </h3>
            <span className="text-xs font-mono font-bold text-[#D4A853]">
              Score espéré : {simExpected}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1.5">Mon Elo</label>
              <input
                type="number"
                value={simPlayerElo}
                onChange={(e) => setSimPlayerElo(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl font-mono font-bold text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1.5">Adversaire</label>
              <input
                type="number"
                value={simOppElo}
                onChange={(e) => setSimOppElo(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl font-mono font-bold text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1.5">Facteur K</label>
              <select
                value={simKFactor}
                onChange={(e) => setSimKFactor(Number(e.target.value) as 10 | 20 | 40)}
                className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl font-mono font-bold text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              >
                <option value={40}>K = 40</option>
                <option value={20}>K = 20</option>
                <option value={10}>K = 10</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 bg-[#19202B] border border-emerald-500/30 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-[#9BA7B8]">Victoire</div>
              <div className="text-lg font-mono tabular-nums font-bold text-emerald-400 mt-0.5">
                +{simWinDelta.toFixed(1)}
              </div>
            </div>
            <div className="p-3.5 bg-[#19202B] border border-[#D4A853]/30 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-[#9BA7B8]">Nulle</div>
              <div className="text-lg font-mono tabular-nums font-bold text-[#D4A853] mt-0.5">
                {simDrawDelta >= 0 ? `+${simDrawDelta.toFixed(1)}` : simDrawDelta.toFixed(1)}
              </div>
            </div>
            <div className="p-3.5 bg-[#19202B] border border-rose-500/30 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-[#9BA7B8]">Défaite</div>
              <div className="text-lg font-mono tabular-nums font-bold text-rose-400 mt-0.5">
                {simLossDelta.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Statistiques par Ouverture */}
      {openingStats.length > 0 && (
        <div className="bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#232C3A] bg-[#0F131A]">
            <h3 className="font-display text-sm font-bold text-[#F1F4F8]">
              Ouvertures les plus jouées ({openingStats.length})
            </h3>
          </div>
          {/* Ouvertures mobile (< 768px) */}
          <div className="md:hidden divide-y divide-[#232C3A] text-xs">
            {openingStats.map((op) => {
              const wPct = op.count > 0 ? Math.round((op.wins / op.count) * 100) : 0;
              const dPct = op.count > 0 ? Math.round((op.draws / op.count) * 100) : 0;
              const lPct = op.count > 0 ? Math.max(0, 100 - wPct - dPct) : 0;
              return (
                <div key={`${op.eco}_${op.name}`} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-[#D4A853] mr-2">
                        {op.eco}
                      </span>
                      <span className="font-semibold text-[#F1F4F8]">
                        {op.name}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        op.netElo >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {op.netElo >= 0
                        ? `+${op.netElo.toFixed(1)}`
                        : op.netElo.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 font-mono text-[11px]">
                    <span className="text-[#9BA7B8]">{op.count} partie(s)</span>
                    <div>
                      <span className="text-emerald-400 font-bold">{op.wins}V</span>{' '}
                      ·{' '}
                      <span className="text-[#D4A853] font-bold">{op.draws}N</span>{' '}
                      ·{' '}
                      <span className="text-rose-400 font-bold">{op.losses}D</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#19202B] rounded-full overflow-hidden flex">
                    <div style={{ width: `${wPct}%` }} className="bg-emerald-500 h-full" />
                    <div style={{ width: `${dPct}%` }} className="bg-[#D4A853] h-full" />
                    <div style={{ width: `${lPct}%` }} className="bg-rose-500 h-full" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ouvertures desktop (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232C3A] bg-[#0F131A] text-[11px] font-mono uppercase tracking-wider text-[#6C788B]">
                  <th className="py-3 px-4">ECO</th>
                  <th className="py-3 px-4">Ouverture</th>
                  <th className="py-3 px-4 text-center">Parties</th>
                  <th className="py-3 px-4 text-center">Bilan (V / N / D)</th>
                  <th className="py-3 px-4 text-right">Elo Gagné</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232C3A] text-xs">
                {openingStats.map((op) => {
                  const wPct = op.count > 0 ? Math.round((op.wins / op.count) * 100) : 0;
                  const dPct = op.count > 0 ? Math.round((op.draws / op.count) * 100) : 0;
                  const lPct = op.count > 0 ? Math.max(0, 100 - wPct - dPct) : 0;
                  return (
                    <tr key={`${op.eco}_${op.name}`} className="hover:bg-[#19202B]">
                      <td className="py-3 px-4 font-mono font-bold text-[#D4A853]">
                        {op.eco}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#F1F4F8]">{op.name}</td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums font-bold text-[#F1F4F8]">
                        {op.count}
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums">
                        <div>
                          <span className="text-emerald-400 font-bold">{op.wins}V</span> ·{' '}
                          <span className="text-[#D4A853] font-bold">{op.draws}N</span> ·{' '}
                          <span className="text-rose-400 font-bold">{op.losses}D</span>
                        </div>
                        <div className="w-28 mx-auto h-1.5 bg-[#19202B] rounded-full overflow-hidden flex mt-1">
                          <div style={{ width: `${wPct}%` }} className="bg-emerald-500 h-full" />
                          <div style={{ width: `${dPct}%` }} className="bg-[#D4A853] h-full" />
                          <div style={{ width: `${lPct}%` }} className="bg-rose-500 h-full" />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                        <span
                          className={
                            op.netElo >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {op.netElo >= 0 ? `+${op.netElo.toFixed(1)}` : op.netElo.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TABLEAU PRATIQUE D'ÉDITION DES DONNÉES DU MOIS & ÉCARTS MANUELS (Protégé par A2F) */}
      <div
        ref={editorSectionRef}
        className="bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-4 border-b border-[#232C3A] bg-[#0F131A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-[#F1F4F8] flex items-center gap-2">
              <Table2 className="w-4 h-4 text-emerald-400" />
              <span>
                Tableau d’édition des données du mois ({sortedRatings.length})
              </span>
            </h3>
            <p className="text-xs text-[#9BA7B8] mt-0.5">
              Modifiez directement vos Elos et vos écarts manuels (Classique,
              Rapide, Blitz). Chaque enregistrement est protégé par Microsoft
              Authenticator (A2F).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleBulkEditMode}
              disabled={sortedRatings.length === 0}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                isBulkEditMode
                  ? 'bg-[#D4A853]/15 border-[#D4A853]/40 text-[#D4A853]'
                  : 'bg-[#19202B] hover:bg-[#232C3A] border-[#2B3647] text-[#F1F4F8]'
              }`}
            >
              {isBulkEditMode ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Quitter mode tableau</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5 text-[#D4A853]" />
                  <span>Tout modifier en tableau</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => openAddMonthModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau mois (A2F)</span>
            </button>
          </div>
        </div>

        {/* Barre d'action globale en mode édition tableau */}
        {isBulkEditMode && (
          <div className="px-4 sm:px-5 py-3 bg-[#19202B] border-b border-[#2B3647] flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#CBD5E1] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Mode édition rapide activé :{' '}
                <strong className="font-mono text-emerald-400">
                  {changedBulkRecords.length}
                </strong>{' '}
                mois modifié{changedBulkRecords.length > 1 ? 's' : ''}.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleBulkEditMode}
                className="px-3 py-1.5 rounded-lg bg-[#131820] border border-[#2B3647] text-xs font-semibold text-[#CBD5E1] hover:text-white cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={changedBulkRecords.length === 0}
                onClick={requestBulkSaveWith2fa}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#131820] disabled:text-[#6C788B] disabled:border disabled:border-[#232C3A] text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  Enregistrer ({changedBulkRecords.length}) avec A2F
                </span>
              </button>
            </div>
          </div>
        )}

        {sortedRatings.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6C788B]">
            Aucun mois enregistré. Cliquez sur « Nouveau mois (A2F) » pour
            démarrer votre tableau mensuel.
          </div>
        ) : (
          <>
            {/* VUE MOBILE : Cartes mensuelles avec édition en ligne (< 1024px) */}
            <div className="lg:hidden divide-y divide-[#232C3A] text-xs">
              {sortedRatings.map((r) => {
                const isEditing = isBulkEditMode || editingRowId === r.id;
                const draft = draftsById[r.id];

                if (isEditing && draft) {
                  return (
                    <div
                      key={r.id}
                      className="p-4 space-y-3 bg-[#19202B]/70 border-l-2 border-emerald-500"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="month"
                          value={draft.period}
                          onChange={(e) =>
                            updateRowDraft(r.id, { period: e.target.value })
                          }
                          className="px-2.5 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-mono font-bold text-[#F1F4F8]"
                        />
                        {!isBulkEditMode && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={cancelRowEdit}
                              className="px-2.5 py-1.5 rounded-lg bg-[#131820] border border-[#2B3647] text-[#CBD5E1] font-semibold cursor-pointer"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={() => requestSaveSingleRowWith2fa(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>A2F</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {(
                          [
                            {
                              label: 'Classique',
                              color: 'text-emerald-400',
                              eloKey: 'standardElo' as const,
                              playedKey: 'standardPlayed' as const,
                              deltaKey: 'standardDelta' as const,
                              gamesKey: 'standardGamesCount' as const,
                            },
                            {
                              label: 'Rapide',
                              color: 'text-[#D4A853]',
                              eloKey: 'rapidElo' as const,
                              playedKey: 'rapidPlayed' as const,
                              deltaKey: 'rapidDelta' as const,
                              gamesKey: 'rapidGamesCount' as const,
                            },
                            {
                              label: 'Blitz',
                              color: 'text-sky-400',
                              eloKey: 'blitzElo' as const,
                              playedKey: 'blitzPlayed' as const,
                              deltaKey: 'blitzDelta' as const,
                              gamesKey: 'blitzGamesCount' as const,
                            },
                          ]
                        ).map((cad) => {
                          const played = draft[cad.playedKey];
                          return (
                            <div
                              key={cad.label}
                              className="p-2.5 rounded-xl bg-[#131820] border border-[#263142] space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-bold ${cad.color}`}>
                                  {cad.label}
                                </span>
                                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#9BA7B8] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={played}
                                    onChange={(e) =>
                                      updateRowDraft(r.id, {
                                        [cad.playedKey]: e.target.checked,
                                      })
                                    }
                                    className="rounded border-[#323E52] bg-[#19202B] text-emerald-500"
                                  />
                                  <span>Joué</span>
                                </label>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 font-mono">
                                <div>
                                  <div className="text-[10px] font-sans text-[#6C788B]">
                                    Elo
                                  </div>
                                  <input
                                    type="number"
                                    value={draft[cad.eloKey]}
                                    onChange={(e) =>
                                      updateRowDraft(r.id, {
                                        [cad.eloKey]: e.target.value,
                                      })
                                    }
                                    className="w-full px-2 py-1 bg-[#19202B] border border-[#2B3647] rounded-lg text-[#F1F4F8] font-bold"
                                  />
                                </div>
                                <div>
                                  <div className="text-[10px] font-sans text-[#6C788B]">
                                    Écart
                                  </div>
                                  <input
                                    type="number"
                                    step="0.1"
                                    disabled={!played}
                                    value={played ? draft[cad.deltaKey] : '0'}
                                    onChange={(e) =>
                                      updateRowDraft(r.id, {
                                        [cad.deltaKey]: e.target.value,
                                      })
                                    }
                                    className="w-full px-2 py-1 bg-[#19202B] border border-[#2B3647] rounded-lg text-[#F1F4F8] font-bold disabled:opacity-40"
                                  />
                                </div>
                                <div>
                                  <div className="text-[10px] font-sans text-[#6C788B]">
                                    Parties
                                  </div>
                                  <input
                                    type="number"
                                    min={0}
                                    disabled={!played}
                                    value={played ? draft[cad.gamesKey] : '0'}
                                    onChange={(e) =>
                                      updateRowDraft(r.id, {
                                        [cad.gamesKey]: e.target.value,
                                      })
                                    }
                                    className="w-full px-2 py-1 bg-[#19202B] border border-[#2B3647] rounded-lg text-[#CBD5E1] disabled:opacity-40"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        value={draft.notes}
                        onChange={(e) =>
                          updateRowDraft(r.id, { notes: e.target.value })
                        }
                        placeholder="Note du mois..."
                        className="w-full px-3 py-2 bg-[#131820] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder:text-[#6C788B]"
                      />
                    </div>
                  );
                }

                const stdPlayed = isCadencePlayed(r, 'Standard');
                const rapPlayed = isCadencePlayed(r, 'Rapid');
                const blzPlayed = isCadencePlayed(r, 'Blitz');
                const stdDelta = getCadenceDelta(r, 'Standard');
                const rapDelta = getCadenceDelta(r, 'Rapid');
                const blzDelta = getCadenceDelta(r, 'Blitz');

                return (
                  <div key={r.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-[#F1F4F8]">
                        {formatPeriodLabel(r.period)}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <IconButton
                          label="Modifier ce mois (écarts & Elos)"
                          variant="ghost"
                          size="xs"
                          onClick={() => startRowEdit(r)}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                        </IconButton>
                        <IconButton
                          label="Supprimer ce relevé (A2F)"
                          variant="danger"
                          size="xs"
                          onClick={() => setRecordToDelete(r)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono text-center">
                      <div className="py-1.5 px-2 rounded-lg bg-[#19202B] border border-[#232C3A]">
                        <div className="text-[10px] font-sans text-[#6C788B]">
                          Classique
                        </div>
                        <div className="font-bold text-emerald-400 mt-0.5">
                          {r.standardElo}
                        </div>
                        <div
                          className={`text-[10px] font-bold mt-0.5 ${
                            !stdPlayed
                              ? 'text-[#6C788B]'
                              : stdDelta > 0
                              ? 'text-emerald-300'
                              : stdDelta < 0
                              ? 'text-rose-400'
                              : 'text-[#9BA7B8]'
                          }`}
                        >
                          {!stdPlayed
                            ? 'Aucune'
                            : stdDelta >= 0
                            ? `+${stdDelta}`
                            : stdDelta}
                        </div>
                      </div>
                      <div className="py-1.5 px-2 rounded-lg bg-[#19202B] border border-[#232C3A]">
                        <div className="text-[10px] font-sans text-[#6C788B]">
                          Rapide
                        </div>
                        <div className="font-bold text-[#D4A853] mt-0.5">
                          {r.rapidElo}
                        </div>
                        <div
                          className={`text-[10px] font-bold mt-0.5 ${
                            !rapPlayed
                              ? 'text-[#6C788B]'
                              : rapDelta > 0
                              ? 'text-emerald-300'
                              : rapDelta < 0
                              ? 'text-rose-400'
                              : 'text-[#9BA7B8]'
                          }`}
                        >
                          {!rapPlayed
                            ? 'Aucune'
                            : rapDelta >= 0
                            ? `+${rapDelta}`
                            : rapDelta}
                        </div>
                      </div>
                      <div className="py-1.5 px-2 rounded-lg bg-[#19202B] border border-[#232C3A]">
                        <div className="text-[10px] font-sans text-[#6C788B]">
                          Blitz
                        </div>
                        <div className="font-bold text-sky-400 mt-0.5">
                          {r.blitzElo}
                        </div>
                        <div
                          className={`text-[10px] font-bold mt-0.5 ${
                            !blzPlayed
                              ? 'text-[#6C788B]'
                              : blzDelta > 0
                              ? 'text-emerald-300'
                              : blzDelta < 0
                              ? 'text-rose-400'
                              : 'text-[#9BA7B8]'
                          }`}
                        >
                          {!blzPlayed
                            ? 'Aucune'
                            : blzDelta >= 0
                            ? `+${blzDelta}`
                            : blzDelta}
                        </div>
                      </div>
                    </div>

                    {r.notes && (
                      <div className="text-[11px] text-[#9BA7B8]">{r.notes}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* VUE DESKTOP : Grand tableau pratique type feuille de calcul (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#232C3A] bg-[#0F131A] text-[11px] font-mono uppercase tracking-wider text-[#6C788B]">
                    <th className="py-3 px-4">Mois</th>
                    <th className="py-3 px-3 text-emerald-400 border-l border-[#232C3A]">
                      Classique (Elo · Écart)
                    </th>
                    <th className="py-3 px-3 text-[#D4A853] border-l border-[#232C3A]">
                      Rapide (Elo · Écart)
                    </th>
                    <th className="py-3 px-3 text-sky-400 border-l border-[#232C3A]">
                      Blitz (Elo · Écart)
                    </th>
                    <th className="py-3 px-3 border-l border-[#232C3A]">
                      Notes
                    </th>
                    <th className="py-3 px-4 text-right border-l border-[#232C3A]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232C3A] text-xs">
                  {sortedRatings.map((r) => {
                    const isEditing = isBulkEditMode || editingRowId === r.id;
                    const draft = draftsById[r.id];

                    if (isEditing && draft) {
                      return (
                        <tr
                          key={r.id}
                          className="bg-[#19202B]/70 border-l-2 border-emerald-500"
                        >
                          <td className="py-3 px-4 align-top">
                            <input
                              type="month"
                              value={draft.period}
                              onChange={(e) =>
                                updateRowDraft(r.id, { period: e.target.value })
                              }
                              className="w-36 px-2.5 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-mono font-bold text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                            />
                          </td>

                          {(
                            [
                              {
                                eloKey: 'standardElo' as const,
                                playedKey: 'standardPlayed' as const,
                                deltaKey: 'standardDelta' as const,
                                gamesKey: 'standardGamesCount' as const,
                                accent: 'focus:border-emerald-500',
                              },
                              {
                                eloKey: 'rapidElo' as const,
                                playedKey: 'rapidPlayed' as const,
                                deltaKey: 'rapidDelta' as const,
                                gamesKey: 'rapidGamesCount' as const,
                                accent: 'focus:border-[#D4A853]',
                              },
                              {
                                eloKey: 'blitzElo' as const,
                                playedKey: 'blitzPlayed' as const,
                                deltaKey: 'blitzDelta' as const,
                                gamesKey: 'blitzGamesCount' as const,
                                accent: 'focus:border-sky-400',
                              },
                            ]
                          ).map((cad, idx) => {
                            const played = draft[cad.playedKey];
                            return (
                              <td
                                key={idx}
                                className="py-2.5 px-3 border-l border-[#232C3A] align-top"
                              >
                                <div className="space-y-1.5 min-w-[180px]">
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <input
                                      type="number"
                                      title="Elo"
                                      value={draft[cad.eloKey]}
                                      onChange={(e) =>
                                        updateRowDraft(r.id, {
                                          [cad.eloKey]: e.target.value,
                                        })
                                      }
                                      className={`w-20 px-2 py-1 bg-[#131820] border border-[#2B3647] rounded-lg font-bold text-[#F1F4F8] focus:outline-none ${cad.accent}`}
                                    />
                                    <input
                                      type="number"
                                      step="0.1"
                                      title="Écart (+/-)"
                                      disabled={!played}
                                      value={played ? draft[cad.deltaKey] : '0'}
                                      onChange={(e) =>
                                        updateRowDraft(r.id, {
                                          [cad.deltaKey]: e.target.value,
                                        })
                                      }
                                      placeholder="Écart"
                                      className={`w-20 px-2 py-1 bg-[#131820] border border-[#2B3647] rounded-lg font-bold text-[#F1F4F8] disabled:opacity-40 focus:outline-none ${cad.accent}`}
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      title="Nombre de parties"
                                      disabled={!played}
                                      value={played ? draft[cad.gamesKey] : '0'}
                                      onChange={(e) =>
                                        updateRowDraft(r.id, {
                                          [cad.gamesKey]: e.target.value,
                                        })
                                      }
                                      placeholder="P."
                                      className="w-14 px-1.5 py-1 bg-[#131820] border border-[#2B3647] rounded-lg text-[#CBD5E1] disabled:opacity-40 focus:outline-none"
                                    />
                                  </div>
                                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[#9BA7B8] cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={played}
                                      onChange={(e) =>
                                        updateRowDraft(r.id, {
                                          [cad.playedKey]: e.target.checked,
                                        })
                                      }
                                      className="rounded border-[#323E52] bg-[#131820] text-emerald-500"
                                    />
                                    <span>
                                      {played
                                        ? 'Écart actif (joué)'
                                        : 'Aucune partie'}
                                    </span>
                                  </label>
                                </div>
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-3 border-l border-[#232C3A] align-top">
                            <input
                              type="text"
                              value={draft.notes}
                              onChange={(e) =>
                                updateRowDraft(r.id, { notes: e.target.value })
                              }
                              placeholder="Note..."
                              className="w-full min-w-[150px] px-2.5 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                            />
                          </td>

                          <td className="py-2.5 px-4 border-l border-[#232C3A] text-right whitespace-nowrap align-top">
                            {isBulkEditMode ? (
                              <IconButton
                                label="Supprimer ce mois (A2F)"
                                variant="danger"
                                size="xs"
                                onClick={() => setRecordToDelete(r)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </IconButton>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <IconButton
                                  label="Enregistrer ce mois (A2F)"
                                  variant="primary"
                                  size="xs"
                                  onClick={() => requestSaveSingleRowWith2fa(r)}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </IconButton>
                                <IconButton
                                  label="Annuler la modification"
                                  variant="ghost"
                                  size="xs"
                                  onClick={cancelRowEdit}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </IconButton>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    const stdPlayed = isCadencePlayed(r, 'Standard');
                    const rapPlayed = isCadencePlayed(r, 'Rapid');
                    const blzPlayed = isCadencePlayed(r, 'Blitz');
                    const stdDelta = getCadenceDelta(r, 'Standard');
                    const rapDelta = getCadenceDelta(r, 'Rapid');
                    const blzDelta = getCadenceDelta(r, 'Blitz');

                    return (
                      <tr key={r.id} className="hover:bg-[#19202B]">
                        <td className="py-3 px-4 font-semibold text-[#F1F4F8] whitespace-nowrap">
                          {formatPeriodLabel(r.period)}
                        </td>

                        <td className="py-3 px-3 border-l border-[#232C3A]/70 font-mono tabular-nums whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-emerald-400">
                              {r.standardElo}
                            </span>
                            {stdPlayed ? (
                              <span
                                className={`text-[11px] font-bold ${
                                  stdDelta > 0
                                    ? 'text-emerald-300'
                                    : stdDelta < 0
                                    ? 'text-rose-400'
                                    : 'text-[#9BA7B8]'
                                }`}
                              >
                                {stdDelta >= 0 ? `+${stdDelta}` : stdDelta}
                                {r.standardGamesCount > 0
                                  ? ` (${r.standardGamesCount}p)`
                                  : ''}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#6C788B]">
                                Aucune
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 border-l border-[#232C3A]/70 font-mono tabular-nums whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#D4A853]">
                              {r.rapidElo}
                            </span>
                            {rapPlayed ? (
                              <span
                                className={`text-[11px] font-bold ${
                                  rapDelta > 0
                                    ? 'text-emerald-300'
                                    : rapDelta < 0
                                    ? 'text-rose-400'
                                    : 'text-[#9BA7B8]'
                                }`}
                              >
                                {rapDelta >= 0 ? `+${rapDelta}` : rapDelta}
                                {(r.rapidGamesCount ?? 0) > 0
                                  ? ` (${r.rapidGamesCount}p)`
                                  : ''}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#6C788B]">
                                Aucune
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 border-l border-[#232C3A]/70 font-mono tabular-nums whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sky-400">
                              {r.blitzElo}
                            </span>
                            {blzPlayed ? (
                              <span
                                className={`text-[11px] font-bold ${
                                  blzDelta > 0
                                    ? 'text-emerald-300'
                                    : blzDelta < 0
                                    ? 'text-rose-400'
                                    : 'text-[#9BA7B8]'
                                }`}
                              >
                                {blzDelta >= 0 ? `+${blzDelta}` : blzDelta}
                                {(r.blitzGamesCount ?? 0) > 0
                                  ? ` (${r.blitzGamesCount}p)`
                                  : ''}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#6C788B]">
                                Aucune
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 border-l border-[#232C3A]/70 text-[#9BA7B8] max-w-[220px] truncate">
                          {r.notes || '—'}
                        </td>

                        <td className="py-3 px-4 border-l border-[#232C3A]/70 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <IconButton
                              label="Modifier ce mois sur place"
                              variant="ghost"
                              size="xs"
                              onClick={() => startRowEdit(r)}
                            >
                              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                            </IconButton>
                            <IconButton
                              label="Supprimer ce relevé (A2F)"
                              variant="danger"
                              size="xs"
                              onClick={() => setRecordToDelete(r)}
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

      {/* MODALE : AJOUTER UN NOUVEAU MOIS */}
      {isAddMonthOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
          <div className="bg-[#131820] border border-[#232C3A] rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-5 max-h-[92dvh] overflow-y-auto pb-safe">
            <div className="w-10 h-1 rounded-full bg-[#323E52] mx-auto sm:hidden" />

            <div className="flex items-center justify-between border-b border-[#232C3A] pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#F1F4F8] font-display">
                  Nouvelles données du mois (Protégé A2F)
                </h3>
                <p className="text-xs text-[#9BA7B8]">
                  Définissez librement vos Elos et vos propres écarts pour
                  chaque cadence.
                </p>
              </div>
              <IconButton
                label="Fermer"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddMonthOpen(false)}
              >
                <X className="w-4 h-4" />
              </IconButton>
            </div>

            <form
              onSubmit={handleSubmitNewMonthModal}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                    Mois (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    required
                    value={newMonthDraft.period}
                    onChange={(e) =>
                      setNewMonthDraft((prev) => ({
                        ...prev,
                        period: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl font-mono text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                    Note du mois
                  </label>
                  <input
                    type="text"
                    value={newMonthDraft.notes}
                    onChange={(e) =>
                      setNewMonthDraft((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Ex: Liste FIDE Novembre"
                    className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    {
                      label: 'Classique',
                      color: 'text-emerald-400',
                      border: 'border-emerald-500/30',
                      eloKey: 'standardElo' as const,
                      playedKey: 'standardPlayed' as const,
                      deltaKey: 'standardDelta' as const,
                      gamesKey: 'standardGamesCount' as const,
                    },
                    {
                      label: 'Rapide',
                      color: 'text-[#D4A853]',
                      border: 'border-[#D4A853]/30',
                      eloKey: 'rapidElo' as const,
                      playedKey: 'rapidPlayed' as const,
                      deltaKey: 'rapidDelta' as const,
                      gamesKey: 'rapidGamesCount' as const,
                    },
                    {
                      label: 'Blitz',
                      color: 'text-sky-400',
                      border: 'border-sky-400/30',
                      eloKey: 'blitzElo' as const,
                      playedKey: 'blitzPlayed' as const,
                      deltaKey: 'blitzDelta' as const,
                      gamesKey: 'blitzGamesCount' as const,
                    },
                  ]
                ).map((cad) => {
                  const played = newMonthDraft[cad.playedKey];
                  return (
                    <div
                      key={cad.label}
                      className={`p-3.5 bg-[#19202B] border ${cad.border} rounded-xl space-y-2.5`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${cad.color}`}>
                          {cad.label}
                        </span>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-[#CBD5E1] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={played}
                            onChange={(e) =>
                              setNewMonthDraft((prev) => ({
                                ...prev,
                                [cad.playedKey]: e.target.checked,
                              }))
                            }
                            className="rounded border-[#323E52] bg-[#131820] text-emerald-500"
                          />
                          <span>Joué</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-[11px] text-[#9BA7B8] mb-1">
                          Elo du mois
                        </label>
                        <input
                          type="number"
                          required
                          value={newMonthDraft[cad.eloKey]}
                          onChange={(e) =>
                            setNewMonthDraft((prev) => ({
                              ...prev,
                              [cad.eloKey]: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-mono font-bold text-[#F1F4F8]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-[#9BA7B8] mb-1">
                            Mon écart (+/-)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            disabled={!played}
                            value={played ? newMonthDraft[cad.deltaKey] : '0'}
                            onChange={(e) =>
                              setNewMonthDraft((prev) => ({
                                ...prev,
                                [cad.deltaKey]: e.target.value,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-mono font-bold text-[#F1F4F8] disabled:opacity-40"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#9BA7B8] mb-1">
                            Parties
                          </label>
                          <input
                            type="number"
                            min={0}
                            disabled={!played}
                            value={played ? newMonthDraft[cad.gamesKey] : '0'}
                            onChange={(e) =>
                              setNewMonthDraft((prev) => ({
                                ...prev,
                                [cad.gamesKey]: e.target.value,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-mono text-[#CBD5E1] disabled:opacity-40"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#232C3A]">
                <button
                  type="button"
                  onClick={() => setIsAddMonthOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#19202B] border border-[#2B3647] text-xs font-semibold text-[#CBD5E1] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Valider avec A2F</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE A2F POUR ENREGISTRER / MODIFIER DES DONNÉES DU MOIS */}
      <TwoFactorChallengeModal
        isOpen={Boolean(pendingMonthlySave)}
        variant="primary"
        badgeLabel="Données du mois · Microsoft Authenticator A2F"
        title={pendingMonthlySave?.title || ''}
        subtitle={pendingMonthlySave?.subtitle || ''}
        itemLabel={pendingMonthlySave?.itemLabel}
        details={pendingMonthlySave?.details || []}
        confirmLabel="Enregistrer (A2F)"
        twoFactorAuth={twoFactorAuth}
        accountName={profile.displayName}
        onUpdateTwoFactorAuth={onUpdateTwoFactorAuth}
        onCancel={() => setPendingMonthlySave(null)}
        onVerifiedConfirm={async () => {
          if (!pendingMonthlySave) return;
          if (pendingMonthlySave.updates.length === 1) {
            const single = pendingMonthlySave.updates[0];
            await onSaveRatingRecord(single.input, single.existingId);
          } else {
            await onSaveRatingRecordsBulk(pendingMonthlySave.updates);
          }
          if (pendingMonthlySave.mode === 'add') {
            setIsAddMonthOpen(false);
          } else if (pendingMonthlySave.mode === 'single') {
            setEditingRowId(null);
            setDraftsById({});
          } else if (pendingMonthlySave.mode === 'bulk') {
            setIsBulkEditMode(false);
            setDraftsById({});
          }
          setPendingMonthlySave(null);
        }}
      />

      {/* MODALE A2F POUR SUPPRIMER UN RELEVÉ MENSUEL */}
      <TwoFactorChallengeModal
        isOpen={Boolean(recordToDelete)}
        variant="danger"
        badgeLabel="Suppression protégée · Relevé mensuel FIDE"
        title="Supprimer ce relevé mensuel FIDE ?"
        subtitle="Vous êtes sur le point de supprimer définitivement ce mois de votre historique. Code Microsoft Authenticator obligatoire."
        itemLabel={recordToDelete ? formatPeriodLabel(recordToDelete.period) : ''}
        details={
          recordToDelete
            ? [
                {
                  label: 'Période',
                  value: formatPeriodLabel(recordToDelete.period),
                },
                {
                  label: 'Elos (Std / Rap / Blz)',
                  value: `${recordToDelete.standardElo} / ${recordToDelete.rapidElo} / ${recordToDelete.blitzElo}`,
                },
                {
                  label: 'Écarts',
                  value: `Std ${recordToDelete.standardDelta} · Rap ${
                    recordToDelete.rapidDelta ?? 0
                  } · Blz ${recordToDelete.blitzDelta ?? 0}`,
                },
              ]
            : []
        }
        requireCheckbox
        checkboxLabel="Je confirme vouloir supprimer définitivement les données de ce mois."
        confirmLabel="Supprimer ce mois (A2F)"
        twoFactorAuth={twoFactorAuth}
        accountName={profile.displayName}
        onUpdateTwoFactorAuth={onUpdateTwoFactorAuth}
        onCancel={() => setRecordToDelete(null)}
        onVerifiedConfirm={async () => {
          if (!recordToDelete) return;
          await onDeleteRatingRecord(recordToDelete.id);
          setRecordToDelete(null);
        }}
      />
    </div>
  );
};
