import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import type {
  JobSeekerProfile,
  LanguageItem,
  Resume,
  SkillProficiency,
} from "../types";

const SKILL_SUGGESTIONS: Record<string, string[]> = {
  "Frontend Developer": ["React", "JavaScript", "HTML", "CSS", "TypeScript", "Redux"],
  "Backend Developer": ["Node.js", "Express", "PostgreSQL", "REST API", "Docker"],
  "Data Scientist": ["Python", "Pandas", "NumPy", "Machine Learning", "TensorFlow"],
};

export function getSkillSuggestions(role: string): string[] {
  const normalized = role?.trim();
  if (!normalized) return [];
  return SKILL_SUGGESTIONS[normalized] ?? [];
}

export function isProfileBuilderEnabled(): boolean {
  return isSupabaseConfigured;
}

function toDateString(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export async function fetchProfileFromSupabase(userId: string): Promise<JobSeekerProfile | null> {
  if (!isSupabaseConfigured || !userId) return null;

  const [{ data: basics, error: basicsError }, { data: experience, error: experienceError }] = await Promise.all([
    supabase.from("basics").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("experience").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
  ]);

  if (basicsError) throw basicsError;
  if (experienceError) throw experienceError;

  const [{ data: projects, error: projectsError }, { data: certifications, error: certificationsError }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("certifications").select("*").eq("user_id", userId).order("issue_date", { ascending: false }),
  ]);

  if (projectsError) throw projectsError;
  if (certificationsError) throw certificationsError;

  const [{ data: achievements, error: achievementsError }, { data: skillsRow, error: skillsError }] = await Promise.all([
    supabase.from("achievements").select("*").eq("user_id", userId).order("date", { ascending: false }),
    supabase.from("skills").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (achievementsError) throw achievementsError;
  if (skillsError) throw skillsError;

  const [{ data: languagesRow, error: languagesError }, { data: interestsRow, error: interestsError }, { error: resumesError }] = await Promise.all([
    supabase.from("languages").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("interests").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("resumes").select("*").eq("user_id", userId).order("uploaded_at", { ascending: false }),
  ]);

  if (languagesError) throw languagesError;
  if (interestsError) throw interestsError;
  if (resumesError) throw resumesError;

  const profile: JobSeekerProfile = {
    id: `supabase_${userId}`,
    userId,
    fullName: `${basics?.first_name ?? ""} ${basics?.last_name ?? ""}`.trim() || "",
    photoDataUrl: null,
    phone: basics?.phone_number ?? null,
    location: basics?.location ?? null,
    headline: basics?.headline ?? null,
    about: basics?.about ?? null,
    experienceYears: basics?.experience_years ?? 0,
    desiredRole: basics?.desired_role ?? null,
    visibility: (basics?.visibility as "PUBLIC" | "PRIVATE") ?? "PUBLIC",
    skills: skillsRow?.skills ?? [],
    skillLevels: (skillsRow?.skill_levels as Record<string, SkillProficiency>) ?? {},
    education: [],
    experience:
      experience?.map((row) => ({
        id: row.id,
        company: row.company ?? "",
        title: row.title ?? "",
        location: row.location ?? null,
        startDate: toDateString(row.start_date) ?? "",
        endDate: toDateString(row.end_date),
        summary: row.description ?? "",
      })) ?? [],
    projects:
      projects?.map((row) => ({
        id: row.id,
        name: row.name ?? "",
        link: row.github_link ?? row.linkedin_link ?? null,
        summary: row.description ?? "",
        skills: row.technologies ?? [],
      })) ?? [],
    certifications:
      certifications?.map((row) => ({
        id: row.id,
        name: row.name ?? "",
        issuer: row.organization ?? "",
        issuedOn: toDateString(row.issue_date) ?? "",
        expiresOn: toDateString(row.valid_until),
        credentialUrl: null,
      })) ?? [],
    achievements:
      achievements?.map((row) => ({
        id: row.id,
        title: row.title ?? "",
        description: row.description ?? "",
        date: toDateString(row.date),
      })) ?? [],
    languages: (languagesRow?.languages as LanguageItem[]) ?? [],
    interests: interestsRow?.interests ?? [],
    isFresher: false,
    activeGeneratedResumeId: null,
  };

  return profile;
}

export async function syncProfileToSupabase(userId: string, profile: JobSeekerProfile): Promise<void> {
  if (!isSupabaseConfigured || !userId) return;

  const countSkills = profile.skills.length;
  const countLanguages = profile.languages?.length ?? 0;
  if (countSkills < 5 || countSkills > 20) {
    console.warn(`Profile has ${countSkills} skills (recommend 5-20); still syncing to Supabase`);
  }
  if (countLanguages < 3) {
    console.warn(`Profile has ${countLanguages} languages (recommend >=3); still syncing to Supabase`);
  }

  await supabase.from("basics").upsert({
    user_id: userId,
    first_name: profile.fullName.split(" ")[0] ?? "",
    last_name: profile.fullName.split(" ").slice(1).join(" ") ?? "",
    headline: profile.headline ?? null,
    phone_number: profile.phone,
    location: profile.location,
    desired_role: profile.desiredRole,
    experience_years: profile.experienceYears,
    visibility: profile.visibility,
    about: profile.about ?? null,
  }, { onConflict: "user_id" });

  await supabase.from("experience").delete().eq("user_id", userId);
  const experienceItems = profile.experience ?? [];
  if (experienceItems.length) {
    await supabase.from("experience").insert(
      experienceItems.map((item) => ({
        id: item.id,
        user_id: userId,
        company: item.company,
        title: item.title,
        location: item.location,
        start_date: item.startDate || null,
        end_date: item.endDate || null,
        description: item.summary,
      })),
    );
  }

  await supabase.from("projects").delete().eq("user_id", userId);
  const projectItems = profile.projects ?? [];
  if (projectItems.length) {
    await supabase.from("projects").insert(
      projectItems.map((item) => ({
        id: item.id,
        user_id: userId,
        name: item.name,
        technologies: item.skills,
        description: item.summary,
        github_link: item.link,
        linkedin_link: item.link,
      })),
    );
  }

  await supabase.from("certifications").delete().eq("user_id", userId);
  const certificationItems = profile.certifications ?? [];
  if (certificationItems.length) {
    await supabase.from("certifications").insert(
      certificationItems.map((item) => ({
        id: item.id,
        user_id: userId,
        name: item.name,
        organization: item.issuer,
        issue_date: item.issuedOn || null,
        valid_until: item.expiresOn || null,
      })),
    );
  }

  await supabase.from("achievements").delete().eq("user_id", userId);
  const achievementItems = profile.achievements ?? [];
  if (achievementItems.length) {
    await supabase.from("achievements").insert(
      achievementItems.map((item) => ({
        id: item.id,
        user_id: userId,
        title: item.title,
        description: item.description,
        date: item.date || null,
      })),
    );
  }

  await supabase.from("skills").upsert(
    {
      user_id: userId,
      skills: profile.skills ?? [],
      skill_levels: profile.skillLevels ?? {},
    },
    { onConflict: "user_id" }
  );

  await supabase.from("languages").upsert(
    {
      user_id: userId,
      languages: (profile.languages ?? []).map((x) => ({ id: x.id, name: x.name, proficiency: x.proficiency })),
    },
    { onConflict: "user_id" }
  );

  await supabase.from("interests").upsert(
    {
      user_id: userId,
      interests: profile.interests ?? [],
    },
    { onConflict: "user_id" }
  );

  if (profile?.id) {
    await supabase.from("resumes").delete().eq("user_id", userId); // keep in sync; overwrite via dedicated resume API
  }
}

export async function addResumeUrl(userId: string, resumeUrl: string): Promise<void> {
  if (!isSupabaseConfigured || !userId || !resumeUrl) return;
  await supabase.from("resumes").insert({ user_id: userId, resume_url: resumeUrl });
}

export async function listResumes(userId: string): Promise<Resume[]> {
  if (!isSupabaseConfigured || !userId) return [];
  const { data, error } = await supabase.from("resumes").select("*").eq("user_id", userId).order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Resume[];
}
