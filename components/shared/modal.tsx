"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
  busy = false,
  closeOnBackdrop = true,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && closeOnBackdrop) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </Button>
        </div>
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
