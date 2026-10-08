import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Calendar,
  Edit3,
  Plus,
  Trash2,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import {
  FideGame,
  MonthlyRatingRecord,
  PlayerProfile,
} from '../types/fide';
import {
  calculateFideEloChange,
  calculateFideExpectedScore,
  calculateFidePerformanceRating,
  formatPeriodLabel,
} from '../utils/fideMath';
import { EloEvolutionChart } from './EloEvolutionChart';

interface StatisticsSectionProps {
  records: MonthlyRatingRecord[];
  games: FideGame[];
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

  // Simulateur Elo interactif
  const [simPlayerElo, setSimPlayerElo] = useState(profile.standardElo);
  const [simOppElo, setSimOppElo] = useState(1750);
  const [simKFactor, setSimKFactor] = useState<10 | 20 | 40>(profile.kFactor);

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
      const netElo =
        Math.round(list.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;
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
        accentTop: 'border-t-indigo-600',
        bgSoft: 'bg-indigo-50/50',
        badgeClass: 'bg-indigo-100 text-indigo-900',
        eloColor: 'text-indigo-950',
        ...computeFor(
          'Standard',
          latestRecord ? latestRecord.standardElo : profile.standardElo
        ),
      },
      {
        label: 'Rapide',
        accentTop: 'border-t-amber-500',
        bgSoft: 'bg-amber-50/50',
        badgeClass: 'bg-amber-100 text-amber-900',
        eloColor: 'text-amber-950',
        ...computeFor(
          'Rapid',
          latestRecord ? latestRecord.rapidElo : profile.rapidElo
        ),
      },
      {
        label: 'Blitz',
        accentTop: 'border-t-sky-500',
        bgSoft: 'bg-sky-50/50',
        badgeClass: 'bg-sky-100 text-sky-900',
        eloColor: 'text-sky-950',
        ...computeFor(
          'Blitz',
          latestRecord ? latestRecord.blitzElo : profile.blitzElo
        ),
      },
    ];
  }, [games, sortedRatings, profile]);

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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-indigo-950">
            Statistiques & Évolution Elo
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Visualisez l’évolution de votre Elo au fil des mois, vos classements dans toutes les cadences (Classique, Rapide, Blitz) et vos performances détaillées.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenProfileModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors self-start"
        >
          <UserCheck className="w-4 h-4 text-indigo-600" />
          Modifier mes Elos actuels & Objectif ({profile.targetElo})
        </button>
      </div>

      {/* 1. Classement et bilan dans chacune des 3 cadences */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cadenceStats.map((c) => (
          <div
            key={c.tc}
            className={`bg-white border border-slate-200 border-t-4 ${c.accentTop} rounded-2xl p-5 shadow-sm space-y-4`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div
                  className={`inline-block text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${c.badgeClass}`}
                >
                  {c.label}
                </div>
                <div className={`text-3xl font-mono font-extrabold mt-2 ${c.eloColor}`}>
                  {c.currentElo} <span className="text-sm font-normal text-slate-500">Elo</span>
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-[11px] font-bold text-slate-500">Elo gagné (parties)</div>
                <div
                  className={`text-sm font-extrabold px-2 py-0.5 rounded mt-0.5 inline-block ${
                    c.netElo >= 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {c.netElo >= 0 ? `+${c.netElo.toFixed(1)}` : c.netElo.toFixed(1)} pts
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-xs">
              <div className={`p-2.5 rounded-xl ${c.bgSoft}`}>
                <div className="text-slate-600 font-medium">Parties</div>
                <div className="font-mono font-extrabold text-slate-900 mt-0.5">
                  {c.count} jouées
                </div>
              </div>
              <div className={`p-2.5 rounded-xl ${c.bgSoft}`}>
                <div className="text-slate-600 font-medium">Taux victoire</div>
                <div className="font-mono font-extrabold text-emerald-700 mt-0.5">
                  {c.winRate}%
                </div>
              </div>
              <div className={`p-2.5 rounded-xl ${c.bgSoft}`}>
                <div className="text-slate-600 font-medium">Perf. FIDE</div>
                <div className="font-mono font-extrabold text-violet-900 mt-0.5">
                  {c.perf || '—'}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-700 font-bold">{c.wins} V</span>
                <span className="text-amber-700 font-bold">{c.draws} N</span>
                <span className="text-rose-700 font-bold">{c.losses} D</span>
                <span className="text-slate-600">Moy. adv : {c.avgOpp || '—'}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${c.winRate}%` }}
                  className="bg-emerald-500 h-full"
                />
                <div
                  style={{ width: `${c.drawRate}%` }}
                  className="bg-amber-400 h-full"
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
      <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-indigo-950 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Courbe d’évolution de mon Elo au fil des mois
            </h2>
            <p className="text-xs text-slate-600">
              Publication mensuelle FIDE (1er du mois) en Classique, Rapide et Blitz.
            </p>
          </div>
          <div className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
            Objectif Elo visé : <strong>{profile.targetElo}</strong>
          </div>
        </div>

        <EloEvolutionChart
          records={records}
          targetElo={profile.targetElo}
        />
      </div>

      {/* 3. Bilan Blancs vs Noirs + Simulateur FIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-indigo-950">
            Performance par Couleur (Blancs vs Noirs)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <span className="w-3.5 h-3.5 rounded-sm bg-white border border-slate-400 shadow-2xs" />
                  Avec les Blancs
                </span>
                <span className="text-xs font-mono font-bold text-slate-600">
                  {colorStats.white.count} parties
                </span>
              </div>
              <div className="text-2xl font-mono font-extrabold text-slate-900">
                {colorStats.white.score} / {colorStats.white.count} pts
              </div>
              <div className="text-xs font-mono space-x-2">
                <span className="text-emerald-700 font-bold">
                  {colorStats.white.wins}V ({colorStats.white.winRate}%)
                </span>
                <span className="text-amber-700 font-bold">{colorStats.white.draws}N</span>
                <span className="text-rose-700 font-bold">{colorStats.white.losses}D</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${colorStats.white.winRate}%` }}
                  className="bg-emerald-500 h-full"
                />
                <div
                  style={{ width: `${colorStats.white.drawRate}%` }}
                  className="bg-amber-400 h-full"
                />
                <div
                  style={{ width: `${colorStats.white.lossRate}%` }}
                  className="bg-rose-500 h-full"
                />
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-mono">
                <span className="text-slate-600">
                  Perf : <strong className="text-violet-900">{colorStats.white.perf || '—'}</strong>
                </span>
                <span
                  className={`font-bold ${
                    colorStats.white.netElo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {colorStats.white.netElo >= 0
                    ? `+${colorStats.white.netElo.toFixed(1)}`
                    : colorStats.white.netElo.toFixed(1)}{' '}
                  Elo
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <span className="w-3.5 h-3.5 rounded-sm bg-slate-900 border border-slate-900" />
                  Avec les Noirs
                </span>
                <span className="text-xs font-mono font-bold text-slate-600">
                  {colorStats.black.count} parties
                </span>
              </div>
              <div className="text-2xl font-mono font-extrabold text-slate-900">
                {colorStats.black.score} / {colorStats.black.count} pts
              </div>
              <div className="text-xs font-mono space-x-2">
                <span className="text-emerald-700 font-bold">
                  {colorStats.black.wins}V ({colorStats.black.winRate}%)
                </span>
                <span className="text-amber-700 font-bold">{colorStats.black.draws}N</span>
                <span className="text-rose-700 font-bold">{colorStats.black.losses}D</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${colorStats.black.winRate}%` }}
                  className="bg-emerald-500 h-full"
                />
                <div
                  style={{ width: `${colorStats.black.drawRate}%` }}
                  className="bg-amber-400 h-full"
                />
                <div
                  style={{ width: `${colorStats.black.lossRate}%` }}
                  className="bg-rose-500 h-full"
                />
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-mono">
                <span className="text-slate-600">
                  Perf : <strong className="text-violet-900">{colorStats.black.perf || '—'}</strong>
                </span>
                <span
                  className={`font-bold ${
                    colorStats.black.netElo >= 0 ? 'text-emerald-700' : 'text-rose-700'
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
        <div className="lg:col-span-6 bg-white border border-slate-200 border-t-4 border-t-violet-600 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-indigo-950 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-violet-600" />
              Calculateur & Simulateur FIDE d’une ronde
            </h3>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-violet-50 text-violet-800 border border-violet-200">
              Score espéré : {simExpected}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mon Elo</label>
              <input
                type="number"
                value={simPlayerElo}
                onChange={(e) => setSimPlayerElo(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Elo Adversaire</label>
              <input
                type="number"
                value={simOppElo}
                onChange={(e) => setSimOppElo(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Facteur K</label>
              <select
                value={simKFactor}
                onChange={(e) => setSimKFactor(Number(e.target.value) as 10 | 20 | 40)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold bg-white focus:outline-none focus:border-indigo-600"
              >
                <option value={40}>K = 40</option>
                <option value={20}>K = 20</option>
                <option value={10}>K = 10</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <div className="text-xs font-extrabold text-emerald-900">En cas de Victoire</div>
              <div className="text-lg font-mono font-extrabold text-emerald-700 mt-0.5">
                +{simWinDelta.toFixed(1)} pts
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <div className="text-xs font-extrabold text-amber-900">En cas de Nulle</div>
              <div className="text-lg font-mono font-extrabold text-amber-800 mt-0.5">
                {simDrawDelta >= 0 ? `+${simDrawDelta.toFixed(1)}` : simDrawDelta.toFixed(1)} pts
              </div>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
              <div className="text-xs font-extrabold text-rose-900">En cas de Défaite</div>
              <div className="text-lg font-mono font-extrabold text-rose-700 mt-0.5">
                {simLossDelta.toFixed(1)} pts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Statistiques par Ouverture */}
      {openingStats.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50/40">
            <h3 className="text-base font-extrabold text-indigo-950">
              Mes Ouvertures les plus jouées
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-indigo-100 bg-indigo-50/60 text-xs font-extrabold text-indigo-950">
                  <th className="py-3 px-4">Code ECO</th>
                  <th className="py-3 px-4">Ouverture</th>
                  <th className="py-3 px-4 text-center">Parties</th>
                  <th className="py-3 px-4 text-center">Bilan (V / N / D)</th>
                  <th className="py-3 px-4 text-right">Elo Gagné</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {openingStats.map((op) => {
                  const wPct = op.count > 0 ? Math.round((op.wins / op.count) * 100) : 0;
                  const dPct = op.count > 0 ? Math.round((op.draws / op.count) * 100) : 0;
                  const lPct = op.count > 0 ? Math.max(0, 100 - wPct - dPct) : 0;
                  return (
                    <tr key={`${op.eco}_${op.name}`} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs font-extrabold text-indigo-700">
                        {op.eco}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{op.name}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">{op.count}</td>
                      <td className="py-3 px-4 text-center font-mono text-xs">
                        <div>
                          <span className="text-emerald-700 font-bold">{op.wins}V</span> ·{' '}
                          <span className="text-amber-700 font-bold">{op.draws}N</span> ·{' '}
                          <span className="text-rose-700 font-bold">{op.losses}D</span>
                        </div>
                        <div className="w-28 mx-auto h-1.5 bg-slate-100 rounded-full overflow-hidden flex mt-1">
                          <div style={{ width: `${wPct}%` }} className="bg-emerald-500 h-full" />
                          <div style={{ width: `${dPct}%` }} className="bg-amber-400 h-full" />
                          <div style={{ width: `${lPct}%` }} className="bg-rose-500 h-full" />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold">
                        <span
                          className={
                            op.netElo >= 0 ? 'text-emerald-700' : 'text-rose-700'
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-extrabold text-indigo-950">
                {editingRecordId
                  ? 'Modifier le relevé mensuel'
                  : 'Enregistrer un relevé mensuel FIDE'}
              </h3>
            </div>
            {editingRecordId && (
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Annuler
              </button>
            )}
          </div>

          <form onSubmit={handleAddRecord} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mois (YYYY-MM)</label>
              <input
                type="month"
                required
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-indigo-50/50 border border-indigo-200 rounded-xl">
                <label className="block font-extrabold text-indigo-950 mb-1">Classique</label>
                <input
                  type="number"
                  required
                  value={standardElo}
                  onChange={(e) => setStandardElo(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded-lg font-mono font-bold text-indigo-950"
                />
              </div>
              <div className="p-2 bg-amber-50/50 border border-amber-200 rounded-xl">
                <label className="block font-extrabold text-amber-950 mb-1">Rapide</label>
                <input
                  type="number"
                  required
                  value={rapidElo}
                  onChange={(e) => setRapidElo(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg font-mono font-bold text-amber-950"
                />
              </div>
              <div className="p-2 bg-sky-50/50 border border-sky-200 rounded-xl">
                <label className="block font-extrabold text-sky-950 mb-1">Blitz</label>
                <input
                  type="number"
                  required
                  value={blitzElo}
                  onChange={(e) => setBlitzElo(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white border border-sky-200 rounded-lg font-mono font-bold text-sky-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Parties du mois
                </label>
                <input
                  type="number"
                  min={0}
                  value={standardGamesCount}
                  onChange={(e) => setStandardGamesCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Variation Elo (+/-)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={standardDelta}
                  onChange={(e) => setStandardDelta(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Note</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Liste FIDE Novembre"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {isSaving
                ? 'Enregistrement...'
                : editingRecordId
                ? 'Mettre à jour ce mois'
                : 'Enregistrer le mois'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50/40">
            <h3 className="text-sm font-extrabold text-indigo-950">
              Historique de mes publications mensuelles FIDE ({sortedRatings.length} mois)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-indigo-100 bg-indigo-50/60 text-xs font-extrabold text-indigo-950">
                  <th className="py-3 px-4">Mois</th>
                  <th className="py-3 px-4 text-right text-indigo-900">Classique</th>
                  <th className="py-3 px-4 text-right text-amber-800">Rapide</th>
                  <th className="py-3 px-4 text-right text-sky-800">Blitz</th>
                  <th className="py-3 px-4 text-right">Variation</th>
                  <th className="py-3 px-4 text-center">Parties</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {sortedRatings.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatPeriodLabel(r.period)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-indigo-950 bg-indigo-50/25">
                      {r.standardElo}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-900 bg-amber-50/25">
                      {r.rapidElo}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sky-900 bg-sky-50/25">
                      {r.blitzElo}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span
                        className={
                          r.standardDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }
                      >
                        {r.standardDelta >= 0
                          ? `+${r.standardDelta}`
                          : r.standardDelta}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {r.standardGamesCount}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{r.notes || '—'}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditRecord(r)}
                          className="p-1 text-slate-400 hover:text-indigo-700 rounded hover:bg-indigo-50"
                          title="Modifier ce relevé"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRatingRecord(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                          title="Supprimer ce relevé"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
