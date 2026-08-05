'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SelectMenuOption = {
  value: string;
  label: string;
  /** Second line under the label, for counts or categories. */
  hint?: string;
};

type SelectMenuProps = {
  /** Small caption above the trigger, mirroring `.search-field label`. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  /** Shown when `value` matches no option — the "all"/unset reading. */
  placeholder: string;
  /** Renders the caption for screen readers only. */
  hideLabel?: boolean;
  className?: string;
};

/**
 * A listbox replacing the native `<select>`, whose open panel is browser chrome
 * that cannot be styled to match the rest of the app.
 *
 * Native `<select>` gives keyboard and screen-reader behaviour for free, so
 * everything it provided is re-implemented deliberately here: the trigger
 * carries `role="combobox"` with `aria-expanded`/`aria-controls`, the panel is
 * `role="listbox"` with `aria-activedescendant` tracking the highlighted row,
 * and Enter/Space/ArrowUp/ArrowDown/Home/End/Escape/Tab all behave as they do
 * natively. Focus returns to the trigger on close so tab order never jumps.
 *
 * The panel is absolutely positioned rather than portalled, so any ancestor
 * that clips overflow will clip it. Every current caller renders it inside a
 * panel that does not.
 */
export function SelectMenu({
  label,
  value,
  onChange,
  options,
  placeholder,
  hideLabel = false,
  className = '',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(
    (startAt?: number) => {
      setOpen(true);
      // Opening lands on the current selection, as a native select does.
      setActiveIndex(startAt ?? (selectedIndex >= 0 ? selectedIndex : 0));
    },
    [selectedIndex],
  );

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option) return;
      onChange(option.value);
      close(true);
    },
    [close, onChange, options],
  );

  // A click outside is a dismissal, but it must not steal the focus the user
  // just moved elsewhere — so this closes without returning focus.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  // Keeps the highlighted row inside the scroll area on arrow navigation.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (options.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Home':
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!open) openMenu();
        else if (activeIndex >= 0) commit(activeIndex);
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          close(true);
        }
        break;
      case 'Tab':
        // Let focus leave naturally, but do not leave a panel hanging open.
        if (open) close(false);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <span
        id={labelId}
        className={
          hideLabel
            ? 'sr-only'
            : 'mb-1.5 block text-[10px] font-bold uppercase tracking-[.12em] text-muted'
        }
      >
        {label}
      </span>

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} ${baseId}-value`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onKeyDown}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 text-left transition hover:border-violet/40"
      >
        <span id={`${baseId}-value`} className="min-w-0 flex-1 truncate">
          <span className="block truncate text-sm font-bold text-ink">
            {selected ? selected.label : placeholder}
          </span>
          {selected?.hint && (
            <span className="block truncate text-[11px] font-medium text-muted">
              {selected.hint}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          aria-activedescendant={
            activeIndex >= 0 ? `${baseId}-option-${activeIndex}` : undefined
          }
          tabIndex={-1}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[310px] overflow-auto rounded-2xl border border-[#e3daf4] bg-white p-1.5 shadow-[0_20px_55px_rgba(42,24,74,.18)]"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;

            return (
              <li
                key={option.value}
                id={`${baseId}-option-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                // The listbox is driven from the trigger via
                // `aria-activedescendant`, so rows take pointer events only.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                  isSelected
                    ? 'bg-[#efe8ff] font-bold text-[#5b21b6]'
                    : isActive
                      ? 'bg-[#f7f2ff] text-[#5b21b6]'
                      : 'text-[#51485d]'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && (
                    <span className="block truncate text-[11px] text-muted">
                      {option.hint}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <Check aria-hidden className="h-4 w-4 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
