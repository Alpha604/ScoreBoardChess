import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { OpponentPlayer, TwoFactorAuthConfig } from '../types/fide';
import {
  formatPlayerNameDisplay,
  stripQuestionMarkFromName,
} from '../utils/fideValidation';
import { getTotpSecondsRemaining, verifyTotpCode } from '../utils/totp';
import { FederationFlag } from './FederationFlag';
import { IconButton } from './IconButton';
import {
  MicrosoftAuthenticatorPanel,
  MicrosoftLogo,
} from './MicrosoftAuthenticatorPanel';

export interface StrictDeleteTarget extends OpponentPlayer {
  gamesCount: number;
}

interface StrictDeletePlayerModalProps {
  opponent: StrictDeleteTarget | null;
  twoFactorAuth?: TwoFactorAuthConfig;
  accountName: string;
  onUpdateTwoFactorAuth: (next: TwoFactorAuthConfig | undefined) => Promise<void>;
  onCancel: () => void;
  onConfirmDelete: () => Promise<void>;
}

export const StrictDeletePlayerModal: React.FC<StrictDeletePlayerModalProps> = ({
  opponent,
  twoFactorAuth,
  accountName,
  onUpdateTwoFactorAuth,
  onCancel,
  onConfirmDelete,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [typedName, setTypedName] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isOtpValid, setIsOtpValid] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [totpRemaining, setTotpRemaining] = useState(() =>
    getTotpSecondsRemaining()
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const is2faConfigured = Boolean(
    twoFactorAuth?.enabled && twoFactorAuth?.secret
  );

  // Réinitialisation complète à chaque ouverture
  useEffect(() => {
    if (!opponent) {
      setSecondsLeft(5);
      setTypedName('');
      setAcknowledged(false);
      setOtpCode('');
      setIsOtpValid(false);
      setOtpError(null);
      setIsDeleting(false);
      return;
    }

    setSecondsLeft(5);
    setTypedName('');
    setAcknowledged(false);
    setOtpCode('');
    setIsOtpValid(false);
    setOtpError(null);
    setIsDeleting(false);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [opponent?.id]);

  // Minuteur TOTP 30s + re-vérification automatique si le cycle change
  useEffect(() => {
    if (!opponent || !is2faConfigured) return;
    const timer = setInterval(() => {
      setTotpRemaining(getTotpSecondsRemaining());
    }, 1000);
    return () => clearInterval(timer);
  }, [opponent, is2faConfigured]);

  // Vérification automatique dès que les 6 chiffres Microsoft Authenticator sont saisis
  useEffect(() => {
    let cancelled = false;
    const clean = otpCode.replace(/\D/g, '');
    if (!is2faConfigured || !twoFactorAuth?.secret) {
      setIsOtpValid(false);
      setOtpError(null);
      return;
    }
    if (clean.length < 6) {
      setIsOtpValid(false);
      setOtpError(null);
      return;
    }

    verifyTotpCode(twoFactorAuth.secret, clean, 1)
      .then((ok) => {
        if (cancelled) return;
        setIsOtpValid(ok);
        setOtpError(
          ok
            ? null
            : 'Code Microsoft Authenticator incorrect ou expiré. Réessayez avec le code actuel.'
        );
      })
      .catch(() => {
        if (!cancelled) {
          setIsOtpValid(false);
          setOtpError('Erreur lors de la vérification du code A2F.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [otpCode, is2faConfigured, twoFactorAuth?.secret, totpRemaining]);

  if (!opponent) return null;

  const expectedName = stripQuestionMarkFromName(opponent.name);
  const nameMatches =
    typedName.trim().length > 0 &&
    typedName.trim().toLowerCase() === expectedName.toLowerCase();

  const canDelete =
    secondsLeft === 0 &&
    acknowledged &&
    nameMatches &&
    is2faConfigured &&
    isOtpValid &&
    !isDeleting;

  const handleConfirm = async () => {
    if (!canDelete || !twoFactorAuth?.secret) return;
    setIsDeleting(true);
    try {
      // Double vérification cryptographique au moment exact du clic
      const stillValid = await verifyTotpCode(twoFactorAuth.secret, otpCode, 1);
      if (!stillValid) {
        setIsOtpValid(false);
        setOtpError('Le code Microsoft Authenticator vient d’expirer. Saisissez le nouveau code.');
        return;
      }
      await onConfirmDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const lock1Ok = secondsLeft === 0 && acknowledged;
  const lock2Ok = nameMatches;
  const lock3Ok = is2faConfigured && isOtpValid;

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#131820] border border-rose-500/45 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[92dvh] overflow-y-auto shadow-2xl pb-safe">
        {/* En-tête haute sécurité */}
        <div className="flex items-start justify-between gap-3 border-b border-[#232C3A] pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400">
                <ShieldAlert className="w-3.5 h-3.5" />
                Protocole de suppression stricte · 3 verrous
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#F1F4F8] font-display mt-0.5">
                Supprimer définitivement cet utilisateur
              </h3>
              <p className="text-xs text-[#9BA7B8] mt-0.5">
                Validation manuelle + double authentification Microsoft Authenticator obligatoire.
              </p>
            </div>
          </div>

          <IconButton
            label="Annuler et fermer"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isDeleting}
          >
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        {/* Fiche du joueur ciblé */}
        <div className="p-3.5 sm:p-4 bg-[#19202B] border border-rose-500/25 rounded-xl space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FederationFlag code={opponent.federation || 'FRA'} size="sm" />
              {opponent.title !== 'None' && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30">
                  {opponent.title}
                </span>
              )}
              <span className="font-bold text-sm sm:text-base text-[#F1F4F8] truncate">
                {formatPlayerNameDisplay(opponent.name, opponent.isNameUncertain)}
              </span>
            </div>

            <span className="font-mono text-[11px] text-[#9BA7B8]">
              {opponent.gamesCount} partie{opponent.gamesCount > 1 ? 's' : ''} liée
              {opponent.gamesCount > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#9BA7B8]">
            <span>
              Std :{' '}
              <strong className="text-emerald-400">
                {opponent.isStandardEloUnknown ? '?' : opponent.standardElo}
              </strong>
            </span>
            <span className="text-[#475569]">·</span>
            <span>
              Rap :{' '}
              <strong className="text-[#D4A853]">
                {opponent.isRapidEloUnknown ? '?' : opponent.rapidElo}
              </strong>
            </span>
            <span className="text-[#475569]">·</span>
            <span>
              Blz :{' '}
              <strong className="text-sky-400">
                {opponent.isBlitzEloUnknown ? '?' : opponent.blitzElo}
              </strong>
            </span>
            {(opponent.fideId || opponent.ffeId) && (
              <>
                <span className="text-[#475569]">·</span>
                <span>
                  {opponent.fideId ? `FIDE ${opponent.fideId}` : ''}{' '}
                  {opponent.ffeId ? `FFE ${opponent.ffeId}` : ''}
                </span>
              </>
            )}
          </div>

          {opponent.gamesCount > 0 && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 rounded-lg text-[11px] text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>
                Attention : ce joueur apparaît dans{' '}
                <strong>{opponent.gamesCount} partie(s)</strong> de votre registre.
              </span>
            </div>
          )}
        </div>

        {/* VERROU 1 : Compte à rebours 5s + Case à cocher */}
        <div
          className={`p-3.5 rounded-xl border space-y-2.5 transition-colors ${
            lock1Ok
              ? 'bg-emerald-500/5 border-emerald-500/35'
              : 'bg-[#19202B] border-[#263142]'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#F1F4F8] flex items-center gap-1.5">
              {lock1Ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Clock className="w-4 h-4 text-rose-400" />
              )}
              <span>Verrou 1 · Délai de sécurité & consentement</span>
            </span>
            <span
              className={`font-mono font-bold ${
                secondsLeft === 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {secondsLeft > 0 ? `${secondsLeft}s` : 'Délai OK'}
            </span>
          </div>

          <div className="w-full h-1.5 bg-[#131820] rounded-full overflow-hidden">
            <div
              style={{ width: `${((5 - secondsLeft) / 5) * 100}%` }}
              className={`h-full transition-all duration-700 ${
                secondsLeft === 0 ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-[#CBD5E1] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-[#2B3647] bg-[#131820] text-rose-500"
            />
            <span>
              Je confirme vouloir supprimer définitivement ce joueur de mon répertoire.
            </span>
          </label>
        </div>

        {/* VERROU 2 : Saisie manuelle exacte du nom */}
        <div
          className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
            lock2Ok
              ? 'bg-emerald-500/5 border-emerald-500/35'
              : 'bg-[#19202B] border-[#263142]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#F1F4F8] flex items-center gap-1.5">
              {lock2Ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#D4A853]" />
              )}
              <span>Verrou 2 · Recopiez le nom exact du joueur</span>
            </span>
            <code className="px-2 py-0.5 rounded bg-[#131820] border border-[#2B3647] font-mono text-[11px] text-[#D4A853] select-none">
              {expectedName}
            </code>
          </div>

          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            placeholder={`Tapez « ${expectedName} » (collage bloqué)`}
            className={`w-full px-3 py-2 bg-[#131820] border rounded-xl text-xs font-mono font-semibold text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none ${
              lock2Ok
                ? 'border-emerald-500/60'
                : 'border-[#2B3647] focus:border-rose-500'
            }`}
          />
        </div>

        {/* VERROU 3 : Authentification A2F Microsoft Authenticator */}
        {is2faConfigured ? (
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 transition-colors ${
              lock3Ok
                ? 'bg-emerald-500/5 border-emerald-500/40'
                : 'bg-[#19202B] border-[#263142]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#F1F4F8] flex items-center gap-2">
                <MicrosoftLogo className="w-4 h-4 shrink-0" />
                <span>Verrou 3 · Code A2F Microsoft Authenticator</span>
              </span>
              <span className="font-mono text-[11px] text-[#9BA7B8]">
                {totpRemaining}s
              </span>
            </div>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) =>
                setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="000000"
              className={`w-full px-3 py-2.5 bg-[#131820] border rounded-xl font-mono text-lg font-bold tracking-[0.4em] text-center text-[#F1F4F8] focus:outline-none ${
                lock3Ok
                  ? 'border-emerald-500 text-emerald-300'
                  : otpError
                  ? 'border-rose-500 text-rose-300'
                  : 'border-[#2B3647] focus:border-[#D4A853]'
              }`}
            />

            {lock3Ok && (
              <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Identité confirmée via Microsoft Authenticator.</span>
              </div>
            )}

            {otpError && (
              <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="p-3 bg-[#D4A853]/10 border border-[#D4A853]/35 rounded-xl text-xs text-[#F1F4F8] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#D4A853] shrink-0 mt-0.5" />
              <span>
                <strong>Verrou 3 bloqué :</strong> l’authentification A2F{' '}
                <strong>Microsoft Authenticator</strong> doit être activée
                ci-dessous avant de pouvoir supprimer un utilisateur.
              </span>
            </div>

            <MicrosoftAuthenticatorPanel
              twoFactorAuth={twoFactorAuth}
              accountName={accountName}
              onUpdateTwoFactorAuth={onUpdateTwoFactorAuth}
              compact
            />
          </div>
        )}

        {/* Barre d'actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#232C3A]">
          <div className="text-[11px] font-mono text-[#9BA7B8]">
            Verrous validés :{' '}
            <span
              className={
                lock1Ok && lock2Ok && lock3Ok
                  ? 'text-emerald-400 font-bold'
                  : 'text-[#D4A853] font-bold'
              }
            >
              {[lock1Ok, lock2Ok, lock3Ok].filter(Boolean).length} / 3
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="px-4 py-2.5 rounded-xl bg-[#19202B] border border-[#2B3647] text-xs font-semibold text-[#CBD5E1] hover:text-white cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              disabled={!canDelete}
              onClick={handleConfirm}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>
                {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
