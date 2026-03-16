import { supabase } from "../lib/supabaseClient";

export type RecruiterApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ApplicationStatus = "APPLIED" | "SHORTLISTED" | "INTERVIEW_SCHEDULED" | "OFFERED" | "REJECTED" | "HIRED";

type LoginEventRow = {
  id: string;
  user_id: string;
  logged_in_at: string;
  source: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "JOB_SEEKER" | "RECRUITER";
  recruiter_approval_status: RecruiterApprovalStatus | null;
  created_at: string;
  updated_at: string;
};

type RecruiterProfileRow = {
  user_id: string;
  company_name: string;
  company_website: string | null;
  designation: string | null;
};

type JobRow = {
  id: string;
  title: string;
  company_name: string;
  location: string;
  role: string;
  description: string;
  review_status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_REVISION";
  admin_feedback: string | null;
  reviewed_at: string | null;
  created_at: string;
  recruiter_id: string;
};

type ApplicationRow = {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  interview_at: string | null;
  job_id: string;
  job_seeker_id: string;
};

export type RecentLoginItem = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: "JOB_SEEKER" | "RECRUITER";
  loggedInAt: string;
  source: string;
};

export type RecruiterItem = {
  userId: string;
  email: string;
  fullName: string;
  companyName: string;
  designation: string;
  website: string;
  status: RecruiterApprovalStatus;
  createdAt: string;
  updatedAt: string;
};

export type ApplicantItem = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  interviewAt: string | null;
  candidateName: string;
  candidateEmail: string;
  roleTitle: string;
  companyName: string;
  location: string;
};

export type ReviewJobItem = {
  id: string;
  title: string;
  companyName: string;
  location: string;
  role: string;
  description: string;
  reviewStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_REVISION";
  adminFeedback: string | null;
  reviewedAt: string | null;
  createdAt: string;
  recruiter: {
    email: string;
    companyName: string;
  };
};

export async function fetchAdminOverview() {
  const [pendingRecruitersResult, applicationsResult, jobsPendingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "RECRUITER")
      .eq("recruiter_approval_status", "PENDING"),
    supabase.from("applications").select("id", { count: "exact", head: true }),
    supabase.from("jobs").select("id", { count: "exact", head: true }).in("review_status", ["PENDING_REVIEW", "NEEDS_REVISION"]),
  ]);

  if (pendingRecruitersResult.error) throw pendingRecruitersResult.error;
  if (applicationsResult.error) throw applicationsResult.error;
  if (jobsPendingResult.error) throw jobsPendingResult.error;

  return {
    pendingRecruiters: pendingRecruitersResult.count || 0,
    totalApplications: applicationsResult.count || 0,
    pendingJobReviews: jobsPendingResult.count || 0,
  };
}

export async function fetchRecentLogins(limit = 30): Promise<{ rows: RecentLoginItem[]; tableAvailable: boolean }> {
  const eventsResult = await supabase
    .from("user_login_events")
    .select("id,user_id,logged_in_at,source")
    .order("logged_in_at", { ascending: false })
    .limit(limit);

  if (eventsResult.error) {
    if (eventsResult.error.code === "PGRST205") {
      return { rows: [], tableAvailable: false };
    }
    throw eventsResult.error;
  }

  const events = (eventsResult.data || []) as LoginEventRow[];
  const userIds = Array.from(new Set(events.map((e) => e.user_id)));
  if (userIds.length === 0) return { rows: [], tableAvailable: true };

  const profilesResult = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .in("id", userIds);

  if (profilesResult.error) throw profilesResult.error;

  const profiles = new Map((profilesResult.data || []).map((p: any) => [p.id, p]));
  const rows: RecentLoginItem[] = events.map((event) => {
    const profile = profiles.get(event.user_id);
    return {
      id: event.id,
      userId: event.user_id,
      email: profile?.email || "unknown",
      fullName: profile?.full_name || "Unknown User",
      role: profile?.role || "JOB_SEEKER",
      loggedInAt: event.logged_in_at,
      source: event.source || "web",
    };
  });

  return { rows, tableAvailable: true };
}

