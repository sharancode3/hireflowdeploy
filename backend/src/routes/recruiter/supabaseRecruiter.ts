import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth";
import { HttpError } from "../../utils/httpError";
import { getSupabaseAdmin, isSupabaseConfigured } from "../../supabase";
import { sendResumeShareEmail } from "../../utils/emailAutomation";

export const recruiterSupabaseRouter = Router();

recruiterSupabaseRouter.use(["/job-seeker", "/recruiter", "/notifications", "/files", "/jobs"], requireAuth);

const resumesUploadDir = path.resolve(process.cwd(), "uploads", "resumes");
const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(resumesUploadDir, { recursive: true });
      cb(null, resumesUploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = new Set([".pdf", ".doc", ".docx"]);
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExt.has(ext)) return cb(new HttpError(400, "Only PDF/DOC/DOCX files are allowed"));
    cb(null, true);
  },
});

// Types
type ExperienceItem = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  startDate: string; // ISO date
  endDate: string | null; // ISO date
  summary: string;
};

type ProjectItem = {
  id: string;
  name: string;
  link: string | null;
  summary: string;
  skills: string[];
};

type EducationItem = {
  id: string;
  level?: "SCHOOL" | "DIPLOMA" | "BACHELOR" | "MASTER" | "PHD" | "OTHER";
  institution: string;
  degree: string;
  fieldOfStudy: string;
  awardingBody?: string | null;
  startYear: number;
  endYear: number | null;
  grade: string | null;
};

type CertificationItem = {
  id: string;
  name: string;
  issuer: string;
  issuedOn: string;
  expiresOn: string | null;
  credentialUrl: string | null;
};

type AchievementItem = {
  id: string;
  title: string;
  description: string;
  date: string | null;
};

function toUuidOrNew(value: unknown): string {
  const parsed = z.string().uuid().safeParse(value);
  return parsed.success ? parsed.data : crypto.randomUUID();
}

function normalizeExperienceItems(items: unknown[]): ExperienceItem[] {
  return items.map((item: any) => ({
    id: toUuidOrNew(item?.id),
    company: typeof item?.company === "string" ? item.company.trim() : "",
    title: typeof item?.title === "string" ? item.title.trim() : "",
    location: typeof item?.location === "string" ? item.location.trim() || null : null,
    startDate: typeof item?.startDate === "string" ? item.startDate : "",
    endDate: typeof item?.endDate === "string" ? item.endDate : null,
    summary: typeof item?.summary === "string" ? item.summary.trim() : "",
  }));
}

function normalizeProjectItems(items: unknown[]): ProjectItem[] {
  return items.map((item: any) => ({
    id: toUuidOrNew(item?.id),
    name: typeof item?.name === "string" ? item.name.trim() : "",
    link: typeof item?.link === "string" ? item.link.trim() || null : null,
    summary: typeof item?.summary === "string" ? item.summary.trim() : "",
    skills: Array.isArray(item?.skills)
      ? item.skills
        .filter((skill: unknown): skill is string => typeof skill === "string")
        .map((skill: string) => skill.trim())
        .filter(Boolean)
      : [],
  }));
}

function normalizeEducationItems(items: unknown[]): EducationItem[] {
  const currentYear = new Date().getFullYear();
  return items.map((item: any) => {
    const parsedLevel = z.enum(["SCHOOL", "DIPLOMA", "BACHELOR", "MASTER", "PHD", "OTHER"]).safeParse(item?.level);
    const startYearNum = Number(item?.startYear);
    const endYearNum = item?.endYear === null || item?.endYear === undefined || item?.endYear === ""
      ? null
      : Number(item?.endYear);

    return {
      id: toUuidOrNew(item?.id),
      level: parsedLevel.success ? parsedLevel.data : "OTHER",
      institution: typeof item?.institution === "string" ? item.institution.trim() : "",
      degree: typeof item?.degree === "string" ? item.degree.trim() : "",
      fieldOfStudy: typeof item?.fieldOfStudy === "string" ? item.fieldOfStudy.trim() : "",
      awardingBody: typeof item?.awardingBody === "string" ? item.awardingBody.trim() || null : null,
      startYear: Number.isFinite(startYearNum) ? Math.max(1950, Math.min(2100, Math.trunc(startYearNum))) : currentYear,
      endYear: endYearNum !== null && Number.isFinite(endYearNum)
        ? Math.max(1950, Math.min(2100, Math.trunc(endYearNum)))
        : null,
      grade: typeof item?.grade === "string" ? item.grade.trim() || null : null,
    };
  });
}

function normalizeCertificationItems(items: unknown[]): CertificationItem[] {
  return items.map((item: any) => ({
    id: toUuidOrNew(item?.id),
    name: typeof item?.name === "string" ? item.name.trim() : "",
    issuer: typeof item?.issuer === "string" ? item.issuer.trim() : "",
    issuedOn: typeof item?.issuedOn === "string" ? item.issuedOn : new Date().toISOString().slice(0, 10),
    expiresOn: typeof item?.expiresOn === "string" && item.expiresOn.trim() ? item.expiresOn : null,
    credentialUrl: typeof item?.credentialUrl === "string" && item.credentialUrl.trim() ? item.credentialUrl.trim() : null,
  }));
}

