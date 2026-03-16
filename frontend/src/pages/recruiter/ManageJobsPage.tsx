import { useEffect, useState } from "react";
import { apiJson, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Job, JobType } from "../../types";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageSkeleton } from "../../components/ui/PageSkeleton";
import {
  getRecruiterJobListingPreferences,
  updateRecruiterJobListingPreferences,
} from "../../services/recruiterJobListingPrefs";

function splitSkills(input: string) {
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

type EditState = {
  jobId: string;
  title: string;
  location: string;
  role: string;
  requiredSkills: string;
  jobType: JobType;
  minExperienceYears: number;
  description: string;
  openToFreshers: boolean;
};

type ListingStage = "DRAFT" | "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";

const JOB_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  INTERNSHIP: "Internship",
  CONTRACT: "Contract",
};

function reviewBadge(status?: Job["reviewStatus"]) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="green">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="red">Rejected</Badge>;
    case "NEEDS_REVISION":
      return <Badge variant="amber">Needs Revision</Badge>;
    default:
      return <Badge variant="amber">Pending Review</Badge>;
  }
}

export function RecruiterManageJobsPage() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | JobType>("ALL");
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listingStages, setListingStages] = useState<Record<string, ListingStage>>({});
  const [stageFilter, setStageFilter] = useState<"ALL" | ListingStage>("ALL");
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const prefs = await getRecruiterJobListingPreferences(token);
        if (!cancelled && prefs.listingStages) {
          setListingStages(prefs.listingStages);
        }
      } catch {
        // Listing stage preferences are best-effort and should not block the page.
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !prefsLoaded) return;
    const timer = window.setTimeout(() => {
      void updateRecruiterJobListingPreferences(token, { listingStages }).catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [token, prefsLoaded, listingStages]);

  async function load() {
    if (!token) return;
    const data = await apiJson<{ jobs: Job[] }>("/recruiter/jobs", { token });
    setJobs(data.jobs);
  }

  useEffect(() => {
    (async () => {
      try { setError(null); await load(); }
      catch (e) { setError(e instanceof Error ? e.message : "Failed to load jobs"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function remove(jobId: string) {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      await apiJson(`/recruiter/jobs/${jobId}`, { method: "DELETE", token });
      setDeleteId(null);
      await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to delete job");
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!token || !edit) return;
    setBusy(true); setError(null);
    try {
      await apiJson(`/recruiter/jobs/${edit.jobId}`, {
        method: "PATCH", token,
        body: {
          title: edit.title, location: edit.location, role: edit.role,
          requiredSkills: splitSkills(edit.requiredSkills),
          jobType: edit.jobType, minExperienceYears: edit.minExperienceYears,
          description: edit.description, openToFreshers: edit.openToFreshers,
        },
      });
      setEdit(null); await load();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to update job");
    } finally { setBusy(false); }
  }

  const inputCls = "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors";
  const labelCls = "text-xs font-medium text-[var(--muted)] mb-1.5 block";

  const totalJobs = jobs?.length ?? 0;
  const fresherFriendly = jobs?.filter((j) => j.openToFreshers).length ?? 0;
  const internships = jobs?.filter((j) => j.jobType === "INTERNSHIP").length ?? 0;

  const filteredJobs = (jobs ?? []).filter((job) => {
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q) ||
      job.role.toLowerCase().includes(q);
    const matchesType = filterType === "ALL" || job.jobType === filterType;
    const stage = listingStages[job.id] ?? (job.reviewStatus === "APPROVED" ? "ACTIVE" : "PENDING");
    const matchesStage = stageFilter === "ALL" || stage === stageFilter;
    return matchesQuery && matchesType && matchesStage;
  });

  const stageCounts = (jobs ?? []).reduce(
    (acc, job) => {
      const stage = listingStages[job.id] ?? (job.reviewStatus === "APPROVED" ? "ACTIVE" : "PENDING");
      acc[stage] += 1;
      return acc;
    },
    { DRAFT: 0, PENDING: 0, ACTIVE: 0, PAUSED: 0, CLOSED: 0 }
  );

  function setStage(jobId: string, stage: ListingStage) {
    setListingStages((prev) => ({ ...prev, [jobId]: stage }));
  }

  if (jobs === null && !error) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Manage Jobs</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Edit or remove your job openings.</p>
        </div>
        <Link to="/recruiter/post-job" className="w-full sm:w-auto"><Button variant="primary" className="w-full text-sm sm:w-auto">+ Post Job</Button></Link>
      </div>

      {error && <Card className="border-[var(--danger)]/30 p-4 text-sm text-[var(--danger)]">{error}</Card>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-[var(--muted)]">Total Jobs</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{totalJobs}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[var(--muted)]">Fresher Friendly</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{fresherFriendly}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[var(--muted)]">Internships</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{internships}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <input
            className={inputCls}
            placeholder="Search by title, role, or location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={inputCls} value={filterType} onChange={(e) => setFilterType(e.target.value as "ALL" | JobType)}>
            <option value="ALL">All Job Types</option>
            <option value="FULL_TIME">Full-time</option>
            <option value="INTERNSHIP">Internship</option>
            <option value="CONTRACT">Contract</option>
            <option value="PART_TIME">Part-time</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["ALL", "DRAFT", "PENDING", "ACTIVE", "PAUSED", "CLOSED"] as const).map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setStageFilter(stage)}
              aria-pressed={stageFilter === stage}
              className={`btn ${stageFilter === stage ? "btn-primary" : ""}`}
            >
              {stage === "ALL" ? "All" : stage} ({stage === "ALL" ? totalJobs : stageCounts[stage]})
            </button>
          ))}
        </div>
      </Card>

      {jobs && jobs.length === 0 ? (
        <EmptyState
          title="No jobs posted"
          description="You haven't posted any jobs yet. Create your first listing."
          action={<Link to="/recruiter/post-job"><Button variant="primary">Post a Job</Button></Link>}
        />
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          title="No matching jobs"
          description="Try a different search or clear your job type filter."
        />
      ) : (
        <div className="space-y-3 stagger-list">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="p-5">
              {(() => {
                const stage = listingStages[job.id] ?? (job.reviewStatus === "APPROVED" ? "ACTIVE" : "PENDING");
                return (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{job.title}</h3>
                    <Badge variant="blue">{JOB_TYPE_LABEL[job.jobType] ?? job.jobType}</Badge>
                    {job.openToFreshers && <Badge variant="teal">Freshers OK</Badge>}
                    {reviewBadge(job.reviewStatus)}
                    <Badge variant={stage === "ACTIVE" ? "green" : stage === "PAUSED" ? "amber" : stage === "CLOSED" ? "red" : "purple"}>
                      {stage}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {job.companyName} &middot; {job.location} &middot; {job.role}
                    {job.minExperienceYears > 0 && ` · ${job.minExperienceYears}+ yrs`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {job.requiredSkills.slice(0, 5).map((s) => (
                      <span key={s} className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">{s}</span>
                    ))}
                    {job.requiredSkills.length > 5 && <span className="text-[10px] text-[var(--muted)]">+{job.requiredSkills.length - 5}</span>}
                  </div>
                  {job.adminFeedback ? (
                    <p className="mt-2 text-xs text-amber-300">Admin feedback: {job.adminFeedback}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  <Link to={`/recruiter/applicants?jobId=${job.id}`}>
                    <Button variant="secondary" className="text-xs">Applicants</Button>
                  </Link>
                  {stage === "ACTIVE" ? (
                    <Button variant="ghost" className="text-xs" onClick={() => setStage(job.id, "PAUSED")}>Pause</Button>
                  ) : stage === "PAUSED" ? (
                    <Button variant="secondary" className="text-xs" onClick={() => setStage(job.id, "ACTIVE")}>Resume</Button>
                  ) : stage === "DRAFT" ? (
                    <Button variant="secondary" className="text-xs" onClick={() => setStage(job.id, "PENDING")}>Submit</Button>
                  ) : null}
                  {stage !== "CLOSED" && (
                    <Button variant="danger" className="text-xs" onClick={() => setStage(job.id, "CLOSED")}>Close</Button>
                  )}
                  <Button variant="ghost" className="text-xs" onClick={() => setEdit({
                    jobId: job.id, title: job.title, location: job.location, role: job.role,
                    requiredSkills: job.requiredSkills.join(", "), jobType: job.jobType,
                    minExperienceYears: job.minExperienceYears, description: job.description,
                    openToFreshers: job.openToFreshers,
                  })}>Edit</Button>
                  <Button variant="danger" className="text-xs" onClick={() => setDeleteId(job.id)}>Delete</Button>
                </div>
              </div>
                );
              })()}
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!edit} onClose={() => setEdit(null)}>
        {edit && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Edit Job</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Title</label><input className={inputCls} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div><label className={labelCls}>Location</label><input className={inputCls} value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></div>
              <div><label className={labelCls}>Role</label><input className={inputCls} value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} /></div>
              <div><label className={labelCls}>Skills</label><input className={inputCls} value={edit.requiredSkills} onChange={(e) => setEdit({ ...edit, requiredSkills: e.target.value })} /></div>
              <div>
                <label className={labelCls}>Job Type</label>
                <select className={inputCls} value={edit.jobType} onChange={(e) => setEdit({ ...edit, jobType: e.target.value as JobType })}>
                  <option value="FULL_TIME">Full-time</option><option value="INTERNSHIP">Internship</option>
                  <option value="CONTRACT">Contract</option><option value="PART_TIME">Part-time</option>
                </select>
              </div>
              <div><label className={labelCls}>Min Experience</label><input className={inputCls} type="number" min={0} max={60} value={edit.minExperienceYears} onChange={(e) => setEdit({ ...edit, minExperienceYears: Number(e.target.value) })} /></div>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] min-h-[100px] resize-y" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input type="checkbox" checked={edit.openToFreshers} onChange={(e) => setEdit({ ...edit, openToFreshers: e.target.checked })} className="accent-[var(--accent)]" />
              <span className="text-sm text-[var(--text-secondary)]">Open to Freshers</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              <Button variant="primary" loading={busy} onClick={() => void saveEdit()}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)}>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-2">Delete Job?</h2>
        <p className="text-sm text-[var(--muted)] mb-6">This will permanently remove this job post and all associated applications.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => { if (deleteId) void remove(deleteId); }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
