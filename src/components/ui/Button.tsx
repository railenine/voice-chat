import React, { forwardRef, memo } from 'react';

export type ButtonVariant = 'primary' | 'glass' | 'danger' | 'ghost' | 'emerald';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-linear-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white font-bold border border-blue-500/40 shadow-lg shadow-blue-900/50 hover:shadow-blue-900/70 active:scale-[0.98]',
  glass:
    'bg-white/6 hover:bg-white/12 active:bg-white/16 text-gray-200 hover:text-white border border-white/10 active:scale-[0.98]',
  danger:
    'bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 text-red-300 border border-red-500/40 active:scale-[0.98]',
  ghost:
    'bg-transparent hover:bg-white/8 active:bg-white/12 text-gray-400 hover:text-white border-transparent',
  emerald:
    'bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/40 active:scale-[0.98]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'btn-compact !min-h-0 !min-w-0 h-6 px-2 text-[11px] gap-1.5 rounded-md leading-none',
  md: 'h-9 px-3.5 text-xs sm:text-sm gap-2 rounded-xl',
  lg: 'h-11 sm:h-12 px-5 text-xs sm:text-sm gap-2.5 rounded-xl font-bold',
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

      return (
        <button
          ref={ref}
          type={type}
          disabled={isDisabled}
          className={`inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 ${
            variantStyles[variant]
          } ${sizeStyles[size]} ${className}`}
          {...props}
        >
          {isLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
          ) : icon && iconPosition === 'left' ? (
            <span className="shrink-0 flex items-center justify-center">{icon}</span>
          ) : null}

          {children && <span>{children}</span>}

          {!isLoading && icon && iconPosition === 'right' ? (
            <span className="shrink-0 flex items-center justify-center">{icon}</span>
          ) : null}
        </button>
      );
    }
  )
);

Button.displayName = 'Button';
