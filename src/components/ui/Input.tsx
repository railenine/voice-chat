import React, { forwardRef, memo } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  align?: 'left' | 'center';
  inputSize?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  mono?: boolean;
}

const sizeClasses = {
  sm: 'py-1.5 px-2.5 text-xs rounded-lg',
  md: 'py-2 sm:py-2.5 px-3 sm:px-4 text-xs sm:text-sm rounded-xl',
  lg: 'py-2.5 sm:py-3 px-4 text-base sm:text-lg font-bold rounded-xl',
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
            <div className="absolute left-3 flex items-center justify-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            disabled={disabled}
            className={`w-full bg-black/30 hover:bg-black/40 focus:bg-black/50 border border-white/10 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 text-white placeholder:text-gray-500 focus:outline-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-9' : ''
            } ${rightElement ? 'pr-9' : ''} ${textAlign} ${fontStyle} ${
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