function normalizeAchievementItems(items: unknown[]): AchievementItem[] {
  return items.map((item: any) => ({
    id: toUuidOrNew(item?.id),
    title: typeof item?.title === "string" ? item.title.trim() : "",
    description: typeof item?.description === "string" ? item.description.trim() : "",
    date: typeof item?.date === "string" && item.date.trim() ? item.date : null,
  }));
}

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

const jobSeekerProfilePatchSchema = z.object({
  photoDataUrl: z.string().trim().nullable().optional(),
  fullName: z.string().trim().min(1).optional(),
  phone: z.string().trim().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  headline: z.string().trim().nullable().optional(),
  about: z.string().trim().max(5000).nullable().optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  desiredRole: z.string().trim().nullable().optional(),
  skills: z.array(z.string().trim().min(1)).max(100).optional(),
  skillLevels: z.record(z.string(), z.number().int().min(1).max(5)).optional(),
  interests: z.array(z.string().trim().min(1)).max(100).optional(),
  education: z.array(
    z.object({
      id: z.string(),
      level: z.enum(["SCHOOL", "DIPLOMA", "BACHELOR", "MASTER", "PHD", "OTHER"]).optional(),
      institution: z.string().trim(),
      degree: z.string().trim(),
      fieldOfStudy: z.string().trim(),
      awardingBody: z.string().trim().nullable().optional(),
      startYear: z.number().int(),
      endYear: z.number().int().nullable().optional(),
      grade: z.string().trim().nullable().optional(),
    })
  ).optional(),
  experience: z.array(
    z.object({
      id: z.string(),
      company: z.string().trim(),
      title: z.string().trim(),
      location: z.string().trim().nullable().optional(),
      startDate: z.string(),
      endDate: z.string().nullable().optional(),
      summary: z.string().trim(),
    })
  ).optional(),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string().trim(),
      link: z.string().trim().nullable().optional(),
      summary: z.string().trim(),
      skills: z.array(z.string().trim()),
    })
  ).optional(),
  certifications: z.array(
    z.object({
      id: z.string(),
      name: z.string().trim(),
      issuer: z.string().trim(),
      issuedOn: z.string(),
      expiresOn: z.string().nullable().optional(),
      credentialUrl: z.string().trim().nullable().optional(),
    })
  ).optional(),
  achievements: z.array(
    z.object({
      id: z.string(),
      title: z.string().trim(),
      description: z.string().trim(),
      date: z.string().nullable().optional(),
    })
  ).optional(),
  languages: z.array(z.unknown()).optional(),
  isFresher: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  activeGeneratedResumeId: z.string().uuid().nullable().optional(),
});

const listingStageSchema = z.enum(["DRAFT", "PENDING", "ACTIVE", "PAUSED", "CLOSED"]);

const recruiterJobListingPreferencesPatchSchema = z.object({
  postJobDraft: z.record(z.string(), z.unknown()).nullable().optional(),
  listingStages: z.record(z.string(), listingStageSchema).optional(),
});

const resumeEmailSchema = z.object({
  to: z.string().trim().email(),
  title: z.string().trim().min(1).max(120),
  pdfBase64: z.string().trim().min(20),
});

type RecruiterContext = {
  userId: string;
  email: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  companyName: string;
};

type StoredJobSeekerProfileExtras = {
  photoDataUrl: string | null;
  skillLevels: Record<string, number>;
  interests: string[];
  education: unknown[];
  experience: unknown[];
  projects: unknown[];
  certifications: unknown[];
  achievements: unknown[];
  languages: unknown[];
};

type JobSeekerProfileResponse = {
  id: string;
  userId: string;
  photoDataUrl: string | null;
  fullName: string;
  phone: string | null;
  location: string | null;
  headline: string | null;
  about: string | null;
  experienceYears: number;
  desiredRole: string | null;
  skills: string[];
  skillLevels: Record<string, number>;
  interests: string[];
  education: unknown[];
  experience: unknown[];
  projects: unknown[];
  certifications: unknown[];
  achievements: unknown[];
  languages: unknown[];
  isFresher: boolean;
  visibility: "PUBLIC" | "PRIVATE";
  activeGeneratedResumeId: string | null;
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

function isColumnMissingError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42703" || code === "PGRST204";
}

const PROFILE_BUILDER_SETTINGS_KEY = "profileBuilder";

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function splitFullName(fullName: string): { firstName: string; lastName: string | null } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "User", lastName: null };
  }

  const [firstName = "User", ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.length ? rest.join(" ") : null,
  };
}

function joinFullName(firstName: unknown, lastName: unknown, fallback: string): string {
  const parts = [firstName, lastName]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return parts.join(" ") || fallback;
}

function defaultStoredJobSeekerProfileExtras(): StoredJobSeekerProfileExtras {
  return {
    photoDataUrl: null,
    skillLevels: {},
    interests: [],
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    achievements: [],
    languages: [],
  };
}

