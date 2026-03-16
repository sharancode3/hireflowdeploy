import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import type {
  ApplicationWithJob,
  GeneratedResume,
  Job,
  JobSeekerProfile,
  NotificationItem,
  Resume,
} from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useCountUp } from "../../hooks/useCountUp";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function calcProfileCompletion(profile: JobSeekerProfile, hasResume: boolean) {
  const fullNameScore = profile.fullName.trim().length >= 2 ? 15 : 0;
  const locationScore = (profile.location ?? "").trim().length >= 2 ? 10 : 0;
  const phoneScore = (profile.phone ?? "").trim().length >= 8 ? 10 : 0;
  const targetRoleScore = (profile.desiredRole ?? "").trim().length >= 2 ? 15 : 0;
  const headlineScore = (profile.headline ?? "").trim().length >= 8 ? 10 : 0;
  const summaryScore = (profile.about ?? "").trim().length >= 80 ? 10 : 0;
  const experienceScore = profile.isFresher || profile.experienceYears > 0 ? 5 : 0;
  const skillsScore = clamp((profile.skills ?? []).length * 5, 0, 15);
  const resumeScore = hasResume ? 10 : 0;

  return clamp(
    fullNameScore +
      locationScore +
      phoneScore +
      targetRoleScore +
      headlineScore +
      summaryScore +
      experienceScore +
      skillsScore +
      resumeScore,
    0,
    100,
  );
}

function greetingForTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function statusVariant(status: ApplicationWithJob["status"]) {
  switch (status) {
    case "APPLIED":
      return { label: "Applied", variant: "blue" as const };
    case "SHORTLISTED":
      return { label: "Viewed", variant: "amber" as const };
    case "INTERVIEW_SCHEDULED":
      return { label: "Interview", variant: "amber" as const };
    case "REJECTED":
      return { label: "Rejected", variant: "red" as const };
    case "OFFERED":
      return { label: "Offer", variant: "green" as const };
    case "HIRED":
      return { label: "Hired", variant: "green" as const };
    default:
      return { label: status, variant: "blue" as const };
  }
}

