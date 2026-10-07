"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { ChoiceSelect } from "./choice-select";
export interface Option {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}
type ComboboxProps = {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
};
export function RegexCombobox(props: ComboboxProps) {
  const numeric = props.options.every(
    (o) => /^\d+(?:\.\d+)?$/.test(o.value) || o.value.toLowerCase() === "all",
  );
  return props.options.length <= 6 || numeric ? (
    <div className="combobox">
      <ChoiceSelect {...props} />
    </div>
  ) : (
    <SearchableRegexCombobox {...props} />
  );
}
function SearchableRegexCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  clearable = false,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ids, setIds] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const uid = useId();
  const optionKey = JSON.stringify(
    options.map((o) => ({ value: o.value, label: o.label })),
  );
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    search.current?.focus();
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const worker = new Worker("/regex-worker.js");
    let timeout: ReturnType<typeof setTimeout>;
    const debounce = setTimeout(() => {
      setLoading(true);
      setError("");
      worker.onmessage = (
        e: MessageEvent<{ ids: string[]; error?: string }>,
      ) => {
        clearTimeout(timeout);
        setIds(e.data.ids);
        setError(e.data.error ?? "");
        setLoading(false);
        setActive(0);
        worker.terminate();
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        setError("Search is unavailable. Please try again.");
        setIds([]);
        setLoading(false);
        worker.terminate();
      };
      worker.postMessage({ options: JSON.parse(optionKey), query });
      timeout = setTimeout(() => {
        worker.terminate();
        setIds([]);
        setError("This expression is too complex. Try a simpler pattern.");
        setLoading(false);
      }, 750);
    }, 100);
    return () => {
      clearTimeout(debounce);
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [open, query, optionKey]);
  const filtered = options.filter((o) => ids === null || ids.includes(o.value));
  const pick = (option: Option) => {
    if (!option.disabled) {
      onChange(option.value);
      setOpen(false);
      setQuery("");
      setIds(null);
      root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  };
  return (
    <div className="combobox" ref={root}>
      <span className="field-label" id={`${uid}-label`}>
        {label}
      </span>
      <Button
        variant="ghost"
        type="button"
        className="combo-trigger"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-labelledby={`${uid}-label`}
        onClick={() => {
          if (!open) {
            setQuery("");
            setIds(null);
            setError("");
            setLoading(false);
            setActive(0);
          }
          setOpen(!open);
        }}
      >
        <span className={value ? "" : "text-muted-foreground"}>
          {options.find((o) => o.value === value)?.label ?? placeholder}
        </span>
        <ChevronsUpDown size={15} />
      </Button>
      {open && (
        <div className="combo-popover">
          <div className="combo-search">
            <Search size={15} />
            <input
              ref={search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIds([]);
              }}
              placeholder="Search with regex…"
              aria-label={`Search ${label}`}
              role="searchbox"
              aria-controls={`${uid}-list`}
              aria-activedescendant={
                filtered[active] ? `${uid}-option-${active}` : undefined
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, filtered.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[active]) pick(filtered[active]);
                }
              }}
            />
          </div>
          <div className="combo-hint">
            Case-insensitive regex · try <code>ex$</code> or{" "}
            <code>basic|item</code>
          </div>
          {error && (
            <p role="alert" className="px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div
            role="listbox"
            id={`${uid}-list`}
            aria-label={label}
            className="combo-options"
          >
            {clearable && (
              <Button
                variant="ghost"
                type="button"
                className="combo-option"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <X size={14} />
                Clear selection
              </Button>
            )}
            {loading ? (
              <p className="p-3 text-sm text-muted-foreground">Searching…</p>
            ) : filtered.length ? (
              filtered.map((o, i) => (
                <Button
                  variant="ghost"
                  type="button"
                  key={o.value}
                  id={`${uid}-option-${i}`}
                  role="option"
                  aria-selected={value === o.value}
                  disabled={o.disabled}
                  className={`combo-option ${active === i ? "bg-muted" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                >
                  <span>
                    <span>{o.label}</span>
                    {o.description && <small>{o.description}</small>}
                  </span>
                  {value === o.value && <Check size={16} />}
                </Button>
              ))
            ) : (
              !error && (
                <p className="p-3 text-sm text-muted-foreground">
                  No matching options.
                </p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
