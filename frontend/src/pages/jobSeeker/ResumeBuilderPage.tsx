import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { ResumePreview } from "../../resume/ResumePreview";
import { templateCatalog, defaultResumeSettings, SECTION_LABELS } from "../../resume/catalog";
import { ApiError, apiJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import type {
  GeneratedResume,
  JobSeekerProfile,
  ResumeSettings,
  ResumeTemplate,
  ResumeSectionKey,
  ResumeFont,
  ResumePageMargin,
  ResumeDateFormat,
  ResumeDensity,
  ResumeSnapshot,
} from "../../types";

/* ─── helpers ──────────────────────────────────────────── */
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function snapshotFromProfile(p: JobSeekerProfile): ResumeSnapshot {
  return {
    fullName: p.fullName,
    phone: p.phone,
    location: p.location,
    headline: p.headline,
    about: p.about,
    experienceYears: p.experienceYears,
    desiredRole: p.desiredRole,
    skills: p.skills,
    skillLevels: p.skillLevels,
    interests: p.interests,
    education: p.education,
    experience: p.experience,
    projects: p.projects,
    certifications: p.certifications,
    achievements: p.achievements,
    languages: p.languages,
    isFresher: p.isFresher,
    visibility: p.visibility,
    photoDataUrl: p.photoDataUrl,
  };
}

function computeAtsScore(p: JobSeekerProfile, settings: ResumeSettings): { score: number; breakdown: { label: string; pts: number; max: number }[] } {
  const b: { label: string; pts: number; max: number }[] = [];
  const has = (v: unknown) => typeof v === "string" && v.trim().length > 0;

  // Contact info
  let contact = 0;
  if (has(p.phone)) contact += 5;
  if (has(p.location)) contact += 5;
  if (has(p.fullName)) contact += 5;
  b.push({ label: "Contact info", pts: contact, max: 15 });

  // Standard sections visible
  const visible = settings.sectionOrder.filter(k => !settings.hiddenSections?.[k]);
  let sectionPts = 0;
  if (visible.includes("EXPERIENCE")) sectionPts += 10;
  if (visible.includes("EDUCATION")) sectionPts += 10;
  if (visible.includes("SKILLS")) sectionPts += 10;
  if (visible.includes("SUMMARY")) sectionPts += 5;
  b.push({ label: "Standard sections", pts: sectionPts, max: 35 });

  // Experience detail
  const expLen = (p.experience ?? []).filter(e => (e.summary?.split(/\s+/).length ?? 0) >= 10).length;
  const expTotal = (p.experience ?? []).length || 1;
  const expPts = Math.min(20, Math.round((expLen / expTotal) * 20));
  b.push({ label: "Experience detail", pts: expPts, max: 20 });

  // Skills count
  const skillPts = Math.min(15, Math.round(((p.skills?.length ?? 0) / 8) * 15));
  b.push({ label: "Skills breadth", pts: skillPts, max: 15 });

  // Education
  const eduPts = (p.education?.length ?? 0) > 0 ? 10 : 0;
  b.push({ label: "Education", pts: eduPts, max: 10 });

  // Summary length
  const summaryWords = (p.about?.split(/\s+/).length ?? 0);
  const sumPts = summaryWords >= 20 ? 5 : summaryWords >= 10 ? 3 : 0;
  b.push({ label: "Summary quality", pts: sumPts, max: 5 });

  const score = b.reduce((s, x) => s + x.pts, 0);
  return { score, breakdown: b };
}

/* ─── icons (inline SVG) ───────────────────────────────── */
function IconPlus() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
function _IconStar({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
      <path d="M10 2l2.4 5.2L18 8l-4 3.8 1 5.7L10 14.5 4.8 17.5l1-5.7L2 8l5.6-.8z" />
    </svg>
  );
}
void _IconStar;
function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M3 11V3a1.5 1.5 0 0 1 1.5-1.5H11" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5h10M5 4.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5M6.5 7v4M9.5 7v4" /><path d="M4 4.5l.7 8.4a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4.5" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M3 13h10" />
    </svg>
  );
}
function IconGrip() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.4">
      <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" /><circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}
function IconEye({ off }: { off?: boolean }) {
  if (off) return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 2l12 12M6.3 6.3a2.2 2.2 0 0 0 3.4 3.4M4.2 4.2C2.9 5.3 2 6.6 2 8c1.2 3 3.4 5 6 5 1.2 0 2.3-.4 3.3-1M14 8c-.5-1.2-1.3-2.3-2.3-3.2" />
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 8c1.2-3 3.4-5 6-5s4.8 2 6 5c-1.2 3-3.4 5-6 5S3.2 11 2 8z" /><circle cx="8" cy="8" r="2" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3.5 8.5l3 3 6-6" />
    </svg>
  );
}

function IntroLogoMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3.5h11l7 7V34.5H10V3.5Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M21 3.5v8h7" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
    </svg>
  );
}

function IntroTemplateIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="10" width="26" height="36" rx="2.5" fill="#fff" stroke="#2D2A26" strokeWidth="2.4" />
      <path d="M28 20h10M28 26h12M28 32h8" stroke="#2D2A26" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17 52c7-6 15-10 25-10" stroke="#F3C23C" strokeWidth="4" strokeLinecap="round" />
      <path d="M41 39c3 4 4 9 4 15" stroke="#F3C23C" strokeWidth="4" strokeLinecap="round" />
      <path d="M15 47c3 0 6 2 7 6-4 3-8 2-10-1-1-2 0-5 3-5Z" fill="#F6C56D" stroke="#2D2A26" strokeWidth="2" />
    </svg>
  );
}

function IntroAiIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="19" width="28" height="34" rx="4" transform="rotate(10 14 19)" fill="#DDE3FF" />
      <path d="M26 46 47 22" stroke="#2D2A26" strokeWidth="3" strokeLinecap="round" />
      <path d="M43 19l8 8" stroke="#2D2A26" strokeWidth="3" strokeLinecap="round" />
      <path d="M21 50c5 0 8 1 11 4M18 43c4 0 6 1 9 3" stroke="#2D2A26" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M39 24l9-9 5 5-9 9" fill="#fff" stroke="#2D2A26" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M47 15l5-5 5 5-5 5" fill="#fff" stroke="#2D2A26" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

function IntroDownloadIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 53h37l-4 9H12l4-9Z" fill="#7AE48E" />
      <path d="M19 18h24l9 9v30H19V18Z" fill="#fff" stroke="#2D2A26" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M43 18v9h9" stroke="#2D2A26" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M27 31h17M27 37h17M27 43h11" stroke="#2D2A26" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="54" cy="26" r="10" fill="#8BE394" />
      <path d="M54 20v10M50 26l4 4 4-4" stroke="#1F4D27" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResumeBuilderIntroCard({
  icon,
  title,
  items,
  complete,
}: {
  icon: ReactNode;
  title: string;
  items?: string[];
  complete?: boolean;
}) {
  return (
    <div className="min-h-[250px] rounded-[22px] border border-black/10 bg-white px-6 py-4 shadow-[0_12px_34px_rgba(27,31,35,0.1)]">
      <div className="mb-6 h-1.5 rounded-full bg-[#D6D6D6] overflow-hidden">
        <div className={`h-full rounded-full ${complete ? "w-full bg-[#95E29C]" : "w-[12%] bg-[#95E29C]"}`} />
      </div>
      <div className="mb-5 text-[#2D2A26]">{icon}</div>
      <h3 className="max-w-[220px] text-[22px] font-black leading-[1.05] tracking-[-0.03em] text-black">{title}</h3>
      {items && items.length > 0 ? (
        <ul className="mt-5 space-y-3 text-[15px] font-medium leading-7 text-[#232323]">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center text-black">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.1">
                  <path d="M3.2 8.3 6.4 11.4 12.8 5" />
                </svg>
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TemplateGalleryCard({
  meta,
  profile,
  settings,
  onChoose,
}: {
  meta: (typeof templateCatalog)[0];
  profile: JobSeekerProfile;
  settings: ResumeSettings;
  onChoose: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[#d8e4ef] bg-white p-3 shadow-[0_10px_28px_rgba(71,98,122,0.14)]">
      <div className="rounded-[14px] border border-[#d6dde7] bg-[#f6fbff] p-2">
        <div className="relative h-[240px] overflow-hidden rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(21,35,53,0.05)]">
          <div
            className="absolute left-1/2 top-0"
            style={{
              width: 794,
              minHeight: 1123,
              transform: "translateX(-50%) scale(0.26)",
              transformOrigin: "top center",
            }}
          >
            <div
              style={{
                fontFamily: settings.fontFamily ?? "Inter",
                fontSize: `${settings.fontSize ?? 11}px`,
                lineHeight: settings.lineSpacing ?? "1.15",
                ...(settings.accentColor ? { "--resume-accent": settings.accentColor } as CSSProperties : {}),
              }}
            >
              <ResumePreview profile={profile} template={meta.id} settings={settings} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 px-1 pb-1 pt-3">
        <div>
          <h3 className="text-sm font-bold text-[#112138]">{meta.label}</h3>
          <p className="mt-1 text-xs leading-5 text-[#5f7087]">{meta.description}</p>
        </div>
        {meta.badge ? (
          <span className="shrink-0 rounded-full bg-[#dfeeff] px-2.5 py-1 text-[10px] font-semibold text-[#2f64eb]">
            {meta.badge}
          </span>
        ) : null}
      </div>
      <Button variant="primary" className="mt-3 h-11 w-full rounded-full text-sm font-semibold" onClick={onChoose}>
        Choose Template
      </Button>
    </div>
  );
}

/* ─── sub-components ───────────────────────────────────── */

/* TemplateCard */
function TemplateCard({
  meta,
  selected,
  onClick,
  onDownload,
}: {
  meta: (typeof templateCatalog)[0];
  selected: boolean;
  onClick: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${selected ? "border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]/30" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-active)]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onClick} className="text-sm font-semibold text-[var(--text)] hover:text-[var(--accent)] transition-colors">
          {meta.label}
        </button>
        {meta.badge && <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">{meta.badge}</span>}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">{meta.description}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn" onClick={onClick}>Select & Preview</button>
        <button type="button" className="btn btn-primary" onClick={onDownload}>Download</button>
      </div>
    </div>
  );
}

const templateRequirements: Record<ResumeTemplate, string[]> = {
  ATS_PLAIN: ["Clear contact details", "ATS-friendly section headings", "Quantified achievement bullets"],
  TECH_FOCUSED: ["Core stack and tools", "Architecture/performance wins", "Production delivery impact"],
  EXECUTIVE: ["Leadership scope", "Business outcomes", "Strategy and transformation impact"],
  STARTUP: ["0-1 ownership", "Fast shipping outcomes", "Cross-functional execution"],
  ACADEMIC: ["Education/research detail", "Publications/thesis", "Technical depth evidence"],
  MODERN: ["Concise summary", "Clean experience storytelling", "Scannable hierarchy"],
  CLASSIC: ["Formal structure", "Chronological role history", "Core competencies"],
  MINIMAL: ["Short strong bullets", "Minimal visual noise", "Key links and contact clarity"],
  EDITORIAL_SIDEBAR: ["Strong sidebar profile data", "Clear experience bullets", "Languages, interests, and education in the side rail"],
  FORMAL_CENTERED: ["Very clean contact heading", "Traditional section rules", "Dense single-column content"],
  PASTEL_PROFILE: ["Balanced summary and contact box", "Portfolio-ready presentation", "Creative but still readable content blocks"],
  FRONTEND_ENGINEER: ["React/TypeScript/CSS strengths", "Accessibility + performance metrics", "Component/system ownership"],
  BACKEND_ENGINEER: ["API and service design", "Database/system scaling", "Reliability and latency improvements"],
  FULL_STACK_ENGINEER: ["End-to-end feature ownership", "Frontend + backend stack", "User and system impact metrics"],
  DEVOPS_ENGINEER: ["CI/CD and automation", "Cloud/IaC experience", "Monitoring + incident response"],
  DATA_SCIENTIST: ["Modeling/experiments", "Data pipeline context", "Business impact from analysis"],
  DATA_ANALYST: ["BI/dashboard tooling", "SQL and KPI ownership", "Decision-support outcomes"],
  PRODUCT_MANAGER: ["Roadmap and prioritization", "Cross-functional leadership", "Adoption/revenue outcomes"],
  UI_UX_DESIGNER: ["Portfolio case studies", "Research-to-design process", "Usability/accessibility outcomes"],
  QA_AUTOMATION_ENGINEER: ["Automation framework ownership", "Coverage and defect metrics", "Release quality gates"],
  MOBILE_DEVELOPER: ["Android/iOS stack", "Release/crash/performance metrics", "Mobile architecture choices"],
  CYBERSECURITY_ANALYST: ["Security controls/audits", "Detection and incident response", "Risk reduction outcomes"],
  MARKETING_SPECIALIST: ["Campaign strategy", "Funnel/conversion metrics", "Growth experiments and ROI"],
};

/* SectionControl */
function SectionControl({
  sectionKey,
  hidden,
  density,
  onToggle,
  onDensityChange,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  sectionKey: ResumeSectionKey;
  hidden: boolean;
  density: ResumeDensity;
  onToggle: () => void;
  onDensityChange: (d: ResumeDensity) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const densityOptions: ResumeDensity[] = ["COMPACT", "NORMAL", "SPACIOUS"];
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
      onDrop={onDrop}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150 ${hidden ? "border-[var(--border)] opacity-50" : "border-[var(--border-active)] bg-[var(--surface)]"}`}
    >
      <span className="cursor-grab"><IconGrip /></span>
      <span className="flex-1 text-sm font-medium text-[var(--text)]">{SECTION_LABELS[sectionKey]}</span>
      {/* density selector */}
      <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
        {densityOptions.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => onDensityChange(d)}
            className={`px-1.5 py-0.5 text-[10px] transition-colors ${density === d ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-raised)]"}`}
            title={d}
            aria-label={`Set ${SECTION_LABELS[sectionKey]} density to ${d.toLowerCase()}`}
          >
            {d === "COMPACT" ? "C" : d === "NORMAL" ? "N" : "S"}
          </button>
        ))}
      </div>
      <button type="button" onClick={onToggle} className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors" title={hidden ? "Show" : "Hide"} aria-label={`${hidden ? "Show" : "Hide"} ${SECTION_LABELS[sectionKey]} section`}>
        <IconEye off={hidden} />
      </button>
    </div>
  );
}

/* SettingSelect */
function SettingSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1">
      <label className="text-xs font-medium text-[var(--muted)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ColorPicker */