export async function fetchRecruiters(status: "ALL" | RecruiterApprovalStatus, search: string): Promise<RecruiterItem[]> {
  let query = supabase
    .from("profiles")
    .select("id,email,full_name,recruiter_approval_status,created_at,updated_at")
    .eq("role", "RECRUITER")
    .order("created_at", { ascending: false });

  if (status !== "ALL") {
    query = query.eq("recruiter_approval_status", status);
  }

  if (search.trim()) {
    const needle = search.trim();
    query = query.or(`email.ilike.%${needle}%,full_name.ilike.%${needle}%`);
  }

  const profileResult = await query;
  if (profileResult.error) throw profileResult.error;

  const profiles = (profileResult.data || []) as ProfileRow[];
  const ids = profiles.map((p) => p.id);
  if (ids.length === 0) return [];

  const recruiterResult = await supabase
    .from("recruiter_profiles")
    .select("user_id,company_name,company_website,designation")
    .in("user_id", ids);

  if (recruiterResult.error) throw recruiterResult.error;

  const recruiterMap = new Map((recruiterResult.data || []).map((r: RecruiterProfileRow) => [r.user_id, r]));

  return profiles.map((p) => {
    const recruiter = recruiterMap.get(p.id);
    return {
      userId: p.id,
      email: p.email,
      fullName: p.full_name || "",
      companyName: recruiter?.company_name || "-",
      designation: recruiter?.designation || "-",
      website: recruiter?.company_website || "-",
      status: (p.recruiter_approval_status || "PENDING") as RecruiterApprovalStatus,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });
}

export async function updateRecruiterStatus(userId: string, status: RecruiterApprovalStatus) {
  const rpcResult = await supabase.rpc("admin_set_recruiter_approval", {
    p_recruiter_user_id: userId,
    p_next_status: status,
    p_reason: null,
  });

  if (!rpcResult.error) return;

  // Backward-compatible fallback for environments where migration is not applied yet.
  if (rpcResult.error.code === "PGRST202") {
    const { error } = await supabase
      .from("profiles")
      .update({ recruiter_approval_status: status, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("role", "RECRUITER");

    if (error) throw error;
    return;
  }

  throw rpcResult.error;
}

export async function fetchApplicants(status: "ALL" | ApplicationStatus, search: string): Promise<ApplicantItem[]> {
  let query = supabase
    .from("applications")
    .select("id,status,created_at,interview_at,job_id,job_seeker_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "ALL") {
    query = query.eq("status", status);
  }

  const applicationsResult = await query;
  if (applicationsResult.error) throw applicationsResult.error;

  const apps = (applicationsResult.data || []) as ApplicationRow[];
  const jobIds = Array.from(new Set(apps.map((a) => a.job_id)));
  const seekerIds = Array.from(new Set(apps.map((a) => a.job_seeker_id)));

  const [jobsResult, seekersResult] = await Promise.all([
    jobIds.length
      ? supabase.from("jobs").select("id,title,company_name,location").in("id", jobIds)
      : Promise.resolve({ data: [], error: null }),
    seekerIds.length
      ? supabase.from("profiles").select("id,email,full_name").in("id", seekerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (jobsResult.error) throw jobsResult.error;
  if (seekersResult.error) throw seekersResult.error;

  const jobsMap = new Map((jobsResult.data || []).map((j: any) => [j.id, j]));
  const seekersMap = new Map((seekersResult.data || []).map((s: any) => [s.id, s]));

  const normalizedSearch = search.trim().toLowerCase();

  return apps
    .map((app) => {
      const job = jobsMap.get(app.job_id);
      const seeker = seekersMap.get(app.job_seeker_id);
      return {
        id: app.id,
        status: app.status,
        createdAt: app.created_at,
        interviewAt: app.interview_at,
        candidateName: seeker?.full_name || "Unknown",
        candidateEmail: seeker?.email || "unknown",
        roleTitle: job?.title || "Unknown role",
        companyName: job?.company_name || "Unknown company",
        location: job?.location || "-",
      } as ApplicantItem;
    })
    .filter((item) => {
      if (!normalizedSearch) return true;
      return [item.candidateName, item.candidateEmail, item.roleTitle, item.companyName]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
}

export async function updateApplicantStatus(applicationId: string, status: ApplicationStatus, interviewAt: string | null) {
  const payload: Record<string, string | null> = { status };
  if (status === "INTERVIEW_SCHEDULED") {
    payload.interview_at = interviewAt;
  } else {
    payload.interview_at = null;
  }

  const { error } = await supabase
    .from("applications")
    .update(payload)
    .eq("id", applicationId);

  if (error) throw error;
}

export async function fetchReviewJobs(): Promise<ReviewJobItem[]> {
  const jobsResult = await supabase
    .from("jobs")
    .select("id,title,company_name,location,role,description,review_status,admin_feedback,reviewed_at,created_at,recruiter_id")
    .order("created_at", { ascending: false })
    .in("review_status", ["PENDING_REVIEW", "NEEDS_REVISION", "APPROVED", "REJECTED"])
    .limit(150);

  if (jobsResult.error) throw jobsResult.error;

  const jobs = (jobsResult.data || []) as JobRow[];
  const recruiterIds = Array.from(new Set(jobs.map((j) => j.recruiter_id)));

  const [recruiterProfilesResult, recruiterUsersResult] = await Promise.all([
    recruiterIds.length
      ? supabase
          .from("recruiter_profiles")
          .select("user_id,company_name")
          .in("user_id", recruiterIds)
      : Promise.resolve({ data: [], error: null }),
    recruiterIds.length
      ? supabase
          .from("profiles")
          .select("id,email")
          .in("id", recruiterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (recruiterProfilesResult.error) throw recruiterProfilesResult.error;
  if (recruiterUsersResult.error) throw recruiterUsersResult.error;

  const recruiterProfileMap = new Map((recruiterProfilesResult.data || []).map((r: any) => [r.user_id, r]));
  const recruiterUserMap = new Map((recruiterUsersResult.data || []).map((u: any) => [u.id, u]));

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    companyName: job.company_name,
    location: job.location,
    role: job.role,
    description: job.description,
    reviewStatus: job.review_status,
    adminFeedback: job.admin_feedback,
    reviewedAt: job.reviewed_at,
    createdAt: job.created_at,
    recruiter: {
      email: recruiterUserMap.get(job.recruiter_id)?.email || "unknown",
      companyName: recruiterProfileMap.get(job.recruiter_id)?.company_name || "-",
    },
  }));
}

export async function reviewJob(jobId: string, action: "APPROVE" | "REJECT" | "REQUEST_REVISION", feedback?: string) {
  const statusByAction = {
    APPROVE: "APPROVED",
    REJECT: "REJECTED",
    REQUEST_REVISION: "NEEDS_REVISION",
  } as const;

  const payload = {
    review_status: statusByAction[action],
    admin_feedback: feedback?.trim() || null,
    reviewed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("jobs")
    .update(payload)
    .eq("id", jobId);

  if (error) throw error;
}
