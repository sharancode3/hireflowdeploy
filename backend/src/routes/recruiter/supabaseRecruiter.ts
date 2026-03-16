import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { HttpError } from "../../utils/httpError";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../supabase";

export const recruiterSupabaseRouter = Router();

const appStatusSchema = z.enum(["APPLIED", "SHORTLISTED", "REJECTED", "INTERVIEW_SCHEDULED", "OFFERED", "HIRED"]);

const jobCreateSchema = z.object({
  title: z.string().trim().min(2),
  companyName: z.string().trim().min(2).optional(),
  location: z.string().trim().min(2),
  role: z.string().trim().min(2),
  requiredSkills: z.array(z.string().trim().min(1)).min(1).max(50),
  description: z.string().trim().min(20).max(5000),
  openToFreshers: z.boolean().default(false),
  jobType: z.enum(["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"]).default("FULL_TIME"),
  minExperienceYears: z.number().int().min(0).max(60).default(0),
  applicationDeadline: z.string().datetime().nullable().optional(),
});

const recruiterProfileUpdateSchema = z.object({
  companyName: z.string().trim().min(2).optional(),
  website: z.string().trim().url().nullable().optional(),
  location: z.string().trim().min(2).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

const listingStageSchema = z.enum(["DRAFT", "PENDING", "ACTIVE", "PAUSED", "CLOSED"]);

const recruiterJobListingPreferencesPatchSchema = z.object({
  postJobDraft: z.record(z.string(), z.unknown()).nullable().optional(),
  listingStages: z.record(z.string(), listingStageSchema).optional(),
});

type RecruiterContext = {
  userId: string;
  email: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  companyName: string;
};

type ExternalJobRow = {
  id: string;
  title: string;
  company: string;
  location_city: string | null;
  location_state: string | null;
  location_country: string;
  is_remote: boolean;
  is_hybrid: boolean;
  is_onsite: boolean;
  job_type: "full_time" | "part_time" | "internship" | "contract" | "freelance";
  experience_level: string;
  min_experience_years: number;
  skills: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  apply_url: string;
  application_deadline: string | null;
  posted_at: string;
  active_until: string;
  source: string;
  description: string;
};

async function getRecruiterContext(userId: string): Promise<RecruiterContext> {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "Supabase is not configured on the backend");
  }

  const supabase = getSupabaseAdmin();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,role,recruiter_approval_status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new HttpError(500, profileError.message);
  if (!profile) throw new HttpError(404, "Profile not found");
  if (profile.role !== "RECRUITER") throw new HttpError(403, "Forbidden");

  const { data: recruiterProfile, error: recruiterProfileError } = await supabase
    .from("recruiter_profiles")
    .select("company_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (recruiterProfileError) throw new HttpError(500, recruiterProfileError.message);

  return {
    userId,
    email: profile.email,
    approvalStatus: (profile.recruiter_approval_status || "PENDING") as RecruiterContext["approvalStatus"],
    companyName: recruiterProfile?.company_name || "Recruiter",
  };
}

function mapJob(row: any) {
  return {
    id: row.id,
    recruiterId: row.recruiter_id,
    title: row.title,
    companyName: row.company_name,
    location: row.location,
    role: row.role,
    requiredSkills: row.required_skills || [],
    jobType: row.job_type,
    minExperienceYears: row.min_experience_years,
    description: row.description,
    openToFreshers: row.open_to_freshers,
    reviewStatus: row.review_status,
    adminFeedback: row.admin_feedback,
    reviewedAt: row.reviewed_at,
    applicationDeadline: row.application_deadline,
    createdAt: row.created_at,
  };
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "23505";
}

function mapNotification(row: any) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

function isSchemaMissingError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205";
}

function normalizeListingPrefs(raw: unknown): {
  postJobDraft: Record<string, unknown> | null;
  listingStages: Record<string, z.infer<typeof listingStageSchema>>;
} {
  const empty = { postJobDraft: null, listingStages: {} as Record<string, z.infer<typeof listingStageSchema>> };
  if (!raw || typeof raw !== "object") return empty;

  const candidate = raw as Record<string, unknown>;
  const postJobDraft = candidate.postJobDraft && typeof candidate.postJobDraft === "object"
    ? (candidate.postJobDraft as Record<string, unknown>)
    : null;

  const listingStagesRaw = candidate.listingStages;
  const listingStages: Record<string, z.infer<typeof listingStageSchema>> = {};
  if (listingStagesRaw && typeof listingStagesRaw === "object") {
    for (const [jobId, stage] of Object.entries(listingStagesRaw as Record<string, unknown>)) {
      const parsed = listingStageSchema.safeParse(stage);
      if (parsed.success) listingStages[jobId] = parsed.data;
    }
  }

  return { postJobDraft, listingStages };
}

async function getUserSettingsRecord(userId: string): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabaseAdmin()
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isSchemaMissingError(error)) {
    throw new HttpError(503, "user_settings table is missing. Run latest migration.");
  }
  if (error) throw new HttpError(500, error.message);

  const settings = data?.settings;
  if (!settings || typeof settings !== "object") return {};
  return settings as Record<string, unknown>;
}

