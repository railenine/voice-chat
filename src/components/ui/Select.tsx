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
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => {
        const next = !prev;
        if (next && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceAbove = rect.top;
          setOpenUpwards(spaceBelow < 180 && spaceAbove > spaceBelow);
        }
        return next;
      });
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
    <div
      ref={containerRef}
      className={`relative w-full min-w-0 ${isOpen ? 'z-30' : 'z-10'} ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full min-w-0 flex items-center justify-between text-left bg-(--bg) hover:bg-(--elevated)/40 focus:bg-(--bg) border border-(--border) focus:border-(--accent) rounded-(--radius) text-(--fg) text-xs focus:outline-none transition-colors cursor-pointer select-none ${
          compact ? 'py-1.5 px-2.5' : 'py-2 px-3'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="truncate pr-2 font-medium min-w-0 flex-1">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-(--muted) shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-(--accent)' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute ${
            openUpwards ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'
          } left-0 right-0 max-h-52 overflow-y-auto custom-scrollbar bg-(--surface) border border-(--border) rounded-(--radius) shadow-xl z-50 p-1 space-y-0.5 animate-fade-in`}
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
                    ? 'bg-(--accent-soft) text-(--accent) font-semibold'
                    : 'text-(--fg) hover:bg-(--fg-soft) hover:text-(--accent)'
                }`}
              >
                <span className="truncate mr-2">{opt.label}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-(--accent) shrink-0" />
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
