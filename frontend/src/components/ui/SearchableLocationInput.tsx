import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { LOCATION_SUGGESTIONS } from "../../data/locationSuggestions";
import { cn } from "../../utils/cn";

type SearchableLocationInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  suggestions?: readonly string[];
  maxSuggestions?: number;
};

export function SearchableLocationInput({
  value,
  onChange,
  suggestions = LOCATION_SUGGESTIONS,
  maxSuggestions = 8,
  className,
  onBlur,
  onFocus,
  onKeyDown,
  ...rest
}: SearchableLocationInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    const ranked = suggestions
      .filter((item) => {
        if (!query) return true;
        const lower = item.toLowerCase();
        return lower.includes(query);
      })
      .sort((a, b) => {
        if (!query) return a.localeCompare(b);
        const aStarts = a.toLowerCase().startsWith(query);
        const bStarts = b.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      });

    return ranked.slice(0, Math.max(1, maxSuggestions));
  }, [maxSuggestions, suggestions, value]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <input
        {...rest}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && filtered.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 && activeIndex < filtered.length ? `${listboxId}-opt-${activeIndex}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={(event) => {
          setOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          window.setTimeout(() => setOpen(false), 120);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!filtered.length) return;
            setOpen(true);
            setActiveIndex((prev) => (prev + 1) % filtered.length);
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!filtered.length) return;
            setOpen(true);
            setActiveIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
            return;
          }

          if (event.key === "Enter" && activeIndex >= 0 && activeIndex < filtered.length) {
            event.preventDefault();
            onChange(filtered[activeIndex]);
            setOpen(false);
            setActiveIndex(-1);
            return;
          }

          if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
          }

          onKeyDown?.(event);
        }}
        className={cn(className)}
      />

      {open && filtered.length > 0 ? (
        <div id={listboxId} role="listbox" className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {filtered.map((item, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={item}
                id={`${listboxId}-opt-${index}`}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-[var(--color-accent)]/15 text-text" : "text-text-secondary hover:bg-surface-raised"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(item);
                  setOpen(false);
                  setActiveIndex(-1);
                }}
              >
                {item}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
