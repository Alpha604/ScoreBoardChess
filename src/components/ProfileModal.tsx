import React, { useState } from 'react';
import { X } from 'lucide-react';
import { FideTitle, PlayerProfile } from '../types/fide';

interface ProfileModalProps {
  profile: PlayerProfile | null;
  defaultDisplayName?: string | null;
  onClose: () => void;
  onSave: (data: Omit<PlayerProfile, 'uid'>) => Promise<void>;
}

const FIDE_TITLES: FideTitle[] = ['None', 'CM', 'FM', 'IM', 'GM', 'WCM', 'WFM', 'WIM', 'WGM'];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  defaultDisplayName,
  onClose,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState(
    profile?.displayName || defaultDisplayName || 'Joueur FIDE'
  );
  const [fideId, setFideId] = useState(profile?.fideId || '65104823');
  const [ffeId, setFfeId] = useState(profile?.ffeId || 'K59412');
  const [federation, setFederation] = useState(profile?.federation || 'FRA');
  const [club, setClub] = useState(profile?.club || '');
  const [fideTitle, setFideTitle] = useState<FideTitle>(profile?.fideTitle || 'None');
  const [birthYear, setBirthYear] = useState(profile?.birthYear || 2002);
  const [kFactor, setKFactor] = useState<10 | 20 | 40>(profile?.kFactor || 20);
  const [standardElo, setStandardElo] = useState(profile?.standardElo || 1800);
  const [rapidElo, setRapidElo] = useState(profile?.rapidElo || 1800);
  const [blitzElo, setBlitzElo] = useState(profile?.blitzElo || 1800);
  const [targetElo, setTargetElo] = useState(profile?.targetElo || 2000);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        displayName,
        fideId,
        ffeId,
        federation,
        club,
        fideTitle,
        birthYear: Number(birthYear),
        kFactor,
        standardElo: Number(standardElo),
        rapidElo: Number(rapidElo),
        blitzElo: Number(blitzElo),
        targetElo: Number(targetElo),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Mon Profil Joueur (FIDE & FFE)</h2>
            <p className="text-xs text-slate-500">
              Configurez vos identifiants FIDE / FFE, votre facteur K et vos classements actuels dans chaque cadence.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mon Nom & Prénom
              </label>
              <input
                type="text"
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mon ID FIDE
              </label>
              <input
                type="text"
                maxLength={20}
                value={fideId}
                onChange={(e) => setFideId(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ex: 65104823"
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mon Code FFE
              </label>
              <input
                type="text"
                maxLength={15}
                value={ffeId}
                onChange={(e) => setFfeId(e.target.value.toUpperCase())}
                placeholder="Ex: K59412"
                className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Fédération
              </label>
              <input
                type="text"
                maxLength={3}
                value={federation}
                onChange={(e) => setFederation(e.target.value.toUpperCase())}
                required
                className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Titre FIDE</label>
              <select
                value={fideTitle}
                onChange={(e) => setFideTitle(e.target.value as FideTitle)}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
              >
                {FIDE_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'None' ? 'Aucun titre' : t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Facteur K FIDE
              </label>
              <select
                value={kFactor}
                onChange={(e) => setKFactor(Number(e.target.value) as 10 | 20 | 40)}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
              >
                <option value={40}>K = 40 (Jeunes / &lt; 30 parties)</option>
                <option value={20}>K = 20 (Standard &lt; 2400)</option>
                <option value={10}>K = 10 (2400+ Elo)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mon Club d’Échecs</label>
            <input
              type="text"
              maxLength={100}
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="Ex: Lille Université Club Échecs"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Elo Classique</label>
              <input
                type="number"
                min={800}
                max={3500}
                value={standardElo}
                onChange={(e) => setStandardElo(Number(e.target.value))}
                required
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Elo Rapide</label>
              <input
                type="number"
                min={800}
                max={3500}
                value={rapidElo}
                onChange={(e) => setRapidElo(Number(e.target.value))}
                required
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Elo Blitz</label>
              <input
                type="number"
                min={800}
                max={3500}
                value={blitzElo}
                onChange={(e) => setBlitzElo(Number(e.target.value))}
                required
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mon Objectif Elo</label>
              <input
                type="number"
                min={800}
                max={3500}
                value={targetElo}
                onChange={(e) => setTargetElo(Number(e.target.value))}
                required
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer mon profil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
