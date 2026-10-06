"use client";
import { useRef } from "react";

/** Pan from empty strip space in the editor; card gestures remain drag-and-drop.
 * Review cards can start panning, with click suppression only after a real drag. */
export function DragScroll({
  children,
  editing = false,
  className = "",
}: {
  children: React.ReactNode;
  editing?: boolean;
  className?: string;
}) {
  const start = useRef<{ x: number; scroll: number; moved: boolean } | null>(
      null,
    ),
    suppress = useRef(false);
  return (
    <div
      className={`drag-scroll ${className}`}
      data-capture-clip
      tabIndex={0}
      aria-label="Card strip · drag to scroll or use arrow keys"
      title={
        editing
          ? "Drag cards to move them. Shift + drag or drag the gaps to scroll."
          : "Drag to scroll · arrow keys also work"
      }
      onPointerDown={(e) => {
        if (
          e.button !== 0 ||
          e.pointerType === "touch" ||
          (editing &&
            !e.shiftKey &&
            (e.target as Element).closest(".study-card"))
        )
          return;
        start.current = {
          x: e.clientX,
          scroll: e.currentTarget.scrollLeft,
          moved: false,
        };
        suppress.current = false;
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        if (Math.abs(e.clientX - s.x) > 6) {
          s.moved = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.scrollLeft = s.scroll - (e.clientX - s.x);
        }
      }}
      onPointerUp={() => {
        suppress.current = !!start.current?.moved;
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onClickCapture={(e) => {
        if (suppress.current) {
          e.preventDefault();
          e.stopPropagation();
          suppress.current = false;
        }
      }}
      onDragStartCapture={(e) => {
        if (!editing || start.current) e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          e.currentTarget.scrollBy({
            left: e.key === "ArrowLeft" ? -120 : 120,
            behavior: "smooth",
          });
        }
      }}
    >
      {children}
    </div>
  );
}
