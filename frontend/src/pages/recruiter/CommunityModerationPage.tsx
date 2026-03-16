import { useMemo, useState } from "react";
import { listComplaintTickets, updateComplaintTicket } from "../../community/storage";

type Stage = "ALL" | "OPEN" | "IN_REVIEW" | "RESOLVED";

export function RecruiterCommunityModerationPage() {
  const [stage, setStage] = useState<Stage>("OPEN");
  const [version, setVersion] = useState(0);

  const tickets = useMemo(() => {
    const all = listComplaintTickets();
    return stage === "ALL" ? all : all.filter((t) => t.status === stage);
  }, [stage, version]);

  function updateStatus(id: string, status: "OPEN" | "IN_REVIEW" | "RESOLVED") {
    updateComplaintTicket(id, { status });
    setVersion((v) => v + 1);
  }

  function saveNote(id: string, note: string) {
    updateComplaintTicket(id, { adminNote: note.trim() || undefined });
    setVersion((v) => v + 1);
  }

  return (
    <div className="space-y-4">
      <div className="card-base">
        <h1 className="text-2xl font-semibold">Community Moderation</h1>
        <p className="mt-2 text-sm text-text-secondary">Review user complaints, set status, and leave internal resolution notes.</p>
      </div>

      <div className="card-base">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "OPEN", "IN_REVIEW", "RESOLVED"] as const).map((s) => (
            <button key={s} type="button" className={`btn ${stage === s ? "btn-primary" : ""}`} onClick={() => setStage(s)}>
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {tickets.length === 0 ? (
          <div className="card-base text-sm text-text-muted">No tickets in this stage.</div>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="card-base">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text">{t.subject}</div>
                  <div className="text-xs text-text-muted">{t.category} • by {t.creatorLabel} ({t.role})</div>
                </div>
                <div className="text-xs text-text-muted">{new Date(t.createdAt).toLocaleString()}</div>
              </div>

              <p className="text-sm text-text-secondary">{t.details}</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn" onClick={() => updateStatus(t.id, "OPEN")}>Open</button>
                  <button type="button" className="btn" onClick={() => updateStatus(t.id, "IN_REVIEW")}>In Review</button>
                  <button type="button" className="btn btn-primary" onClick={() => updateStatus(t.id, "RESOLVED")}>Resolve</button>
                </div>

                <input
                  className="input"
                  defaultValue={t.adminNote ?? ""}
                  placeholder="Admin note (optional)"
                  onBlur={(e) => saveNote(t.id, e.target.value)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
