import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Trash2, X } from 'lucide-react';
import { IconButton } from './IconButton';

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
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#131820] border border-rose-500/35 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-5 max-h-[92dvh] overflow-y-auto pb-safe">
        <div className="flex items-start justify-between gap-3 border-b border-[#232C3A] pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F1F4F8] font-display">{title}</h3>
              <p className="text-xs text-[#9BA7B8] mt-0.5">
                {subtitle || 'Cette suppression mettra à jour votre JSONBin.'}
              </p>
            </div>
          </div>
          <IconButton
            label="Fermer"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isDeleting}
          >
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        <div className="p-4 bg-[#19202B] border border-[#232C3A] rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#232C3A] pb-2">
            <span className="text-xs font-semibold text-rose-400">
              Élément ciblé
            </span>
            <span className="text-xs font-bold text-[#F1F4F8] text-right">
              {itemName}
            </span>
          </div>

          {details.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {details.map((d, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-[#131820] border border-[#232C3A] rounded-lg flex flex-col justify-between"
                >
                  <span className="text-[11px] text-[#9BA7B8]">{d.label}</span>
                  <span className="font-mono font-semibold text-[#F1F4F8] mt-0.5">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {warningMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs font-medium text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{warningMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-[#9BA7B8]">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              Sécurité anti-erreur
            </span>
            <span className="font-mono font-semibold text-rose-300">
              {secondsLeft > 0 ? `${secondsLeft}s` : 'Prêt'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#19202B] rounded-full overflow-hidden">
            <div
              style={{ width: `${((3 - secondsLeft) / 3) * 100}%` }}
              className="h-full bg-rose-500 transition-all duration-700"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#232C3A]">
          <IconButton
            label="Annuler"
            variant="surface"
            onClick={onCancel}
            disabled={isDeleting}
          >
            <X className="w-4 h-4" />
          </IconButton>

          <IconButton
            label={
              isDeleting
                ? 'Suppression en cours...'
                : secondsLeft > 0
                ? `Déverrouillage dans ${secondsLeft}s`
                : 'Confirmer la suppression définitive'
            }
            variant="danger"
            onClick={handleConfirmClick}
            disabled={secondsLeft > 0 || isDeleting}
            className="w-11"
          >
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};
