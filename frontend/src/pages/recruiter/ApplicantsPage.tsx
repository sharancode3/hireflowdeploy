import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiJson, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { openResumePreview } from "../../utils/resumePreview";
import type { Job } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/PageSkeleton";

type ApplicantRow = {
  applicationId: string;
  status: string;
  interviewAt: string | null;
  job?: { id: string; title: string; companyName?: string; location?: string };
  candidate: {
    id: string;
    fullName: string;
    location?: string | null;
    phone?: string | null;
    headline?: string | null;
    about?: string | null;
    desiredRole?: string | null;
    isFresher?: boolean;
    skills: string[];
    experienceYears: number;
    latestResume: { id: string; originalName: string } | null;
  };
};

const STATUS_BADGE: Record<string, { variant: "blue" | "teal" | "purple" | "amber" | "red"; label: string }> = {
  APPLIED: { variant: "blue", label: "Applied" },
  SHORTLISTED: { variant: "teal", label: "Shortlisted" },
  INTERVIEW_SCHEDULED: { variant: "purple", label: "Interview" },
  OFFERED: { variant: "amber", label: "Offered" },
  REJECTED: { variant: "red", label: "Rejected" },
  HIRED: { variant: "teal", label: "Hired" },
};

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

export function RecruiterApplicantsPage() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const selectedJobId = params.get("jobId") ?? "";
  const [skill, setSkill] = useState("");
  const [rows, setRows] = useState<ApplicantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<"ALL" | keyof typeof STATUS_BADGE>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const jobOptions = useMemo(() => jobs.map((j) => ({ id: j.id, label: `${j.title} (${j.location})` })), [jobs]);

  const pipelineCounts = useMemo(() => {
    return {
      ALL: rows.length,
      APPLIED: rows.filter((r) => r.status === "APPLIED").length,
      SHORTLISTED: rows.filter((r) => r.status === "SHORTLISTED").length,
      INTERVIEW_SCHEDULED: rows.filter((r) => r.status === "INTERVIEW_SCHEDULED").length,
      OFFERED: rows.filter((r) => r.status === "OFFERED").length,
      REJECTED: rows.filter((r) => r.status === "REJECTED").length,
      HIRED: rows.filter((r) => r.status === "HIRED").length,
    };
  }, [rows]);

  const visibleRows = useMemo(
    () => (statusFilter === "ALL" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  useEffect(() => {
    setSelectedIds([]);
  }, [selectedJobId, statusFilter, rows.length]);

  async function loadJobs() {
    if (!token) return;
    const data = await apiJson<{ jobs: Job[] }>("/recruiter/jobs", { token });
    setJobs(data.jobs);
  }

  async function loadApplicants(jobId: string) {
    if (!token || !jobId) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (skill.trim()) qs.set("skill", skill.trim());
    const data = await apiJson<{ applicants: ApplicantRow[] }>(`/recruiter/jobs/${jobId}/applicants?${qs.toString()}`, { token });
    setRows(data.applicants);
    setLoading(false);
  }

  async function loadAllApplications() {
    if (!token) return;
    setLoading(true);
    const data = await apiJson<{ applications: ApplicantRow[] }>("/recruiter/applications", { token });
    const normalized = (data.applications || []).filter((row) => {
      if (!skill.trim()) return true;
      const requiredSkill = skill.trim().toLowerCase();
      return (row.candidate.skills || []).some((s) => String(s).toLowerCase().includes(requiredSkill));
    });
    setRows(normalized);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      if (!token) return;
      try { setError(null); await loadJobs(); } catch (e) { setError(e instanceof Error ? e.message : "Failed to load jobs"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        if (selectedJobId) {
          await loadApplicants(selectedJobId);
          return;
        }
        await loadAllApplications();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load applicants");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, token]);

  async function updateStatus(applicationId: string, status: string, interviewAt?: string | null) {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      const body: { status: string; interviewAt?: string | null } = { status };
      if (interviewAt !== undefined) body.interviewAt = interviewAt;
      await apiJson(`/recruiter/applications/${applicationId}`, { method: "PATCH", token, body });
      if (selectedJobId) {
        await loadApplicants(selectedJobId);
      } else {
        await loadAllApplications();
      }
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to update status");
    } finally { setBusy(false); }
  }

  async function bulkUpdate(status: string) {
    if (!selectedIds.length) return;
    for (const id of selectedIds) {
      // Sequential updates keep UX state deterministic with mock API latency.
      await updateStatus(id, status);
    }
    setSelectedIds([]);
  }

  const inputCls = "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Applicants</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Review candidates, shortlist, reject, or schedule interviews.</p>
      </div>

      {error && <Card className="border-[var(--danger)]/30 p-4 text-sm text-[var(--danger)]">{error}</Card>}

      {/* Filters */}
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-3 items-end">
          <div>
            <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Job</label>
            <select
              className={inputCls}
              value={selectedJobId}
              onChange={(e) => setParams((prev) => { prev.set("jobId", e.target.value); return prev; })}
            >
              <option value="">All jobs</option>
              {jobOptions.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Filter by Skill</label>
            <input className={inputCls} value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. React" />
          </div>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void (selectedJobId ? loadApplicants(selectedJobId) : loadAllApplications())}
            className="h-10"
          >
            Apply Filter
          </Button>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <TableSkeleton cols={5} rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState title="No applicants yet" description="No one has applied to this position yet." />
      ) : (
        <div className="space-y-3 stagger-list">
          <Card className="p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Pipeline</div>
            <div className="flex flex-wrap gap-2">
              {([
                "ALL",
                "APPLIED",
                "SHORTLISTED",
                "INTERVIEW_SCHEDULED",
                "OFFERED",
                "HIRED",
                "REJECTED",
              ] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={statusFilter === k}
                  className={`btn ${statusFilter === k ? "btn-primary" : ""}`}
                  onClick={() => setStatusFilter(k)}
                >
                  {k === "ALL" ? "All" : (STATUS_BADGE[k]?.label ?? k)} ({pipelineCounts[k]})
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedIds(visibleRows.map((r) => r.applicationId))}
              >
                Select All ({visibleRows.length})
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedIds([])}
              >
                Clear Selection
              </button>
              <Button
                variant="secondary"
                className="text-xs"
                disabled={busy || selectedIds.length === 0}
                onClick={() => void bulkUpdate("SHORTLISTED")}
              >
                Bulk Shortlist ({selectedIds.length})
              </Button>
              <Button
                variant="danger"
                className="text-xs"
                disabled={busy || selectedIds.length === 0}
                onClick={() => void bulkUpdate("REJECTED")}
              >
                Bulk Reject ({selectedIds.length})
              </Button>
            </div>
          </Card>

          {visibleRows.map((r) => {
            const sb = STATUS_BADGE[r.status] ?? { variant: "blue" as const, label: r.status };
            return (
              <Card key={r.applicationId} className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Candidate info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.applicationId)}
                        aria-label={`Select applicant ${r.candidate.fullName}`}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) =>
                              prev.includes(r.applicationId) ? prev : [...prev, r.applicationId]
                            );
                            return;
                          }
                          setSelectedIds((prev) => prev.filter((id) => id !== r.applicationId));
                        }}
                        className="accent-[var(--accent)]"
                      />
                      <div className="h-9 w-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                        {r.candidate.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{r.candidate.fullName}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {r.candidate.experienceYears} yrs experience
                          {r.candidate.desiredRole ? ` • ${r.candidate.desiredRole}` : ""}
                          {r.candidate.location ? ` • ${r.candidate.location}` : ""}
                        </div>
                        {r.job?.title ? <div className="text-[11px] text-[var(--muted)]">Applied for: {r.job.title}</div> : null}
                        {r.candidate.phone ? <div className="text-[11px] text-[var(--muted)]">Phone: {r.candidate.phone}</div> : null}
                        {r.candidate.headline ? <div className="text-[11px] text-[var(--muted)]">{r.candidate.headline}</div> : null}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.candidate.skills.slice(0, 6).map((s) => (
                        <span key={s} className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">{s}</span>
                      ))}
                    </div>
                  </div>

                  {/* Status + Actions */}
                  <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end sm:shrink-0">
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                    {r.interviewAt && <div className="text-[10px] text-[var(--muted)]">{new Date(r.interviewAt).toLocaleString()}</div>}
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                      {r.candidate.latestResume ? (
                        <Button variant="ghost" className="text-xs" onClick={() => void openResumePreview(r.candidate.latestResume!.id, token!)}>Resume</Button>
                      ) : <span className="text-xs text-[var(--muted)]">No resume</span>}
                      {(() => {
                        const interviewLocked = r.status === "INTERVIEW_SCHEDULED" && Boolean(r.interviewAt);
                        const isShortlistedLocked = r.status === "SHORTLISTED" || interviewLocked;
                        return (
                      <Button
                        variant="secondary"
                        className="text-xs"
                        disabled={busy || isShortlistedLocked}
                        onClick={() => void updateStatus(r.applicationId, "SHORTLISTED")}
                      >
                        {isShortlistedLocked ? "Shortlisted" : "Shortlist"}
                      </Button>
                        );
                      })()}
                      <Button variant="danger" className="text-xs" disabled={busy} onClick={() => void updateStatus(r.applicationId, "REJECTED")}>Reject</Button>
                    </div>
                    {/* Schedule interview */}
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      {(() => {
                        const currentValue = schedule[r.applicationId] ?? (r.interviewAt ? toDateTimeLocalValue(r.interviewAt) : "");
                        const nextIso = normalizeToMinuteIso(currentValue);
                        const currentIso = r.interviewAt ? normalizeToMinuteIso(r.interviewAt) : "";
                        const isAlreadyScheduled = r.status === "INTERVIEW_SCHEDULED" && Boolean(r.interviewAt);
                        const isSameSchedule = Boolean(nextIso) && nextIso === currentIso;
                        return (
                          <>
                      <input
                        type="datetime-local"
                        className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] min-w-0 sm:w-auto"
                        value={currentValue}
                        onChange={(e) => setSchedule({ ...schedule, [r.applicationId]: e.target.value })}
                      />
                      <Button
                        variant="secondary"
                        className="text-xs"
                        disabled={busy || !currentValue || isSameSchedule}
                        onClick={() => void updateStatus(r.applicationId, "INTERVIEW_SCHEDULED", nextIso)}
                      >
                        {isAlreadyScheduled ? "Edit Interview Date" : "Set Interview Date"}
                      </Button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {visibleRows.length === 0 ? (
            <EmptyState title="No applicants in this stage" description="Pick a different pipeline stage to review candidates." />
          ) : null}
        </div>
      )}
    </div>
  );
}
