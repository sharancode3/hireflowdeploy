import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Drawer({
  open,
  onClose,
  children,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: "right" | "left";
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute top-0 h-full w-full max-w-xl animate-scale-in border border-border bg-surface-raised p-6 shadow-lift",
          side === "right" ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
