import { useEffect, useRef, useState } from "react";

/**
 * Animate a number from 0 to `target` over `durationMs` using requestAnimationFrame.
 */
export function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / durationMs, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
      }
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, durationMs]);

  return value;
}
