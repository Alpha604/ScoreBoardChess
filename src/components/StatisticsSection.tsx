import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  Plus,
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
} from '../types/fide';
import {
  calculateFideEloChange,
  calculateFideExpectedScore,
  calculateFidePerformanceRating,
  formatPeriodLabel,
} from '../utils/fideMath';
import { formatPlayerNameDisplay } from '../utils/fideValidation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EloEvolutionChart } from './EloEvolutionChart';
import { FederationFlag } from './FederationFlag';
import { IconButton } from './IconButton';

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

interface MonthlyCadenceCell {
  cadence: TimeControlCategory;
  hasActivity: boolean;
  delta: number;
  games: FideGame[];
  manualTournaments: Tournament[];
  recordFallback?: {
    gamesCount: number;
    delta: number;
    notes: string;
  };
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
  onDeleteRatingRecord: (id: string) => Promise<void>;
  onOpenProfileModal: () => void;
}

export const StatisticsSection: React.FC<StatisticsSectionProps> = ({
  records,
  games,
  tournaments = [],
  profile,
  onSaveRatingRecord,
  onDeleteRatingRecord,
  onOpenProfileModal,
}) => {
  const [editingRecordId, setEditingRecordId] = useState<string | undefined>(undefined);
  const [period, setPeriod] = useState('2026-11');
  const [standardElo, setStandardElo] = useState(profile.standardElo);
  const [rapidElo, setRapidElo] = useState(profile.rapidElo);
  const [blitzElo, setBlitzElo] = useState(profile.blitzElo);
  const [standardGamesCount, setStandardGamesCount] = useState(5);
  const [standardDelta, setStandardDelta] = useState(0);
  const [fideRankNational, setFideRankNational] = useState(4120);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<MonthlyRatingRecord | null>(null);

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

  // Tableau des variations d'Elo par mois et par cadence (Classique / Rapide / Blitz)
  const monthlyVariations = useMemo(() => {
    const periodSet = new Set<string>();
    const isValidPeriod = (p: string | undefined): p is string =>
      Boolean(p && /^\d{4}-\d{2}$/.test(p));

    games.forEach((g) => {
      const p = g.datePlayed?.slice(0, 7);
      if (isValidPeriod(p)) periodSet.add(p);
    });
    tournaments.forEach((t) => {
      if (
        t.manualEloDelta !== undefined &&
        t.manualEloDelta !== null &&
        !Number.isNaN(Number(t.manualEloDelta))
      ) {
        const p = (t.endDate || t.startDate)?.slice(0, 7);
        if (isValidPeriod(p)) periodSet.add(p);
      }
    });
    records.forEach((r) => {
      if (isValidPeriod(r.period)) periodSet.add(r.period);
    });

    const periods = Array.from(periodSet).sort((a, b) => b.localeCompare(a));
    const ascRatings = [...records].sort((a, b) =>
      a.period.localeCompare(b.period)
    );
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
          (g) => g.datePlayed.startsWith(period) && g.timeControl === cadence
        )
        .sort((a, b) => b.datePlayed.localeCompare(a.datePlayed));

      const manualTourneys = tournaments.filter(
        (t) =>
          t.timeControl === cadence &&
          (t.endDate || t.startDate).startsWith(period) &&
          t.manualEloDelta !== undefined &&
          t.manualEloDelta !== null &&
          !Number.isNaN(Number(t.manualEloDelta))
      );

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
          games: periodGames,
          manualTournaments: manualTourneys,
        };
      }

      const recIdx = ascRatings.findIndex((r) => r.period === period);
      const rec = recIdx >= 0 ? ascRatings[recIdx] : undefined;
      const prevRec = recIdx > 0 ? ascRatings[recIdx - 1] : undefined;

      if (rec) {
        if (
          cadence === 'Standard' &&
          (rec.standardDelta !== 0 || rec.standardGamesCount > 0)
        ) {
          return {
            cadence,
            hasActivity: true,
            delta: Math.round(rec.standardDelta * 10) / 10,
            games: [],
            manualTournaments: [],
            recordFallback: {
              gamesCount: rec.standardGamesCount,
              delta: rec.standardDelta,
              notes: rec.notes,
            },
          };
        }
        if (cadence === 'Rapid' && prevRec) {
          const diff = Math.round((rec.rapidElo - prevRec.rapidElo) * 10) / 10;
          if (diff !== 0) {
            return {
              cadence,
              hasActivity: true,
              delta: diff,
              games: [],
              manualTournaments: [],
              recordFallback: {
                gamesCount: 0,
                delta: diff,
                notes: rec.notes || 'Écart mensuel Rapide (relevé FIDE)',
              },
            };
          }
        }
        if (cadence === 'Blitz' && prevRec) {
          const diff = Math.round((rec.blitzElo - prevRec.blitzElo) * 10) / 10;
          if (diff !== 0) {
            return {
              cadence,
              hasActivity: true,
              delta: diff,
              games: [],
              manualTournaments: [],
              recordFallback: {
                gamesCount: 0,
                delta: diff,
                notes: rec.notes || 'Écart mensuel Blitz (relevé FIDE)',
              },
            };
          }
        }
      }

      return {
        cadence,
        hasActivity: false,
        delta: 0,
        games: [],
        manualTournaments: [],
      };
    };

    return periods.map((period) => ({
      period,
      label: formatFideMatrixPeriod(period),
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

  const handleEditRecord = (r: MonthlyRatingRecord) => {
    setEditingRecordId(r.id);
    setPeriod(r.period);
    setStandardElo(r.standardElo);
    setRapidElo(r.rapidElo);
    setBlitzElo(r.blitzElo);
    setStandardGamesCount(r.standardGamesCount);
    setStandardDelta(r.standardDelta);
    setFideRankNational(r.fideRankNational);
    setNotes(r.notes);
  };

  const handleResetForm = () => {
    setEditingRecordId(undefined);
    setPeriod('2026-11');
    setStandardElo(profile.standardElo);
    setRapidElo(profile.rapidElo);
    setBlitzElo(profile.blitzElo);
    setStandardGamesCount(5);
    setStandardDelta(0);
    setFideRankNational(4120);
    setNotes('');
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveRatingRecord(
        {
          period,
          standardElo: Number(standardElo),
          rapidElo: Number(rapidElo),
          blitzElo: Number(blitzElo),
          standardGamesCount: Number(standardGamesCount),
          standardDelta: Number(standardDelta),
          fideRankNational: Number(fideRankNational),
          notes,
        },
        editingRecordId
      );
      handleResetForm();
    } finally {
      setIsSaving(false);
    }
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
              Bilan mensuel par cadence (Classique, Rapide, Blitz) — cliquez sur « Voir » pour consulter les parties.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#6C788B]">
            {monthlyVariations.length} période{monthlyVariations.length > 1 ? 's' : ''}
          </span>
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
                          disabled={!cell.hasActivity}
                          onClick={() => {
                            if (!cell.hasActivity) return;
                            setSelectedVariationCell(
                              isSelected
                                ? null
                                : { period: row.period, cadence: item.cad }
                            );
                          }}
                          className={`p-2 rounded-xl border text-left transition-colors ${
                            !cell.hasActivity
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Détail du mois + cadence sélectionné */}
            {activeVariationDetail && (
              <div className="border-t border-[#232C3A] bg-[#0F131A] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
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
                  </div>

                  <IconButton
                    label="Fermer le détail mensuel"
                    variant="ghost"
                    size="xs"
                    onClick={() => setSelectedVariationCell(null)}
                  >
                    <X className="w-4 h-4" />
                  </IconButton>
                </div>

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

      {/* 5. Historique et ajout des relevés mensuels officiels FIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-4 bg-[#131820] border border-[#232C3A] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-[#232C3A] pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h3 className="font-display text-sm font-bold text-[#F1F4F8]">
                {editingRecordId
                  ? 'Modifier le relevé mensuel'
                  : 'Ajouter un relevé mensuel'}
              </h3>
            </div>
            {editingRecordId && (
              <IconButton
                label="Annuler la modification"
                variant="ghost"
                size="xs"
                onClick={handleResetForm}
              >
                <X className="w-3.5 h-3.5" />
              </IconButton>
            )}
          </div>

          <form onSubmit={handleAddRecord} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1.5">Mois (YYYY-MM)</label>
              <input
                type="month"
                required
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl font-mono text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-[#19202B] border border-[#232C3A] rounded-xl">
                <label className="block font-semibold text-emerald-400 mb-1">Classique</label>
                <input
                  type="number"
                  required
                  value={standardElo}
                  onChange={(e) => setStandardElo(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-mono font-bold text-[#F1F4F8]"
                />
              </div>
              <div className="p-2 bg-[#19202B] border border-[#232C3A] rounded-xl">
                <label className="block font-semibold text-[#D4A853] mb-1">Rapide</label>
                <input
                  type="number"
                  required
                  value={rapidElo}
                  onChange={(e) => setRapidElo(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-mono font-bold text-[#F1F4F8]"
                />
              </div>
              <div className="p-2 bg-[#19202B] border border-[#232C3A] rounded-xl">
                <label className="block font-semibold text-sky-400 mb-1">Blitz</label>
                <input
                  type="number"
                  required
                  value={blitzElo}
                  onChange={(e) => setBlitzElo(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-[#131820] border border-[#2B3647] rounded-lg font-mono font-bold text-[#F1F4F8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                  Parties du mois
                </label>
                <input
                  type="number"
                  min={0}
                  value={standardGamesCount}
                  onChange={(e) => setStandardGamesCount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl font-mono text-[#F1F4F8]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                  Variation Elo
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={standardDelta}
                  onChange={(e) => setStandardDelta(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl font-mono text-[#F1F4F8]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1.5">Note</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Liste FIDE Novembre"
                className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder:text-[#6C788B]"
              />
            </div>

            <div className="flex justify-end pt-1">
              <IconButton
                type="submit"
                label={
                  isSaving
                    ? 'Enregistrement...'
                    : editingRecordId
                    ? 'Mettre à jour ce relevé'
                    : 'Enregistrer ce relevé mensuel'
                }
                variant="primary"
                size="md"
                disabled={isSaving}
              >
                {editingRecordId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </IconButton>
            </div>
          </form>
        </div>

        <div className="lg:col-span-8 bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#232C3A] bg-[#0F131A]">
            <h3 className="font-display text-sm font-bold text-[#F1F4F8]">
              Historique des publications mensuelles ({sortedRatings.length})
            </h3>
          </div>
          {/* Historique mensuel mobile (< 768px) */}
          <div className="md:hidden divide-y divide-[#232C3A] text-xs">
            {sortedRatings.map((r) => (
              <div key={r.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-[#F1F4F8]">
                      {formatPeriodLabel(r.period)}
                    </div>
                    <div className="text-[11px] text-[#9BA7B8] font-mono mt-0.5">
                      {r.standardGamesCount} partie(s) ·{' '}
                      <span
                        className={`font-bold ${
                          r.standardDelta >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {r.standardDelta >= 0
                          ? `+${r.standardDelta}`
                          : r.standardDelta}{' '}
                        pts
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton
                      label="Modifier ce relevé"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleEditRecord(r)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      label="Supprimer ce relevé"
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
                  </div>
                  <div className="py-1.5 px-2 rounded-lg bg-[#19202B] border border-[#232C3A]">
                    <div className="text-[10px] font-sans text-[#6C788B]">
                      Rapide
                    </div>
                    <div className="font-bold text-[#D4A853] mt-0.5">
                      {r.rapidElo}
                    </div>
                  </div>
                  <div className="py-1.5 px-2 rounded-lg bg-[#19202B] border border-[#232C3A]">
                    <div className="text-[10px] font-sans text-[#6C788B]">
                      Blitz
                    </div>
                    <div className="font-bold text-sky-400 mt-0.5">
                      {r.blitzElo}
                    </div>
                  </div>
                </div>

                {r.notes && (
                  <div className="text-[11px] text-[#9BA7B8]">{r.notes}</div>
                )}
              </div>
            ))}
          </div>

          {/* Historique mensuel desktop (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232C3A] bg-[#0F131A] text-[11px] font-mono uppercase tracking-wider text-[#6C788B]">
                  <th className="py-3 px-4">Mois</th>
                  <th className="py-3 px-4 text-right text-emerald-400">Classique</th>
                  <th className="py-3 px-4 text-right text-[#D4A853]">Rapide</th>
                  <th className="py-3 px-4 text-right text-sky-400">Blitz</th>
                  <th className="py-3 px-4 text-right">Variation</th>
                  <th className="py-3 px-4 text-center">Parties</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232C3A] text-xs">
                {sortedRatings.map((r) => (
                  <tr key={r.id} className="hover:bg-[#19202B]">
                    <td className="py-3 px-4 font-semibold text-[#F1F4F8]">
                      {formatPeriodLabel(r.period)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-400">
                      {r.standardElo}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#D4A853]">
                      {r.rapidElo}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-sky-400">
                      {r.blitzElo}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                      <span
                        className={
                          r.standardDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {r.standardDelta >= 0
                          ? `+${r.standardDelta}`
                          : r.standardDelta}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-[#CBD5E1]">
                      {r.standardGamesCount}
                    </td>
                    <td className="py-3 px-4 text-[#9BA7B8]">{r.notes || '—'}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <IconButton
                          label="Modifier ce relevé"
                          variant="ghost"
                          size="xs"
                          onClick={() => handleEditRecord(r)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton
                          label="Supprimer ce relevé"
                          variant="danger"
                          size="xs"
                          onClick={() => setRecordToDelete(r)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODALE DE CONFIRMATION DE SUPPRESSION D'UN RELEVÉ MENSUEL (3 secondes) */}
      <ConfirmDeleteModal
        isOpen={Boolean(recordToDelete)}
        title="Supprimer ce relevé mensuel FIDE ?"
        subtitle="Vous êtes sur le point de supprimer ce mois de votre historique de classement."
        itemName={recordToDelete ? formatPeriodLabel(recordToDelete.period) : ''}
        details={
          recordToDelete
            ? [
                {
                  label: 'Période',
                  value: formatPeriodLabel(recordToDelete.period),
                },
                {
                  label: 'Elos (Classique / Rapide / Blitz)',
                  value: `${recordToDelete.standardElo} / ${recordToDelete.rapidElo} / ${recordToDelete.blitzElo}`,
                },
                {
                  label: 'Variation & Parties',
                  value: `${
                    recordToDelete.standardDelta >= 0 ? '+' : ''
                  }${recordToDelete.standardDelta} pts (${recordToDelete.standardGamesCount} parties)`,
                },
              ]
            : []
        }
        onCancel={() => setRecordToDelete(null)}
        onConfirm={async () => {
          if (!recordToDelete) return;
          await onDeleteRatingRecord(recordToDelete.id);
          setRecordToDelete(null);
        }}
      />
    </div>
  );
};
