"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
let scrollLocks = 0;
let restoreScroll = () => {};
function lockPageScroll() {
  if (scrollLocks++ === 0) {
    const root = document.documentElement,
      body = document.body;
    const rootOverflow = root.style.overflow,
      bodyOverflow = body.style.overflow,
      padding = body.style.paddingRight;
    const gutter = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (gutter)
      body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + gutter}px`;
    restoreScroll = () => {
      root.style.overflow = rootOverflow;
      body.style.overflow = bodyOverflow;
      body.style.paddingRight = padding;
    };
  }
  return () => {
    if (--scrollLocks === 0) restoreScroll();
  };
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
  busy = false,
  closeOnBackdrop = true,
  className = "",
  bare = false,
  hideClose = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  bare?: boolean;
  hideClose?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const unlock = lockPageScroll();
    return () => {
      dialog?.close();
      unlock();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""} ${bare ? "modal-bare" : ""} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && closeOnBackdrop) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        {!bare && (
          <div className="modal-header">
            <div>
              <h2>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            {!hideClose && (
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X />
              </Button>
            )}
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onClose,
  pending,
  error,
  label = "Delete",
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
  error?: string;
  label?: string;
}) {
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      busy={pending}
      hideClose
    >
      <div role="alertdialog" aria-label={title}>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <Button
            autoFocus
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Please wait…" : label}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
export function ErrorMessage({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="error-message">
      {error}
    </p>
  ) : null;
}
