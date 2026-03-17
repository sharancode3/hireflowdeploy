import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../supabase";
import { getExternalJobsSyncStatus, syncExternalJobsNow } from "../../services/externalJobsService";

export const externalJobsRouter = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().optional(),
  jobType: z.enum(["full_time", "part_time", "internship", "contract", "freelance", "any"]).default("any"),
  location: z.string().trim().optional(),
  isRemote: z.enum(["true", "false"]).optional(),
  skills: z.string().trim().optional(),
  experienceLevel: z.enum(["fresher", "junior", "mid", "senior", "lead", "any"]).default("any"),
});

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

function isMissingExternalJobsTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205";
}

function isGoogleSearchUrl(url: string): boolean {
  const value = String(url || "").toLowerCase();
  return value.includes("google.com/search") || value.includes("google.co.in/search");
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

function mapRowToClient(job: ExternalJobRow) {
  const applyFallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(`${job.title} ${job.company} jobs in India`)}`;
  const hasApplyUrl = Boolean(String(job.apply_url || "").trim());
  const applyIsDirect = hasApplyUrl && !isGoogleSearchUrl(job.apply_url);
  const applyReliability = applyIsDirect ? "high" : "medium";

  return {
    _id: job.id,
    title: job.title,
    company: job.company,
    location: {
      city: job.location_city || undefined,
      state: job.location_state || undefined,
      country: job.location_country,
      isRemote: job.is_remote,
      isHybrid: job.is_hybrid,
      isOnsite: job.is_onsite,
    },
    jobType: job.job_type,
    experienceLevel: job.experience_level,
    minExperienceYears: job.min_experience_years,
    skills: job.skills || [],
    salaryMin: job.salary_min ?? undefined,
    salaryMax: job.salary_max ?? undefined,
    salaryCurrency: job.salary_currency,
    applyUrl: job.apply_url,
    applyFallbackUrl,
    applyReliability,
    applyIsDirect,
    applicationDeadline: job.application_deadline || job.active_until || undefined,
    activeUntil: job.active_until,
    postedAt: job.posted_at,
    source: job.source,
    description: job.description,
  };
}

externalJobsRouter.get("/external-jobs", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ message: "Supabase is not configured" });
    }

    const q = querySchema.parse(req.query);
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    let query = supabase
      .from("external_jobs")
      .select(
        "id,title,company,location_city,location_state,location_country,is_remote,is_hybrid,is_onsite,job_type,experience_level,min_experience_years,skills,salary_min,salary_max,salary_currency,apply_url,application_deadline,posted_at,active_until,source,description",
        { count: "exact" },
      )
      .eq("is_active", true)
      .gte("active_until", nowIso)
      .order("posted_at", { ascending: false });

    if (q.jobType !== "any") query = query.eq("job_type", q.jobType);
    if (q.experienceLevel !== "any") query = query.eq("experience_level", q.experienceLevel);
    if (q.isRemote === "true") query = query.eq("is_remote", true);

    if (q.location) {
      const escaped = q.location.replace(/,/g, "");
      query = query.or(`location_city.ilike.%${escaped}%,location_state.ilike.%${escaped}%,location_country.ilike.%${escaped}%`);
    }

    if (q.q) {
      const escaped = q.q.replace(/,/g, "");
      query = query.or(`title.ilike.%${escaped}%,company.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }

    if (q.skills) {
      const skillList = q.skills
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (skillList.length) query = query.contains("skills", skillList);
    }

    const { data, error, count } = await query;
    if (error && isMissingExternalJobsTable(error)) {
      return res.json({
        jobs: [],
        pagination: {
          page: q.page,
          limit: q.limit,
          total: 0,
          pages: 1,
          hasMore: false,
        },
      });
    }
    if (error) throw error;

    let effectiveRows = data || [];
    let effectiveCount = count || effectiveRows.length;

    // Fallback: if strict active-window query returns nothing, return latest cached rows.
    if (effectiveRows.length === 0) {
      let staleQuery = supabase
        .from("external_jobs")
        .select(
          "id,title,company,location_city,location_state,location_country,is_remote,is_hybrid,is_onsite,job_type,experience_level,min_experience_years,skills,salary_min,salary_max,salary_currency,apply_url,application_deadline,posted_at,active_until,source,description",
          { count: "exact" },
        )
        .order("posted_at", { ascending: false });

      if (q.jobType !== "any") staleQuery = staleQuery.eq("job_type", q.jobType);
      if (q.experienceLevel !== "any") staleQuery = staleQuery.eq("experience_level", q.experienceLevel);
      if (q.isRemote === "true") staleQuery = staleQuery.eq("is_remote", true);

      if (q.location) {
        const escaped = q.location.replace(/,/g, "");
        staleQuery = staleQuery.or(`location_city.ilike.%${escaped}%,location_state.ilike.%${escaped}%,location_country.ilike.%${escaped}%`);
      }

      if (q.q) {
        const escaped = q.q.replace(/,/g, "");
        staleQuery = staleQuery.or(`title.ilike.%${escaped}%,company.ilike.%${escaped}%,description.ilike.%${escaped}%`);
      }

      if (q.skills) {
        const skillList = q.skills
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (skillList.length) staleQuery = staleQuery.contains("skills", skillList);
      }

      const staleResult = await staleQuery;
      if (!staleResult.error) {
        effectiveRows = staleResult.data || [];
        effectiveCount = staleResult.count || effectiveRows.length;
      }
    }

    const ranked = effectiveRows
      .map((row) => mapRowToClient(row as ExternalJobRow))
      .sort((a, b) => {
        if (a.applyIsDirect !== b.applyIsDirect) return a.applyIsDirect ? -1 : 1;
        const bySource = sourcePriority(a.source) - sourcePriority(b.source);
        if (bySource !== 0) return bySource;
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      });

    const total = effectiveCount || ranked.length;
    const from = (q.page - 1) * q.limit;
    const to = from + q.limit;
    const jobs = ranked.slice(from, to);
    res.json({
      jobs,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        pages: Math.max(1, Math.ceil(total / q.limit)),
        hasMore: q.page * q.limit < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

externalJobsRouter.get("/external-jobs/:id", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ message: "Supabase is not configured" });
    }

    const id = z.string().uuid().parse(req.params.id);
    const nowIso = new Date().toISOString();

    const { data, error } = await getSupabaseAdmin()
      .from("external_jobs")
      .select(
        "id,title,company,location_city,location_state,location_country,is_remote,is_hybrid,is_onsite,job_type,experience_level,min_experience_years,skills,salary_min,salary_max,salary_currency,apply_url,application_deadline,posted_at,active_until,source,description",
      )
      .eq("id", id)
      .eq("is_active", true)
      .gte("active_until", nowIso)
      .maybeSingle();

    if (error && isMissingExternalJobsTable(error)) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Job not found" });

    res.json({ job: mapRowToClient(data as ExternalJobRow) });
  } catch (err) {
    next(err);
  }
});

externalJobsRouter.get("/external-jobs-status", async (_req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ message: "Supabase is not configured" });
    }

    const status = getExternalJobsSyncStatus();
    const { count, error } = await getSupabaseAdmin()
      .from("external_jobs")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .gte("active_until", new Date().toISOString());

    if (error && isMissingExternalJobsTable(error)) {
      return res.json({ ...status, activeJobs: 0 });
    }
    if (error) throw error;

    res.json({ ...status, activeJobs: count || 0 });
  } catch (err) {
    next(err);
  }
});

externalJobsRouter.post("/external-jobs/sync", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ message: "Supabase is not configured" });
    }
    

    const authHeader = String(req.header("x-sync-key") || "");
    const expected = String(process.env.EXTERNAL_JOBS_SYNC_KEY || "");
    if (expected && authHeader !== expected) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await syncExternalJobsNow();
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});