function readStoredJobSeekerProfileExtras(settings: Record<string, unknown>): StoredJobSeekerProfileExtras {
  const defaults = defaultStoredJobSeekerProfileExtras();
  const raw = settings[PROFILE_BUILDER_SETTINGS_KEY];

  if (!raw || typeof raw !== "object") return defaults;

  const source = raw as Record<string, unknown>;
  const skillLevels = source.skillLevels && typeof source.skillLevels === "object"
    ? Object.fromEntries(
        Object.entries(source.skillLevels as Record<string, unknown>).filter(
          (entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number"
        )
      )
    : {};

  const arrayOrEmpty = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const stringArrayOrEmpty = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  return {
    photoDataUrl: typeof source.photoDataUrl === "string" ? source.photoDataUrl : null,
    skillLevels,
    interests: stringArrayOrEmpty(source.interests),
    education: arrayOrEmpty(source.education),
    experience: arrayOrEmpty(source.experience),
    projects: arrayOrEmpty(source.projects),
    certifications: arrayOrEmpty(source.certifications),
    achievements: arrayOrEmpty(source.achievements),
    languages: arrayOrEmpty(source.languages),
  };
}

async function getBasicsRecord(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("basics")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isSchemaMissingError(error)) return null;
  if (error) throw new HttpError(500, error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

async function syncBasicsRecord(userId: string, profile: JobSeekerProfileResponse): Promise<void> {
  const supabase = getSupabaseAdmin();
  const existing = await getBasicsRecord(userId);
  const { firstName, lastName } = splitFullName(profile.fullName);
  const payload = {
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    headline: profile.headline,
    phone_number: profile.phone,
    location: profile.location,
    desired_role: profile.desiredRole,
    experience_years: profile.experienceYears,
    visibility: profile.visibility,
    about: profile.about,
  };

  if (existing?.id && typeof existing.id === "string") {
    const { error } = await supabase.from("basics").update(payload).eq("id", existing.id);
    if (error && isSchemaMissingError(error)) return;
    if (error) throw new HttpError(500, error.message);
    return;
  }

  const { error } = await supabase.from("basics").insert({ id: crypto.randomUUID(), ...payload });
  if (error && isSchemaMissingError(error)) return;
  if (error) throw new HttpError(500, error.message);
}

async function getSkillsRecord(userId: string): Promise<{ skills: string[]; skillLevels: Record<string, number> } | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("skills")
    .select("skills,skill_levels")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isSchemaMissingError(error)) return null;
  if (error) throw new HttpError(500, error.message);
  if (!data) return null;

  const skills = Array.isArray(data.skills) ? data.skills.filter((item): item is string => typeof item === "string") : [];
  const skillLevels =
    data.skill_levels && typeof data.skill_levels === "object"
      ? Object.fromEntries(
          Object.entries(data.skill_levels as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number"
          )
        )
      : {};

  return { skills, skillLevels };
}

async function syncSkillsRecord(userId: string, skills: string[], skillLevels: Record<string, number>): Promise<void> {
  const supabase = getSupabaseAdmin();
  const existing = await getSkillsRecord(userId);

  const payload = {
    user_id: userId,
    skills,
    skill_levels: skillLevels,
  };

  if (existing) {
    const { error } = await supabase
      .from("skills")
      .update(payload)
      .eq("user_id", userId);
    if (error && isSchemaMissingError(error)) return;
    if (error) throw new HttpError(500, error.message);
    return;
  }

  const { error } = await supabase.from("skills").insert({ id: crypto.randomUUID(), ...payload });
  if (error && isSchemaMissingError(error)) return;
  if (error) throw new HttpError(500, error.message);
}

async function getLanguagesRecord(userId: string): Promise<unknown[] | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("languages")
    .select("languages")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isSchemaMissingError(error)) return null;
  if (error) throw new HttpError(500, error.message);
  if (!data) return null;

  try {
    const raw = data.languages;
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function syncLanguagesRecord(userId: string, languages: unknown[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const existing = await getLanguagesRecord(userId);

  const payload = {
    user_id: userId,
    languages: JSON.stringify(languages),
  };

  if (existing !== null) {
    const { error } = await supabase
      .from("languages")
      .update(payload)
      .eq("user_id", userId);
    if (error && isSchemaMissingError(error)) return;
    if (error) throw new HttpError(500, error.message);
    return;
  }

  const { error } = await supabase.from("languages").insert({ id: crypto.randomUUID(), ...payload });
  if (error && isSchemaMissingError(error)) return;
  if (error) throw new HttpError(500, error.message);
}

async function getInterestsRecord(userId: string): Promise<string[] | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("interests")
    .select("interests")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isSchemaMissingError(error)) return null;
  if (error) throw new HttpError(500, error.message);
  if (!data) return null;

  return Array.isArray(data.interests) ? data.interests.filter((item): item is string => typeof item === "string") : [];
}

