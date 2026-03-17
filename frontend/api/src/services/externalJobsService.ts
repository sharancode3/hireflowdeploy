import crypto from "node:crypto";
import { env } from "../env";
import { getSupabaseAdmin, isSupabaseConfigured } from "../supabase";

type ExternalJobType = "full_time" | "part_time" | "internship" | "contract" | "freelance";

type NormalizedExternalJob = {
  source: string;
  external_id: string;
  dedupe_key: string;
  title: string;
  company: string;
  location_city: string | null;
  location_state: string | null;
  location_country: string;
  is_remote: boolean;
  is_hybrid: boolean;
  is_onsite: boolean;
  job_type: ExternalJobType;
  experience_level: string;
  min_experience_years: number;
  skills: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  apply_url: string;
  description: string;
  posted_at: string;
  application_deadline: string | null;
  active_until: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  content_hash: string;
  last_seen_at: string;
};

type SourceStats = {
  source: string;
  fetched: number;
  normalized: number;
};

const DEFAULT_SYNC_INTERVAL_MINUTES = 60;
const DEFAULT_POSTED_WINDOW_DAYS = 14;
const FETCH_TIMEOUT_MS = 12000;

let syncInProgress = false;
let lastSyncAt: string | null = null;
let lastSyncStats: SourceStats[] = [];

function normalizeJobType(value: string): ExternalJobType {
  const v = value.toLowerCase();
  if (v.includes("intern")) return "internship";
  if (v.includes("part")) return "part_time";
  if (v.includes("contract")) return "contract";
  if (v.includes("freelance")) return "freelance";
  return "full_time";
}

function pickExperienceLevel(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/fresher|entry|intern/.test(text)) return "fresher";
  if (/junior|1\s*-\s*3|2\+? years/.test(text)) return "junior";
  if (/senior|staff|lead|principal/.test(text)) return "senior";
  if (/mid|3\s*-\s*5|4\+? years/.test(text)) return "mid";
  return "any";
}

function pickMinYears(description: string): number {
  const match = description.match(/(\d+)\s*\+?\s*(?:years?|yrs?)/i);
  if (!match?.[1]) return 0;
  const years = Number(match[1]);
  return Number.isFinite(years) ? Math.max(0, Math.min(25, years)) : 0;
}

