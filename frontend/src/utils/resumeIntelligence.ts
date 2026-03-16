import type { JobSeekerProfile, ResumeSectionKey } from "../types";

type SectionKey = ResumeSectionKey;

export type BehaviorSignals = {
  jobClicks: number;
  searchKeywords: number;
  skillsClicked: number;
  jobsApplied: number;
  jobsBookmarked: number;
  projectsUploaded: number;
  coursesViewed: number;
};

export type IntentSignals = {
  skillMatch: number;
  jobClicks: number;
  searchKeywords: number;
  profileCompleteness: number;
};

export type UserIntentScore = {
  score: number;
  signals: IntentSignals;
};

export type ResumePersonalization = {
  experience_level: "fresher" | "mid" | "senior";
  target_role: string;
  resume_style: "impact-driven" | "results-driven" | "leadership" | "technical" | "academic";
  keyword_density: "low" | "medium" | "high";
  bullet_verbosity: "concise" | "balanced" | "detailed";
  leadership_focus: "low" | "medium" | "high";
};

export type ResumeScore = {
  ats_score: number;
  keyword_match_percent: number;
  missing_keywords: string[];
  format_issues: string[];
  readability_score: number;
  jd_keywords: string[];
};

export type BulletSuggestion = {
  original: string;
  suggested: string;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "by",
  "from",
  "as",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "it",
  "this",
  "that",
  "these",
  "those",
  "you",
  "your",
  "we",
  "our",
  "they",
  "their",
  "will",
  "can",
  "may",
  "should",
  "must",
  "using",
  "use",
  "used",
  "build",
  "built",
  "building",
  "work",
  "worked",
  "working",
  "experience",
  "role",
  "responsible",
  "responsibilities",
  "skills",
  "job",
  "team",
]);

const ACTION_VERBS: Record<"developer" | "manager" | "analyst", string[]> = {
  developer: ["Built", "Optimized", "Automated", "Implemented", "Refactored", "Shipped"],
  manager: ["Led", "Strategized", "Scaled", "Directed", "Mentored", "Aligned"],
  analyst: ["Analyzed", "Modeled", "Forecasted", "Evaluated", "Validated", "Synthesized"],
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  if (!text) return [] as string[];
  return normalizeText(text)
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t));
}

function termFrequency(tokens: string[]) {
  const map = new Map<string, number>();
  for (const token of tokens) {
    map.set(token, (map.get(token) ?? 0) + 1);
  }
  return map;
}

function splitBullets(text: string) {
  if (!text) return [] as string[];
  const parts = text
    .split(/\n|•|●|·/)
    .map((t) => t.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [text.trim()];
}

export function extractKeywords(text: string, limit = 24) {
  const tokens = tokenize(text);
  const freq = termFrequency(tokens);
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, limit).map(([token]) => token);
}

export function deriveBehaviorSignals(profile: JobSeekerProfile, overrides?: Partial<BehaviorSignals>): BehaviorSignals {
  const projectsUploaded = profile.projects?.length ?? 0;
  const base = {
    jobClicks: Math.min(40, (profile.experience?.length ?? 0) * 4 + projectsUploaded * 3),
    searchKeywords: Math.min(30, profile.skills.length + (profile.interests?.length ?? 0)),
    skillsClicked: Math.min(20, profile.skills.length),
    jobsApplied: Math.min(15, profile.experience?.length ?? 0),
    jobsBookmarked: Math.min(20, (profile.projects?.length ?? 0) + (profile.certifications?.length ?? 0)),
    projectsUploaded,
    coursesViewed: Math.min(12, profile.certifications?.length ?? 0),
  };
  return {
    ...base,
    ...overrides,
  };
}

export function computeProfileCompleteness(profile: JobSeekerProfile) {
  const checks: Array<[boolean, number]> = [
    [Boolean(profile.fullName), 0.1],
    [Boolean(profile.desiredRole), 0.1],
    [Boolean(profile.about), 0.15],
    [(profile.skills?.length ?? 0) >= 5, 0.2],
    [(profile.experience?.length ?? 0) > 0 || (profile.projects?.length ?? 0) > 0, 0.2],
    [(profile.education?.length ?? 0) > 0, 0.15],
    [(profile.certifications?.length ?? 0) > 0 || (profile.achievements?.length ?? 0) > 0, 0.1],
  ];
  return clamp01(checks.reduce((acc, [ok, weight]) => acc + (ok ? weight : 0), 0));
}

