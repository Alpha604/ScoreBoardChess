import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { TwoFactorAuthConfig } from '../types/fide';
import {
  buildOtpAuthUri,
  formatSecretForDisplay,
  generateTotpSecret,
  getTotpSecondsRemaining,
  verifyTotpCode,
} from '../utils/totp';
import { IconButton } from './IconButton';

interface MicrosoftAuthenticatorPanelProps {
  twoFactorAuth?: TwoFactorAuthConfig;
  accountName: string;
  onUpdateTwoFactorAuth: (next: TwoFactorAuthConfig | undefined) => Promise<void>;
  compact?: boolean;
  onActivated?: () => void;
}

export const MicrosoftLogo: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
  >
    <rect x="2" y="2" width="9" height="9" rx="1.5" fill="#F25022" />
    <rect x="13" y="2" width="9" height="9" rx="1.5" fill="#7FBA00" />
    <rect x="2" y="13" width="9" height="9" rx="1.5" fill="#00A4EF" />
    <rect x="13" y="13" width="9" height="9" rx="1.5" fill="#FFB900" />
  </svg>
);

export const MicrosoftAuthenticatorPanel: React.FC<
  MicrosoftAuthenticatorPanelProps
> = ({
  twoFactorAuth,
  accountName,
  onUpdateTwoFactorAuth,
  compact = false,
  onActivated,
}) => {
  const isEnabled = Boolean(twoFactorAuth?.enabled && twoFactorAuth?.secret);

  const [pendingSecret, setPendingSecret] = useState<string>(() =>
    generateTotpSecret()
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mode gestion quand A2F déjà active : 'idle' | 'test' | 'disable' | 'rotate'
  const [manageMode, setManageMode] = useState<
    'idle' | 'test' | 'disable' | 'rotate'
  >('idle');
  const [manageCode, setManageCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(() =>
    getTotpSecondsRemaining()
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(getTotpSecondsRemaining());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const otpAuthUri = useMemo(
    () =>
      buildOtpAuthUri({
        accountName: accountName || 'Joueur FIDE',
        secret: pendingSecret,
        issuer: 'FIDE Chess Ledger',
      }),
    [accountName, pendingSecret]
  );

  useEffect(() => {
    if (isEnabled && manageMode !== 'rotate') return;
    let cancelled = false;
    QRCode.toDataURL(otpAuthUri, {
      width: 220,
      margin: 2,
      color: {
        dark: '#0B0E12',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [otpAuthUri, isEnabled, manageMode]);

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(pendingSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      // Ignore clipboard fallback
    }
  };

  const handleActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = codeInput.replace(/\D/g, '');
    if (cleaned.length !== 6) {
      setErrorMsg('Saisissez les 6 chiffres affichés dans Microsoft Authenticator.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);
    try {
      const ok = await verifyTotpCode(pendingSecret, cleaned, 1);
      if (!ok) {
        setErrorMsg(
          'Code invalide. Vérifiez le code à 6 chiffres dans Microsoft Authenticator et l’heure de votre appareil.'
        );
        return;
      }

      await onUpdateTwoFactorAuth({
        enabled: true,
        secret: pendingSecret,
        accountLabel: accountName || 'Joueur FIDE',
        activatedAt: new Date().toISOString(),
      });
      setCodeInput('');
      setManageMode('idle');
      setSuccessMsg('Microsoft Authenticator activé et synchronisé avec succès.');
      if (onActivated) onActivated();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorAuth?.secret) return;
    const cleaned = manageCode.replace(/\D/g, '');
    if (cleaned.length !== 6) {
      setErrorMsg('Saisissez un code valide à 6 chiffres.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);
    try {
      const ok = await verifyTotpCode(twoFactorAuth.secret, cleaned, 1);
      if (!ok) {
        setErrorMsg(
          'Code Microsoft Authenticator incorrect ou expiré. Action refusée.'
        );
        return;
      }

      if (manageMode === 'test') {
        setSuccessMsg('Code valide ! Synchronisation Microsoft Authenticator parfaite.');
        setManageCode('');
      } else if (manageMode === 'disable') {
        await onUpdateTwoFactorAuth(undefined);
        setManageCode('');
        setManageMode('idle');
        setPendingSecret(generateTotpSecret());
        setSuccessMsg('L’authentification A2F a été désactivée.');
      } else if (manageMode === 'rotate') {
        // Autorise le passage au nouveau QR code
        setPendingSecret(generateTotpSecret());
        setManageCode('');
        await onUpdateTwoFactorAuth(undefined);
        setManageMode('idle');
        setSuccessMsg('Ancienne clé révoquée. Scannez le nouveau QR code.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isEnabled) {
    return (
      <div className="bg-[#131820] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#19202B] border border-emerald-500/40 flex items-center justify-center shrink-0">
              <MicrosoftLogo className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                A2F Microsoft Authenticator · Active
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[#F1F4F8] mt-0.5">
                Protection stricte par code à 6 chiffres
              </h3>
              <p className="text-xs text-[#9BA7B8] mt-0.5">
                Compte :{' '}
                <span className="font-mono text-[#F1F4F8]">
                  {twoFactorAuth?.accountLabel || accountName || 'Joueur FIDE'}
                </span>
                {twoFactorAuth?.activatedAt && (
                  <>
                    {' · '}
                    Activée le{' '}
                    {new Date(twoFactorAuth.activatedAt).toLocaleDateString(
                      'fr-FR'
                    )}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#9BA7B8] bg-[#19202B] border border-[#263142] px-2.5 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Renouvellement : {secondsLeft}s</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {manageMode === 'idle' ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                setManageCode('');
                setManageMode('test');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#19202B] border border-[#2B3647] text-xs font-semibold text-[#F1F4F8] hover:border-emerald-500/50 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tester un code</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                setManageCode('');
                setManageMode('rotate');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#19202B] border border-[#2B3647] text-xs font-semibold text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#D4A853]" />
              <span>Changer d’appareil</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                setManageCode('');
                setManageMode('disable');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Désactiver A2F</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleManageSubmit}
            className="p-3.5 bg-[#19202B] border border-[#2B3647] rounded-xl space-y-3"
          >
            <div className="text-xs font-semibold text-[#F1F4F8]">
              {manageMode === 'test'
                ? 'Vérifier la synchronisation avec Microsoft Authenticator'
                : manageMode === 'rotate'
                ? 'Entrez votre code Microsoft Authenticator actuel pour réinitialiser le QR code'
                : 'Confirmation requise : saisissez un code Microsoft Authenticator pour désactiver l’A2F'}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={manageCode}
                onChange={(e) =>
                  setManageCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                className="flex-1 px-3 py-2 bg-[#131820] border border-[#2B3647] rounded-xl font-mono text-base font-bold tracking-[0.35em] text-center text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setManageMode('idle');
                    setErrorMsg(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-[#131820] border border-[#2B3647] text-xs font-semibold text-[#9BA7B8] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || manageCode.length !== 6}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${
                    manageMode === 'disable'
                      ? 'bg-rose-500 text-white'
                      : 'bg-emerald-500 text-[#06130E]'
                  }`}
                >
                  {isProcessing ? 'Vérification...' : 'Valider'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    );
  }

  // MODE CONFIGURATION / APPARIEMENT MICROSOFT AUTHENTICATOR
  return (
    <div
      className={`bg-[#131820] border border-[#D4A853]/35 rounded-2xl ${
        compact ? 'p-3.5 sm:p-4 space-y-3.5' : 'p-4 sm:p-5 space-y-4'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#19202B] border border-[#D4A853]/40 flex items-center justify-center shrink-0">
            <MicrosoftLogo className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#D4A853]">
              <ShieldAlert className="w-3.5 h-3.5" />
              Configuration A2F · Microsoft Authenticator
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[#F1F4F8] mt-0.5">
              Associer Microsoft Authenticator
            </h3>
            <p className="text-xs text-[#9BA7B8] mt-0.5">
              Requis pour sécuriser strictement la suppression d’un joueur.
            </p>
          </div>
        </div>

        <IconButton
          label="Générer une nouvelle clé secrète"
          variant="surface"
          size="sm"
          onClick={() => {
            setPendingSecret(generateTotpSecret());
            setCodeInput('');
            setErrorMsg(null);
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </IconButton>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* QR Code Microsoft Authenticator */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-3.5 bg-[#19202B] border border-[#263142] rounded-xl space-y-2.5">
          {qrDataUrl ? (
            <div className="p-2 bg-white rounded-xl shadow-md">
              <img
                src={qrDataUrl}
                alt="QR Code Microsoft Authenticator"
                className="w-40 h-40 sm:w-44 sm:h-44 block"
              />
            </div>
          ) : (
            <div className="w-40 h-40 rounded-xl bg-[#131820] flex items-center justify-center text-xs text-[#6C788B]">
              Génération QR...
            </div>
          )}

          <div className="w-full space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#6C788B] text-center">
              Clé manuelle (si sans caméra)
            </div>
            <div className="flex items-center gap-1.5 bg-[#131820] border border-[#2B3647] rounded-lg px-2.5 py-1.5">
              <code className="flex-1 text-[11px] font-mono text-[#D4A853] break-all text-center select-all">
                {formatSecretForDisplay(pendingSecret)}
              </code>
              <button
                type="button"
                onClick={handleCopySecret}
                aria-label="Copier la clé secrète"
                className="p-1 rounded hover:bg-[#19202B] text-[#9BA7B8] hover:text-white cursor-pointer shrink-0"
              >
                {copiedSecret ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Étapes + Vérification premier code */}
        <div className="md:col-span-7 space-y-3 text-xs">
          <div className="p-3 bg-[#19202B] border border-[#263142] rounded-xl space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#F1F4F8]">
              <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Étapes sur votre téléphone :</span>
            </div>
            <ol className="space-y-1.5 text-[#CBD5E1] list-decimal list-inside leading-relaxed">
              <li>
                Ouvrez l’app <strong>Microsoft Authenticator</strong> et appuyez
                sur <strong>+</strong>.
              </li>
              <li>
                Choisissez <strong>Autre compte (Google, Facebook, etc.)</strong>.
              </li>
              <li>
                Scannez le <strong>QR code</strong> (ou saisissez la clé manuelle).
              </li>
              <li>
                Entrez ci-dessous le <strong>code à 6 chiffres</strong> affiché :
              </li>
            </ol>
          </div>

          <div className="p-3 bg-[#19202B] border border-[#263142] rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-[#F1F4F8] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <span>Code Microsoft Authenticator (6 chiffres)</span>
              </label>
              <span className="font-mono text-[11px] text-[#9BA7B8]">
                {secondsLeft}s
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codeInput}
                onChange={(e) => {
                  setErrorMsg(null);
                  setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleActivate();
                  }
                }}
                placeholder="123456"
                className="flex-1 px-3 py-2.5 bg-[#131820] border border-[#2B3647] rounded-xl font-mono text-base font-bold tracking-[0.35em] text-center text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                disabled={isProcessing || codeInput.length !== 6}
                onClick={() => handleActivate()}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#06130E] font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isProcessing ? 'Activation...' : 'Activer A2F'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
