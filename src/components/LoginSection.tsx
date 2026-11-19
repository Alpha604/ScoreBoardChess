import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  KeyRound,
  Lock,
  LogIn,
  RotateCcw,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
  DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY,
  DEFAULT_JSONBIN_BIN_ID,
  DEFAULT_JSONBIN_MASTER_KEY,
  fetchDatabaseFromJsonBin,
  FideLedgerDatabase,
  saveDatabaseToJsonBin,
  SessionConfig,
} from '../services/jsonbinService';
import { TwoFactorAuthConfig } from '../types/fide';
import { getTotpSecondsRemaining, verifyTotpCode } from '../utils/totp';
import { IconButton } from './IconButton';
import {
  MicrosoftAuthenticatorPanel,
  MicrosoftLogo,
} from './MicrosoftAuthenticatorPanel';

interface LoginSectionProps {
  defaultName: string;
  onLogin: (
    newSession: SessionConfig,
    preloadedDb?: FideLedgerDatabase
  ) => Promise<void>;
}

type LoginStep = 'credentials' | 'totp_verify' | 'totp_setup';

export const LoginSection: React.FC<LoginSectionProps> = ({
  defaultName,
  onLogin,
}) => {
  const [playerName, setPlayerName] = useState(
    defaultName || 'Mon Profil Échecs'
  );
  const [binId, setBinId] = useState(DEFAULT_JSONBIN_BIN_ID);
  const [masterKey, setMasterKey] = useState(DEFAULT_JSONBIN_MASTER_KEY);
  const [friendlyBinId, setFriendlyBinId] = useState(
    DEFAULT_FRIENDLY_JSONBIN_BIN_ID
  );
  const [friendlyMasterKey, setFriendlyMasterKey] = useState(
    DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [step, setStep] = useState<LoginStep>('credentials');
  const [pendingSession, setPendingSession] = useState<SessionConfig | null>(
    null
  );
  const [loadedDb, setLoadedDb] = useState<FideLedgerDatabase | null>(null);

  const [otpCode, setOtpCode] = useState('');
  const [totpRemaining, setTotpRemaining] = useState(() =>
    getTotpSecondsRemaining()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 'totp_verify') return;
    setTotpRemaining(getTotpSecondsRemaining());
    const timer = setInterval(() => {
      setTotpRemaining(getTotpSecondsRemaining());
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const buildSessionPayload = (twoFactorVerified: boolean): SessionConfig => ({
    isAuthenticated: true,
    twoFactorVerified,
    playerName: playerName.trim() || 'Mon Profil Échecs',
    binId: binId.trim(),
    masterKey: masterKey.trim(),
    friendlyBinId: friendlyBinId.trim() || DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
    friendlyMasterKey:
      friendlyMasterKey.trim() ||
      masterKey.trim() ||
      DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY,
  });

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!binId.trim() || !masterKey.trim()) {
      setError('Veuillez renseigner l’ID du Bin et la Clé Principale JSONBin.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const remoteData = await fetchDatabaseFromJsonBin(
        binId.trim(),
        masterKey.trim()
      );
      const draftSession = buildSessionPayload(false);
      setPendingSession(draftSession);
      setLoadedDb(remoteData);
      setOtpCode('');

      if (
        remoteData.profile.twoFactorAuth?.enabled &&
        remoteData.profile.twoFactorAuth?.secret
      ) {
        setStep('totp_verify');
      } else {
        setStep('totp_setup');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la lecture du JSONBin pour vérifier votre A2F.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyTotpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSession || !loadedDb?.profile.twoFactorAuth?.secret) return;

    const clean = otpCode.replace(/\D/g, '');
    if (clean.length !== 6) {
      setError('Veuillez saisir les 6 chiffres affichés dans Microsoft Authenticator.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const valid = await verifyTotpCode(
        loadedDb.profile.twoFactorAuth.secret,
        clean
      );
      if (!valid) {
        setError(
          'Code Microsoft Authenticator invalide ou expiré. Vérifiez votre téléphone.'
        );
        return;
      }

      await onLogin(
        {
          ...pendingSession,
          isAuthenticated: true,
          twoFactorVerified: true,
        },
        loadedDb
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la validation de connexion.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteInitial2faSetup = async (
    next2fa: TwoFactorAuthConfig | undefined
  ) => {
    if (!pendingSession || !loadedDb || !next2fa?.enabled || !next2fa.secret) {
      return;
    }
    const updatedDb: FideLedgerDatabase = {
      ...loadedDb,
      profile: {
        ...loadedDb.profile,
        twoFactorAuth: next2fa,
      },
    };
    const saved = await saveDatabaseToJsonBin(
      updatedDb,
      pendingSession.binId,
      pendingSession.masterKey
    );
    await onLogin(
      {
        ...pendingSession,
        isAuthenticated: true,
        twoFactorVerified: true,
      },
      saved
    );
  };

  return (
    <div className="min-h-screen bg-[#0B0E12] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#131820] border border-[#232C3A] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#19202B] border border-[#D4A853]/40 text-[#D4A853] flex items-center justify-center mx-auto">
            <Crown className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8] font-display">
            FIDE Chess Ledger
          </h1>
          <p className="text-xs text-[#9BA7B8] leading-relaxed">
            {step === 'credentials'
              ? 'Connexion sécurisée avec double authentification Microsoft Authenticator.'
              : step === 'totp_verify'
              ? 'Vérification A2F obligatoire pour accéder à vos données.'
              : 'Configurez Microsoft Authenticator pour sécuriser vos connexions.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-medium text-rose-300">
            {error}
          </div>
        )}

        {/* ÉTAPE 1 : IDENTIFIANTS */}
        {step === 'credentials' && (
          <>
            <div className="p-3.5 bg-[#19202B] border border-emerald-500/25 rounded-xl flex items-start gap-2.5 text-xs text-[#CBD5E1]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <span>Connexion protégée par A2F</span>
                  <MicrosoftLogo className="w-3.5 h-3.5" />
                </div>
                <div className="text-[#9BA7B8] font-mono text-[11px]">
                  FIDE : {binId.slice(0, 10)}... · Amical :{' '}
                  {friendlyBinId.slice(0, 10)}...
                </div>
              </div>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                  Nom ou Pseudo de joueur
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#6C788B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Ex: Roméo"
                    className="w-full pl-10 pr-3 py-2.5 text-sm bg-[#19202B] border border-[#2B3647] rounded-xl font-medium text-[#F1F4F8] placeholder:text-[#6C788B] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between px-3 py-2 bg-[#19202B] border border-[#232C3A] rounded-xl">
                  <span className="flex items-center gap-2 text-xs font-medium text-[#9BA7B8]">
                    <ShieldCheck className="w-4 h-4 text-[#D4A853]" />
                    <span>Identifiants JSONBin</span>
                  </span>
                  <IconButton
                    label={
                      showAdvanced
                        ? 'Masquer les identifiants'
                        : 'Configurer les identifiants'
                    }
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </IconButton>
                </div>

                {showAdvanced && (
                  <div className="mt-3 p-4 bg-[#19202B] border border-[#232C3A] rounded-xl space-y-4 text-xs">
                    <div className="space-y-2 pb-3 border-b border-[#232C3A]">
                      <div className="font-semibold text-emerald-300">
                        1. Base Classée FIDE
                      </div>
                      <div>
                        <label className="block font-medium text-[#9BA7B8] mb-1">
                          ID du Bin Classé
                        </label>
                        <input
                          type="text"
                          required
                          value={binId}
                          onChange={(e) => setBinId(e.target.value)}
                          className="w-full px-3 py-2 bg-[#131820] border border-[#2B3647] rounded-lg font-mono text-xs text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#9BA7B8] mb-1">
                          Clé Principale (X-Master-Key)
                        </label>
                        <div className="relative">
                          <KeyRound className="w-3.5 h-3.5 text-[#6C788B] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="password"
                            required
                            value={masterKey}
                            onChange={(e) => setMasterKey(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-[#131820] border border-[#2B3647] rounded-lg font-mono text-xs text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="font-semibold text-[#D4A853]">
                        2. Base Parties Amicales
                      </div>
                      <div>
                        <label className="block font-medium text-[#9BA7B8] mb-1">
                          ID du Bin Amical
                        </label>
                        <input
                          type="text"
                          required
                          value={friendlyBinId}
                          onChange={(e) => setFriendlyBinId(e.target.value)}
                          className="w-full px-3 py-2 bg-[#131820] border border-[#2B3647] rounded-lg font-mono text-xs text-[#F1F4F8] focus:outline-none focus:border-[#D4A853]"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#9BA7B8] mb-1">
                          Clé Principale Bin Amical
                        </label>
                        <div className="relative">
                          <KeyRound className="w-3.5 h-3.5 text-[#6C788B] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="password"
                            required
                            value={friendlyMasterKey}
                            onChange={(e) => setFriendlyMasterKey(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-[#131820] border border-[#2B3647] rounded-lg font-mono text-xs text-[#F1F4F8] focus:outline-none focus:border-[#D4A853]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <IconButton
                        label="Restaurer les identifiants par défaut"
                        variant="surface"
                        size="sm"
                        onClick={() => {
                          setBinId(DEFAULT_JSONBIN_BIN_ID);
                          setMasterKey(DEFAULT_JSONBIN_MASTER_KEY);
                          setFriendlyBinId(DEFAULT_FRIENDLY_JSONBIN_BIN_ID);
                          setFriendlyMasterKey(
                            DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY
                          );
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <LogIn
                    className={`w-4 h-4 ${isLoading ? 'animate-pulse' : ''}`}
                  />
                  <span>
                    {isLoading
                      ? 'Vérification du compte...'
                      : 'Continuer vers l’A2F'}
                  </span>
                </button>
              </div>
            </form>
          </>
        )}

        {/* ÉTAPE 2A : VÉRIFICATION CODE MICROSOFT AUTHENTICATOR */}
        {step === 'totp_verify' && loadedDb && (
          <form onSubmit={handleVerifyTotpLogin} className="space-y-4">
            <div className="p-4 rounded-xl bg-[#19202B] border border-[#263142] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#F1F4F8]">
                  <MicrosoftLogo className="w-4 h-4 shrink-0" />
                  <span>Microsoft Authenticator</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-400">
                  <Clock className="w-3 h-3" />
                  {totpRemaining}s
                </span>
              </div>

              <div className="text-[11px] text-[#9BA7B8]">
                Compte :{' '}
                <strong className="text-[#F1F4F8]">
                  {loadedDb.profile.twoFactorAuth?.accountLabel ||
                    loadedDb.profile.displayName}
                </strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                  Code à 6 chiffres
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={otpCode}
                  onChange={(e) => {
                    setError(null);
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  placeholder="000000"
                  className="w-full px-4 py-3 text-center font-mono text-xl tracking-[0.4em] font-bold bg-[#131820] border border-[#2B3647] focus:border-emerald-500 rounded-xl text-[#F1F4F8] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setError(null);
                  setOtpCode('');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#19202B] hover:bg-[#232C3A] border border-[#2B3647] text-xs font-semibold text-[#CBD5E1] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour</span>
              </button>

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#19202B] disabled:text-[#6C788B] disabled:border disabled:border-[#263142] text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {otpCode.length === 6 ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>
                  {isLoading ? 'Vérification...' : 'Valider & Se connecter'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* ÉTAPE 2B : CONFIGURATION A2F OBLIGATOIRE LORS DE LA PREMIÈRE CONNEXION */}
        {step === 'totp_setup' && loadedDb && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#D4A853]/10 border border-[#D4A853]/30 text-xs text-[#F3D79B]">
              L’authentification A2F n’est pas encore active sur ce profil.
              Scannez ce QR Code avec <strong>Microsoft Authenticator</strong>{' '}
              pour activer la protection et ouvrir votre session.
            </div>

            <MicrosoftAuthenticatorPanel
              compact
              twoFactorAuth={loadedDb.profile.twoFactorAuth}
              accountName={loadedDb.profile.displayName || playerName}
              onUpdateTwoFactorAuth={handleCompleteInitial2faSetup}
            />

            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#19202B] hover:bg-[#232C3A] border border-[#2B3647] text-xs font-semibold text-[#CBD5E1] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
