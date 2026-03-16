import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiJson, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SearchableLocationInput } from "../../components/ui/SearchableLocationInput";
import { useExternalJobs, type ExternalJob } from "../../hooks/useExternalJobs";
import type { Job } from "../../types";
import {
  formatDeadline,
  formatLocation,
  formatPostedAt,
  getJobTypeBadge,
  getSourceLabel,
} from "../../utils/jobDisplay";

type Props = {
  freshersOnly?: boolean;
};

function splitSkills(input: string) {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sourcePriority(source: string): number {
  const rank: Record<string, number> = {
    serpapi: 0,
    arbeitnow: 1,
    jsearch: 2,
    themuse: 3,
    remotive: 4,
    adzuna: 9,
  };
  return rank[source] ?? 5;
}

function summarizeRole(job: { title: string; company: string; description?: string; minExperienceYears: number; experienceLevel: string }) {
  const raw = String(job.description || "").replace(/\s+/g, " ").trim();
  if (raw) {
    return raw;
  }

  const exp = job.experienceLevel === "fresher"
    ? "fresher-friendly"
    : job.minExperienceYears > 0
      ? `${job.minExperienceYears}+ years experience`
      : "all experience levels";

  return `${job.title} opportunity at ${job.company} for candidates with ${exp}.`;
}

function clampDescription(text: string, maxChars = 320) {
  const normalized = String(text || "").trim();
  if (normalized.length <= maxChars) {
    return { text: normalized, truncated: false };
  }
  return { text: `${normalized.slice(0, maxChars)}...`, truncated: true };
}

export function JobSeekerJobsPage({ freshersOnly }: Props) {
  const GUIDE_KEY = "hireflow_js_guide_dismissed";
  const LEGACY_GUIDE_KEY = "talvion_js_guide_dismissed";
  const FILTERS_KEY = freshersOnly ? "hireflow_external_jobs_filters_freshers" : "hireflow_external_jobs_filters_main";
  const { token } = useAuth();

  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [platformJobs, setPlatformJobs] = useState<Job[]>([]);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  const [skills, setSkills] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [jobType, setJobType] = useState<string>(freshersOnly ? "internship" : "any");
  const [experienceLevel, setExperienceLevel] = useState<string>(freshersOnly ? "fresher" : "any");
  const [isRemote, setIsRemote] = useState<boolean>(false);
  const [minExp, setMinExp] = useState<string>("");
  const [expandedSkillJobs, setExpandedSkillJobs] = useState<Set<string>>(new Set());
  const [expandedDescriptionJobs, setExpandedDescriptionJobs] = useState<Set<string>>(new Set());
  const [savingJobIds, setSavingJobIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(() => {
    const current = localStorage.getItem(GUIDE_KEY);
    if (current) return current !== "1";
    const legacy = localStorage.getItem(LEGACY_GUIDE_KEY);
    if (legacy) {
      localStorage.setItem(GUIDE_KEY, legacy);
      return legacy !== "1";
    }
    return true;
  });

  const [filters, setFilters] = useState(() => {
    const defaults = {
      q: "",
      jobType: freshersOnly ? "internship" : "any",
      location: "",
      skills: "",
      experienceLevel: freshersOnly ? "fresher" : "any",
      isRemote: false,
      page: 1,
    };

    try {
      const raw = sessionStorage.getItem(FILTERS_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<typeof defaults>;
      return {
        ...defaults,
        ...parsed,
        // keep route-specific behavior deterministic
        jobType: freshersOnly ? "internship" : (parsed.jobType || defaults.jobType),
        experienceLevel: freshersOnly ? "fresher" : (parsed.experienceLevel || defaults.experienceLevel),
      };
    } catch {
      return defaults;
    }
  });

  const skillsCsv = useMemo(() => splitSkills(skills).join(","), [skills]);

  const { jobs, loading, error, pagination } = useExternalJobs(filters);

  const visibleJobs = useMemo(() => {
    let filtered = jobs;

    if (minExp.trim()) {
      const maxYears = Number(minExp.trim());
      if (Number.isFinite(maxYears)) {
        filtered = filtered.filter((job) => job.minExperienceYears <= maxYears);
      }
    }

    return [...filtered].sort((a, b) => {
      const bySource = sourcePriority(a.source) - sourcePriority(b.source);
      if (bySource !== 0) return bySource;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
  }, [jobs, minExp]);

  const visiblePlatformJobs = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    const roleNorm = role.trim().toLowerCase();
    const locNorm = location.trim().toLowerCase();
    const skillSet = new Set(splitSkills(skills).map((s) => s.toLowerCase()));

    return platformJobs.filter((job) => {
      if (freshersOnly && !job.openToFreshers) return false;

      if (qNorm) {
        const hay = `${job.title} ${job.role} ${job.companyName} ${job.description}`.toLowerCase();
        if (!hay.includes(qNorm)) return false;
      }

      if (roleNorm) {
        const hay = `${job.title} ${job.role}`.toLowerCase();
        if (!hay.includes(roleNorm)) return false;
      }

      if (locNorm && !job.location.toLowerCase().includes(locNorm)) return false;

      if (jobType !== "any") {
        const mapped = job.jobType === "FULL_TIME" ? "full_time"
          : job.jobType === "PART_TIME" ? "part_time"
            : job.jobType === "INTERNSHIP" ? "internship"
              : "contract";
        if (mapped !== jobType) return false;
      }

      if (experienceLevel !== "any") {
        if (experienceLevel === "fresher" && !job.openToFreshers && job.minExperienceYears > 0) return false;
        if (experienceLevel === "junior" && job.minExperienceYears > 2) return false;
        if (experienceLevel === "mid" && (job.minExperienceYears < 2 || job.minExperienceYears > 5)) return false;
        if (experienceLevel === "senior" && job.minExperienceYears < 5) return false;
        if (experienceLevel === "lead" && job.minExperienceYears < 8) return false;
      }

      if (minExp.trim()) {
        const maxYears = Number(minExp.trim());
        if (Number.isFinite(maxYears) && job.minExperienceYears > maxYears) return false;
      }

      if (skillSet.size) {
        const lowerSkills = (job.requiredSkills || []).map((s) => s.toLowerCase());
        for (const need of skillSet) {
          if (!lowerSkills.some((s) => s.includes(need))) return false;
        }
      }

      return true;
    });
  }, [platformJobs, q, role, location, skills, jobType, experienceLevel, minExp, freshersOnly]);

  useEffect(() => {
    (async () => {
      if (!token) {
        setSavedJobIds(new Set());
        setAppliedJobIds(new Set());
        setPlatformJobs([]);
        return;
      }
      try {
        setPlatformError(null);
        setPlatformLoading(true);

        const [savedData, platformData, appsData] = await Promise.all([
          apiJson<{ jobIds: string[] }>("/job-seeker/external-saved-job-ids", { token }),
          apiJson<{ jobs: Job[] }>(`/jobs${freshersOnly ? "?openToFreshers=true" : ""}`, { token }),
          apiJson<{ applications: Array<{ job: { id: string } }> }>("/job-seeker/applications", { token }),
        ]);

        setSavedJobIds(new Set(savedData.jobIds || []));
        setPlatformJobs(platformData.jobs || []);
        setAppliedJobIds(new Set((appsData.applications || []).map((a) => a.job.id)));
        setSaveError(null);
      } catch (error) {
        setSavedJobIds(new Set());
        setAppliedJobIds(new Set());
        setPlatformJobs([]);
        const message = error instanceof Error ? error.message : "Could not load jobs from server.";
        setSaveError(message);
        setPlatformError(message);
      } finally {
        setPlatformLoading(false);
      }
    })();
  }, [token, freshersOnly]);

  useEffect(() => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  }, [FILTERS_KEY, filters]);

  useEffect(() => {
    setQ(filters.q || "");
    setLocation(filters.location || "");
    setSkills(filters.skills || "");
    setJobType(filters.jobType || (freshersOnly ? "internship" : "any"));
    setExperienceLevel(filters.experienceLevel || (freshersOnly ? "fresher" : "any"));
    setIsRemote(Boolean(filters.isRemote));
  }, [filters, freshersOnly]);

  async function onFilter(e: FormEvent) {
    e.preventDefault();
    const queryParts = [q.trim(), role.trim()].filter(Boolean).join(" ");
    setFilters({
      q: queryParts,
      jobType,
      location,
      skills: skillsCsv,
      experienceLevel,
      isRemote,
      page: 1,
    });
  }

  async function applyToPlatformJob(jobId: string) {
    if (!token || applyingJobId || appliedJobIds.has(jobId)) return;
    setApplyingJobId(jobId);
    setSaveError(null);
    try {
      await apiJson("/job-seeker/applications", { method: "POST", token, body: { jobId } });
      setAppliedJobIds((prev) => {
        const next = new Set(prev);
        next.add(jobId);
        return next;
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setAppliedJobIds((prev) => {
          const next = new Set(prev);
          next.add(jobId);
          return next;
        });
      } else {
        setSaveError(error instanceof Error ? error.message : "Could not apply right now.");
      }
    } finally {
      setApplyingJobId(null);
    }
  }

  async function saveJob(job: ExternalJob) {
    if (!token) return;
    if (savingJobIds.has(job._id)) return;
    if (savedJobIds.has(job._id)) return;

    setSavingJobIds((prev) => {
      const next = new Set(prev);
      next.add(job._id);
      return next;
    });
    setSaveError(null);

    // Optimistic UI; rollback if DB write fails.
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      next.add(job._id);
      return next;
    });

    try {
      const minSavingDelay = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 2000);
      });

      await Promise.all([
        apiJson<{ ok: boolean }>("/job-seeker/external-saved-jobs", {
          method: "POST",
          token,
          body: { jobId: job._id, job },
        }),
        minSavingDelay,
      ]);
    } catch (error) {
      setSavedJobIds((prev) => {
        const next = new Set(prev);
        next.delete(job._id);
        return next;
      });
      const message = error instanceof Error ? error.message : "Could not save job to database.";
      setSaveError(message);
    } finally {
      setSavingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(job._id);
        return next;
      });
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

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{freshersOnly ? "Freshers" : "Jobs"}</h2>
          <p className="text-sm text-text-secondary">
            {freshersOnly
              ? "Open-to-freshers roles. Apply in one click when ready."
              : "Search across curated roles and move fast with a rich match view."}
          </p>
        </div>
        <Link to="/job-seeker/profile">
          <Button variant="secondary">Update skills</Button>
        </Link>
      </Card>

      {showGuide ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Getting started</div>
              <div className="text-xs text-text-muted">A quick checklist you can dismiss anytime.</div>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                localStorage.setItem(GUIDE_KEY, "1");
                localStorage.removeItem(LEGACY_GUIDE_KEY);
                setShowGuide(false);
              }}
            >
              Dismiss
            </Button>
          </div>

          <ol className="space-y-2 text-sm text-text-secondary">
            <li>
              Go to <Link to="/job-seeker/profile" className="text-text">Profile</Link> and update skills.
            </li>
            <li>Upload your resume inside the Profile page.</li>
            <li>Search, open a job, then apply in one click.</li>
            <li>
              Save relevant opportunities and review them in <Link to="/job-seeker/saved" className="text-text">Saved Jobs</Link>.
            </li>
          </ol>
        </Card>
      ) : null}

      {error ? <Card className="border-danger/60 bg-danger/10 text-danger">{error}</Card> : null}
      {saveError ? <Card className="border-danger/60 bg-danger/10 text-danger">{saveError}</Card> : null}
      {platformError && !saveError ? <Card className="border-danger/60 bg-danger/10 text-danger">{platformError}</Card> : null}

      <form onSubmit={onFilter} className="space-y-4">
        <Card className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <label className="label">Job title or keywords</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g., Frontend Engineer, Data Analyst"
            />
          </div>
          <div className="flex-1">
            <label className="label">Location</label>
            <SearchableLocationInput
              className="input"
              value={location}
              onChange={setLocation}
              placeholder="e.g., Mumbai"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={loading}>
              Search
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => {
                setQ("");
                setLocation("");
                setRole("");
                setSkills("");
                setJobType(freshersOnly ? "internship" : "any");
                setExperienceLevel(freshersOnly ? "fresher" : "any");
                setIsRemote(false);
                setMinExp("");
                setFilters({
                  q: "",
                  jobType: freshersOnly ? "internship" : "any",
                  location: "",
                  skills: "",
                  experienceLevel: freshersOnly ? "fresher" : "any",
                  isRemote: false,
                  page: 1,
                });
                sessionStorage.removeItem(FILTERS_KEY);
              }}
            >
              Reset
            </Button>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_3fr]">
          <Card className="space-y-4">
            <div className="text-sm font-semibold">Filters</div>
            <div className="space-y-3">
              <div className="field">
                <label className="label">Role</label>
                <input
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Backend Developer"
                />
              </div>
              <div className="field">
                <label className="label">Skills (comma separated)</label>
                <input
                  className="input"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g., React, Node"
                />
              </div>
              <div className="field">
                <label className="label">Job type</label>
                <select className="select" value={jobType} onChange={(e) => setJobType(e.target.value)}>
                  <option value="any">Any</option>
                  <option value="full_time">Full-time</option>
                  <option value="internship">Internship</option>
                  <option value="contract">Contract</option>
                  <option value="part_time">Part-time</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>
              <div className="field">
                <label className="label">Experience level</label>
                <select className="select" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                  <option value="any">Any</option>
                  <option value="fresher">Fresher</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead</option>
                </select>
              </div>
              <div className="field">
                <label className="label">Max experience required (years)</label>
                <input
                  className="input"
                  value={minExp}
                  onChange={(e) => setMinExp(e.target.value)}
                  placeholder="e.g., 2"
                  inputMode="numeric"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={isRemote}
                  onChange={(e) => setIsRemote(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Show only remote roles
              </label>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={freshersOnly ?? false}
                  readOnly
                  className="h-4 w-4 rounded border-border"
                />
                Fresher mode page
              </label>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-text">Hireflow Jobs & Internships</div>
                  <div className="text-xs text-text-muted">Recruiter-posted roles you can apply to directly in Hireflow.</div>
                </div>
                <Badge variant="teal">{visiblePlatformJobs.length} roles</Badge>
              </div>

              {platformLoading ? (
                <div className="text-sm text-text-secondary">Loading internal jobs...</div>
              ) : visiblePlatformJobs.length === 0 ? (
                <div className="text-sm text-text-secondary">No internal jobs match current filters.</div>
              ) : (
                <div className="space-y-3">
                  {visiblePlatformJobs.map((job) => {
                    const isApplied = appliedJobIds.has(job.id);
                    const isApplying = applyingJobId === job.id;
                    return (
                      <div key={job.id} className="rounded-xl border border-border bg-surface-raised p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-text">{job.title}</div>
                            <div className="text-xs text-text-secondary">{job.companyName} · {job.location}</div>
                            <div className="mt-1 text-xs text-text-muted">{job.jobType.replace("_", " ")} · {job.minExperienceYears}+ yrs</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {job.openToFreshers ? <Badge variant="teal">Freshers</Badge> : null}
                            {isApplied ? (
                              <Button type="button" variant="secondary" disabled>
                                Applied
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="primary"
                                disabled={isApplying || Boolean(applyingJobId)}
                                onClick={() => void applyToPlatformJob(job.id)}
                              >
                                {isApplying ? "Applying..." : "Apply Now"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {loading ? (
              <Card>
                <div className="text-sm font-semibold">Loading jobs</div>
                <div className="mt-2 text-xs text-text-muted">Fetching latest listings from live sources.</div>
              </Card>
            ) : visibleJobs.length === 0 ? (
              <Card>
                <div className="text-sm font-semibold">No jobs found</div>
                <div className="mt-2 text-xs text-text-muted">
                  Try clearing filters, or broaden your search.
                </div>
              </Card>
            ) : (
              visibleJobs.map((job) => {
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
                        <button
                          type="button"
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                            savedJobIds.has(job._id)
                              ? "bg-[color:color-mix(in_srgb,var(--color-accent)_18%,transparent)] text-[var(--color-accent)]"
                              : "bg-surface-raised text-text-secondary hover:text-text"
                          }`}
                          onClick={() => void saveJob(job)}
                          disabled={loading || savingJobIds.has(job._id) || savedJobIds.has(job._id)}
                        >
                          {savingJobIds.has(job._id) ? "Saving..." : savedJobIds.has(job._id) ? "Saved" : "Save"}
                        </button>
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
                        <Badge key={s} variant="blue">
                          {s}
                        </Badge>
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

                    <div className="text-xs text-text-muted">External listing: use internal Hireflow jobs above for in-app apply tracking.</div>
                  </Card>
                );
              })
            )}

            {pagination.pages > 1 ? (
              <Card className="flex items-center justify-between">
                <div className="text-xs text-text-muted">
                  Page {pagination.page} of {pagination.pages}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading || pagination.page <= 1}
                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading || !pagination.hasMore}
                    onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
