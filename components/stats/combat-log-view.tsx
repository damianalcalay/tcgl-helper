/* eslint-disable @next/next/no-img-element -- Small cached TCGdex thumbnails and a local card back. */
"use client";
import { useState } from "react";
import { AppData, CardPrinting, Match } from "@/types/domain";
import { cardNameKey } from "@/lib/domain/combat-log";
import { Modal } from "@/components/shared/modal";

export const CARD_BACKS = [
  { value: "classic", label: "Classic Pokémon" },
  { value: "teal", label: "Classic · Teal sleeve" },
  { value: "ruby", label: "Classic · Ruby sleeve" },
];
export function matchCardImage(
  data: AppData,
  match: Match,
  name: string,
): string | undefined {
  const roster = data.rosters.find(
    (r) =>
      r.match_id === match.id && cardNameKey(r.card_name) === cardNameKey(name),
  );
  const card = data.cards.find(
    (c) => cardNameKey(c.name) === cardNameKey(name),
  );
  const printing =
    roster?.printings?.[0] ??
    (card && data.deckCards.find((c) => c.card_id === card.id)?.printings?.[0]);
  return printing?.image_url?.replace("/high.webp", "/low.webp");
}
export function ReplayImage({
  name,
  src,
  back = "classic",
  hidden = false,
  onInspect,
}: {
  name?: string;
  src?: string;
  back?: string;
  hidden?: boolean;
  onInspect?: (name: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (hidden || !name)
    return (
      <img
        className={`replay-card-image card-back-${back}`}
        src="/card-back-classic.jpg"
        alt="Hidden card"
        draggable={false}
      />
    );
  return src && !failed ? (
    <img
      className="replay-card-image"
      src={src}
      alt={name}
      role={onInspect ? "button" : undefined}
      tabIndex={onInspect ? 0 : undefined}
      onClick={() => onInspect?.(name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInspect?.(name);
        }
      }}
      onError={() => setFailed(true)}
      draggable={false}
    />
  ) : (
    <div
      className="replay-image-placeholder"
      role={onInspect ? "button" : undefined}
      tabIndex={onInspect ? 0 : undefined}
      onClick={() => onInspect?.(name)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onInspect?.(name);
      }}
    >
      {name}
      <small>Image unavailable</small>
    </div>
  );
}
export { CombatLogView } from "./replay-workspace";
export function PrizeAvatar({
  name,
  printing,
}: {
  name: string;
  printing?: CardPrinting;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="prize-avatar"
        title={name}
        aria-label={name}
      >
        {printing?.image_url && !failed ? (
          <img
            alt={name}
            src={printing.image_url.replace("/high.webp", "/low.webp")}
            onError={() => setFailed(true)}
          />
        ) : (
          <span>?</span>
        )}
      </button>
      {open && (
        <CardInspection
          name={name}
          src={printing?.image_url}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CardInspection({
  name,
  src,
  onClose,
}: {
  name: string;
  src?: string;
  onClose: () => void;
}) {
  return (
    <Modal title={name} onClose={onClose}>
      <div className="card-inspection">
        <ReplayImage
          name={name}
          src={src?.replace("/low.webp", "/high.webp")}
        />
      </div>
    </Modal>
  );
}
