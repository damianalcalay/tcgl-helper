"use client";
import { useState } from "react";
import { AppData, Match } from "@/types/domain";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RegexCombobox } from "@/components/shared/regex-combobox";
export function MatchHistory({
  matches,
  data,
  onEdit,
  onDelete,
}: {
  matches: Match[];
  data: AppData;
  onEdit: (m: Match) => void;
  onDelete: (m: Match) => void;
}) {
  const [size, setSize] = useState("10");
  const [page, setPage] = useState(0);
  const count = size === "all" ? matches.length : Number(size);
  const maxPage = Math.max(0, Math.ceil(matches.length / count) - 1);
  const current = Math.min(page, maxPage);
  const displayed = matches.slice(current * count, (current + 1) * count);
  function cardName(match: Match, cardId: string, side: "mine" | "opponent") {
    return (
      data.rosters.find(
        (r) =>
          r.match_id === match.id && r.card_id === cardId && r.side === side,
      )?.card_name ?? "Unavailable card"
    );
  }
  return (
    <div className="match-history">
      <div className="history-heading">
        <div>
          <h3>Match history</h3>
          <p>Most recent first · times shown in Atlantic/Canary</p>
        </div>
        <RegexCombobox
          label="Entries per page"
          options={["10", "25", "50", "100", "all"].map((v) => ({
            value: v,
            label: v === "all" ? "All" : v,
          }))}
          value={size}
          onChange={(v) => {
            setSize(v);
            setPage(0);
          }}
        />
      </div>
      <div className="table-scroll">
        <table className="data-table history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Your deck / opponent</th>
              <th>Result</th>
              <th>Prizes taken</th>
              <th>Starters</th>
              <th>Opening prize cards</th>
              <th>Notes</th>
              <th className="history-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((m) => {
              const prizes = data.prizes
                .filter((p) => p.match_id === m.id)
                .sort((a, b) => a.slot - b.slot);
              const counts = new Map<string, number>();
              prizes.forEach((p) =>
                counts.set(p.card_id, (counts.get(p.card_id) ?? 0) + 1),
              );
              return (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Atlantic/Canary",
                    }).format(new Date(m.played_at))}
                  </td>
                  <td>
                    <strong>{m.deck_name}</strong>
                    <small>vs {m.opponent_deck_name}</small>
                  </td>
                  <td>
                    <span className={`result-badge result-${m.result}`}>
                      {m.result}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <strong>
                      {m.my_prizes} – {m.opponent_prizes}
                    </strong>
                    <small>You / opponent</small>
                  </td>
                  <td>
                    <strong>{cardName(m, m.starter_id, "mine")}</strong>
                    <small>
                      vs {cardName(m, m.opponent_starter_id, "opponent")}
                    </small>
                  </td>
                  <td>
                    <div className="prize-summary">
                      {counts.size ? (
                        [...counts].map(([id, quantity]) => (
                          <span key={id}>
                            x{quantity} {cardName(m, id, "mine")}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">
                          Not recorded
                        </span>
                      )}
                      {prizes.length > 0 && prizes.length < 6 && (
                        <small>{6 - prizes.length} unknown</small>
                      )}
                    </div>
                  </td>
                  <td className="match-notes">{m.notes || "—"}</td>
                  <td className="history-actions">
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label="Edit match"
                        onClick={() => onEdit(m)}
                      >
                        <Pencil />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label="Delete match"
                        onClick={() => onDelete(m)}
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="history-pagination">
        <span>
          Showing {current * count + 1}–
          {Math.min((current + 1) * count, matches.length)} of {matches.length}{" "}
          matches
        </span>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            disabled={!current}
            onClick={() => setPage(current - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <span>
            {current + 1} / {maxPage + 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={current >= maxPage}
            onClick={() => setPage(current + 1)}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
