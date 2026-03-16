import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { NotificationItem } from "../types";
import { Logo } from "./Logo";

function formatAgo(value: string) {
  const ms = Date.now() - new Date(value).getTime();
  const h = Math.floor(ms / (1000 * 60 * 60));
  if (h < 1) return "Just now";
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

function typeColor(type: string) {
  const t = type.toLowerCase();
  if (t.includes("application")) return "var(--color-accent)";
  if (t.includes("deadline")) return "var(--color-warning)";
  if (t.includes("match")) return "var(--color-success)";
  if (t.includes("admin")) return "var(--accent-purple)";
  return "var(--color-text-secondary)";
}

export function AppTopBar({
  onMenuToggle,
  onSidebarToggle,
  sidebarCollapsed,
}: {
  onMenuToggle?: () => void;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
}) {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const settingsPath = user?.role === "JOB_SEEKER" ? "/job-seeker/settings" : "/recruiter/settings";
  const fullNotificationsPath = user?.role === "JOB_SEEKER" ? "/job-seeker/notifications" : "/recruiter/notifications";

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const data = await apiJson<{ notifications: NotificationItem[] }>("/notifications", { token });
        setItems(data.notifications);
      } catch {
        setItems([]);
      }
    }
    void load();
  }, [token]);

  const unread = useMemo(() => items.filter((n) => !n.isRead).length, [items]);

  async function markAllRead() {
    if (!token) return;
    await apiJson<{ ok: boolean }>("/notifications/read-all", { method: "POST", token });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function openNotification(n: NotificationItem) {
    if (!token) return;
    if (!n.isRead) {
      await apiJson<{ ok: boolean }>(`/notifications/${n.id}/read`, { method: "POST", token });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    setOpen(false);
    navigate(fullNotificationsPath);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-topbar-bg)] backdrop-blur-[12px]">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-raised lg:hidden"
              onClick={onMenuToggle}
              aria-label="Open mobile menu"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5h12M3 9h12M3 13h12" /></svg>
            </button>
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-raised lg:flex"
              onClick={onSidebarToggle}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={!sidebarCollapsed}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3l4 5-4 5" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3L6 8l4 5" /></svg>
              )}
            </button>
            <Logo />
          </div>

          <button
            type="button"
            className="hidden min-w-[260px] items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted transition hover:border-border-active hover:text-text md:flex"
            onClick={() =>
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
            }
            aria-label="Open search"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <span className="flex-1 text-left">Search...</span>
            <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] leading-none text-text-muted">Ctrl K</kbd>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-raised"
              onClick={() => setOpen(true)}
              aria-label="Open notifications"
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2a3 3 0 00-3 3v1.4c0 .8-.2 1.6-.6 2.3L3.5 10h9l-.9-1.3A4.7 4.7 0 0111 6.4V5a3 3 0 00-3-3z" />
                <path d="M6.5 12.5a1.5 1.5 0 003 0" />
              </svg>
              {unread > 0 ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" /> : null}
            </button>

            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised text-xs font-semibold ring-2 ring-[var(--color-accent)]">
                  {(user?.email?.slice(0, 2) ?? "HF").toUpperCase()}
                </div>
              </summary>
              <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-border bg-surface-raised p-4 shadow-lift">
                <div className="text-sm font-semibold text-text">{user?.email}</div>
                <div className="mt-3 flex flex-col gap-2">
                  <NavLink to={settingsPath} className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface">
                    Settings
                  </NavLink>
                  <button
                    className="rounded-lg bg-[linear-gradient(90deg,var(--color-accent),var(--color-accent-hover))] px-3 py-2 text-sm font-medium text-[var(--color-sidebar-active-text)]"
                    onClick={logout}
                    type="button"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-[var(--color-overlay)]" onClick={() => setOpen(false)} aria-label="Close notifications" />
          <aside className="fixed right-0 top-0 z-50 h-full w-[88vw] max-w-[340px] animate-slide-in-right-spring border-l border-border bg-[var(--color-bg-secondary)] p-4 sm:w-[320px]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">Notifications</h3>
              <button type="button" className="text-xs text-[var(--color-accent)] hover:text-text" onClick={() => void markAllRead()}>
                Mark all as read
              </button>
            </div>

            <div className="h-[calc(100%-84px)] space-y-3 overflow-y-auto pr-1">
              {items.length === 0 ? <div className="text-sm text-text-muted">No notifications yet.</div> : null}
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void openNotification(n)}
                  className={`w-full rounded-xl border p-3 text-left transition hover:border-border-active ${
                    n.isRead
                      ? "border-border bg-surface"
                      : "border-[color:color-mix(in_srgb,var(--color-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--color-accent)_12%,transparent)]"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold" style={{ color: typeColor(n.type) }}>{n.type}</span>
                    <span className="text-[11px] text-text-muted">{formatAgo(n.createdAt)}</span>
                  </div>
                  <div className="text-sm text-text">{n.message}</div>
                </button>
              ))}
            </div>

            <NavLink to={fullNotificationsPath} className="mt-3 block text-sm font-medium text-[var(--color-accent)] hover:text-text" onClick={() => setOpen(false)}>
              View all notifications
            </NavLink>
          </aside>
        </>
      ) : null}
    </>
  );
}
