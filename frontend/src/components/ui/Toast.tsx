import { createContext, useCallback, useContext, useState, useRef } from "react";

/* ─── Types ─── */
export type ToastVariant = "success" | "info" | "error" | "loading";

type ToastItem = {
  id: number;
  variant: ToastVariant;
  message: string;
  exiting?: boolean;
};

type ToastCtx = {
  toast: (variant: ToastVariant, message: string, durationMs?: number) => number;
  dismiss: (id: number) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

let _nextId = 1;

/* ─── Provider ─── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 300);
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((variant: ToastVariant, message: string, durationMs = 3500) => {
    const id = _nextId++;
    setItems((prev) => [...prev, { id, variant, message }]);
    if (variant !== "loading") {
      const timer = setTimeout(() => dismiss(id), durationMs);
      timers.current.set(id, timer);
    }
    return id;
  }, [dismiss]);

  return (
    <Ctx.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainer items={items} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

/* ─── Icons ─── */
function IconCheck() {
  return <svg width="16" height="16" fill="none" viewBox="0 0 16 16" stroke="#22c55e" strokeWidth="2"><path d="M3 8.5l3 3 7-7" /></svg>;
}
function IconInfo() {
  return <svg width="16" height="16" fill="none" viewBox="0 0 16 16" stroke="#06b6d4" strokeWidth="2"><circle cx="8" cy="8" r="6"/><path d="M8 5v0m0 3v3"/></svg>;
}
function IconX() {
  return <svg width="16" height="16" fill="none" viewBox="0 0 16 16" stroke="#ef4444" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>;
}
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin" fill="none" stroke="#06b6d4" strokeWidth="2">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </svg>
  );
}

const BORDER_COLOR: Record<ToastVariant, string> = {
  success: "#22c55e",
  info: "#06b6d4",
  error: "#ef4444",
  loading: "#06b6d4",
};

const ICON: Record<ToastVariant, React.ReactNode> = {
  success: <IconCheck />,
  info: <IconInfo />,
  error: <IconX />,
  loading: <Spinner />,
};

/* ─── Container ─── */
function ToastContainer({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2" style={{ pointerEvents: "none" }}>
      {items.map((t) => (
        <div
          key={t.id}
          role="alert"
          onClick={() => onDismiss(t.id)}
          className={`flex items-center gap-3 rounded-xl border bg-[var(--surface-raised)] px-4 py-3 shadow-lift transition-all duration-300 cursor-pointer ${t.exiting ? "translate-y-2 opacity-0" : "animate-slide-in-up"}`}
          style={{ borderLeftWidth: 3, borderLeftColor: BORDER_COLOR[t.variant], pointerEvents: "auto", minWidth: 260, maxWidth: 380 }}
        >
          {ICON[t.variant]}
          <span className="text-sm text-[var(--text)]">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
