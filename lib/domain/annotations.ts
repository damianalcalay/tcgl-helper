import type { Mark } from "./table-top";
export function markBounds(mark: Mark) {
  const a = mark.points[0];
  if (mark.tool === "question") {
    const size = mark.size ?? 24 + mark.width * 2;
    return { x: a.x, y: a.y - size, width: size * 0.65, height: size * 1.2 };
  }
  const xs = mark.points.map((p) => p.x),
    ys = mark.points.map((p) => p.y);
  const width = Math.max(1, Math.max(...xs) - Math.min(...xs));
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width,
    height:
      mark.tool === "square"
        ? width
        : Math.max(1, Math.max(...ys) - Math.min(...ys)),
  };
}
export function translateMark(mark: Mark, x: number, y: number): Mark {
  return {
    ...mark,
    points: mark.points.map((p) => ({ x: p.x + x, y: p.y + y })),
  };
}
export function resizeMark(mark: Mark, width: number, height: number): Mark {
  const bounds = markBounds(mark);
  const sx = Math.max(8, width) / bounds.width,
    sy = Math.max(8, height) / bounds.height;
  if (mark.tool === "question") {
    const size = Math.min(240, Math.max(16, height / 1.2));
    return { ...mark, size, points: [{ x: bounds.x, y: bounds.y + size }] };
  }
  return {
    ...mark,
    points: mark.points.map((p) => ({
      x: bounds.x + (p.x - bounds.x) * sx,
      y: bounds.y + (p.y - bounds.y) * sy,
    })),
  };
}
