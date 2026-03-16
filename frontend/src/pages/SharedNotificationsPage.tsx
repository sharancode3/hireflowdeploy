import { useEffect, useState } from "react";
import { apiJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { NotificationItem } from "../types";

export function SharedNotificationsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    try {
      setError(null);
      const data = await apiJson<{ notifications: NotificationItem[] }>("/notifications", { token });
      setItems(data.notifications);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function markRead(id: string) {
    if (!token) return;
    await apiJson<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST", token });
    await load();
  }

  return (
    <div className="grid">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Notifications</h2>
        <p className="muted" style={{ margin: 0 }}>
          Job updates, application status, and interview notifications.
        </p>
      </div>

      {error ? <div className="card">{error}</div> : null}

      {items.length === 0 ? (
        <div className="card">
          No notifications yet.
        </div>
      ) : (
        <div className="grid">
          {items.map((n) => (
            <div key={n.id} className="card" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span className={n.isRead ? "badge" : "badge badge-accent"}>{n.type}</span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              <div style={{ fontWeight: 700 }}>{n.message}</div>
              {!n.isRead ? (
                <button type="button" className="btn" onClick={() => void markRead(n.id)}>
                  Mark as read
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