function extractSkills(title: string, description: string, tags: string[] = []): string[] {
  const dictionary = [
    "react", "typescript", "javascript", "node", "express", "python", "java", "go", "rust", "sql", "postgres", "mysql",
    "mongodb", "redis", "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "next.js", "vue", "angular", "tailwind",
    "flutter", "react native", "swift", "kotlin", "figma", "power bi", "tableau", "excel", "etl", "spark", "hadoop",
    "spring", "spring boot", "django", "flask", "fastapi", "graphql", "rest", "microservices", "testing", "jest", "cypress",
    "jira", "salesforce", "oracle", "sap", "devops", "linux", "ci/cd", "git", "llm", "ai", "machine learning", "nlp",
  ];
  const text = `${title} ${description} ${tags.join(" ")}`.toLowerCase();
  const fromText = dictionary.filter((item) => new RegExp(`\\b${item.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(text));
  const fromTags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([...fromText, ...fromTags])).slice(0, 16);
}

function parseLocation(raw: string): { city: string | null; state: string | null; country: string; isRemote: boolean } {
  const value = String(raw || "").trim();
  const isRemote = /remote|worldwide|anywhere/i.test(value);
  if (!value) return { city: null, state: null, country: "Global", isRemote };
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);

  const indiaHint = /india|andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal|delhi|new delhi|mumbai|bengaluru|bangalore|hyderabad|pune|chennai|kolkata|ahmedabad|surat|jaipur|lucknow/i.test(value);

  return {
    city: parts[0] || null,
    state: parts[1] || null,
    country: parts[2] || (indiaHint ? "India" : "Global"),
    isRemote,
  };
}

function normalizeApplyUrl(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

function isIndiaFocusedJob(job: NormalizedExternalJob): boolean {
  const haystack = `${job.location_city || ""} ${job.location_state || ""} ${job.location_country || ""}`.toLowerCase();
  return /\bindia\b|andhra|arunachal|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal|jharkhand|karnataka|kerala|madhya|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil|telangana|tripura|uttar|uttarakhand|bengal|delhi|mumbai|bengaluru|bangalore|hyderabad|pune|chennai|kolkata|ahmedabad|surat|jaipur|lucknow/.test(haystack);
}

function stableHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toActiveUntil(postedAtIso: string, deadlineIso: string | null): string {
  if (deadlineIso) return deadlineIso;
  const posted = new Date(postedAtIso);
  posted.setDate(posted.getDate() + 30);
  return posted.toISOString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithInit<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRemotiveJobs(): Promise<{ jobs: NormalizedExternalJob[]; stats: SourceStats }> {
  type RemotiveResponse = {
    jobs: Array<{
      id: number;
      title: string;
      company_name: string;
      category: string;
      candidate_required_location: string;
      publication_date: string;
      url: string;
      job_type: string;
      salary: string | null;
      description: string;
      tags: string[];
    }>;
  };

  const payload = await fetchJson<RemotiveResponse>("https://remotive.com/api/remote-jobs");
  const fetched = payload.jobs.length;

  const jobs = payload.jobs
    .filter((j) => Boolean(j.url) && Boolean(j.title) && Boolean(j.company_name))
    .map((j) => {
      const postedAt = toIso(j.publication_date) || new Date().toISOString();
      const parsedLoc = parseLocation(j.candidate_required_location);
      const applyUrl = normalizeApplyUrl(j.url);
      const dedupeKey = stableHash(`${j.title.toLowerCase()}|${j.company_name.toLowerCase()}|${applyUrl}`);
      const contentHash = stableHash(`${j.title}|${j.company_name}|${j.description || ""}`);
      const nowIso = new Date().toISOString();

      return {
        source: "remotive",
        external_id: String(j.id),
        dedupe_key: dedupeKey,
        title: j.title,
        company: j.company_name,
        location_city: parsedLoc.city,
        location_state: parsedLoc.state,
        location_country: parsedLoc.country,
        is_remote: true,
        is_hybrid: false,
        is_onsite: false,
        job_type: normalizeJobType(j.job_type || j.category || "full_time"),
        experience_level: pickExperienceLevel(j.title, j.description),
        min_experience_years: pickMinYears(j.description),
        skills: extractSkills(j.title, j.description, j.tags),
        salary_min: null,
        salary_max: null,
        salary_currency: "USD",
        apply_url: applyUrl,
        description: String(j.description || "").slice(0, 12000),
        posted_at: postedAt,
        application_deadline: null,
        active_until: toActiveUntil(postedAt, null),
        is_active: true,
        metadata: { category: j.category, raw_job_type: j.job_type },
        content_hash: contentHash,
        last_seen_at: nowIso,
      } satisfies NormalizedExternalJob;
    });

  return { jobs, stats: { source: "remotive", fetched, normalized: jobs.length } };
}

async function fetchArbeitnowJobs(): Promise<{ jobs: NormalizedExternalJob[]; stats: SourceStats }> {
  type ArbeitnowResponse = {
    data: Array<{
      slug: string;
      company_name: string;
      title: string;
      description: string;
      remote: boolean;
      url: string;
      tags: string[];
      job_types: string[];
      location: string;
      created_at: number;
    }>;
  };

  const payload = await fetchJson<ArbeitnowResponse>("https://www.arbeitnow.com/api/job-board-api");
  const fetched = payload.data.length;

  const jobs = payload.data
    .filter((j) => Boolean(j.url) && Boolean(j.title) && Boolean(j.company_name))
    .map((j) => {
      const postedAt = toIso(new Date(j.created_at * 1000)) || new Date().toISOString();
      const parsedLoc = parseLocation(j.location);
      const applyUrl = normalizeApplyUrl(j.url);
      const dedupeKey = stableHash(`${j.title.toLowerCase()}|${j.company_name.toLowerCase()}|${applyUrl}`);
      const contentHash = stableHash(`${j.title}|${j.company_name}|${j.description || ""}`);
      const nowIso = new Date().toISOString();

      return {
        source: "arbeitnow",
        external_id: j.slug,
        dedupe_key: dedupeKey,
        title: j.title,
        company: j.company_name,
        location_city: parsedLoc.city,
        location_state: parsedLoc.state,
        location_country: parsedLoc.country,
        is_remote: Boolean(j.remote) || parsedLoc.isRemote,
        is_hybrid: false,
        is_onsite: !(Boolean(j.remote) || parsedLoc.isRemote),
        job_type: normalizeJobType((j.job_types || []).join(" ")),
        experience_level: pickExperienceLevel(j.title, j.description),
        min_experience_years: pickMinYears(j.description),
        skills: extractSkills(j.title, j.description, j.tags || []),
        salary_min: null,
        salary_max: null,
        salary_currency: "USD",
        apply_url: applyUrl,
        description: String(j.description || "").slice(0, 12000),
        posted_at: postedAt,
        application_deadline: null,
        active_until: toActiveUntil(postedAt, null),
        is_active: true,
        metadata: { job_types: j.job_types || [] },
        content_hash: contentHash,
        last_seen_at: nowIso,
      } satisfies NormalizedExternalJob;
    });

  return { jobs, stats: { source: "arbeitnow", fetched, normalized: jobs.length } };
}

async function fetchMuseJobs(): Promise<{ jobs: NormalizedExternalJob[]; stats: SourceStats }> {
  type MuseResponse = {
    page: number;
    page_count: number;
    results: Array<{
      id: number;
      name: string;
      contents: string;
      publication_date: string;
      locations: Array<{ name: string }>;
      levels: Array<{ name: string }>;
      categories: Array<{ name: string }>;
      refs: { landing_page: string };
      company: { name: string };
    }>;
  };

  const pageOne = await fetchJson<MuseResponse>("https://www.themuse.com/api/public/jobs?page=1&descending=true");
  const pageCount = Math.min(pageOne.page_count || 1, 3);
  const pages = [pageOne];
  for (let page = 2; page <= pageCount; page += 1) {
    pages.push(await fetchJson<MuseResponse>(`https://www.themuse.com/api/public/jobs?page=${page}&descending=true`));
  }

  const rows = pages.flatMap((p) => p.results || []);
  const fetched = rows.length;

  const jobs = rows
    .filter((j) => Boolean(j.refs?.landing_page) && Boolean(j.name) && Boolean(j.company?.name))
    .map((j) => {
      const locationName = j.locations?.[0]?.name || "Global";
      const parsedLoc = parseLocation(locationName);
      const applyUrl = normalizeApplyUrl(j.refs.landing_page);
      const postedAt = toIso(j.publication_date) || new Date().toISOString();
      const dedupeKey = stableHash(`${j.name.toLowerCase()}|${j.company.name.toLowerCase()}|${applyUrl}`);
      const contentHash = stableHash(`${j.name}|${j.company.name}|${j.contents || ""}`);
      const tags = [
        ...(j.categories || []).map((c) => c.name),
        ...(j.levels || []).map((l) => l.name),
      ];
      const nowIso = new Date().toISOString();

      return {
        source: "themuse",
        external_id: String(j.id),
        dedupe_key: dedupeKey,
        title: j.name,
        company: j.company.name,
        location_city: parsedLoc.city,
        location_state: parsedLoc.state,
        location_country: parsedLoc.country,
        is_remote: parsedLoc.isRemote,
        is_hybrid: false,
        is_onsite: !parsedLoc.isRemote,
        job_type: normalizeJobType(tags.join(" ")),
        experience_level: pickExperienceLevel(j.name, j.contents || ""),
        min_experience_years: pickMinYears(j.contents || ""),
        skills: extractSkills(j.name, j.contents || "", tags),
        salary_min: null,
        salary_max: null,
        salary_currency: "USD",
        apply_url: applyUrl,
        description: String(j.contents || "").slice(0, 12000),
        posted_at: postedAt,
        application_deadline: null,
        active_until: toActiveUntil(postedAt, null),
        is_active: true,
        metadata: { levels: j.levels || [], categories: j.categories || [] },
        content_hash: contentHash,
        last_seen_at: nowIso,
      } satisfies NormalizedExternalJob;
    });

  return { jobs, stats: { source: "themuse", fetched, normalized: jobs.length } };
}

async function fetchAdzunaJobsIfConfigured(): Promise<{ jobs: NormalizedExternalJob[]; stats: SourceStats }> {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    return { jobs: [], stats: { source: "adzuna", fetched: 0, normalized: 0 } };
  }

  type AdzunaResponse = {
    results: Array<{
      id: string;
      title: string;
      description: string;
      created: string;
      redirect_url: string;
      contract_type: string | null;
      salary_min: number | null;
      salary_max: number | null;
      company: { display_name: string };
      location: { display_name: string; area: string[] };
    }>;
  };

  const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${encodeURIComponent(env.ADZUNA_APP_ID)}&app_key=${encodeURIComponent(env.ADZUNA_APP_KEY)}&results_per_page=50&sort_by=date`;
  const payload = await fetchJson<AdzunaResponse>(url);
  const fetched = payload.results.length;

  const jobs = payload.results
    .filter((j) => Boolean(j.redirect_url) && Boolean(j.title) && Boolean(j.company?.display_name))
    .map((j) => {
      const parsedLoc = parseLocation(j.location?.display_name || "India");
      const applyUrl = normalizeApplyUrl(j.redirect_url);
      const postedAt = toIso(j.created) || new Date().toISOString();
      const dedupeKey = stableHash(`${j.title.toLowerCase()}|${j.company.display_name.toLowerCase()}|${applyUrl}`);
      const contentHash = stableHash(`${j.title}|${j.company.display_name}|${j.description || ""}`);
      const nowIso = new Date().toISOString();

      return {
        source: "adzuna",
        external_id: String(j.id),
        dedupe_key: dedupeKey,
        title: j.title,
        company: j.company.display_name,
        location_city: parsedLoc.city,
        location_state: parsedLoc.state,
        location_country: parsedLoc.country || "India",
        is_remote: parsedLoc.isRemote,
        is_hybrid: false,
        is_onsite: !parsedLoc.isRemote,
        job_type: normalizeJobType(j.contract_type || j.title),
        experience_level: pickExperienceLevel(j.title, j.description || ""),
        min_experience_years: pickMinYears(j.description || ""),
        skills: extractSkills(j.title, j.description || ""),
        salary_min: j.salary_min,
        salary_max: j.salary_max,
        salary_currency: "INR",
        apply_url: applyUrl,
        description: String(j.description || "").slice(0, 12000),
        posted_at: postedAt,
        application_deadline: null,
        active_until: toActiveUntil(postedAt, null),
        is_active: true,
        metadata: { source_location: j.location?.display_name || null },
        content_hash: contentHash,
        last_seen_at: nowIso,
      } satisfies NormalizedExternalJob;
    });

  return { jobs, stats: { source: "adzuna", fetched, normalized: jobs.length } };
}

async function fetchJsearchJobsIfConfigured(): Promise<{ jobs: NormalizedExternalJob[]; stats: SourceStats }> {
  if (!env.JSEARCH_API_KEY) {
    return { jobs: [], stats: { source: "jsearch", fetched: 0, normalized: 0 } };
  }

  type JsearchResponse = {
    data?: Array<{
      job_id?: string;
      job_title?: string;
      employer_name?: string;
      job_city?: string | null;
      job_state?: string | null;
      job_country?: string | null;
      job_is_remote?: boolean;
      job_employment_type?: string;
      job_description?: string;
      job_apply_link?: string;
      job_google_link?: string;
      job_posted_at_datetime_utc?: string | null;
      job_posted_at_timestamp?: number | null;
    }>;
  };

  const url = "https://jsearch.p.rapidapi.com/search?query=software%20engineer%20in%20india&page=1&num_pages=1&date_posted=all";
  const payload = await fetchJsonWithInit<JsearchResponse>(url, {
    headers: {
      "X-RapidAPI-Key": env.JSEARCH_API_KEY,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });

  const rows = payload.data || [];
  const fetched = rows.length;

  const jobs = rows
    .filter((j) => Boolean(j.job_title) && Boolean(j.employer_name))
    .map((j, idx) => {
      const applyUrl = normalizeApplyUrl(j.job_apply_link || j.job_google_link || "");
      const postedAt = toIso(j.job_posted_at_datetime_utc || (j.job_posted_at_timestamp ? new Date(j.job_posted_at_timestamp * 1000) : null))
        || new Date().toISOString();
      const title = String(j.job_title || "");
      const company = String(j.employer_name || "");
      const description = String(j.job_description || "");
      const locationText = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ");
      const parsedLoc = parseLocation(locationText || "India");
      const dedupeKey = stableHash(`${title.toLowerCase()}|${company.toLowerCase()}|${applyUrl || `${title}-${company}-${idx}`}`);
      const contentHash = stableHash(`${title}|${company}|${description}`);
      const nowIso = new Date().toISOString();

      return {
        source: "jsearch",
        external_id: String(j.job_id || `${title}-${company}-${idx}`),
        dedupe_key: dedupeKey,
        title,
        company,
        location_city: j.job_city || parsedLoc.city,
        location_state: j.job_state || parsedLoc.state,
        location_country: j.job_country || parsedLoc.country || "India",
        is_remote: Boolean(j.job_is_remote) || parsedLoc.isRemote,
        is_hybrid: false,
        is_onsite: !(Boolean(j.job_is_remote) || parsedLoc.isRemote),
        job_type: normalizeJobType(j.job_employment_type || title),
        experience_level: pickExperienceLevel(title, description),
        min_experience_years: pickMinYears(description),
        skills: extractSkills(title, description),
        salary_min: null,
        salary_max: null,
        salary_currency: "USD",
        apply_url: applyUrl || `https://www.google.com/search?q=${encodeURIComponent(`${title} ${company} jobs`)}`,
        description: description.slice(0, 12000),
        posted_at: postedAt,
        application_deadline: null,
        active_until: toActiveUntil(postedAt, null),
        is_active: true,
        metadata: { provider: "rapidapi-jsearch" },
        content_hash: contentHash,
        last_seen_at: nowIso,
      } satisfies NormalizedExternalJob;
    });

  return { jobs, stats: { source: "jsearch", fetched, normalized: jobs.length } };
}

