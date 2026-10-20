/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { getFederationInfo } from '../utils/federationFlags';

interface FederationFlagProps {
  code: string | undefined | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCode?: boolean;
  showName?: boolean;
  className?: string;
  title?: string;
}

/**
 * Drapeau officiel vectoriel de la FIDE (Fédération Internationale des Échecs)
 * Fond bleu marine #0a2f64 avec globe, cavalier d'échecs blanc/or et inscription FIDE.
 */
export const FideFlagSVG: React.FC<{ className?: string; width?: number; height?: number }> = ({
  className = '',
  width = 24,
  height = 16,
}) => {
  return (
    <svg
      viewBox="0 0 48 32"
      width={width}
      height={height}
      className={`shrink-0 rounded-xs border border-blue-900/40 shadow-2xs ${className}`}
      title="Fédération Internationale des Échecs (FIDE)"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fond bleu officiel FIDE */}
      <rect width="48" height="32" fill="#002b7f" rx="1.5" />

      {/* Rayons et globe terrestre stylisé */}
      <circle cx="24" cy="16" r="10.5" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.8" />
      <ellipse cx="24" cy="16" rx="5.5" ry="10.5" fill="none" stroke="#ffffff" strokeWidth="0.6" opacity="0.6" />
      <line x1="13.5" y1="16" x2="34.5" y2="16" stroke="#ffffff" strokeWidth="0.6" opacity="0.6" />
      <line x1="16" y1="11" x2="32" y2="11" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />
      <line x1="16" y1="21" x2="32" y2="21" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />

      {/* Silhouette du Cavalier d'échecs (symbole FIDE) */}
      <path
        d="M22 10 C21 11 20 12.5 20 14 C19 14.5 18 15 18 16 C18 17 19.5 17 20 16.5 C20 18 21.5 19 23 19.5 L22 22 L26 22 L25.5 19.5 C27 18.5 28 17 28 14.5 C28 11.5 25.5 9.5 23.5 9.5 C22.8 9.5 22.3 9.8 22 10 Z"
        fill="#f8fafc"
      />
      {/* Œil du cavalier */}
      <circle cx="22.2" cy="12.5" r="0.6" fill="#002b7f" />

      {/* Banderole FIDE */}
      <rect x="15" y="23" width="18" height="6.5" rx="1" fill="#ffffff" />
      <text
        x="24"
        y="28"
        textAnchor="middle"
        fontSize="5"
        fontWeight="bold"
        fontFamily="sans-serif"
        fill="#002b7f"
        letterSpacing="0.6"
      >
        FIDE
      </text>
    </svg>
  );
};

export const FederationFlag: React.FC<FederationFlagProps> = ({
  code,
  size = 'sm',
  showCode = false,
  showName = false,
  className = '',
  title,
}) => {
  const [imgError, setImgError] = useState(false);
  const info = getFederationInfo(code);

  React.useEffect(() => {
    setImgError(false);
  }, [code]);

  const dimensions = {
    xs: { width: 18, height: 12, text: 'text-[10px]' },
    sm: { width: 22, height: 15, text: 'text-xs' },
    md: { width: 28, height: 19, text: 'text-sm' },
    lg: { width: 36, height: 24, text: 'text-base' },
  }[size];

  const tooltip = title || `${info.name} (${info.code})`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 align-middle select-none ${className}`}
      title={tooltip}
    >
      {/* Affichage du drapeau */}
      {info.isFide ? (
        <FideFlagSVG width={dimensions.width} height={dimensions.height} />
      ) : info.iso2 && !imgError ? (
        <img
          src={`https://flagcdn.com/${info.iso2.toLowerCase()}.svg`}
          alt={`Drapeau ${info.name}`}
          width={dimensions.width}
          height={dimensions.height}
          loading="lazy"
          onError={() => setImgError(true)}
          className="shrink-0 rounded-xs object-cover border border-slate-300/80 shadow-2xs"
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        />
      ) : (
        <span
          className="shrink-0 inline-flex items-center justify-center font-emoji leading-none"
          style={{ fontSize: `${dimensions.height + 2}px` }}
        >
          {info.emoji}
        </span>
      )}

      {/* Code optionnel (ex: FRA, FIDE) */}
      {showCode && (
        <span className={`font-mono font-bold uppercase text-slate-800 ${dimensions.text}`}>
          {info.code}
        </span>
      )}

      {/* Nom complet optionnel (ex: France) */}
      {showName && (
        <span className={`text-slate-700 font-medium ${dimensions.text}`}>
          {info.name}
        </span>
      )}
    </span>
  );
};
