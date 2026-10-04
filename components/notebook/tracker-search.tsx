"use client";
import { useEffect, useId, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardOption } from "@/types/domain";
export function TrackerSearch({
  cards,
  onResults,
}: {
  cards: CardOption[];
  onResults: (ids: string[] | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const id = useId();
  const options = JSON.stringify(
    cards.map((c) => ({ value: c.id, label: c.name })),
  );
  useEffect(() => {
    const worker = new Worker("/regex-worker.js");
    let timeout: ReturnType<typeof setTimeout>;
    const debounce = setTimeout(() => {
      setPending(true);
      setError("");
      worker.onmessage = (
        event: MessageEvent<{ ids: string[]; error?: string }>,
      ) => {
        clearTimeout(timeout);
        onResults(event.data.ids);
        setError(event.data.error ?? "");
        setPending(false);
        worker.terminate();
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        onResults([]);
        setError("Search is unavailable. Please try again.");
        setPending(false);
        worker.terminate();
      };
      worker.postMessage({ options: JSON.parse(options), query });
      timeout = setTimeout(() => {
        worker.terminate();
        onResults([]);
        setError("This expression is too complex. Try a simpler pattern.");
        setPending(false);
      }, 750);
    }, 100);
    return () => {
      clearTimeout(debounce);
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [query, options, onResults]);
  return (
    <div className="tracker-search">
      <label htmlFor={id} className="field-label">
        Search card names
      </label>
      <div className="flex items-center gap-2">
        <Search size={16} className="text-muted-foreground" />
        <Input
          id={id}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onResults(null);
          }}
          placeholder="Search by name or regex, e.g. basic|item"
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-feedback`}
        />
        {query && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              setQuery("");
              onResults(null);
            }}
            aria-label="Clear card search"
          >
            <X />
          </Button>
        )}
      </div>
      <p
        id={`${id}-feedback`}
        role={error ? "alert" : undefined}
        className={error ? "text-xs text-destructive mt-2" : "field-hint"}
      >
        {error ||
          (pending
            ? "Searching…"
            : "Case-insensitive regex. Filtering keeps every copy state and deck total intact.")}
      </p>
    </div>
  );
}
