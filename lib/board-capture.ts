/** Canvas capture of the board only: cards, badges, attachments and annotations. */
export async function captureBoard(board: HTMLElement): Promise<Blob> {
  const bounds = board.getBoundingClientRect();
  const scale = Math.max(2, 1920 / bounds.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bounds.width * scale);
  canvas.height = Math.round(bounds.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = getComputedStyle(board).backgroundColor;
  ctx.fillRect(0, 0, bounds.width, bounds.height);
  const loaded = new Map<string, HTMLImageElement>();
  const pending = new Map<string, Promise<HTMLImageElement>>();
  function load(src: string): Promise<HTMLImageElement> {
    if (!pending.has(src)) pending.set(src, loadImage(src));
    return pending.get(src)!;
  }
  async function loadImage(src: string) {
    if (loaded.has(src)) return loaded.get(src)!;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src =
      new URL(src, location.href).origin === location.origin
        ? src
        : `/api/replay-image?url=${encodeURIComponent(src)}`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(
          new Error(
            "A card image could not be loaded. Try again before saving.",
          ),
        );
    });
    loaded.set(src, img);
    return img;
  }
  const nodes = [
    ...board.querySelectorAll<HTMLElement>(
      "[data-capture-card], [data-capture-text], [data-capture-attachment]",
    ),
  ];
  await Promise.all(
    nodes.flatMap((node) =>
      [...node.querySelectorAll<HTMLImageElement>("img")].map((img) =>
        load(img.src),
      ),
    ),
  );
  for (const node of nodes) {
    const rect = node.getBoundingClientRect(),
      style = getComputedStyle(node);
    const x = rect.left - bounds.left,
      y = rect.top - bounds.top;
    ctx.save();
    const clip = node.closest<HTMLElement>("[data-capture-clip]");
    if (clip) {
      const r = clip.getBoundingClientRect();
      ctx.beginPath();
      ctx.rect(r.left - bounds.left, r.top - bounds.top, r.width, r.height);
      ctx.clip();
    }
    const img = node.querySelector<HTMLImageElement>("img");
    if (img) {
      if (node.hasAttribute("data-capture-attachment")) {
        ctx.beginPath();
        ctx.ellipse(
          x + rect.width / 2,
          y + rect.height / 2,
          rect.width / 2,
          rect.height / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.clip();
      }
      ctx.filter = getComputedStyle(img).filter;
      const loadedImage = loaded.get(img.src)!;
      if (node.hasAttribute("data-capture-attachment")) {
        const crop = Math.min(loadedImage.width, loadedImage.height) * 0.45;
        ctx.drawImage(
          loadedImage,
          (loadedImage.width - crop) / 2,
          (loadedImage.height - crop) / 2,
          crop,
          crop,
          x,
          y,
          rect.width,
          rect.height,
        );
      } else ctx.drawImage(loadedImage, x, y, rect.width, rect.height);
    } else {
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(x, y, rect.width, rect.height);
      ctx.fillStyle = style.color;
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = node.textContent ?? "";
      // Placeholder cards keep their label readable rather than silently omitting unavailable art.
      const words = text.split(/\s+/);
      let line = "",
        row = 0;
      for (const word of words) {
        if (ctx.measureText(line + word).width > rect.width - 8 && line) {
          ctx.fillText(line, x + rect.width / 2, y + 20 + row++ * 16);
          line = "";
        }
        line += word + " ";
      }
      ctx.fillText(
        line.trim(),
        x + rect.width / 2,
        node.hasAttribute("data-capture-card")
          ? y + 20 + row * 16
          : y + rect.height / 2,
      );
    }
    ctx.restore();
  }
  const svg = board.querySelector<SVGSVGElement>(".table-annotations");
  if (svg) {
    const clean = svg.cloneNode(true) as SVGSVGElement;
    clean
      .querySelectorAll("[data-editor-only]")
      .forEach((node) => node.remove());
    const source = new XMLSerializer().serializeToString(clean);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    await img.decode();
    ctx.drawImage(img, 0, 0, bounds.width, bounds.height);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Could not create the board image.")),
      "image/png",
    ),
  );
}
