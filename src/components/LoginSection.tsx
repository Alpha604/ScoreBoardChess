import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  KeyRound,
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
  SessionConfig,
} from '../services/jsonbinService';
import { IconButton } from './IconButton';

interface LoginSectionProps {
  defaultName: string;
  onLogin: (newSession: SessionConfig) => Promise<void>;
}

export const LoginSection: React.FC<LoginSectionProps> = ({
  defaultName,
  onLogin,
}) => {
  const [playerName, setPlayerName] = useState(defaultName || 'Mon Profil Échecs');
  const [binId, setBinId] = useState(DEFAULT_JSONBIN_BIN_ID);
  const [masterKey, setMasterKey] = useState(DEFAULT_JSONBIN_MASTER_KEY);
  const [friendlyBinId, setFriendlyBinId] = useState(DEFAULT_FRIENDLY_JSONBIN_BIN_ID);
  const [friendlyMasterKey, setFriendlyMasterKey] = useState(
    DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!binId.trim() || !masterKey.trim()) {
      setError('Veuillez renseigner l’ID du Bin et la Clé Principale JSONBin.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await onLogin({
        isAuthenticated: true,
        playerName: playerName.trim() || 'Mon Profil Échecs',
        binId: binId.trim(),
        masterKey: masterKey.trim(),
        friendlyBinId: friendlyBinId.trim() || DEFAULT_FRIENDLY_JSONBIN_BIN_ID,
        friendlyMasterKey:
          friendlyMasterKey.trim() ||
          masterKey.trim() ||
          DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la connexion au JSONBin.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E12] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#131820] border border-[#232C3A] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#19202B] border border-[#D4A853]/40 text-[#D4A853] flex items-center justify-center mx-auto">
            <Crown className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8] font-display">
            FIDE Chess Ledger
          </h1>
          <p className="text-xs text-[#9BA7B8] leading-relaxed">
            Registre personnel des tournois homologués FIDE et espace isolé de parties amicales.
          </p>
        </div>

        <div className="p-3.5 bg-[#19202B] border border-emerald-500/25 rounded-xl flex items-start gap-2.5 text-xs text-[#CBD5E1]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-emerald-300">
              2 Bases JSONBin pré-configurées
            </div>
            <div className="text-[#9BA7B8] font-mono text-[11px]">
              FIDE : {binId.slice(0, 10)}... · Amical : {friendlyBinId.slice(0, 10)}...
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-medium text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                label={showAdvanced ? 'Masquer les identifiants' : 'Configurer les identifiants'}
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
                      setFriendlyMasterKey(DEFAULT_FRIENDLY_JSONBIN_MASTER_KEY);
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </IconButton>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-center">
            <IconButton
              type="submit"
              disabled={isLoading}
              label={isLoading ? 'Connexion en cours...' : 'Accéder à mon espace échecs'}
              variant="primary"
              size="lg"
              className="w-full h-11"
            >
              <LogIn className={`w-5 h-5 ${isLoading ? 'animate-pulse' : ''}`} />
            </IconButton>
          </div>
        </form>
      </div>
    </div>
  );
};
