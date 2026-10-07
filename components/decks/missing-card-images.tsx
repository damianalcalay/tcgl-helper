/* eslint-disable @next/next/no-img-element -- Local upload previews and original card art. */
"use client";
import { useEffect, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceSelect } from "@/components/shared/choice-select";

interface Entry {
  id: string;
  name: string;
  localId: string;
  image?: string;
  manual?: boolean;
}
function UploadCard({
  card,
  onUploaded,
}: {
  card: Entry;
  onUploaded: (image: string) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function upload(file?: File) {
    if (!file || busy) return;
    if (
      file.size > 8 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setError("PNG, JPEG, or WebP · up to 8 MB");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("id", card.id);
      form.set("file", file);
      const response = await fetch("/api/card-art", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onUploaded(result.image);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article
      className="panel missing-art-card"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void upload(e.dataTransfer.files[0]);
      }}
    >
      <strong>{card.name}</strong>
      <small>
        {card.id} · #{card.localId}
      </small>
      {(preview || card.image) && (
        <img src={preview || card.image} alt={card.name} />
      )}
      <label className="art-drop">
        <ImagePlus />
        <span>
          {busy
            ? "Uploading…"
            : card.manual
              ? "Image saved · replace image"
              : "Drop an image or choose a file"}
        </span>
        <input
          aria-label={`Upload ${card.name} ${card.id}`}
          disabled={busy}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
export function MissingCardImages() {
  const [sets, setSets] = useState<{ id: string; name: string }[]>([]),
    [set, setSet] = useState(""),
    [cards, setCards] = useState<Entry[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [progress, setProgress] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/card-catalog?sets", { signal: abort.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setSets(j.sets);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [retry]);
  useEffect(() => {
    if (!set) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setCards([]);
    fetch(`/api/card-catalog?set=${encodeURIComponent(set)}`, {
      signal: abort.signal,
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        const entries = j.cards as Entry[];
        let unverified = 0;
        for (let i = 0; i < entries.length; i += 12) {
          setProgress(`${i} / ${entries.length}`);
          const response = await fetch("/api/card-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ids: entries.slice(i, i + 12).map((c) => c.id),
            }),
            signal: abort.signal,
          });
          const checked = await response.json();
          if (!response.ok) throw new Error(checked.error);
          if (abort.signal.aborted) return;
          const missing = new Set(
            checked.cards
              .filter((c: { status: string }) => c.status === "missing")
              .map((c: { id: string }) => c.id),
          );
          unverified += checked.cards.filter(
            (c: { status: string }) => c.status === "unverified",
          ).length;
          setCards((current) => [
            ...current,
            ...entries
              .slice(i, i + 12)
              .filter((c) => missing.has(c.id))
              .map((c) => ({ ...c, image: undefined })),
          ]);
        }
        if (unverified)
          setError(
            `${unverified} images could not be verified because the source is unavailable. Retry to check them; they are not listed as missing.`,
          );
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [set, retry]);
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">SHARED CARD ART</p>
        <h1>Missing images</h1>
        <p>
          Current Standard expansions, newest first. Choose a set to complete
          its missing card images. Saved images are shared across the app.
        </p>
      </div>
      {sets[0] && (
        <p className="field-hint">Latest available expansion: {sets[0].name}</p>
      )}
      <div className="flex gap-3 items-end">
        <ChoiceSelect
          label="Expansion"
          value={set}
          onChange={setSet}
          options={sets.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Button
          variant="outline"
          aria-label="Retry image catalog"
          onClick={() => setRetry((v) => v + 1)}
        >
          <RefreshCw />
        </Button>
      </div>
      {loading && <p role="status">Checking set images… {progress}</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && set && !error && (
        <p role="status">
          {cards.filter((c) => !c.manual).length} missing images · PNG, JPEG,
          WebP · 8 MB per image
        </p>
      )}
      <div className="missing-art-grid">
        {cards.map((c) => (
          <UploadCard
            key={c.id}
            card={c}
            onUploaded={(image) =>
              setCards((rows) =>
                rows.map((row) =>
                  row.id === c.id ? { ...row, image, manual: true } : row,
                ),
              )
            }
          />
        ))}
      </div>
    </>
  );
}
