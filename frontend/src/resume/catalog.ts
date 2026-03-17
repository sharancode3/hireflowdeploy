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
    id: "EDITORIAL_SIDEBAR",
    label: "Editorial Sidebar",
    description: "Bold left sidebar with profile details and a structured content column, inspired by modern retail and service resumes.",
    badge: "New",
  },
  {
    id: "FORMAL_CENTERED",
    label: "Formal Centered",
    description: "Single-column centered heading with tight rules and traditional spacing for highly formal applications.",
    badge: "New",
  },
  {
    id: "PASTEL_PROFILE",
    label: "Pastel Profile",
    description: "Creative layout with a soft accent panel, left decorative rail, and balanced two-column content blocks.",
    badge: "New",
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
  {
    id: "FRONTEND_ENGINEER",
    label: "Frontend Engineer",
    description: "Optimized for React/UI roles with stronger project and product-impact ordering.",
    badge: "Role-ready",
  },
  {
    id: "BACKEND_ENGINEER",
    label: "Backend Engineer",
    description: "Highlights systems, APIs, reliability, and platform ownership.",
    badge: "Role-ready",
  },
  {
    id: "FULL_STACK_ENGINEER",
    label: "Full-Stack Engineer",
    description: "Balanced layout for backend, frontend, and end-to-end project delivery.",
    badge: "Role-ready",
  },
  {
    id: "DEVOPS_ENGINEER",
    label: "DevOps Engineer",
    description: "Emphasizes infrastructure, CI/CD, automation, observability, and scale.",
    badge: "Role-ready",
  },
  {
    id: "DATA_SCIENTIST",
    label: "Data Scientist",
    description: "Prioritizes research, experiments, models, and analytical outcomes.",
    badge: "Role-ready",
  },
  {
    id: "DATA_ANALYST",
    label: "Data Analyst",
    description: "Focused on metrics, dashboards, insights, and decision support impact.",
    badge: "Role-ready",
  },
  {
    id: "PRODUCT_MANAGER",
    label: "Product Manager",
    description: "Structured for ownership, roadmap delivery, and cross-functional execution.",
    badge: "Role-ready",
  },
  {
    id: "UI_UX_DESIGNER",
    label: "UI/UX Designer",
    description: "Creative-first format to showcase portfolio depth and user-centered outcomes.",
    badge: "Role-ready",
  },
  {
    id: "QA_AUTOMATION_ENGINEER",
    label: "QA Automation Engineer",
    description: "Highlights test strategy, automation frameworks, quality gates, and reliability.",
    badge: "Role-ready",
  },
  {
    id: "MOBILE_DEVELOPER",
    label: "Mobile Developer",
    description: "Tailored for Android/iOS projects, app releases, and performance optimization.",
    badge: "Role-ready",
  },
  {
    id: "CYBERSECURITY_ANALYST",
    label: "Cybersecurity Analyst",
    description: "Security-focused ordering for controls, incident work, and risk reduction.",
    badge: "Role-ready",
  },
  {
    id: "MARKETING_SPECIALIST",
    label: "Marketing Specialist",
    description: "Emphasizes campaigns, growth experiments, funnel impact, and measurable outcomes.",
    badge: "Role-ready",
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