async function syncInterestsRecord(userId: string, interests: string[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const existing = await getInterestsRecord(userId);

  const payload = {
    user_id: userId,
    interests,
  };

  if (existing !== null) {
    const { error } = await supabase
      .from("interests")
      .update(payload)
      .eq("user_id", userId);
    if (error && isSchemaMissingError(error)) return;
    if (error) throw new HttpError(500, error.message);
    return;
  }

  const { error } = await supabase.from("interests").insert({ id: crypto.randomUUID(), ...payload });
  if (error && isSchemaMissingError(error)) return;
  if (error) throw new HttpError(500, error.message);
}

async function getExperienceRecords(userId: string): Promise<ExperienceItem[] | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("experience")
    .select("*")
    .eq("user_id", userId);

  if (error && isSchemaMissingError(error)) return null;
  if (error) throw new HttpError(500, error.message);
  if (!data) return null;

  return data.map((row: any) => ({
    id: row.id,
    company: row.company || "",
    title: row.title || "",
    location: null, // Not stored in DB - kept in user_settings
    startDate: row.start_date ? row.start_date : "",
    endDate: row.end_date || null,
    summary: row.description || "",
  }));
}

function mergeExperienceWithStored(dbItems: ExperienceItem[], storedItems: unknown[]): ExperienceItem[] {
  const storedById = new Map<string, { location: string | null }>();
  const stored = normalizeExperienceItems(storedItems);
  for (const item of stored) storedById.set(item.id, { location: item.location });

  return dbItems.map((item, index) => {
    const storedByItemId = storedById.get(item.id);
    const fallbackByIndex = stored[index];
    return {
      ...item,
      location: storedByItemId?.location ?? fallbackByIndex?.location ?? null,
    };
  });
}

async function syncExperienceRecords(userId: string, items: unknown[]): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Validate and transform items
  const validatedItems = normalizeExperienceItems(items);

  // Get existing IDs
  const { data: existing, error: selectError } = await supabase
    .from("experience")
    .select("id")
    .eq("user_id", userId);

  if (selectError && !isSchemaMissingError(selectError)) throw new HttpError(500, selectError.message);

  const existingIds = (existing || []).map((r: any) => r.id);
  const incomingIds = validatedItems.map((i) => i.id);

  // Delete records not in the incoming list
  const toDelete = existingIds.filter((id: string) => !incomingIds.includes(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("experience")
      .delete()
      .in("id", toDelete);

    if (deleteError && !isSchemaMissingError(deleteError)) throw new HttpError(500, deleteError.message);
  }

  // Upsert incoming items
  for (const item of validatedItems) {
    const payload = {
      id: item.id,
      user_id: userId,
      company: item.company,
      title: item.title,
      start_date: item.startDate && item.startDate.trim() ? item.startDate.slice(0, 10) : null,
      end_date: item.endDate && item.endDate.trim() ? item.endDate.slice(0, 10) : null,
      description: item.summary,
    };

    const { error: upsertError } = await supabase
      .from("experience")
      .upsert(payload, { onConflict: "id" });

    if (upsertError && !isSchemaMissingError(upsertError)) throw new HttpError(500, upsertError.message);
  }
}

async function getProjectsRecords(userId: string): Promise<ProjectItem[] | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .select("id,name,technologies,description,github_link")
    .eq("user_id", userId);

  if (error && isSchemaMissingError(error)) return null;
  if (error) throw new HttpError(500, error.message);
  if (!data) return null;

  return data.map((row: any) => ({
    id: row.id,
    name: typeof row.name === "string" ? row.name : "",
    link: typeof row.github_link === "string" && row.github_link.trim() ? row.github_link : null,
    summary: typeof row.description === "string" ? row.description : "",
    skills: typeof row.technologies === "string"
      ? row.technologies.split(",").map((x: string) => x.trim()).filter(Boolean)
      : [],
  }));
}

async function syncProjectsRecords(userId: string, items: unknown[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const validatedItems = normalizeProjectItems(items);

  const { data: existing, error: selectError } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId);

  if (selectError && !isSchemaMissingError(selectError)) throw new HttpError(500, selectError.message);

  const existingIds = (existing || []).map((r: any) => r.id);
  const incomingIds = validatedItems.map((i) => i.id);

  const toDelete = existingIds.filter((id: string) => !incomingIds.includes(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);

    if (deleteError && !isSchemaMissingError(deleteError)) throw new HttpError(500, deleteError.message);
  }

  for (const item of validatedItems) {
    const payload = {
      id: item.id,
      user_id: userId,
      name: item.name,
      technologies: item.skills.join(", "),
      description: item.summary,
      github_link: item.link,
    };

    const { error: upsertError } = await supabase
      .from("projects")
      .upsert(payload, { onConflict: "id" });

    if (upsertError && !isSchemaMissingError(upsertError)) throw new HttpError(500, upsertError.message);
  }
}

