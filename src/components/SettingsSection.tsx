import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Clock,
  Coffee,
  Database,
  Download,
  HardDrive,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Trophy,
  UploadCloud,
} from 'lucide-react';
import {
  BinSyncStatus,
  DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
  DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY,
  DEFAULT_JSONBIN_BIN_ID,
  DEFAULT_JSONBIN_MASTER_KEY,
  DeletedVaultItem,
  FideLedgerDatabase,
  FriendlyLedgerDatabase,
  LocalSnapshotItem,
  SessionConfig,
} from '../services/jsonbinService';
import { FideGame, OpponentPlayer, Tournament } from '../types/fide';
import { formatPlayerNameLastFirst } from '../utils/fideValidation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface SettingsSectionProps {
  session: SessionConfig;
  fideDb: FideLedgerDatabase;
  friendlyDb: FriendlyLedgerDatabase;
  fideStatus: BinSyncStatus;
  friendlyStatus: BinSyncStatus;
  deletedVault: DeletedVaultItem[];
  snapshots: LocalSnapshotItem[];
  onUpdateSessionConfig: (nextSession: SessionConfig) => void;
  onSyncFideFromCloud: () => Promise<void>;
  onPushFideToCloud: () => Promise<void>;
  onSyncFriendlyFromCloud: () => Promise<void>;
  onPushFriendlyToCloud: () => Promise<void>;
  onRestoreDeletedItem: (item: DeletedVaultItem) => Promise<void>;
  onRemoveDeletedItem: (id: string) => void;
  onClearDeletedVault: () => void;
  onCreateSnapshot: (ledger: 'fide' | 'friendly', reason: string) => void;
  onDeleteSnapshot: (id: string) => void;
  onRestoreFullSnapshot: (snapshot: LocalSnapshotItem) => Promise<void>;
  onRestoreSelectiveFromSnapshot: (
    snapshot: LocalSnapshotItem,
    part: 'tournaments' | 'games' | 'opponents'
  ) => Promise<void>;
  onRestoreSingleEntity: (
    ledger: 'fide' | 'friendly',
    entityType: 'tournament' | 'game' | 'opponent',
    entity: Tournament | FideGame | OpponentPlayer
  ) => Promise<void>;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  session,
  fideDb,
  friendlyDb,
  fideStatus,
  friendlyStatus,
  deletedVault,
  snapshots,
  onUpdateSessionConfig,
  onSyncFideFromCloud,
  onPushFideToCloud,
  onSyncFriendlyFromCloud,
  onPushFriendlyToCloud,
  onRestoreDeletedItem,
  onRemoveDeletedItem,
  onClearDeletedVault,
  onCreateSnapshot,
  onDeleteSnapshot,
  onRestoreFullSnapshot,
  onRestoreSelectiveFromSnapshot,
  onRestoreSingleEntity,
}) => {
  const [binIdInput, setBinIdInput] = useState(session.binId);
  const [masterKeyInput, setMasterKeyInput] = useState(session.masterKey);
  const [friendlyBinIdInput, setFriendlyBinIdInput] = useState(
    session.friendlyBinId || DEFAULT_FRIENDLY_JSONBIN_BIN_ID
  );
  const [friendlyMasterKeyInput, setFriendlyMasterKeyInput] = useState(
    session.friendlyMasterKey || DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY
  );
  const [configSavedBanner, setConfigSavedBanner] = useState(false);

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const [inspectorLedger, setInspectorLedger] = useState<'fide' | 'friendly'>(
    'fide'
  );
  const [inspectorTab, setInspectorTab] = useState<
    'tournaments' | 'games' | 'opponents'
  >('games');
  const [restoringNotice, setRestoringNotice] = useState<string | null>(null);
  const [confirmClearVault, setConfirmClearVault] = useState(false);

  const fideSizeKb = useMemo(() => {
    try {
      return (new Blob([JSON.stringify(fideDb)]).size / 1024).toFixed(1);
    } catch {
      return '0.0';
    }
  }, [fideDb]);

  const friendlySizeKb = useMemo(() => {
    try {
      return (new Blob([JSON.stringify(friendlyDb)]).size / 1024).toFixed(1);
    } catch {
      return '0.0';
    }
  }, [friendlyDb]);

  const selectedSnapshot = useMemo(
    () => snapshots.find((s) => s.id === selectedSnapshotId) || null,
    [snapshots, selectedSnapshotId]
  );

  // Source inspectée dans l'explorateur de cache local
  const inspectedSource = useMemo(() => {
    if (selectedSnapshot) {
      return {
        ledger: selectedSnapshot.ledger,
        label: `Point de restauration du ${new Date(
          selectedSnapshot.createdAt
        ).toLocaleString('fr-FR')} (${selectedSnapshot.reason})`,
        tournaments: selectedSnapshot.payload.tournaments || [],
        games: selectedSnapshot.payload.games || [],
        opponents: selectedSnapshot.payload.opponents || [],
      };
    }
    if (inspectorLedger === 'fide') {
      return {
        ledger: 'fide' as const,
        label: 'Cache Local Actuel — Base Classée FIDE (#1)',
        tournaments: fideDb.tournaments || [],
        games: fideDb.games || [],
        opponents: fideDb.opponents || [],
      };
    }
    return {
      ledger: 'friendly' as const,
      label: 'Cache Local Actuel — Base Parties Amicales (#2)',
      tournaments: friendlyDb.tournaments || [],
      games: friendlyDb.games || [],
      opponents: friendlyDb.opponents || [],
    };
  }, [selectedSnapshot, inspectorLedger, fideDb, friendlyDb]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSessionConfig({
      ...session,
      binId: binIdInput.trim() || DEFAULT_JSONBIN_BIN_ID,
      masterKey: masterKeyInput.trim() || DEFAULT_JSONBIN_MASTER_KEY,
      friendlyBinId:
        friendlyBinIdInput.trim() || DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
      friendlyMasterKey:
        friendlyMasterKeyInput.trim() || DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY,
    });
    setConfigSavedBanner(true);
    setTimeout(() => setConfigSavedBanner(false), 3500);
  };

  const handleDownloadJson = (ledger: 'fide' | 'friendly') => {
    const payload = ledger === 'fide' ? fideDb : friendlyDb;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      ledger === 'fide'
        ? `sauvegarde_fide_classee_${new Date().toISOString().slice(0, 10)}.json`
        : `sauvegarde_parties_amicales_${new Date()
            .toISOString()
            .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showNotice = (msg: string) => {
    setRestoringNotice(msg);
    setTimeout(() => setRestoringNotice(null), 4000);
  };

  const renderStatusBadge = (status: BinSyncStatus) => {
    if (status.state === 'syncing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Synchronisation...
        </span>
      );
    }
    if (status.state === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 text-xs font-bold">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
          Erreur API (Cache local protégé)
        </span>
      );
    }
    if (status.state === 'synced') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          Connecté & Synchronisé
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold">
        <HardDrive className="w-3.5 h-3.5 text-slate-600" />
        Prêt (Cache local chargé — 0 requête auto)
      </span>
    );
  };

  return (
    <div className="space-y-7">
      {/* En-tête de la page Paramètres */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Paramètres, Statuts JSONBin & Cache Local
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Surveillez l’état de vos 2 bases JSONBin sans consommer de requêtes inutiles et restaurez vos données depuis le cache local en cas de problème.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Économie de requêtes active (0 polling automatique)
        </div>
      </div>

      {restoringNotice && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-sm font-bold text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{restoringNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestoringNotice(null)}
            className="text-xs underline text-emerald-800"
          >
            Fermer
          </button>
        </div>
      )}

      {/* SECTION 1 : STATUT DES 2 JSONBIN (FIDE CLASSÉ & AMICAL) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carte JSONBin #1 : Parties Classées FIDE */}
        <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl p-6 space-y-5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                <Trophy className="w-4 h-4" />
                JSONBin #1 · Base Officielle (Classé FIDE)
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 font-mono">
                ID : {session.binId}
              </h2>
            </div>
            {renderStatusBadge(fideStatus)}
          </div>

          {fideStatus.lastError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-mono">
              Dernière erreur : {fideStatus.lastError}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
              <div className="text-[11px] font-sans font-bold text-indigo-900">
                Tournois
              </div>
              <div className="text-xl font-extrabold text-indigo-700 mt-0.5">
                {fideDb.tournaments.length}
              </div>
            </div>
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
              <div className="text-[11px] font-sans font-bold text-indigo-900">
                Parties FIDE
              </div>
              <div className="text-xl font-extrabold text-indigo-700 mt-0.5">
                {fideDb.games.length}
              </div>
            </div>
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
              <div className="text-[11px] font-sans font-bold text-indigo-900">
                Joueurs
              </div>
              <div className="text-xl font-extrabold text-indigo-700 mt-0.5">
                {fideDb.opponents.length}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[11px] font-sans font-bold text-slate-700">
                Requêtes Session
              </div>
              <div className="text-sm font-extrabold text-slate-900 mt-1">
                {fideStatus.getRequestsCount} GET · {fideStatus.putRequestsCount}{' '}
                PUT
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <span>
              Dernière synchro :{' '}
              <strong className="font-mono text-slate-900">
                {fideStatus.lastSyncedAt
                  ? new Date(fideStatus.lastSyncedAt).toLocaleString('fr-FR')
                  : fideDb.updatedAt
                  ? new Date(fideDb.updatedAt).toLocaleString('fr-FR')
                  : 'Non synchronisé'}
              </strong>
            </span>
            <span className="font-mono">Cache local : {fideSizeKb} Ko</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onSyncFideFromCloud}
              disabled={fideStatus.state === 'syncing'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-700" />
              Lire depuis le Bin #1 (1 GET)
            </button>
            <button
              type="button"
              onClick={onPushFideToCloud}
              disabled={fideStatus.state === 'syncing'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Forcer l’envoi du cache vers Bin #1 (1 PUT)
            </button>
            <button
              type="button"
              onClick={() => handleDownloadJson('fide')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter .JSON
            </button>
          </div>
        </div>

        {/* Carte JSONBin #2 : Parties Amicales */}
        <div className="bg-white border border-slate-200 border-t-4 border-t-emerald-600 rounded-2xl p-6 space-y-5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                <Coffee className="w-4 h-4" />
                JSONBin #2 · Base Indépendante (Parties Amicales)
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 font-mono">
                ID : {session.friendlyBinId || DEFAULT_FRIENDLY_JSONBIN_BIN_ID}
              </h2>
            </div>
            {renderStatusBadge(friendlyStatus)}
          </div>

          {friendlyStatus.lastError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-mono">
              Dernière erreur : {friendlyStatus.lastError}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
              <div className="text-[11px] font-sans font-bold text-emerald-900">
                Sessions
              </div>
              <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {friendlyDb.tournaments.length}
              </div>
            </div>
            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
              <div className="text-[11px] font-sans font-bold text-emerald-900">
                Parties Amicales
              </div>
              <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {friendlyDb.games.length}
              </div>
            </div>
            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
              <div className="text-[11px] font-sans font-bold text-emerald-900">
                Amis / Joueurs
              </div>
              <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {friendlyDb.opponents.length}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[11px] font-sans font-bold text-slate-700">
                Requêtes Session
              </div>
              <div className="text-sm font-extrabold text-slate-900 mt-1">
                {friendlyStatus.getRequestsCount} GET ·{' '}
                {friendlyStatus.putRequestsCount} PUT
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <span>
              Dernière synchro :{' '}
              <strong className="font-mono text-slate-900">
                {friendlyStatus.lastSyncedAt
                  ? new Date(friendlyStatus.lastSyncedAt).toLocaleString('fr-FR')
                  : friendlyDb.updatedAt
                  ? new Date(friendlyDb.updatedAt).toLocaleString('fr-FR')
                  : 'Non synchronisé'}
              </strong>
            </span>
            <span className="font-mono">Cache local : {friendlySizeKb} Ko</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onSyncFriendlyFromCloud}
              disabled={friendlyStatus.state === 'syncing'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
              Lire depuis le Bin #2 (1 GET)
            </button>
            <button
              type="button"
              onClick={onPushFriendlyToCloud}
              disabled={friendlyStatus.state === 'syncing'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Forcer l’envoi du cache vers Bin #2 (1 PUT)
            </button>
            <button
              type="button"
              onClick={() => handleDownloadJson('friendly')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter .JSON
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2 : CORBEILLE DE SECOURS LOCALE (RESTAURER UNE DONNÉE SUPPRIMÉE) */}
      <div className="bg-white border border-slate-200 border-t-4 border-t-amber-500 rounded-2xl p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ArchiveRestore className="w-5 h-5 text-amber-600" />
              Corbeille de Secours Locale ({deletedVault.length} élément
              {deletedVault.length > 1 ? 's' : ''})
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Chaque fois que vous supprimez un tournoi, une partie, un joueur ou un relevé Elo, une copie est conservée dans le cache local de votre navigateur pour pouvoir la restaurer en 1 clic.
            </p>
          </div>
          {deletedVault.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearVault(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Vider la corbeille locale
            </button>
          )}
        </div>

        {deletedVault.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200/80 text-sm text-slate-600">
            Aucun élément supprimé récemment. Vos suppressions futures apparaîtront ici automatiquement en cas d’erreur.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {deletedVault.map((item) => {
              const isFide = item.ledger === 'fide';
              const typeLabel =
                item.itemType === 'tournament'
                  ? 'Tournoi'
                  : item.itemType === 'game'
                  ? 'Partie'
                  : item.itemType === 'opponent'
                  ? 'Joueur'
                  : 'Relevé Elo';

              return (
                <div
                  key={item.id}
                  className="p-4 bg-white hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                          isFide
                            ? 'bg-indigo-100 text-indigo-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {isFide ? 'Base Classée FIDE' : 'Base Parties Amicales'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-bold">
                        {typeLabel}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        Supprimé le{' '}
                        {new Date(item.deletedAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm">
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-600">{item.details}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await onRestoreDeletedItem(item);
                        showNotice(
                          `"${item.label}" a été restauré avec succès dans la base ${
                            isFide ? 'Classée FIDE' : 'Parties Amicales'
                          }.`
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restaurer cette donnée
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveDeletedItem(item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      title="Retirer de la corbeille"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3 : EXPLORATEUR DU CACHE LOCAL & POINTS DE RESTAURATION SÉLECTIVE */}
      <div className="bg-white border border-slate-200 border-t-4 border-t-violet-600 rounded-2xl p-6 space-y-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-violet-600" />
              Cache Local & Restauration Sélective de Données
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Créez des points de sauvegarde locaux ou parcourez le cache local pour restaurer uniquement un joueur, une partie, un tournoi ou une catégorie entière.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onCreateSnapshot(
                  'fide',
                  'Sauvegarde manuelle Base Classée FIDE'
                );
                showNotice(
                  'Point de restauration local créé pour la Base Classée FIDE.'
                );
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-indigo-700" />
              Sauvegarder Cache FIDE (#1)
            </button>
            <button
              type="button"
              onClick={() => {
                onCreateSnapshot(
                  'friendly',
                  'Sauvegarde manuelle Base Amicale'
                );
                showNotice(
                  'Point de restauration local créé pour la Base Parties Amicales.'
                );
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-emerald-700" />
              Sauvegarder Cache Amical (#2)
            </button>
          </div>
        </div>

        {/* Liste des points de restauration locaux (Snapshots) */}
        {snapshots.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-600" />
              Points de restauration locaux enregistrés ({snapshots.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {snapshots.map((snap) => {
                const isSelected = selectedSnapshotId === snap.id;
                const isFide = snap.ledger === 'fide';
                return (
                  <div
                    key={snap.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-violet-50/70 border-2 border-violet-500'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                            isFide
                              ? 'bg-indigo-100 text-indigo-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {isFide ? 'Base Classée FIDE' : 'Base Amicale'}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {new Date(snap.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        {snap.reason}
                      </div>
                      <div className="text-xs font-mono text-slate-600">
                        {snap.summary}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedSnapshotId(isSelected ? '' : snap.id)
                        }
                        className="px-3 py-1.5 text-xs font-bold text-violet-900 bg-white hover:bg-violet-100 border border-violet-200 rounded-lg cursor-pointer"
                      >
                        {isSelected
                          ? 'Fermer l’inspection'
                          : 'Parcourir certaines données'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onRestoreFullSnapshot(snap);
                          showNotice(
                            `Point de restauration du ${new Date(
                              snap.createdAt
                            ).toLocaleString('fr-FR')} restauré intégralement.`
                          );
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg cursor-pointer"
                      >
                        Tout restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedSnapshotId === snap.id) {
                            setSelectedSnapshotId('');
                          }
                          onDeleteSnapshot(snap.id);
                        }}
                        className="ml-auto p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        title="Supprimer ce point de sauvegarde"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inspecteur granulaire du cache local (Restaurer certaines données) */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-violet-800">
                Inspecteur de contenu local
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {inspectedSource.label}
              </div>
            </div>

            {!selectedSnapshot && (
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setInspectorLedger('fide')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    inspectorLedger === 'fide'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Cache FIDE (#1)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorLedger('friendly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    inspectorLedger === 'friendly'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Cache Amical (#2)
                </button>
              </div>
            )}
          </div>

          {selectedSnapshot && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-violet-100/70 border border-violet-200 rounded-xl text-xs">
              <span className="font-bold text-violet-950">
                Restauration par catégorie depuis ce point de sauvegarde :
              </span>
              <button
                type="button"
                onClick={async () => {
                  await onRestoreSelectiveFromSnapshot(
                    selectedSnapshot,
                    'tournaments'
                  );
                  showNotice(
                    'Les tournois de ce point de sauvegarde ont été restaurés.'
                  );
                }}
                className="px-2.5 py-1 bg-white hover:bg-violet-50 text-violet-900 font-bold rounded-lg border border-violet-300 cursor-pointer"
              >
                Restaurer uniquement les Tournois (
                {inspectedSource.tournaments.length})
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onRestoreSelectiveFromSnapshot(
                    selectedSnapshot,
                    'games'
                  );
                  showNotice(
                    'Les parties de ce point de sauvegarde ont été restaurées.'
                  );
                }}
                className="px-2.5 py-1 bg-white hover:bg-violet-50 text-violet-900 font-bold rounded-lg border border-violet-300 cursor-pointer"
              >
                Restaurer uniquement les Parties ({inspectedSource.games.length})
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onRestoreSelectiveFromSnapshot(
                    selectedSnapshot,
                    'opponents'
                  );
                  showNotice(
                    'Les joueurs de ce point de sauvegarde ont été restaurés.'
                  );
                }}
                className="px-2.5 py-1 bg-white hover:bg-violet-50 text-violet-900 font-bold rounded-lg border border-violet-300 cursor-pointer"
              >
                Restaurer uniquement les Joueurs (
                {inspectedSource.opponents.length})
              </button>
            </div>
          )}

          {/* Onglets : Parties / Tournois / Joueurs du cache */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setInspectorTab('games')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                inspectorTab === 'games'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Parties en cache ({inspectedSource.games.length})
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab('tournaments')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                inspectorTab === 'tournaments'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Tournois en cache ({inspectedSource.tournaments.length})
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab('opponents')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                inspectorTab === 'opponents'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Joueurs en cache ({inspectedSource.opponents.length})
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl">
            {inspectorTab === 'games' &&
              (inspectedSource.games.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Aucune partie dans ce cache.
                </div>
              ) : (
                inspectedSource.games.map((g) => (
                  <div
                    key={g.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        Ronde {g.round} vs{' '}
                        {formatPlayerNameLastFirst(g.opponentName)}
                      </span>
                      <span className="text-slate-500 ml-2">
                        ({g.tournamentName} · {g.datePlayed})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await onRestoreSingleEntity(
                          inspectedSource.ledger,
                          'game',
                          g
                        );
                        showNotice(
                          `La partie contre ${formatPlayerNameLastFirst(
                            g.opponentName
                          )} a été restaurée / ré-appliquée.`
                        );
                      }}
                      className="px-3 py-1.5 font-bold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg cursor-pointer shrink-0"
                    >
                      Restaurer / Synchroniser cette partie
                    </button>
                  </div>
                ))
              ))}

            {inspectorTab === 'tournaments' &&
              (inspectedSource.tournaments.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Aucun tournoi dans ce cache.
                </div>
              ) : (
                inspectedSource.tournaments.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{t.name}</span>
                      <span className="text-slate-500 ml-2">
                        ({t.location} · {t.startDate})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await onRestoreSingleEntity(
                          inspectedSource.ledger,
                          'tournament',
                          t
                        );
                        showNotice(
                          `Le tournoi "${t.name}" a été restauré / ré-appliqué.`
                        );
                      }}
                      className="px-3 py-1.5 font-bold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg cursor-pointer shrink-0"
                    >
                      Restaurer ce tournoi
                    </button>
                  </div>
                ))
              ))}

            {inspectorTab === 'opponents' &&
              (inspectedSource.opponents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Aucun joueur dans ce cache.
                </div>
              ) : (
                inspectedSource.opponents.map((o) => (
                  <div
                    key={o.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        {formatPlayerNameLastFirst(o.name)}
                      </span>
                      <span className="font-mono text-slate-500 ml-2">
                        (Std {o.standardElo || o.elo} · Rap{' '}
                        {o.rapidElo || o.elo} · Blz {o.blitzElo || o.elo})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await onRestoreSingleEntity(
                          inspectedSource.ledger,
                          'opponent',
                          o
                        );
                        showNotice(
                          `Le joueur "${formatPlayerNameLastFirst(
                            o.name
                          )}" a été restauré.`
                        );
                      }}
                      className="px-3 py-1.5 font-bold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg cursor-pointer shrink-0"
                    >
                      Restaurer ce joueur
                    </button>
                  </div>
                ))
              ))}
          </div>
        </div>
      </div>

      {/* SECTION 4 : CONFIGURATION DES CLÉS & ID DES 2 JSONBIN */}
      <form
        onSubmit={handleSaveConfig}
        className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xs"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              Identifiants de connexion des 2 JSONBin
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Vos deux identifiants de Bin sont enregistrés localement et totalement isolés l’un de l’autre.
            </p>
          </div>
          {configSavedBanner && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              ✓ Paramètres enregistrés
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Config Bin #1 */}
          <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-3">
            <div className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
              1. JSONBin Officiel (Parties Classées FIDE)
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ID du Bin Classé
              </label>
              <input
                type="text"
                required
                value={binIdInput}
                onChange={(e) => setBinIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clé Principale (X-Master-Key)
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={masterKeyInput}
                  onChange={(e) => setMasterKeyInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Config Bin #2 */}
          <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3">
            <div className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
              2. JSONBin Indépendant (Parties Amicales)
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ID du Bin Amical
              </label>
              <input
                type="text"
                required
                value={friendlyBinIdInput}
                onChange={(e) => setFriendlyBinIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clé Principale Bin Amical (X-Master-Key)
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={friendlyMasterKeyInput}
                  onChange={(e) => setFriendlyMasterKeyInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setBinIdInput(DEFAULT_JSONBIN_BIN_ID);
              setMasterKeyInput(DEFAULT_JSONBIN_MASTER_KEY);
              setFriendlyBinIdInput(DEFAULT_FRIENDLY_JSONBIN_BIN_ID);
              setFriendlyMasterKeyInput(DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY);
            }}
            className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
          >
            Remettre les IDs par défaut (6ac7d7e6ac6210605a20528d & 6aca804bffd5d160535fa90f)
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
          >
            Enregistrer la configuration des 2 Bins
          </button>
        </div>
      </form>

      <ConfirmDeleteModal
        isOpen={confirmClearVault}
        title="Vider définitivement la corbeille de secours locale ?"
        subtitle="Tous les éléments supprimés conservés dans la corbeille locale de votre navigateur seront effacés. Vos données actives dans vos 2 JSONBin ne seront pas touchées."
        itemName="Corbeille de secours locale"
        details={[
          {
            label: 'Éléments dans la corbeille',
            value: `${deletedVault.length} élément(s)`,
          },
        ]}
        onCancel={() => setConfirmClearVault(false)}
        onConfirm={() => {
          onClearDeletedVault();
          setConfirmClearVault(false);
        }}
      />
    </div>
  );
};
