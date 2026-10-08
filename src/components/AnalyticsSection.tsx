import React, { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { FideGame, PlayerProfile } from '../types/fide';
import {
  calculateFideEloChange,
  calculateFideExpectedScore,
  calculateFidePerformanceRating,
} from '../utils/fideMath';

interface AnalyticsSectionProps {
  games: FideGame[];
  profile: PlayerProfile | null;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({ games, profile }) => {
  // Interactive FIDE Simulator state
  const [simPlayerElo, setSimPlayerElo] = useState(profile?.standardElo || 1868);
  const [simOpponentElo, setSimOpponentElo] = useState(1950);
  const [simKFactor, setSimKFactor] = useState<10 | 20 | 40>(profile?.kFactor || 20);

  // 1. Color Breakdown (White vs Black)
  const colorStats = useMemo(() => {
    const computeFor = (subset: FideGame[]) => {
      const total = subset.length;
      const wins = subset.filter((g) => g.playerScore === 1).length;
      const draws = subset.filter((g) => g.playerScore === 0.5).length;
      const losses = subset.filter((g) => g.playerScore === 0).length;
      const points = subset.reduce((acc, g) => acc + g.playerScore, 0);
      const pct = total > 0 ? Math.round((points / total) * 1000) / 10 : 0;
      const netElo = Math.round(subset.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;
      const perf = calculateFidePerformanceRating(subset);
      return { total, wins, draws, losses, points, pct, netElo, perf };
    };

    return {
      white: computeFor(games.filter((g) => g.playerColor === 'White')),
      black: computeFor(games.filter((g) => g.playerColor === 'Black')),
      overall: computeFor(games),
    };
  }, [games]);

  // 2. Performance by Opponent Rating Bracket
  const bracketStats = useMemo(() => {
    const brackets = [
      { label: '< 1750 FIDE', min: 0, max: 1749 },
      { label: '1750 – 1899 FIDE', min: 1750, max: 1899 },
      { label: '1900 – 2049 FIDE', min: 1900, max: 2049 },
      { label: '2050+ & Titrés (CM/FM/IM)', min: 2050, max: 4000 },
    ];

    return brackets.map((b) => {
      const subset = games.filter((g) => g.opponentElo >= b.min && g.opponentElo <= b.max);
      const total = subset.length;
      const wins = subset.filter((g) => g.playerScore === 1).length;
      const draws = subset.filter((g) => g.playerScore === 0.5).length;
      const losses = subset.filter((g) => g.playerScore === 0).length;
      const score = subset.reduce((acc, g) => acc + g.playerScore, 0);
      const netElo = Math.round(subset.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;
      const scorePct = total > 0 ? Math.round((score / total) * 100) : 0;
      return { ...b, total, wins, draws, losses, score, netElo, scorePct };
    });
  }, [games]);

  // 3. ECO Opening Repertoire Analytics
  const openingStats = useMemo(() => {
    const map = new Map<
      string,
      {
        ecoCode: string;
        openingName: string;
        count: number;
        wins: number;
        draws: number;
        losses: number;
        score: number;
        netElo: number;
      }
    >();

    games.forEach((g) => {
      const key = g.ecoCode;
      const existing = map.get(key) || {
        ecoCode: g.ecoCode,
        openingName: g.openingName,
        count: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        score: 0,
        netElo: 0,
      };
      existing.count += 1;
      if (g.playerScore === 1) existing.wins += 1;
      else if (g.playerScore === 0.5) existing.draws += 1;
      else existing.losses += 1;
      existing.score += g.playerScore;
      existing.netElo = Math.round((existing.netElo + g.eloChange) * 10) / 10;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count || b.netElo - a.netElo);
  }, [games]);

  // 4. ECO Family Summary (A, B, C, D, E)
  const ecoFamilyStats = useMemo(() => {
    const families = [
      { code: 'A', name: 'Volume A — Ouvertures de Flanc (Anglaise, Réti...)' },
      { code: 'B', name: 'Volume B — Semi-Ouvertes (Sicilienne, Caro-Kann...)' },
      { code: 'C', name: 'Volume C — Jeux Ouverts (Espagnole, Italienne, Française)' },
      { code: 'D', name: 'Volume D — Jeux Fermés & Semi-Fermés (Gambit Dame, Slave)' },
      { code: 'E', name: 'Volume E — Défenses Indiennes (Nimzo, Catalane, Est-Indienne)' },
    ];

    return families.map((f) => {
      const subset = games.filter((g) => g.ecoCode.startsWith(f.code));
      const count = subset.length;
      const score = subset.reduce((acc, g) => acc + g.playerScore, 0);
      const netElo = Math.round(subset.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;
      const pct = count > 0 ? Math.round((score / count) * 100) : 0;
      return { ...f, count, score, netElo, pct };
    });
  }, [games]);

  const simExpected = calculateFideExpectedScore(simPlayerElo, simOpponentElo);
  const simWinDelta = calculateFideEloChange(simPlayerElo, simOpponentElo, 1, simKFactor);
  const simDrawDelta = calculateFideEloChange(simPlayerElo, simOpponentElo, 0.5, simKFactor);
  const simLossDelta = calculateFideEloChange(simPlayerElo, simOpponentElo, 0, simKFactor);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Statistiques de Progression & Répertoire d’Ouvertures ECO
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Analyse détaillée de votre rendement par couleur, par tranche Elo adverse et par famille d’ouverture FIDE.
        </p>
      </div>

      {/* Section 1: White vs Black Comparative Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            title: 'Performance avec les Blancs',
            swatch: 'bg-white border border-slate-400',
            data: colorStats.white,
          },
          {
            title: 'Performance avec les Noirs',
            swatch: 'bg-slate-900 border border-slate-900',
            data: colorStats.black,
          },
        ].map((item) => {
          const d = item.data;
          const wPct = d.total > 0 ? (d.wins / d.total) * 100 : 0;
          const drPct = d.total > 0 ? (d.draws / d.total) * 100 : 0;
          const lPct = d.total > 0 ? (d.losses / d.total) * 100 : 0;

          return (
            <div
              key={item.title}
              className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-3.5 h-3.5 rounded-xs ${item.swatch}`} />
                  <h2 className="text-base font-bold text-slate-900">{item.title}</h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {d.total} partie{d.total > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-1 font-mono tabular-nums">
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Score global</div>
                  <div className="text-lg font-bold text-slate-900">
                    {d.points} / {d.total}{' '}
                    <span className="text-xs font-normal text-slate-500">({d.pct}%)</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Perf FIDE (Rp)</div>
                  <div className="text-lg font-bold text-slate-900">{d.perf || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Gain Elo net</div>
                  <div
                    className={`text-lg font-bold ${
                      d.netElo > 0
                        ? 'text-emerald-700'
                        : d.netElo < 0
                        ? 'text-rose-700'
                        : 'text-slate-800'
                    }`}
                  >
                    {d.netElo > 0 ? `+${d.netElo.toFixed(1)}` : d.netElo.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Stacked W/D/L Bar */}
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded overflow-hidden bg-slate-100 flex">
                  {wPct > 0 && (
                    <div
                      style={{ width: `${wPct}%` }}
                      className="bg-emerald-600 h-full"
                      title={`Victoires: ${d.wins}`}
                    />
                  )}
                  {drPct > 0 && (
                    <div
                      style={{ width: `${drPct}%` }}
                      className="bg-amber-500 h-full"
                      title={`Nulles: ${d.draws}`}
                    />
                  )}
                  {lPct > 0 && (
                    <div
                      style={{ width: `${lPct}%` }}
                      className="bg-rose-600 h-full"
                      title={`Défaites: ${d.losses}`}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                  <span className="text-emerald-700 font-medium">
                    +{d.wins} Gain{d.wins > 1 ? 's' : ''} ({Math.round(wPct)}%)
                  </span>
                  <span className="text-amber-700 font-medium">
                    ={d.draws} Nulle{d.draws > 1 ? 's' : ''} ({Math.round(drPct)}%)
                  </span>
                  <span className="text-rose-700 font-medium">
                    -{d.losses} Perte{d.losses > 1 ? 's' : ''} ({Math.round(lPct)}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 2: Performance vs Opponent Rating Brackets & ECO Volumes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opponent Rating Brackets */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Rendement par Tranche Elo Adverse
            </h2>
            <p className="text-xs text-slate-500">
              Score et points Elo gagnés selon la force FIDE de vos adversaires.
            </p>
          </div>

          <div className="divide-y divide-slate-200 text-xs">
            {bracketStats.map((b) => (
              <div key={b.label} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-[165px]">
                  <div className="font-semibold text-slate-900">{b.label}</div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {b.total} partie{b.total > 1 ? 's' : ''} (+{b.wins} ={b.draws} -{b.losses})
                  </div>
                </div>

                <div className="flex-1 max-w-[180px]">
                  <div className="h-2 w-full bg-slate-100 rounded overflow-hidden">
                    <div
                      style={{ width: `${b.scorePct}%` }}
                      className="h-full bg-slate-900 rounded"
                    />
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-1 text-right">
                    Score : {b.score} / {b.total} ({b.scorePct}%)
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums min-w-[70px]">
                  <span
                    className={`font-bold ${
                      b.netElo > 0
                        ? 'text-emerald-700'
                        : b.netElo < 0
                        ? 'text-rose-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {b.netElo > 0 ? `+${b.netElo.toFixed(1)}` : b.netElo.toFixed(1)}
                  </span>
                  <div className="text-[10px] text-slate-400">Pts Elo</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ECO Volumes A-E */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Performance par Volume d’Ouvertures ECO (A à E)
            </h2>
            <p className="text-xs text-slate-500">
              Classification internationale des ouvertures d’échecs.
            </p>
          </div>

          <div className="divide-y divide-slate-200 text-xs">
            {ecoFamilyStats.map((fam) => (
              <div key={fam.code} className="py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 truncate">{fam.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {fam.count} partie{fam.count > 1 ? 's' : ''} · Score {fam.score}/{fam.count} ({fam.pct}%)
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <span
                    className={`font-bold ${
                      fam.netElo > 0
                        ? 'text-emerald-700'
                        : fam.netElo < 0
                        ? 'text-rose-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {fam.netElo > 0 ? `+${fam.netElo.toFixed(1)}` : fam.netElo.toFixed(1)} Elo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Detailed Opening Repertoire Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Détail du Répertoire d’Ouvertures Jouées en Tournoi FIDE
            </h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {openingStats.length} code{openingStats.length > 1 ? 's' : ''} ECO distinct{openingStats.length > 1 ? 's' : ''}
          </span>
        </div>

        {openingStats.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Enregistrez des parties avec leur code ECO pour analyser la rentabilité de vos ouvertures.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Code ECO</th>
                  <th className="py-2.5 px-4">Nom de l’ouverture / Variante</th>
                  <th className="py-2.5 px-4 text-right">Parties</th>
                  <th className="py-2.5 px-4 text-right">Bilan (+ / = / -)</th>
                  <th className="py-2.5 px-4 text-right">Score %</th>
                  <th className="py-2.5 px-4 text-right">Rentabilité Elo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {openingStats.map((op) => {
                  const pct = op.count > 0 ? Math.round((op.score / op.count) * 100) : 0;
                  return (
                    <tr key={op.ecoCode} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                        {op.ecoCode}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{op.openingName}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{op.count}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        +{op.wins} ={op.draws} -{op.losses}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {pct}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">
                        <span
                          className={
                            op.netElo > 0
                              ? 'text-emerald-700'
                              : op.netElo < 0
                              ? 'text-rose-700'
                              : 'text-slate-600'
                          }
                        >
                          {op.netElo > 0 ? `+${op.netElo.toFixed(1)}` : op.netElo.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Interactive Official FIDE Calculator */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Calculator className="w-4 h-4 text-slate-800" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Calculateur Officiel de Variation Elo FIDE (Avant Ronde)
            </h2>
            <p className="text-xs text-slate-500">
              Simulez les gains/pertes Elo d’un appariement selon le manuel FIDE B.02 (règle d’écart maximal de 400 points incluse).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Votre Elo FIDE</label>
            <input
              type="number"
              min={1000}
              max={3500}
              value={simPlayerElo}
              onChange={(e) => setSimPlayerElo(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Elo Adversaire</label>
            <input
              type="number"
              min={1000}
              max={3500}
              value={simOpponentElo}
              onChange={(e) => setSimOpponentElo(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Facteur K</label>
            <select
              value={simKFactor}
              onChange={(e) => setSimKFactor(Number(e.target.value) as 10 | 20 | 40)}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
            >
              <option value={40}>K = 40</option>
              <option value={20}>K = 20</option>
              <option value={10}>K = 10</option>
            </select>
          </div>

          <div className="md:col-span-3 grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono tabular-nums text-center">
            <div>
              <div className="text-[11px] font-sans text-slate-500">En cas de Gain (1-0)</div>
              <div className="text-base font-bold text-emerald-700">
                +{simWinDelta.toFixed(1)} pts
              </div>
              <div className="text-[10px] text-slate-400">
                Nouvel Elo : {Math.round(simPlayerElo + simWinDelta)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-500">En cas de Nulle (½-½)</div>
              <div
                className={`text-base font-bold ${
                  simDrawDelta > 0
                    ? 'text-emerald-700'
                    : simDrawDelta < 0
                    ? 'text-rose-700'
                    : 'text-slate-800'
                }`}
              >
                {simDrawDelta > 0 ? `+${simDrawDelta.toFixed(1)}` : simDrawDelta.toFixed(1)} pts
              </div>
              <div className="text-[10px] text-slate-400">
                Score attendu : {(simExpected * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-500">En cas de Perte (0-1)</div>
              <div className="text-base font-bold text-rose-700">
                {simLossDelta.toFixed(1)} pts
              </div>
              <div className="text-[10px] text-slate-400">
                Nouvel Elo : {Math.round(simPlayerElo + simLossDelta)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