function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const presets = ["#4F8EF7", "#6366F1", "#2DD4BF", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#10B981"];
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-[var(--muted)]">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(c => (
          <button
              key={c}
              type="button"
            onClick={() => onChange(c)}
            className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${c === value ? "border-white scale-110" : "border-transparent"}`}
            style={{ background: c }}
              aria-label={`Set accent color ${c}`}
          />
        ))}
        <label className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] cursor-pointer text-xs text-[var(--muted)]" title="Custom color">
          <span>+</span>
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="sr-only" />
        </label>
      </div>
    </div>
  );
}

/* ATS Score Badge */
function AtsScoreBadge({ score, breakdown }: { score: number; breakdown: { label: string; pts: number; max: number }[] }) {
  const [showTip, setShowTip] = useState(false);
  const color = score >= 80 ? "text-[#2DD4BF]" : score >= 60 ? "text-[#F59E0B]" : "text-[#EF4444]";
  const ring = score >= 80 ? "stroke-[#2DD4BF]" : score >= 60 ? "stroke-[#F59E0B]" : "stroke-[#EF4444]";
  const pct = Math.min(100, score);
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition-colors hover:border-[var(--border-active)]"
        aria-label="Show ATS score breakdown"
      >
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle cx="26" cy="26" r={r} fill="none" className={ring} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 26 26)" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
          <text x="26" y="30" textAnchor="middle" className={`text-sm font-bold ${color}`} fill="currentColor">{score}</text>
        </svg>
        <div className="text-left">
          <div className="text-xs font-semibold text-[var(--text)]">ATS Score</div>
          <div className="text-[10px] text-[var(--muted)]">{score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs work"}</div>
        </div>
      </button>
      {showTip && (
        <div className="absolute top-full left-0 z-30 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 shadow-lg">
          <div className="text-xs font-semibold text-[var(--text)] mb-2">Score Breakdown</div>
          {breakdown.map(b => (
            <div key={b.label} className="flex items-center justify-between py-1 text-xs">
              <span className="text-[var(--text-secondary)]">{b.label}</span>
              <span className={b.pts >= b.max * 0.7 ? "text-[#2DD4BF]" : "text-[#F59E0B]"}>{b.pts}/{b.max}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ═══  MAIN PAGE  ══════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════ */
export function ResumeBuilderPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  /* State */
  const [profile, setProfile] = useState<JobSeekerProfile | null>(null);
  const [versions, setVersions] = useState<GeneratedResume[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparingResume, setPreparingResume] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  /* Resume settings */
  const [template, setTemplate] = useState<ResumeTemplate>("ATS_PLAIN");
  const [settings, setSettings] = useState<ResumeSettings>(defaultResumeSettings());
  const [title, setTitle] = useState("My Resume");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  /* Section density per-section override */
  const [sectionDensity, setSectionDensity] = useState<Partial<Record<ResumeSectionKey, ResumeDensity>>>({});

  /* UI state */
  const [tab, setTab] = useState<"templates" | "sections" | "settings">("templates");
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersionTitle, setNewVersionTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.55);
  const [designerTab, setDesignerTab] = useState<"design" | "formatting">("design");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [currentStep, setCurrentStep] = useState<"intro" | "templates" | "review" | "enhance" | "finalized" | "builder">(() => {

    if (typeof window === "undefined") return "intro";
    return window.sessionStorage.getItem("resume-builder-intro-seen") === "1" ? "templates" : "intro";
  });

  /* Drag state for section reorder */
  const dragIdx = useRef<number | null>(null);

  /* ─── Load data ────────────────────────────────────── */
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    void loadResumeBuilderData();
  }, [token]);

  /* ─── Helpers ──────────────────────────────────────── */
  function activateVersion(v: GeneratedResume) {
    setActiveVersionId(v.id);
    setTemplate(v.template);
    setTitle(v.title);
    setTags(v.tags ?? []);
    if (v.settings) {
      setSettings({ ...defaultResumeSettings(), ...v.settings });
    } else {
      setSettings(defaultResumeSettings());
    }
    setSectionDensity({});
  }

  function updateSetting<K extends keyof ResumeSettings>(key: K, val: ResumeSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: val }));
  }

  function toggleSection(key: ResumeSectionKey) {
    setSettings(prev => ({
      ...prev,
      hiddenSections: { ...prev.hiddenSections, [key]: !prev.hiddenSections?.[key] },
    }));
  }

  function reorderSections(fromIdx: number, toIdx: number) {
    setSettings(prev => {
      const order = [...prev.sectionOrder];
      const [moved] = order.splice(fromIdx, 1);
      order.splice(toIdx, 0, moved);
      return { ...prev, sectionOrder: order };
    });
  }

  function ensureCustomSection() {
    setSettings((prev) => ({
      ...prev,
      sectionOrder: prev.sectionOrder.includes("CUSTOM") ? prev.sectionOrder : [...prev.sectionOrder, "CUSTOM"],
      hiddenSections: { ...(prev.hiddenSections ?? {}), CUSTOM: false },
      customSectionTitle: prev.customSectionTitle || "Volunteer Work",
      customSectionContent: prev.customSectionContent || "Add volunteer work, awards, publications, leadership, or hobbies that strengthen your story.",
    }));
  }

  function handleContinueFromIntro() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("resume-builder-intro-seen", "1");
    }
    setCurrentStep("templates");
  }

  async function loadResumeBuilderData() {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        apiJson<{ profile: JobSeekerProfile }>("/job-seeker/profile", { token }),
        (async () => {
          try {
            return await apiJson<{ generatedResumes: GeneratedResume[] }>("/job-seeker/generated-resumes", { token });
          } catch (err) {
            if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
              return { generatedResumes: [] as GeneratedResume[] };
            }
            throw err;
          }
        })(),
      ]);

      setProfile(pRes.profile);
      setVersions(rRes.generatedResumes);
      if (rRes.generatedResumes.length > 0) {
        const first = rRes.generatedResumes[0];
        activateVersion(first);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message || "Failed to load resume builder data.");
      } else {
        setActionError("Failed to load resume builder data.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfileFromSupabase() {
    if (!token) return;
    const response = await apiJson<{ profile: JobSeekerProfile }>("/job-seeker/profile", { token });
    setProfile(response.profile);
  }

  async function handleChooseTemplate(templateId: ResumeTemplate) {
    setTemplate(templateId);
    setPreparingResume(true);
    setActionError(null);
    try {
      await refreshProfileFromSupabase();
      setCurrentStep("review");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message || "Failed to load resume data from Supabase.");
      } else {
        setActionError("Failed to load resume data from Supabase.");
      }
    } finally {
      setPreparingResume(false);
    }
  }

  /* ─── Save / Create version ────────────────────────── */
  async function saveVersion(nameOverride?: string) {
    if (!token || !profile || saving || downloading || deletingVersionId) return false;
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const snap = snapshotFromProfile(profile);
      const finalTitle = (nameOverride ?? title).trim() || "Untitled Resume";
      const res = await apiJson<{ generatedResume: GeneratedResume }>("/job-seeker/generated-resumes", {
        method: "POST",
        token,
        body: {
          template,
          title: finalTitle,
          snapshot: snap as any,
          settings: settings as any,
          tags: tags as any,
        },
      });
      setVersions(prev => [res.generatedResume, ...prev]);
      setActiveVersionId(res.generatedResume.id);
      setActionSuccess("Resume version saved.");
      return true;
    } catch (err) {
      if (err instanceof ApiError) setActionError(err.message || "Failed to save resume version.");
      else setActionError("Failed to save resume version.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function deleteVersion(id: string) {
    if (!token || saving || downloading) return;
    setDeletingVersionId(id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiJson(`/job-seeker/generated-resumes/${id}`, { method: "DELETE", token });
      setVersions(prev => prev.filter(v => v.id !== id));
      if (activeVersionId === id) {
        const remaining = versions.filter(v => v.id !== id);
        if (remaining.length > 0) activateVersion(remaining[0]);
        else {
          setActiveVersionId(null);
          setTemplate("ATS_PLAIN");
          setSettings(defaultResumeSettings());
          setTitle("My Resume");
          setTags([]);
        }
      }
      setDeleteConfirmId(null);
      setActionSuccess("Resume version deleted.");
    } catch (err) {
      if (err instanceof ApiError) setActionError(err.message || "Failed to delete resume version.");
      else setActionError("Failed to delete resume version.");
    } finally {
      setDeletingVersionId(null);
    }
  }

  /* ─── PDF download ─────────────────────────────────── */
  async function handleDownload() {
    if (!profile || downloading || saving || !!deletingVersionId) return;
    setDownloading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const el = (document.getElementById("resume-render-full") || document.getElementById("resume-render")) as HTMLElement | null;
      if (!el) throw new Error("Resume preview is not ready yet");

      const { downloadResumePdfFromElement } = await import("../../utils/resumePdf");
      const safeTitle = (title || "Resume").replace(/[^a-z0-9\- _]/gi, "").trim() || "Resume";
      await downloadResumePdfFromElement(el, `${safeTitle}.pdf`);
      setActionSuccess("Download started.");
    } catch {
      setActionError("PDF generation failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadForTemplate(templateId: ResumeTemplate) {
    if (downloading || saving || !!deletingVersionId) return;
    if (template !== templateId) setTemplate(templateId);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await handleDownload();
  }

  /* ─── Computed ─────────────────────────────────────── */
  const atsResult = useMemo(() => {
    if (!profile) return { score: 0, breakdown: [] };
    return computeAtsScore(profile, settings);
  }, [profile, settings]);

  const previewProfile: JobSeekerProfile = useMemo(() => {
    if (!profile) return {} as JobSeekerProfile;
    return { ...profile };
  }, [profile]);

  const selectedTemplateMeta = templateCatalog.find(t => t.id === template) ?? templateCatalog[0];

  /* ─── Loading / empty ──────────────────────────────── */
  if (loading) {
    return (
      <div className="flex-1 px-8 py-6">
        <div className="mx-auto max-w-[1100px]">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 rounded-lg bg-[var(--surface)]" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[250px_1fr_1fr]">
              <div className="h-[300px] rounded-2xl bg-[var(--surface)] md:h-[600px]" />
              <div className="h-[300px] rounded-2xl bg-[var(--surface)] md:h-[600px]" />
              <div className="h-[300px] rounded-2xl bg-[var(--surface)] md:h-[600px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 px-8 py-6">
        <div className="mx-auto max-w-[1100px] text-center py-20">
          <div className="text-6xl mb-4">📄</div>
          <h2 className="text-xl font-semibold text-[var(--text)]">Complete your profile first</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Add your skills, experience, and education before building a resume.</p>
          <Button variant="primary" className="mt-6" onClick={() => navigate("/job-seeker/profile")}>Go to Profile</Button>
        </div>
      </div>
    );
  }

  if (currentStep === "intro") {
    return (
      <div className="min-h-full flex-1 bg-[radial-gradient(circle_at_top,_rgba(245,214,136,0.35),_transparent_24%),linear-gradient(180deg,_#fcfbf7_0%,_#f5f4f1_100%)] px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-10 flex items-center gap-3 text-[#2B2926]">
            <IntroLogoMark />
            <div className="text-[18px] font-black leading-[0.95] tracking-[-0.04em] sm:text-[20px]">
              <div>Resume</div>
              <div>Now.</div>
            </div>
          </div>

          <div className="mx-auto max-w-[760px] text-center">
            <h1 className="text-[46px] font-black leading-[0.98] tracking-[-0.06em] text-black sm:text-[64px]">
              Here’s how we get
              <br />
              you hired
            </h1>
          </div>

          <div className="mt-10 grid gap-7 lg:grid-cols-[1fr_1fr_1fr] lg:items-start">
            <ResumeBuilderIntroCard
              icon={<IntroTemplateIcon />}
              title="Pick a template"
              items={["ATS friendly", "Flexible layouts", "Job and industry match"]}
              complete
            />
            <ResumeBuilderIntroCard
              icon={<IntroAiIcon />}
              title="Add content with AI"
              items={["Words that match what you do", "Edit & enhance with AI", "Quickly tailor for every application"]}
              complete
            />
            <ResumeBuilderIntroCard
              icon={<IntroDownloadIcon />}
              title="Download & send"
            />
          </div>

          <div className="mt-10 flex justify-center">
            <Button
              variant="primary"
              className="h-16 min-w-[310px] rounded-full px-10 text-[30px] font-black tracking-[-0.03em] shadow-[0_18px_36px_rgba(59,93,238,0.28)]"
              onClick={handleContinueFromIntro}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "templates") {
    return (
      <div className="min-h-full flex-1 bg-[linear-gradient(180deg,_#f5fbff_0%,_#e7f5ff_100%)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1360px]">
          <div className="mb-6 text-center">
            <h1 className="text-[30px] font-black tracking-[-0.04em] text-[#112138] sm:text-[38px]">Templates we recommend for you</h1>
            <p className="mt-2 text-sm text-[#607289]">Choose one of the {templateCatalog.length} templates below and continue to the next step.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {templateCatalog.map((meta) => (
              <TemplateGalleryCard
                key={meta.id}
                meta={meta}
                profile={previewProfile}
                settings={settings}
                onChoose={() => { void handleChooseTemplate(meta.id); }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "review") {
    return (
      <div className="min-h-full flex-1 bg-[linear-gradient(180deg,_#fcfcfd_0%,_#f4f7fb_100%)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep("templates")}
              className="text-sm font-medium text-[#365df4] hover:text-[#1f43ce]"
            >
              &lt; Back to templates
            </button>
            <div className="text-sm text-[#64748b]">Selected template: {selectedTemplateMeta.label}</div>
          </div>

          <div className="text-center">
            <h1 className="text-[34px] font-black tracking-[-0.04em] text-[#111827] sm:text-[44px]">Your resume is ready</h1>
            <p className="mt-2 text-sm text-[#64748b]">
              We refreshed your profile from Supabase and filled this template with your basic details, education, experience, projects, achievements, certifications, and skills.
            </p>
          </div>

          {actionError ? (
            <div className="mx-auto mt-4 max-w-[900px] rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]">
              {actionError}
            </div>
          ) : null}

          <div className="mt-8 rounded-[28px] border border-[#d7e0ee] bg-white p-4 shadow-[0_18px_50px_rgba(31,41,55,0.08)] sm:p-6">
            <div className="overflow-auto rounded-[20px] bg-[#edf3fb] p-3 sm:p-5">
              <div className="mx-auto min-w-[794px] max-w-[794px] shadow-[0_20px_48px_rgba(15,23,42,0.14)]">
                <div
                  id="resume-review-render"
                  style={{
                    fontFamily: settings.fontFamily ?? "Inter",
                    fontSize: `${settings.fontSize ?? 11}px`,
                    lineHeight: settings.lineSpacing ?? "1.15",
                    ...(settings.accentColor ? { "--resume-accent": settings.accentColor } as CSSProperties : {}),
                    ...(settings.pageMargin === "NARROW" ? { padding: 18 } : settings.pageMargin === "WIDE" ? { padding: 38 } : {}),
                  }}
                >
                  <ResumePreview profile={previewProfile} template={template} settings={settings} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <Button
              variant="primary"
              className="h-14 min-w-[240px] rounded-full px-10 text-lg font-bold shadow-[0_18px_36px_rgba(59,93,238,0.24)]"
              disabled={preparingResume}
              onClick={() => setCurrentStep("enhance")}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "enhance") {
    const hasCustomSection = settings.sectionOrder.includes("CUSTOM");

    return (
      <div className="min-h-full flex-1 bg-white px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-6 grid gap-6 lg:grid-cols-[1.15fr_0.55fr] lg:items-start">
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="max-w-[560px] text-[32px] font-black leading-[1.05] tracking-[-0.05em] text-black sm:text-[42px]">
                  Add details that show you're a well-rounded candidate
                </h1>
                <button
                  type="button"
                  onClick={ensureCustomSection}
                  className="shrink-0 rounded-full bg-[#ffca73] px-6 py-3 text-sm font-bold text-black shadow-[0_10px_20px_rgba(255,202,115,0.28)] transition-transform hover:-translate-y-0.5"
                >
                  + Add section
                </button>
              </div>

              <div className="mt-6 rounded-xl bg-[#f6f7ff] p-4 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.04)]">
                {!hasCustomSection ? (
                  <div className="rounded-xl border-2 border-dashed border-[#c5c8d6] bg-white px-6 py-12 text-center">
                    <button type="button" onClick={ensureCustomSection} className="text-sm font-semibold text-[#365df4]">
                      + Add section
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#d2d7e4] bg-white p-5">
                    <div className="grid gap-4">
                      <div>
                        <label className="text-sm font-semibold text-[#111827]">Section title</label>
                        <input
                          value={settings.customSectionTitle ?? ""}
                          onChange={(e) => updateSetting("customSectionTitle", e.target.value)}
                          className="mt-2 h-11 w-full rounded-xl border border-[#d1d5db] bg-white px-4 text-sm text-[#111827] outline-none focus:border-[#365df4]"
                          placeholder="Volunteer Work"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-[#111827]">What should this section say?</label>
                        <textarea
                          value={settings.customSectionContent ?? ""}
                          onChange={(e) => updateSetting("customSectionContent", e.target.value)}
                          rows={8}
                          className="mt-2 w-full rounded-xl border border-[#d1d5db] bg-white px-4 py-3 text-sm leading-6 text-[#111827] outline-none focus:border-[#365df4]"
                          placeholder="Add volunteering, awards, leadership, publications, or hobbies that strengthen your profile."
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {[
                          { title: "Volunteer Work", content: "Coordinated volunteer initiatives, supported community events, and contributed to team-led outreach programs with measurable participation growth." },
                          { title: "Awards", content: "Recognized for top performance, consistent delivery, and cross-functional collaboration in fast-paced environments." },
                          { title: "Publications", content: "Published practical write-ups, technical articles, or thought pieces that demonstrate subject matter depth and communication ability." },
                          { title: "Leadership", content: "Led peers, mentored juniors, organized team activities, and helped improve delivery quality through initiative and ownership." },
                        ].map((preset) => (
                          <button
                            key={preset.title}
                            type="button"
                            onClick={() => {
                              ensureCustomSection();
                              updateSetting("customSectionTitle", preset.title);
                              updateSetting("customSectionContent", preset.content);
                            }}
                            className="rounded-full border border-[#cbd5e1] px-3 py-1.5 font-medium text-[#365df4] hover:border-[#365df4] hover:bg-[#eef2ff]"
                          >
                            {preset.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:pl-2">
              <div className="rounded-[20px] border-2 border-black bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                <div className="mx-auto overflow-hidden border border-[#d5dbe5] bg-[#f4f7fb] p-2">
                  <div className="mx-auto origin-top overflow-hidden bg-white shadow-[0_18px_36px_rgba(15,23,42,0.1)]" style={{ width: 246, height: 338 }}>
                    <div style={{ transform: "scale(0.31)", transformOrigin: "top left", width: 794, minHeight: 1123 }}>
                      <div
                        id="resume-render"
                        style={{
                          fontFamily: settings.fontFamily ?? "Inter",
                          fontSize: `${settings.fontSize ?? 11}px`,
                          lineHeight: settings.lineSpacing ?? "1.15",
                          ...(settings.accentColor ? { "--resume-accent": settings.accentColor } as CSSProperties : {}),
                          ...(settings.pageMargin === "NARROW" ? { padding: 18 } : settings.pageMargin === "WIDE" ? { padding: 38 } : {}),
                        }}
                      >
                        <ResumePreview profile={previewProfile} template={template} settings={settings} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <button type="button" onClick={() => setCurrentStep("templates")} className="text-sm font-semibold text-[#365df4] hover:text-[#1f43ce]">
                    Change template
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <button type="button" onClick={() => setCurrentStep("review")} className="text-base font-semibold text-[#365df4] hover:text-[#1f43ce]">
              &lt; Back
            </button>
            <Button
              variant="primary"
              className="h-14 min-w-[180px] rounded-full px-8 text-base font-bold"
              onClick={() => setCurrentStep("finalized")}
            >
              Finalize
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Finalized: full designer page ─────────────── */
  if (currentStep === "finalized") {
    const accentPresets = [
      "#ffffff", "#1f2937", "#475569", "#1d4ed8", "#0369a1",
      "#0891b2", "#065f46", "#d97706", "#dc2626", "#7c3aed",
    ];
    const visibleSections = settings.sectionOrder.filter(
      (s) => !(settings.hiddenSections ?? {})[s as keyof typeof settings.hiddenSections],
    );
    const allSections = settings.sectionOrder;
    const isHidden = (section: ResumeSectionKey) => Boolean(settings.hiddenSections?.[section]);

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[#1b2a4a]">
        {/* ── Email modal ── */}
        {showEmailModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-bold text-[#111827]">Send resume to email</h3>
              {emailSent ? (
                <p className="mb-4 rounded-xl bg-[#dcfce7] px-4 py-3 text-sm font-semibold text-[#15803d]">
                  ✓ Email sent successfully!
                </p>
              ) : (
                <>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="recipient@email.com"
                    className="h-11 w-full rounded-xl border border-[#d1d5db] px-4 text-sm outline-none focus:border-[#365df4]"
                  />
                  <p className="mt-2 text-xs text-[#6b7280]">
                    Your resume will be sent as a PDF attachment.
                  </p>
                </>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowEmailModal(false); setEmailSent(false); setEmailInput(""); }}
                  className="rounded-xl border border-[#d1d5db] px-5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f9fafb]"
                >
                  Close
                </button>
                {!emailSent && (
                  <Button
                    variant="primary"
                    className="rounded-xl px-5 py-2 text-sm font-semibold"
                    onClick={() => {
                      if (!emailInput.includes("@")) return;
                      setEmailSent(true);
                    }}
                  >
                    Send
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Top bar ── */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <button
            type="button"
            onClick={() => setCurrentStep("enhance")}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
          >
            ← Back
          </button>
          <span className="text-sm font-semibold text-white/80">Resume Designer</span>
          <div className="w-24" />
        </div>

        {/* ── 3-column body ── */}
        <div className="flex min-h-0 flex-1 overflow-hidden" style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px" }}>

          {/* ══ LEFT SIDEBAR ══ */}
          <div className="flex flex-col overflow-y-auto border-r border-white/10 bg-[#1b2a4a]">
            {/* Tab toggle */}
            <div className="shrink-0 px-3 pt-4 pb-3">
              <div className="flex rounded-xl bg-white/10 p-1">
                {(["design", "formatting"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDesignerTab(t)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-all ${
                      designerTab === t
                        ? "bg-white text-[#1b2a4a] shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {designerTab === "design" ? (
              <>
                {/* Colors */}
                <div className="px-4 pb-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/40">Colors</p>
                  <div className="flex flex-wrap gap-2">
                    {accentPresets.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color}
                        onClick={() => updateSetting("accentColor", color)}
                        className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          background: color,
                          borderColor: settings.accentColor === color ? "#ffffff" : "transparent",
                          boxShadow: settings.accentColor === color ? "0 0 0 2px #1b2a4a, 0 0 0 4px #ffffff" : "inset 0 0 0 1px rgba(255,255,255,0.15)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-white/50">Custom</label>
                    <input
                      type="color"
                      value={settings.accentColor ?? "#1d4ed8"}
                      onChange={(e) => updateSetting("accentColor", e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                  </div>
                </div>

                {/* Templates */}
                <div className="border-t border-white/10 px-4 py-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/40">Templates</p>
                  <div className="grid grid-cols-2 gap-2">
                    {templateCatalog.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setTemplate(tpl.id as typeof template)}
                        className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                          template === tpl.id
                            ? "border-white shadow-[0_0_0_2px_rgba(255,255,255,0.4)]"
                            : "border-white/10 hover:border-white/30"
                        }`}
                        style={{ height: 90 }}
                      >
                        <div
                          style={{
                            transform: "scale(0.13)",
                            transformOrigin: "top left",
                            width: 794,
                            minHeight: 1123,
                            pointerEvents: "none",
                          }}
                        >
                          <ResumePreview profile={previewProfile} template={tpl.id as typeof template} settings={settings} />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1">
                          <p className="truncate text-[9px] font-semibold leading-none text-white">{tpl.label}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Formatting tab */
              <div className="space-y-4 px-4 pb-6 pt-2">
                {[
                  {
                    label: "Font Family", key: "fontFamily" as const,
                    options: [
                      { value: "Inter", label: "Inter" },
                      { value: "Merriweather", label: "Merriweather" },
                      { value: "Roboto", label: "Roboto" },
                      { value: "Lato", label: "Lato" },
                      { value: "Georgia", label: "Georgia" },
                      { value: "Times New Roman", label: "Times New Roman" },
                    ],
                    current: settings.fontFamily ?? "Inter",
                  },
                  {
                    label: "Font Size", key: "fontSize" as const,
                    options: [
                      { value: 10, label: "10 pt" },
                      { value: 11, label: "11 pt" }, { value: 12, label: "12 pt" },
                      { value: 13, label: "13 pt" },
                    ],
                    current: settings.fontSize ?? 11,
                  },
                  {
                    label: "Line Spacing", key: "lineSpacing" as const,
                    options: [
                      { value: "1.0", label: "Tight (1.0)" },
                      { value: "1.15", label: "Normal (1.15)" },
                      { value: "1.3", label: "Relaxed (1.3)" },
                      { value: "1.5", label: "Loose (1.5)" },
                    ],
                    current: settings.lineSpacing ?? "1.15",
                  },
                  {
                    label: "Page Margin", key: "pageMargin" as const,
                    options: [
                      { value: "NARROW", label: "Narrow" },
                      { value: "NORMAL", label: "Normal" },
                      { value: "WIDE", label: "Wide" },
                    ],
                    current: settings.pageMargin ?? "NORMAL",
                  },
                  {
                    label: "Density", key: "density" as const,
                    options: [
                      { value: "COMPACT", label: "Compact" },
                      { value: "NORMAL", label: "Normal" },
                      { value: "SPACIOUS", label: "Spacious" },
                    ],
                    current: settings.density ?? "NORMAL",
                  },
                ].map(({ label, key, options, current }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-white/40">
                      {label}
                    </label>
                    <select
                      value={current as string | number}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (key === "fontSize") {
                          updateSetting("fontSize", Number(raw) as ResumeSettings["fontSize"]);
                          return;
                        }
                        if (key === "fontFamily") {
                          updateSetting("fontFamily", raw as ResumeFont);
                          return;
                        }
                        if (key === "lineSpacing") {
                          updateSetting("lineSpacing", raw as ResumeSettings["lineSpacing"]);
                          return;
                        }
                        if (key === "pageMargin") {
                          updateSetting("pageMargin", raw as ResumePageMargin);
                          return;
                        }
                        if (key === "density") {
                          updateSetting("density", raw as ResumeDensity);
                        }
                      }}
                      className="h-9 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white outline-none focus:border-white/40"
                    >
                      {options.map((o) => (
                        <option key={String(o.value)} value={o.value} className="text-black">
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══ CENTER: live preview ══ */}
          <div className="flex flex-col overflow-hidden bg-[#0f1a30]">
            {/* Title bar */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 px-4">
              <span className="truncate text-sm font-semibold text-white/80">{title || "Untitled Resume"}</span>
            </div>

            {/* Scrollable preview area */}
            <div className="flex-1 overflow-auto px-6 py-6">
              <div
                className="mx-auto bg-white shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                style={{ width: 794, minHeight: 1123 }}
              >
                <div
                  id="resume-render-full"
                  style={{
                    fontFamily: settings.fontFamily ?? "Inter",
                    fontSize: `${settings.fontSize ?? 11}px`,
                    lineHeight: settings.lineSpacing ?? "1.15",
                    ...(settings.accentColor ? { "--resume-accent": settings.accentColor } as CSSProperties : {}),
                    ...(settings.pageMargin === "NARROW" ? { padding: 18 } : settings.pageMargin === "WIDE" ? { padding: 38 } : {}),
                  }}
                >
                  <ResumePreview profile={previewProfile} template={template} settings={settings} />
                </div>
              </div>
            </div>
          </div>

          {/* ══ RIGHT SIDEBAR ══ */}
          <div className="flex flex-col overflow-y-auto border-l border-white/10 bg-[#f8fafc]">
            {/* Action icon buttons */}
            <div className="border-b border-[#e2e8f0] px-4 py-4">
              <div className="flex justify-around">
                {[
                  {
                    icon: (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    ),
                    label: "Download",
                    onClick: handleDownload,
                  },
                  {
                    icon: (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    ),
                    label: "Print",
                    onClick: () => window.print(),
                  },
                  {
                    icon: (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    ),
                    label: "Email",
                    onClick: () => setShowEmailModal(true),
                  },
                ].map(({ icon, label, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="flex flex-col items-center gap-1.5 rounded-xl px-3 py-2 text-[#374151] transition-colors hover:bg-[#eff6ff] hover:text-[#1d4ed8]"
                  >
                    {icon}
                    <span className="text-[11px] font-semibold">{label}</span>
                  </button>
                ))}
              </div>

              <Button
                variant="primary"
                loading={downloading}
                className="mt-4 h-11 w-full rounded-full text-sm font-bold"
                onClick={handleDownload}
              >
                Save &amp; Download
              </Button>
            </div>

            {/* Spell check row */}
            <div className="border-b border-dashed border-[#e2e8f0] px-4 py-3">
              <button type="button" className="flex items-center gap-2 text-sm font-semibold text-[#1d4ed8] hover:text-[#1e40af]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Spell Check
              </button>
            </div>

            {/* Resume sections */}
            <div className="flex-1 px-4 py-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#94a3b8]">Resume Sections</p>
              <ol className="space-y-1">
                {allSections.map((sec, idx) => (
                  <li key={sec} className="rounded-lg px-2 py-2 text-sm hover:bg-[#eff6ff]">
                    <div className="flex items-center gap-2 text-[#374151]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-[10px] font-bold text-[#1d4ed8]">
                        {idx + 1}
                      </span>
                      <span className={`flex-1 font-medium ${isHidden(sec) ? "text-[#94a3b8] line-through" : ""}`}>
                        {SECTION_LABELS[sec] ?? sec}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSection(sec)}
                        className="rounded-md border border-[#d1d5db] px-1.5 py-0.5 text-[10px] font-semibold text-[#334155] hover:bg-white"
                        title={isHidden(sec) ? "Show section" : "Hide section"}
                      >
                        {isHidden(sec) ? "Show" : "Hide"}
                      </button>
                      <button
                        type="button"
                        onClick={() => idx > 0 && reorderSections(idx, idx - 1)}
                        disabled={idx === 0}
                        className="rounded-md border border-[#d1d5db] px-1.5 py-0.5 text-[10px] font-semibold text-[#334155] disabled:opacity-40"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => idx < allSections.length - 1 && reorderSections(idx, idx + 1)}
                        disabled={idx === allSections.length - 1}
                        className="rounded-md border border-[#d1d5db] px-1.5 py-0.5 text-[10px] font-semibold text-[#334155] disabled:opacity-40"
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>

                    {sec === "CUSTOM" && !isHidden("CUSTOM") ? (
                      <div className="mt-2 grid gap-2 rounded-lg border border-[#e2e8f0] bg-white p-2">
                        <input
                          value={settings.customSectionTitle ?? ""}
                          onChange={(e) => updateSetting("customSectionTitle", e.target.value)}
                          placeholder="Custom section title"
                          className="h-8 rounded-md border border-[#d1d5db] px-2 text-xs outline-none focus:border-[#365df4]"
                        />
                        <textarea
                          value={settings.customSectionContent ?? ""}
                          onChange={(e) => updateSetting("customSectionContent", e.target.value)}
                          placeholder="Custom section content"
                          rows={3}
                          className="rounded-md border border-[#d1d5db] px-2 py-1.5 text-xs outline-none focus:border-[#365df4]"
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>

              <div className="mt-2 text-[11px] text-[#64748b]">
                Visible: {visibleSections.length} / {allSections.length}
              </div>

              <button
                type="button"
                onClick={() => {
                  ensureCustomSection();
                  setActionSuccess("Custom section added. Edit it from Resume Sections.");
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#fbbf24] bg-[#fffbeb] px-4 py-2.5 text-sm font-semibold text-[#92400e] hover:bg-[#fef3c7]"
              >
                + Add a section
              </button>
            </div>

            {/* Footer links */}
            <div className="border-t border-[#e2e8f0] px-4 py-3">
              <div className="flex flex-wrap justify-center gap-3 text-[11px] text-[#94a3b8]">
                <a href="#" className="hover:text-[#374151]">Terms</a>
                <span>·</span>
                <a href="#" className="hover:text-[#374151]">Privacy Policy</a>
                <span>·</span>
                <a href="#" className="hover:text-[#374151]">Contact Us</a>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  /* ═══════════════════════════════════════════════════ */
  /* ═══  RENDER  ═════════════════════════════════════ */
  /* ═══════════════════════════════════════════════════ */
  return (
    <div className="flex-1 px-8 py-6">
      <div className="mx-auto max-w-[1400px]">

        {/* ── Header ────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Resume Builder</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Craft the perfect resume — choose template, reorder sections, tune settings, download PDF.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AtsScoreBadge score={atsResult.score} breakdown={atsResult.breakdown} />
            <Button variant="secondary" className="sm:hidden" onClick={() => setShowFullPreview(true)}>Preview</Button>
            <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => setShowFullPreview(true)}>Full Preview</Button>
            <Button variant="primary" loading={downloading} onClick={handleDownload}>
              <IconDownload /> Download PDF
            </Button>
          </div>
        </div>

        {actionError ? (
          <Card className="mb-4 border-danger/40 bg-danger/10 p-3 text-sm text-danger">{actionError}</Card>
        ) : null}
        {actionSuccess ? (
          <Card className="mb-4 border-[var(--color-success)]/40 bg-[var(--color-success)]/10 p-3 text-sm text-[var(--color-success)]">{actionSuccess}</Card>
        ) : null}

        {/* ── Three-panel layout ────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr] lg:grid-cols-[260px_1fr_1fr]">

          {/* ═══ LEFT PANEL — Versions ═══════════════ */}
          <Card className="overflow-hidden p-0 lg:max-h-[calc(100vh-180px)]">
            <div className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text)]">Versions</span>
              <button
                type="button"
                onClick={() => { setNewVersionTitle(""); setShowNewVersionModal(true); }}
                className="flex items-center gap-1 rounded-md bg-[var(--accent)]/10 px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
              >
                <IconPlus /> New
              </button>
            </div>
            <div className="space-y-1.5 overflow-y-auto p-2 lg:max-h-[calc(100vh-240px)]">
              {versions.length === 0 && (
                <div className="py-8 text-center">
                  <div className="text-3xl mb-2">📝</div>
                  <p className="text-xs text-[var(--muted)]">No versions yet</p>
                  <p className="text-xs text-[var(--muted)]">Click "New" to create one</p>
                </div>
              )}
              {versions.map(v => {
                const isActive = v.id === activeVersionId;
                const meta = templateCatalog.find(t => t.id === v.template);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => activateVersion(v)}
                    className={`w-full text-left rounded-lg border p-2 transition-all duration-150 group ${isActive ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface)]"}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-medium text-[var(--text)] truncate">{v.title}</span>
                      {isActive && <span className="text-[var(--accent)]"><IconCheck /></span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {meta?.badge && <span className="rounded-full bg-[var(--accent-purple)]/10 px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent-purple)]">{meta.badge}</span>}
                      <span className="text-[10px] text-[var(--muted)]">{meta?.label ?? v.template}</span>
                    </div>
                    {v.tags && v.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {v.tags.slice(0, 3).map(t => <span key={t} className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">{t}</span>)}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-[var(--muted)]">{formatDate(v.createdAt)}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" aria-label={`Duplicate version ${v.title}`} onClick={(e) => { e.stopPropagation(); /* duplicate logic */ setNewVersionTitle(v.title + " (copy)"); setShowNewVersionModal(true); }} className="text-[var(--muted)] hover:text-[var(--text)] p-0.5" title="Duplicate"><IconCopy /></button>
                        <button type="button" aria-label={`Delete version ${v.title}`} onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(v.id); }} className="text-[var(--muted)] hover:text-[var(--danger)] p-0.5" title="Delete"><IconTrash /></button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Save current */}
            <div className="border-t border-[var(--border)] p-3">
              <Button
                variant="primary"
                className="w-full text-sm"
                loading={saving}
                disabled={downloading || !!deletingVersionId}
                onClick={() => {
                  setNewVersionTitle(title || "My Resume");
                  setShowNewVersionModal(true);
                }}
              >
                Save as New Version
              </Button>
            </div>
          </Card>

          {/* ═══ CENTER PANEL — Controls ═════════════ */}
          <Card className="overflow-hidden p-0 lg:max-h-[calc(100vh-180px)]">
            {/* Tab bar */}
            <div className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-1">
              {(["templates", "sections", "settings"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors capitalize ${tab === t ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-4 lg:max-h-[calc(100vh-240px)]">

              {/* ── Templates tab ───────────────────── */}
              {tab === "templates" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)]">Resume title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1 w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                      placeholder="e.g. Full Stack Developer Resume"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)]">Tags</label>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 min-h-[36px]">
                      {tags.map(t => (
                        <span key={t} className="flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)]">
                          {t}
                          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-[var(--danger)]">&times;</button>
                        </span>
                      ))}
                      <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && tagInput.trim()) {
                            e.preventDefault();
                            if (!tags.includes(tagInput.trim())) setTags(prev => [...prev, tagInput.trim()]);
                            setTagInput("");
                          }
                        }}
                        className="flex-1 min-w-[80px] bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                        placeholder="Add tag…"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <h3 className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider mb-3">Choose Template</h3>
                    <div className="space-y-2">
                      {templateCatalog.map(meta => (
                        <TemplateCard
                          key={meta.id}
                          meta={meta}
                          selected={template === meta.id}
                          onClick={() => setTemplate(meta.id)}
                          onDownload={() => { void downloadForTemplate(meta.id); }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text)]">{selectedTemplateMeta.label} required details</span>
                      <button type="button" className="btn" onClick={() => setShowFullPreview(true)}>View full format</button>
                    </div>
                    <ul className="mt-2 list-disc pl-5 text-xs text-[var(--muted)] space-y-1">
                      {templateRequirements[template].map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* ── Sections tab ────────────────────── */}
              {tab === "sections" && (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--muted)] mb-3">Drag to reorder • Toggle visibility • Set density (C/N/S)</p>
                  {settings.sectionOrder.map((key, idx) => (
                    <SectionControl
                      key={key}
                      sectionKey={key}
                      hidden={!!settings.hiddenSections?.[key]}
                      density={sectionDensity[key] ?? settings.density}
                      onToggle={() => toggleSection(key)}
                      onDensityChange={(d) => setSectionDensity(prev => ({ ...prev, [key]: d }))}
                      onDragStart={() => { dragIdx.current = idx; }}
                      onDragOver={() => {}}
                      onDrop={() => {
                        if (dragIdx.current !== null && dragIdx.current !== idx) {
                          reorderSections(dragIdx.current, idx);
                        }
                        dragIdx.current = null;
                      }}
                    />
                  ))}

                  {/* Add custom section */}
                  {!settings.sectionOrder.includes("CUSTOM") && (
                    <button
                      type="button"
                      onClick={() => updateSetting("sectionOrder", [...settings.sectionOrder, "CUSTOM"])}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] py-2.5 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      <IconPlus /> Add Custom Section
                    </button>
                  )}

                  {/* Custom section content */}
                  {settings.sectionOrder.includes("CUSTOM") && (
                    <div className="mt-3 rounded-lg border border-[var(--border)] p-3 space-y-2">
                      <label className="text-xs font-medium text-[var(--muted)]">Custom Section Title</label>
                      <input
                        value={settings.customSectionTitle ?? ""}
                        onChange={(e) => updateSetting("customSectionTitle", e.target.value)}
                        className="w-full h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        placeholder="e.g., Volunteer Work"
                      />
                      <label className="text-xs font-medium text-[var(--muted)]">Content</label>
                      <textarea
                        value={settings.customSectionContent ?? ""}
                        onChange={(e) => updateSetting("customSectionContent", e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
                        placeholder="Enter content for your custom section..."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Settings tab ────────────────────── */}
              {tab === "settings" && (
                <div className="space-y-4">
                  <SettingSelect<ResumeFont>
                    label="Font Family"
                    value={settings.fontFamily ?? "Inter"}
                    onChange={(v) => updateSetting("fontFamily", v)}
                    options={[
                      { value: "Inter", label: "Inter" },
                      { value: "Roboto", label: "Roboto" },
                      { value: "Georgia", label: "Georgia" },
                      { value: "Times New Roman", label: "Times New Roman" },
                      { value: "Merriweather", label: "Merriweather" },
                      { value: "Calibri", label: "Calibri" },
                    ]}
                  />

                  <SettingSelect<string>
                    label="Font Size"
                    value={String(settings.fontSize ?? 11)}
                    onChange={(v) => updateSetting("fontSize", Number(v) as 10 | 11 | 12 | 13)}
                    options={[
                      { value: "10", label: "10 px" },
                      { value: "11", label: "11 px" },
                      { value: "12", label: "12 px" },
                      { value: "13", label: "13 px" },
                    ]}
                  />

                  <SettingSelect<"1" | "1.15" | "1.5">
                    label="Line Spacing"
                    value={settings.lineSpacing ?? "1.15"}
                    onChange={(v) => updateSetting("lineSpacing", v)}
                    options={[
                      { value: "1", label: "Single" },
                      { value: "1.15", label: "1.15" },
                      { value: "1.5", label: "1.5" },
                    ]}
                  />

                  <SettingSelect<ResumePageMargin>
                    label="Page Margins"
                    value={settings.pageMargin ?? "NORMAL"}
                    onChange={(v) => updateSetting("pageMargin", v)}
                    options={[
                      { value: "NARROW", label: "Compact" },
                      { value: "NORMAL", label: "Normal" },
                      { value: "WIDE", label: "Spacious" },
                    ]}
                  />

                  <SettingSelect<ResumeDensity>
                    label="Line Density (Global)"
                    value={settings.density}
                    onChange={(v) => updateSetting("density", v)}
                    options={[
                      { value: "COMPACT", label: "Compact" },
                      { value: "NORMAL", label: "Comfortable" },
                      { value: "SPACIOUS", label: "Spacious" },
                    ]}
                  />

                  <SettingSelect<ResumeDateFormat>
                    label="Date Format"
                    value={settings.dateFormat ?? "MONTH_YYYY"}
                    onChange={(v) => updateSetting("dateFormat", v)}
                    options={[
                      { value: "MM/YYYY", label: "MM/YYYY (01/2025)" },
                      { value: "MONTH_YYYY", label: "Month YYYY (Jan 2025)" },
                      { value: "YYYY", label: "YYYY (2025)" },
                    ]}
                  />

                  <ColorPicker
                    label="Accent Color"
                    value={settings.accentColor ?? "#1A73E8"}
                    onChange={(v) => updateSetting("accentColor", v)}
                  />

                  {/* Toggles */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">Display Options</div>
                    {([
                      { key: "showPhoto", label: "Show Photo", desc: "Some markets prefer no photo" },
                      { key: "showSkillBars", label: "Skill Bars", desc: "Visual proficiency indicators" },
                      { key: "groupSkillsByCategory", label: "Group Skills", desc: "Organize skills by category" },
                      { key: "showTimeline", label: "Timeline", desc: "Timeline dots on experience" },
                    ] as const).map(opt => (
                      <label key={opt.key} className="flex items-center justify-between gap-3 cursor-pointer group">
                        <div>
                          <div className="text-sm text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">{opt.label}</div>
                          <div className="text-[10px] text-[var(--muted)]">{opt.desc}</div>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={!!settings[opt.key]}
                            onChange={() => updateSetting(opt.key, !settings[opt.key] as any)}
                            className="sr-only peer"
                          />
                          <div className="h-5 w-9 rounded-full bg-[var(--border)] peer-checked:bg-[var(--accent)] transition-colors" />
                          <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* ═══ RIGHT PANEL — Live Preview ══════════ */}
          <Card className="relative hidden overflow-hidden p-0 lg:block lg:max-h-[calc(100vh-180px)]">
            <div className="border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text)]">Preview</span>
                <Badge variant="blue">{selectedTemplateMeta.label}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewScale(Math.max(0.3, previewScale - 0.05))}
                  className="rounded px-1.5 py-0.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-raised)]"
                  aria-label="Zoom out preview"
                >−</button>
                <span className="text-xs text-[var(--muted)] w-10 text-center">{Math.round(previewScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setPreviewScale(Math.min(1, previewScale + 0.05))}
                  className="rounded px-1.5 py-0.5 text-xs text-[var(--muted)] hover:bg-[var(--surface-raised)]"
                  aria-label="Zoom in preview"
                >+</button>
              </div>
            </div>

            <div className="overflow-auto p-4 flex justify-center" style={{ maxHeight: "calc(100vh - 232px)" }}>
              <div
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top center",
                  width: 794,
                  minHeight: 1123,
                }}
              >
                <div
                  id="resume-render"
                  style={{
                    fontFamily: settings.fontFamily ?? "Inter",
                    fontSize: `${settings.fontSize ?? 11}px`,
                    lineHeight: settings.lineSpacing ?? "1.15",
                    ...(settings.accentColor ? { "--resume-accent": settings.accentColor } as any : {}),
                    ...(settings.pageMargin === "NARROW" ? { padding: 18 } : settings.pageMargin === "WIDE" ? { padding: 38 } : {}),
                  }}
                >
                  <ResumePreview profile={previewProfile} template={template} settings={settings} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ═══ Modals ══════════════════════════════════ */}

      {/* New Version Modal */}
      <Modal open={showNewVersionModal} onClose={() => setShowNewVersionModal(false)}>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Save as New Version</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-[var(--muted)]">Version Name</label>
            <input
              autoFocus
              value={newVersionTitle}
              onChange={(e) => setNewVersionTitle(e.target.value)}
              className="mt-1 w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              placeholder="e.g. Frontend Developer Resume"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void (async () => {
                    const ok = await saveVersion(newVersionTitle);
                    if (ok) {
                      setTitle(newVersionTitle.trim() || "Untitled Resume");
                      setShowNewVersionModal(false);
                    }
                  })();
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={saving} onClick={() => setShowNewVersionModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={downloading || !!deletingVersionId}
              onClick={() => {
                void (async () => {
                  const ok = await saveVersion(newVersionTitle);
                  if (ok) {
                    setTitle(newVersionTitle.trim() || "Untitled Resume");
                    setShowNewVersionModal(false);
                  }
                })();
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-2">Delete Version?</h2>
        <p className="text-sm text-[var(--muted)] mb-6">This action cannot be undone. The resume version will be permanently removed.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={!!deletingVersionId} onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button variant="danger" loading={!!deletingVersionId} onClick={() => deleteConfirmId && void deleteVersion(deleteConfirmId)}>Delete</Button>
        </div>
      </Modal>

      {/* Full Preview Modal */}
      {showFullPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFullPreview(false)}
          />
          <div className="relative z-10 max-h-[95vh] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text)]">Resume Preview — {selectedTemplateMeta.label}</h2>
              <div className="flex items-center gap-3">
                <AtsScoreBadge score={atsResult.score} breakdown={atsResult.breakdown} />
                <Button variant="primary" loading={downloading} onClick={handleDownload}>
                  <IconDownload /> Download PDF
                </Button>
                <button type="button" aria-label="Close full preview" onClick={() => setShowFullPreview(false)} className="text-[var(--muted)] hover:text-[var(--text)] text-xl leading-none">&times;</button>
              </div>
            </div>
            <div
              id="resume-render-full"
              style={{
                fontFamily: settings.fontFamily ?? "Inter",
                fontSize: `${settings.fontSize ?? 11}px`,
                lineHeight: settings.lineSpacing ?? "1.15",
                ...(settings.accentColor ? { "--resume-accent": settings.accentColor } as any : {}),
                ...(settings.pageMargin === "NARROW" ? { padding: 18 } : settings.pageMargin === "WIDE" ? { padding: 38 } : {}),
              }}
            >
              <ResumePreview profile={previewProfile} template={template} settings={settings} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
