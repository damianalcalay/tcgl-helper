"use client";
import { useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
export function DeckImageViewer({
  url,
  name,
  compact = false,
}: {
  url?: string;
  name: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  if (!url)
    return (
      <div className={`image-empty ${compact ? "image-compact" : ""}`}>
        <ImageIcon size={28} />
        <span>No deck image</span>
        <small>Add a high-resolution image in the deck editor.</small>
      </div>
    );
  return (
    <>
      <Button
        variant="ghost"
        type="button"
        className={`deck-image ${compact ? "image-compact" : ""}`}
        onClick={() => {
          setOpen(true);
          setZoom(100);
        }}
        aria-label={`Open image of ${name}`}
      >
        <img src={url} alt={`${name} deck reference`} loading="lazy" />
        <span>
          <Maximize2 size={14} />
          View full image
        </span>
      </Button>
      {open && (
        <Modal
          wide
          title={`${name} · Deck image`}
          description="Zoom in and scroll to read every card."
          onClose={() => setOpen(false)}
        >
          <div className="image-tools">
            <Button
              variant="outline"
              aria-label="Zoom out"
              disabled={zoom <= 50}
              onClick={() => setZoom((z) => z - 25)}
            >
              <ZoomOut />
            </Button>
            <span>{zoom}%</span>
            <Button
              variant="outline"
              aria-label="Zoom in"
              disabled={zoom >= 400}
              onClick={() => setZoom((z) => z + 25)}
            >
              <ZoomIn />
            </Button>
            <Button variant="ghost" onClick={() => setZoom(100)}>
              Fit to width
            </Button>
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink />
                Original
              </a>
            </Button>
          </div>
          <div className="image-lightbox">
            <img
              src={url}
              alt={`${name} full-resolution deck reference`}
              style={{ width: `${zoom}%`, maxWidth: "none" }}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