async function getEducationRecords(userId: string): Promise<EducationItem[] | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("education")
    .select("id,education_level,institution,degree,field_of_study,university,grade,start_year,end_year")
    .eq("user_id", userId);

  if (error && isSchemaMissingError(error)) return null;
  if (error) throw new HttpError(500, error.message);
  if (!data) return null;

  return data.map((row: any) => {
    const level = z.enum(["SCHOOL", "DIPLOMA", "BACHELOR", "MASTER", "PHD", "OTHER"]).safeParse(row.education_level);
    const parsedEndYear = row.end_year === null || row.end_year === undefined || row.end_year === "Present"
      ? null
      : Number(row.end_year);

    return {
      id: row.id,
      level: level.success ? level.data : "OTHER",
      institution: typeof row.institution === "string" ? row.institution : "",
      degree: typeof row.degree === "string" ? row.degree : "",
      fieldOfStudy: typeof row.field_of_study === "string" ? row.field_of_study : "",
      awardingBody: typeof row.university === "string" && row.university.trim() ? row.university : null,
      startYear: typeof row.start_year === "number" ? row.start_year : new Date().getFullYear(),
      endYear: Number.isFinite(parsedEndYear) ? parsedEndYear : null,
      grade: typeof row.grade === "string" && row.grade.trim() ? row.grade : null,
    };
  });
}

async function syncEducationRecords(userId: string, items: unknown[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const validatedItems = normalizeEducationItems(items);

  const { data: existing, error: selectError } = await supabase
    .from("education")
    .select("id")
    .eq("user_id", userId);

  if (selectError && !isSchemaMissingError(selectError)) throw new HttpError(500, selectError.message);

  const existingIds = (existing || []).map((r: any) => r.id);
  const incomingIds = validatedItems.map((i) => i.id);

  const toDelete = existingIds.filter((id: string) => !incomingIds.includes(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("education")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);

    if (deleteError && !isSchemaMissingError(deleteError)) throw new HttpError(500, deleteError.message);
  }

  for (const item of validatedItems) {
    const payload = {
      id: item.id,
      user_id: userId,
      education_level: item.level || "OTHER",
      institution: item.institution,
      degree: item.degree || null,
      field_of_study: item.fieldOfStudy || null,
      university: item.awardingBody || null,
      grade: item.grade,
      start_year: item.startYear,
      end_year: item.endYear === null ? "Present" : String(item.endYear),
    };

    const { error: upsertError } = await supabase
      .from("education")
      .upsert(payload, { onConflict: "id" });

    if (upsertError && !isSchemaMissingError(upsertError)) throw new HttpError(500, upsertError.message);
  }
}

async function getCertificationsRecords(userId: string): Promise<CertificationItem[] | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("certifications")
    .select("id,name,issuer,issued_on,expires_on,verification_method,credential_url,proof_file_url")
    .eq("user_id", userId);

  if (!error && data) {
    return data.map((row: any) => {
      const issued = typeof row.issued_on === "string" ? row.issued_on : new Date().toISOString().slice(0, 10);
      const expires = typeof row.expires_on === "string" && row.expires_on.trim() ? row.expires_on : null;
      const isUpload = row.verification_method === "UPLOAD";
      const credentialUrl = isUpload
        ? (typeof row.proof_file_url === "string" && row.proof_file_url.trim() ? `uploaded:${row.proof_file_url}` : null)
        : (typeof row.credential_url === "string" && row.credential_url.trim() ? row.credential_url : null);

      return {
        id: row.id,
        name: typeof row.name === "string" ? row.name : "",
        issuer: typeof row.issuer === "string" ? row.issuer : "",
        issuedOn: issued,
        expiresOn: expires,
        credentialUrl,
      };
    });
  }

  if (error && isSchemaMissingError(error)) return null;
  if (error && !isColumnMissingError(error)) throw new HttpError(500, error.message);

  const { data: legacyData, error: legacyError } = await supabase
    .from("certifications")
    .select("id,name,organization,issue_date,valid_until")
    .eq("user_id", userId);

  if (legacyError && isSchemaMissingError(legacyError)) return null;
  if (legacyError) throw new HttpError(500, legacyError.message);
  if (!legacyData) return null;

  return legacyData.map((row: any) => {
    const issued = typeof row.issue_date === "string" ? row.issue_date : new Date().toISOString().slice(0, 10);
    const expires = typeof row.valid_until === "string" && row.valid_until.trim() ? row.valid_until : null;

    return {
      id: row.id,
      name: typeof row.name === "string" ? row.name : "",
      issuer: typeof row.organization === "string" ? row.organization : "",
      issuedOn: issued,
      expiresOn: expires,
      credentialUrl: null,
    };
  });
}

