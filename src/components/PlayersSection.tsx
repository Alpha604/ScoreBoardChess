import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  Edit3,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Search,
  Trash2,
  UserPlus,
  Users,
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
import { IconButton } from './IconButton';

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
  const [rapidElo, setRapidElo] = useState(0);
  const [isRapidEloUnknown, setIsRapidEloUnknown] = useState(true);
  const [blitzElo, setBlitzElo] = useState(0);
  const [isBlitzEloUnknown, setIsBlitzEloUnknown] = useState(true);
  const [title, setTitle] = useState<FideTitle>('None');
  const [federation, setFederation] = useState('FRA');
  const [club, setClub] = useState('');
  const [notes, setNotes] = useState('');
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [canConfirmSave, setCanConfirmSave] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

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
        opp.club.toLowerCase().includes(q) ||
        (opp.federation || '').toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.formattedName.localeCompare(b.formattedName, 'fr', {
          sensitivity: 'base',
        });
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'standardElo') {
        if (a.isStandardEloUnknown !== b.isStandardEloUnknown) {
          return a.isStandardEloUnknown ? 1 : -1;
        }
        cmp = a.standardElo - b.standardElo;
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'rapidElo') {
        if (a.isRapidEloUnknown !== b.isRapidEloUnknown) {
          return a.isRapidEloUnknown ? 1 : -1;
        }
        cmp = a.rapidElo - b.rapidElo;
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'blitzElo') {
        if (a.isBlitzEloUnknown !== b.isBlitzEloUnknown) {
          return a.isBlitzEloUnknown ? 1 : -1;
        }
        cmp = a.blitzElo - b.blitzElo;
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'winRate' || sortField === 'lossRate') {
        if ((a.gamesCount === 0) !== (b.gamesCount === 0)) {
          return a.gamesCount === 0 ? 1 : -1;
        }
      }
      cmp = (a[sortField] as number) - (b[sortField] as number);
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
    setStepError(null);
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
    setStepError(null);
    setModalStep(1);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (modalStep !== 3) return;
    if (!name.trim()) {
      setStepError('Veuillez renseigner le nom du joueur.');
      return;
    }
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
    <div className="space-y-6">
      {/* En-tête de la section */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#232C3A]">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#F1F4F8]">
            Répertoire des Joueurs
          </h1>
          <p className="text-xs text-[#9BA7B8] mt-1">
            {filteredAndSorted.length} joueur(s) · Tri « NOM, Prénom » · Elos par cadence indépendants
          </p>
        </div>

        <IconButton
          label="Ajouter un joueur"
          variant="primary"
          size="md"
          tooltipPos="bottom"
          onClick={openNewModal}
        >
          <UserPlus className="w-4 h-4" />
        </IconButton>
      </div>

      {/* Barre de recherche */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-[#6C788B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par NOM, Prénom, ID FIDE, ID FFE, club ou fédération..."
            className="w-full pl-10 pr-10 py-2 text-xs bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6C788B] hover:text-[#F1F4F8] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tableau des joueurs */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl overflow-hidden">
        {filteredAndSorted.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <Users className="w-8 h-8 text-[#6C788B] mx-auto" />
            <p className="text-sm font-semibold text-[#F1F4F8]">
              Aucun joueur enregistré.
            </p>
            <div className="flex justify-center">
              <IconButton
                label="Ajouter un joueur"
                variant="primary"
                size="md"
                onClick={openNewModal}
              >
                <UserPlus className="w-4 h-4" />
              </IconButton>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232C3A] bg-[#0F131A] text-[11px] font-mono uppercase tracking-wider text-[#6C788B]">
                  {(
                    [
                      { id: 'name', label: 'Joueur', align: 'left' },
                      { id: 'standardElo', label: 'Classique', align: 'right' },
                      { id: 'rapidElo', label: 'Rapide', align: 'right' },
                      { id: 'blitzElo', label: 'Blitz', align: 'right' },
                      { id: 'gamesCount', label: 'Parties', align: 'center' },
                      { id: 'winRate', label: 'Bilan', align: 'right' },
                    ] as { id: SortField; label: string; align: 'left' | 'center' | 'right' }[]
                  ).map((col) => {
                    const active = sortField === col.id;
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';
                    const flexJustify =
                      col.align === 'right'
                        ? 'justify-end'
                        : col.align === 'center'
                        ? 'justify-center'
                        : 'justify-start';
                    return (
                      <th
                        key={col.id}
                        className={`py-3.5 ${col.id === 'name' ? 'px-5' : 'px-4'} ${alignClass}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSortClick(col.id)}
                          title={`Trier par ${col.label}`}
                          className={`group inline-flex items-center gap-1.5 ${flexJustify} uppercase tracking-wider font-mono font-semibold transition-colors cursor-pointer ${
                            active
                              ? 'text-emerald-400'
                              : 'text-[#6C788B] hover:text-[#F1F4F8]'
                          }`}
                        >
                          <span>{col.label}</span>
                          {active ? (
                            sortAsc ? (
                              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-35 group-hover:opacity-90 transition-opacity" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232C3A] text-xs">
                {filteredAndSorted.map((opp) => (
                  <tr
                    key={opp.id}
                    onClick={() => onSelectOpponent(opp.id)}
                    className="hover:bg-[#19202B] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <FederationFlag
                          code={opp.federation || 'FRA'}
                          size="xs"
                        />
                        {opp.title !== 'None' && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30">
                            {opp.title}
                          </span>
                        )}
                        <span className="font-semibold text-[#F1F4F8]">
                          {opp.formattedName}
                        </span>
                        {opp.isNameUncertain && (
                          <span
                            className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30 rounded"
                            title="Nom incertain"
                          >
                            ?
                          </span>
                        )}
                      </div>
                      {(opp.club || opp.fideId || opp.ffeId) && (
                        <div className="text-[11px] text-[#6C788B] font-mono mt-1">
                          {opp.club ? `${opp.club}` : ''}
                          {opp.club && (opp.fideId || opp.ffeId) ? ' · ' : ''}
                          {opp.fideId ? `FIDE ${opp.fideId}` : ''}
                          {opp.fideId && opp.ffeId ? ' · ' : ''}
                          {opp.ffeId ? `FFE ${opp.ffeId}` : ''}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#F1F4F8]">
                      {opp.isStandardEloUnknown ? (
                        <span
                          className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-[#19202B] text-[#9BA7B8] border border-[#2B3647] rounded"
                          title="Elo Classique inconnu"
                        >
                          ?
                        </span>
                      ) : (
                        opp.standardElo
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#9BA7B8]">
                      {opp.isRapidEloUnknown ? (
                        <span
                          className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-[#19202B] text-[#9BA7B8] border border-[#2B3647] rounded"
                          title="Elo Rapide inconnu"
                        >
                          ?
                        </span>
                      ) : (
                        opp.rapidElo
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#9BA7B8]">
                      {opp.isBlitzEloUnknown ? (
                        <span
                          className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-[#19202B] text-[#9BA7B8] border border-[#2B3647] rounded"
                          title="Elo Blitz inconnu"
                        >
                          ?
                        </span>
                      ) : (
                        opp.blitzElo
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono tabular-nums font-semibold">
                      {opp.gamesCount === 0 ? (
                        <span className="text-[#475569]">0</span>
                      ) : (
                        <span className="text-[#F1F4F8]">{opp.gamesCount}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {opp.gamesCount === 0 ? (
                        <span className="text-[#475569]">—</span>
                      ) : (
                        <div className="inline-flex flex-col items-end gap-1.5 min-w-[144px]">
                          <div className="flex items-center justify-end gap-2 text-[11px]">
                            <span
                              className={`font-bold ${
                                opp.winRate >= 50 ? 'text-emerald-400' : 'text-[#F1F4F8]'
                              }`}
                            >
                              {opp.winRate}%
                            </span>
                            <span className="text-[#6C788B]">
                              <span className="text-emerald-400">{opp.winsCount}V</span>
                              {' · '}
                              <span className="text-[#D4A853]">{opp.drawsCount}N</span>
                              {' · '}
                              <span className="text-rose-400">{opp.lossesCount}D</span>
                            </span>
                          </div>
                          <div
                            className="w-full h-1.5 bg-[#19202B] rounded-full overflow-hidden flex border border-[#232C3A]"
                            title={`Victoires : ${opp.winRate}% (${opp.winsCount}) · Nulles : ${opp.drawRate}% (${opp.drawsCount}) · Défaites : ${opp.lossRate}% (${opp.lossesCount})`}
                          >
                            {opp.winsCount > 0 && (
                              <div
                                style={{
                                  width: `${(opp.winsCount / opp.gamesCount) * 100}%`,
                                }}
                                className="bg-emerald-500 h-full"
                              />
                            )}
                            {opp.drawsCount > 0 && (
                              <div
                                style={{
                                  width: `${(opp.drawsCount / opp.gamesCount) * 100}%`,
                                }}
                                className="bg-[#D4A853] h-full"
                              />
                            )}
                            {opp.lossesCount > 0 && (
                              <div
                                style={{
                                  width: `${(opp.lossesCount / opp.gamesCount) * 100}%`,
                                }}
                                className="bg-rose-500 h-full"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    <td
                      className="py-3.5 px-5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <IconButton
                          label="Voir la fiche complète"
                          variant="surface"
                          size="xs"
                          onClick={() => onSelectOpponent(opp.id)}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton
                          label="Modifier ce joueur"
                          variant="ghost"
                          size="xs"
                          onClick={() => openEditModal(opp)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton
                          label="Supprimer ce joueur"
                          variant="danger"
                          size="xs"
                          onClick={() => setOpponentToDelete(opp)}
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
        )}
      </div>

      {/* MODALE FICHE COMPLÈTE DU JOUEUR & STATISTIQUES FACE-À-FACE */}
      {selectedOpponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#131820] border border-[#2B3647] rounded-2xl max-w-4xl w-full p-6 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#232C3A] pb-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <FederationFlag
                    code={selectedOpponent.federation || 'FRA'}
                    size="sm"
                  />
                  {selectedOpponent.title !== 'None' && (
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30 rounded">
                      {selectedOpponent.title}
                    </span>
                  )}
                  <h2 className="font-display text-xl font-bold tracking-tight text-[#F1F4F8]">
                    {selectedOpponent.formattedName}
                  </h2>
                  {selectedOpponent.isNameUncertain && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-bold bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30 rounded">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Nom incertain (?)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#9BA7B8] font-mono mt-2.5">
                  <span>FIDE : {selectedOpponent.fideId || '—'}</span>
                  <span className="text-[#475569]">·</span>
                  <span>FFE : {selectedOpponent.ffeId || '—'}</span>
                  <span className="text-[#475569]">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <FederationFlag
                      code={selectedOpponent.federation || 'FRA'}
                      size="xs"
                      showCode
                      showName
                    />
                  </span>
                  {selectedOpponent.club && (
                    <>
                      <span className="text-[#475569]">·</span>
                      <span className="font-sans text-[#CBD5E1]">
                        {selectedOpponent.club}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <IconButton
                  label="Modifier ce joueur"
                  variant="surface"
                  size="sm"
                  tooltipPos="bottom"
                  onClick={() => openEditModal(selectedOpponent)}
                >
                  <Edit3 className="w-4 h-4" />
                </IconButton>
                <IconButton
                  label="Supprimer ce joueur"
                  variant="danger"
                  size="sm"
                  tooltipPos="bottom"
                  onClick={() => setOpponentToDelete(selectedOpponent)}
                >
                  <Trash2 className="w-4 h-4" />
                </IconButton>
                <IconButton
                  label="Fermer la fiche"
                  variant="ghost"
                  size="sm"
                  tooltipPos="bottom"
                  onClick={() => onSelectOpponent(null)}
                >
                  <X className="w-4 h-4" />
                </IconButton>
              </div>
            </div>

            {/* Les 3 Classements Elo du joueur (Classique, Rapide, Blitz) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-[#19202B] border border-[#232C3A] flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#9BA7B8]">
                    Elo Classique
                  </div>
                  <div className="text-2xl font-mono tabular-nums font-bold text-[#F1F4F8] mt-1">
                    {selectedOpponent.isStandardEloUnknown
                      ? '?'
                      : selectedOpponent.standardElo}
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">
                  {selectedOpponent.isStandardEloUnknown ? 'Inconnu' : 'Standard'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#19202B] border border-[#232C3A] flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#9BA7B8]">
                    Elo Rapide
                  </div>
                  <div className="text-2xl font-mono tabular-nums font-bold text-[#F1F4F8] mt-1">
                    {selectedOpponent.isRapidEloUnknown
                      ? '?'
                      : selectedOpponent.rapidElo}
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#D4A853]">
                  {selectedOpponent.isRapidEloUnknown ? 'Inconnu' : 'Rapide'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#19202B] border border-[#232C3A] flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#9BA7B8]">
                    Elo Blitz
                  </div>
                  <div className="text-2xl font-mono tabular-nums font-bold text-[#F1F4F8] mt-1">
                    {selectedOpponent.isBlitzEloUnknown
                      ? '?'
                      : selectedOpponent.blitzElo}
                  </div>
                </div>
                <span className="text-[11px] font-mono text-sky-400">
                  {selectedOpponent.isBlitzEloUnknown ? 'Inconnu' : 'Blitz'}
                </span>
              </div>
            </div>

            {/* Statistiques globales face à ce joueur */}
            <div
              className={`grid grid-cols-1 ${
                isFriendlyMode ? 'sm:grid-cols-3' : 'sm:grid-cols-4'
              } gap-3`}
            >
              <div className="p-3.5 bg-[#19202B] border border-[#232C3A] rounded-xl">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#6C788B]">
                  Parties jouées
                </div>
                <div className="text-xl font-mono tabular-nums font-bold text-[#F1F4F8] mt-1">
                  {selectedOpponent.gamesCount}
                </div>
                <div className="text-xs font-mono text-[#9BA7B8] mt-0.5">
                  Score : {selectedOpponent.totalScore} / {selectedOpponent.gamesCount}
                </div>
              </div>

              <div className="p-3.5 bg-[#19202B] border border-emerald-500/25 rounded-xl">
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                  Taux de Victoires
                </div>
                <div className="text-xl font-mono tabular-nums font-bold text-emerald-400 mt-1">
                  {selectedOpponent.winRate}%
                </div>
                <div className="text-xs font-mono text-[#9BA7B8] mt-0.5">
                  {selectedOpponent.winsCount}V · {selectedOpponent.drawsCount}N ·{' '}
                  {selectedOpponent.lossesCount}D
                </div>
              </div>

              <div className="p-3.5 bg-[#19202B] border border-rose-500/25 rounded-xl">
                <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">
                  Taux de Défaites
                </div>
                <div className="text-xl font-mono tabular-nums font-bold text-rose-400 mt-1">
                  {selectedOpponent.lossRate}%
                </div>
                <div className="text-xs font-mono text-[#9BA7B8] mt-0.5">
                  {selectedOpponent.lossesCount} défaite(s)
                </div>
              </div>

              {!isFriendlyMode && (
                <div className="p-3.5 bg-[#19202B] border border-[#232C3A] rounded-xl">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#6C788B]">
                    Elo contre lui
                  </div>
                  <div
                    className={`text-xl font-mono tabular-nums font-bold mt-1 ${
                      selectedOpponent.netElo >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {selectedOpponent.netElo >= 0
                      ? `+${selectedOpponent.netElo.toFixed(1)}`
                      : selectedOpponent.netElo.toFixed(1)}
                  </div>
                  <div className="text-xs text-[#9BA7B8] mt-0.5">Bilan Elo net</div>
                </div>
              )}
            </div>

            {selectedOpponent.notes && (
              <div className="p-3.5 bg-[#19202B] border border-[#232C3A] rounded-xl text-xs text-[#CBD5E1]">
                <strong className="text-[#F1F4F8]">Notes & Préparation :</strong>{' '}
                {selectedOpponent.notes}
              </div>
            )}

            {/* Liste de toutes les parties jouées contre ce joueur */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#9BA7B8]">
                Historique des confrontations ({selectedOpponent.gamesCount})
              </h3>

              {selectedOpponent.games.length === 0 ? (
                <div className="p-8 bg-[#19202B] border border-[#232C3A] rounded-xl text-center text-xs text-[#6C788B]">
                  Aucune partie enregistrée contre ce joueur.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#232C3A] rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#232C3A] bg-[#0F131A] text-[11px] font-mono uppercase tracking-wider text-[#6C788B]">
                        <th className="py-2.5 px-4">Date & Ronde</th>
                        <th className="py-2.5 px-4">Contexte & Cadence</th>
                        <th className="py-2.5 px-4">Couleur</th>
                        <th className="py-2.5 px-4 text-right">Son Elo</th>
                        <th className="py-2.5 px-4 text-center">Résultat</th>
                        {!isFriendlyMode && (
                          <th className="py-2.5 px-4 text-right">Elo</th>
                        )}
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232C3A] text-xs">
                      {selectedOpponent.games.map((g) => (
                        <tr key={g.id} className="hover:bg-[#19202B]">
                          <td className="py-2.5 px-4 font-mono">
                            <div className="font-semibold text-[#F1F4F8]">
                              {g.datePlayed}
                            </div>
                            <div className="text-[#6C788B]">Ronde {g.round}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-[#F1F4F8]">
                              {g.tournamentName}
                            </div>
                            <div className="text-[#9BA7B8]">
                              {g.timeControl === 'Standard'
                                ? 'Classique'
                                : g.timeControl === 'Rapid'
                                ? 'Rapide'
                                : 'Blitz'}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-[#CBD5E1]">
                            {g.playerColor === 'White' ? 'Blancs' : 'Noirs'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-[#F1F4F8]">
                            {g.opponentEloUnknown ? '?' : g.opponentElo}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded border text-[11px] ${
                                g.playerScore === 1
                                  ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                                  : g.playerScore === 0
                                  ? 'text-rose-300 bg-rose-500/15 border-rose-500/30'
                                  : 'text-[#D4A853] bg-[#D4A853]/15 border-[#D4A853]/30'
                              }`}
                            >
                              {g.playerScore === 1
                                ? 'Victoire'
                                : g.playerScore === 0.5
                                ? 'Nulle'
                                : 'Défaite'}
                            </span>
                          </td>
                          {!isFriendlyMode && (
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
                          )}
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <IconButton
                                label="Ouvrir le PGN & détails"
                                variant="surface"
                                size="xs"
                                onClick={() => {
                                  onSelectOpponent(null);
                                  onOpenGameInViewer(g);
                                }}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </IconButton>
                              {g.chessComUrl && (
                                <a
                                  href={g.chessComUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Voir sur Chess.com"
                                  data-tooltip="Voir sur Chess.com"
                                  className="w-7 h-7 rounded-lg bg-[#19202B] text-[#CBD5E1] hover:text-white hover:bg-[#222B3A] border border-[#2B3647] inline-flex items-center justify-center transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#131820] border border-[#2B3647] rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            {/* En-tête de la modale */}
            <div className="flex items-center justify-between border-b border-[#232C3A] pb-3.5">
              <div>
                <h2 className="font-display text-base font-bold text-[#F1F4F8]">
                  {editingOpponentId ? 'Modifier la fiche joueur' : 'Ajouter un nouveau joueur'}
                </h2>
                <p className="text-xs text-[#9BA7B8] mt-0.5">
                  Étape {modalStep} sur 3 · Renseignez les informations pas à pas
                </p>
              </div>
              <IconButton
                label="Fermer"
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </IconButton>
            </div>

            {/* Stepper visuel à 3 étapes */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setStepError(null);
                  setModalStep(1);
                }}
                className={`py-2 px-3 rounded-xl text-left border transition-all cursor-pointer ${
                  modalStep === 1
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : modalStep > 1
                    ? 'bg-[#19202B] text-emerald-400 border-emerald-500/25'
                    : 'bg-[#19202B] text-[#6C788B] border-[#232C3A]'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                  Étape 1
                </div>
                <div className="text-xs font-bold truncate">Identité & Féd.</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    setStepError('Veuillez renseigner le nom du joueur.');
                    return;
                  }
                  setStepError(null);
                  setModalStep(2);
                }}
                className={`py-2 px-3 rounded-xl text-left border transition-all cursor-pointer ${
                  modalStep === 2
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : modalStep > 2
                    ? 'bg-[#19202B] text-emerald-400 border-emerald-500/25'
                    : 'bg-[#19202B] text-[#6C788B] border-[#232C3A]'
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
                  if (!name.trim()) {
                    setStepError('Veuillez renseigner le nom du joueur.');
                    return;
                  }
                  setStepError(null);
                  setModalStep(3);
                }}
                className={`py-2 px-3 rounded-xl text-left border transition-all cursor-pointer ${
                  modalStep === 3
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#19202B] text-[#6C788B] border-[#232C3A]'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">
                  Étape 3
                </div>
                <div className="text-xs font-bold truncate">Confirmation</div>
              </button>
            </div>

            {stepError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

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
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-semibold text-[#CBD5E1]">
                          NOM, Prénom *
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#D4A853] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isNameUncertain}
                            onChange={(e) => setIsNameUncertain(e.target.checked)}
                            className="rounded border-[#2B3647] bg-[#19202B] text-emerald-500"
                          />
                          Nom incertain (?)
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (stepError) setStepError(null);
                          }}
                          placeholder="Ex: VANDENBERGHE, Lucas"
                          className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl font-semibold text-[#F1F4F8] placeholder:text-[#6C788B] pr-8 focus:outline-none focus:border-emerald-500"
                        />
                        {isNameUncertain && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[#D4A853] bg-[#D4A853]/15 px-1.5 py-0.5 rounded text-xs border border-[#D4A853]/30">
                            ?
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6C788B] mt-1">
                        Format recommandé : « NOM, Prénom ».
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                        Titre FIDE
                      </label>
                      <select
                        value={title}
                        onChange={(e) => setTitle(e.target.value as FideTitle)}
                        className="w-full px-3 py-2 font-mono bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                      >
                        {FIDE_TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t === 'None' ? 'Aucun titre' : t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                        ID FIDE (numérique)
                      </label>
                      <input
                        type="text"
                        value={fideId}
                        onChange={(e) =>
                          setFideId(e.target.value.replace(/[^0-9]/g, ''))
                        }
                        placeholder="Ex: 65104823"
                        className="w-full px-3 py-2 font-mono bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                        ID FFE (code club)
                      </label>
                      <input
                        type="text"
                        value={ffeId}
                        onChange={(e) => setFfeId(e.target.value.toUpperCase())}
                        placeholder="Ex: K59412"
                        className="w-full px-3 py-2 font-mono uppercase bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                        Club d’échecs
                      </label>
                      <input
                        type="text"
                        value={club}
                        onChange={(e) => setClub(e.target.value)}
                        placeholder="Ex: Échiquier Lillois"
                        className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block font-semibold text-[#CBD5E1]">
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
                        className="w-full px-3 py-2 font-mono uppercase bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                      />
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#9BA7B8] bg-[#19202B] border border-[#232C3A] px-2 py-1 rounded-lg">
                        <FederationFlag code={federation} size="sm" />
                        <span className="font-semibold truncate text-[#F1F4F8]">
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
                    <div className="text-[11px] font-semibold text-[#6C788B] mb-1.5">
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
                            title={fed.name}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border cursor-pointer transition-colors ${
                              active
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : 'bg-[#19202B] text-[#CBD5E1] border-[#2B3647] hover:bg-[#212A38]'
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
                  <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-xl space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#F1F4F8] text-sm">
                          Classements Elo par cadence
                        </div>
                        <p className="text-[11px] text-[#9BA7B8] mt-0.5">
                          Chaque cadence est indépendante : renseigner le Classique ne modifie pas le Rapide ou le Blitz (affichés avec « ? »).
                        </p>
                      </div>
                      <IconButton
                        label={
                          isStandardEloUnknown &&
                          isRapidEloUnknown &&
                          isBlitzEloUnknown
                            ? 'Activer la saisie des Elos'
                            : 'Tout marquer inconnu (?)'
                        }
                        variant="surface"
                        size="sm"
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
                      >
                        <HelpCircle className="w-4 h-4 text-[#D4A853]" />
                      </IconButton>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {/* Standard */}
                      <div className="bg-[#131820] p-3 rounded-xl border border-[#2B3647]">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-semibold text-emerald-400">
                            Classique
                          </label>
                          <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D4A853] cursor-pointer">
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
                              className="rounded border-[#2B3647] bg-[#19202B]"
                            />
                            ?
                          </label>
                        </div>
                        {isStandardEloUnknown ? (
                          <div className="w-full px-3 py-2 font-mono font-bold bg-[#D4A853]/10 border border-[#D4A853]/30 rounded-lg text-[#D4A853] text-center">
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
                            className="w-full px-3 py-2 font-mono font-bold bg-[#19202B] border border-[#2B3647] rounded-lg text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>

                      {/* Rapide */}
                      <div className="bg-[#131820] p-3 rounded-xl border border-[#2B3647]">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-semibold text-[#D4A853]">Rapide</label>
                          <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D4A853] cursor-pointer">
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
                              className="rounded border-[#2B3647] bg-[#19202B]"
                            />
                            ?
                          </label>
                        </div>
                        {isRapidEloUnknown ? (
                          <div className="w-full px-3 py-2 font-mono font-bold bg-[#D4A853]/10 border border-[#D4A853]/30 rounded-lg text-[#D4A853] text-center">
                            ? Inconnu
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={800}
                            max={3500}
                            value={rapidElo}
                            onChange={(e) => setRapidElo(Number(e.target.value))}
                            className="w-full px-3 py-2 font-mono font-bold bg-[#19202B] border border-[#2B3647] rounded-lg text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>

                      {/* Blitz */}
                      <div className="bg-[#131820] p-3 rounded-xl border border-[#2B3647]">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-semibold text-sky-400">Blitz</label>
                          <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D4A853] cursor-pointer">
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
                              className="rounded border-[#2B3647] bg-[#19202B]"
                            />
                            ?
                          </label>
                        </div>
                        {isBlitzEloUnknown ? (
                          <div className="w-full px-3 py-2 font-mono font-bold bg-[#D4A853]/10 border border-[#D4A853]/30 rounded-lg text-[#D4A853] text-center">
                            ? Inconnu
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={800}
                            max={3500}
                            value={blitzElo}
                            onChange={(e) => setBlitzElo(Number(e.target.value))}
                            className="w-full px-3 py-2 font-mono font-bold bg-[#19202B] border border-[#2B3647] rounded-lg text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
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
                    <label className="block font-semibold text-[#CBD5E1] mb-1.5">
                      Notes & Observations (style de jeu, répertoire, ouvertures)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Joue l'Espagnole avec les Blancs, très solide en finale de tours..."
                      className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Récapitulatif visuel avant confirmation */}
                  <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-xl space-y-3">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6C788B]">
                      Vérification finale de la fiche
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-bold text-[#F1F4F8] flex items-center gap-2 flex-wrap">
                          {title !== 'None' && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30">
                              {title}
                            </span>
                          )}
                          <span>{formatPlayerNameLastFirst(name || 'Sans nom')}</span>
                          {isNameUncertain && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30 rounded">
                              ? (Nom incertain)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#9BA7B8] mt-1.5 flex flex-wrap items-center gap-2">
                          <span>{club || 'Club non renseigné'}</span>
                          <span className="text-[#475569]">·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <FederationFlag
                              code={federation || 'FRA'}
                              size="xs"
                              showCode
                              showName
                            />
                          </span>
                          <span className="text-[#475569]">·</span>
                          <span className="font-mono">FIDE : {fideId || '—'}</span>
                          <span className="text-[#475569]">·</span>
                          <span className="font-mono">FFE : {ffeId || '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#232C3A] font-mono text-center">
                      <div className="p-2.5 bg-[#131820] rounded-lg border border-[#232C3A]">
                        <div className="text-[10px] text-[#6C788B] font-sans">Classique</div>
                        <div className="font-bold text-emerald-400 text-sm mt-0.5">
                          {isStandardEloUnknown ? '?' : standardElo}
                        </div>
                      </div>
                      <div className="p-2.5 bg-[#131820] rounded-lg border border-[#232C3A]">
                        <div className="text-[10px] text-[#6C788B] font-sans">Rapide</div>
                        <div className="font-bold text-[#D4A853] text-sm mt-0.5">
                          {isRapidEloUnknown ? '?' : rapidElo}
                        </div>
                      </div>
                      <div className="p-2.5 bg-[#131820] rounded-lg border border-[#232C3A]">
                        <div className="text-[10px] text-[#6C788B] font-sans">Blitz</div>
                        <div className="font-bold text-sky-400 text-sm mt-0.5">
                          {isBlitzEloUnknown ? '?' : blitzElo}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Boutons de navigation purement iconiques du Stepper */}
              <div className="flex items-center justify-between pt-4 border-t border-[#232C3A]">
                <IconButton
                  label="Annuler"
                  variant="ghost"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                >
                  <X className="w-4 h-4" />
                </IconButton>

                <div className="flex items-center gap-2">
                  {modalStep > 1 && (
                    <IconButton
                      label="Étape précédente"
                      variant="surface"
                      size="md"
                      onClick={() => setModalStep((s) => (s - 1) as 1 | 2)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </IconButton>
                  )}

                  {modalStep < 3 ? (
                    <IconButton
                      label="Étape suivante"
                      variant="primary"
                      size="md"
                      onClick={() => {
                        if (!name.trim()) {
                          setStepError('Veuillez renseigner le nom du joueur.');
                          return;
                        }
                        setStepError(null);
                        setModalStep((s) => (s + 1) as 2 | 3);
                      }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </IconButton>
                  ) : (
                    <IconButton
                      label={
                        isSubmitting
                          ? 'Enregistrement...'
                          : 'Confirmer & Enregistrer'
                      }
                      variant="primary"
                      size="md"
                      disabled={isSubmitting || !canConfirmSave || !name.trim()}
                      onClick={() => handleSubmit()}
                    >
                      <Check className="w-4 h-4" />
                    </IconButton>
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
                      : opponentToDelete.standardElo || opponentToDelete.elo || '?'
                  } / ${
                    opponentToDelete.isRapidEloUnknown ||
                    !opponentToDelete.rapidElo ||
                    Number(opponentToDelete.rapidElo) <= 0
                      ? '?'
                      : opponentToDelete.rapidElo
                  } / ${
                    opponentToDelete.isBlitzEloUnknown ||
                    !opponentToDelete.blitzElo ||
                    Number(opponentToDelete.blitzElo) <= 0
                      ? '?'
                      : opponentToDelete.blitzElo
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
