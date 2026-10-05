"use client";
import { useState } from "react";
import type { CardPrinting } from "@/types/domain";
import { Modal } from "@/components/shared/modal";

export function PrizeThumbnail({
  printing,
  name,
  copyNumber,
  onRemove,
}: {
  printing?: CardPrinting;
  name: string;
  copyNumber: number;
  onRemove: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className="prize-thumbnail"
      aria-label={`Remove ${name} copy ${copyNumber} from Prizes`}
      title={`${name} · Copy ${copyNumber}. Return to Available.`}
      onClick={onRemove}
    >
      {printing?.image_url && !failed ? (
        <img
          src={printing.image_url.replace("/high.webp", "/low.webp")}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="prize-image-placeholder">
          {name}
          <small>Image unavailable</small>
        </span>
      )}
      <strong>{name}</strong>
      <small>
        {printing
          ? `${printing.set_code} #${printing.collector_number} · `
          : ""}
        Copy {copyNumber}
      </small>
      <span className="prize-remove-label">Click to remove</span>
    </button>
  );
}

function PrintingImage({
  printing,
  name,
}: {
  printing: CardPrinting;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      {printing.image_url && !failed ? (
        <button
          type="button"
          className="printing-image-button"
          aria-label={`Enlarge ${name} ${printing.set_code} ${printing.collector_number}`}
          onClick={() => setOpen(true)}
        >
          <img
            src={printing.image_url.replace("/high.webp", "/low.webp")}
            alt={`${name} ${printing.set_code} ${printing.collector_number}`}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </button>
      ) : (
        <div className="printing-image-placeholder">
          {name}
          <small>Image unavailable</small>
        </div>
      )}
      {open && (
        <Modal
          title={name}
          description={`${printing.set_name ?? printing.set_code} · ${printing.collector_number}`}
          onClose={() => setOpen(false)}
        >
          <img
            src={printing.image_url}
            alt={name}
            className="printing-enlarged"
          />
        </Modal>
      )}
    </>
  );
}
export function PrintingImages({
  printings,
  name,
  compact = false,
}: {
  printings?: CardPrinting[];
  name: string;
  compact?: boolean;
}) {
  if (!printings?.length)
    return (
      <div className="field-hint">Import a deck list to add card images.</div>
    );
  return (
    <div className={`printing-images ${compact ? "printing-compact" : ""}`}>
      {printings.map((p, index) => (
        <figure key={`${p.set_code}:${p.collector_number}:${index}`}>
          <PrintingImage printing={p} name={name} />
          <figcaption>
            <strong>{p.set_name ?? p.set_code}</strong>
            <span>
              ×{p.quantity} · {p.set_code} · #{p.collector_number}
              {p.regulation_mark
                ? ` · Regulation ${p.regulation_mark}`
                : " · Regulation —"}
            </span>
            {p.series_name && <small>{p.series_name}</small>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