async function syncCertificationsRecords(userId: string, items: unknown[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const validatedItems = normalizeCertificationItems(items);

  const { data: existing, error: selectError } = await supabase
    .from("certifications")
    .select("id")
    .eq("user_id", userId);

  if (selectError && !isSchemaMissingError(selectError)) throw new HttpError(500, selectError.message);

  const existingIds = (existing || []).map((r: any) => r.id);
  const incomingIds = validatedItems.map((i) => i.id);

  const toDelete = existingIds.filter((id: string) => !incomingIds.includes(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("certifications")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);

    if (deleteError && !isSchemaMissingError(deleteError)) throw new HttpError(500, deleteError.message);
  }

  for (const item of validatedItems) {
    const isUpload = Boolean(item.credentialUrl && item.credentialUrl.startsWith("uploaded:"));
    const proofFileUrl = isUpload ? item.credentialUrl!.replace("uploaded:", "") : null;
    const modernPayload = {
      id: item.id,
      user_id: userId,
      name: item.name,
      issuer: item.issuer,
      issued_on: item.issuedOn ? item.issuedOn.slice(0, 10) : new Date().toISOString().slice(0, 10),
      expires_on: item.expiresOn ? item.expiresOn.slice(0, 10) : null,
      verification_method: isUpload ? "UPLOAD" : "URL",
      credential_url: isUpload ? null : item.credentialUrl,
      proof_file_url: proofFileUrl,
    };

    const { error: modernUpsertError } = await supabase
      .from("certifications")
      .upsert(modernPayload, { onConflict: "id" });

    if (!modernUpsertError) continue;
    if (isSchemaMissingError(modernUpsertError)) continue;
    if (!isColumnMissingError(modernUpsertError)) throw new HttpError(500, modernUpsertError.message);

    const legacyPayload = {
      id: item.id,
      user_id: userId,
      name: item.name,
      organization: item.issuer,
      issue_date: item.issuedOn ? item.issuedOn.slice(0, 10) : new Date().toISOString().slice(0, 10),
      valid_until: item.expiresOn ? item.expiresOn.slice(0, 10) : null,
    };

    const { error: legacyUpsertError } = await supabase
      .from("certifications")
      .upsert(legacyPayload, { onConflict: "id" });

    if (legacyUpsertError && !isSchemaMissingError(legacyUpsertError)) {
      throw new HttpError(500, legacyUpsertError.message);
    }
  }
}

async function getAchievementsRecords(userId: string): Promise<AchievementItem[] | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("achievements")
    .select("id,title,date,description")
    .eq("user_id", userId);

  if (error && isSchemaMissingError(error)) return null;
  if (error) throw new HttpError(500, error.message);
  if (!data) return null;

  return data.map((row: any) => ({
    id: row.id,
    title: typeof row.title === "string" ? row.title : "",
    description: typeof row.description === "string" ? row.description : "",
    date: typeof row.date === "string" && row.date.trim() ? row.date : null,
  }));
}

