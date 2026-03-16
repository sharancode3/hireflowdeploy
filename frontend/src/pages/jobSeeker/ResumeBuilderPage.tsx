import { useEffect, useMemo, useRef, useState } from "react";
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

/* ─── sub-components ───────────────────────────────────── */

/* TemplateCard */
function TemplateCard({ meta, selected, onClick }: { meta: (typeof templateCatalog)[0]; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${selected ? "border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]/30" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-active)]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--text)]">{meta.label}</span>
        {meta.badge && <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">{meta.badge}</span>}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">{meta.description}</p>
    </button>
  );
}

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

  /* Drag state for section reorder */
  const dragIdx = useRef<number | null>(null);

  /* ─── Load data ────────────────────────────────────── */
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    Promise.all([
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
    ]).then(([pRes, rRes]) => {
      setProfile(pRes.profile);
      setVersions(rRes.generatedResumes);
      // Activate first version if exists
      if (rRes.generatedResumes.length > 0) {
        const first = rRes.generatedResumes[0];
        activateVersion(first);
      }
      setLoading(false);
    }).catch((err) => {
      if (err instanceof ApiError) {
        setActionError(err.message || "Failed to load resume builder data.");
      } else {
        setActionError("Failed to load resume builder data.");
      }
      setLoading(false);
    });
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
      const { downloadGeneratedResumePdf } = await import("../../utils/generatedResumePdf");
      const snap = snapshotFromProfile(profile);
      const previewResume: GeneratedResume = {
        id: "download",
        userId: profile.userId,
        template,
        title,
        createdAt: new Date().toISOString(),
        snapshot: snap,
        settings,
        tags,
      };
      await downloadGeneratedResumePdf(previewResume);
      setActionSuccess("Download started.");
    } catch {
      setActionError("PDF generation failed. Please try again.");
    } finally {
      setDownloading(false);
    }
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
                    className={`w-full text-left rounded-lg border p-3 transition-all duration-150 group ${isActive ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface)]"}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-sm font-medium text-[var(--text)] truncate">{v.title}</span>
                      {isActive && <span className="text-[var(--accent)]"><IconCheck /></span>}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {meta?.badge && <span className="rounded-full bg-[var(--accent-purple)]/10 px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent-purple)]">{meta.badge}</span>}
                      <span className="text-[10px] text-[var(--muted)]">{meta?.label ?? v.template}</span>
                    </div>
                    {v.tags && v.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {v.tags.slice(0, 3).map(t => <span key={t} className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">{t}</span>)}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center justify-between">
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
                        />
                      ))}
                    </div>
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