function initialsOfCompany(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function sparklinePoints(values: number[]) {
  const max = Math.max(1, ...values);
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 40 - (v / max) * 32 - 4;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function JobSeekerDashboardPage() {
  const { user } = useAuth();

  type JobRow = {
    id: string;
    recruiter_id: string;
    title: string;
    company_name: string;
    location: string;
    role: string;
    required_skills: string[] | null;
    job_type: Job["jobType"];
    min_experience_years: number;
    description: string;
    open_to_freshers: boolean;
    review_status?: Job["reviewStatus"];
    admin_feedback?: string | null;
    reviewed_at?: string | null;
    application_deadline?: string | null;
    created_at: string;
  };

  const normalizeJobRow = (value: JobRow | JobRow[] | null | undefined): JobRow | null => {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
  };

  const mapJobRow = (row: JobRow): Job => ({
    id: row.id,
    recruiterId: row.recruiter_id,
    title: row.title,
    companyName: row.company_name,
    location: row.location,
    role: row.role,
    requiredSkills: row.required_skills ?? [],
    jobType: row.job_type,
    minExperienceYears: row.min_experience_years,
    description: row.description,
    openToFreshers: row.open_to_freshers,
    reviewStatus: row.review_status,
    adminFeedback: row.admin_feedback,
    reviewedAt: row.reviewed_at,
    applicationDeadline: row.application_deadline,
    createdAt: row.created_at,
  });

  const [profile, setProfile] = useState<JobSeekerProfile | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [generatedResumes, setGeneratedResumes] = useState<GeneratedResume[]>([]);
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [applicationsCount, setApplicationsCount] = useState(0);
  const [savedJobsCount, setSavedJobsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user?.id) {
        setIsLoading(false);
        setProfile(null);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const userId = user.id;

        const [
          profileResult,
          seekerResult,
          resumesResult,
          generatedResult,
          applicationsResult,
          applicationsCountResult,
          savedResult,
          savedCountResult,
          notificationsResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id,full_name,phone,location,headline,about")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("job_seeker_profiles")
            .select("user_id,experience_years,desired_role,skills,is_fresher,visibility,active_generated_resume_id")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("resumes")
            .select("id,original_name,mime_type,size_bytes,created_at")
            .eq("job_seeker_id", userId)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("generated_resumes")
            .select("id,job_seeker_id,template,title,snapshot,settings,tags,created_at")
            .eq("job_seeker_id", userId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("applications")
            .select("id,status,interview_at,created_at,job:jobs!applications_job_id_fkey(id,recruiter_id,title,company_name,location,role,required_skills,job_type,min_experience_years,description,open_to_freshers,review_status,admin_feedback,reviewed_at,application_deadline,created_at)")
            .eq("job_seeker_id", userId)
            .order("created_at", { ascending: false })
            .limit(150),
          supabase.from("applications").select("id", { count: "exact", head: true }).eq("job_seeker_id", userId),
          supabase
            .from("saved_jobs")
            .select("id,job_id,created_at,job:jobs!saved_jobs_job_id_fkey(id,recruiter_id,title,company_name,location,role,required_skills,job_type,min_experience_years,description,open_to_freshers,review_status,admin_feedback,reviewed_at,application_deadline,created_at)")
            .eq("job_seeker_id", userId)
            .order("created_at", { ascending: false })
            .limit(150),
          supabase.from("saved_jobs").select("id", { count: "exact", head: true }).eq("job_seeker_id", userId),
          supabase
            .from("notifications")
            .select("id,type,message,is_read,created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (seekerResult.error) throw seekerResult.error;
        if (resumesResult.error) throw resumesResult.error;
        if (generatedResult.error) throw generatedResult.error;
        if (applicationsResult.error) throw applicationsResult.error;
        if (applicationsCountResult.error) throw applicationsCountResult.error;
        if (savedResult.error) throw savedResult.error;
        if (savedCountResult.error) throw savedCountResult.error;
        if (notificationsResult.error) throw notificationsResult.error;

        const profileRow = profileResult.data;
        const seekerRow = seekerResult.data;

        if (!profileRow || !seekerRow) {
          setProfile(null);
          setResumes([]);
          setGeneratedResumes([]);
          setApplications([]);
          setNotifications([]);
          setApplicationsCount(0);
          setSavedJobsCount(0);
          return;
        }

        const mappedProfile: JobSeekerProfile = {
          id: profileRow.id,
          userId: seekerRow.user_id,
          fullName: profileRow.full_name,
          phone: profileRow.phone,
          location: profileRow.location,
          headline: profileRow.headline,
          about: profileRow.about,
          experienceYears: seekerRow.experience_years,
          desiredRole: seekerRow.desired_role,
          skills: seekerRow.skills ?? [],
          isFresher: seekerRow.is_fresher,
          visibility: seekerRow.visibility,
          activeGeneratedResumeId: seekerRow.active_generated_resume_id,
        };

        const mappedResumes: Resume[] = (resumesResult.data ?? []).map((row) => ({
          id: row.id,
          originalName: row.original_name,
          mimeType: row.mime_type ?? "application/octet-stream",
          sizeBytes: row.size_bytes ?? 0,
          createdAt: row.created_at,
        }));

        const mappedGenerated: GeneratedResume[] = (generatedResult.data ?? []).map((row) => ({
          id: row.id,
          userId: row.job_seeker_id,
          template: row.template,
          title: row.title,
          createdAt: row.created_at,
          snapshot: (row.snapshot ?? {}) as GeneratedResume["snapshot"],
          settings: (row.settings ?? {}) as GeneratedResume["settings"],
          tags: row.tags ?? [],
        }));

        const mappedApplications: ApplicationWithJob[] = (applicationsResult.data ?? []).flatMap((row) => {
          const jobRow = normalizeJobRow(row.job as JobRow | JobRow[] | null | undefined);
          if (!jobRow) return [];

          return [{
            id: row.id,
            status: row.status,
            interviewAt: row.interview_at,
            createdAt: row.created_at,
            job: mapJobRow(jobRow),
          }];
        });

        const mappedSavedJobs: Array<{ job?: Job; jobId?: Job | string }> = (savedResult.data ?? []).map((row) => {
            const jobRow = normalizeJobRow(row.job as JobRow | JobRow[] | null | undefined);
            if (!jobRow) {
              return { jobId: row.job_id as string };
            }

            return {
              job: mapJobRow(jobRow),
            };
          });

        const mappedNotifications: NotificationItem[] = (notificationsResult.data ?? []).map((row) => ({
          id: row.id,
          type: row.type,
          message: row.message,
          isRead: row.is_read,
          createdAt: row.created_at,
        }));

        setProfile(mappedProfile);
        setResumes(mappedResumes);
        setGeneratedResumes(mappedGenerated);
        setApplications(mappedApplications);
        setNotifications(mappedNotifications);
        setApplicationsCount(applicationsCountResult.count ?? mappedApplications.length);
        setSavedJobsCount(savedCountResult.count ?? mappedSavedJobs.length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user?.id]);

  const unreadNotifications = useMemo(() => notifications.filter((x) => !x.isRead).length, [notifications]);
  const recentApplications = useMemo(() => applications.slice(0, 5), [applications]);

  const completion = useMemo(() => {
    if (!profile) return 0;
    return calcProfileCompletion(profile, resumes.length > 0 || generatedResumes.length > 0);
  }, [generatedResumes.length, profile, resumes.length]);

  const resumeReadyLabel = useMemo(() => {
    if (resumes.length > 0 || generatedResumes.length > 0) return "Ready";
    return "Not Added";
  }, [generatedResumes.length, resumes.length]);

  const resumeHint = useMemo(() => {
    if (resumes.length > 0) return `Latest: ${resumes[0]?.originalName ?? "Resume"}`;
    const primary = generatedResumes.find((x) => x.id === (profile?.activeGeneratedResumeId ?? ""));
    if (primary) return `Primary: ${primary.title}`;
    if (generatedResumes.length > 0) return `Latest generated: ${generatedResumes[0]!.title}`;
    return "Add a resume to apply with one click.";
  }, [generatedResumes, profile?.activeGeneratedResumeId, resumes]);

  const sparklineData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => i);
    return days.map((offset) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - offset));
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      return applications.filter((a) => {
        const created = new Date(a.createdAt);
        return created >= start && created <= end;
      }).length;
    });
  }, [applications]);

  const applicationsCountAnimated = useCountUp(applicationsCount, 800);
  const savedCountAnimated = useCountUp(savedJobsCount, 800);
  const completionCount = useCountUp(completion, 800);
  const firstName = useMemo(() => profile?.fullName?.trim().split(/\s+/)[0] ?? "there", [profile?.fullName]);

  if (isLoading) return <Card>Loading dashboard...</Card>;
  if (!profile) return <Card className="border-danger/50 bg-danger/10 text-danger">{error ?? "Profile not found."}</Card>;

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-2xl font-semibold">{greetingForTime()}, {firstName}.</div>
          <p className="mt-1 text-sm text-text-secondary">Here is where you stand today.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/job-seeker/profile"><Button variant="secondary">Edit profile</Button></Link>
          <Link to="/job-seeker/jobs"><Button variant="primary">Find jobs</Button></Link>
        </div>
      </Card>

      {error ? <Card className="border-danger/50 bg-danger/10 text-danger">{error}</Card> : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="card-hover">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-secondary">Profile strength</div>
              <div className="text-2xl font-semibold">{completionCount}%</div>
              <div className="mt-2 text-xs text-text-muted">Aim for 80%+ to unlock better job matches.</div>
            </div>
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 36 36" className="h-16 w-16">
                <path className="text-border" stroke="currentColor" strokeWidth="3" fill="none" d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32" />
                <path
                  className={completion >= 70 ? "text-accent-teal" : completion >= 40 ? "text-accent-amber" : "text-danger"}
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${completion},100`}
                  d="M18 2a16 16 0 1 1 0 32a16 16 0 1 1 0-32"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="card-hover">
          <div className="text-sm text-text-secondary">Applications Sent</div>
          <div className="mt-2 text-3xl font-semibold">{applicationsCountAnimated}</div>
          <div className="mt-4">
            <svg viewBox="0 0 100 40" className="h-10 w-full">
              <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-accent" points={sparklinePoints(sparklineData)} />
            </svg>
          </div>
        </Card>

        <Card className="card-hover">
          <div className="text-sm text-text-secondary">Saved Jobs</div>
          <div className="mt-2 text-3xl font-semibold">{savedCountAnimated}</div>
          <div className="mt-3 text-xs text-text-muted">Bookmark opportunities you want to revisit.</div>
        </Card>

      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Applications</h3>
            <Link to="/job-seeker/jobs" className="text-sm text-text-secondary hover:text-text">View all</Link>
          </div>

          {recentApplications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-text-muted">
              No applications yet. Browse jobs to get started.
              <div className="mt-3"><Link to="/job-seeker/jobs"><Button variant="primary">Browse Jobs</Button></Link></div>
            </div>
          ) : (
            <div className="space-y-3">
              {recentApplications.map((a) => {
                const status = statusVariant(a.status);
                return (
                  <div key={a.id} className="rounded-2xl border border-border bg-surface-raised px-4 py-3 transition hover:border-border-active">
                    <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(26,115,232,0.2)] text-xs font-semibold text-[#8AB4F8]">{initialsOfCompany(a.job.companyName)}</div>
                      <div>
                        <div className="text-sm font-semibold">{a.job.title}</div>
                        <div className="text-xs text-text-secondary">{a.job.companyName}</div>
                        <div className="text-xs text-text-muted">Date applied: {new Date(a.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <Link to={`/job-seeker/jobs/${a.job.id}`}><Button variant="secondary">Details</Button></Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Resume Readiness</h3>
              <Badge variant={resumeReadyLabel === "Ready" ? "teal" : "amber"}>{resumeReadyLabel}</Badge>
            </div>
            <div className="text-sm text-text-secondary">{resumeHint}</div>
            {resumeReadyLabel !== "Ready" ? (
              <div className="inline-flex rounded-full bg-[rgba(251,140,0,0.2)] px-3 py-1 text-xs font-semibold text-[#FB8C00]">Add a resume to apply with one click.</div>
            ) : null}
            <div className="flex gap-3">
              <Link to="/job-seeker/profile"><Button variant="secondary">Edit Resume</Button></Link>
              <Link to="/job-seeker/resume-builder"><Button variant="primary">Download PDF</Button></Link>
            </div>
          </Card>

        </div>
      </div>

      <Card className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Notifications</div>
          <div className="text-xs text-text-muted">{unreadNotifications === 0 ? "You are all caught up." : `${unreadNotifications} unread update(s).`}</div>
        </div>
        <Link to="/job-seeker/notifications"><Button variant="secondary">Open</Button></Link>
      </Card>
    </div>
  );
}
