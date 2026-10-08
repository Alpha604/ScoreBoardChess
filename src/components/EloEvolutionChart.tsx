import React, { useMemo, useState } from 'react';
import { MonthlyRatingRecord } from '../types/fide';
import { formatPeriodLabel } from '../utils/fideMath';

interface EloEvolutionChartProps {
  records: MonthlyRatingRecord[];
  targetElo?: number;
  showCadences?: {
    standard: boolean;
    rapid: boolean;
    blitz: boolean;
  };
}

export const EloEvolutionChart: React.FC<EloEvolutionChartProps> = ({
  records,
  targetElo = 2000,
  showCadences = { standard: true, rapid: true, blitz: true },
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const sorted = useMemo(() => {
    return [...records].sort((a, b) => a.period.localeCompare(b.period));
  }, [records]);

  if (sorted.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-indigo-200 rounded-xl bg-indigo-50/30 text-sm font-medium text-indigo-900">
        Aucun relevé mensuel FIDE enregistré pour le moment.
      </div>
    );
  }

  const width = 860;
  const height = 310;
  const padLeft = 54;
  const padRight = 30;
  const padTop = 26;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues: number[] = [];
  sorted.forEach((r) => {
    if (showCadences.standard) allValues.push(r.standardElo);
    if (showCadences.rapid) allValues.push(r.rapidElo);
    if (showCadences.blitz) allValues.push(r.blitzElo);
  });
  if (targetElo) allValues.push(targetElo);

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const minElo = Math.floor((rawMin - 30) / 25) * 25;
  const maxElo = Math.ceil((rawMax + 30) / 25) * 25;
  const range = Math.max(50, maxElo - minElo);

  const getX = (index: number) => {
    if (sorted.length === 1) return padLeft + plotW / 2;
    return padLeft + (index / (sorted.length - 1)) * plotW;
  };

  const getY = (elo: number) => {
    return padTop + plotH - ((elo - minElo) / range) * plotH;
  };

  const buildPath = (getter: (r: MonthlyRatingRecord) => number) => {
    return sorted
      .map((r, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(getter(r)).toFixed(1)}`)
      .join(' ');
  };

  const buildAreaPath = (getter: (r: MonthlyRatingRecord) => number) => {
    if (sorted.length === 0) return '';
    const line = buildPath(getter);
    const firstX = getX(0).toFixed(1);
    const lastX = getX(sorted.length - 1).toFixed(1);
    const bottomY = (padTop + plotH).toFixed(1);
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const yTicks = 5;
  const gridLevels = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round(minElo + (i * range) / yTicks)
  );

  const activeRecord = hoveredIndex !== null ? sorted[hoveredIndex] : sorted[sorted.length - 1];

  return (
    <div className="flex flex-col gap-4">
      {/* Bandeau récapitulatif coloré du mois sélectionné */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-700">
          <span className="font-bold text-indigo-950 text-sm">
            {formatPeriodLabel(activeRecord.period)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums font-medium text-slate-600">
            {activeRecord.standardGamesCount} partie{activeRecord.standardGamesCount > 1 ? 's' : ''} FIDE
          </span>
          {activeRecord.notes && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600 font-medium truncate max-w-md">
                {activeRecord.notes}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums text-xs">
          {showCadences.standard && (
            <span className="text-indigo-700 font-bold">
              Classique : {activeRecord.standardElo}{' '}
              <span
                className={
                  activeRecord.standardDelta > 0
                    ? 'text-emerald-700'
                    : activeRecord.standardDelta < 0
                    ? 'text-rose-700'
                    : 'text-slate-500'
                }
              >
                ({activeRecord.standardDelta > 0 ? `+${activeRecord.standardDelta}` : activeRecord.standardDelta})
              </span>
            </span>
          )}
          {showCadences.rapid && (
            <span className="text-amber-700 font-bold">
              Rapide : {activeRecord.rapidElo}
            </span>
          )}
          {showCadences.blitz && (
            <span className="text-sky-700 font-bold">
              Blitz : {activeRecord.blitzElo}
            </span>
          )}
        </div>
      </div>

      {/* Graphique SVG */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[600px] select-none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="standardAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Lignes de grille horizontales */}
          {gridLevels.map((lvl) => {
            const y = getY(lvl);
            return (
              <g key={lvl}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[11px] font-semibold"
                >
                  {lvl}
                </text>
              </g>
            );
          })}

          {/* Ligne d'objectif Elo */}
          {targetElo >= minElo && targetElo <= maxElo && (
            <g>
              <line
                x1={padLeft}
                y1={getY(targetElo)}
                x2={width - padRight}
                y2={getY(targetElo)}
                stroke="#059669"
                strokeDasharray="6 4"
                strokeWidth="1.75"
              />
              <text
                x={width - padRight - 4}
                y={getY(targetElo) - 7}
                textAnchor="end"
                className="fill-emerald-700 font-mono text-[11px] font-bold"
              >
                Objectif {targetElo} Elo
              </text>
            </g>
          )}

          {/* Courbe Blitz (Bleu Azur) */}
          {showCadences.blitz && (
            <path
              d={buildPath((r) => r.blitzElo)}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.25"
              strokeDasharray="5 3"
            />
          )}

          {/* Courbe Rapide (Ambre) */}
          {showCadences.rapid && (
            <path
              d={buildPath((r) => r.rapidElo)}
              fill="none"
              stroke="#d97706"
              strokeWidth="2.5"
            />
          )}

          {/* Courbe Classique (Indigo Royal) */}
          {showCadences.standard && (
            <>
              <path d={buildAreaPath((r) => r.standardElo)} fill="url(#standardAreaGrad)" />
              <path
                d={buildPath((r) => r.standardElo)}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="3.25"
              />
            </>
          )}

          {/* Curseur vertical au survol */}
          {hoveredIndex !== null && (
            <line
              x1={getX(hoveredIndex)}
              y1={padTop}
              x2={getX(hoveredIndex)}
              y2={padTop + plotH}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Points et étiquettes de mois */}
          {sorted.map((r, i) => {
            const x = getX(i);
            const isHovered = hoveredIndex === i;
            const showLabel =
              sorted.length <= 14 || i === 0 || i === sorted.length - 1 || i % 2 === 0;

            return (
              <g key={r.id || r.period}>
                {showLabel && (
                  <text
                    x={x}
                    y={height - 12}
                    textAnchor="middle"
                    className={`font-mono text-[11px] ${
                      isHovered ? 'fill-indigo-700 font-bold' : 'fill-slate-600 font-medium'
                    }`}
                  >
                    {r.period}
                  </text>
                )}

                {showCadences.blitz && (
                  <circle
                    cx={x}
                    cy={getY(r.blitzElo)}
                    r={isHovered ? 5.5 : 3.5}
                    className="fill-sky-600 stroke-white stroke-2"
                  />
                )}

                {showCadences.rapid && (
                  <circle
                    cx={x}
                    cy={getY(r.rapidElo)}
                    r={isHovered ? 5.5 : 3.5}
                    className="fill-amber-500 stroke-white stroke-2"
                  />
                )}

                {showCadences.standard && (
                  <circle
                    cx={x}
                    cy={getY(r.standardElo)}
                    r={isHovered ? 6.5 : 4.5}
                    className="fill-indigo-600 stroke-white stroke-2"
                  />
                )}

                {/* Colonne interactive au survol */}
                <rect
                  x={x - plotW / Math.max(2, sorted.length * 2)}
                  y={padTop}
                  width={plotW / Math.max(1, sorted.length)}
                  height={plotH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
