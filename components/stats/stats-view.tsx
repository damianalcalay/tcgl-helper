"use client";
import { Fragment, useState } from "react";
import { AppData, Match } from "@/types/domain";
import { overallStats, summarize, winRate } from "@/lib/domain/logic";
import { deleteEntity } from "@/app/actions";
import {
  Trophy,
  Plus,
  ChartNoAxesCombined,
  Layers3,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/modal";
import { RegexCombobox } from "@/components/shared/regex-combobox";
import { PageHeader, Metric, EmptyState } from "@/components/shared/page-parts";
import { useMutation } from "@/components/shared/use-mutation";
import { MatchSaved } from "./match-saved";
import { MatchForm } from "./match-form";
import { MatchHistory } from "./match-history";
export function StatsView({ data }: { data: AppData }) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [deckFilter, setDeckFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<Match | null | undefined>();
  const [deleting, setDeleting] = useState<Match | null>(null);
  const overall = overallStats(data.matches);
  const coinGames = data.matches.filter((m) => typeof m.coin_won === "boolean");
  const coinWins = coinGames.filter((m) => m.coin_won).length;
  const mutation = useMutation();
  const decks = data.decks.filter((d) =>
    data.matches.some((m) => m.deck_id === d.id),
  );
  function toggle(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <>
      <PageHeader
        eyebrow="LEARN FROM EVERY GAME"
        title="Stats"
        description="Turn your match history into a better understanding of your decks."
        action={
          <Button onClick={() => setForm(null)}>
            <Plus />
            Add Match
          </Button>
        }
      />
      {!data.matches.length ? (
        <section className="panel">
          <EmptyState
            icon={ChartNoAxesCombined}
            title="Every game tells you something"
            description="Record your first match to see deck performance, matchups, and the details behind your results."
            action={() => setForm(null)}
            label="Add your first match"
          />
          <div className="empty-stats-note">
            <Trophy size={16} />
            Your wins, lessons, and next steps. All in one place.
          </div>
        </section>
      ) : (
        <>
          <div className="metrics-grid">
            <Metric
              label="Matches played"
              value={data.matches.length}
              detail={`${data.matches.filter((m) => m.result === "win").length} wins · ${data.matches.filter((m) => m.result === "loss").length} losses · ${data.matches.filter((m) => m.result === "draw").length} draws`}
              icon={Trophy}
            />
            <Metric
              label="Overall win rate"
              value={`${winRate(data.matches).toFixed(1)}%`}
              detail="Wins divided by all matches, including draws"
              icon={Target}
            />
            <Metric
              label="Decks tracked"
              value={decks.length}
              detail="Every deck with recorded games"
              icon={Layers3}
            />
            <Metric
              label="Longest win streak"
              value={overall.bestStreak}
              detail="Consecutive wins across all decks"
              icon={Trophy}
            />
            <Metric
              label="Most played deck"
              value={overall.mostPlayed?.name ?? "None"}
              detail={`${overall.mostPlayed?.count ?? 0} matches played`}
              icon={Layers3}
            />
            <Metric
              label="Opening coin win rate"
              value={
                coinGames.length
                  ? `${((coinWins / coinGames.length) * 100).toFixed(1)}%`
                  : "N/A"
              }
              detail={`${coinWins} wins from ${coinGames.length} recorded opening flips`}
              icon={Target}
            />
          </div>
          <div className="section-toolbar">
            <div>
              <h2 className="text-lg font-semibold">Deck performance</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Open details to explore the games behind the numbers.
              </p>
            </div>
            <div className="toolbar-search">
              <RegexCombobox
                label="Filter by deck"
                clearable
                placeholder="All decks with matches"
                options={decks.map((d) => ({ value: d.id, label: d.name }))}
                value={deckFilter}
                onChange={setDeckFilter}
              />
            </div>
          </div>
          <section className="panel stats-panel">
            <div className="table-scroll">
              <table className="data-table stats-table">
                <thead>
                  <tr>
                    <th>Deck</th>
                    <th>Matches</th>
                    <th>W / L / D</th>
                    <th>Win rate</th>
                    <th>Last 20</th>
                    <th>Best matchups</th>
                    <th>Toughest matchups</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {decks
                    .filter((d) => !deckFilter || d.id === deckFilter)
                    .map((deck) => {
                      const stats = summarize(
                        data.matches.filter((m) => m.deck_id === deck.id),
                      );
                      const open = expanded.has(deck.id);
                      return (
                        <Fragment key={deck.id}>
                          <tr className={open ? "expanded-row" : ""}>
                            <td>
                              <span className="table-deck-name">
                                <span className="mini-deck-icon">
                                  <Layers3 size={16} />
                                </span>
                                {deck.name}
                              </span>
                            </td>
                            <td>{stats.total}</td>
                            <td className="whitespace-nowrap">
                              <span className="wins-text">{stats.wins}</span> /{" "}
                              <span>{stats.losses}</span> /{" "}
                              <span className="text-muted-foreground">
                                {stats.draws}
                              </span>
                            </td>
                            <td>
                              <strong>{stats.rate.toFixed(1)}%</strong>
                              <div className="rate-bar">
                                <span style={{ width: `${stats.rate}%` }} />
                              </div>
                            </td>
                            <td>
                              <strong>{stats.recent.toFixed(1)}%</strong>
                              <small>{Math.min(20, stats.total)} matches</small>
                            </td>
                            <td>
                              <Matchups items={stats.best} />
                            </td>
                            <td>
                              <Matchups items={stats.worst} />
                            </td>
                            <td>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggle(deck.id)}
                                aria-expanded={open}
                                aria-controls={`history-${deck.id}`}
                              >
                                Details{open ? <ChevronUp /> : <ChevronDown />}
                              </Button>
                            </td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan={8} className="history-cell">
                                <div id={`history-${deck.id}`}>
                                  <MatchHistory
                                    matches={stats.sorted}
                                    data={data}
                                    onEdit={setForm}
                                    onDelete={(m) => {
                                      mutation.setError("");
                                      setDeleting(m);
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="panel-footnote">
              Win rate = wins ÷ all matches. Draws count as matches. Last 20
              uses up to 20 most recent games. Matchups show every sample size.
            </div>
          </section>
        </>
      )}
      {form !== undefined && (
        <MatchForm
          data={data}
          match={form ?? undefined}
          onSaved={setSavedId}
          onClose={() => setForm(undefined)}
        />
      )}
      {savedId && (
        <MatchSaved
          data={data}
          id={savedId}
          onClose={() => setSavedId(null)}
          onPlayAgain={() => {
            setSavedId(null);
            setForm(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this match?"
          description="This match, its prize cards, and its contribution to your statistics will be permanently removed."
          onClose={() => setDeleting(null)}
          pending={mutation.pending}
          error={mutation.error}
          onConfirm={() =>
            mutation.run(
              () => deleteEntity("match", deleting.id),
              () => setDeleting(null),
            )
          }
        />
      )}
    </>
  );
}
function Matchups({
  items,
}: {
  items: { id: string; name: string; rate: number; count: number }[];
}) {
  return (
    <div className="matchup-list">
      {items.map((m) => (
        <span key={m.id}>
          <span>{m.name}</span>
          <strong>
            {m.rate.toFixed(0)}% <small>({m.count})</small>
          </strong>
        </span>
      ))}
    </div>
  );
}
