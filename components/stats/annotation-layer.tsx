"use client";
import { useRef, useState } from "react";
import type { Mark } from "@/lib/domain/table-top";
import {
  markBounds,
  translateMark,
  resizeMark,
} from "@/lib/domain/annotations";

export function AnnotationLayer({
  marks,
  editing,
  tool,
  color,
  width,
  size,
  boardSize,
  selected,
  onSelect,
  onCommit,
  renderMark,
}: {
  marks: Mark[];
  editing: boolean;
  tool: string;
  color: string;
  width: number;
  size: number;
  boardSize: { width: number; height: number };
  selected: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (marks: Mark[]) => void;
  renderMark: (mark: Mark) => React.ReactNode;
}) {
  const [preview, setPreview] = useState<Mark | null>(null);
  const gesture = useRef<{
    mode: "draw" | "move" | "resize";
    start: { x: number; y: number };
    original: Mark;
    next: Mark;
    changed: boolean;
  } | null>(null);
  function point(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * boardSize.width) / rect.width,
      y: ((e.clientY - rect.top) * boardSize.height) / rect.height,
    };
  }
  const visible = marks.map((m) => (preview?.id === m.id ? preview : m));
  const selectedMark = visible.find((m) => m.id === selected);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="table-annotations"
      viewBox={`0 0 ${boardSize.width} ${boardSize.height}`}
      width={boardSize.width}
      height={boardSize.height}
      style={{ pointerEvents: editing && tool !== "select" ? "auto" : "none" }}
      onPointerDown={(e) => {
        if (!editing || e.button !== 0) return;
        const start = point(e),
          target = (e.target as Element).closest("[data-mark]");
        const existing = marks.find(
          (m) => m.id === target?.getAttribute("data-mark"),
        );
        if (tool === "eraser") {
          if (existing) onCommit(marks.filter((m) => m.id !== existing.id));
          onSelect(null);
          return;
        }
        if (tool === "select") {
          if (!existing) return;
          e.preventDefault();
          e.stopPropagation();
          onSelect(existing.id);
          gesture.current = {
            mode: (e.target as Element).hasAttribute("data-resize")
              ? "resize"
              : "move",
            start,
            original: existing,
            next: existing,
            changed: false,
          };
        } else {
          const original: Mark = {
            id: crypto.randomUUID(),
            tool,
            color,
            width,
            size: tool === "question" ? size : undefined,
            points: [start, start],
          };
          gesture.current = {
            mode: "draw",
            start,
            original,
            next: original,
            changed: true,
          };
          onSelect(null);
          setPreview(original);
        }
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const active = gesture.current;
        if (!active) return;
        const p = point(e),
          dx = p.x - active.start.x,
          dy = p.y - active.start.y;
        if (active.mode === "move")
          active.next = translateMark(active.original, dx, dy);
        else if (active.mode === "resize") {
          const b = markBounds(active.original);
          active.next = resizeMark(
            active.original,
            b.width + dx,
            b.height + dy,
          );
        } else
          active.next = {
            ...active.original,
            points:
              tool === "pencil"
                ? [...active.next.points, p]
                : [active.original.points[0], p],
          };
        active.changed ||= Math.abs(dx) + Math.abs(dy) > 1;
        setPreview(active.next);
      }}
      onPointerUp={() => {
        const active = gesture.current;
        if (active?.changed) {
          onCommit(
            active.mode === "draw"
              ? [...marks, active.next]
              : marks.map((m) => (m.id === active.next.id ? active.next : m)),
          );
          onSelect(active.next.id);
        }
        gesture.current = null;
        setPreview(null);
      }}
      onPointerCancel={() => {
        gesture.current = null;
        setPreview(null);
      }}
    >
      {visible.map((m) => {
        const b = markBounds(m);
        return (
          <g
            key={m.id}
            data-mark={m.id}
            style={{
              pointerEvents: editing ? "auto" : "none",
              cursor: tool === "select" ? "move" : undefined,
            }}
          >
            {editing && tool === "select" && (
              <rect
                x={b.x - 5}
                y={b.y - 5}
                width={b.width + 10}
                height={b.height + 10}
                fill="transparent"
                stroke="none"
              />
            )}
            {renderMark(m)}
            {editing && tool === "select" && selectedMark?.id === m.id && (
              <g data-editor-only>
                <rect
                  x={b.x - 4}
                  y={b.y - 4}
                  width={b.width + 8}
                  height={b.height + 8}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                />
                <rect
                  data-resize
                  aria-label="Resize annotation"
                  x={b.x + b.width - 5}
                  y={b.y + b.height - 5}
                  width={12}
                  height={12}
                  fill="#fff"
                  stroke="#0284c7"
                  strokeWidth={2}
                  style={{ cursor: "nwse-resize" }}
                />
              </g>
            )}
          </g>
        );
      })}
      {preview &&
        !marks.some((m) => m.id === preview.id) &&
        renderMark(preview)}
    </svg>
  );
}
