import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  compact?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = memo(({
  value,
  onChange,
  options,
  compact = false,
  disabled = false,
  placeholder = 'Выберите...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleSelect = useCallback((val: string) => {
    onChange(val);
    setIsOpen(false);
  }, [onChange]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between text-left bg-[var(--surface)] hover:bg-[var(--elevated)] focus:bg-[var(--elevated)] border border-[var(--border)] focus:border-[var(--accent)] rounded-[var(--radius)] text-[var(--fg)] text-xs focus:outline-none transition-colors cursor-pointer select-none ${
          compact ? 'py-1.5 px-2.5' : 'py-2 px-3'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="truncate pr-2 font-medium">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--muted)] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--accent)]' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute top-[calc(100%+4px)] left-0 right-0 max-h-52 overflow-y-auto custom-scrollbar bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-xl z-50 p-1 space-y-0.5 animate-fade-in"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[calc(var(--radius)-2px)] text-xs text-left cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                    : 'text-[var(--fg)] hover:bg-[var(--fg-soft)] hover:text-[var(--accent)]'
                }`}
              >
                <span className="truncate mr-2">{opt.label}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

Select.displayName = 'Select';
