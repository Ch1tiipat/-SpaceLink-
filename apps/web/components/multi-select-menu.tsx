'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { SelectMenuOption } from '@/components/select-menu';

type MultiSelectMenuProps = {
  /** Small caption above the trigger, mirroring `SelectMenu`. */
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: SelectMenuOption[];
  /** Shown when nothing is selected. */
  placeholder: string;
  hideLabel?: boolean;
  className?: string;
  /** Marks the trigger invalid for assistive technology. */
  invalid?: boolean;
  /** Id of the message describing that invalid state. */
  describedBy?: string;
};

/**
 * The multi-select sibling of `SelectMenu`, for fields like a shop's product
 * categories where more than one option is a normal answer.
 *
 * It is a separate component rather than a mode on `SelectMenu`. Almost every
 * decision inside a listbox depends on whether it is single- or multi-select —
 * the value is a string or an array, a row commits or toggles, committing
 * closes the panel or leaves it open, the indicator is one checkmark or a
 * checkbox per row — so a `multiple` flag would branch in each of those places
 * *and* force the props into a discriminated union that TypeScript can only
 * narrow through `props.multiple` accesses, which reads far worse in JSX. Two
 * focused components cost some repeated open/close scaffolding and keep both
 * readable; the existing single-select callers are untouched either way.
 *
 * The accessibility contract matches `SelectMenu`: the trigger is a
 * `role="combobox"` with `aria-expanded`/`aria-controls`, the panel is a
 * `role="listbox"` — here also `aria-multiselectable` — with
 * `aria-activedescendant` tracking the highlighted row, and
 * ArrowUp/ArrowDown/Home/End/Escape/Tab behave as they do natively. Enter and
 * Space toggle the highlighted row and deliberately leave the panel open, since
 * picking several options is the whole point; only an outside click, Escape or
 * Tab closes it.
 *
 * The panel is absolutely positioned rather than portalled, so an ancestor that
 * clips overflow will clip it.
 */
export function MultiSelectMenu({
  label,
  value,
  onChange,
  options,
  placeholder,
  hideLabel = false,
  className = '',
  invalid = false,
  describedBy,
}: MultiSelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;

  const selectedOptions = options.filter((option) =>
    value.includes(option.value),
  );

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
    // Opening lands on the first selected row, or the top of the list.
    const firstSelected = options.findIndex((option) =>
      value.includes(option.value),
    );
    setActiveIndex(firstSelected >= 0 ? firstSelected : 0);
  }, [options, value]);

  const toggle = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option) return;
      onChange(
        value.includes(option.value)
          ? value.filter((current) => current !== option.value)
          : [...value, option.value],
      );
    },
    [onChange, options, value],
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
        // Space would scroll the page and Enter would submit the surrounding
        // form; neither is what pressing a listbox row means.
        event.preventDefault();
        if (!open) openMenu();
        else if (activeIndex >= 0) toggle(activeIndex);
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
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center gap-2.5 rounded-xl border bg-white px-4 py-3 text-left transition hover:border-violet/40 ${
          invalid ? 'border-danger' : 'border-line'
        }`}
      >
        <span id={`${baseId}-value`} className="min-w-0 flex-1 truncate">
          <span className="block truncate text-sm font-bold text-ink">
            {selectedOptions.length > 0
              ? selectedOptions.map((option) => option.label).join(', ')
              : placeholder}
          </span>
          {selectedOptions.length > 0 && (
            <span className="block truncate text-[11px] font-medium text-muted">
              เลือกแล้ว {selectedOptions.length} รายการ
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
          aria-multiselectable
          aria-labelledby={labelId}
          aria-activedescendant={
            activeIndex >= 0 ? `${baseId}-option-${activeIndex}` : undefined
          }
          tabIndex={-1}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[310px] overflow-auto rounded-2xl border border-[#e3daf4] bg-white p-1.5 shadow-[0_20px_55px_rgba(42,24,74,.18)]"
        >
          {options.map((option, index) => {
            const isSelected = value.includes(option.value);
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
                onClick={() => toggle(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                  isSelected
                    ? 'bg-[#efe8ff] font-bold text-[#5b21b6]'
                    : isActive
                      ? 'bg-[#f7f2ff] text-[#5b21b6]'
                      : 'text-[#51485d]'
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition ${
                    isSelected
                      ? 'border-violet bg-violet text-white'
                      : 'border-line bg-white'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && (
                    <span className="block truncate text-[11px] text-muted">
                      {option.hint}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
