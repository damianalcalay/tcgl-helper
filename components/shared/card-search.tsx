"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoaderCircle, Search } from "lucide-react";

export function CardSearch({
  onSelect,
  disabled = false,
}: {
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [cards, setCards] = useState<{ id: string; name: string }[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open || !query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      setCards([]);
      try {
        const r = await fetch(
          `/api/card-catalog?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        if (!controller.signal.aborted) setCards(j.cards);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);
  return (
    <div className="card-search">
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Search />
        Add a Standard card
      </Button>
      {open && (
        <div className="card-search-results">
          <Input
            autoFocus
            aria-label="Search Standard cards"
            placeholder="Card name or regex…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCards([]);
              setError("");
              setLoading(Boolean(e.target.value.trim()));
            }}
          />
          {!query.trim() ? (
            <small>Type a card name or a regular expression.</small>
          ) : loading ? (
            <span role="status">
              <LoaderCircle className="animate-spin" />
              Searching…
            </span>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : (
            <div role="listbox" aria-label="Standard cards">
              {cards.map((c) => (
                <Button
                  role="option"
                  aria-selected={false}
                  variant="ghost"
                  key={c.id}
                  disabled={disabled}
                  onClick={() => {
                    onSelect(c.id);
                    setOpen(false);
                  }}
                >
                  {c.name} · {c.id}
                </Button>
              ))}
              {!cards.length && <small>No matching cards.</small>}
              {cards.length === 80 && (
                <small>
                  Showing the first 80 matches. Refine your search to see more.
                </small>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