async function upsertUserSettingsRecord(userId: string, settings: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("user_settings")
    .upsert({ user_id: userId, settings }, { onConflict: "user_id" });

  if (error && isSchemaMissingError(error)) {
    throw new HttpError(503, "user_settings table is missing. Run latest migration.");
  }
  if (error) throw new HttpError(500, error.message);
}

function mapExternalJob(row: ExternalJobRow) {
  return {
    _id: row.id,
    title: row.title,
    company: row.company,
    location: {
      city: row.location_city || undefined,
      state: row.location_state || undefined,
      country: row.location_country,
      isRemote: row.is_remote,
      isHybrid: row.is_hybrid,
      isOnsite: row.is_onsite,
    },
    jobType: row.job_type,
    experienceLevel: row.experience_level,
    minExperienceYears: row.min_experience_years,
    skills: row.skills || [],
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    salaryCurrency: row.salary_currency,
    applyUrl: row.apply_url,
    applyFallbackUrl: `https://www.google.com/search?q=${encodeURIComponent(`${row.title} ${row.company} jobs in India`)}`,
    applyReliability: "high" as const,
    applyIsDirect: true,
    applicationDeadline: row.application_deadline || row.active_until || undefined,
    activeUntil: row.active_until,
    postedAt: row.posted_at,
    source: row.source,
    description: row.description,
  };
}

const externalJobSnapshotSchema = z.object({
  _id: z.string().uuid().optional(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    isRemote: z.boolean().optional(),
    isHybrid: z.boolean().optional(),
    isOnsite: z.boolean().optional(),
  }),
  jobType: z.enum(["full_time", "part_time", "internship", "contract", "freelance"]),
  experienceLevel: z.string().optional(),
  minExperienceYears: z.number().int().min(0).max(50).optional(),
  skills: z.array(z.string()).optional(),
  salaryMin: z.number().nullable().optional(),
  salaryMax: z.number().nullable().optional(),
  salaryCurrency: z.string().optional(),
  applyUrl: z.string().min(1),
  applicationDeadline: z.string().nullable().optional(),
  activeUntil: z.string().optional(),
  postedAt: z.string().optional(),
  source: z.string().optional(),
  description: z.string().optional(),
});

function stableHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function parseIsoOrNull(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseIsoOrNow(value?: string): string {
  const parsed = parseIsoOrNull(value);
  return parsed || new Date().toISOString();
}

function plusDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function upsertExternalJobSnapshot(jobId: string, snapshot: z.infer<typeof externalJobSnapshotSchema>): Promise<void> {
  const postedAt = parseIsoOrNow(snapshot.postedAt);
  const activeUntil = parseIsoOrNull(snapshot.activeUntil)
    || parseIsoOrNull(snapshot.applicationDeadline)
    || plusDays(postedAt, 30);
  const source = String(snapshot.source || "manual_save").trim().toLowerCase();
  const externalId = jobId;
  const dedupeKey = stableHash(`${source}|${externalId}`);
  const description = String(snapshot.description || `${snapshot.title} at ${snapshot.company}`).slice(0, 12000);

  const payload = {
    id: jobId,
    source,
    external_id: externalId,
    dedupe_key: dedupeKey,
    title: snapshot.title,
    company: snapshot.company,
    location_city: snapshot.location.city || null,
    location_state: snapshot.location.state || null,
    location_country: snapshot.location.country || "Global",
    is_remote: Boolean(snapshot.location.isRemote),
    is_hybrid: Boolean(snapshot.location.isHybrid),
    is_onsite: snapshot.location.isOnsite ?? !(snapshot.location.isRemote || snapshot.location.isHybrid),
    job_type: snapshot.jobType,
    experience_level: snapshot.experienceLevel || "any",
    min_experience_years: snapshot.minExperienceYears || 0,
    skills: snapshot.skills || [],
    salary_min: snapshot.salaryMin ?? null,
    salary_max: snapshot.salaryMax ?? null,
    salary_currency: snapshot.salaryCurrency || "USD",
    apply_url: snapshot.applyUrl,
    description,
    posted_at: postedAt,
    application_deadline: parseIsoOrNull(snapshot.applicationDeadline),
    active_until: activeUntil,
    is_active: true,
    metadata: { created_via: "save_snapshot" },
    content_hash: stableHash(`${snapshot.title}|${snapshot.company}|${description}`),
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await getSupabaseAdmin()
    .from("external_jobs")
    .upsert(payload, { onConflict: "id" });

  if (error) throw new HttpError(500, error.message);
}

async function ensureJobSeeker(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);

  if (!data) {
    const authUser = await supabase.auth.admin.getUserById(userId);
    if (authUser.error || !authUser.data?.user) {
      throw new HttpError(404, "Profile not found");
    }

    const email = String(authUser.data.user.email || "").toLowerCase();
    const fullName = String(authUser.data.user.user_metadata?.full_name || email.split("@")[0] || "User");

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email,
        role: "JOB_SEEKER",
        full_name: fullName,
      }, { onConflict: "id" });

    if (upsertError) throw new HttpError(500, upsertError.message);
  }
}

async function getSavedExternalJobIdsFromUserSettings(userId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isSchemaMissingError(error)) throw new HttpError(500, error.message);
  const settings = (data?.settings || {}) as { saved_external_job_ids?: unknown };
  const ids = Array.isArray(settings.saved_external_job_ids) ? settings.saved_external_job_ids : [];
  return ids.filter((x): x is string => typeof x === "string");
}

