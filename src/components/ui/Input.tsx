import React, { forwardRef, memo } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  align?: 'left' | 'center';
  inputSize?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  mono?: boolean;
}

const sizeClasses = {
  sm: 'h-8 py-1.5 px-3 text-xs rounded-[var(--radius)]',
  md: 'min-h-[44px] h-11 py-2 sm:py-2.5 px-3.5 sm:px-4 text-base sm:text-sm rounded-[var(--radius)]',
  lg: 'min-h-[48px] h-12 py-2.5 sm:py-3 px-4 text-base sm:text-lg font-bold rounded-[var(--radius)]',
};

export const Input = memo(
  forwardRef<HTMLInputElement, InputProps>(
    (
      {
        align = 'left',
        inputSize = 'md',
        leftIcon,
        rightElement,
        mono = false,
        className = '',
        disabled,
        ...props
      },
      ref
    ) => {
      const textAlign = align === 'center' ? 'text-center' : 'text-left';
      const fontStyle = mono ? 'font-mono' : 'font-sans';

      return (
        <div className="relative w-full flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--muted)]">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            disabled={disabled}
            className={`w-full bg-[var(--surface)] hover:bg-[color-mix(in_oklch,var(--surface)_90%,var(--fg))] focus:bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1 text-[var(--fg)] placeholder:text-[var(--muted)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : ''
            } ${rightElement ? 'pr-10' : ''} ${textAlign} ${fontStyle} ${
              sizeClasses[inputSize]
            } ${className}`}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-2.5 flex items-center justify-center">
              {rightElement}
            </div>
          )}
        </div>
      );
    }
  )
);

Input.displayName = 'Input';
