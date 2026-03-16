import type { ResumeSettings, ResumeTemplate, ResumeSectionKey } from "../types";

export type ResumeTemplateMeta = {
  id: ResumeTemplate;
  label: string;
  description: string;
  badge?: string;
};

export const SECTION_LABELS: Record<ResumeSectionKey, string> = {
  SUMMARY: "Summary / Objective",
  SKILLS: "Skills",
  EXPERIENCE: "Experience",
  PROJECTS: "Projects",
  EDUCATION: "Education",
  CERTIFICATIONS: "Certifications",
  ACHIEVEMENTS: "Achievements / Awards",
  LANGUAGES: "Languages",
  VOLUNTEER: "Volunteer Work",
  PUBLICATIONS: "Publications",
  CUSTOM: "Custom Section",
};

export const templateCatalog: ResumeTemplateMeta[] = [
  {
    id: "ATS_PLAIN",
    label: "ATS Classic",
    description: "Single column, no colors, max ATS compatibility. Clean section headers with horizontal rules.",
    badge: "ATS Safe",
  },
  {
    id: "CLASSIC",
    label: "Modern Split",
    description: "Two‑column (30/70) with a left sidebar for skills, contact & education. Subtle accent border.",
    badge: "Popular",
  },
  {
    id: "MINIMAL",
    label: "Creative Card",
    description: "Header with color band, card‑style sections and icons. Great for designer & creative roles.",
    badge: "Creative",
  },
  {
    id: "MODERN",
    label: "Minimal Prose",
    description: "Ultra‑clean, generous whitespace, no borders. Typography‑first for senior / executive roles.",
    badge: "Elegant",
  },
  {
    id: "TECH_FOCUSED",
    label: "Tech‑Focused",
    description: "Emphasizes skills, projects and engineering impact.",
  },
  {
    id: "EXECUTIVE",
    label: "Executive",
    description: "Leadership‑forward with impact summaries and achievements.",
  },
  {
    id: "STARTUP",
    label: "Startup / Product",
    description: "Project‑heavy layout that spotlights ownership and speed.",
  },
  {
    id: "ACADEMIC",
    label: "Academic",
    description: "Education‑first, tailored to research and academic profiles.",
  },
];

export function defaultResumeSettings(): ResumeSettings {
  return {
    sectionOrder: [
      "SUMMARY",
      "SKILLS",
      "EXPERIENCE",
      "PROJECTS",
      "EDUCATION",
      "CERTIFICATIONS",
      "ACHIEVEMENTS",
      "LANGUAGES",
    ],
    hiddenSections: {},
    density: "NORMAL",
    accent: "ACCENT",
    showSkillBars: true,
    showCharts: true,
    showTimeline: true,
    fontFamily: "Inter",
    fontSize: 11,
    lineSpacing: "1.15",
    pageMargin: "NORMAL",
    accentColor: "#1A73E8",
    dateFormat: "MONTH_YYYY",
    showPhoto: false,
    groupSkillsByCategory: false,
  };
}
