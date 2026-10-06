"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Sun,
  Moon,
  Eye,
  EyeOff,
  ScanEye,
  Pencil,
  Camera,
  Upload,
  Undo2,
  Redo2,
  RotateCcw,
  MousePointer2,
  Circle,
  Square,
  RectangleHorizontal,
  MoveUpRight,
  HelpCircle,
  Eraser,
  X,
} from "lucide-react";
import type { AppData, Match, CardType } from "@/types/domain";
import {
  cardNameKey,
  combineCombatLogs,
  parseCombatLog,
} from "@/lib/domain/combat-log";
import { replayBoard } from "@/lib/domain/combat-replay";
import {
  handVisible,
  moveTableCard,
  setTableDamage,
  tableFromReplay,
  type Mark,
  type TableCard,
  type TableState,
  type Zone,
} from "@/lib/domain/table-top";
import { captureBoard } from "@/lib/board-capture";
import { saveComplementaryLog } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { ReplayImage, CARD_BACKS, matchCardImage } from "./combat-log-view";

const zones: Zone[] = [
  "hand",
  "deck",
  "discard",
  "prizes",
  "active",
  "bench",
  "stadium",
  "played",
];
const colors = [
  "#f97316",
  "#ef4444",
  "#22c55e",
  "#38bdf8",
  "#a78bfa",
  "#ffffff",
];
function MarkShape({ mark }: { mark: Mark }) {
  const a = mark.points[0],
    b = mark.points.at(-1)!;
  const common = {
    stroke: mark.color,
    strokeWidth: mark.width,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (mark.tool === "pencil")
    return (
      <polyline
        points={mark.points.map((p) => `${p.x},${p.y}`).join(" ")}
        {...common}
      />
    );
  if (mark.tool === "question")
    return (
      <text x={a.x} y={a.y} fill={mark.color} fontSize={24 + mark.width * 2}>
        ?
      </text>
    );
  if (mark.tool === "circle")
    return (
      <ellipse
        cx={(a.x + b.x) / 2}
        cy={(a.y + b.y) / 2}
        rx={Math.abs(a.x - b.x) / 2}
        ry={Math.abs(a.y - b.y) / 2}
        {...common}
      />
    );
  if (mark.tool === "square" || mark.tool === "rectangle") {
    const w = Math.abs(a.x - b.x),
      h = mark.tool === "square" ? w : Math.abs(a.y - b.y);
    return (
      <rect
        x={Math.min(a.x, b.x)}
        y={Math.min(a.y, b.y)}
        width={w}
        height={h}
        {...common}
      />
    );
  }
  const angle = Math.atan2(b.y - a.y, b.x - a.x),
    size = 10 + mark.width;
  return (
    <path
      d={`M ${a.x} ${a.y} L ${b.x} ${b.y} M ${b.x - size * Math.cos(angle - 0.5)} ${b.y - size * Math.sin(angle - 0.5)} L ${b.x} ${b.y} L ${b.x - size * Math.cos(angle + 0.5)} ${b.y - size * Math.sin(angle + 0.5)}`}
      {...common}
    />
  );
}

export function CombatLogView({
  match,
  data,
  onClose,
  publicMatch = false,
}: {
  match: Match;
  data: AppData;
  onClose: () => void;
  publicMatch?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [secondary, setSecondary] = useState(match.opponent_combat_log ?? "");
  const parsed = useMemo(() => {
    try {
      if (secondary) {
        const result = combineCombatLogs(match.combat_log ?? "", secondary);
        if (result.status === "matched") return result.log;
      }
      return parseCombatLog(match.combat_log ?? "");
    } catch {
      return null;
    }
  }, [match.combat_log, secondary]);
  const own =
    match.log_player || parsed?.perspective || parsed?.players[0] || "";
  const opponent = parsed?.players.find((p) => p !== own) ?? "";
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState("1");
  const [perspective, setPerspective] = useState<"you" | "opponent" | "both">(
    "you",
  );
  const [ownBack, setOwnBack] = useState(match.card_back ?? "classic"),
    [otherBack, setOtherBack] = useState(match.opponent_card_back ?? "classic");
  const [reveals, setReveals] = useState<Record<number, number[]>>({});
  const [history, setHistory] = useState<TableState[]>([]),
    [cursor, setCursor] = useState(0);
  const editing = history.length > 0;
  const replay = useMemo(
    () =>
      parsed
        ? tableFromReplay(replayBoard(parsed, step, reveals))
        : { cards: [], marks: [] },
    [parsed, step, reveals],
  );
  const state = editing ? history[cursor] : replay;
  const [selected, setSelected] = useState<string | null>(null),
    [destinationOwner, setDestinationOwner] = useState(own),
    [destinationZone, setDestinationZone] = useState<Zone>("hand");
  const [inspect, setInspect] = useState<string | null>(null);
  const [pile, setPile] = useState<{
      owner: string;
      zone: "deck" | "discard";
    } | null>(null),
    [filter, setFilter] = useState("All");
  const [importing, setImporting] = useState(false),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(""),
    [download, setDownload] = useState<Blob | null>(null);
  const [tool, setTool] = useState("select"),
    [color, setColor] = useState(colors[0]),
    [width, setWidth] = useState(3),
    [mark, setMark] = useState<Mark | null>(null);
  const [boardSize, setBoardSize] = useState({ width: 1000, height: 600 });
  const boardRef = useRef<HTMLDivElement>(null);
  const events = parsed?.events ?? [],
    event = events[step];
  const [art, setArt] = useState<
    Record<string, { image?: string; type?: CardType }>
  >({});
  useEffect(() => {
    const controller = new AbortController();
    const names = [
      ...new Set(
        parsed?.events.flatMap((e) =>
          [e.card, ...(e.cards ?? [])].filter(
            (n): n is string => Boolean(n) && !/^Unknown/.test(n!),
          ),
        ) ?? [],
      ),
    ];
    const missing = names.filter(
      (n) =>
        !matchCardImage(data, match, n) ||
        !data.cards.some((c) => cardNameKey(c.name) === cardNameKey(n)),
    );
    async function resolve() {
      for (let i = 0; i < missing.length; i += 12) {
        try {
          const response = await fetch("/api/replay-cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: missing.slice(i, i + 12) }),
            signal: controller.signal,
          });
          if (!response.ok) continue;
          const result = await response.json();
          if (!controller.signal.aborted)
            setArt((a) => ({
              ...a,
              ...Object.fromEntries(
                result.cards.map(
                  (c: { name: string; image?: string; type?: CardType }) => [
                    cardNameKey(c.name),
                    c,
                  ],
                ),
              ),
            }));
        } catch {
          if (controller.signal.aborted) return;
        }
      }
    }
    void resolve();
    return () => controller.abort();
  }, [parsed, data, match]);
  useEffect(() => {
    const node = boardRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setBoardSize({ width: node.clientWidth, height: node.clientHeight }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || editing || step >= events.length - 1) return;
    const timer = setTimeout(() => setStep((s) => s + 1), 1000 / Number(speed));
    return () => clearTimeout(timer);
  }, [playing, editing, step, speed, events.length]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const image = (name: string) =>
    matchCardImage(data, match, name) ?? art[cardNameKey(name)]?.image;
  function commit(next: TableState) {
    setHistory((h) => [...h.slice(0, cursor + 1), next]);
    setCursor(cursor + 1);
  }
  function leave() {
    if (
      editing &&
      cursor > 0 &&
      !window.confirm(
        "Discard the manual board changes and return to the replay?",
      )
    )
      return false;
    setHistory([]);
    setCursor(0);
    setSelected(null);
    setTool("select");
    return true;
  }
  function close() {
    if (leave()) onClose();
  }
  function openPile(owner: string, zone: "deck" | "discard") {
    setPlaying(false);
    setFilter("All");
    setPile({ owner, zone });
  }
  function move(id: string, owner: string, zone: Zone, slot?: number) {
    if (editing) {
      commit(moveTableCard(state, id, owner, zone, slot));
      setSelected(null);
    }
  }
  const chosen = state.cards.find((c) => c.id === selected);
  function card(c: TableCard, hidden = false, small = false) {
    const children = state.cards.filter((a) => a.parent === c.id);
    return (
      <div
        key={c.id}
        className={`study-card ${small ? "study-small" : ""} ${selected === c.id ? "study-selected" : ""}`}
        draggable={editing && tool === "select"}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", c.id);
          setSelected(c.id);
        }}
      >
        <button
          className="study-card-button"
          data-capture-card
          aria-label={hidden ? "Hidden card" : (c.name ?? "Unknown card")}
          onClick={() => {
            setPlaying(false);
            if (editing) setSelected(c.id);
            else if (!hidden && c.name) setInspect(c.name);
          }}
        >
          <ReplayImage
            name={c.name ?? undefined}
            src={c.name && !hidden ? image(c.name) : undefined}
            hidden={hidden || !c.name}
            back={c.owner === own ? ownBack : otherBack}
          />
        </button>
        {c.damage > 0 && (
          <span className="study-damage" data-capture-text>
            {c.damage}
          </span>
        )}
        <div className="study-attachments">
          {children
            .filter((a) => a.attachment !== "evolution")
            .map((a) => (
              <button
                key={a.id}
                data-capture-attachment
                aria-label={a.name ?? "Unknown attachment"}
                title={a.name ?? "Unknown attachment"}
                className="study-attachment"
                draggable={editing && tool === "select"}
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("text/plain", a.id);
                  setSelected(a.id);
                }}
                onClick={() =>
                  editing ? setSelected(a.id) : a.name && setInspect(a.name)
                }
              >
                {a.attachment === "energy"
                  ? (a.name
                      ?.replace("Basic ", "")
                      .replace(" Energy", "")
                      .slice(0, 1) ?? "?")
                  : "T"}
              </button>
            ))}
        </div>
      </div>
    );
  }
  function dropProps(owner: string, zone: Zone, slot?: number) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (editing && tool === "select") e.preventDefault();
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        move(e.dataTransfer.getData("text/plain"), owner, zone, slot);
      },
    };
  }
  function row(owner: string, zone: "hand" | "bench", hidden = false) {
    const cards = state.cards.filter(
      (c) => c.owner === owner && c.zone === zone && !c.parent,
    );
    return (
      <div
        className={`study-row study-${zone}`}
        {...dropProps(owner, zone)}
        aria-label={`${owner} ${zone}`}
      >
        <div className="study-row-cards" data-capture-clip>
          {cards.map((c) => card(c, hidden))}
        </div>
        {zone === "hand" && (
          <span
            className="study-count"
            aria-label={`${cards.length} cards in hand`}
            data-capture-text
          >
            {cards.length}
          </span>
        )}
      </div>
    );
  }
  function side(owner: string, top: boolean) {
    const deck = state.cards.filter(
      (c) => c.owner === owner && c.zone === "deck" && !c.parent,
    );
    const discard = state.cards.filter(
      (c) => c.owner === owner && c.zone === "discard" && !c.parent,
    );
    const active = state.cards.find(
      (c) => c.owner === owner && c.zone === "active" && !c.parent,
    );
    const prizes = state.cards.filter(
      (c) => c.owner === owner && c.zone === "prizes" && !c.parent,
    );
    return (
      <section
        className={`study-side ${top ? "study-top" : "study-bottom"}`}
        aria-label={`${owner} board`}
      >
        <div className="study-hand-line">
          {row(owner, "hand", !handVisible(perspective, top))}
          <div className="study-discard" {...dropProps(owner, "discard")}>
            <button
              className="study-pile-hit"
              aria-label={`View ${owner} discard pile`}
              onClick={() => openPile(owner, "discard")}
            >
              {discard.at(-1) ? (
                <span data-capture-card>
                  <ReplayImage
                    name={discard.at(-1)!.name ?? undefined}
                    src={
                      discard.at(-1)!.name
                        ? image(discard.at(-1)!.name!)
                        : undefined
                    }
                  />
                </span>
              ) : (
                <span className="study-vacant" />
              )}
            </button>
          </div>
        </div>
        {row(owner, "bench")}
        <div className="study-field-line">
          <div className="study-prizes" aria-label={`${owner} prizes`}>
            {Array.from({ length: 6 }, (_, slot) => (
              <div
                key={slot}
                className="study-prize-slot"
                {...dropProps(owner, "prizes", slot)}
              >
                {prizes.find((c) => c.slot === slot) &&
                  card(
                    prizes.find((c) => c.slot === slot)!,
                    true,
                    true,
                  )}
              </div>
            ))}
          </div>
          <div
            className="study-active"
            {...dropProps(owner, "active")}
            aria-label={`${owner} active`}
          >
            {active && card(active)}
          </div>
          <div className="study-deck" {...dropProps(owner, "deck")}>
            <button
              className="study-pile-hit"
              aria-label={`View ${owner} deck`}
              onClick={() => openPile(owner, "deck")}
            >
              <span data-capture-card>
                <ReplayImage back={owner === own ? ownBack : otherBack} />
              </span>
            </button>
            <span className="study-count" data-capture-text>
              {deck.length}
            </span>
          </div>
        </div>
      </section>
    );
  }
  async function saveCapture() {
    if (!boardRef.current || busy) return;
    setBusy(true);
    // Start the clipboard promise during the user gesture (required by Safari).
    const blobPromise = captureBoard(boardRef.current);
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobPromise }),
      ]);
      setDownload(null);
      setToast("Board image copied to clipboard");
    } catch {
      try {
        const blob = await blobPromise;
        setDownload(blob);
        setToast("Image ready. Download it using the button below.");
      } catch (e) {
        setToast(
          e instanceof Error ? e.message : "Could not capture the board",
        );
      }
    } finally {
      setBusy(false);
    }
  }
  function icon(
    label: string,
    content: React.ReactNode,
    action: () => void,
    disabled = false,
    pressed?: boolean,
  ) {
    return (
      <Button
        key={label}
        type="button"
        size="icon"
        variant="ghost"
        title={label}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={action}
      >
        {content}
      </Button>
    );
  }
  const before =
    parsed && event?.kind === "prize"
      ? replayBoard(parsed, step - 1, reveals).sides[event.actor]
      : undefined;
  const picked = reveals[step] ?? [];
  const pileCards = pile
    ? state.cards.filter(
        (c) => c.owner === pile.owner && c.zone === pile.zone && !c.parent,
      )
    : [];
  function category(c: TableCard) {
    const type =
      data.cards.find((a) => cardNameKey(a.name) === cardNameKey(c.name ?? ""))
        ?.type ??
      data.rosters.find(
        (a) => cardNameKey(a.card_name) === cardNameKey(c.name ?? ""),
      )?.card_type ??
      art[cardNameKey(c.name ?? "")]?.type;
    if (!type) return "Unknown";
    if (type.startsWith("energy") || type === "energy") return "Energy";
    if (
      [
        "supporter",
        "stadium",
        "tool",
        "item",
        "ace_spec",
        "rocket_secret_machine",
        "technical_machine",
      ].includes(type)
    )
      return "Trainers";
    return "Pokémon";
  }
  return (
    <Modal
      title="Match replay"
      className="study-modal"
      wide
      onClose={close}
      closeOnBackdrop={false}
    >
      <header className="study-header">
        <div className="study-summary">
          <strong>
            {match.deck_name} vs {match.opponent_deck_name}
          </strong>
          <span>
            {match.result.toUpperCase()} · {match.my_prizes}–
            {match.opponent_prizes}
          </span>
          <span>
            {own} · {opponent}
          </span>
          <span>
            {parsed?.coin?.first === own ? "Start first" : "Start second"} ·{" "}
            {parsed?.coin?.choice ?? "?"} → {parsed?.coin?.outcome ?? "?"}
          </span>
        </div>
        <div className="study-header-controls">
          {[
            ["Your card back", ownBack, setOwnBack],
            ["Opponent card back", otherBack, setOtherBack],
          ].map(([label, value, setter]) => (
            <select
              key={String(label)}
              aria-label={String(label)}
              title={String(label)}
              value={String(value)}
              onChange={(e) => (setter as (s: string) => void)(e.target.value)}
            >
              {CARD_BACKS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          ))}
          {icon(
            `Hand visibility: ${perspective}`,
            perspective === "both" ? (
              <ScanEye />
            ) : perspective === "you" ? (
              <Eye />
            ) : (
              <EyeOff />
            ),
            () =>
              setPerspective((p) =>
                p === "you" ? "opponent" : p === "opponent" ? "both" : "you",
              ),
          )}
          {icon(
            "Table Top",
            <Pencil />,
            () => {
              setPlaying(false);
              if (editing) leave();
              else {
                setHistory([structuredClone(replay)]);
                setCursor(0);
                setDestinationOwner(own);
              }
            },
            !parsed,
            editing,
          )}
          {icon("Save boardstate", <Camera />, saveCapture, busy || !parsed)}
          {!publicMatch &&
            icon(
              "Add complementary log",
              <Upload />,
              () => {
                setPlaying(false);
                setDraft(secondary);
                setError("");
                setImporting(true);
              },
              editing,
            )}
          {icon(
            "Switch replay color theme",
            resolvedTheme === "dark" ? <Sun /> : <Moon />,
            () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
          )}
          {icon("Close replay", <X />, close)}
        </div>
      </header>
      {!parsed ? (
        <p role="alert">This match has no valid combat log.</p>
      ) : (
        <>
          <div className="study-action" aria-live="polite">
            <span>
              {editing
                ? "Table Top"
                : event?.turn
                  ? `Turn ${event.turn}`
                  : "Setup"}
            </span>
            <strong>{event?.text.replace(/^-\s*/, "")}</strong>
          </div>
          <div className="study-stage">
            <div ref={boardRef} className="study-board" data-editing={editing}>
              {side(opponent, true)}
              {side(own, false)}
              <div
                className="study-stadium"
                {...dropProps(own, "stadium")}
                aria-label="Stadium"
              >
                {state.cards
                  .filter((c) => c.zone === "stadium" && !c.parent)
                  .map((c) => card(c))}
              </div>
              <div
                className="study-played"
                {...dropProps(own, "played")}
                aria-label="Played cards"
              >
                {state.cards
                  .filter((c) => c.zone === "played" && !c.parent)
                  .map((c) => card(c))}
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="table-annotations"
                viewBox={`0 0 ${boardSize.width} ${boardSize.height}`}
                width={boardSize.width}
                height={boardSize.height}
                style={{
                  pointerEvents: editing && tool !== "select" ? "auto" : "none",
                }}
                onPointerDown={(e) => {
                  if (!editing || tool === "select") return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const point = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  };
                  if (tool === "eraser") {
                    const target = (e.target as Element).closest("[data-mark]");
                    if (target)
                      commit({
                        ...state,
                        marks: state.marks.filter(
                          (m) => m.id !== target.getAttribute("data-mark"),
                        ),
                      });
                    return;
                  }
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setMark({
                    id: crypto.randomUUID(),
                    tool,
                    color,
                    width,
                    points: [point],
                  });
                }}
                onPointerMove={(e) => {
                  if (!mark) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const point = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  };
                  setMark((m) =>
                    m
                      ? {
                          ...m,
                          points:
                            m.tool === "pencil"
                              ? [...m.points, point]
                              : [m.points[0], point],
                        }
                      : null,
                  );
                }}
                onPointerUp={() => {
                  if (mark) {
                    commit({ ...state, marks: [...state.marks, mark] });
                    setMark(null);
                  }
                }}
                onPointerCancel={() => setMark(null)}
              >
                {state.marks.map((m) => (
                  <g key={m.id} data-mark={m.id}>
                    <MarkShape mark={m} />
                  </g>
                ))}
                {mark && <MarkShape mark={mark} />}
              </svg>
            </div>
            {editing && (
              <aside className="table-toolbar" aria-label="Table Top tools">
                <div className="table-tools">
                  {[
                    ["select", MousePointer2],
                    ["pencil", Pencil],
                    ["circle", Circle],
                    ["square", Square],
                    ["rectangle", RectangleHorizontal],
                    ["arrow", MoveUpRight],
                    ["question", HelpCircle],
                    ["eraser", Eraser],
                  ].map(([name, Icon]) => {
                    const ToolIcon = Icon as typeof Pencil;
                    return icon(
                      String(name),
                      <ToolIcon />,
                      () => setTool(String(name)),
                      false,
                      tool === name,
                    );
                  })}
                </div>
                <div className="table-colors">
                  {colors.map((c) => (
                    <button
                      key={c}
                      title={c}
                      aria-label={`Color ${c}`}
                      aria-pressed={color === c}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
                <select
                  aria-label="Brush size"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                >
                  {[2, 3, 5, 8].map((w) => (
                    <option key={w} value={w}>
                      {w}px
                    </option>
                  ))}
                </select>
                <div className="table-tools">
                  {icon(
                    "Undo",
                    <Undo2 />,
                    () => {
                      setCursor((c) => c - 1);
                      setSelected(null);
                    },
                    cursor === 0,
                  )}
                  {icon(
                    "Redo",
                    <Redo2 />,
                    () => {
                      setCursor((c) => c + 1);
                      setSelected(null);
                    },
                    cursor === history.length - 1,
                  )}
                  {icon("Reset board", <RotateCcw />, () => {
                    commit(structuredClone(history[0]));
                    setSelected(null);
                  })}
                </div>
                {chosen && (
                  <div className="table-move">
                    <strong>
                      {chosen.zone === "hand" &&
                      !handVisible(perspective, chosen.owner !== own)
                        ? "Hidden card"
                        : (chosen.name ?? "Unknown card")}
                    </strong>
                    <select
                      aria-label="Move to player"
                      value={destinationOwner}
                      onChange={(e) => setDestinationOwner(e.target.value)}
                    >
                      {[own, opponent].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Move to zone"
                      value={destinationZone}
                      onChange={(e) =>
                        setDestinationZone(e.target.value as Zone)
                      }
                    >
                      {zones.map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={() =>
                        move(chosen.id, destinationOwner, destinationZone)
                      }
                    >
                      Move
                    </Button>
                    <label>
                      Damage
                      <input
                        aria-label="Pokémon damage"
                        type="number"
                        min={0}
                        value={chosen.damage}
                        onChange={(e) =>
                          commit(
                            setTableDamage(
                              state,
                              chosen.id,
                              Number(e.target.value),
                            ),
                          )
                        }
                      />
                    </label>
                    <select
                      aria-label="Attach to Pokémon"
                      value=""
                      onChange={(e) => {
                        if (e.target.value)
                          commit(
                            moveTableCard(
                              state,
                              chosen.id,
                              destinationOwner,
                              "bench",
                              undefined,
                              e.target.value,
                              /Energy/i.test(chosen.name ?? "")
                                ? "energy"
                                : "tool",
                            ),
                          );
                      }}
                    >
                      <option value="">Attach to…</option>
                      {state.cards
                        .filter(
                          (c) =>
                            !c.parent &&
                            ["active", "bench"].includes(c.zone) &&
                            c.id !== chosen.id,
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.owner} · {c.name}
                          </option>
                        ))}
                    </select>
                    {state.cards
                      .filter((c) => c.parent === chosen.id)
                      .map((c) => (
                        <button key={c.id} onClick={() => setSelected(c.id)}>
                          {c.attachment}: {c.name}
                        </button>
                      ))}
                  </div>
                )}
              </aside>
            )}
          </div>
          <footer className="study-timeline">
            <input
              type="range"
              aria-label="Replay action"
              min={0}
              max={Math.max(0, events.length - 1)}
              value={step}
              disabled={editing}
              onChange={(e) => {
                setPlaying(false);
                setStep(Number(e.target.value));
              }}
            />
            <div className="study-controls">
              {icon(
                "Previous action",
                <ChevronLeft />,
                () => {
                  setPlaying(false);
                  setStep((s) => s - 1);
                },
                editing || step === 0,
              )}
              {icon(
                playing ? "Pause" : "Play",
                playing ? <Pause /> : <Play />,
                () => setPlaying((p) => !p),
                editing || step === events.length - 1,
              )}
              {icon(
                "Next action",
                <ChevronRight />,
                () => {
                  setPlaying(false);
                  setStep((s) => s + 1);
                },
                editing || step === events.length - 1,
              )}
              <select
                aria-label="Replay speed"
                value={speed}
                disabled={editing}
                onChange={(e) => setSpeed(e.target.value)}
              >
                {["0.5", "1", "1.5", "2", "4"].map((s) => (
                  <option key={s} value={s}>
                    x{s}
                  </option>
                ))}
              </select>
              <span>
                {step + 1} / {events.length}
              </span>
            </div>
          </footer>
        </>
      )}
      {toast && (
        <div className="study-toast" role="status">
          {toast}
          {download && (
            <Button
              size="sm"
              onClick={() => {
                const url = URL.createObjectURL(download);
                const a = document.createElement("a");
                a.href = url;
                a.download = "board-state.png";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setToast("Board image downloaded");
                setDownload(null);
              }}
            >
              Download PNG
            </Button>
          )}
        </div>
      )}
      {importing && (
        <Modal
          title="Complementary combat log"
          onClose={() => setImporting(false)}
          busy={busy}
        >
          <div className="form-stack">
            <textarea
              aria-label="Complementary combat log"
              rows={12}
              maxLength={200000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <input
              type="file"
              accept=".txt,text/plain"
              aria-label="Upload complementary log"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 800000) setError("File too large");
                  else setDraft(await file.text());
                }
              }}
            />
            {error && <p role="alert">{error}</p>}
            <Button
              disabled={busy}
              onClick={async () => {
                const result = combineCombatLogs(match.combat_log ?? "", draft);
                if (result.status !== "matched") {
                  setError(result.message);
                  return;
                }
                setBusy(true);
                const saved = await saveComplementaryLog(match.id, draft);
                setBusy(false);
                if (!saved.success) {
                  setError(saved.error ?? "Could not save log");
                  return;
                }
                setSecondary(draft);
                setStep(0);
                setReveals({});
                setImporting(false);
                setToast("Complementary history verified and saved");
              }}
            >
              Verify and save
            </Button>
          </div>
        </Modal>
      )}
      {pile && (
        <Modal
          title={pile.zone === "deck" ? "Deck" : "Discard pile"}
          onClose={() => setPile(null)}
        >
          <div className="study-filters" role="group" aria-label="Card filters">
            {["All", "Pokémon", "Trainers", "Energy"].map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "ghost"}
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
          <div className="study-pile-grid">
            {pileCards
              .filter((c) => filter === "All" || category(c) === filter)
              .map((c) => card(c))}
          </div>
          {pileCards.length === 0 && <p>No cards in this pile.</p>}
          {editing && selected && (
            <Button
              onClick={() => {
                move(selected, pile.owner, "hand");
                setPile(null);
              }}
            >
              Move selected card to hand
            </Button>
          )}
        </Modal>
      )}
      {inspect && (
        <Modal title={inspect} onClose={() => setInspect(null)}>
          <div className="card-inspection">
            <ReplayImage
              name={inspect}
              src={image(inspect)?.replace("/low.webp", "/high.webp")}
            />
          </div>
        </Modal>
      )}
      {!editing &&
        !playing &&
        event?.kind === "prize" &&
        picked.length < (event.count ?? 1) && (
          <Modal
            title={`Choose ${event.count} prize cards`}
            onClose={() =>
              setReveals((r) => ({
                ...r,
                [step]: Array.from({ length: 6 }, (_, i) => i)
                  .filter((i) => !before?.collectedSlots[i])
                  .slice(0, event.count ?? 1),
              }))
            }
          >
            <div className="study-prize-choice">
              {Array.from({ length: 6 }, (_, slot) => (
                <Button
                  key={slot}
                  disabled={
                    before?.collectedSlots[slot] || picked.includes(slot)
                  }
                  onClick={() =>
                    setReveals((r) => ({ ...r, [step]: [...picked, slot] }))
                  }
                >
                  <ReplayImage
                    back={event.actor === own ? ownBack : otherBack}
                  />
                  <span className="sr-only">Prize position {slot + 1}</span>
                </Button>
              ))}
            </div>
          </Modal>
        )}
    </Modal>
  );
}
