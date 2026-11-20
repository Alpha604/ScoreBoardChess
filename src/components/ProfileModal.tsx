import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { FideTitle, PlayerProfile } from '../types/fide';
import { POPULAR_FEDERATIONS } from '../utils/federationFlags';
import { FederationFlag } from './FederationFlag';
import { IconButton } from './IconButton';

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
  const initialDisplayName = profile?.displayName || defaultDisplayName || 'Joueur FIDE';
  const initialFideId = profile?.fideId || '65104823';
  const initialFfeId = profile?.ffeId || 'K59412';
  const initialFederation = profile?.federation || 'FRA';
  const initialClub = profile?.club || '';
  const initialTitle = profile?.fideTitle || 'None';
  const initialBirthYear = profile?.birthYear || 2002;
  const initialKFactor = profile?.kFactor || 20;
  const initialStd = profile?.standardElo || 1800;
  const initialRap = profile?.rapidElo || 1820;
  const initialBlz = profile?.blitzElo || 1850;
  const initialTarget = profile?.targetElo || 2000;

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [fideId, setFideId] = useState(initialFideId);
  const [ffeId, setFfeId] = useState(initialFfeId);
  const [federation, setFederation] = useState(initialFederation);
  const [club, setClub] = useState(initialClub);
  const [fideTitle, setFideTitle] = useState<FideTitle>(initialTitle);
  const [birthYear, setBirthYear] = useState(initialBirthYear);
  const [kFactor, setKFactor] = useState<10 | 20 | 40>(initialKFactor);
  const [standardElo, setStandardElo] = useState(initialStd);
  const [rapidElo, setRapidElo] = useState(initialRap);
  const [blitzElo, setBlitzElo] = useState(initialBlz);
  const [targetElo, setTargetElo] = useState(initialTarget);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmLargeEloJump, setConfirmLargeEloJump] = useState(false);

  const isDirty = useMemo(
    () =>
      displayName !== initialDisplayName ||
      fideId !== initialFideId ||
      ffeId !== initialFfeId ||
      federation !== initialFederation ||
      club !== initialClub ||
      fideTitle !== initialTitle ||
      Number(birthYear) !== initialBirthYear ||
      kFactor !== initialKFactor ||
      Number(standardElo) !== initialStd ||
      Number(rapidElo) !== initialRap ||
      Number(blitzElo) !== initialBlz ||
      Number(targetElo) !== initialTarget,
    [
      displayName,
      initialDisplayName,
      fideId,
      initialFideId,
      ffeId,
      initialFfeId,
      federation,
      initialFederation,
      club,
      initialClub,
      fideTitle,
      initialTitle,
      birthYear,
      initialBirthYear,
      kFactor,
      initialKFactor,
      standardElo,
      initialStd,
      rapidElo,
      initialRap,
      blitzElo,
      initialBlz,
      targetElo,
      initialTarget,
    ]
  );

  const hasLargeEloJump = useMemo(() => {
    return (
      Math.abs((Number(standardElo) || 1500) - initialStd) >= 250 ||
      Math.abs((Number(rapidElo) || 1500) - initialRap) >= 250 ||
      Math.abs((Number(blitzElo) || 1500) - initialBlz) >= 250
    );
  }, [standardElo, rapidElo, blitzElo, initialStd, initialRap, initialBlz]);

  const handleRequestClose = () => {
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasLargeEloJump && !confirmLargeEloJump) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        displayName,
        fideId,
        ffeId,
        federation,
        club,
        fideTitle,
        birthYear: Number(birthYear) || 2000,
        kFactor,
        standardElo: Number(standardElo) || 1500,
        rapidElo: Number(rapidElo) || 1500,
        blitzElo: Number(blitzElo) || 1500,
        targetElo: Number(targetElo) || 2000,
        twoFactorAuth: profile?.twoFactorAuth,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#131820] border border-[#232C3A] rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-4 sm:p-6 space-y-5 max-h-[92dvh] overflow-y-auto pb-safe">
        <div className="flex items-center justify-between border-b border-[#232C3A] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#F1F4F8] font-display">
              Profil Joueur (FIDE & FFE)
            </h2>
            <p className="text-xs text-[#9BA7B8]">
              Identifiants officiels, facteur K et classements par cadence.
            </p>
          </div>
          <IconButton label="Fermer" variant="ghost" size="sm" onClick={handleRequestClose}>
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        {confirmDiscard && (
          <div className="p-3.5 rounded-xl bg-[#D4A853]/12 border border-[#D4A853]/40 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#F1F4F8] font-semibold">
              <AlertTriangle className="w-4 h-4 text-[#D4A853] shrink-0" />
              <span>Modifications non enregistrées. Quitter sans sauvegarder ?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="px-2.5 py-1 rounded-lg bg-[#19202B] border border-[#2B3647] text-[#CBD5E1] font-semibold cursor-pointer"
              >
                Continuer
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
              >
                Abandonner
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1">
                Nom & Prénom
              </label>
              <input
                type="text"
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1">
                ID FIDE
              </label>
              <input
                type="text"
                maxLength={20}
                value={fideId}
                onChange={(e) => setFideId(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ex: 65104823"
                className="w-full px-3 py-2 font-mono bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1">
                Code FFE
              </label>
              <input
                type="text"
                maxLength={15}
                value={ffeId}
                onChange={(e) => setFfeId(e.target.value.toUpperCase())}
                placeholder="Ex: K59412"
                className="w-full px-3 py-2 font-mono uppercase bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-[#CBD5E1]">
                  Fédération
                </label>
                <FederationFlag code={federation} size="xs" />
              </div>
              <input
                type="text"
                maxLength={4}
                value={federation}
                onChange={(e) => setFederation(e.target.value.toUpperCase())}
                required
                placeholder="FRA ou FIDE"
                className="w-full px-3 py-2 font-mono uppercase bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              />
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#9BA7B8] px-1">
                <FederationFlag code={federation} size="xs" />
                <span className="truncate">
                  {federation === 'FIDE'
                    ? 'FIDE'
                    : POPULAR_FEDERATIONS.find(
                        (f) => f.code === federation.toUpperCase()
                      )?.name || federation}
                </span>
              </div>
            </div>
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1">Titre FIDE</label>
              <select
                value={fideTitle}
                onChange={(e) => setFideTitle(e.target.value as FideTitle)}
                className="w-full px-3 py-2 font-mono bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              >
                {FIDE_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'None' ? 'Aucun titre' : t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1">
                Facteur K FIDE
              </label>
              <select
                value={kFactor}
                onChange={(e) => setKFactor(Number(e.target.value) as 10 | 20 | 40)}
                className="w-full px-3 py-2 font-mono bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
              >
                <option value={40}>K = 40 (Jeunes / &lt; 30 parties)</option>
                <option value={20}>K = 20 (Standard &lt; 2400)</option>
                <option value={10}>K = 10 (2400+ Elo)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#CBD5E1] mb-1">Club d’Échecs</label>
            <input
              type="text"
              maxLength={100}
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="Ex: Lille Université Club Échecs"
              className="w-full px-3 py-2 bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8] focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#232C3A]">
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1">Classique</label>
              <input
                type="number"
                min={800}
                max={3500}
                value={standardElo}
                onChange={(e) => {
                  setStandardElo(Number(e.target.value));
                  setConfirmLargeEloJump(false);
                }}
                className="w-full px-3 py-2 font-mono font-bold bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1">Rapide</label>
              <input
                type="number"
                min={800}
                max={3500}
                value={rapidElo}
                onChange={(e) => {
                  setRapidElo(Number(e.target.value));
                  setConfirmLargeEloJump(false);
                }}
                className="w-full px-3 py-2 font-mono font-bold bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1">Blitz</label>
              <input
                type="number"
                min={800}
                max={3500}
                value={blitzElo}
                onChange={(e) => {
                  setBlitzElo(Number(e.target.value));
                  setConfirmLargeEloJump(false);
                }}
                className="w-full px-3 py-2 font-mono font-bold bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#D4A853] mb-1">Objectif</label>
              <input
                type="number"
                min={800}
                max={3500}
                value={targetElo}
                onChange={(e) => setTargetElo(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold bg-[#19202B] border border-[#D4A853]/40 rounded-xl text-[#D4A853]"
              />
            </div>
          </div>

          {hasLargeEloJump && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#D4A853]/10 border border-[#D4A853]/35 text-xs text-[#F1F4F8] cursor-pointer">
              <input
                type="checkbox"
                checked={confirmLargeEloJump}
                onChange={(e) => setConfirmLargeEloJump(e.target.checked)}
                className="mt-0.5 rounded border-[#323E52] bg-[#19202B] text-emerald-500"
              />
              <span>
                <strong className="text-[#D4A853]">
                  Variation inhabituelle d’Elo détectée (±250 pts ou plus).
                </strong>{' '}
                Cochez pour confirmer qu’il ne s’agit pas d’une faute de frappe.
              </span>
            </label>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="block font-semibold text-[#CBD5E1] mb-1">Année de naissance</label>
              <input
                type="number"
                min={1920}
                max={2025}
                value={birthYear}
                onChange={(e) => setBirthYear(Number(e.target.value))}
                className="w-32 px-3 py-2 font-mono bg-[#19202B] border border-[#2B3647] rounded-xl text-[#F1F4F8]"
              />
            </div>

            <div className="px-3 py-2 rounded-xl bg-[#19202B] border border-[#232C3A] text-[11px]">
              <span className="text-[#9BA7B8]">A2F Microsoft Authenticator : </span>
              {profile?.twoFactorAuth?.enabled && profile?.twoFactorAuth?.secret ? (
                <span className="font-mono font-bold text-emerald-400">Active</span>
              ) : (
                <span className="font-mono font-bold text-[#D4A853]">
                  Non configurée (Paramètres)
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#232C3A]">
            <IconButton label="Annuler" variant="surface" onClick={handleRequestClose}>
              <X className="w-4 h-4" />
            </IconButton>
            <IconButton
              type="submit"
              disabled={isSaving || (hasLargeEloJump && !confirmLargeEloJump)}
              label={isSaving ? 'Enregistrement...' : 'Enregistrer le profil'}
              variant="primary"
            >
              <Check className="w-4 h-4" />
            </IconButton>
          </div>
        </form>
      </div>
    </div>
  );
};