async function syncAchievementsRecords(userId: string, items: unknown[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const validatedItems = normalizeAchievementItems(items);

  const { data: existing, error: selectError } = await supabase
    .from("achievements")
    .select("id")
    .eq("user_id", userId);

  if (selectError && !isSchemaMissingError(selectError)) throw new HttpError(500, selectError.message);

  const existingIds = (existing || []).map((r: any) => r.id);
  const incomingIds = validatedItems.map((i) => i.id);

  const toDelete = existingIds.filter((id: string) => !incomingIds.includes(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("achievements")
      .delete()
      .eq("user_id", userId)
      .in("id", toDelete);

    if (deleteError && !isSchemaMissingError(deleteError)) throw new HttpError(500, deleteError.message);
  }

  for (const item of validatedItems) {
    const payload = {
      id: item.id,
      user_id: userId,
      title: item.title,
      date: item.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: item.description || null,
    };

    const { error: upsertError } = await supabase
      .from("achievements")
      .upsert(payload, { onConflict: "id" });

    if (upsertError && !isSchemaMissingError(upsertError)) throw new HttpError(500, upsertError.message);
  }
}

async function getJobSeekerProfile(userId: string): Promise<JobSeekerProfileResponse> {
  const supabase = getSupabaseAdmin();
  const [{ data: profile, error: profileError }, { data: seekerProfile, error: seekerProfileError }, settings, basics, skillsRecord, languagesRecord, interestsRecord, experienceRecords, projectRecords, educationRecords, certificationRecords, achievementRecords] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,full_name,phone,location,headline,about")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("job_seeker_profiles")
      .select("user_id,experience_years,desired_role,skills,is_fresher,visibility,active_generated_resume_id")
      .eq("user_id", userId)
      .maybeSingle(),
    getUserSettingsRecord(userId),
    getBasicsRecord(userId),
    getSkillsRecord(userId),
    getLanguagesRecord(userId),
    getInterestsRecord(userId),
    getExperienceRecords(userId),
    getProjectsRecords(userId),
    getEducationRecords(userId),
    getCertificationsRecords(userId),
    getAchievementsRecords(userId),
  ]);

  if (profileError) throw new HttpError(500, profileError.message);
  if (seekerProfileError) throw new HttpError(500, seekerProfileError.message);
  if (!profile) throw new HttpError(404, "Profile not found");

  const stored = readStoredJobSeekerProfileExtras(settings);
  const fallbackName = profile.full_name || String(profile.email || "User").split("@")[0] || "User";
  const fullName = joinFullName(basics?.first_name, basics?.last_name, fallbackName);
  const visibility = basics?.visibility === "PRIVATE" || seekerProfile?.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";

  return {
    id: userId,
    userId,
    photoDataUrl: stored.photoDataUrl,
    fullName,
    phone: normalizeNullableText((basics?.phone_number as string | null | undefined) ?? profile.phone),
    location: normalizeNullableText((basics?.location as string | null | undefined) ?? profile.location),
    headline: normalizeNullableText((basics?.headline as string | null | undefined) ?? profile.headline),
    about: normalizeNullableText((basics?.about as string | null | undefined) ?? profile.about),
    experienceYears:
      typeof basics?.experience_years === "number"
        ? basics.experience_years
        : seekerProfile?.experience_years || 0,
    desiredRole: normalizeNullableText((basics?.desired_role as string | null | undefined) ?? seekerProfile?.desired_role),
    skills: skillsRecord?.skills || [],
    skillLevels: skillsRecord?.skillLevels || {},
    interests: interestsRecord || [],
    education: educationRecords || stored.education,
    experience: experienceRecords ? mergeExperienceWithStored(experienceRecords, stored.experience) : stored.experience,
    projects: projectRecords || stored.projects,
    certifications: certificationRecords || stored.certifications,
    achievements: achievementRecords || stored.achievements,
    languages: languagesRecord || [],
    isFresher: seekerProfile?.is_fresher ?? false,
    visibility,
    activeGeneratedResumeId: seekerProfile?.active_generated_resume_id || null,
  };
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

  const { error: seekerUpsertError } = await supabase
    .from("job_seeker_profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  if (seekerUpsertError) throw new HttpError(500, seekerUpsertError.message);
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

recruiterSupabaseRouter.get("/job-seeker/profile", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    await ensureJobSeeker(authed.auth.userId);

    const profile = await getJobSeekerProfile(authed.auth.userId);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.get("/job-seeker/resume", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const userId = authed.auth.userId;
    await ensureJobSeeker(userId);

    const { data, error } = await getSupabaseAdmin()
      .from("resumes")
      .select("id,original_name,mime_type,size_bytes,created_at")
      .eq("job_seeker_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new HttpError(500, error.message);

    res.json({
      resumes: (data || []).map((row: any) => ({
        id: row.id,
        originalName: row.original_name,
        mimeType: row.mime_type || "application/octet-stream",
        sizeBytes: typeof row.size_bytes === "number" ? row.size_bytes : 0,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.post("/job-seeker/resume/email", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const userId = authed.auth.userId;
    await ensureJobSeeker(userId);

    const body = resumeEmailSchema.parse(req.body || {});
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = Buffer.from(body.pdfBase64, "base64");
    } catch {
      throw new HttpError(400, "Invalid PDF payload");
    }

    if (!pdfBuffer.length) throw new HttpError(400, "Invalid PDF payload");
    if (pdfBuffer.length > 8 * 1024 * 1024) throw new HttpError(413, "PDF is too large to email");

    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from("profiles")
      .select("full_name,email")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw new HttpError(500, profileError.message);
    const senderName = (profile?.full_name || profile?.email || "Hireflow user").trim();

    await sendResumeShareEmail({
      to: body.to,
      senderName,
      resumeTitle: body.title,
      pdfBuffer,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.post("/job-seeker/resume", (req, res, next) => {
  resumeUpload.single("resume")(req as any, res as any, async (uploadErr: any) => {
    if (uploadErr) {
      if (uploadErr instanceof HttpError) return next(uploadErr);
      if (uploadErr?.code === "LIMIT_FILE_SIZE") return next(new HttpError(400, "Resume file must be 5MB or smaller"));
      return next(new HttpError(400, uploadErr?.message || "Failed to upload resume"));
    }

    try {
      const authed = req as unknown as AuthenticatedRequest;
      const userId = authed.auth.userId;
      await ensureJobSeeker(userId);

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) throw new HttpError(400, "Missing resume file");

      const rowId = crypto.randomUUID();
      const { error } = await getSupabaseAdmin()
        .from("resumes")
        .insert({
          id: rowId,
          job_seeker_id: userId,
          original_name: file.originalname,
          storage_path: file.filename,
          mime_type: file.mimetype || null,
          size_bytes: Number.isFinite(file.size) ? file.size : null,
        });

      if (error) throw new HttpError(500, error.message);

      res.status(201).json({
        resume: {
          id: rowId,
          originalName: file.originalname,
          mimeType: file.mimetype || "application/octet-stream",
          sizeBytes: Number.isFinite(file.size) ? file.size : 0,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  });
});

recruiterSupabaseRouter.get("/files/resume/:resumeId", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const userId = authed.auth.userId;
    const { resumeId } = z.object({ resumeId: z.string().uuid() }).parse(req.params);

    const { data, error } = await getSupabaseAdmin()
      .from("resumes")
      .select("id,job_seeker_id,original_name,storage_path,mime_type")
      .eq("id", resumeId)
      .eq("job_seeker_id", userId)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "Resume not found");

    const safeName = path.basename(String(data.storage_path || ""));
    const absPath = path.join(resumesUploadDir, safeName);
    const stat = await fsp.stat(absPath).catch(() => null);
    if (!stat || !stat.isFile()) throw new HttpError(404, "Resume file not found");

    res.setHeader("Content-Type", data.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename=\"${String(data.original_name || "resume") }\"`);
    res.sendFile(absPath);
  } catch (err) {
    next(err);
  }
});

recruiterSupabaseRouter.patch("/job-seeker/profile", async (req, res, next) => {
  try {
    const authed = req as unknown as AuthenticatedRequest;
    const userId = authed.auth.userId;
    const body = jobSeekerProfilePatchSchema.parse(req.body ?? {});

    await ensureJobSeeker(userId);

    const currentProfile = await getJobSeekerProfile(userId);
    const normalizedEducation = normalizeEducationItems((body.education ?? currentProfile.education) as unknown[]);
    const normalizedExperience = normalizeExperienceItems((body.experience ?? currentProfile.experience) as unknown[]);
    const normalizedProjects = normalizeProjectItems((body.projects ?? currentProfile.projects) as unknown[]);
    const normalizedCertifications = normalizeCertificationItems((body.certifications ?? currentProfile.certifications) as unknown[]);
    const normalizedAchievements = normalizeAchievementItems((body.achievements ?? currentProfile.achievements) as unknown[]);
    const nextProfile: JobSeekerProfileResponse = {
      ...currentProfile,
      ...body,
      fullName: body.fullName !== undefined ? body.fullName.trim() : currentProfile.fullName,
      phone: body.phone !== undefined ? normalizeNullableText(body.phone) : currentProfile.phone,
      location: body.location !== undefined ? normalizeNullableText(body.location) : currentProfile.location,
      headline: body.headline !== undefined ? normalizeNullableText(body.headline) : currentProfile.headline,
      about: body.about !== undefined ? normalizeNullableText(body.about) : currentProfile.about,
      experienceYears: body.experienceYears !== undefined ? body.experienceYears : currentProfile.experienceYears,
      desiredRole: body.desiredRole !== undefined ? normalizeNullableText(body.desiredRole) : currentProfile.desiredRole,
      photoDataUrl: body.photoDataUrl !== undefined ? normalizeNullableText(body.photoDataUrl) : currentProfile.photoDataUrl,
      skills: body.skills !== undefined ? body.skills : currentProfile.skills,
      skillLevels: body.skillLevels !== undefined ? body.skillLevels : currentProfile.skillLevels,
      interests: body.interests !== undefined ? body.interests : currentProfile.interests,
      education: normalizedEducation,
      experience: normalizedExperience,
      projects: normalizedProjects,
      certifications: normalizedCertifications,
      achievements: normalizedAchievements,
      languages: body.languages !== undefined ? body.languages : currentProfile.languages,
      isFresher: body.isFresher !== undefined ? body.isFresher : currentProfile.isFresher,
      visibility: body.visibility !== undefined ? body.visibility : currentProfile.visibility,
      activeGeneratedResumeId:
        body.activeGeneratedResumeId !== undefined ? body.activeGeneratedResumeId : currentProfile.activeGeneratedResumeId,
    };

    const supabase = getSupabaseAdmin();
    const profileUpdatePayload = {
      full_name: nextProfile.fullName,
      phone: nextProfile.phone,
      location: nextProfile.location,
      headline: nextProfile.headline,
      about: nextProfile.about,
    };
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update(profileUpdatePayload)
      .eq("id", userId);
    if (profileUpdateError) throw new HttpError(500, profileUpdateError.message);

    const seekerProfilePayload = {
      user_id: userId,
      experience_years: nextProfile.experienceYears,
      desired_role: nextProfile.desiredRole,
      skills: nextProfile.skills,
      is_fresher: nextProfile.isFresher,
      visibility: nextProfile.visibility,
      active_generated_resume_id: nextProfile.activeGeneratedResumeId,
    };
    const { error: seekerProfileError } = await supabase
      .from("job_seeker_profiles")
      .upsert(seekerProfilePayload, { onConflict: "user_id" });
    if (seekerProfileError) throw new HttpError(500, seekerProfileError.message);

    const currentSettings = await getUserSettingsRecord(userId);
    await upsertUserSettingsRecord(userId, {
      ...currentSettings,
      [PROFILE_BUILDER_SETTINGS_KEY]: {
        photoDataUrl: nextProfile.photoDataUrl,
        skillLevels: nextProfile.skillLevels,
        interests: nextProfile.interests,
        education: normalizedEducation,
        experience: normalizedExperience,
        projects: normalizedProjects,
        certifications: normalizedCertifications,
        achievements: normalizedAchievements,
        languages: nextProfile.languages,
      },
    });

    await syncBasicsRecord(userId, nextProfile);
    await syncSkillsRecord(userId, nextProfile.skills, nextProfile.skillLevels);
    await syncLanguagesRecord(userId, nextProfile.languages);
    await syncInterestsRecord(userId, nextProfile.interests);
    await syncEducationRecords(userId, normalizedEducation);
    await syncExperienceRecords(userId, normalizedExperience);
    await syncProjectsRecords(userId, normalizedProjects);
    await syncCertificationsRecords(userId, normalizedCertifications);
    await syncAchievementsRecords(userId, normalizedAchievements);

    const profile = await getJobSeekerProfile(userId);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

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
