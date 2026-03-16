import type { Job, JobSeekerProfile } from "../types";

/* ─── Score breakdown ─── */
export type MatchBreakdown = {
  score: number;
  rolePts: number;
  skillPts: number;
  locationPts: number;
  experiencePts: number;
  industryPts: number;
  matchedSkills: string[];
  missingSkills: string[];
};

const INDUSTRY_MAP: Record<string, string[]> = {
  Software: ["Software Engineer", "Frontend Developer", "Backend Developer"],
  Data: ["Data Analyst", "Data Scientist"],
  Design: ["UI/UX Designer"],
  Marketing: ["Marketing Associate"],
  HR: ["HR Associate"],
  Operations: ["Operations Executive"],
  Finance: ["Product Analyst"],
};

function fuzzyMatch(a: string, b: string): boolean {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  return la.includes(lb) || lb.includes(la) || la.split(" ").some((w) => lb.includes(w));
}

export function calculateMatchScore(profile: JobSeekerProfile, job: Job): MatchBreakdown {
  let rolePts = 0;
  let skillPts = 0;
  let locationPts = 0;
  let experiencePts = 0;
  let industryPts = 0;

  // +15 role match (fuzzy)
  if (profile.desiredRole && fuzzyMatch(profile.desiredRole, job.title)) {
    rolePts = 15;
  }

  // +10 per matching skill (cap 50)
  const profileSkills = new Set((profile.skills ?? []).map((s) => s.toLowerCase()));
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const skill of job.requiredSkills) {
    if (profileSkills.has(skill.toLowerCase())) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }
  skillPts = Math.min(matchedSkills.length * 10, 50);

  // +10 location
  const pLoc = (profile.location ?? "").toLowerCase();
  const jLoc = job.location.toLowerCase();
  if (jLoc === "remote" || (pLoc && (pLoc === jLoc || jLoc.includes(pLoc) || pLoc.includes(jLoc)))) {
    locationPts = 10;
  }

  // +10 experience
  if (profile.experienceYears >= job.minExperienceYears) {
    experiencePts = 10;
  }

  // +5 industry
  const jobIndustries = Object.entries(INDUSTRY_MAP).filter(([, roles]) =>
    roles.some((r) => fuzzyMatch(r, job.title))
  ).map(([ind]) => ind);
  const profileIndustries = Object.entries(INDUSTRY_MAP).filter(([, roles]) =>
    roles.some((r) => fuzzyMatch(r, profile.desiredRole ?? ""))
  ).map(([ind]) => ind);
  if (jobIndustries.some((i) => profileIndustries.includes(i))) {
    industryPts = 5;
  }

  const score = Math.min(rolePts + skillPts + locationPts + experiencePts + industryPts, 100);

  return { score, rolePts, skillPts, locationPts, experiencePts, industryPts, matchedSkills, missingSkills };
}

export function matchColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function matchLabel(score: number): string {
  if (score >= 80) return "Strong Match";
  if (score >= 50) return "Moderate";
  return "Low Match";
}
