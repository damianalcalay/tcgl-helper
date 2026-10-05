"use client";
import { CombatLogView, PrizeAvatar } from "./combat-log-view";
import { useState } from "react";
import { AppData, Match } from "@/types/domain";
import {
  ScrollText,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
  const [combatMatch, setCombatMatch] = useState<Match | null>(null);
  const [size, setSize] = useState("10");
  const [page, setPage] = useState(0);
  const count = size === "all" ? matches.length : Number(size);
  const maxPage = Math.max(0, Math.ceil(matches.length / count) - 1);
  const current = Math.min(page, maxPage);
  const displayed = matches.slice(current * count, (current + 1) * count);
  function cardName(
    match: Match,
    cardId: string | null,
    side: "mine" | "opponent",
  ) {
    return (
      data.rosters.find(
        (r) =>
          r.match_id === match.id && r.card_id === cardId && r.side === side,
      )?.card_name ??
      (side === "opponent" ? match.opponent_starter_name : undefined) ??
      "Unavailable card"
    );
  }
  return (
    <div className="match-history">
      {combatMatch && (
        <CombatLogView
          match={combatMatch}
          data={data}
          onClose={() => setCombatMatch(null)}
        />
      )}
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
              <th className="history-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((m) => {
              const prizes = data.prizes
                .filter((p) => p.match_id === m.id)
                .sort((a, b) => a.slot - b.slot);
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
                    {typeof m.coin_won === "boolean" && (
                      <small>Opening coin: {m.coin_won ? "won" : "lost"}</small>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <strong>
                      {m.my_prizes} – {m.opponent_prizes}
                    </strong>
                    <small>You / opponent</small>
                    <small>
                      Remaining: {6 - m.my_prizes} / {6 - m.opponent_prizes}
                    </small>
                  </td>
                  <td>
                    <strong>{cardName(m, m.starter_id, "mine")}</strong>
                    <small>
                      vs {cardName(m, m.opponent_starter_id, "opponent")}
                    </small>
                  </td>
                  <td>
                    <div className="prize-avatar-list">
                      {Array.from({ length: 6 }, (_, i) => {
                        const prize = prizes[i];
                        const roster =
                          prize &&
                          data.rosters.find(
                            (r) =>
                              r.match_id === m.id &&
                              r.side === "mine" &&
                              r.card_id === prize.card_id,
                          );
                        return (
                          <PrizeAvatar
                            key={i}
                            name={roster?.card_name ?? "Unknown prize card"}
                            printing={roster?.printings?.[0]}
                          />
                        );
                      })}
                    </div>
                  </td>
                  <td className="history-actions">
                    <div className="flex flex-col gap-1">
                      {m.combat_log && (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label="View combat log"
                          onClick={() => setCombatMatch(m)}
                        >
                          <ScrollText />
                          Log / Replay
                        </Button>
                      )}
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
