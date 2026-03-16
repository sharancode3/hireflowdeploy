import { useEffect, useState } from "react";
import { apiJson, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/PageSkeleton";

type Row = {
  applicationId: string;
  status: string;
  interviewAt: string | null;
  job: { id: string; title: string; companyName: string; location: string };
  candidate: {
    fullName: string;
    skills: string[];
    experienceYears: number;
    desiredRole?: string | null;
    location?: string | null;
    headline?: string | null;
  };
};

function IconCalendar() {
  return <svg width="14" height="14" fill="none" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="10" height="9" rx="1.5"/><path d="M5 1.5v2M9 1.5v2M2 6.5h10"/></svg>;
}

export function RecruiterInterviewSchedulePage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState<Record<string, string>>({});

  function toDateTimeLocalValue(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function normalizeToMinuteIso(localDateTime: string) {
    if (!localDateTime) return "";
    const d = new Date(localDateTime);
    if (Number.isNaN(d.getTime())) return "";
    d.setSeconds(0, 0);
    return d.toISOString();
  }

  async function loadRows() {
    if (!token) return;
    const data = await apiJson<{ applications: Row[] }>("/recruiter/applications?status=INTERVIEW_SCHEDULED", { token });
    setRows(data.applications);
  }

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        setError(null);
        await loadRows();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load interviews");
      }
    })();
  }, [token]);

  async function cancelInterview(applicationId: string) {
    if (!token || busyId) return;
    setBusyId(applicationId);
    setError(null);
    try {
      await apiJson(`/recruiter/applications/${applicationId}`, {
        method: "DELETE",
        token,
      });
      await loadRows();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to cancel interview");
    } finally {
      setBusyId(null);
    }
  }

  async function editInterviewDate(applicationId: string, nextLocalDate: string) {
    if (!token || busyId) return;
    const nextIso = normalizeToMinuteIso(nextLocalDate);
    if (!nextIso) return;

    setBusyId(applicationId);
    setError(null);
    try {
      await apiJson(`/recruiter/applications/${applicationId}`, {
        method: "PATCH",
        token,
        body: { status: "INTERVIEW_SCHEDULED", interviewAt: nextIso },
      });
      await loadRows();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to update interview date");
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null && !error) return <TableSkeleton cols={4} rows={3} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Interview Schedule</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">All upcoming scheduled interviews.</p>
      </div>

      {error && <Card className="border-[var(--danger)]/30 p-4 text-sm text-[var(--danger)]">{error}</Card>}

      {rows && rows.length === 0 ? (
        <EmptyState
          title="No interviews scheduled"
          description="Schedule interviews from the Applicants page."
          icon={
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="opacity-60">
              <rect x="16" y="20" width="48" height="40" rx="6" stroke="var(--border-active)" strokeWidth="2" strokeDasharray="4 3" />
              <path d="M28 12v10M52 12v10M16 34h48" stroke="var(--accent-purple)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="40" cy="50" r="5" stroke="var(--accent-purple)" strokeWidth="2" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-3 stagger-list">
          {rows?.map((r) => (
            <Card key={r.applicationId} className="p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[var(--accent-purple)]/10 flex items-center justify-center text-xs font-bold text-[var(--accent-purple)]">
                    {r.candidate.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{r.candidate.fullName}</div>
                    <div className="text-xs text-[var(--muted)]">{r.job.title} &middot; {r.job.location}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {r.candidate.experienceYears} yrs
                      {r.candidate.desiredRole ? ` • ${r.candidate.desiredRole}` : ""}
                      {r.candidate.location ? ` • ${r.candidate.location}` : ""}
                    </div>
                    {r.candidate.headline ? <div className="text-[11px] text-[var(--muted)]">{r.candidate.headline}</div> : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="purple">Interview</Badge>
                  {r.interviewAt && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <IconCalendar />
                      {new Date(r.interviewAt).toLocaleString()}
                    </div>
                  )}
                  <Button
                    variant="danger"
                    className="text-xs"
                    disabled={busyId === r.applicationId}
                    onClick={() => void cancelInterview(r.applicationId)}
                  >
                    {busyId === r.applicationId ? "Cancelling..." : "Cancel Interview"}
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(() => {
                  const currentValue = draftDate[r.applicationId] ?? (r.interviewAt ? toDateTimeLocalValue(r.interviewAt) : "");
                  const nextIso = normalizeToMinuteIso(currentValue);
                  const currentIso = r.interviewAt ? normalizeToMinuteIso(r.interviewAt) : "";
                  const unchanged = Boolean(nextIso) && nextIso === currentIso;
                  return (
                    <>
                      <input
                        type="datetime-local"
                        className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] min-w-0 sm:w-auto"
                        value={currentValue}
                        onChange={(e) => setDraftDate((prev) => ({ ...prev, [r.applicationId]: e.target.value }))}
                      />
                      <Button
                        variant="secondary"
                        className="text-xs"
                        disabled={busyId === r.applicationId || !currentValue || unchanged}
                        onClick={() => void editInterviewDate(r.applicationId, currentValue)}
                      >
                        {busyId === r.applicationId ? "Saving..." : "Edit Date"}
                      </Button>
                    </>
                  );
                })()}
              </div>
              {r.candidate.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {r.candidate.skills.slice(0, 6).map((s) => (
                    <span key={s} className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">{s}</span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
