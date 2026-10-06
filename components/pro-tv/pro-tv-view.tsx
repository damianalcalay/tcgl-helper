/* eslint-disable @next/next/no-img-element -- Catalogue thumbnails. */
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tv, Play } from "lucide-react";
import type { ProMatch } from "@/lib/pro-tv";
import type { AppData, Match } from "@/types/domain";
import { parseCombatLog } from "@/lib/domain/combat-log";
import {
  saveProMatch,
  deleteProMatch,
  setProTvEnabled,
} from "@/app/pro-tv/actions";
import { CombatLogView } from "@/components/stats/combat-log-view";
import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
const empty: AppData = {
  cards: [],
  decks: [],
  deckCards: [],
  variants: [],
  matches: [],
  rosters: [],
  prizes: [],
};
export function ProTvView({
  matches,
  admin,
  enabled,
}: {
  matches: ProMatch[];
  admin: boolean;
  enabled: boolean;
}) {
  const router = useRouter();
  const [watch, setWatch] = useState<Match | null>(null),
    [draft, setDraft] = useState<Partial<ProMatch> | null>(null),
    [error, setError] = useState("");
  const [pending, start] = useTransition();
  function open(entry: ProMatch) {
    try {
      const log = parseCombatLog(entry.combat_log);
      setWatch({
        id: entry.id,
        deck_id: "",
        opponent_deck_id: null,
        deck_name: entry.deck_name,
        opponent_deck_name: entry.opponent_deck_name,
        result: log.winner === entry.player ? "win" : "loss",
        my_prizes: log.prizesTaken[entry.player],
        opponent_prizes: log.prizesTaken[entry.opponent],
        starter_id: "",
        opponent_starter_id: null,
        played_at: entry.created_at,
        notes: "",
        created_at: entry.created_at,
        updated_at: entry.created_at,
        combat_log: entry.combat_log,
        opponent_combat_log: entry.opponent_combat_log,
        log_player: entry.player,
      });
    } catch {
      setError("Invalid combat log.");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Pro TV</h1>
          <p>Study the decisions behind the match.</p>
        </div>
        {admin && (
          <div className="flex gap-2">
            <Button
              disabled={pending}
              variant="outline"
              onClick={() =>
                start(async () => {
                  const r = await setProTvEnabled(!enabled);
                  if (!r.success) setError(r.error ?? "");
                  else router.refresh();
                })
              }
            >
              {enabled ? "Hide catalogue" : "Launch catalogue"}
            </Button>
            <Button
              onClick={() => {
                setError("");
                setDraft({
                  title: "",
                  player: "",
                  opponent: "",
                  deck_name: "",
                  opponent_deck_name: "",
                  event: "",
                  round: "",
                  game_number: 1,
                  thumbnail: "",
                  combat_log: "",
                  opponent_combat_log: "",
                  published: false,
                });
              }}
            >
              Add match
            </Button>
          </div>
        )}
      </div>
      {admin && !enabled && (
        <p className="field-hint">
          Private preview. Add the initial twelve matches before launching the
          catalogue.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="pro-tv-grid">
        {matches.map((entry) => (
          <article key={entry.id} className="pro-tv-card">
            <button
              className="pro-tv-watch"
              onClick={() => open(entry)}
              aria-label={`Watch ${entry.title}`}
            >
              <div className="pro-tv-thumbnail">
                {entry.thumbnail ? (
                  <img src={entry.thumbnail} alt="" />
                ) : (
                  <Tv size={48} />
                )}
                <span>
                  <Play size={24} />
                </span>
              </div>
              <div>
                <h2>{entry.title}</h2>
                <p>
                  {entry.player} vs {entry.opponent}
                </p>
                <small>
                  {[entry.event, entry.round, `Game ${entry.game_number}`]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                <p>
                  {entry.deck_name} · {entry.opponent_deck_name}
                </p>
              </div>
            </button>
            {admin && (
              <div className="pro-tv-admin">
                <span>{entry.published ? "Published" : "Draft"}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(entry);
                    setError("");
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Delete this catalogue entry?"))
                      start(async () => {
                        const r = await deleteProMatch(entry.id);
                        if (!r.success) setError(r.error ?? "");
                        else router.refresh();
                      });
                  }}
                >
                  Delete
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!matches.length && (
        <div className="empty-state">
          <Tv />
          <p>No matches available yet.</p>
        </div>
      )}
      {watch && (
        <CombatLogView
          publicMatch
          match={watch}
          data={empty}
          onClose={() => setWatch(null)}
        />
      )}
      {draft && (
        <Modal
          wide
          title={draft.id ? "Edit Pro TV match" : "Add Pro TV match"}
          onClose={() => setDraft(null)}
          busy={pending}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveProMatch(draft);
                if (!r.success) setError(r.error ?? "");
                else {
                  setDraft(null);
                  router.refresh();
                }
              });
            }}
          >
            <div className="form-grid">
              {[
                "title",
                "player",
                "opponent",
                "deck_name",
                "opponent_deck_name",
                "event",
                "round",
                "thumbnail",
              ].map((key) => (
                <label key={key} className="field-label">
                  {key.replaceAll("_", " ")}
                  <input
                    required={["title", "player", "opponent"].includes(key)}
                    type={key === "thumbnail" ? "url" : "text"}
                    maxLength={key === "thumbnail" ? 2000 : 150}
                    value={String(draft[key as keyof ProMatch] ?? "")}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label className="field-label">
                Game number
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={draft.game_number}
                  onChange={(e) =>
                    setDraft({ ...draft, game_number: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            {["combat_log", "opponent_combat_log"].map((key) => (
              <label key={key} className="field-label">
                {key === "combat_log"
                  ? "Combat log"
                  : "Complementary combat log (optional)"}
                <textarea
                  required={key === "combat_log"}
                  rows={8}
                  maxLength={200000}
                  value={String(draft[key as keyof ProMatch] ?? "")}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
                <input
                  type="file"
                  accept=".txt,text/plain"
                  aria-label={`Upload ${key}`}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 800000) setError("File too large");
                      else setDraft({ ...draft, [key]: await file.text() });
                    }
                  }}
                />
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) =>
                  setDraft({ ...draft, published: e.target.checked })
                }
              />{" "}
              Published
            </label>
            {error && <p role="alert">{error}</p>}
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save match"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
