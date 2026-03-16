import { useEffect, useState } from "react";
import {
  X,
  MapPin,
  Clock,
  Building2,
  Briefcase,
  Calendar,
  DollarSign,
  GraduationCap,
  Laptop,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { fetchJobDetail, type ExternalJob } from "../../hooks/useExternalJobs";
import {
  formatDeadline,
  formatPostedAt,
  formatSalary,
  formatLocation,
  getJobTypeBadge,
  getSourceLabel,
} from "../../utils/jobDisplay";

type QuickViewModalProps = {
  jobId: string;
  onClose: () => void;
  onApply: (job: ExternalJob) => void;
};

export function QuickViewModal({ jobId, onClose, onApply }: QuickViewModalProps) {
  const [job, setJob] = useState<ExternalJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobDetail(jobId).then((data) => {
      setJob(data);
      setLoading(false);
    });
  }, [jobId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-sm">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (!job) return null;

  const badge = getJobTypeBadge(job.jobType);
  const workMode = job.location.isRemote ? "Remote" : job.location.isHybrid ? "Hybrid" : "On-site";
  const experienceText = job.experienceLevel === "fresher"
    ? "Fresher"
    : job.minExperienceYears > 0
      ? `${job.minExperienceYears}+ years`
      : "Any";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold text-[var(--color-text-primary)]">{job.title}</h2>
              <div className="mt-1 flex items-center gap-2 text-[var(--color-text-secondary)]">
                <Building2 size={14} />
                <span className="text-sm font-medium">{job.company}</span>
                <span>·</span>
                <span className="text-xs">{getSourceLabel(job.source)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <MapPin size={14} className="shrink-0 text-blue-400" />
              <span>{formatLocation(job.location)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Briefcase size={14} className="shrink-0 text-purple-400" />
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>{badge.label}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Clock size={14} className="shrink-0 text-green-400" />
              <span>Posted {formatPostedAt(job.postedAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Calendar size={14} className="shrink-0 text-amber-400" />
              <span>{formatDeadline(job.applicationDeadline)}</span>
            </div>
            {(job.salaryMin || job.salaryMax) && (
              <div className="col-span-2 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <DollarSign size={14} className="shrink-0 text-emerald-400" />
                <span>{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</span>
              </div>
            )}
          </div>

          {job.skills.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.slice(0, 12).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md bg-[var(--color-accent-muted)] px-2 py-1 text-xs font-medium text-[var(--color-accent)]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {job.description && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">About this Role</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {job.description.slice(0, 2400)}
                {job.description.length > 2400 ? "..." : ""}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-secondary)]">
              <div className="mb-1 flex items-center gap-1 text-[var(--color-text-primary)]">
                <GraduationCap size={14} /> Experience
              </div>
              {experienceText}
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-secondary)]">
              <div className="mb-1 flex items-center gap-1 text-[var(--color-text-primary)]">
                <Laptop size={14} /> Work Mode
              </div>
              {workMode}
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-secondary)]">
              <div className="mb-1 flex items-center gap-1 text-[var(--color-text-primary)]">
                <Sparkles size={14} /> Role
              </div>
              {job.title}
            </div>
          </div>
          {job.experienceLevel === "fresher" && <div className="text-sm font-medium text-green-400">Freshers welcome</div>}
          {job.source === "adzuna" ? (
            <div className="text-xs text-amber-300">
              Source link may be restricted for some regions. Apply opens a safer fallback search page.
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
          >
            Back to Jobs
          </button>
          <button
            type="button"
            onClick={() => onApply(job)}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-sidebar-active-text)] transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            Apply Now <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