export function computeUserIntentScore(
  profile: JobSeekerProfile,
  jobDescription: string,
  behavior: BehaviorSignals
): UserIntentScore {
  const jdKeywords = extractKeywords(jobDescription || "");
  const skillTokens = new Set(profile.skills.map((s) => normalizeText(s)));
  const matchCount = jdKeywords.filter((k) => skillTokens.has(k)).length;
  const skillMatch = jdKeywords.length ? clamp01(matchCount / jdKeywords.length) : 0;

  const profileCompleteness = computeProfileCompleteness(profile);
  const jobClicks = clamp01(behavior.jobClicks / 40);
  const searchKeywords = clamp01(behavior.searchKeywords / 30);

  const score =
    skillMatch * 0.4 +
    jobClicks * 0.3 +
    searchKeywords * 0.2 +
    profileCompleteness * 0.1;

  return {
    score: Math.round(score * 100),
    signals: {
      skillMatch,
      jobClicks,
      searchKeywords,
      profileCompleteness,
    },
  };
}

export function personalizeResume(
  profile: JobSeekerProfile,
  targetRole: string,
  jobDescription: string,
  intentScore: number
): ResumePersonalization {
  const experienceLevel = profile.isFresher || profile.experienceYears < 1 ? "fresher" : profile.experienceYears >= 6 ? "senior" : "mid";
  const role = targetRole || profile.desiredRole || "";
  const jdTokens = tokenize(jobDescription);
  const leadershipHints = ["lead", "manage", "strategy", "stakeholder", "roadmap", "team", "scale"];
  const academicHints = ["research", "thesis", "publication", "paper", "lab", "advisor"];
  const isLeadership = jdTokens.some((t) => leadershipHints.includes(t));
  const isAcademic = jdTokens.some((t) => academicHints.includes(t));

  let resumeStyle: ResumePersonalization["resume_style"] = "impact-driven";
  if (isAcademic) resumeStyle = "academic";
  else if (isLeadership || experienceLevel === "senior") resumeStyle = "leadership";
  else if (role.toLowerCase().includes("data") || role.toLowerCase().includes("analyst")) resumeStyle = "results-driven";
  else resumeStyle = "technical";

  const keywordDensity = intentScore < 55 ? "high" : intentScore < 80 ? "medium" : "low";
  const bulletVerbosity = experienceLevel === "fresher" ? "concise" : experienceLevel === "mid" ? "balanced" : "detailed";
  const leadershipFocus = experienceLevel === "senior" || isLeadership ? "high" : experienceLevel === "mid" ? "medium" : "low";

  return {
    experience_level: experienceLevel,
    target_role: role,
    resume_style: resumeStyle,
    keyword_density: keywordDensity,
    bullet_verbosity: bulletVerbosity,
    leadership_focus: leadershipFocus,
  };
}

export function scoreResume(profile: JobSeekerProfile, jobDescription: string): ResumeScore {
  const resumeText = buildResumeText(profile);
  const jdKeywords = extractKeywords(jobDescription || "", 28);
  const resumeTokens = new Set(tokenize(resumeText));

  const matched = jdKeywords.filter((k) => resumeTokens.has(k));
  const missing = jdKeywords.filter((k) => !resumeTokens.has(k));
  const matchPercent = jdKeywords.length ? Math.round((matched.length / jdKeywords.length) * 100) : 0;

  const formatIssues: string[] = [];
  if (!profile.about) formatIssues.push("Missing professional summary");
  if ((profile.skills?.length ?? 0) < 6) formatIssues.push("Too few skills listed");
  if ((profile.experience?.length ?? 0) === 0 && (profile.projects?.length ?? 0) === 0) {
    formatIssues.push("Experience or projects section is empty");
  }
  const bulletCount = (profile.experience ?? []).reduce((acc, it) => acc + splitBullets(it.summary || "").length, 0);
  if (bulletCount > 18) formatIssues.push("Too many bullet points");

  const readabilityScore = Math.max(40, Math.min(100, 90 - Math.floor(averageSentenceLength(resumeText) * 2)));

  const atsScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        50 +
          matchPercent * 0.4 +
          computeProfileCompleteness(profile) * 30 -
          formatIssues.length * 6
      )
    )
  );

  return {
    ats_score: atsScore,
    keyword_match_percent: matchPercent,
    missing_keywords: missing.slice(0, 18),
    format_issues: formatIssues,
    readability_score: readabilityScore,
    jd_keywords: jdKeywords,
  };
}