async function fetchSerpApiJobsIfConfigured(): Promise<{ jobs: NormalizedExternalJob[]; stats: SourceStats }> {
  if (!env.SERPAPI_KEY) {
    return { jobs: [], stats: { source: "serpapi", fetched: 0, normalized: 0 } };
  }

  type SerpApiResponse = {
    jobs_results?: Array<{
      job_id?: string;
      title?: string;
      company_name?: string;
      location?: string;
      description?: string;
      detected_extensions?: {
        posted_at?: string;
        schedule_type?: string;
      };
      related_links?: Array<{ link?: string }>;
      apply_options?: Array<{ link?: string }>;
    }>;
  };

  const url = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent("software engineer india")}&hl=en&gl=in&api_key=${encodeURIComponent(env.SERPAPI_KEY)}`;
  const payload = await fetchJson<SerpApiResponse>(url);
  const rows = payload.jobs_results || [];
  const fetched = rows.length;

  const jobs = rows
    .filter((j) => Boolean(j.title) && Boolean(j.company_name))
    .map((j, idx) => {
      const title = String(j.title || "");
      const company = String(j.company_name || "");
      const description = String(j.description || "");
      const parsedLoc = parseLocation(j.location || "India");
      const applyUrl = normalizeApplyUrl(
        j.apply_options?.find((x) => x.link)?.link
          || j.related_links?.find((x) => x.link)?.link
          || "",
      );
      const postedAt = toIso(j.detected_extensions?.posted_at || null) || new Date().toISOString();
      const dedupeKey = stableHash(`${title.toLowerCase()}|${company.toLowerCase()}|${applyUrl || `${title}-${company}-${idx}`}`);
      const contentHash = stableHash(`${title}|${company}|${description}`);
      const nowIso = new Date().toISOString();

      return {
        source: "serpapi",
        external_id: String(j.job_id || `${title}-${company}-${idx}`),
        dedupe_key: dedupeKey,
        title,
        company,
        location_city: parsedLoc.city,
        location_state: parsedLoc.state,
        location_country: parsedLoc.country || "India",
        is_remote: parsedLoc.isRemote,
        is_hybrid: false,
        is_onsite: !parsedLoc.isRemote,
        job_type: normalizeJobType(j.detected_extensions?.schedule_type || title),
        experience_level: pickExperienceLevel(title, description),
        min_experience_years: pickMinYears(description),
        skills: extractSkills(title, description),
        salary_min: null,
        salary_max: null,
        salary_currency: "INR",
        apply_url: applyUrl || `https://www.google.com/search?q=${encodeURIComponent(`${title} ${company} jobs`)}`,
        description: description.slice(0, 12000),
        posted_at: postedAt,
        application_deadline: null,
        active_until: toActiveUntil(postedAt, null),
        is_active: true,
        metadata: { provider: "serpapi-google-jobs" },
        content_hash: contentHash,
        last_seen_at: nowIso,
      } satisfies NormalizedExternalJob;
    });

  return { jobs, stats: { source: "serpapi", fetched, normalized: jobs.length } };
}

