import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

type EmptyStateProps = {
  /** Inline SVG illustration — keep it small (80×80) */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary CTA */
  action?: ReactNode;
  className?: string;
};

/* Default illustration — a friendly empty-box SVG */
function DefaultIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="opacity-60">
      <rect x="16" y="24" width="48" height="36" rx="6" stroke="var(--border-active)" strokeWidth="2" strokeDasharray="4 3" />
      <path d="M32 44h16M36 50h8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="36" r="4" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center animate-fade-in",
        className,
      )}
    >
      <div className="mb-4">{icon ?? <DefaultIllustration />}</div>
      <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--muted)]">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
