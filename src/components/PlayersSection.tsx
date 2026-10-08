import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  Eye,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { FideGame, FideTitle, OpponentPlayer } from '../types/fide';
import { sanitizeOpponentPayload } from '../utils/fideValidation';

interface PlayersSectionProps {
  opponents: OpponentPlayer[];
  games: FideGame[];
  selectedOpponentId: string | null;
  onSelectOpponent: (opponentId: string | null) => void;
  onSaveOpponent: (data: Omit<OpponentPlayer, 'id'>, existingId?: string) => Promise<void>;
  onDeleteOpponent: (id: string) => Promise<void>;
  onOpenGameInViewer: (game: FideGame) => void;
}

type SortField =
  | 'name'
  | 'standardElo'
  | 'rapidElo'
  | 'blitzElo'
  | 'winRate'
  | 'winsCount'
  | 'lossRate'
  | 'gamesCount'
  | 'netElo';

const FIDE_TITLES: FideTitle[] = ['None', 'CM', 'FM', 'IM', 'GM', 'WCM', 'WFM', 'WIM', 'WGM'];

export const PlayersSection: React.FC<PlayersSectionProps> = ({
  opponents,
  games,
  selectedOpponentId,
  onSelectOpponent,
  onSaveOpponent,
  onDeleteOpponent,
  onOpenGameInViewer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('gamesCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modal state for Add/Edit Opponent
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [fideId, setFideId] = useState('');
  const [ffeId, setFfeId] = useState('');
  const [standardElo, setStandardElo] = useState(1600);
  const [rapidElo, setRapidElo] = useState(1600);
  const [blitzElo, setBlitzElo] = useState(1600);
  const [title, setTitle] = useState<FideTitle>('None');
  const [federation, setFederation] = useState('FRA');
  const [club, setClub] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openNewModal = () => {
    setEditingId(undefined);
    setName('');
    setFideId('');
    setFfeId('');
    setStandardElo(1600);
    setRapidElo(1600);
    setBlitzElo(1600);
    setTitle('None');
    setFederation('FRA');
    setClub('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (opp: OpponentPlayer) => {
    const std = Number(opp.standardElo) || Number(opp.elo) || 1600;
    const rap = Number(opp.rapidElo) || std;
    const blz = Number(opp.blitzElo) || std;
    setEditingId(opp.id);
    setName(opp.name);
    setFideId(opp.fideId);
    setFfeId(opp.ffeId);
    setStandardElo(std);
    setRapidElo(rap);
    setBlitzElo(blz);
    setTitle(opp.title);
    setFederation(opp.federation || 'FRA');
    setClub(opp.club || '');
    setNotes(opp.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const clean = sanitizeOpponentPayload({
        name,
        fideId,
        ffeId,
        elo: Number(standardElo),
        standardElo: Number(standardElo),
        rapidElo: Number(rapidElo),
        blitzElo: Number(blitzElo),
        title,
        federation,
        club,
        notes,
      });
      await onSaveOpponent(clean, editingId);
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Match games to each opponent by ID, FIDE ID, FFE ID, or Name
  const enrichedOpponents = useMemo(() => {
    return opponents.map((opp) => {
      const stdElo = Number(opp.standardElo) || Number(opp.elo) || 1500;
      const rapElo = Number(opp.rapidElo) || stdElo;
      const blzElo = Number(opp.blitzElo) || stdElo;

      const oppGames = games.filter(
        (g) =>
          (g.opponentId && g.opponentId === opp.id) ||
          (opp.fideId && g.opponentFideId === opp.fideId) ||
          (opp.ffeId &&
            g.opponentFfeId &&
            g.opponentFfeId.toUpperCase() === opp.ffeId.toUpperCase()) ||
          g.opponentName.trim().toLowerCase() === opp.name.trim().toLowerCase()
      );

      const gamesCount = oppGames.length;
      const winsCount = oppGames.filter((g) => g.playerScore === 1).length;
      const drawsCount = oppGames.filter((g) => g.playerScore === 0.5).length;
      const lossesCount = oppGames.filter((g) => g.playerScore === 0).length;

      const winRate = gamesCount > 0 ? Math.round((winsCount / gamesCount) * 100) : 0;
      const drawRate = gamesCount > 0 ? Math.round((drawsCount / gamesCount) * 100) : 0;
      const lossRate = gamesCount > 0 ? Math.round((lossesCount / gamesCount) * 100) : 0;
      const totalPoints = oppGames.reduce((acc, g) => acc + g.playerScore, 0);
      const netElo =
        Math.round(oppGames.reduce((acc, g) => acc + g.eloChange, 0) * 10) / 10;

      return {
        ...opp,
        elo: stdElo,
        standardElo: stdElo,
        rapidElo: rapElo,
        blitzElo: blzElo,
        games: oppGames,
        gamesCount,
        winsCount,
        drawsCount,
        lossesCount,
        winRate,
        drawRate,
        lossRate,
        totalPoints,
        netElo,
      };
    });
  }, [opponents, games]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = enrichedOpponents.filter((o) => {
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.fideId.toLowerCase().includes(q) ||
        o.ffeId.toLowerCase().includes(q) ||
        o.club.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'standardElo':
          cmp = a.standardElo - b.standardElo;
          break;
        case 'rapidElo':
          cmp = a.rapidElo - b.rapidElo;
          break;
        case 'blitzElo':
          cmp = a.blitzElo - b.blitzElo;
          break;
        case 'winRate':
          cmp = a.winRate - b.winRate || a.winsCount - b.winsCount;
          break;
        case 'winsCount':
          cmp = a.winsCount - b.winsCount || a.winRate - b.winRate;
          break;
        case 'lossRate':
          cmp = a.lossRate - b.lossRate || a.lossesCount - b.lossesCount;
          break;
        case 'gamesCount':
          cmp = a.gamesCount - b.gamesCount;
          break;
        case 'netElo':
          cmp = a.netElo - b.netElo;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [enrichedOpponents, searchQuery, sortBy, sortDir]);

  const selectedOpponent = useMemo(
    () => enrichedOpponents.find((o) => o.id === selectedOpponentId) || null,
    [enrichedOpponents, selectedOpponentId]
  );

  // VUE DÉTAILLÉE D'UN JOUEUR (Quand on clique sur son nom)
  if (selectedOpponent) {
    const whiteGames = selectedOpponent.games.filter((g) => g.playerColor === 'White');
    const blackGames = selectedOpponent.games.filter((g) => g.playerColor === 'Black');
    const whiteWins = whiteGames.filter((g) => g.playerScore === 1).length;
    const blackWins = blackGames.filter((g) => g.playerScore === 1).length;

    const stdGames = selectedOpponent.games.filter((g) => g.timeControl === 'Standard');
    const rapidGames = selectedOpponent.games.filter((g) => g.timeControl === 'Rapid');
    const blitzGames = selectedOpponent.games.filter((g) => g.timeControl === 'Blitz');

    const stdWins = stdGames.filter((g) => g.playerScore === 1).length;
    const rapidWins = rapidGames.filter((g) => g.playerScore === 1).length;
    const blitzWins = blitzGames.filter((g) => g.playerScore === 1).length;

    return (
      <div className="space-y-6">
        {/* Retour & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onSelectOpponent(null)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold text-indigo-800 bg-white border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste des joueurs
          </button>

          <div className="flex items-center gap-2.5">
            {selectedOpponent.fideId && (
              <a
                href={`https://ratings.fide.com/profile/${selectedOpponent.fideId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100"
              >
                Fiche officielle FIDE ({selectedOpponent.fideId})
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => openEditModal(selectedOpponent)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Modifier ses Elos / Infos
            </button>
            <button
              type="button"
              onClick={async () => {
                await onDeleteOpponent(selectedOpponent.id);
                onSelectOpponent(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </button>
          </div>
        </div>

        {/* En-tête du Joueur avec ses 3 Elos par Cadence */}
        <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
                <span className="font-semibold text-slate-800">
                  Fédération : {selectedOpponent.federation || 'FRA'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  ID FIDE :{' '}
                  <strong className="text-indigo-700">
                    {selectedOpponent.fideId || 'Non renseigné'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  ID FFE :{' '}
                  <strong className="text-amber-800">
                    {selectedOpponent.ffeId || 'Non renseigné'}
                  </strong>
                </span>
                {selectedOpponent.club && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-sans text-slate-800 font-semibold">
                      Club : {selectedOpponent.club}
                    </span>
                  </>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                {selectedOpponent.title !== 'None' && (
                  <span className="text-amber-700 font-mono mr-2">
                    {selectedOpponent.title}
                  </span>
                )}
                {selectedOpponent.name}
              </h1>
            </div>

            {/* Les 3 Classements Elo du joueur dans chaque cadence */}
            <div className="grid grid-cols-3 gap-3 font-mono tabular-nums shrink-0">
              <div className="px-4 py-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-center">
                <div className="text-[11px] font-sans text-indigo-900 font-bold">
                  Elo Classique
                </div>
                <div className="text-xl font-extrabold text-indigo-700 mt-0.5">
                  {selectedOpponent.standardElo}
                </div>
                <div className="text-[10px] text-indigo-800 font-semibold">
                  {stdWins}/{stdGames.length} gagnées
                </div>
              </div>

              <div className="px-4 py-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
                <div className="text-[11px] font-sans text-amber-900 font-bold">
                  Elo Rapide
                </div>
                <div className="text-xl font-extrabold text-amber-700 mt-0.5">
                  {selectedOpponent.rapidElo}
                </div>
                <div className="text-[10px] text-amber-800 font-semibold">
                  {rapidWins}/{rapidGames.length} gagnées
                </div>
              </div>

              <div className="px-4 py-2.5 bg-sky-50/70 border border-sky-200 rounded-xl text-center">
                <div className="text-[11px] font-sans text-sky-900 font-bold">
                  Elo Blitz
                </div>
                <div className="text-xl font-extrabold text-sky-700 mt-0.5">
                  {selectedOpponent.blitzElo}
                </div>
                <div className="text-[10px] text-sky-800 font-semibold">
                  {blitzWins}/{blitzGames.length} gagnées
                </div>
              </div>
            </div>
          </div>

          {/* Statistiques Face-à-Face */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono tabular-nums">
            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200">
              <div className="text-xs font-sans font-bold text-indigo-900">Parties jouées</div>
              <div className="text-2xl font-extrabold text-indigo-700 mt-1">
                {selectedOpponent.gamesCount}
              </div>
              <div className="text-[11px] text-indigo-800 font-semibold mt-0.5">
                Score : {selectedOpponent.totalPoints} / {selectedOpponent.gamesCount}
              </div>
            </div>

            <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200">
              <div className="text-xs font-sans font-bold text-emerald-900">Taux de Victoires</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                {selectedOpponent.winRate}%
              </div>
              <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                {selectedOpponent.winsCount} victoire{selectedOpponent.winsCount > 1 ? 's' : ''}
              </div>
            </div>

            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200">
              <div className="text-xs font-sans font-bold text-amber-900">Parties Nulles</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">
                {selectedOpponent.drawRate}%
              </div>
              <div className="text-[11px] text-amber-800 font-semibold mt-0.5">
                {selectedOpponent.drawsCount} nulle{selectedOpponent.drawsCount > 1 ? 's' : ''}
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 rounded-xl border border-rose-200">
              <div className="text-xs font-sans font-bold text-rose-900">Taux de Défaites</div>
              <div className="text-2xl font-extrabold text-rose-700 mt-1">
                {selectedOpponent.lossRate}%
              </div>
              <div className="text-[11px] text-rose-800 font-semibold mt-0.5">
                {selectedOpponent.lossesCount} défaite{selectedOpponent.lossesCount > 1 ? 's' : ''}
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                selectedOpponent.netElo >= 0
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-rose-50/70 border-rose-200'
              }`}
            >
              <div
                className={`text-xs font-sans font-bold ${
                  selectedOpponent.netElo >= 0 ? 'text-emerald-900' : 'text-rose-900'
                }`}
              >
                Elo gagné contre lui
              </div>
              <div
                className={`text-2xl font-extrabold mt-1 ${
                  selectedOpponent.netElo > 0
                    ? 'text-emerald-700'
                    : selectedOpponent.netElo < 0
                    ? 'text-rose-700'
                    : 'text-slate-800'
                }`}
              >
                {selectedOpponent.netElo > 0
                  ? `+${selectedOpponent.netElo.toFixed(1)}`
                  : selectedOpponent.netElo.toFixed(1)}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">Points FIDE cumulés</div>
            </div>

            <div className="p-4 bg-violet-50/70 rounded-xl border border-violet-200">
              <div className="text-xs font-sans font-bold text-violet-900">Par couleur</div>
              <div className="text-sm font-bold text-slate-900 mt-1.5">
                ♔ Blancs : {whiteWins}/{whiteGames.length} gagnées
              </div>
              <div className="text-sm font-bold text-indigo-950 mt-0.5">
                ♚ Noirs : {blackWins}/{blackGames.length} gagnées
              </div>
            </div>
          </div>

          {selectedOpponent.notes && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl text-sm text-amber-950">
              <span className="font-bold text-amber-900 mr-2">
                Notes & Préparation contre {selectedOpponent.name} :
              </span>
              {selectedOpponent.notes}
            </div>
          )}
        </div>

        {/* Historique de toutes les parties contre ce joueur */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50/40 flex items-center justify-between">
            <h2 className="text-base font-bold text-indigo-950">
              Historique des confrontations contre {selectedOpponent.name}
            </h2>
            <span className="text-xs font-mono font-bold text-indigo-700">
              {selectedOpponent.gamesCount} partie{selectedOpponent.gamesCount > 1 ? 's' : ''}
            </span>
          </div>

          {selectedOpponent.games.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Aucune partie enregistrée contre ce joueur pour l’instant.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-indigo-100 bg-indigo-50/50 text-xs font-bold text-indigo-950">
                    <th className="py-3 px-4">Date & Ronde</th>
                    <th className="py-3 px-4">Tournoi & Cadence</th>
                    <th className="py-3 px-4">Ma Couleur</th>
                    <th className="py-3 px-4">Son Elo (Partie)</th>
                    <th className="py-3 px-4">Ouverture</th>
                    <th className="py-3 px-4 text-center">Résultat</th>
                    <th className="py-3 px-4 text-right">Elo Gagné</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {selectedOpponent.games.map((g) => {
                    const rowBorder =
                      g.playerScore === 1
                        ? 'border-l-4 border-l-emerald-500'
                        : g.playerScore === 0
                        ? 'border-l-4 border-l-rose-500'
                        : 'border-l-4 border-l-amber-400';
                    const cadenceColor =
                      g.timeControl === 'Rapid'
                        ? 'text-amber-700 font-bold'
                        : g.timeControl === 'Blitz'
                        ? 'text-sky-700 font-bold'
                        : 'text-indigo-700 font-bold';

                    return (
                      <tr key={g.id} className={`hover:bg-slate-50 ${rowBorder}`}>
                        <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                          <div className="font-bold text-slate-900">{g.datePlayed}</div>
                          <div className="text-slate-500">Ronde {g.round}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {g.tournamentName}
                          <div className={`text-xs ${cadenceColor}`}>
                            Cadence{' '}
                            {g.timeControl === 'Standard'
                              ? 'Classique'
                              : g.timeControl === 'Rapid'
                              ? 'Rapide'
                              : 'Blitz'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-bold">
                          {g.playerColor === 'White' ? (
                            <span className="text-slate-800">♔ Blancs</span>
                          ) : (
                            <span className="text-indigo-950">♚ Noirs</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                          {g.opponentElo}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {g.ecoCode && (
                            <strong className="font-mono text-indigo-700 mr-1">
                              {g.ecoCode}
                            </strong>
                          )}
                          {g.openingName || '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-extrabold">
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
                              ? 'Victoire (1pt)'
                              : g.playerScore === 0.5
                              ? 'Nulle (½)'
                              : 'Défaite (0pt)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold">
                          <span
                            className={
                              g.eloChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }
                          >
                            {g.eloChange >= 0
                              ? `+${g.eloChange.toFixed(1)}`
                              : g.eloChange.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenGameInViewer(g)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Voir partie
                            </button>
                            {g.chessComUrl && (
                              <a
                                href={g.chessComUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
                              >
                                Chess.com
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
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
    );
  }

  // VUE PRINCIPALE : LISTE DE TOUS LES JOUEURS AFFRONTÉS
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-indigo-950">
            Joueurs Affrontés (FIDE & FFE)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Retrouvez tous vos adversaires reliés par leur Nom, ID FIDE et ID FFE avec leurs classements <strong className="text-indigo-700">Elo Classique</strong>, <strong className="text-amber-700">Elo Rapide</strong> et <strong className="text-sky-700">Elo Blitz</strong>. Cliquez sur un nom pour ouvrir sa fiche complète.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-2xs"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un joueur
        </button>
      </div>

      {/* Barre de recherche et de tri */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-indigo-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Chercher par Nom, ID FIDE, ID FFE ou Club..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-600 mr-1">Trier par :</span>
          {[
            { id: 'name', label: 'Nom' },
            { id: 'standardElo', label: 'Elo Classique' },
            { id: 'rapidElo', label: 'Elo Rapide' },
            { id: 'blitzElo', label: 'Elo Blitz' },
            { id: 'winRate', label: 'Taux de victoires (%)' },
            { id: 'winsCount', label: 'Nombre de victoires' },
            { id: 'lossRate', label: 'Taux de défaites (%)' },
            { id: 'gamesCount', label: 'Parties jouées' },
          ].map((opt) => {
            const active = sortBy === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (sortBy === opt.id) {
                    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setSortBy(opt.id as SortField);
                    setSortDir(opt.id === 'name' ? 'asc' : 'desc');
                  }
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-800'
                }`}
              >
                {opt.label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tableau des joueurs */}
      <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl overflow-hidden shadow-2xs">
        {filteredAndSorted.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-base font-bold text-slate-900">
              Aucun joueur trouvé dans votre répertoire.
            </p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Ajoutez un joueur manuellement ou saisissez directement vos parties dans un tournoi : les joueurs seront créés et reliés automatiquement.
            </p>
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Ajouter mon premier adversaire
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-indigo-100 bg-indigo-50/50 text-xs font-bold text-indigo-950">
                  <th className="py-3.5 px-4">Nom du Joueur (Cliquez pour voir les stats)</th>
                  <th className="py-3.5 px-4">ID FIDE / ID FFE</th>
                  <th className="py-3.5 px-4 text-right text-indigo-800">Elo Classique</th>
                  <th className="py-3.5 px-4 text-right text-amber-800">Elo Rapide</th>
                  <th className="py-3.5 px-4 text-right text-sky-800">Elo Blitz</th>
                  <th className="py-3.5 px-4 text-center">Parties</th>
                  <th className="py-3.5 px-4 text-center text-emerald-800">Victoires</th>
                  <th className="py-3.5 px-4 text-center">Bilan & Taux Victoire</th>
                  <th className="py-3.5 px-4 text-center text-rose-800">Taux Défaite</th>
                  <th className="py-3.5 px-4 text-right">Bilan Elo</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredAndSorted.map((opp) => (
                  <tr
                    key={opp.id}
                    onClick={() => onSelectOpponent(opp.id)}
                    className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 hover:text-indigo-700 hover:underline flex items-center gap-1.5">
                        {opp.title !== 'None' && (
                          <span className="font-mono text-xs font-extrabold text-amber-700">
                            {opp.title}
                          </span>
                        )}
                        {opp.name}
                      </div>
                      {opp.club && (
                        <div className="text-xs text-slate-500 font-medium">{opp.club}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="text-indigo-700 font-semibold">
                        FIDE : {opp.fideId || '—'}
                      </div>
                      <div className="text-amber-800 font-semibold">
                        FFE : {opp.ffeId || '—'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-indigo-700 bg-indigo-50/25">
                      {opp.standardElo}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-amber-700 bg-amber-50/25">
                      {opp.rapidElo}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-sky-700 bg-sky-50/25">
                      {opp.blitzElo}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                      {opp.gamesCount}
                      <div className="text-[11px] font-semibold">
                        <span className="text-emerald-700">+{opp.winsCount}</span>{' '}
                        <span className="text-amber-700">={opp.drawsCount}</span>{' '}
                        <span className="text-rose-700">-{opp.lossesCount}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-extrabold text-emerald-700">
                      {opp.winsCount}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono">
                      <div className="font-extrabold text-emerald-700">
                        {opp.winRate}%
                      </div>
                      {opp.gamesCount > 0 && (
                        <div className="h-1.5 w-24 mx-auto bg-slate-200 rounded-full overflow-hidden flex mt-1">
                          <div
                            style={{ width: `${opp.winRate}%` }}
                            className="bg-emerald-500 h-full"
                          />
                          <div
                            style={{ width: `${opp.drawRate}%` }}
                            className="bg-amber-400 h-full"
                          />
                          <div
                            style={{ width: `${opp.lossRate}%` }}
                            className="bg-rose-500 h-full"
                          />
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-700">
                      {opp.lossRate}%
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-extrabold">
                      <span
                        className={
                          opp.netElo > 0
                            ? 'text-emerald-700'
                            : opp.netElo < 0
                            ? 'text-rose-700'
                            : 'text-slate-600'
                        }
                      >
                        {opp.netElo > 0
                          ? `+${opp.netElo.toFixed(1)}`
                          : opp.netElo.toFixed(1)}
                      </span>
                    </td>

                    <td
                      className="py-3.5 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectOpponent(opp.id)}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                        >
                          Fiche stats
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(opp)}
                          className="p-1.5 text-slate-500 hover:text-indigo-700 rounded-lg hover:bg-indigo-50"
                          title="Modifier ce joueur"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteOpponent(opp.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                          title="Supprimer ce joueur"
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
        )}
      </div>

      {/* Modal Ajouter / Modifier un Joueur */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Modifier la fiche du joueur' : 'Ajouter un joueur'}
                </h2>
                <p className="text-xs text-slate-500">
                  Renseignez son Nom, ses ID FIDE / FFE et ses classements Elo dans chaque cadence (Classique, Rapide, Blitz).
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
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nom & Prénom du joueur *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Dubois, Quentin"
                  required
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ID FIDE (chiffres)
                  </label>
                  <input
                    type="text"
                    value={fideId}
                    onChange={(e) => setFideId(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Ex: 65201943"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Code FFE (Fédération Française)
                  </label>
                  <input
                    type="text"
                    value={ffeId}
                    onChange={(e) => setFfeId(e.target.value.toUpperCase())}
                    placeholder="Ex: K20194"
                    className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Classements Elo dans les 3 cadences */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="font-bold text-slate-900">
                  Classements Elo par cadence
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Elo Classique *
                    </label>
                    <input
                      type="number"
                      min={800}
                      max={3500}
                      value={standardElo}
                      onChange={(e) => setStandardElo(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-amber-800 mb-1">
                      Elo Rapide *
                    </label>
                    <input
                      type="number"
                      min={800}
                      max={3500}
                      value={rapidElo}
                      onChange={(e) => setRapidElo(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-sky-800 mb-1">
                      Elo Blitz *
                    </label>
                    <input
                      type="number"
                      min={800}
                      max={3500}
                      value={blitzElo}
                      onChange={(e) => setBlitzElo(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Titre FIDE
                  </label>
                  <select
                    value={title}
                    onChange={(e) => setTitle(e.target.value as FideTitle)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
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
                    Fédération
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={federation}
                    onChange={(e) => setFederation(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Club du joueur (facultatif)
                </label>
                <input
                  type="text"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  placeholder="Ex: Cercle d'Échecs de Lille"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes sur son style de jeu / ouvertures (facultatif)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Joue la Caro-Kann contre 1.e4, très agressif en zeitnot..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer le joueur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
