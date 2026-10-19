import React, { forwardRef, memo } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'danger' | 'ghost' | 'emerald';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] hover:bg-[color-mix(in_oklch,var(--accent)_88%,var(--bg))] text-[var(--bg)] border border-[var(--accent)] font-semibold shadow-xs',
  secondary:
    'bg-transparent hover:bg-[var(--fg-soft)] text-[var(--fg)] border border-[var(--border)] hover:border-[var(--fg)] font-medium',
  glass:
    'bg-white/6 hover:bg-white/12 active:bg-white/16 text-gray-200 hover:text-white border border-white/10 font-medium',
  danger:
    'bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 text-rose-300 border border-rose-500/35 hover:border-rose-500/50 font-medium',
  ghost:
    'bg-transparent hover:bg-[var(--fg-soft)] text-[var(--muted)] hover:text-[var(--fg)] border border-transparent font-medium',
  emerald:
    'bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/35 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/40 font-medium',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'btn-compact !min-h-0 !min-w-0 h-7 px-2.5 text-xs gap-1.5 rounded-[var(--radius)] leading-none',
  md: 'min-h-[44px] h-11 px-4 text-sm gap-2 rounded-[var(--radius)] font-medium',
  lg: 'min-h-[48px] h-12 px-5 text-sm sm:text-base gap-2.5 rounded-[var(--radius)] font-semibold',
  icon: 'w-11 h-11 min-h-[44px] min-w-[44px] !p-0 rounded-[var(--radius)] shrink-0',
  'icon-sm': 'w-8 h-8 !p-0 rounded-[var(--radius)] shrink-0',
};

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(
    (
      {
        variant = 'primary',
        size = 'md',
        icon,
        iconPosition = 'left',
        isLoading = false,
        disabled,
        children,
        className = '',
        type = 'button',
        ...props
      },
      ref
    ) => {
      const isDisabled = disabled || isLoading;
      const isIconOnly = size === 'icon' || size === 'icon-sm';

      return (
        <button
          ref={ref}
          type={type}
          disabled={isDisabled}
          className={`inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 select-none cursor-pointer active:translate-y-px focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-y-0 ${
            variantStyles[variant]
          } ${sizeStyles[size]} ${className}`}
          {...props}
        >
          {isLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
          ) : icon && iconPosition === 'left' ? (
            <span className="shrink-0 flex items-center justify-center">{icon}</span>
          ) : null}

          {children && (
            isIconOnly ? (
              children
            ) : (
              <span>{children}</span>
            )
          )}

          {!isLoading && icon && iconPosition === 'right' ? (
            <span className="shrink-0 flex items-center justify-center">{icon}</span>
          ) : null}
        </button>
      );
    }
  )
);

Button.displayName = 'Button';
