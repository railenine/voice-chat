import React, { forwardRef, memo } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'danger' | 'ghost' | 'emerald' | 'success' | 'accent';
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
    'bg-(--accent) hover:bg-[color-mix(in_oklch,var(--accent)_88%,var(--bg))] text-(--bg) border border-(--accent) font-semibold shadow-xs',
  secondary:
    'bg-transparent hover:bg-(--fg-soft) text-(--fg) border border-(--border) hover:border-(--fg) font-medium',
  glass:
    'bg-(--fg-soft) hover:bg-[color-mix(in_oklch,var(--fg)_12%,transparent)] active:bg-[color-mix(in_oklch,var(--fg)_18%,transparent)] text-(--fg) border border-(--border) font-medium',
  danger:
    'bg-(--danger-soft) hover:bg-[color-mix(in_oklch,var(--danger)_22%,transparent)] active:bg-[color-mix(in_oklch,var(--danger)_30%,transparent)] text-(--danger) border border-(--danger-border) hover:border-(--danger)/50 font-medium',
  ghost:
    'bg-transparent hover:bg-(--fg-soft) text-(--muted) hover:text-(--fg) border border-transparent font-medium',
  emerald:
    'bg-(--success-soft) hover:bg-[color-mix(in_oklch,var(--success)_22%,transparent)] active:bg-[color-mix(in_oklch,var(--success)_30%,transparent)] text-(--success) border border-(--success-border) hover:border-(--success)/50 font-medium',
  success:
    'bg-(--success-soft) hover:bg-[color-mix(in_oklch,var(--success)_22%,transparent)] active:bg-[color-mix(in_oklch,var(--success)_30%,transparent)] text-(--success) border border-(--success-border) hover:border-(--success)/50 font-medium',
  accent:
    'bg-(--accent-soft) hover:bg-[color-mix(in_oklch,var(--accent)_22%,transparent)] active:bg-[color-mix(in_oklch,var(--accent)_30%,transparent)] text-(--accent) border border-(--accent)/30 hover:border-(--accent)/50 font-medium',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'btn-compact min-h-0! min-w-0! h-7 px-2.5 text-xs gap-1.5 rounded-(--radius) leading-none',
  md: 'min-h-11 h-11 px-4 text-sm gap-2 rounded-(--radius) font-medium',
  lg: 'min-h-12 h-12 px-5 text-sm sm:text-base gap-2.5 rounded-(--radius) font-semibold',
  icon: 'w-11 h-11 min-h-11 min-w-11 p-0! rounded-(--radius) shrink-0',
  'icon-sm': 'w-8 h-8 p-0! rounded-(--radius) shrink-0 touch-manipulation relative after:absolute after:-inset-1.5 after:content-[\'\']',
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
          className={`inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 select-none cursor-pointer active:translate-y-px focus:outline-none focus-visible:outline-2 focus-visible:outline-(--accent) focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-y-0 ${
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