function trimToLatestWindow(jobs: NormalizedExternalJob[]): NormalizedExternalJob[] {
  const windowDays = Number(env.EXTERNAL_JOBS_POSTED_WINDOW_DAYS || DEFAULT_POSTED_WINDOW_DAYS);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(1, windowDays));
  const now = new Date();

  return jobs.filter((job) => {
    const postedAt = new Date(job.posted_at);
    const activeUntil = new Date(job.active_until);
    if (!(postedAt >= cutoff && activeUntil >= now)) return false;
    // Keep the feed mostly India-oriented while retaining high-value remote roles.
    return job.is_remote || isIndiaFocusedJob(job);
  });
}

export async function syncExternalJobsNow(): Promise<{ totalUpserted: number; stats: SourceStats[] }> {
  if (!isSupabaseConfigured()) {
    return { totalUpserted: 0, stats: [] };
  }
  if (syncInProgress) {
    return { totalUpserted: 0, stats: lastSyncStats };
  }

  syncInProgress = true;
  const startedAtIso = new Date().toISOString();
  try {
    const [remotive, arbeitnow, muse, adzuna, jsearch, serpapi] = await Promise.allSettled([
      fetchRemotiveJobs(),
      fetchArbeitnowJobs(),
      fetchMuseJobs(),
      fetchAdzunaJobsIfConfigured(),
      fetchJsearchJobsIfConfigured(),
      fetchSerpApiJobsIfConfigured(),
    ]);

    const stats: SourceStats[] = [];
    const allJobs: NormalizedExternalJob[] = [];

    for (const result of [remotive, arbeitnow, muse, adzuna, jsearch, serpapi]) {
      if (result.status === "fulfilled") {
        allJobs.push(...result.value.jobs);
        stats.push(result.value.stats);
      }
    }

    const latestJobs = trimToLatestWindow(allJobs);
    const byDedupe = new Map<string, NormalizedExternalJob>();
    for (const job of latestJobs) {
      const existing = byDedupe.get(job.dedupe_key);
      if (!existing) {
        byDedupe.set(job.dedupe_key, job);
        continue;
      }
      const currentDate = new Date(existing.posted_at).getTime();
      const nextDate = new Date(job.posted_at).getTime();
      if (nextDate > currentDate) byDedupe.set(job.dedupe_key, job);
    }

    const dedupedJobs = Array.from(byDedupe.values());
    if (!dedupedJobs.length) {
      lastSyncAt = startedAtIso;
      lastSyncStats = stats;
      return { totalUpserted: 0, stats };
    }

    const supabase = getSupabaseAdmin();
    let upsertResult = await supabase
      .from("external_jobs")
      .upsert(dedupedJobs, { onConflict: "dedupe_key" });

    // If dedupe key conflicts are ignored, we still handle source/external_id as fallback to remain resilient.
    const upsertError = upsertResult.error as { code?: string; message?: string; details?: string | null } | null;
    if (upsertError?.code === "23505" && String(upsertError.message || "").includes("uq_external_jobs_source_external_id")) {
      upsertResult = await supabase
        .from("external_jobs")
        .upsert(dedupedJobs, { onConflict: "source,external_id" });
    }

    const upsertErrorCode = (upsertResult.error as { code?: string } | null)?.code;
    if (upsertResult.error && (upsertErrorCode === "42P01" || upsertErrorCode === "PGRST205")) {
      lastSyncAt = startedAtIso;
      lastSyncStats = stats;
      return { totalUpserted: 0, stats };
    }
    if (upsertResult.error) throw upsertResult.error;

    const deactivateResult = await supabase
      .from("external_jobs")
      .update({ is_active: false })
      .lt("last_seen_at", startedAtIso)
      .eq("is_active", true);

    if (deactivateResult.error) throw deactivateResult.error;

    lastSyncAt = startedAtIso;
    lastSyncStats = stats;
    return { totalUpserted: dedupedJobs.length, stats };
  } finally {
    syncInProgress = false;
  }
}

export function getExternalJobsSyncStatus() {
  return {
    inProgress: syncInProgress,
    lastSyncAt,
    stats: lastSyncStats,
  };
}

export function startExternalJobsScheduler() {
  const intervalMinutes = Number(env.EXTERNAL_JOBS_SYNC_INTERVAL_MINUTES || DEFAULT_SYNC_INTERVAL_MINUTES);
  const safeMinutes = Number.isFinite(intervalMinutes) && intervalMinutes >= 5 ? intervalMinutes : DEFAULT_SYNC_INTERVAL_MINUTES;
  const intervalMs = safeMinutes * 60 * 1000;

  void syncExternalJobsNow().catch((err) => {
    console.error("[ExternalJobs] Initial sync failed:", err);
  });

  setInterval(() => {
    void syncExternalJobsNow().catch((err) => {
      console.error("[ExternalJobs] Scheduled sync failed:", err);
    });
  }, intervalMs);
}
