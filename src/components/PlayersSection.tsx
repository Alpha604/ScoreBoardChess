import React, { useEffect, useMemo, useState } from 'react';
import {
  Edit3,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { FideGame, FideTitle, OpponentPlayer } from '../types/fide';
import { POPULAR_FEDERATIONS } from '../utils/federationFlags';
import {
  formatPlayerNameDisplay,
  formatPlayerNameLastFirst,
  hasQuestionMarkName,
} from '../utils/fideValidation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { FederationFlag } from './FederationFlag';

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
  isFriendlyMode?: boolean;
}

type SortField =
  | 'name'
  | 'standardElo'
  | 'rapidElo'
  | 'blitzElo'
  | 'gamesCount'
  | 'winRate'
  | 'winsCount'
  | 'lossRate';

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
  isFriendlyMode = false,
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
  const [isNameUncertain, setIsNameUncertain] = useState(false);
  const [fideId, setFideId] = useState('');
  const [ffeId, setFfeId] = useState('');
  const [standardElo, setStandardElo] = useState(1600);
  const [isStandardEloUnknown, setIsStandardEloUnknown] = useState(false);
  const [rapidElo, setRapidElo] = useState(1600);
  const [isRapidEloUnknown, setIsRapidEloUnknown] = useState(false);
  const [blitzElo, setBlitzElo] = useState(1600);
  const [isBlitzEloUnknown, setIsBlitzEloUnknown] = useState(false);
  const [title, setTitle] = useState<FideTitle>('None');
  const [federation, setFederation] = useState('FRA');
  const [club, setClub] = useState('');
  const [notes, setNotes] = useState('');
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [canConfirmSave, setCanConfirmSave] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (modalStep === 3) {
      setCanConfirmSave(false);
      const timer = setTimeout(() => {
        setCanConfirmSave(true);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setCanConfirmSave(false);
    }
  }, [modalStep]);

  // Modale de confirmation de suppression (3s)
  const [opponentToDelete, setOpponentToDelete] = useState<OpponentPlayer | null>(null);

  // Calcul des statistiques complètes pour chaque joueur affronté
  const enrichedOpponents = useMemo(() => {
    return opponents.map((opp) => {
      const oppCleanName = formatPlayerNameLastFirst(opp.name).toLowerCase();
      const oppGames = games
        .filter(
          (g) =>
            (g.opponentId && g.opponentId === opp.id) ||
            (opp.fideId && g.opponentFideId && g.opponentFideId === opp.fideId) ||
            (opp.ffeId &&
              g.opponentFfeId &&
              g.opponentFfeId.toUpperCase() === opp.ffeId.toUpperCase()) ||
            formatPlayerNameLastFirst(g.opponentName).toLowerCase() === oppCleanName
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

      const netElo = isFriendlyMode
        ? 0
        : Math.round(
            oppGames.reduce((acc, g) => acc + g.eloChange, 0) * 10
          ) / 10;

      const stdUnknown = Boolean(
        opp.isStandardEloUnknown ||
        opp.isEloUnknown ||
        (!opp.standardElo && !opp.elo) ||
        Number(opp.standardElo || opp.elo) <= 0
      );
      const rapUnknown = Boolean(
        opp.isRapidEloUnknown ||
        opp.isEloUnknown ||
        opp.rapidElo === undefined ||
        opp.rapidElo === null ||
        Number(opp.rapidElo) <= 0
      );
      const blzUnknown = Boolean(
        opp.isBlitzEloUnknown ||
        opp.isEloUnknown ||
        opp.blitzElo === undefined ||
        opp.blitzElo === null ||
        Number(opp.blitzElo) <= 0
      );

      const stdElo = stdUnknown ? 0 : Number(opp.standardElo) || Number(opp.elo) || 0;
      const rapElo = rapUnknown ? 0 : Number(opp.rapidElo) || 0;
      const blzElo = blzUnknown ? 0 : Number(opp.blitzElo) || 0;
      const uncertainName = Boolean(
        opp.isNameUncertain || hasQuestionMarkName(opp.name)
      );

      return {
        ...opp,
        isNameUncertain: uncertainName,
        isStandardEloUnknown: stdUnknown,
        isRapidEloUnknown: rapUnknown,
        isBlitzEloUnknown: blzUnknown,
        formattedName: formatPlayerNameLastFirst(opp.name),
        displayName: formatPlayerNameDisplay(opp.name, uncertainName),
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
  }, [opponents, games, isFriendlyMode]);

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
      } else if (sortField === 'standardElo') {
        const valA = a.isStandardEloUnknown ? -1 : a.standardElo;
        const valB = b.isStandardEloUnknown ? -1 : b.standardElo;
        cmp = valA - valB;
      } else if (sortField === 'rapidElo') {
        const valA = a.isRapidEloUnknown ? -1 : a.rapidElo;
        const valB = b.isRapidEloUnknown ? -1 : b.rapidElo;
        cmp = valA - valB;
      } else if (sortField === 'blitzElo') {
        const valA = a.isBlitzEloUnknown ? -1 : a.blitzElo;
        const valB = b.isBlitzEloUnknown ? -1 : b.blitzElo;
        cmp = valA - valB;
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
    setIsNameUncertain(false);
    setFideId('');
    setFfeId('');
    setStandardElo(1600);
    setIsStandardEloUnknown(false);
    setRapidElo(0);
    setIsRapidEloUnknown(true);
    setBlitzElo(0);
    setIsBlitzEloUnknown(true);
    setTitle('None');
    setFederation('FRA');
    setClub('');
    setNotes('');
    setModalStep(1);
    setIsModalOpen(true);
  };

  const openEditModal = (opp: OpponentPlayer) => {
    const std = Number(opp.standardElo) || Number(opp.elo) || 0;
    const uncertain = Boolean(
      opp.isNameUncertain || hasQuestionMarkName(opp.name)
    );
    const stdUnknown = Boolean(
      opp.isStandardEloUnknown || opp.isEloUnknown || std <= 0
    );
    const rapUnknown = Boolean(
      opp.isRapidEloUnknown ||
      opp.isEloUnknown ||
      opp.rapidElo === undefined ||
      opp.rapidElo === null ||
      Number(opp.rapidElo) <= 0
    );
    const blzUnknown = Boolean(
      opp.isBlitzEloUnknown ||
      opp.isEloUnknown ||
      opp.blitzElo === undefined ||
      opp.blitzElo === null ||
      Number(opp.blitzElo) <= 0
    );

    setEditingOpponentId(opp.id);
    setName(formatPlayerNameLastFirst(opp.name));
    setIsNameUncertain(uncertain);
    setFideId(opp.fideId);
    setFfeId(opp.ffeId);
    setStandardElo(stdUnknown ? 1600 : std);
    setIsStandardEloUnknown(stdUnknown);
    setRapidElo(rapUnknown ? 0 : Number(opp.rapidElo));
    setIsRapidEloUnknown(rapUnknown);
    setBlitzElo(blzUnknown ? 0 : Number(opp.blitzElo));
    setIsBlitzEloUnknown(blzUnknown);
    setTitle(opp.title);
    setFederation(opp.federation || 'FRA');
    setClub(opp.club || '');
    setNotes(opp.notes || '');
    setModalStep(1);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (modalStep !== 3) return;
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const uncertain = isNameUncertain || hasQuestionMarkName(name);
      const allUnknown =
        isStandardEloUnknown && isRapidEloUnknown && isBlitzEloUnknown;
      const stdNum = isStandardEloUnknown ? 0 : Number(standardElo) || 0;
      const rapNum = isRapidEloUnknown ? 0 : Number(rapidElo) || 0;
      const blzNum = isBlitzEloUnknown ? 0 : Number(blitzElo) || 0;
      await onSaveOpponent(
        {
          name: formatPlayerNameLastFirst(name),
          isNameUncertain: uncertain,
          fideId,
          ffeId,
          elo: stdNum,
          standardElo: stdNum,
          rapidElo: rapNum,
          blitzElo: blzNum,
          isEloUnknown: allUnknown,
          isStandardEloUnknown,
          isRapidEloUnknown,
          isBlitzEloUnknown,
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
    <div className="space-y-5">
      {/* En-tête de la section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Répertoire des Joueurs Affrontés
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Classement alphabétique « NOM, Prénom ». Les noms ou classements Elo incertains sont signalés par un point d’interrogation (?).
          </p>
        </div>

        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un joueur
        </button>
      </div>

      {/* Barre de recherche et boutons de tri rapide */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par NOM, Prénom, ID FIDE, ID FFE..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-semibold mr-1">Trier :</span>
          {(
            [
              { id: 'name', label: 'NOM, Prénom' },
              { id: 'standardElo', label: 'Classique' },
              { id: 'rapidElo', label: 'Rapide' },
              { id: 'blitzElo', label: 'Blitz' },
              { id: 'winRate', label: '% Victoires' },
              { id: 'winsCount', label: 'Nb Victoires' },
              { id: 'lossRate', label: '% Défaites' },
            ] as { id: SortField; label: string }[]
          ).map((item) => {
            const active = sortField === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSortClick(item.id)}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors border cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {item.label} {active ? (sortAsc ? '↑' : '↓') : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tableau professionnel des joueurs */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        {filteredAndSorted.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-bold text-slate-900">
              Aucun joueur enregistré.
            </p>
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Ajouter un joueur
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Joueur (NOM, Prénom)</th>
                  <th className="py-3 px-4 text-right">Classique</th>
                  <th className="py-3 px-4 text-right">Rapide</th>
                  <th className="py-3 px-4 text-right">Blitz</th>
                  <th className="py-3 px-4 text-center">Parties</th>
                  <th className="py-3 px-4 text-right">Bilan & % Victoires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredAndSorted.map((opp) => (
                  <tr
                    key={opp.id}
                    onClick={() => onSelectOpponent(opp.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FederationFlag
                          code={opp.federation || 'FRA'}
                          size="xs"
                        />
                        {opp.title !== 'None' && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                            {opp.title}
                          </span>
                        )}
                        <span className="font-bold text-slate-900">
                          {opp.formattedName}
                        </span>
                        {opp.isNameUncertain && (
                          <span
                            className="inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded"
                            title="Nom incertain"
                          >
                            ?
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      {opp.isStandardEloUnknown ? (
                        <span
                          className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300 rounded"
                          title="Elo Classique inconnu"
                        >
                          ?
                        </span>
                      ) : (
                        opp.standardElo
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                      {opp.isRapidEloUnknown ? (
                        <span
                          className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300 rounded"
                          title="Elo Rapide inconnu"
                        >
                          ?
                        </span>
                      ) : (
                        opp.rapidElo
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                      {opp.isBlitzEloUnknown ? (
                        <span
                          className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300 rounded"
                          title="Elo Blitz inconnu"
                        >
                          ?
                        </span>
                      ) : (
                        opp.blitzElo
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-900">
                      {opp.gamesCount}
                    </td>

                    <td className="py-3 px-4 text-right font-mono">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${
                          opp.winRate >= 50
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {opp.winRate}% ({opp.winsCount}V / {opp.drawsCount}N / {opp.lossesCount}D)
                      </span>
                    </td>

                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectOpponent(opp.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer"
                        >
                          <Info className="w-3.5 h-3.5 text-slate-600" />
                          Fiche
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(opp)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
                          title="Modifier ce joueur"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpponentToDelete(opp)}
                          className="p-1.5 text-slate-500 hover:text-rose-700 rounded-md hover:bg-rose-50 cursor-pointer"
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
          <div className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full p-6 space-y-6 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  {selectedOpponent.title !== 'None' && (
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-200 text-slate-800 rounded">
                      {selectedOpponent.title}
                    </span>
                  )}
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    {selectedOpponent.formattedName}
                  </h2>
                  {selectedOpponent.isNameUncertain && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Nom incertain (?)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono mt-2">
                  <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 font-semibold">
                    ID FIDE : {selectedOpponent.fideId || 'Non renseigné'}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 font-semibold">
                    ID FFE : {selectedOpponent.ffeId || 'Non renseigné'}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 font-semibold inline-flex items-center gap-1.5">
                    Fédération :{' '}
                    <FederationFlag
                      code={selectedOpponent.federation || 'FRA'}
                      size="xs"
                      showCode
                      showName
                    />
                  </span>
                  {selectedOpponent.club && (
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-sans font-semibold">
                      Club : {selectedOpponent.club}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedOpponent)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => setOpponentToDelete(selectedOpponent)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={() => onSelectOpponent(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Les 3 Classements Elo du joueur (Classique, Rapide, Blitz) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Elo Classique
                  </div>
                  <div className="text-2xl font-mono font-bold text-slate-900 mt-0.5">
                    {selectedOpponent.isStandardEloUnknown
                      ? '?'
                      : selectedOpponent.standardElo}
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-slate-200 text-slate-800">
                  {selectedOpponent.isStandardEloUnknown ? 'Inconnu (?)' : 'Standard'}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Elo Rapide
                  </div>
                  <div className="text-2xl font-mono font-bold text-slate-900 mt-0.5">
                    {selectedOpponent.isRapidEloUnknown
                      ? '?'
                      : selectedOpponent.rapidElo}
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-slate-200 text-slate-800">
                  {selectedOpponent.isRapidEloUnknown ? 'Inconnu (?)' : 'Rapide'}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Elo Blitz
                  </div>
                  <div className="text-2xl font-mono font-bold text-slate-900 mt-0.5">
                    {selectedOpponent.isBlitzEloUnknown
                      ? '?'
                      : selectedOpponent.blitzElo}
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-slate-200 text-slate-800">
                  {selectedOpponent.isBlitzEloUnknown ? 'Inconnu (?)' : 'Blitz'}
                </span>
              </div>
            </div>

            {/* Statistiques globales face à ce joueur */}
            <div
              className={`grid grid-cols-1 ${
                isFriendlyMode ? 'sm:grid-cols-3' : 'sm:grid-cols-4'
              } gap-3`}
            >
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs font-semibold text-slate-500">
                  Parties jouées
                </div>
                <div className="text-xl font-mono font-bold text-slate-900 mt-1">
                  {selectedOpponent.gamesCount}
                </div>
                <div className="text-xs font-mono text-slate-700 font-semibold mt-0.5">
                  Score : {selectedOpponent.totalScore} / {selectedOpponent.gamesCount}
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                <div className="text-xs font-bold text-emerald-800">
                  Taux de Victoires
                </div>
                <div className="text-xl font-mono font-bold text-emerald-700 mt-1">
                  {selectedOpponent.winRate}%
                </div>
                <div className="text-xs font-mono text-emerald-800 mt-0.5">
                  {selectedOpponent.winsCount}V · {selectedOpponent.drawsCount}N ·{' '}
                  {selectedOpponent.lossesCount}D
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-lg">
                <div className="text-xs font-bold text-rose-800">
                  Taux de Défaites
                </div>
                <div className="text-xl font-mono font-bold text-rose-700 mt-1">
                  {selectedOpponent.lossRate}%
                </div>
                <div className="text-xs font-mono text-rose-800 mt-0.5">
                  {selectedOpponent.lossesCount} défaite(s)
                </div>
              </div>

              {!isFriendlyMode && (
                <div
                  className={`p-3.5 rounded-lg border ${
                    selectedOpponent.netElo >= 0
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-700">
                    Elo gagné contre lui
                  </div>
                  <div
                    className={`text-xl font-mono font-bold mt-1 ${
                      selectedOpponent.netElo >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {selectedOpponent.netElo >= 0
                      ? `+${selectedOpponent.netElo.toFixed(1)}`
                      : selectedOpponent.netElo.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">Bilan Elo net</div>
                </div>
              )}
            </div>

            {selectedOpponent.notes && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                <strong className="text-slate-900">Notes & Préparation :</strong>{' '}
                {selectedOpponent.notes}
              </div>
            )}

            {/* Liste de toutes les parties jouées contre ce joueur */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Historique des confrontations ({selectedOpponent.gamesCount})
              </h3>

              {selectedOpponent.games.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                  Aucune partie enregistrée contre ce joueur.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="py-2.5 px-4">Date & Ronde</th>
                        <th className="py-2.5 px-4">Contexte & Cadence</th>
                        <th className="py-2.5 px-4">Couleur</th>
                        <th className="py-2.5 px-4 text-right">Son Elo</th>
                        <th className="py-2.5 px-4 text-center">Résultat</th>
                        {!isFriendlyMode && (
                          <th className="py-2.5 px-4 text-right">Elo Gagné</th>
                        )}
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {selectedOpponent.games.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono">
                            <div className="font-bold text-slate-900">
                              {g.datePlayed}
                            </div>
                            <div className="text-slate-500">Ronde {g.round}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">
                              {g.tournamentName}
                            </div>
                            <div className="text-slate-500">
                              {g.timeControl === 'Standard'
                                ? 'Classique'
                                : g.timeControl === 'Rapid'
                                ? 'Rapide'
                                : 'Blitz'}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-semibold">
                            {g.playerColor === 'White' ? 'Blancs' : 'Noirs'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            {g.opponentEloUnknown ? '?' : g.opponentElo}
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
                                  onSelectOpponent(null);
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

      {/* Modal Ajouter / Modifier un Joueur - Assistant en 3 Étapes */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            {/* En-tête de la modale */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingOpponentId ? 'Modifier la fiche joueur' : 'Ajouter un nouveau joueur'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Étape {modalStep} sur 3 · Renseignez les informations pas à pas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper visuel à 3 étapes */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setModalStep(1)}
                className={`py-2 px-3 rounded-lg text-left border transition-all cursor-pointer ${
                  modalStep === 1
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : modalStep > 1
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                  Étape 1
                </div>
                <div className="text-xs font-bold truncate">Identité & Club</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (name.trim()) setModalStep(2);
                }}
                className={`py-2 px-3 rounded-lg text-left border transition-all cursor-pointer ${
                  modalStep === 2
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : modalStep > 2
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                  Étape 2
                </div>
                <div className="text-xs font-bold truncate">Classements Elo</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (name.trim()) setModalStep(3);
                }}
                className={`py-2 px-3 rounded-lg text-left border transition-all cursor-pointer ${
                  modalStep === 3
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                  Étape 3
                </div>
                <div className="text-xs font-bold truncate">Confirmation</div>
              </button>
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
              className="space-y-4 text-xs"
            >
              {/* ÉTAPE 1 : IDENTITÉ, TITRE & CLUBS */}
              {modalStep === 1 && (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-800">
                          NOM, Prénom *
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isNameUncertain}
                            onChange={(e) => setIsNameUncertain(e.target.checked)}
                            className="rounded border-slate-300 text-slate-900"
                          />
                          Nom incertain (?)
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ex: VANDENBERGHE, Lucas"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold pr-8 focus:outline-none focus:border-slate-900"
                        />
                        {isNameUncertain && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-xs border border-amber-300">
                            ?
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Format recommandé : « NOM, Prénom » pour un tri alphabétique optimal.
                      </p>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Titre FIDE
                      </label>
                      <select
                        value={title}
                        onChange={(e) => setTitle(e.target.value as FideTitle)}
                        className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg bg-white"
                      >
                        {FIDE_TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t === 'None' ? 'Aucun titre' : t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        ID FIDE (numérique)
                      </label>
                      <input
                        type="text"
                        value={fideId}
                        onChange={(e) =>
                          setFideId(e.target.value.replace(/[^0-9]/g, ''))
                        }
                        placeholder="Ex: 65104823"
                        className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        ID FFE (code club)
                      </label>
                      <input
                        type="text"
                        value={ffeId}
                        onChange={(e) => setFfeId(e.target.value.toUpperCase())}
                        placeholder="Ex: K59412"
                        className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-800 mb-1">
                        Club d'échecs
                      </label>
                      <input
                        type="text"
                        value={club}
                        onChange={(e) => setClub(e.target.value)}
                        placeholder="Ex: Échiquier Lillois"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-800">
                          Fédération
                        </label>
                        <FederationFlag
                          code={federation}
                          size="xs"
                          title="Aperçu du drapeau"
                        />
                      </div>
                      <input
                        type="text"
                        maxLength={4}
                        value={federation}
                        onChange={(e) => setFederation(e.target.value.toUpperCase())}
                        placeholder="FRA ou FIDE"
                        className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                        <FederationFlag code={federation} size="sm" />
                        <span className="font-semibold truncate">
                          {federation === 'FIDE'
                            ? 'FIDE (Drapeau officiel)'
                            : POPULAR_FEDERATIONS.find(
                                (f) => f.code === federation.toUpperCase()
                              )?.name || federation}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Boutons de sélection rapide de la fédération */}
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                      Fédérations courantes (clic rapide) :
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_FEDERATIONS.slice(0, 10).map((fed) => {
                        const active = federation === fed.code;
                        return (
                          <button
                            key={fed.code}
                            type="button"
                            onClick={() => setFederation(fed.code)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer transition-colors ${
                              active
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <FederationFlag code={fed.code} size="xs" />
                            <span>{fed.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2 : CLASSEMENTS ELO PAR CADENCE */}
              {modalStep === 2 && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          Classements Elo par cadence
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Chaque cadence est indépendante : renseigner le Classique ne modifie pas le Rapide ou le Blitz (affichés avec « ? »).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const allUnknown =
                            isStandardEloUnknown &&
                            isRapidEloUnknown &&
                            isBlitzEloUnknown;
                          if (allUnknown) {
                            setIsStandardEloUnknown(false);
                            if (!standardElo || standardElo <= 0) setStandardElo(1600);
                            setIsRapidEloUnknown(false);
                            if (!rapidElo || rapidElo <= 0) setRapidElo(1500);
                            setIsBlitzEloUnknown(false);
                            if (!blitzElo || blitzElo <= 0) setBlitzElo(1500);
                          } else {
                            setIsStandardEloUnknown(true);
                            setIsRapidEloUnknown(true);
                            setIsBlitzEloUnknown(true);
                          }
                        }}
                        className="text-[11px] font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                      >
                        {isStandardEloUnknown &&
                        isRapidEloUnknown &&
                        isBlitzEloUnknown
                          ? 'Saisir les Elos'
                          : 'Tous inconnus (?)'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {/* Standard */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-bold text-indigo-950">
                            Classique
                          </label>
                          <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isStandardEloUnknown}
                              onChange={(e) => {
                                const nextVal = e.target.checked;
                                setIsStandardEloUnknown(nextVal);
                                if (!nextVal && (!standardElo || standardElo <= 0)) {
                                  setStandardElo(1600);
                                }
                              }}
                              className="rounded border-slate-300"
                            />
                            Inconnu ?
                          </label>
                        </div>
                        {isStandardEloUnknown ? (
                          <div className="w-full px-3 py-2 font-mono font-bold bg-amber-50 border border-amber-300 rounded-md text-amber-800 text-center">
                            ? Inconnu
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={800}
                            max={3500}
                            required
                            value={standardElo}
                            onChange={(e) => setStandardElo(Number(e.target.value))}
                            className="w-full px-3 py-2 font-mono font-bold bg-white border border-slate-300 rounded-md text-slate-900"
                          />
                        )}
                      </div>

                      {/* Rapide */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-bold text-sky-950">Rapide</label>
                          <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isRapidEloUnknown}
                              onChange={(e) => {
                                const nextVal = e.target.checked;
                                setIsRapidEloUnknown(nextVal);
                                if (!nextVal && (!rapidElo || rapidElo <= 0)) {
                                  setRapidElo(1500);
                                }
                              }}
                              className="rounded border-slate-300"
                            />
                            Inconnu ?
                          </label>
                        </div>
                        {isRapidEloUnknown ? (
                          <div className="w-full px-3 py-2 font-mono font-bold bg-amber-50 border border-amber-300 rounded-md text-amber-800 text-center">
                            ? Inconnu
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={800}
                            max={3500}
                            value={rapidElo}
                            onChange={(e) => setRapidElo(Number(e.target.value))}
                            className="w-full px-3 py-2 font-mono font-bold bg-white border border-slate-300 rounded-md text-slate-900"
                          />
                        )}
                      </div>

                      {/* Blitz */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-bold text-amber-950">Blitz</label>
                          <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isBlitzEloUnknown}
                              onChange={(e) => {
                                const nextVal = e.target.checked;
                                setIsBlitzEloUnknown(nextVal);
                                if (!nextVal && (!blitzElo || blitzElo <= 0)) {
                                  setBlitzElo(1500);
                                }
                              }}
                              className="rounded border-slate-300"
                            />
                            Inconnu ?
                          </label>
                        </div>
                        {isBlitzEloUnknown ? (
                          <div className="w-full px-3 py-2 font-mono font-bold bg-amber-50 border border-amber-300 rounded-md text-amber-800 text-center">
                            ? Inconnu
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={800}
                            max={3500}
                            value={blitzElo}
                            onChange={(e) => setBlitzElo(Number(e.target.value))}
                            className="w-full px-3 py-2 font-mono font-bold bg-white border border-slate-300 rounded-md text-slate-900"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 : NOTES & RÉCAPITULATIF / CONFIRMATION */}
              {modalStep === 3 && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Notes & Observations (style de jeu, répertoire, ouvertures)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Joue l'Espagnole avec les Blancs, très solide en finale de tours..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  {/* Récapitulatif visuel avant confirmation */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                      Aperçu de la fiche joueur
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                          {title !== 'None' && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                              {title}
                            </span>
                          )}
                          <span>{formatPlayerNameLastFirst(name || 'Sans nom')}</span>
                          {isNameUncertain && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                              ? (Nom incertain)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-2">
                          <span>Club : {club || 'Non renseigné'}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <span>Fédération :</span>
                            <FederationFlag
                              code={federation || 'FRA'}
                              size="xs"
                              showCode
                              showName
                            />
                          </span>
                          <span>·</span>
                          <span>FIDE : {fideId || '—'}</span>
                          <span>·</span>
                          <span>FFE : {ffeId || '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 font-mono text-center">
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-sans">Classique</div>
                        <div className="font-bold text-slate-900 text-sm">
                          {isStandardEloUnknown ? '?' : standardElo}
                        </div>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-sans">Rapide</div>
                        <div className="font-bold text-slate-900 text-sm">
                          {isRapidEloUnknown ? '?' : rapidElo}
                        </div>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-sans">Blitz</div>
                        <div className="font-bold text-slate-900 text-sm">
                          {isBlitzEloUnknown ? '?' : blitzElo}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Boutons de navigation du Stepper */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Annuler
                </button>

                <div className="flex items-center gap-2">
                  {modalStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setModalStep((s) => (s - 1) as 1 | 2)}
                      className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      ← Précédent
                    </button>
                  )}

                  {modalStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!name.trim()) {
                          alert('Veuillez renseigner le nom du joueur.');
                          return;
                        }
                        setModalStep((s) => (s + 1) as 2 | 3);
                      }}
                      className="px-5 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      Suivant →
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting || !canConfirmSave || !name.trim()}
                      onClick={() => handleSubmit()}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                      {isSubmitting ? 'Enregistrement...' : '✓ Confirmer & Enregistrer'}
                    </button>
                  )}
                </div>
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
          opponentToDelete
            ? formatPlayerNameDisplay(
                opponentToDelete.name,
                opponentToDelete.isNameUncertain
              )
            : ''
        }
        details={
          opponentToDelete
            ? [
                {
                  label: 'Elos (Classique / Rapide / Blitz)',
                  value: `${
                    opponentToDelete.isStandardEloUnknown
                      ? '?'
                      : opponentToDelete.standardElo || opponentToDelete.elo
                  } / ${
                    opponentToDelete.isRapidEloUnknown
                      ? '?'
                      : opponentToDelete.rapidElo || opponentToDelete.elo
                  } / ${
                    opponentToDelete.isBlitzEloUnknown
                      ? '?'
                      : opponentToDelete.blitzElo || opponentToDelete.elo
                  }`,
                },
                {
                  label: 'Identifiants',
                  value: `FIDE: ${opponentToDelete.fideId || '—'} · FFE: ${
                    opponentToDelete.ffeId || '—'
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
