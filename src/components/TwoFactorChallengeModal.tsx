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
import { TwoFactorAuthConfig } from '../types/fide';
import { getTotpSecondsRemaining, verifyTotpCode } from '../utils/totp';
import { IconButton } from './IconButton';
import {
  MicrosoftAuthenticatorPanel,
  MicrosoftLogo,
} from './MicrosoftAuthenticatorPanel';

export interface TwoFactorChallengeDetail {
  label: string;
  value: string;
}

interface TwoFactorChallengeModalProps {
  isOpen: boolean;
  variant?: 'danger' | 'primary';
  badgeLabel?: string;
  title: string;
  subtitle: string;
  itemLabel?: string;
  details?: TwoFactorChallengeDetail[];
  requireCheckbox?: boolean;
  checkboxLabel?: string;
  confirmLabel?: string;
  twoFactorAuth?: TwoFactorAuthConfig;
  accountName: string;
  onUpdateTwoFactorAuth: (
    next: TwoFactorAuthConfig | undefined
  ) => Promise<void>;
  onCancel: () => void;
  onVerifiedConfirm: () => Promise<void>;
}

export const TwoFactorChallengeModal: React.FC<
  TwoFactorChallengeModalProps
> = ({
  isOpen,
  variant = 'danger',
  badgeLabel,
  title,
  subtitle,
  itemLabel,
  details = [],
  requireCheckbox = false,
  checkboxLabel = 'Je confirme vouloir effectuer cette action sensible.',
  confirmLabel,
  twoFactorAuth,
  accountName,
  onUpdateTwoFactorAuth,
  onCancel,
  onVerifiedConfirm,
}) => {
  const [checked, setChecked] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isOtpValid, setIsOtpValid] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [totpRemaining, setTotpRemaining] = useState(() =>
    getTotpSecondsRemaining()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const is2faConfigured = Boolean(
    twoFactorAuth?.enabled && twoFactorAuth?.secret
  );

  // Réinitialisation complète à chaque ouverture
  useEffect(() => {
    if (!isOpen) {
      setChecked(false);
      setOtpCode('');
      setIsOtpValid(false);
      setOtpError(null);
      setIsSubmitting(false);
      setSubmitError(null);
      return;
    }

    setChecked(false);
    setOtpCode('');
    setIsOtpValid(false);
    setOtpError(null);
    setIsSubmitting(false);
    setSubmitError(null);
    setTotpRemaining(getTotpSecondsRemaining());
  }, [isOpen, title, itemLabel]);

  // Minuteur TOTP 30s
  useEffect(() => {
    if (!isOpen || !is2faConfigured) return;
    const timer = setInterval(() => {
      setTotpRemaining(getTotpSecondsRemaining());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, is2faConfigured]);

  // Vérification dynamique dès que 6 chiffres sont saisis
  useEffect(() => {
    let cancelled = false;
    const checkOtp = async () => {
      if (!isOpen || !is2faConfigured || !twoFactorAuth?.secret) {
        setIsOtpValid(false);
        return;
      }
      const clean = otpCode.replace(/\D/g, '');
      if (clean.length !== 6) {
        setIsOtpValid(false);
        setOtpError(null);
        return;
      }
      const valid = await verifyTotpCode(twoFactorAuth.secret, clean);
      if (cancelled) return;
      setIsOtpValid(valid);
      setOtpError(
        valid
          ? null
          : 'Code Microsoft Authenticator invalide ou expiré. Vérifiez les 6 chiffres.'
      );
    };
    checkOtp();
    return () => {
      cancelled = true;
    };
  }, [isOpen, otpCode, is2faConfigured, twoFactorAuth?.secret, totpRemaining]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const checkboxPassed = !requireCheckbox || checked;
  const canConfirm =
    is2faConfigured && checkboxPassed && isOtpValid && !isSubmitting;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!is2faConfigured || !twoFactorAuth?.secret || !checkboxPassed) return;

    const clean = otpCode.replace(/\D/g, '');
    const freshCheck = await verifyTotpCode(twoFactorAuth.secret, clean);
    if (!freshCheck) {
      setIsOtpValid(false);
      setOtpError('Code expiré ou incorrect. Saisissez le nouveau code.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onVerifiedConfirm();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Impossible de finaliser l’action protégée.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvedConfirmLabel =
    confirmLabel ||
    (isDanger ? 'Supprimer définitivement' : 'Valider avec l’A2F');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div
        className={`bg-[#131820] border rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92dvh] overflow-y-auto pb-safe ${
          isDanger ? 'border-rose-500/40' : 'border-emerald-500/40'
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-[#323E52] mx-auto sm:hidden" />

        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-[#232C3A] pb-3.5">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              }`}
            >
              {isDanger ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div
                className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isDanger ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {badgeLabel ||
                  (isDanger
                    ? 'Suppression protégée · Microsoft Authenticator A2F'
                    : 'Validation protégée · Microsoft Authenticator A2F')}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#F1F4F8] font-display leading-snug">
                {title}
              </h2>
              <p className="text-xs text-[#9BA7B8] mt-0.5">{subtitle}</p>
            </div>
          </div>

          <IconButton
            label="Annuler"
            variant="ghost"
            size="sm"
            onClick={onCancel}
          >
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        {/* Résumé de l'élément concerné */}
        {(itemLabel || details.length > 0) && (
          <div
            className={`p-3.5 rounded-xl bg-[#19202B] border space-y-2 ${
              isDanger ? 'border-rose-500/25' : 'border-[#263142]'
            }`}
          >
            {itemLabel && (
              <div className="text-sm font-bold text-[#F1F4F8] font-display">
                {itemLabel}
              </div>
            )}
            {details.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                {details.map((d, idx) => (
                  <div key={idx} className="text-[#9BA7B8]">
                    <span className="text-[#6C788B]">{d.label} : </span>
                    <span className="font-mono text-[#CBD5E1]">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-3.5">
          {/* Case à cocher pour actions destructrices */}
          {requireCheckbox && (
            <div
              className={`p-3.5 rounded-xl border transition-colors ${
                checked
                  ? 'bg-emerald-500/10 border-emerald-500/40'
                  : 'bg-[#19202B] border-[#263142]'
              }`}
            >
              <label className="flex items-start gap-2.5 text-xs text-[#CBD5E1] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-0.5 rounded border-[#323E52] bg-[#131820] text-rose-500 focus:ring-rose-500 shrink-0"
                />
                <span>{checkboxLabel}</span>
              </label>
            </div>
          )}

          {/* Code Microsoft Authenticator A2F */}
          {!is2faConfigured ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#D4A853]/10 border border-[#D4A853]/30 text-xs text-[#F3D79B] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D4A853] shrink-0 mt-0.5" />
                <div>
                  L’authentification <strong>Microsoft Authenticator A2F</strong>{' '}
                  doit être activée une première fois avant de valider cette
                  action sensible.
                </div>
              </div>
              <MicrosoftAuthenticatorPanel
                compact
                twoFactorAuth={twoFactorAuth}
                accountName={accountName}
                onUpdateTwoFactorAuth={onUpdateTwoFactorAuth}
              />
            </div>
          ) : (
            <div
              className={`p-3.5 rounded-xl border space-y-2.5 transition-colors ${
                isOtpValid
                  ? 'bg-emerald-500/10 border-emerald-500/40'
                  : 'bg-[#19202B] border-[#263142]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#F1F4F8]">
                  <MicrosoftLogo className="w-4 h-4 shrink-0" />
                  <span>Code Microsoft Authenticator (6 chiffres)</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#9BA7B8]">
                  <Clock className="w-3 h-3 text-sky-400" />
                  {totpRemaining}s
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className={`w-full sm:w-44 px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.35em] font-bold bg-[#131820] border rounded-xl text-[#F1F4F8] focus:outline-none ${
                    isOtpValid
                      ? 'border-emerald-500'
                      : otpError
                      ? 'border-rose-500'
                      : 'border-[#2B3647] focus:border-sky-400'
                  }`}
                />
                <div className="text-[11px] text-[#9BA7B8] flex-1">
                  {isOtpValid ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Code Microsoft Authenticator vérifié.
                    </span>
                  ) : (
                    <span>
                      Ouvrez <strong>Microsoft Authenticator</strong> sur votre
                      téléphone et recopiez le code à 6 chiffres.
                    </span>
                  )}
                </div>
              </div>

              {otpError && (
                <div className="text-[11px] text-rose-400 font-medium">
                  {otpError}
                </div>
              )}
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#232C3A]">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-[#19202B] hover:bg-[#232C3A] border border-[#2B3647] text-xs font-semibold text-[#CBD5E1] transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={!canConfirm}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                canConfirm
                  ? isDanger
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 cursor-pointer'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 cursor-pointer'
                  : 'bg-[#19202B] border border-[#263142] text-[#6C788B] cursor-not-allowed'
              }`}
            >
              {canConfirm ? (
                isDanger ? (
                  <Trash2 className="w-4 h-4" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>
                {isSubmitting ? 'Validation...' : resolvedConfirmLabel}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
