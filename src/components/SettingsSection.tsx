import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Database,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  UploadCloud,
  Users,
  X,
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
import {
  FideGame,
  OpponentPlayer,
  Tournament,
  TwoFactorAuthConfig,
} from '../types/fide';
import {
  formatPlayerNameLastFirst,
  getOpponentEloForCadence,
  isOpponentEloUnknownForCadence,
} from '../utils/fideValidation';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { IconButton } from './IconButton';
import { MicrosoftAuthenticatorPanel } from './MicrosoftAuthenticatorPanel';

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
  onUpdateTwoFactorAuth: (next: TwoFactorAuthConfig | undefined) => Promise<void>;
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
  onUpdateTwoFactorAuth,
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
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#D4A853]">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Synchro...
        </span>
      );
    }
    if (status.state === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-rose-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Erreur API
        </span>
      );
    }
    if (status.state === 'synced') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Synchronisé
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#9BA7B8]">
        <HardDrive className="w-3.5 h-3.5" />
        Cache prêt
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* En-tête de la page Paramètres */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#232C3A] pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#F1F4F8]">
            Paramètres, JSONBin & Cache Local
          </h1>
          <p className="text-xs text-[#9BA7B8] mt-1">
            Gérez vos 2 bases JSONBin sans polling automatique, la corbeille locale et les points de restauration.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 shrink-0">
          <ShieldCheck className="w-4 h-4" />
          <span>0 requête auto</span>
        </div>
      </div>

      {restoringNotice && (
        <div className="p-4 bg-[#19202B] border border-emerald-500/40 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold text-emerald-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{restoringNotice}</span>
          </div>
          <IconButton
            label="Fermer"
            variant="ghost"
            size="xs"
            onClick={() => setRestoringNotice(null)}
          >
            <X className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      )}

      {/* SECTION 0 : SÉCURITÉ A2F MICROSOFT AUTHENTICATOR */}
      <MicrosoftAuthenticatorPanel
        twoFactorAuth={fideDb.profile.twoFactorAuth}
        accountName={fideDb.profile.displayName}
        onUpdateTwoFactorAuth={onUpdateTwoFactorAuth}
      />

      {/* SECTION 1 : STATUT DES 2 JSONBIN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Carte JSONBin #1 : Parties Classées FIDE */}
        <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                JSONBin #1 · Base Classée FIDE
              </div>
              <h2 className="text-sm sm:text-base font-bold text-[#F1F4F8] font-mono break-all">
                {session.binId}
              </h2>
            </div>
            {renderStatusBadge(fideStatus)}
          </div>

          {fideStatus.lastError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-mono">
              Dernière erreur : {fideStatus.lastError}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-center">
            <div className="p-3 bg-[#19202B] border border-[#232C3A] rounded-xl">
              <div className="text-[11px] font-sans text-[#6C788B]">Tournois</div>
              <div className="text-lg font-bold text-[#F1F4F8] mt-0.5 tabular-nums">
                {fideDb.tournaments.length}
              </div>
            </div>
            <div className="p-3 bg-[#19202B] border border-[#232C3A] rounded-xl">
              <div className="text-[11px] font-sans text-[#6C788B]">Parties</div>
              <div className="text-lg font-bold text-[#F1F4F8] mt-0.5 tabular-nums">
                {fideDb.games.length}
              </div>
            </div>
            <div className="p-3 bg-[#19202B] border border-[#232C3A] rounded-xl">
              <div className="text-[11px] font-sans text-[#6C788B]">Joueurs</div>
              <div className="text-lg font-bold text-[#F1F4F8] mt-0.5 tabular-nums">
                {fideDb.opponents.length}
              </div>
            </div>
            <div className="p-3 bg-[#19202B] border border-[#232C3A] rounded-xl">
              <div className="text-[11px] font-sans text-[#6C788B]">Requêtes</div>
              <div className="text-xs font-bold text-emerald-400 mt-1.5 tabular-nums">
                {fideStatus.getRequestsCount}G · {fideStatus.putRequestsCount}P
              </div>
            </div>
          </div>

          <div className="text-xs text-[#9BA7B8] flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#232C3A]">
            <span>
              Synchro :{' '}
              <strong className="font-mono text-[#F1F4F8]">
                {fideStatus.lastSyncedAt
                  ? new Date(fideStatus.lastSyncedAt).toLocaleString('fr-FR')
                  : fideDb.updatedAt
                  ? new Date(fideDb.updatedAt).toLocaleString('fr-FR')
                  : 'Non synchronisé'}
              </strong>
            </span>
            <span className="font-mono text-[#6C788B]">{fideSizeKb} Ko</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <IconButton
              label="Lire depuis le Bin #1 (1 GET)"
              variant="surface"
              size="md"
              disabled={fideStatus.state === 'syncing'}
              onClick={onSyncFideFromCloud}
            >
              <RefreshCw
                className={`w-4 h-4 ${fideStatus.state === 'syncing' ? 'animate-spin' : ''}`}
              />
            </IconButton>
            <IconButton
              label="Forcer l'envoi du cache vers Bin #1 (1 PUT)"
              variant="primary"
              size="md"
              disabled={fideStatus.state === 'syncing'}
              onClick={onPushFideToCloud}
            >
              <UploadCloud className="w-4 h-4" />
            </IconButton>
            <IconButton
              label="Exporter la base FIDE en .JSON"
              variant="surface"
              size="md"
              onClick={() => handleDownloadJson('fide')}
            >
              <Download className="w-4 h-4" />
            </IconButton>
          </div>
        </div>

        {/* Carte JSONBin #2 : Parties Amicales */}
        <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#D4A853]">
                <Coffee className="w-3.5 h-3.5 shrink-0" />
                JSONBin #2 · Base Parties Amicales
              </div>
              <h2 className="text-sm sm:text-base font-bold text-[#F1F4F8] font-mono break-all">
                {session.friendlyBinId || DEFAULT_FRIENDLY_JSONBIN_BIN_ID}
              </h2>
            </div>
            {renderStatusBadge(friendlyStatus)}
          </div>

          {friendlyStatus.lastError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-mono">
              Dernière erreur : {friendlyStatus.lastError}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-center">
            <div className="p-3 bg-[#19202B] border border-[#232C3A] rounded-xl">
              <div className="text-[11px] font-sans text-[#6C788B]">Sessions</div>
              <div className="text-lg font-bold text-[#F1F4F8] mt-0.5 tabular-nums">
                {friendlyDb.tournaments.length}
              </div>
            </div>
            <div className="p-3 bg-[#19202B] border border-[#232C3A] rounded-xl">
              <div className="text-[11px] font-sans text-[#6C788B]">Parties</div>
              <div className="text-lg font-bold text-[#F1F4F8] mt-0.5 tabular-nums">
                {friendlyDb.games.length}
              </div>
            </div>
            <div className="p-3 bg-[#19202B] border border-[#232C3A] rounded-xl">
              <div className="text-[11px] font-sans text-[#6C788B]">Joueurs</div>
              <div className="text-lg font-bold text-[#F1F4F8] mt-0.5 tabular-nums">
                {friendlyDb.opponents.length}
              </div>
            </div>
            <div className="p-3 bg-[#19202B] border border-[#232C3A] rounded-xl">
              <div className="text-[11px] font-sans text-[#6C788B]">Requêtes</div>
              <div className="text-xs font-bold text-[#D4A853] mt-1.5 tabular-nums">
                {friendlyStatus.getRequestsCount}G · {friendlyStatus.putRequestsCount}P
              </div>
            </div>
          </div>

          <div className="text-xs text-[#9BA7B8] flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#232C3A]">
            <span>
              Synchro :{' '}
              <strong className="font-mono text-[#F1F4F8]">
                {friendlyStatus.lastSyncedAt
                  ? new Date(friendlyStatus.lastSyncedAt).toLocaleString('fr-FR')
                  : friendlyDb.updatedAt
                  ? new Date(friendlyDb.updatedAt).toLocaleString('fr-FR')
                  : 'Non synchronisé'}
              </strong>
            </span>
            <span className="font-mono text-[#6C788B]">{friendlySizeKb} Ko</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <IconButton
              label="Lire depuis le Bin #2 (1 GET)"
              variant="surface"
              size="md"
              disabled={friendlyStatus.state === 'syncing'}
              onClick={onSyncFriendlyFromCloud}
            >
              <RefreshCw
                className={`w-4 h-4 ${friendlyStatus.state === 'syncing' ? 'animate-spin' : ''}`}
              />
            </IconButton>
            <IconButton
              label="Forcer l'envoi du cache vers Bin #2 (1 PUT)"
              variant="gold"
              size="md"
              disabled={friendlyStatus.state === 'syncing'}
              onClick={onPushFriendlyToCloud}
            >
              <UploadCloud className="w-4 h-4" />
            </IconButton>
            <IconButton
              label="Exporter la base Amicale en .JSON"
              variant="surface"
              size="md"
              onClick={() => handleDownloadJson('friendly')}
            >
              <Download className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      </div>

      {/* SECTION 2 : CORBEILLE DE SECOURS LOCALE */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-[#232C3A] pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#F1F4F8] flex items-center gap-2">
              <ArchiveRestore className="w-4 h-4 text-[#D4A853]" />
              Corbeille Locale ({deletedVault.length})
            </h2>
            <p className="text-xs text-[#9BA7B8] mt-0.5">
              Copie locale automatique de vos suppressions pour restauration en 1 clic.
            </p>
          </div>
          {deletedVault.length > 0 && (
            <IconButton
              label="Vider définitivement la corbeille locale"
              variant="danger"
              size="sm"
              onClick={() => setConfirmClearVault(true)}
            >
              <Trash2 className="w-4 h-4" />
            </IconButton>
          )}
        </div>

        {deletedVault.length === 0 ? (
          <div className="p-6 text-center bg-[#19202B] rounded-xl border border-[#232C3A] text-xs text-[#6C788B]">
            Aucun élément supprimé récemment.
          </div>
        ) : (
          <div className="divide-y divide-[#232C3A] border border-[#232C3A] rounded-xl overflow-hidden">
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
                  className="p-4 bg-[#19202B] hover:bg-[#212A38] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <span className={isFide ? 'text-emerald-400 font-bold' : 'text-[#D4A853] font-bold'}>
                        {isFide ? 'Base FIDE' : 'Base Amicale'}
                      </span>
                      <span className="text-[#475569]">·</span>
                      <span className="text-[#F1F4F8]">{typeLabel}</span>
                      <span className="text-[#475569]">·</span>
                      <span className="text-[#6C788B]">
                        {new Date(item.deletedAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <div className="font-semibold text-[#F1F4F8] text-sm">
                      {item.label}
                    </div>
                    <div className="text-xs text-[#9BA7B8]">{item.details}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <IconButton
                      label="Restaurer cette donnée"
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        await onRestoreDeletedItem(item);
                        showNotice(
                          `"${item.label}" a été restauré avec succès dans la base ${
                            isFide ? 'Classée FIDE' : 'Parties Amicales'
                          }.`
                        );
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      label="Retirer de la corbeille"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveDeletedItem(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3 : EXPLORATEUR DU CACHE LOCAL & POINTS DE RESTAURATION SÉLECTIVE */}
      <div className="bg-[#131820] border border-[#232C3A] rounded-2xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#232C3A] pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#F1F4F8] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              Cache Local & Points de Restauration
            </h2>
            <p className="text-xs text-[#9BA7B8] mt-0.5">
              Créez des points de sauvegarde locaux ou restaurez sélectivement un tournoi, une partie ou un joueur.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <IconButton
              label="Créer un point de sauvegarde Cache FIDE (#1)"
              variant="primary"
              size="md"
              onClick={() => {
                onCreateSnapshot(
                  'fide',
                  'Sauvegarde manuelle Base Classée FIDE'
                );
                showNotice(
                  'Point de restauration local créé pour la Base Classée FIDE.'
                );
              }}
            >
              <Save className="w-4 h-4" />
            </IconButton>
            <IconButton
              label="Créer un point de sauvegarde Cache Amical (#2)"
              variant="gold"
              size="md"
              onClick={() => {
                onCreateSnapshot(
                  'friendly',
                  'Sauvegarde manuelle Base Amicale'
                );
                showNotice(
                  'Point de restauration local créé pour la Base Parties Amicales.'
                );
              }}
            >
              <Save className="w-4 h-4" />
            </IconButton>
          </div>
        </div>

        {/* Liste des points de restauration locaux */}
        {snapshots.length > 0 && (
          <div className="space-y-3">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6C788B] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#D4A853]" />
              Points de restauration ({snapshots.length})
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
                        ? 'bg-[#212A38] border-emerald-500/50'
                        : 'bg-[#19202B] border-[#232C3A]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className={isFide ? 'text-emerald-400 font-bold' : 'text-[#D4A853] font-bold'}>
                          {isFide ? 'Base Classée FIDE' : 'Base Amicale'}
                        </span>
                        <span className="text-[#6C788B]">
                          {new Date(snap.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <div className="font-semibold text-[#F1F4F8] text-sm">
                        {snap.reason}
                      </div>
                      <div className="text-xs font-mono text-[#9BA7B8]">
                        {snap.summary}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#232C3A]">
                      <IconButton
                        label={
                          isSelected
                            ? 'Fermer l’inspection'
                            : 'Inspecter ce point de sauvegarde'
                        }
                        variant={isSelected ? 'active' : 'surface'}
                        size="sm"
                        onClick={() =>
                          setSelectedSnapshotId(isSelected ? '' : snap.id)
                        }
                      >
                        {isSelected ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </IconButton>

                      <IconButton
                        label="Tout restaurer depuis ce snapshot"
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          await onRestoreFullSnapshot(snap);
                          showNotice(
                            `Point de restauration du ${new Date(
                              snap.createdAt
                            ).toLocaleString('fr-FR')} restauré intégralement.`
                          );
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </IconButton>

                      <IconButton
                        label="Supprimer ce point de sauvegarde"
                        variant="danger"
                        size="sm"
                        className="ml-auto"
                        onClick={() => {
                          if (selectedSnapshotId === snap.id) {
                            setSelectedSnapshotId('');
                          }
                          onDeleteSnapshot(snap.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inspecteur granulaire du cache local */}
        <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                Inspecteur de contenu local
              </div>
              <div className="text-sm font-semibold text-[#F1F4F8] mt-0.5">
                {inspectedSource.label}
              </div>
            </div>

            {!selectedSnapshot && (
              <div className="flex items-center gap-1.5">
                <IconButton
                  label="Inspecter le cache FIDE (#1)"
                  variant={inspectorLedger === 'fide' ? 'active' : 'surface'}
                  size="sm"
                  onClick={() => setInspectorLedger('fide')}
                >
                  <Trophy className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton
                  label="Inspecter le cache Amical (#2)"
                  variant={inspectorLedger === 'friendly' ? 'gold' : 'surface'}
                  size="sm"
                  onClick={() => setInspectorLedger('friendly')}
                >
                  <Coffee className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            )}
          </div>

          {selectedSnapshot && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-[#131820] border border-[#2B3647] rounded-xl text-xs">
              <span className="font-semibold text-[#9BA7B8] mr-1">
                Restauration ciblée :
              </span>
              <IconButton
                label={`Restaurer uniquement les Tournois (${inspectedSource.tournaments.length})`}
                variant="surface"
                size="sm"
                badge={inspectedSource.tournaments.length}
                onClick={async () => {
                  await onRestoreSelectiveFromSnapshot(
                    selectedSnapshot,
                    'tournaments'
                  );
                  showNotice(
                    'Les tournois de ce point de sauvegarde ont été restaurés.'
                  );
                }}
              >
                <Trophy className="w-3.5 h-3.5" />
              </IconButton>
              <IconButton
                label={`Restaurer uniquement les Parties (${inspectedSource.games.length})`}
                variant="surface"
                size="sm"
                badge={inspectedSource.games.length}
                onClick={async () => {
                  await onRestoreSelectiveFromSnapshot(
                    selectedSnapshot,
                    'games'
                  );
                  showNotice(
                    'Les parties de ce point de sauvegarde ont été restaurées.'
                  );
                }}
              >
                <Swords className="w-3.5 h-3.5" />
              </IconButton>
              <IconButton
                label={`Restaurer uniquement les Joueurs (${inspectedSource.opponents.length})`}
                variant="surface"
                size="sm"
                badge={inspectedSource.opponents.length}
                onClick={async () => {
                  await onRestoreSelectiveFromSnapshot(
                    selectedSnapshot,
                    'opponents'
                  );
                  showNotice(
                    'Les joueurs de ce point de sauvegarde ont été restaurés.'
                  );
                }}
              >
                <Users className="w-3.5 h-3.5" />
              </IconButton>
            </div>
          )}

          {/* Onglets : Parties / Tournois / Joueurs du cache */}
          <div className="flex items-center gap-2">
            <IconButton
              label={`Parties en cache (${inspectedSource.games.length})`}
              variant={inspectorTab === 'games' ? 'active' : 'surface'}
              size="sm"
              badge={inspectedSource.games.length}
              onClick={() => setInspectorTab('games')}
            >
              <Swords className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              label={`Tournois en cache (${inspectedSource.tournaments.length})`}
              variant={inspectorTab === 'tournaments' ? 'active' : 'surface'}
              size="sm"
              badge={inspectedSource.tournaments.length}
              onClick={() => setInspectorTab('tournaments')}
            >
              <Trophy className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              label={`Joueurs en cache (${inspectedSource.opponents.length})`}
              variant={inspectorTab === 'opponents' ? 'active' : 'surface'}
              size="sm"
              badge={inspectedSource.opponents.length}
              onClick={() => setInspectorTab('opponents')}
            >
              <Users className="w-3.5 h-3.5" />
            </IconButton>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-[#232C3A] bg-[#131820] border border-[#232C3A] rounded-xl">
            {inspectorTab === 'games' &&
              (inspectedSource.games.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6C788B]">
                  Aucune partie dans ce cache.
                </div>
              ) : (
                inspectedSource.games.map((g) => (
                  <div
                    key={g.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-[#19202B]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[#F1F4F8]">
                        Ronde {g.round} vs{' '}
                        {formatPlayerNameLastFirst(g.opponentName)}
                      </span>
                      <span className="text-[#6C788B] ml-2 font-mono">
                        {g.tournamentName} · {g.datePlayed}
                      </span>
                    </div>
                    <IconButton
                      label="Restaurer / synchroniser cette partie"
                      variant="surface"
                      size="xs"
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
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                ))
              ))}

            {inspectorTab === 'tournaments' &&
              (inspectedSource.tournaments.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6C788B]">
                  Aucun tournoi dans ce cache.
                </div>
              ) : (
                inspectedSource.tournaments.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-[#19202B]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[#F1F4F8]">{t.name}</span>
                      <span className="text-[#6C788B] ml-2 font-mono">
                        {t.location} · {t.startDate}
                      </span>
                    </div>
                    <IconButton
                      label="Restaurer ce tournoi"
                      variant="surface"
                      size="xs"
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
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                ))
              ))}

            {inspectorTab === 'opponents' &&
              (inspectedSource.opponents.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6C788B]">
                  Aucun joueur dans ce cache.
                </div>
              ) : (
                inspectedSource.opponents.map((o) => (
                  <div
                    key={o.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-[#19202B]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[#F1F4F8]">
                        {formatPlayerNameLastFirst(o.name)}
                      </span>
                      <span className="font-mono text-[#9BA7B8] ml-2">
                        Std{' '}
                        {isOpponentEloUnknownForCadence(o, 'Standard')
                          ? '?'
                          : getOpponentEloForCadence(o, 'Standard')}{' '}
                        · Rap{' '}
                        {isOpponentEloUnknownForCadence(o, 'Rapid')
                          ? '?'
                          : getOpponentEloForCadence(o, 'Rapid')}{' '}
                        · Blz{' '}
                        {isOpponentEloUnknownForCadence(o, 'Blitz')
                          ? '?'
                          : getOpponentEloForCadence(o, 'Blitz')}
                      </span>
                    </div>
                    <IconButton
                      label="Restaurer ce joueur"
                      variant="surface"
                      size="xs"
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
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                ))
              ))}
          </div>
        </div>
      </div>

      {/* SECTION 4 : CONFIGURATION DES CLÉS & ID DES 2 JSONBIN */}
      <form
        onSubmit={handleSaveConfig}
        className="bg-[#131820] border border-[#232C3A] rounded-2xl p-5 space-y-5"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#232C3A] pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#F1F4F8] flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Identifiants des 2 JSONBin
            </h2>
            <p className="text-xs text-[#9BA7B8] mt-0.5">
              Enregistrés localement et totalement isolés l’un de l’autre.
            </p>
          </div>
          {configSavedBanner && (
            <span className="text-xs font-mono font-bold text-emerald-400">
              ✓ Enregistré
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Config Bin #1 */}
          <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-xl space-y-3">
            <div className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
              1. JSONBin Officiel (Classé FIDE)
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                ID du Bin Classé
              </label>
              <input
                type="text"
                required
                value={binIdInput}
                onChange={(e) => setBinIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-[#131820] border border-[#2B3647] rounded-xl font-mono text-xs text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                Clé Principale (X-Master-Key)
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-[#6C788B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={masterKeyInput}
                  onChange={(e) => setMasterKeyInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-[#131820] border border-[#2B3647] rounded-xl font-mono text-xs text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Config Bin #2 */}
          <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-xl space-y-3">
            <div className="text-[11px] font-mono font-bold text-[#D4A853] uppercase tracking-wider">
              2. JSONBin Indépendant (Parties Amicales)
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                ID du Bin Amical
              </label>
              <input
                type="text"
                required
                value={friendlyBinIdInput}
                onChange={(e) => setFriendlyBinIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-[#131820] border border-[#2B3647] rounded-xl font-mono text-xs text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                Clé Principale Bin Amical (X-Master-Key)
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-[#6C788B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={friendlyMasterKeyInput}
                  onChange={(e) => setFriendlyMasterKeyInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-[#131820] border border-[#2B3647] rounded-xl font-mono text-xs text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <IconButton
            label="Remettre les IDs par défaut"
            variant="surface"
            size="md"
            onClick={() => {
              setBinIdInput(DEFAULT_JSONBIN_BIN_ID);
              setMasterKeyInput(DEFAULT_JSONBIN_MASTER_KEY);
              setFriendlyBinIdInput(DEFAULT_FRIENDLY_JSONBIN_BIN_ID);
              setFriendlyMasterKeyInput(DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY);
            }}
          >
            <RotateCcw className="w-4 h-4" />
          </IconButton>

          <IconButton
            type="submit"
            label="Enregistrer la configuration des 2 Bins"
            variant="primary"
            size="md"
          >
            <Check className="w-4 h-4" />
          </IconButton>
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
