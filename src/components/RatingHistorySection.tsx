import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { FideGame, MonthlyRatingRecord, PlayerProfile } from '../types/fide';
import { formatPeriodLabel } from '../utils/fideMath';
import { EloEvolutionChart } from './EloEvolutionChart';

interface RatingHistorySectionProps {
  records: MonthlyRatingRecord[];
  games: FideGame[];
  profile: PlayerProfile | null;
  onSaveRatingRecord: (
    data: Omit<MonthlyRatingRecord, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteRatingRecord: (id: string) => Promise<void>;
}

export const RatingHistorySection: React.FC<RatingHistorySectionProps> = ({
  records,
  games,
  profile,
  onSaveRatingRecord,
  onDeleteRatingRecord,
}) => {
  const [showCadences, setShowCadences] = useState({
    standard: true,
    rapid: true,
    blitz: true,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [standardElo, setStandardElo] = useState(profile?.standardElo || 1800);
  const [rapidElo, setRapidElo] = useState(profile?.rapidElo || 1800);
  const [blitzElo, setBlitzElo] = useState(profile?.blitzElo || 1800);
  const [standardGamesCount, setStandardGamesCount] = useState(0);
  const [standardDelta, setStandardDelta] = useState(0);
  const [fideRankNational, setFideRankNational] = useState(0);
  const [notes, setNotes] = useState('');

  const sortedDesc = useMemo(
    () => [...records].sort((a, b) => b.period.localeCompare(a.period)),
    [records]
  );

  const latestRecord = sortedDesc[0];

  // Next month FIDE publication simulator based on games played in or after the latest period
  const nextListProjection = useMemo(() => {
    const baseStandard = latestRecord?.standardElo ?? profile?.standardElo ?? 1800;
    const baseRapid = latestRecord?.rapidElo ?? profile?.rapidElo ?? 1800;
    const baseBlitz = latestRecord?.blitzElo ?? profile?.blitzElo ?? 1800;
    const cutoffMonth = latestRecord?.period || '2026-09';

    const pendingStandardGames = games.filter(
      (g) => g.timeControl === 'Standard' && g.datePlayed.slice(0, 7) >= cutoffMonth
    );
    const pendingDelta =
      Math.round(pendingStandardGames.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;
    const projectedStandard = Math.round(baseStandard + pendingDelta);

    // Compute next YYYY-MM
    const [yStr, mStr] = cutoffMonth.split('-');
    let nextY = parseInt(yStr, 10) || 2026;
    let nextM = (parseInt(mStr, 10) || 10) + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const nextPeriod = `${nextY}-${String(nextM).padStart(2, '0')}`;

    return {
      nextPeriod,
      baseStandard,
      baseRapid,
      baseBlitz,
      pendingGamesCount: pendingStandardGames.length,
      pendingDelta,
      projectedStandard,
    };
  }, [latestRecord, profile, games]);

  const openNewModal = (prefillFromProjection = false) => {
    setEditingId(undefined);
    if (prefillFromProjection) {
      setPeriod(nextListProjection.nextPeriod);
      setStandardElo(nextListProjection.projectedStandard);
      setRapidElo(nextListProjection.baseRapid);
      setBlitzElo(nextListProjection.baseBlitz);
      setStandardGamesCount(nextListProjection.pendingGamesCount);
      setStandardDelta(Math.round(nextListProjection.pendingDelta));
      setFideRankNational(latestRecord?.fideRankNational || 0);
      setNotes(
        `Publication officielle du 1er ${formatPeriodLabel(nextListProjection.nextPeriod)} (${
          nextListProjection.pendingGamesCount
        } parties comptabilisées)`
      );
    } else {
      setPeriod(new Date().toISOString().slice(0, 7));
      setStandardElo(profile?.standardElo || 1800);
      setRapidElo(profile?.rapidElo || 1800);
      setBlitzElo(profile?.blitzElo || 1800);
      setStandardGamesCount(0);
      setStandardDelta(0);
      setFideRankNational(0);
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const openEditModal = (rec: MonthlyRatingRecord) => {
    setEditingId(rec.id);
    setPeriod(rec.period);
    setStandardElo(rec.standardElo);
    setRapidElo(rec.rapidElo);
    setBlitzElo(rec.blitzElo);
    setStandardGamesCount(rec.standardGamesCount);
    setStandardDelta(rec.standardDelta);
    setFideRankNational(rec.fideRankNational);
    setNotes(rec.notes);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
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
        editingId
      );
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Évolution Mensuelle du Classement FIDE (1er du mois)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Historique officiel de vos publications mensuelles FIDE en Standard, Rapide et Blitz, avec projection en direct de la prochaine liste.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openNewModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Publier la liste {nextListProjection.nextPeriod}
          </button>
          <button
            type="button"
            onClick={() => openNewModal(false)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Ajouter un relevé mensuel
          </button>
        </div>
      </div>

      {/* Live Next Monthly List Projection Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Projection de votre prochaine publication FIDE ({formatPeriodLabel(nextListProjection.nextPeriod)})
          </div>
          <p className="text-xs text-slate-600">
            Calculé à partir de votre dernier classement officiel ({nextListProjection.baseStandard} FIDE) et des{' '}
            <strong className="font-mono">{nextListProjection.pendingGamesCount}</strong> parties Standard jouées sur la période en cours.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 font-mono tabular-nums text-right">
          <div>
            <div className="text-[11px] font-sans text-slate-500">Elo actuel publié</div>
            <div className="text-base font-bold text-slate-900">{nextListProjection.baseStandard}</div>
          </div>
          <div>
            <div className="text-[11px] font-sans text-slate-500">Variation en cours</div>
            <div
              className={`text-base font-bold ${
                nextListProjection.pendingDelta > 0
                  ? 'text-emerald-700'
                  : nextListProjection.pendingDelta < 0
                  ? 'text-rose-700'
                  : 'text-slate-700'
              }`}
            >
              {nextListProjection.pendingDelta > 0
                ? `+${nextListProjection.pendingDelta.toFixed(1)}`
                : nextListProjection.pendingDelta.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-sans text-slate-500">Prochain Elo FIDE estimé</div>
            <div className="text-lg font-bold text-slate-950">
              {nextListProjection.projectedStandard}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Cadence Chart Container */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Courbe d’Évolution Mensuelle FIDE
            </h2>
            <p className="text-xs text-slate-500">
              Survolez un mois pour inspecter le détail de la publication officielle.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setShowCadences((prev) => ({ ...prev, standard: !prev.standard }))
              }
              className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                showCadences.standard
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setShowCadences((prev) => ({ ...prev, rapid: !prev.rapid }))}
              className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                showCadences.rapid
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              Rapide
            </button>
            <button
              type="button"
              onClick={() => setShowCadences((prev) => ({ ...prev, blitz: !prev.blitz }))}
              className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                showCadences.blitz
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              Blitz
            </button>
          </div>
        </div>

        <EloEvolutionChart
          records={records}
          targetElo={profile?.targetElo || 2000}
          showCadences={showCadences}
        />
      </div>

      {/* Monthly Records Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Registre des Publications Mensuelles (1er du mois)
          </h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {sortedDesc.length} mois enregistrés
          </span>
        </div>

        {sortedDesc.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Aucun relevé mensuel enregistré. Cliquez sur « Ajouter un relevé mensuel » pour saisir votre historique FIDE.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Mois FIDE</th>
                  <th className="py-2.5 px-4 text-right">Elo Standard</th>
                  <th className="py-2.5 px-4 text-right">Évolution</th>
                  <th className="py-2.5 px-4 text-right">Parties Std.</th>
                  <th className="py-2.5 px-4 text-right">Elo Rapide</th>
                  <th className="py-2.5 px-4 text-right">Elo Blitz</th>
                  <th className="py-2.5 px-4 text-right">Rang Nat.</th>
                  <th className="py-2.5 px-4">Notes de publication</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {sortedDesc.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {rec.period}{' '}
                      <span className="font-sans font-normal text-slate-500 ml-1">
                        ({formatPeriodLabel(rec.period)})
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {rec.standardElo}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                      <span
                        className={
                          rec.standardDelta > 0
                            ? 'text-emerald-700'
                            : rec.standardDelta < 0
                            ? 'text-rose-700'
                            : 'text-slate-500'
                        }
                      >
                        {rec.standardDelta > 0 ? `+${rec.standardDelta}` : rec.standardDelta}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {rec.standardGamesCount}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-800 font-medium">
                      {rec.rapidElo}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-sky-800 font-medium">
                      {rec.blitzElo}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {rec.fideRankNational > 0 ? `#${rec.fideRankNational}` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                      {rec.notes || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(rec)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                          title="Modifier ce relevé mensuel"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRatingRecord(rec.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-700 rounded hover:bg-rose-50"
                          title="Supprimer ce relevé mensuel"
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
        )}
      </div>

      {/* Add / Edit Monthly Rating Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? 'Modifier le relevé mensuel FIDE'
                    : 'Enregistrer une publication mensuelle FIDE'}
                </h2>
                <p className="text-xs text-slate-500">
                  La FIDE publie la liste officielle des classements le 1er de chaque mois.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mois de publication (AAAA-MM)
                  </label>
                  <input
                    type="month"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    required
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rang National actif (optionnel)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={fideRankNational}
                    onChange={(e) => setFideRankNational(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Elo Standard</label>
                  <input
                    type="number"
                    min={1000}
                    max={3500}
                    value={standardElo}
                    onChange={(e) => setStandardElo(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Elo Rapide</label>
                  <input
                    type="number"
                    min={1000}
                    max={3500}
                    value={rapidElo}
                    onChange={(e) => setRapidElo(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Elo Blitz</label>
                  <input
                    type="number"
                    min={1000}
                    max={3500}
                    value={blitzElo}
                    onChange={(e) => setBlitzElo(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Parties Standard comptabilisées
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={standardGamesCount}
                    onChange={(e) => setStandardGamesCount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Variation mensuelle Standard (+/-)
                  </label>
                  <input
                    type="number"
                    min={-500}
                    max={500}
                    step="0.1"
                    value={standardDelta}
                    onChange={(e) => setStandardDelta(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Note / Tournois pris en compte ce mois-ci
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ex: Publication post-Open de Cappelle (+34 pts)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer le relevé'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