export function suggestBulletOptimizations(profile: JobSeekerProfile, targetRole: string): BulletSuggestion[] {
  const role = targetRole.toLowerCase();
  const verbBank = role.includes("manager")
    ? ACTION_VERBS.manager
    : role.includes("analyst") || role.includes("data")
      ? ACTION_VERBS.analyst
      : ACTION_VERBS.developer;

  const suggestions: BulletSuggestion[] = [];
  (profile.experience ?? []).forEach((exp) => {
    const original = exp.summary?.trim();
    if (!original) return;
    const hasNumber = /\d/.test(original);
    const hasVerb = verbBank.some((verb) => original.toLowerCase().startsWith(verb.toLowerCase()));

    if (!hasNumber || !hasVerb) {
      const verb = verbBank[(exp.company.length + exp.title.length) % verbBank.length];
      const suggestion = `${verb} ${original.replace(/^\w+\s+/i, "").trim()} (add measurable impact).`;
      suggestions.push({ original, suggested: suggestion });
    }
  });

  return suggestions.slice(0, 6);
}

function buildResumeText(profile: JobSeekerProfile) {
  const parts: string[] = [];
  if (profile.about) parts.push(profile.about);
  parts.push(profile.skills.join(" "));
  (profile.experience ?? []).forEach((it) => {
    parts.push([it.title, it.company, it.summary].filter(Boolean).join(" "));
  });
  (profile.projects ?? []).forEach((it) => {
    parts.push([it.name, it.summary, (it.skills ?? []).join(" ")].filter(Boolean).join(" "));
  });
  (profile.education ?? []).forEach((it) => {
    parts.push([it.degree, it.fieldOfStudy, it.institution].filter(Boolean).join(" "));
  });
  (profile.certifications ?? []).forEach((it) => {
    parts.push([it.name, it.issuer].filter(Boolean).join(" "));
  });
  return parts.join(" ");
}

function averageSentenceLength(text: string) {
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (!sentences.length) return 0;
  const totalWords = sentences.reduce((acc, s) => acc + s.split(/\s+/).filter(Boolean).length, 0);
  return totalWords / sentences.length;
}

export function buildSectionOrder(variant: string, settingsOrder: SectionKey[]) {
  const orderMap: Record<string, SectionKey[]> = {
    ATS_PLAIN: ["SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS", "ACHIEVEMENTS", "LANGUAGES"],
    TECH_FOCUSED: ["SUMMARY", "SKILLS", "PROJECTS", "EXPERIENCE", "EDUCATION", "CERTIFICATIONS", "ACHIEVEMENTS", "LANGUAGES"],
    EXECUTIVE: ["SUMMARY", "EXPERIENCE", "ACHIEVEMENTS", "SKILLS", "EDUCATION", "CERTIFICATIONS", "LANGUAGES", "PROJECTS"],
    STARTUP: ["SUMMARY", "PROJECTS", "EXPERIENCE", "SKILLS", "EDUCATION", "CERTIFICATIONS", "ACHIEVEMENTS", "LANGUAGES"],
    ACADEMIC: ["EDUCATION", "SUMMARY", "EXPERIENCE", "PROJECTS", "SKILLS", "CERTIFICATIONS", "ACHIEVEMENTS", "LANGUAGES"],
  };
  const base = orderMap[variant] ?? settingsOrder;
  const available = new Set(settingsOrder);
  const ordered = base.filter((k) => available.has(k));
  settingsOrder.forEach((k) => {
    if (!ordered.includes(k)) ordered.push(k);
  });
  return ordered;
}
