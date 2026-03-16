import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FocusEventHandler } from "react";
import { PHONE_COUNTRIES, getPhoneCountryByCode } from "../../data/phoneCountries";
import { cn } from "../../utils/cn";
import { normalizePhoneInput } from "../../utils/phone";

type PhonePickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  countryCode: string;
  onCountryCodeChange: (countryCode: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
};

export function PhonePickerInput({
  value,
  onChange,
  countryCode,
  onCountryCodeChange,
  required,
  disabled,
  placeholder = "Phone number",
  className,
  inputClassName,
  onBlur,
}: PhonePickerInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selectedCountry = getPhoneCountryByCode(countryCode);

  const filteredCountries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (country) => country.name.toLowerCase().includes(query) || country.code.includes(query)
    );
  }, [search]);

  const visibleActiveIndex = open
    ? Math.min(Math.max(activeIndex, 0), Math.max(filteredCountries.length - 1, 0))
    : -1;

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <span className="flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-2 focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]">
        <button
          type="button"
          className="h-9 min-w-[116px] rounded-md border border-border bg-surface px-2 text-xs text-text"
          onClick={() => setOpen((value) => !value)}
          disabled={disabled}
          aria-label="Select country code"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
        >
          {selectedCountry.name} {selectedCountry.code}
        </button>
        <input
          className={cn("h-full w-full border-0 bg-transparent px-0 text-sm text-text outline-none", inputClassName)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(normalizePhoneInput(event.target.value))}
        />
      </span>

      {open ? (
        <div id={listboxId} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface p-2 shadow-lift">
          <input
            className="input-base mb-2"
            placeholder="Search country or code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search country code"
            onKeyDown={(event) => {
              if (!filteredCountries.length) return;

              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((prev) => (prev + 1) % filteredCountries.length);
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((prev) => (prev <= 0 ? filteredCountries.length - 1 : prev - 1));
                return;
              }

              if (event.key === "Enter" && visibleActiveIndex >= 0) {
                event.preventDefault();
                const selected = filteredCountries[visibleActiveIndex];
                if (!selected) return;
                onCountryCodeChange(selected.code);
                setOpen(false);
                setSearch("");
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                setSearch("");
              }
            }}
          />
          {filteredCountries.map((country, index) => {
            const isActive = index === visibleActiveIndex;
            const optionId = `${listboxId}-opt-${index}`;
            return (
              <button
                key={`${country.name}-${country.code}`}
                id={optionId}
                type="button"
                className={`w-full rounded px-3 py-2 text-left text-sm text-text ${isActive ? "bg-surface-raised" : "hover:bg-surface-raised"}`}
                role="option"
                aria-selected={country.code === selectedCountry.code}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={() => {
                  onCountryCodeChange(country.code);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {country.name} {country.code}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
