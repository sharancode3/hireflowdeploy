import { useState } from "react";
import { NavLink } from "react-router-dom";

export function Logo({
  to = "/",
  variant = "full",
}: {
  to?: string;
  variant?: "full" | "mark";
}) {
  const [hasImage, setHasImage] = useState(true);

  return (
    <NavLink
      to={to}
      className="flex items-center gap-2"
      aria-label="Hireflow Home"
      data-has-image={hasImage ? "true" : "false"}
      data-variant={variant}
    >
      {hasImage ? (
        <img
          className="h-9 w-9 rounded-xl border border-border bg-surface"
          src="/vite.svg"
          alt="Hireflow"
          loading="eager"
          decoding="async"
          onError={() => setHasImage(false)}
        />
      ) : (
        <span className="h-9 w-9 rounded-xl border border-border bg-surface" aria-hidden="true" />
      )}
      {variant === "full" ? <span className="text-base font-semibold tracking-tight">Hireflow</span> : null}
    </NavLink>
  );
}
