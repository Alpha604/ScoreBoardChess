import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'primary' | 'gold' | 'surface' | 'ghost' | 'danger' | 'active';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tooltipPos?: 'top' | 'right' | 'bottom';
  badge?: string | number;
  children: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  variant = 'surface',
  size = 'md',
  tooltipPos = 'top',
  badge,
  className = '',
  children,
  ...props
}) => {
  const sizeClasses = {
    xs: 'w-7 h-7 rounded-lg',
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-11 h-11 rounded-xl',
  }[size];

  const variantClasses = {
    primary:
      'bg-emerald-500 text-[#06130E] hover:bg-emerald-400 border border-emerald-400/50 shadow-xs',
    gold:
      'bg-[#D4A853] text-[#141007] hover:bg-[#E0B866] border border-[#E5C178]/50 shadow-xs',
    surface:
      'bg-[#19202B] text-[#CBD5E1] hover:text-white hover:bg-[#222B3A] border border-[#2B3647]',
    ghost:
      'bg-transparent text-[#94A3B8] hover:text-white hover:bg-[#1E2633] border border-transparent',
    danger:
      'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 border border-rose-500/25',
    active:
      'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  }[variant];

  return (
    <button
      type={props.type || 'button'}
      aria-label={label}
      data-tooltip={label}
      data-tooltip-pos={tooltipPos === 'top' ? undefined : tooltipPos}
      className={`relative inline-flex items-center justify-center shrink-0 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
      {badge !== undefined && badge !== '' && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#D4A853] text-[#0B0E12] text-[10px] font-mono font-bold leading-none inline-flex items-center justify-center border border-[#0B0E12]">
          {badge}
        </span>
      )}
    </button>
  );
};
