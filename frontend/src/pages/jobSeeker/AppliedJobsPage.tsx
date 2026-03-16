import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { ApplicationStatus, ApplicationWithJob } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";

const columns: Array<{ key: ApplicationStatus; label: string; variant: "blue" | "amber" | "teal" | "purple" | "red" }> = [
  { key: "APPLIED", label: "Applied", variant: "blue" },
  { key: "SHORTLISTED", label: "Viewed", variant: "amber" },
  { key: "INTERVIEW_SCHEDULED", label: "Interview", variant: "teal" },
  { key: "OFFERED", label: "Offer", variant: "purple" },
  { key: "REJECTED", label: "Rejected", variant: "red" },
  { key: "HIRED", label: "Hired", variant: "teal" },
];

const KanbanBoard = memo(function KanbanBoard({
  grouped,
  onSelect,
}: {
  grouped: Record<string, ApplicationWithJob[]>;
  onSelect: (item: ApplicationWithJob) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {columns.map((col) => (
        <div key={col.key} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-text-secondary">{col.label}</div>
            <Badge variant={col.variant}>{grouped[col.key]?.length ?? 0}</Badge>
          </div>
          <div className="space-y-3">
            {(grouped[col.key] ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                className="w-full rounded-2xl border border-border bg-surface-raised p-4 text-left transition hover:border-border-active"
                onClick={() => onSelect(a)}
              >
                <div className="text-sm font-semibold">{a.job.title}</div>
                <div className="text-xs text-text-secondary">
                  {a.job.companyName} · {a.job.location}
                </div>
                <div className="mt-2 text-xs text-text-muted">
                  Applied {new Date(a.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

export function AppliedJobsPage() {
  const { token } = useAuth();
  const [apps, setApps] = useState<ApplicationWithJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "list">("list");
  const [selected, setSelected] = useState<ApplicationWithJob | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        setError(null);
        const data = await apiJson<{ applications: ApplicationWithJob[] }>("/job-seeker/applications", { token });
        setApps(data.applications);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
          setApps([]);
          setError(null);
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to load applications");
      }
    })();
  }, [token]);

  const grouped = useMemo(() => {
    return columns.reduce<Record<string, ApplicationWithJob[]>>((acc, col) => {
      acc[col.key] = apps.filter((a) => a.status === col.key);
      return acc;
    }, {});
  }, [apps]);

  const showKanban = useCallback(() => setView("kanban"), []);
  const showList = useCallback(() => setView("list"), []);

  function statusMeta(status: ApplicationStatus) {
    return columns.find((c) => c.key === status) ?? columns[0];
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Applications</h2>
          <p className="text-sm text-text-secondary">Track your application status across the pipeline.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "kanban" ? "primary" : "secondary"} onClick={showKanban}>
            Pipeline
          </Button>
          <Button variant={view === "list" ? "primary" : "secondary"} onClick={showList}>
            List
          </Button>
        </div>
      </Card>

      {error ? <Card className="border-danger/60 bg-danger/10 text-danger">{error}</Card> : null}

      {apps.length === 0 ? (
        <Card>No applications yet.</Card>
      ) : view === "kanban" ? (
        <KanbanBoard grouped={grouped} onSelect={setSelected} />
      ) : (
        <Card className="space-y-3">
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 text-xs text-text-muted">
            <div>Role</div>
            <div>Company</div>
            <div>Status</div>
            <div>Applied</div>
          </div>
          {apps.map((a) => {
            const meta = statusMeta(a.status);
            return (
              <button
                key={a.id}
                type="button"
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr] items-center gap-4 rounded-xl border border-border bg-surface-raised px-4 py-3 text-left transition hover:border-border-active"
                onClick={() => setSelected(a)}
              >
                <div className="text-sm font-semibold">{a.job.title}</div>
                <div className="text-sm text-text-secondary">{a.job.companyName}</div>
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <div className="text-xs text-text-muted">{new Date(a.createdAt).toLocaleDateString()}</div>
              </button>
            );
          })}
        </Card>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected ? (() => {
          const meta = statusMeta(selected.status);
          return (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selected.job.title}</h3>
                  <div className="text-sm text-text-secondary">
                    {selected.job.companyName} · {selected.job.location}
                  </div>
                </div>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Timeline</div>
                <div className="flex flex-wrap gap-2">
                  {columns.map((col) => (
                    <Badge key={col.key} variant={col.key === selected.status ? col.variant : "blue"}>
                      {col.label}
                    </Badge>
                  ))}
                </div>
                {selected.interviewAt ? (
                  <div className="text-xs text-text-secondary">Interview: {new Date(selected.interviewAt).toLocaleString()}</div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Notes</div>
                <textarea
                  className="input"
                  value={notes[selected.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [selected.id]: e.target.value }))}
                  placeholder="Add private notes about this application"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button variant="danger" onClick={() => setSelected(null)}>
                  Withdraw Application
                </Button>
              </div>
            </div>
          );
        })() : null}
      </Modal>
    </div>
  );
}
