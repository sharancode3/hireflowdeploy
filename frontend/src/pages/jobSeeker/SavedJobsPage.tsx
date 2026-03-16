import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { ExternalJob } from "../../hooks/useExternalJobs";
import { formatDeadline, formatLocation, formatPostedAt, getJobTypeBadge, getSourceLabel } from "../../utils/jobDisplay";

function summarizeRole(job: ExternalJob) {
  const raw = String(job.description || "").replace(/\s+/g, " ").trim();
  if (raw) return raw;

  const exp = job.experienceLevel === "fresher"
    ? "fresher-friendly"
    : job.minExperienceYears > 0
      ? `${job.minExperienceYears}+ years experience`
      : "all experience levels";
  return `${job.title} opportunity at ${job.company} for candidates with ${exp}.`;
}

function clampDescription(text: string, maxChars = 320) {
  const normalized = String(text || "").trim();
  if (normalized.length <= maxChars) return { text: normalized, truncated: false };
  return { text: `${normalized.slice(0, maxChars)}...`, truncated: true };
}

export function SavedJobsPage() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedSkillJobs, setExpandedSkillJobs] = useState<Set<string>>(new Set());
  const [expandedDescriptionJobs, setExpandedDescriptionJobs] = useState<Set<string>>(new Set());

  async function load() {
    if (!token) return;
    const saved = await apiJson<{ jobs: ExternalJob[] }>("/job-seeker/external-saved-jobs", { token });
    setJobs(saved.jobs || []);
    setError(null);
  }

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load saved jobs");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function remove(jobId: string) {
    if (!token) return;
    const previousJobs = jobs;
    setJobs((prev) => prev.filter((j) => j._id !== jobId));

    try {
      await apiJson(`/job-seeker/external-saved-jobs/${jobId}`, { method: "DELETE", token });
    } catch (e) {
      setJobs(previousJobs);
      setError(e instanceof Error ? e.message : "Could not unsave job in database.");
    }
  }

  function toggleSkillExpansion(jobId: string) {
    setExpandedSkillJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function toggleDescriptionExpansion(jobId: string) {
    setExpandedDescriptionJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  const visibleJobs = useMemo(() => {
    return [...jobs].sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  }, [jobs]);

  function handleApplyNow(job: { applyUrl: string; applyFallbackUrl?: string }) {
    const preferredUrl = job.applyUrl || job.applyFallbackUrl || "";
    if (!preferredUrl) return;
    window.open(preferredUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Saved Jobs</h2>
          <p className="text-sm text-text-secondary">Jobs and internships you saved for later.</p>
        </div>
      </Card>

      {error ? <Card className="border-danger/60 bg-danger/10 text-danger">{error}</Card> : null}

      {visibleJobs.length === 0 ? (
        <Card>No saved jobs yet.</Card>
      ) : (
        <div className="space-y-4">
          {visibleJobs.map((job) => {
            const badge = getJobTypeBadge(job.jobType);
            const showAllSkills = expandedSkillJobs.has(job._id);
            const showFullDescription = expandedDescriptionJobs.has(job._id);
            const roleDescription = summarizeRole(job);
            const clamped = clampDescription(roleDescription);
            const visibleSkillCount = showAllSkills ? job.skills.length : 6;
            const hiddenSkillCount = Math.max(0, job.skills.length - visibleSkillCount);

            return (
              <Card key={job._id} className="card-hover space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold">{job.title}</div>
                    <div className="text-sm text-text-secondary">
                      {job.company} · {formatLocation(job.location)}
                    </div>
                    <div className="mt-2 text-xs text-text-muted">
                      {badge.label} · {job.minExperienceYears}+ yrs · {formatPostedAt(job.postedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {job.experienceLevel === "fresher" ? <Badge variant="teal">Freshers</Badge> : null}
                    <Badge variant="blue">{job.skills.length} skills</Badge>
                    <Badge variant="amber">{getSourceLabel(job.source)}</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-text-muted">Role description</div>
                  <div className="text-sm text-text-secondary">
                    {showFullDescription || !clamped.truncated ? roleDescription : clamped.text}
                  </div>
                  {clamped.truncated ? (
                    <button
                      type="button"
                      className="text-xs text-text-muted underline-offset-2 hover:underline"
                      onClick={() => toggleDescriptionExpansion(job._id)}
                    >
                      {showFullDescription ? "Show less" : "Show more"}
                    </button>
                  ) : null}
                  <div className="text-xs text-text-muted">{formatDeadline(job.applicationDeadline)}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {job.skills.slice(0, visibleSkillCount).map((s) => (
                    <Badge key={s} variant="blue">{s}</Badge>
                  ))}
                  {hiddenSkillCount > 0 ? (
                    <button
                      type="button"
                      className="text-xs text-text-muted underline-offset-2 hover:underline"
                      onClick={() => toggleSkillExpansion(job._id)}
                    >
                      +{hiddenSkillCount} more
                    </button>
                  ) : null}
                  {showAllSkills && job.skills.length > 6 ? (
                    <button
                      type="button"
                      className="text-xs text-text-muted underline-offset-2 hover:underline"
                      onClick={() => toggleSkillExpansion(job._id)}
                    >
                      Show less
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="primary" onClick={() => handleApplyNow(job)}>
                    Apply Now
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void remove(job._id)}>
                    Unsave
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