async function setSavedExternalJobIdsInUserSettings(userId: string, ids: string[]): Promise<void> {
  const { data: existing, error: selectError } = await getSupabaseAdmin()
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError && !isSchemaMissingError(selectError)) throw new HttpError(500, selectError.message);

  const currentSettings = (existing?.settings || {}) as Record<string, unknown>;
  const nextSettings = {
    ...currentSettings,
    saved_external_job_ids: ids,
  };

  const { error: upsertError } = await getSupabaseAdmin()
    .from("user_settings")
    .upsert({ user_id: userId, settings: nextSettings }, { onConflict: "user_id" });

  if (upsertError) throw new HttpError(500, upsertError.message);
}

recruiterSupabaseRouter.get("/job-seeker/external-saved-job-ids", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    await ensureJobSeeker(authed.auth.userId);

    const { data, error } = await getSupabaseAdmin()
      .from("saved_external_jobs")
      .select("external_job_id")
      .eq("user_id", authed.auth.userId);

    if (error && isSchemaMissingError(error)) {
      const fallbackIds = await getSavedExternalJobIdsFromUserSettings(authed.auth.userId);
      return res.json({ jobIds: fallbackIds });
    }
    if (error) throw new HttpError(500, error.message);

    res.json({ jobIds: (data || []).map((x: any) => x.external_job_id) });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/job-seeker/external-saved-jobs", async (req, res, next) => {
    try {
      const authed = req as unknown as AuthenticatedRequest;
      await ensureJobSeeker(authed.auth.userId);

      const { data, error } = await getSupabaseAdmin()
        .from("saved_external_jobs")
        .select("created_at, job:external_jobs!saved_external_jobs_external_job_id_fkey(id,title,company,location_city,location_state,location_country,is_remote,is_hybrid,is_onsite,job_type,experience_level,min_experience_years,skills,salary_min,salary_max,salary_currency,apply_url,application_deadline,posted_at,active_until,source,description)")
        .eq("user_id", authed.auth.userId)
        .order("created_at", { ascending: false });

      if (error && isSchemaMissingError(error)) {
        const fallbackIds = await getSavedExternalJobIdsFromUserSettings(authed.auth.userId);
        if (!fallbackIds.length) return res.json({ jobs: [] });

        const { data: jobsData, error: jobsError } = await getSupabaseAdmin()
          .from("external_jobs")
          .select("id,title,company,location_city,location_state,location_country,is_remote,is_hybrid,is_onsite,job_type,experience_level,min_experience_years,skills,salary_min,salary_max,salary_currency,apply_url,application_deadline,posted_at,active_until,source,description")
          .in("id", fallbackIds)
          .eq("is_active", true)
          .gte("active_until", new Date().toISOString());

        if (jobsError && !isSchemaMissingError(jobsError)) throw new HttpError(500, jobsError.message);

        const jobs = (jobsData || []).map((job: ExternalJobRow) => mapExternalJob(job));
        return res.json({ jobs });
      }
      if (error) throw new HttpError(500, error.message);

      const jobs = (data || [])
        .map((row: any) => row.job)
        .filter(Boolean)
        .map((job: ExternalJobRow) => mapExternalJob(job));

      res.json({ jobs });
    } catch (err) {
      next(err);
    }
  });

