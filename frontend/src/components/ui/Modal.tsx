import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 animate-modal-backdrop bg-[var(--color-overlay)] backdrop-blur"
        onClick={onClose}
      />
      <div className={cn("relative z-10 w-full max-w-2xl animate-modal-pop rounded-2xl border border-border bg-surface-raised p-6")}>{children}</div>
    </div>
  );
}
