import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Trash2, X } from 'lucide-react';

export interface DeleteDetailItem {
  label: string;
  value: string;
}

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  itemName: string;
  details: DeleteDetailItem[];
  warningMessage?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  subtitle,
  itemName,
  details,
  warningMessage,
  onCancel,
  onConfirm,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(3);
      setIsDeleting(false);
      return;
    }

    setSecondsLeft(3);
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
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (secondsLeft > 0 || isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
      <div className="bg-white border border-rose-200 border-t-4 border-t-rose-600 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête de la modale */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {subtitle || 'Cette suppression est définitive et mettra à jour votre JSONBin.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Récapitulatif détaillé de la donnée / ensemble de données à supprimer */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
              Élément ciblé
            </span>
            <span className="text-xs font-extrabold text-slate-900 text-right">
              {itemName}
            </span>
          </div>

          {details.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {details.map((d, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-white border border-slate-200/80 rounded-lg flex flex-col justify-between"
                >
                  <span className="text-[11px] text-slate-500 font-medium">{d.label}</span>
                  <span className="font-mono font-bold text-slate-900 mt-0.5">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {warningMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* Barre de sécurité de 3 secondes */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
              <Clock className="w-3.5 h-3.5 text-rose-600" />
              Sécurité anti-erreur :
            </span>
            <span className="font-mono font-bold text-rose-700">
              {secondsLeft > 0
                ? `Déverrouillage dans ${secondsLeft}s...`
                : 'Bouton déverrouillé — Prêt à confirmer'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              style={{ width: `${((3 - secondsLeft) / 3) * 100}%` }}
              className="h-full bg-rose-600 transition-all duration-700"
            />
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={secondsLeft > 0 || isDeleting}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
              secondsLeft > 0 || isDeleting
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm cursor-pointer'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting
              ? 'Suppression en cours...'
              : secondsLeft > 0
              ? `Confirmer la suppression (${secondsLeft}s)`
              : 'Confirmer la suppression définitive'}
          </button>
        </div>
      </div>
    </div>
  );
};
