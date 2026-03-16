import type { HTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type BadgeVariant = "blue" | "teal" | "purple" | "amber" | "red" | "green";

const badgeStyles: Record<BadgeVariant, { backgroundColor: string; borderColor: string; color: string }> = {
  blue: {
    backgroundColor: "rgba(26,115,232,0.1)",
    borderColor: "rgba(26,115,232,0.3)",
    color: "#1A73E8",
  },
  teal: {
    backgroundColor: "rgba(92,107,192,0.1)",
    borderColor: "rgba(92,107,192,0.3)",
    color: "#5C6BC0",
  },
  purple: {
    backgroundColor: "rgba(123,94,167,0.1)",
    borderColor: "rgba(123,94,167,0.3)",
    color: "#7B5EA7",
  },
  amber: {
    backgroundColor: "rgba(234,88,12,0.1)",
    borderColor: "rgba(234,88,12,0.3)",
    color: "#EA580C",
  },
  red: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.3)",
    color: "#EF4444",
  },
  green: {
    backgroundColor: "rgba(34,197,94,0.1)",
    borderColor: "rgba(34,197,94,0.3)",
    color: "#22C55E",
  },
};

export function Badge({
  className,
  variant = "blue",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", className)}
      style={badgeStyles[variant]}
      {...props}
    />
  );
}
