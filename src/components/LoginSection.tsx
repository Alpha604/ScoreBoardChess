import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  KeyRound,
  LogIn,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  DEFAULT_JSONBIN_BIN_ID,
  DEFAULT_JSONBIN_MASTER_KEY,
  SessionConfig,
} from '../services/jsonbinService';

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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 border-t-4 border-t-indigo-600 rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-sm">
            <Database className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-indigo-950">
            FIDE Chess Ledger
          </h1>
          <p className="text-sm text-slate-600">
            Suivi complet de vos tournois, parties FIDE, adversaires et évolution Elo.
          </p>
        </div>

        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold">Base JSONBin pré-configurée prête</div>
            <div className="text-emerald-800 mt-0.5">
              Votre ID de Bin (<span className="font-mono font-bold">{binId.slice(0, 10)}...</span>) et votre clé principale sont déjà enregistrés.
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-indigo-950 mb-1.5">
              Votre Nom ou Pseudo de joueur
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-indigo-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ex: Roméo"
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-indigo-800 bg-indigo-50/60 hover:bg-indigo-100/70 border border-indigo-200 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Paramètres JSONBin.io (ID & Clé)
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ID du Bin JSONBin
                  </label>
                  <input
                    type="text"
                    required
                    value={binId}
                    onChange={(e) => setBinId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Clé Principale (X-Master-Key)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={masterKey}
                      onChange={(e) => setMasterKey(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBinId(DEFAULT_JSONBIN_BIN_ID);
                    setMasterKey(DEFAULT_JSONBIN_MASTER_KEY);
                  }}
                  className="text-[11px] font-bold text-indigo-700 hover:underline"
                >
                  Restaurer mes identifiants JSONBin par défaut
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {isLoading ? 'Connexion et chargement...' : 'Accéder à mon espace échecs'}
          </button>
        </form>
      </div>
    </div>
  );
};
