import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, id, ...props },
  ref,
) {
  return (
    <label className="flex w-full flex-col gap-1.5 text-sm text-text-secondary" htmlFor={id}>
      {label ? <span>{label}</span> : null}
      <input
        ref={ref}
        id={id}
        className={cn("input-base", error && "border-danger focus:border-danger focus:ring-danger/30", className)}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
});
