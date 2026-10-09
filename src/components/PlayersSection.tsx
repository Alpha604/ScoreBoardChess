import React, { useMemo, useState } from 'react';
import {
  Edit3,
  ExternalLink,
  Eye,
  Info,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { FideGame, FideTitle, OpponentPlayer } from '../types/fide';
import { formatPlayerNameLastFirst } from '../utils/fideValidation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface PlayersSectionProps {
  opponents: OpponentPlayer[];
  games: FideGame[];
  selectedOpponentId: string | null;
  onSelectOpponent: (id: string | null) => void;
  onSaveOpponent: (
    data: Omit<OpponentPlayer, 'id'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteOpponent: (id: string) => Promise<void>;
  onOpenGameInViewer: (game: FideGame) => void;
}

type SortField =
  | 'name'
  | 'standardElo'
  | 'rapidElo'
  | 'blitzElo'
  | 'gamesCount'
  | 'winRate'
  | 'winsCount'
  | 'lossRate'
  | 'netElo';

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
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modal d'ajout / édition de joueur
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOpponentId, setEditingOpponentId] = useState<string | undefined>(
    undefined
  );
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modale de confirmation de suppression (3s)
  const [opponentToDelete, setOpponentToDelete] = useState<OpponentPlayer | null>(null);

  // Calcul des statistiques complètes pour chaque joueur affronté
  const enrichedOpponents = useMemo(() => {
    return opponents.map((opp) => {
      const oppGames = games
        .filter(
          (g) =>
            (g.opponentId && g.opponentId === opp.id) ||
            (opp.fideId && g.opponentFideId && g.opponentFideId === opp.fideId) ||
            (opp.ffeId &&
              g.opponentFfeId &&
              g.opponentFfeId.toUpperCase() === opp.ffeId.toUpperCase()) ||
            g.opponentName.trim().toLowerCase() === opp.name.trim().toLowerCase() ||
            formatPlayerNameLastFirst(g.opponentName).toLowerCase() ===
              formatPlayerNameLastFirst(opp.name).toLowerCase()
        )
        .sort((a, b) => b.datePlayed.localeCompare(a.datePlayed));

      const gamesCount = oppGames.length;
      const winsCount = oppGames.filter((g) => g.playerScore === 1).length;
      const drawsCount = oppGames.filter((g) => g.playerScore === 0.5).length;
      const lossesCount = oppGames.filter((g) => g.playerScore === 0).length;
      const totalScore = oppGames.reduce((acc, g) => acc + g.playerScore, 0);

      const winRate =
        gamesCount > 0 ? Math.round((winsCount / gamesCount) * 1000) / 10 : 0;
      const drawRate =
        gamesCount > 0 ? Math.round((drawsCount / gamesCount) * 1000) / 10 : 0;
      const lossRate =
        gamesCount > 0 ? Math.round((lossesCount / gamesCount) * 1000) / 10 : 0;

      const netElo =
        Math.round(
          oppGames.reduce((acc, g) => acc + g.eloChange, 0) * 10
        ) / 10;

      const stdElo = Number(opp.standardElo) || Number(opp.elo) || 1500;
      const rapElo = Number(opp.rapidElo) || stdElo;
      const blzElo = Number(opp.blitzElo) || stdElo;

      return {
        ...opp,
        formattedName: formatPlayerNameLastFirst(opp.name),
        standardElo: stdElo,
        rapidElo: rapElo,
        blitzElo: blzElo,
        games: oppGames,
        gamesCount,
        winsCount,
        drawsCount,
        lossesCount,
        totalScore,
        winRate,
        drawRate,
        lossRate,
        netElo,
      };
    });
  }, [opponents, games]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = enrichedOpponents.filter((opp) => {
      if (!q) return true;
      return (
        opp.name.toLowerCase().includes(q) ||
        opp.formattedName.toLowerCase().includes(q) ||
        opp.fideId.toLowerCase().includes(q) ||
        opp.ffeId.toLowerCase().includes(q) ||
        opp.club.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.formattedName.localeCompare(b.formattedName, 'fr', {
          sensitivity: 'base',
        });
      } else {
        cmp = (a[sortField] as number) - (b[sortField] as number);
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [enrichedOpponents, searchQuery, sortField, sortAsc]);

  const selectedOpponent = useMemo(
    () => enrichedOpponents.find((o) => o.id === selectedOpponentId) || null,
    [enrichedOpponents, selectedOpponentId]
  );

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  };

  const openNewModal = () => {
    setEditingOpponentId(undefined);
    setName('');
    setFideId('');
    setFfeId('');
    setStandardElo(1650);
    setRapidElo(1650);
    setBlitzElo(1650);
    setTitle('None');
    setFederation('FRA');
    setClub('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (opp: OpponentPlayer) => {
    const std = Number(opp.standardElo) || Number(opp.elo) || 1500;
    setEditingOpponentId(opp.id);
    setName(formatPlayerNameLastFirst(opp.name));
    setFideId(opp.fideId);
    setFfeId(opp.ffeId);
    setStandardElo(std);
    setRapidElo(Number(opp.rapidElo) || std);
    setBlitzElo(Number(opp.blitzElo) || std);
    setTitle(opp.title);
    setFederation(opp.federation || 'FRA');
    setClub(opp.club || '');
    setNotes(opp.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSaveOpponent(
        {
          name: formatPlayerNameLastFirst(name),
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
        },
        editingOpponentId
      );
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête de la section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-indigo-950">
            Joueurs Affrontés
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Vue épurée classée par « NOM, Prénom ». Cliquez sur un joueur ou sur « Voir toutes les infos & stats » pour ouvrir sa fiche complète en modale.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un joueur
        </button>
      </div>

      {/* Barre de recherche et boutons de tri rapide */}
      <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par NOM, Prénom, ID FIDE, ID FFE..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-600 font-bold mr-1">Trier par :</span>
          {(
            [
              { id: 'name', label: 'NOM, Prénom (A-Z)' },
              { id: 'standardElo', label: 'Elo Classique' },
              { id: 'rapidElo', label: 'Elo Rapide' },
              { id: 'blitzElo', label: 'Elo Blitz' },
              { id: 'winRate', label: 'Taux de victoires' },
              { id: 'winsCount', label: 'Nb de victoires' },
              { id: 'lossRate', label: 'Taux de défaites' },
            ] as { id: SortField; label: string }[]
          ).map((item) => {
            const active = sortField === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSortClick(item.id)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors border cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-900'
                }`}
              >
                {item.label} {active ? (sortAsc ? '↑' : '↓') : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tableau épuré des joueurs */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {filteredAndSorted.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-base font-bold text-slate-900">
              Aucun joueur trouvé.
            </p>
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
            >
              <UserPlus className="w-4 h-4" />
              Ajouter un joueur
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-indigo-100 bg-indigo-50/60 text-xs font-extrabold text-indigo-950">
                  <th className="py-3.5 px-4">Joueur (NOM, Prénom)</th>
                  <th className="py-3.5 px-4 text-right text-indigo-900">Classique</th>
                  <th className="py-3.5 px-4 text-right text-amber-800">Rapide</th>
                  <th className="py-3.5 px-4 text-right text-sky-800">Blitz</th>
                  <th className="py-3.5 px-4 text-center">Parties</th>
                  <th className="py-3.5 px-4 text-right">Taux de Victoires</th>
                  <th className="py-3.5 px-4 text-right">Actions & Fiche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredAndSorted.map((opp) => (
                  <tr
                    key={opp.id}
                    onClick={() => onSelectOpponent(opp.id)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOpponent(opp.id);
                        }}
                        className="font-extrabold text-indigo-950 hover:text-indigo-600 hover:underline text-left flex items-center gap-2 cursor-pointer"
                      >
                        {opp.title !== 'None' && (
                          <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                            {opp.title}
                          </span>
                        )}
                        <span>{opp.formattedName}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-indigo-950 bg-indigo-50/25">
                      {opp.standardElo}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-900 bg-amber-50/25">
                      {opp.rapidElo}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-sky-900 bg-sky-50/25">
                      {opp.blitzElo}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                      {opp.gamesCount}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md font-extrabold text-xs ${
                          opp.winRate >= 50
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {opp.winRate}% ({opp.winsCount}V/{opp.drawsCount}N/{opp.lossesCount}D)
                      </span>
                    </td>

                    <td
                      className="py-3.5 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectOpponent(opp.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer"
                        >
                          <Info className="w-3.5 h-3.5 text-indigo-600" />
                          Voir toutes les infos & stats
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
                          onClick={() => setOpponentToDelete(opp)}
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

      {/* MODALE FICHE COMPLÈTE DU JOUEUR & STATISTIQUES FACE-À-FACE */}
      {selectedOpponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl max-w-4xl w-full p-6 space-y-6 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  {selectedOpponent.title !== 'None' && (
                    <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                      {selectedOpponent.title}
                    </span>
                  )}
                  <h2 className="text-2xl font-extrabold tracking-tight text-indigo-950">
                    {selectedOpponent.formattedName}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono mt-1.5">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-bold">
                    ID FIDE : {selectedOpponent.fideId || 'Non renseigné'}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-bold">
                    ID FFE : {selectedOpponent.ffeId || 'Non renseigné'}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-900 font-bold">
                    Fédération : {selectedOpponent.federation || 'FRA'}
                  </span>
                  {selectedOpponent.club && (
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-sans font-semibold">
                      Club : {selectedOpponent.club}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedOpponent)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => setOpponentToDelete(selectedOpponent)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={() => onSelectOpponent(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Les 3 Classements Elo du joueur (Classique, Rapide, Blitz) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                    Elo Classique
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-indigo-950 mt-0.5">
                    {selectedOpponent.standardElo}
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800">
                  Standard
                </span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Elo Rapide
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-amber-950 mt-0.5">
                    {selectedOpponent.rapidElo}
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-amber-100 text-amber-900">
                  Rapide
                </span>
              </div>

              <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
                    Elo Blitz
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-sky-950 mt-0.5">
                    {selectedOpponent.blitzElo}
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-sky-100 text-sky-900">
                  Blitz
                </span>
              </div>
            </div>

            {/* Statistiques globales face à ce joueur */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs font-semibold text-slate-500">Parties affrontées</div>
                <div className="text-xl font-mono font-extrabold text-slate-900 mt-1">
                  {selectedOpponent.gamesCount}
                </div>
                <div className="text-xs font-mono text-indigo-700 font-semibold mt-0.5">
                  Score : {selectedOpponent.totalScore} / {selectedOpponent.gamesCount}
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <div className="text-xs font-bold text-emerald-800">Taux de Victoires</div>
                <div className="text-xl font-mono font-extrabold text-emerald-700 mt-1">
                  {selectedOpponent.winRate}%
                </div>
                <div className="text-xs font-mono text-emerald-800 mt-0.5">
                  {selectedOpponent.winsCount}V · {selectedOpponent.drawsCount}N ·{' '}
                  {selectedOpponent.lossesCount}D
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl">
                <div className="text-xs font-bold text-rose-800">Taux de Défaites</div>
                <div className="text-xl font-mono font-extrabold text-rose-700 mt-1">
                  {selectedOpponent.lossRate}%
                </div>
                <div className="text-xs font-mono text-rose-800 mt-0.5">
                  {selectedOpponent.lossesCount} défaite(s)
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  selectedOpponent.netElo >= 0
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-rose-50/60 border-rose-200'
                }`}
              >
                <div className="text-xs font-bold text-slate-700">Elo gagné contre lui</div>
                <div
                  className={`text-xl font-mono font-extrabold mt-1 ${
                    selectedOpponent.netElo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {selectedOpponent.netElo >= 0
                    ? `+${selectedOpponent.netElo.toFixed(1)}`
                    : selectedOpponent.netElo.toFixed(1)}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">Bilan Elo net</div>
              </div>
            </div>

            {selectedOpponent.notes && (
              <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs text-slate-700">
                <strong className="text-indigo-950">Notes & Préparation :</strong>{' '}
                {selectedOpponent.notes}
              </div>
            )}

            {/* Liste de toutes les parties jouées contre ce joueur */}
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-indigo-950">
                Historique de mes parties contre {selectedOpponent.formattedName} (
                {selectedOpponent.gamesCount})
              </h3>

              {selectedOpponent.games.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm text-slate-500">
                  Aucune partie enregistrée contre ce joueur pour le moment.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-indigo-100 bg-indigo-50/60 text-xs font-bold text-indigo-950">
                        <th className="py-2.5 px-4">Date & Ronde</th>
                        <th className="py-2.5 px-4">Tournoi & Cadence</th>
                        <th className="py-2.5 px-4">Ma Couleur</th>
                        <th className="py-2.5 px-4 text-right">Son Elo</th>
                        <th className="py-2.5 px-4 text-center">Mon Résultat</th>
                        <th className="py-2.5 px-4 text-right">Elo Gagné</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {selectedOpponent.games.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono text-xs">
                            <div className="font-bold text-indigo-950">{g.datePlayed}</div>
                            <div className="text-slate-500">Ronde {g.round}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">{g.tournamentName}</div>
                            <div className="text-xs text-slate-500">
                              {g.timeControl === 'Standard'
                                ? 'Classique'
                                : g.timeControl === 'Rapid'
                                ? 'Rapide'
                                : 'Blitz'}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-xs font-semibold">
                            {g.playerColor === 'White' ? 'Blancs' : 'Noirs'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            {g.opponentElo}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-xs font-extrabold">
                            <span
                              className={
                                g.playerScore === 1
                                  ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200'
                                  : g.playerScore === 0
                                  ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200'
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
                          <td className="py-2.5 px-4 text-right font-mono font-extrabold">
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
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectOpponent(null);
                                  onOpenGameInViewer(g);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Voir Partie
                              </button>
                              {g.chessComUrl && (
                                <a
                                  href={g.chessComUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajouter / Modifier un Joueur */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-indigo-950">
                  {editingOpponentId ? 'Modifier le joueur' : 'Ajouter un joueur'}
                </h2>
                <p className="text-xs text-slate-500">
                  Le nom sera automatiquement enregistré au format « NOM, Prénom ».
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    NOM, Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: VANDENBERGHE, Lucas"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Titre FIDE
                  </label>
                  <select
                    value={title}
                    onChange={(e) => setTitle(e.target.value as FideTitle)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl bg-white"
                  >
                    {FIDE_TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t === 'None' ? 'Aucun' : t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="font-bold text-slate-900">
                  Classements Elo par cadence
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-indigo-900 mb-1">
                      Elo Classique *
                    </label>
                    <input
                      type="number"
                      min={800}
                      max={3500}
                      required
                      value={standardElo}
                      onChange={(e) => setStandardElo(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono font-bold bg-white border border-indigo-200 rounded-xl text-indigo-950"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-amber-900 mb-1">
                      Elo Rapide
                    </label>
                    <input
                      type="number"
                      min={800}
                      max={3500}
                      value={rapidElo}
                      onChange={(e) => setRapidElo(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono font-bold bg-white border border-amber-200 rounded-xl text-amber-950"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-sky-900 mb-1">
                      Elo Blitz
                    </label>
                    <input
                      type="number"
                      min={800}
                      max={3500}
                      value={blitzElo}
                      onChange={(e) => setBlitzElo(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono font-bold bg-white border border-sky-200 rounded-xl text-sky-950"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ID FIDE
                  </label>
                  <input
                    type="text"
                    value={fideId}
                    onChange={(e) => setFideId(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Ex: 65104823"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ID FFE
                  </label>
                  <input
                    type="text"
                    value={ffeId}
                    onChange={(e) => setFfeId(e.target.value.toUpperCase())}
                    placeholder="Ex: K59412"
                    className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Club
                  </label>
                  <input
                    type="text"
                    value={club}
                    onChange={(e) => setClub(e.target.value)}
                    placeholder="Nom du club"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
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
                <label className="block font-bold text-slate-700 mb-1">
                  Notes sur ce joueur (style de jeu, ouvertures...)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Joue la Caro-Kann avec les Noirs..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer le joueur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION DE SUPPRESSION D'UN JOUEUR (3 secondes) */}
      <ConfirmDeleteModal
        isOpen={Boolean(opponentToDelete)}
        title="Supprimer cette fiche joueur ?"
        subtitle="Vous êtes sur le point de supprimer ce joueur de votre répertoire d'adversaires."
        itemName={
          opponentToDelete ? formatPlayerNameLastFirst(opponentToDelete.name) : ''
        }
        details={
          opponentToDelete
            ? [
                {
                  label: 'Elos (Classique / Rapide / Blitz)',
                  value: `${opponentToDelete.standardElo || opponentToDelete.elo} / ${
                    opponentToDelete.rapidElo || opponentToDelete.elo
                  } / ${opponentToDelete.blitzElo || opponentToDelete.elo}`,
                },
                {
                  label: 'Identifiants',
                  value: `FIDE: ${opponentToDelete.fideId || '—'} · FFE: ${
                    opponentToDelete.ffeId || '—'
                  }`,
                },
                {
                  label: 'Fédération & Club',
                  value: `${opponentToDelete.federation || 'FRA'}${
                    opponentToDelete.club ? ` · ${opponentToDelete.club}` : ''
                  }`,
                },
              ]
            : []
        }
        onCancel={() => setOpponentToDelete(null)}
        onConfirm={async () => {
          if (!opponentToDelete) return;
          const id = opponentToDelete.id;
          if (selectedOpponentId === id) onSelectOpponent(null);
          await onDeleteOpponent(id);
          setOpponentToDelete(null);
        }}
      />
    </div>
  );
};