recruiterSupabaseRouter.post("/job-seeker/external-saved-jobs", async (req, res, next) => {
    try {
      const authed = req as unknown as AuthenticatedRequest;
      await ensureJobSeeker(authed.auth.userId);

      const body = z.object({
        jobId: z.string().uuid(),
        job: externalJobSnapshotSchema.optional(),
      }).parse(req.body);
      const supabase = getSupabaseAdmin();

      const { data: existing, error: jobError } = await supabase
        .from("external_jobs")
        .select("id")
        .eq("id", body.jobId)
        .maybeSingle();

      if (jobError && isSchemaMissingError(jobError)) {
        return res.status(503).json({ message: "Saved jobs storage is not ready. Run latest migration." });
      }
      if (jobError) throw new HttpError(500, jobError.message);
      if (!existing) {
        if (!body.job) throw new HttpError(404, "Job not found");
        await upsertExternalJobSnapshot(body.jobId, body.job);
      }

      const { error } = await supabase
        .from("saved_external_jobs")
        .upsert({ user_id: authed.auth.userId, external_job_id: body.jobId }, { onConflict: "user_id,external_job_id" });

      if (error && isSchemaMissingError(error)) {
        const fallbackIds = await getSavedExternalJobIdsFromUserSettings(authed.auth.userId);
        const nextIds = Array.from(new Set([...fallbackIds, body.jobId]));
        await setSavedExternalJobIdsInUserSettings(authed.auth.userId, nextIds);
        return res.json({ ok: true });
      }
      if (error) throw new HttpError(500, error.message);

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

recruiterSupabaseRouter.delete("/job-seeker/external-saved-jobs/:jobId", async (req, res, next) => {
    try {
      const authed = req as unknown as AuthenticatedRequest;
      await ensureJobSeeker(authed.auth.userId);

      const { jobId } = z.object({ jobId: z.string().uuid() }).parse(req.params);
      const { error } = await getSupabaseAdmin()
        .from("saved_external_jobs")
        .delete()
        .eq("user_id", authed.auth.userId)
        .eq("external_job_id", jobId);

      if (error && isSchemaMissingError(error)) {
        const fallbackIds = await getSavedExternalJobIdsFromUserSettings(authed.auth.userId);
        const nextIds = fallbackIds.filter((id) => id !== jobId);
        await setSavedExternalJobIdsInUserSettings(authed.auth.userId, nextIds);
        return res.json({ ok: true });
      }
      if (error) throw new HttpError(500, error.message);

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

recruiterSupabaseRouter.get("/notifications", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const userId = authed.auth.userId;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,message,is_read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new HttpError(500, error.message);

    res.json({ notifications: (data || []).map(mapNotification) });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.post("/notifications/read-all", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const userId = authed.auth.userId;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw new HttpError(500, error.message);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.post("/notifications/:id/read", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const userId = authed.auth.userId;
    const notificationId = z.string().uuid().parse(req.params.id);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) throw new HttpError(500, error.message);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/recruiter/profile", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const ctx = await getRecruiterContext(authed.auth.userId);
    const supabase = getSupabaseAdmin();

    const [{ data: recruiterProfile, error: recruiterProfileError }, { data: profile, error: profileError }] = await Promise.all([
      supabase
        .from("recruiter_profiles")
        .select("company_name,company_website,designation,bio")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("location")
        .eq("id", ctx.userId)
        .maybeSingle(),
    ]);

    if (recruiterProfileError) throw new HttpError(500, recruiterProfileError.message);
    if (profileError) throw new HttpError(500, profileError.message);

    res.json({
      profile: {
        id: ctx.userId,
        userId: ctx.userId,
        companyName: recruiterProfile?.company_name || ctx.companyName,
        website: recruiterProfile?.company_website || null,
        location: profile?.location || null,
        description: recruiterProfile?.bio || recruiterProfile?.designation || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/recruiter/job-listing-preferences", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const ctx = await getRecruiterContext(authed.auth.userId);
    const settings = await getUserSettingsRecord(ctx.userId);
    const preferences = normalizeListingPrefs(settings.recruiter_job_listing_preferences);
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.patch("/recruiter/job-listing-preferences", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const body = recruiterJobListingPreferencesPatchSchema.parse(req.body);
    const ctx = await getRecruiterContext(authed.auth.userId);

    const settings = await getUserSettingsRecord(ctx.userId);
    const current = normalizeListingPrefs(settings.recruiter_job_listing_preferences);

    const next = {
      postJobDraft: body.postJobDraft === undefined ? current.postJobDraft : body.postJobDraft,
      listingStages: body.listingStages === undefined ? current.listingStages : body.listingStages,
    };

    await upsertUserSettingsRecord(ctx.userId, {
      ...settings,
      recruiter_job_listing_preferences: next,
    });

    res.json({ preferences: next });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.patch("/recruiter/profile", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const body = recruiterProfileUpdateSchema.parse(req.body);
    const ctx = await getRecruiterContext(authed.auth.userId);
    const supabase = getSupabaseAdmin();

    const recruiterPayload: Record<string, string | null> = {};
    if (body.companyName !== undefined) recruiterPayload.company_name = body.companyName;
    if (body.website !== undefined) recruiterPayload.company_website = body.website;
    if (body.description !== undefined) {
      recruiterPayload.bio = body.description;
      recruiterPayload.designation = body.description;
    }

    if (Object.keys(recruiterPayload).length > 0) {
      const { error: recruiterError } = await supabase
        .from("recruiter_profiles")
        .upsert({ user_id: ctx.userId, ...recruiterPayload }, { onConflict: "user_id" });
      if (recruiterError) throw new HttpError(500, recruiterError.message);
    }

    if (body.location !== undefined) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ location: body.location })
        .eq("id", ctx.userId);
      if (profileError) throw new HttpError(500, profileError.message);
    }

    const [{ data: recruiterProfile, error: recruiterProfileError }, { data: profile, error: profileError }] = await Promise.all([
      supabase
        .from("recruiter_profiles")
        .select("company_name,company_website,designation,bio")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("location")
        .eq("id", ctx.userId)
        .maybeSingle(),
    ]);

    if (recruiterProfileError) throw new HttpError(500, recruiterProfileError.message);
    if (profileError) throw new HttpError(500, profileError.message);

    res.json({
      profile: {
        id: ctx.userId,
        userId: ctx.userId,
        companyName: recruiterProfile?.company_name || ctx.companyName,
        website: recruiterProfile?.company_website || null,
        location: profile?.location || null,
        description: recruiterProfile?.bio || recruiterProfile?.designation || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/recruiter/jobs", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const ctx = await getRecruiterContext(authed.auth.userId);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("jobs")
      .select("id,recruiter_id,title,company_name,location,role,required_skills,job_type,min_experience_years,description,open_to_freshers,review_status,admin_feedback,reviewed_at,application_deadline,created_at")
      .eq("recruiter_id", ctx.userId)
      .order("created_at", { ascending: false });

    if (error) throw new HttpError(500, error.message);

    res.json({ jobs: (data || []).map(mapJob) });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/jobs", async (req, res, next) => {
  try {
    const query = z.object({
      q: z.string().trim().optional(),
      location: z.string().trim().optional(),
      jobType: z.enum(["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"]).optional(),
      openToFreshers: z.coerce.boolean().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(req.query);

    let q = getSupabaseAdmin()
      .from("jobs")
      .select("id,recruiter_id,title,company_name,location,role,required_skills,job_type,min_experience_years,description,open_to_freshers,review_status,admin_feedback,reviewed_at,application_deadline,created_at")
      .eq("review_status", "APPROVED")
      .order("created_at", { ascending: false })
      .limit(query.limit);

    if (query.jobType) q = q.eq("job_type", query.jobType);
    if (query.openToFreshers !== undefined) q = q.eq("open_to_freshers", query.openToFreshers);
    if (query.location) q = q.ilike("location", `%${query.location}%`);
    if (query.q) {
      const term = query.q.replace(/[,%]/g, " ").trim();
      if (term) q = q.or(`title.ilike.%${term}%,role.ilike.%${term}%,company_name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const { data, error } = await q;
    if (error) throw new HttpError(500, error.message);

    res.json({ jobs: (data || []).map(mapJob) });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/jobs/:jobId", async (req, res, next) => {
  try {
    const { jobId } = z.object({ jobId: z.string().uuid() }).parse(req.params);

    const { data, error } = await getSupabaseAdmin()
      .from("jobs")
      .select("id,recruiter_id,title,company_name,location,role,required_skills,job_type,min_experience_years,description,open_to_freshers,review_status,admin_feedback,reviewed_at,application_deadline,created_at")
      .eq("id", jobId)
      .eq("review_status", "APPROVED")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "Job not found");

    res.json({ job: mapJob(data) });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/job-seeker/applications", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    await ensureJobSeeker(authed.auth.userId);

    const supabase = getSupabaseAdmin();
    const { data: apps, error: appsError } = await supabase
      .from("applications")
      .select("id,status,interview_at,created_at,job_id")
      .eq("job_seeker_id", authed.auth.userId)
      .order("created_at", { ascending: false });

    if (appsError) throw new HttpError(500, appsError.message);

    const jobIds = Array.from(new Set((apps || []).map((a: any) => a.job_id)));
    if (jobIds.length === 0) {
      return res.json({ applications: [] });
    }

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id,recruiter_id,title,company_name,location,role,required_skills,job_type,min_experience_years,description,open_to_freshers,review_status,admin_feedback,reviewed_at,application_deadline,created_at")
      .in("id", jobIds);

    if (jobsError) throw new HttpError(500, jobsError.message);

    const jobMap = new Map((jobs || []).map((j: any) => [j.id, mapJob(j)]));
    const applications = (apps || [])
      .map((app: any) => {
        const job = jobMap.get(app.job_id);
        if (!job) return null;
        return {
          id: app.id,
          status: app.status,
          interviewAt: app.interview_at,
          createdAt: app.created_at,
          job,
        };
      })
      .filter(Boolean);

    res.json({ applications });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.post("/job-seeker/applications", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    await ensureJobSeeker(authed.auth.userId);

    const body = z.object({
      jobId: z.string().uuid(),
      generatedResumeId: z.string().uuid().optional(),
      resumeId: z.string().uuid().optional(),
      coverLetter: z.string().max(5000).optional(),
    }).parse(req.body);

    const supabase = getSupabaseAdmin();

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id,review_status")
      .eq("id", body.jobId)
      .maybeSingle();

    if (jobError) throw new HttpError(500, jobError.message);
    if (!job || job.review_status !== "APPROVED") throw new HttpError(404, "Job not found");

    const resumeMeta = {
      resumeId: body.resumeId || null,
      generatedResumeId: body.generatedResumeId || null,
    };
    const compactCover = body.coverLetter?.trim();
    const composedCover = compactCover
      ? `${compactCover}\n\n[resume-meta] ${JSON.stringify(resumeMeta)}`
      : `[resume-meta] ${JSON.stringify(resumeMeta)}`;

    const { data, error } = await supabase
      .from("applications")
      .insert({
        job_id: body.jobId,
        job_seeker_id: authed.auth.userId,
        status: "APPLIED",
        cover_letter: composedCover,
      })
      .select("id,status,interview_at,created_at,job_id")
      .single();

    if (error && isUniqueViolation(error)) {
      throw new HttpError(409, "Already applied to this job");
    }
    if (error) throw new HttpError(500, error.message);

    res.status(201).json({
      application: {
        id: data.id,
        status: data.status,
        interviewAt: data.interview_at,
        createdAt: data.created_at,
        jobId: data.job_id,
      },
    });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.post("/recruiter/jobs", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const body = jobCreateSchema.parse(req.body);
    const ctx = await getRecruiterContext(authed.auth.userId);
    if (ctx.approvalStatus !== "APPROVED") {
      throw new HttpError(403, "Recruiter account is not approved yet");
    }

    const supabase = getSupabaseAdmin();
    const payload = {
      recruiter_id: ctx.userId,
      title: body.title,
      company_name: body.companyName || ctx.companyName,
      location: body.location,
      role: body.role,
      required_skills: body.requiredSkills,
      job_type: body.jobType,
      min_experience_years: body.minExperienceYears,
      description: body.description,
      open_to_freshers: body.openToFreshers,
      review_status: "PENDING_REVIEW",
      admin_feedback: null,
      reviewed_at: null,
      application_deadline: body.applicationDeadline || null,
    };

    const { data, error } = await supabase
      .from("jobs")
      .insert(payload)
      .select("id,recruiter_id,title,company_name,location,role,required_skills,job_type,min_experience_years,description,open_to_freshers,review_status,admin_feedback,reviewed_at,application_deadline,created_at")
      .single();

    if (error) throw new HttpError(500, error.message);
    res.status(201).json({ job: mapJob(data) });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.patch("/recruiter/jobs/:jobId", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const { jobId } = z.object({ jobId: z.string().uuid() }).parse(req.params);
    const body = jobCreateSchema.partial().parse(req.body);
    const ctx = await getRecruiterContext(authed.auth.userId);
    if (ctx.approvalStatus !== "APPROVED") {
      throw new HttpError(403, "Recruiter account is not approved yet");
    }

    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = {
      review_status: "PENDING_REVIEW",
      admin_feedback: null,
      reviewed_at: null,
    };
    if (body.title !== undefined) payload.title = body.title;
    if (body.companyName !== undefined) payload.company_name = body.companyName;
    if (body.location !== undefined) payload.location = body.location;
    if (body.role !== undefined) payload.role = body.role;
    if (body.requiredSkills !== undefined) payload.required_skills = body.requiredSkills;
    if (body.jobType !== undefined) payload.job_type = body.jobType;
    if (body.minExperienceYears !== undefined) payload.min_experience_years = body.minExperienceYears;
    if (body.description !== undefined) payload.description = body.description;
    if (body.openToFreshers !== undefined) payload.open_to_freshers = body.openToFreshers;
    if (body.applicationDeadline !== undefined) payload.application_deadline = body.applicationDeadline;

    const { data, error } = await supabase
      .from("jobs")
      .update(payload)
      .eq("id", jobId)
      .eq("recruiter_id", ctx.userId)
      .select("id,recruiter_id,title,company_name,location,role,required_skills,job_type,min_experience_years,description,open_to_freshers,review_status,admin_feedback,reviewed_at,application_deadline,created_at")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "Job not found");

    res.json({ job: mapJob(data) });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.delete("/recruiter/jobs/:jobId", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const { jobId } = z.object({ jobId: z.string().uuid() }).parse(req.params);
    const ctx = await getRecruiterContext(authed.auth.userId);
    if (ctx.approvalStatus !== "APPROVED") {
      throw new HttpError(403, "Recruiter account is not approved yet");
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("jobs")
      .delete()
      .eq("id", jobId)
      .eq("recruiter_id", ctx.userId)
      .select("id")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "Job not found");

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/recruiter/jobs/:jobId/applicants", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const { jobId } = z.object({ jobId: z.string().uuid() }).parse(req.params);
    const query = z.object({ skill: z.string().trim().optional() }).parse(req.query);
    const ctx = await getRecruiterContext(authed.auth.userId);

    const supabase = getSupabaseAdmin();
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("recruiter_id", ctx.userId)
      .maybeSingle();

    if (jobError) throw new HttpError(500, jobError.message);
    if (!job) throw new HttpError(404, "Job not found");

    const { data: apps, error: appsError } = await supabase
      .from("applications")
      .select("id,status,interview_at,created_at,job_seeker_id")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (appsError) throw new HttpError(500, appsError.message);

    const seekerIds = Array.from(new Set((apps || []).map((a) => a.job_seeker_id)));
    if (seekerIds.length === 0) {
      res.json({ applicants: [] });
      return;
    }

    const [{ data: profiles, error: profilesError }, { data: seekerProfiles, error: seekerProfilesError }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,location,phone,headline,about").in("id", seekerIds),
      supabase.from("job_seeker_profiles").select("user_id,skills,experience_years,desired_role,is_fresher").in("user_id", seekerIds),
    ]);

    if (profilesError) throw new HttpError(500, profilesError.message);
    if (seekerProfilesError) throw new HttpError(500, seekerProfilesError.message);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const seekerProfileMap = new Map((seekerProfiles || []).map((p: any) => [p.user_id, p]));

    const { data: resumes, error: resumesError } = await supabase
      .from("resumes")
      .select("id,job_seeker_id,original_name,created_at")
      .in("job_seeker_id", seekerIds)
      .order("created_at", { ascending: false });
    if (resumesError) throw new HttpError(500, resumesError.message);

    const latestResumeBySeeker = new Map<string, { id: string; originalName: string }>();
    for (const r of resumes || []) {
      if (!latestResumeBySeeker.has(r.job_seeker_id)) {
        latestResumeBySeeker.set(r.job_seeker_id, { id: r.id, originalName: r.original_name });
      }
    }

    const requiredSkill = query.skill?.toLowerCase() || "";
    const applicants = (apps || [])
      .map((app: any) => {
        const profile = profileMap.get(app.job_seeker_id);
        const seeker = seekerProfileMap.get(app.job_seeker_id);
        const skills = (seeker?.skills || []) as string[];
        return {
          applicationId: app.id,
          status: app.status,
          interviewAt: app.interview_at,
          candidate: {
            id: app.job_seeker_id,
            fullName: profile?.full_name || "Unknown Candidate",
            location: profile?.location || null,
            phone: profile?.phone || null,
            headline: profile?.headline || null,
            about: profile?.about || null,
            skills,
            experienceYears: seeker?.experience_years || 0,
            desiredRole: seeker?.desired_role || null,
            isFresher: seeker?.is_fresher ?? false,
            latestResume: latestResumeBySeeker.get(app.job_seeker_id) || null,
          },
        };
      })
      .filter((row) => !requiredSkill || row.candidate.skills.some((s) => s.toLowerCase().includes(requiredSkill)));

    res.json({ applicants });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/recruiter/applications", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const q = z.object({ status: appStatusSchema.optional() }).parse(req.query);
    const ctx = await getRecruiterContext(authed.auth.userId);
    const supabase = getSupabaseAdmin();

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id,title,company_name,location,role,required_skills")
      .eq("recruiter_id", ctx.userId);
    if (jobsError) throw new HttpError(500, jobsError.message);

    const jobIds = (jobs || []).map((j: any) => j.id);
    if (jobIds.length === 0) {
      res.json({ applications: [] });
      return;
    }

    let appsQuery = supabase
      .from("applications")
      .select("id,status,interview_at,created_at,job_id,job_seeker_id")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });
    if (q.status) appsQuery = appsQuery.eq("status", q.status);
    if (q.status === "INTERVIEW_SCHEDULED") {
      appsQuery = appsQuery.not("interview_at", "is", null);
    }

    const { data: apps, error: appsError } = await appsQuery;
    if (appsError) throw new HttpError(500, appsError.message);

    const seekerIds = Array.from(new Set((apps || []).map((a: any) => a.job_seeker_id)));
    const [{ data: profiles, error: profilesError }, { data: seekerProfiles, error: seekerProfilesError }] = await Promise.all([
      seekerIds.length
        ? supabase.from("profiles").select("id,full_name,location,phone,headline,about").in("id", seekerIds)
        : Promise.resolve({ data: [], error: null }),
      seekerIds.length
        ? supabase.from("job_seeker_profiles").select("user_id,skills,experience_years,desired_role,is_fresher").in("user_id", seekerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesError) throw new HttpError(500, profilesError.message);
    if (seekerProfilesError) throw new HttpError(500, seekerProfilesError.message);

    const jobMap = new Map((jobs || []).map((j: any) => [j.id, j]));
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const seekerProfileMap = new Map((seekerProfiles || []).map((p: any) => [p.user_id, p]));

    const { data: resumes, error: resumesError } = seekerIds.length
      ? await supabase
          .from("resumes")
          .select("id,job_seeker_id,original_name,created_at")
          .in("job_seeker_id", seekerIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (resumesError) throw new HttpError(500, resumesError.message);

    const latestResumeBySeeker = new Map<string, { id: string; originalName: string }>();
    for (const r of resumes || []) {
      if (!latestResumeBySeeker.has(r.job_seeker_id)) {
        latestResumeBySeeker.set(r.job_seeker_id, { id: r.id, originalName: r.original_name });
      }
    }

    const applications = (apps || []).map((app: any) => {
      const job = jobMap.get(app.job_id);
      const profile = profileMap.get(app.job_seeker_id);
      const seeker = seekerProfileMap.get(app.job_seeker_id);

      return {
        id: app.id,
        applicationId: app.id,
        status: app.status,
        interviewAt: app.interview_at,
        createdAt: app.created_at,
        job: {
          id: app.job_id,
          title: job?.title || "Unknown Role",
          companyName: job?.company_name || ctx.companyName,
          location: job?.location || "-",
          role: job?.role || "-",
          requiredSkills: job?.required_skills || [],
        },
        candidate: {
          id: app.job_seeker_id,
          fullName: profile?.full_name || "Unknown Candidate",
          location: profile?.location || null,
          phone: profile?.phone || null,
          headline: profile?.headline || null,
          about: profile?.about || null,
          skills: seeker?.skills || [],
          experienceYears: seeker?.experience_years || 0,
          desiredRole: seeker?.desired_role || null,
          isFresher: seeker?.is_fresher ?? false,
          latestResume: latestResumeBySeeker.get(app.job_seeker_id) || null,
        },
      };
    });

    res.json({ applications });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.patch("/recruiter/applications/:applicationId", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const { applicationId } = z.object({ applicationId: z.string().uuid() }).parse(req.params);
    const body = z.object({
      status: appStatusSchema,
      interviewAt: z.string().datetime().nullable().optional(),
    }).parse(req.body);

    const ctx = await getRecruiterContext(authed.auth.userId);
    if (ctx.approvalStatus !== "APPROVED") {
      throw new HttpError(403, "Recruiter account is not approved yet");
    }

    const supabase = getSupabaseAdmin();

    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id,job_id,job_seeker_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (appError) throw new HttpError(500, appError.message);
    if (!app) throw new HttpError(404, "Application not found");

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id,title")
      .eq("id", app.job_id)
      .eq("recruiter_id", ctx.userId)
      .maybeSingle();
    if (jobError) throw new HttpError(500, jobError.message);
    if (!job) throw new HttpError(403, "Forbidden");

    const rpc = await supabase.rpc("recruiter_update_application_status", {
      p_application_id: applicationId,
      p_recruiter_user_id: ctx.userId,
      p_next_status: body.status,
      p_interview_at: body.status === "INTERVIEW_SCHEDULED" ? (body.interviewAt || null) : null,
    });

    // Backward-compatible fallback for environments where migration is not applied yet.
    if (rpc.error && rpc.error.code === "PGRST202") {
      const payload: Record<string, string | null> = { status: body.status };
      payload.interview_at = body.status === "INTERVIEW_SCHEDULED" ? (body.interviewAt || null) : null;

      const { data: updated, error: updateError } = await supabase
        .from("applications")
        .update(payload)
        .eq("id", applicationId)
        .select("id,status,interview_at")
        .single();
      if (updateError) throw new HttpError(500, updateError.message);

      await supabase.from("notifications").insert({
        user_id: app.job_seeker_id,
        type: "STATUS",
        message: `Your application status for ${job.title} is now ${body.status}.`,
        metadata: { applicationId, status: body.status },
      });

      res.json({ application: updated });
      return;
    }

    if (rpc.error) throw new HttpError(500, rpc.error.message);

    const updated = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    res.json({ application: updated });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.delete("/recruiter/applications/:applicationId", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const { applicationId } = z.object({ applicationId: z.string().uuid() }).parse(req.params);

    const ctx = await getRecruiterContext(authed.auth.userId);
    if (ctx.approvalStatus !== "APPROVED") {
      throw new HttpError(403, "Recruiter account is not approved yet");
    }

    const supabase = getSupabaseAdmin();

    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id,job_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (appError) throw new HttpError(500, appError.message);
    if (!app) throw new HttpError(404, "Application not found");

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", app.job_id)
      .eq("recruiter_id", ctx.userId)
      .maybeSingle();
    if (jobError) throw new HttpError(500, jobError.message);
    if (!job) throw new HttpError(403, "Forbidden");

    const { error: delError } = await supabase
      .from("applications")
      .delete()
      .eq("id", applicationId);
    if (delError) throw new HttpError(500, delError.message);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/recruiter/overview", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const ctx = await getRecruiterContext(authed.auth.userId);
    const supabase = getSupabaseAdmin();

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id")
      .eq("recruiter_id", ctx.userId);
    if (jobsError) throw new HttpError(500, jobsError.message);

    const jobIds = (jobs || []).map((j: any) => j.id);
    const jobsCount = jobIds.length;

    const { data: apps, error: appsError } = jobIds.length
      ? await supabase
          .from("applications")
          .select("status,created_at,job_id")
          .in("job_id", jobIds)
      : { data: [], error: null };

    if (appsError) throw new HttpError(500, appsError.message);

    const counts = (apps || []).reduce<Record<string, number>>((acc, item: any) => {
      acc.total = (acc.total || 0) + 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, { total: 0 });

    const now = new Date();
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const views = labels.map(() => Math.max(5, Math.floor((counts.total || 0) / 3)));
    const applicationsSeries = labels.map((_, idx) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - idx));
      return (apps || []).filter((a: any) => {
        const createdAt = new Date(a.created_at);
        return createdAt.toDateString() === day.toDateString();
      }).length;
    });

    let topJob: { title: string; company: string; applicants: number } | null = null;
    if ((apps || []).length > 0) {
      const agg = new Map<string, number>();
      for (const a of apps as any[]) {
        agg.set(a.job_id, (agg.get(a.job_id) || 0) + 1);
      }

      const topEntry = Array.from(agg.entries()).sort((a, b) => b[1] - a[1])[0];
      if (topEntry) {
        const { data: topJobData, error: topJobError } = await supabase
          .from("jobs")
          .select("title,company_name")
          .eq("id", topEntry[0])
          .maybeSingle();
        if (topJobError) throw new HttpError(500, topJobError.message);
        if (topJobData) {
          topJob = {
            title: topJobData.title,
            company: topJobData.company_name,
            applicants: topEntry[1],
          };
        }
      }
    }

    const total = counts.total || 0;
    const qualityScore = total > 0
      ? Math.round((((counts.SHORTLISTED || 0) + (counts.INTERVIEW_SCHEDULED || 0)) / total) * 100)
      : 0;

    res.json({
      overview: {
        jobsCount,
        applicationsTotal: total,
        shortlisted: counts.SHORTLISTED || 0,
        rejected: counts.REJECTED || 0,
        interviews: counts.INTERVIEW_SCHEDULED || 0,
        offered: counts.OFFERED || 0,
        hired: counts.HIRED || 0,
        funnel: {
          applied: counts.APPLIED || 0,
          shortlisted: counts.SHORTLISTED || 0,
          interview: counts.INTERVIEW_SCHEDULED || 0,
          offered: counts.OFFERED || 0,
          hired: counts.HIRED || 0,
        },
        weekly: {
          labels,
          views,
          applications: applicationsSeries,
        },
        topJob,
        avgTimeToHire: 14,
        qualityScore,
      },
    });
  } catch (err) {
    next(err);
  }
});
