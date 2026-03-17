import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFormData, apiJson, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { isProfileBuilderEnabled, fetchProfileFromSupabase, syncProfileToSupabase, addResumeUrl, listResumes, getSkillSuggestions } from "../../services/profileBuilderSupabase";
import type {
  AchievementItem,
  CertificationItem,
  EducationItem,
  ExperienceItem,
  GeneratedResume,
  JobSeekerProfile,
  LanguageItem,
  ProjectItem,
  Resume,
  ResumeTemplate,
} from "../../types";
import { openResumePreview } from "../../utils/resumePreview";
import { downloadGeneratedResumePdf } from "../../utils/generatedResumePdf";
import { templateCatalog } from "../../resume/catalog";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { PhonePickerInput } from "../../components/ui/PhonePickerInput";
import { SearchableLocationInput } from "../../components/ui/SearchableLocationInput";
import { composePhoneWithCode, splitPhoneWithCode } from "../../utils/phone";

function clampNumber(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function normalizeChip(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function addUniqueCaseInsensitive(list: string[], value: string) {
  const v = normalizeChip(value);
  if (!v) return list;
  const exists = list.some((s) => s.toLowerCase() === v.toLowerCase());
  if (exists) return list;
  return [...list, v];
}

function removeCaseInsensitive(list: string[], value: string) {
  return list.filter((s) => s.toLowerCase() !== value.toLowerCase());
}

function isOptionalEndpointError(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}

function computeProfileCompletion(profile: JobSeekerProfile, hasResume: boolean) {
  const parts: Array<{ ok: boolean; weight: number }> = [
    { ok: profile.fullName.trim().length >= 2, weight: 10 },
    { ok: Boolean(profile.headline && profile.headline.trim().length >= 5), weight: 10 },
    { ok: Boolean(profile.about && profile.about.trim().length >= 50), weight: 15 },
    { ok: Boolean(profile.location && profile.location.trim().length >= 2), weight: 5 },
    { ok: Boolean(profile.desiredRole && profile.desiredRole.trim().length >= 2), weight: 5 },
    { ok: profile.skills.length >= 5, weight: 15 },
    { ok: (profile.education?.length ?? 0) >= 1, weight: 10 },
    { ok: (profile.experience?.length ?? 0) >= 1 || profile.isFresher, weight: 10 },
    { ok: (profile.projects?.length ?? 0) >= 1, weight: 5 },
    { ok: (profile.languages?.length ?? 0) >= 1, weight: 5 },
    { ok: hasResume, weight: 10 },
  ];
  const total = parts.reduce((acc, p) => acc + p.weight, 0);
  const earned = parts.reduce((acc, p) => acc + (p.ok ? p.weight : 0), 0);
  return Math.round((earned / total) * 100);
}

function buildProfilePatch(profile: JobSeekerProfile) {
  return {
    photoDataUrl: profile.photoDataUrl ?? null,
    fullName: profile.fullName,
    phone: profile.phone,
    location: profile.location,
    headline: profile.headline ?? null,
    about: profile.about ?? null,
    experienceYears: profile.experienceYears,
    desiredRole: profile.desiredRole,
    skills: profile.skills,
    skillLevels: profile.skillLevels ?? {},
    interests: profile.interests ?? [],
    education: profile.education ?? [],
    experience: profile.experience ?? [],
    projects: profile.projects ?? [],
    certifications: profile.certifications ?? [],
    achievements: profile.achievements ?? [],
    languages: profile.languages ?? [],
    isFresher: profile.isFresher,
    visibility: profile.visibility,
  };
}

function generateSummaryFromProfile(profile: JobSeekerProfile, notes: string) {
  const name = profile.fullName.trim() || "This candidate";
  const role = profile.headline?.trim() || profile.desiredRole?.trim() || "professional";
  const location = profile.location?.trim();
  const desiredRole = profile.desiredRole?.trim();
  const userNotes = notes.trim();

  const experienceText = profile.isFresher || profile.experienceYears <= 0
    ? "an early-career profile"
    : `${profile.experienceYears}+ years of experience`;

  const line1Parts = [
    `${name} is a ${role}`,
    location ? `based in ${location}` : "",
    `with ${experienceText}`,
  ].filter(Boolean);

  const line2 = desiredRole
    ? `Currently seeking ${desiredRole} opportunities where they can contribute with ownership, collaboration, and measurable outcomes.`
    : "Focused on delivering reliable, user-centric solutions with clear business impact.";

  const line3 = userNotes ? `Additional focus: ${userNotes}.` : "";

  const summary = [
    `${line1Parts.join(", ")}.`,
    line2,
    line3,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  // Keep generated summary inside the 500-char About guidance.
  return summary.length > 500 ? `${summary.slice(0, 497).trimEnd()}...` : summary;
}

function improveBulletsFromText(text: string, presentTense: boolean) {
  const rows = text
    .split(/\n|\.|•|·/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!rows.length) return text;

  const verb = presentTense ? "Drive" : "Drove";
  return rows
    .map((r) => `• ${verb} ${r.charAt(0).toLowerCase()}${r.slice(1)} with measurable impact and clear ownership.`)
    .join("\n");
}

const EDUCATION_LEVEL_OPTIONS = [
  { value: "SCHOOL", label: "School (10th / 12th)" },
  { value: "DIPLOMA", label: "Diploma" },
  { value: "BACHELOR", label: "Bachelor's" },
  { value: "MASTER", label: "Master's" },
  { value: "PHD", label: "PhD" },
  { value: "OTHER", label: "Other" },
] as const;

function getEducationBodyLabel(level?: EducationItem["level"]) {
  return level === "SCHOOL" ? "Board" : "University / awarding body";
}

function ProgressBar({ value }: { value: number }) {
  const safe = clampNumber(value, 0, 100);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div className="text-xs text-[#777777]">{safe}% complete</div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Badge>{label}</Badge>
      {onRemove ? (
        <button
          type="button"
          className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary hover:border-border-active hover:text-text"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          title="Remove"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {subtitle ? (
        <div className="muted" style={{ fontSize: 13 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function ProfilePreviewCard({
  profile,
  completion,
  hasResume,
  onOpen,
}: {
  profile: JobSeekerProfile;
  completion: number;
  hasResume: boolean;
  onOpen: () => void;
}) {
  const topSkills = (profile.skills ?? []).slice(0, 6);
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Live preview</div>
        <Badge variant={hasResume ? "teal" : "amber"}>{hasResume ? "Resume ready" : "Resume missing"}</Badge>
      </div>
      <div className="rounded-2xl border border-border bg-surface-raised p-4">
        <div className="text-lg font-semibold">{profile.fullName}</div>
        <div className="text-sm text-text-secondary">{profile.headline || "Add a headline"}</div>
        <div className="mt-2 text-xs text-text-muted">
          {(profile.location || "Location") + " · " + (profile.desiredRole || "Desired role")}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {topSkills.length === 0 ? (
            <span className="text-xs text-text-muted">Add skills to show here.</span>
          ) : (
            topSkills.map((skill) => <Badge key={skill} variant="blue">{skill}</Badge>)
          )}
        </div>
        <div className="mt-4 text-xs text-text-muted">Completion: {completion}%</div>
      </div>
      <Button variant="secondary" className="w-full border border-[#2A2A3A] bg-[#1A1A26] text-[13px] text-white hover:border-[#1A73E8] hover:text-[#1A73E8]" onClick={onOpen}>
        Full preview
      </Button>
    </Card>
  );
}

export function JobSeekerProfilePage() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<JobSeekerProfile | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [generatedResumes, setGeneratedResumes] = useState<GeneratedResume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localOnlyMode, setLocalOnlyMode] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<number | null>(null);
  const lastSavedSnapshot = useRef<string>("");
  const latestSaveRequestId = useRef(0);

  type ProfileStep = "BASICS" | "SKILLS" | "EXPERIENCE" | "PROJECTS" | "EDUCATION" | "CERTIFICATIONS" | "RESUME";
  const steps: Array<{ key: ProfileStep; label: string; subtitle: string }> = [
    { key: "BASICS", label: "Basics", subtitle: "Identity, goals, about" },
    { key: "SKILLS", label: "Skills", subtitle: "Skills + interests" },
    { key: "EXPERIENCE", label: "Experience", subtitle: "Roles and impact" },
    { key: "PROJECTS", label: "Projects", subtitle: "Projects + proofs" },
    { key: "EDUCATION", label: "Education", subtitle: "Degrees + institutions" },
    { key: "CERTIFICATIONS", label: "Certifications", subtitle: "Credentials + highlights" },
    { key: "RESUME", label: "Resume", subtitle: "Upload or generate" },
  ];
  const [step, setStep] = useState<ProfileStep>("BASICS");
  const [resumeTemplate, setResumeTemplate] = useState<ResumeTemplate>("ATS_PLAIN");
  const [resumeTitle, setResumeTitle] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryNotes, setSummaryNotes] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");

  function localDraftKey() {
    return `hireflow_local_profile:${user?.id ?? "job_seeker"}`;
  }

  function fallbackProfile(): JobSeekerProfile {
    return {
      id: `local_${user?.id ?? "job_seeker"}`,
      userId: user?.id ?? "job_seeker",
      fullName: (user?.email?.split("@")[0] ?? "Job Seeker").trim(),
      phone: null,
      location: null,
      headline: null,
      about: null,
      experienceYears: 0,
      desiredRole: null,
      skills: [],
      skillLevels: {},
      interests: [],
      education: [],
      experience: [],
      projects: [],
      certifications: [],
      achievements: [],
      languages: [],
      isFresher: true,
      visibility: "PUBLIC",
      activeGeneratedResumeId: null,
    };
  }

  function loadLocalDraft(): JobSeekerProfile | null {
    try {
      const raw = localStorage.getItem(localDraftKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as JobSeekerProfile;
      }
      return null;
    } catch {
      return null;
    }
  }

  function saveLocalDraft(nextProfile: JobSeekerProfile) {
    localStorage.setItem(localDraftKey(), JSON.stringify(nextProfile));
  }

  const hasResume = resumes.length > 0 || generatedResumes.length > 0;
  const completion = useMemo(() => {
    if (!profile) return 0;
    return computeProfileCompletion(profile, hasResume);
  }, [profile, hasResume]);

  async function load() {
    if (!token || !user) return;

    let resolvedProfile: JobSeekerProfile | null = null;

    if (isProfileBuilderEnabled()) {
      try {
        const providerProfile = await fetchProfileFromSupabase(user.id);
        if (providerProfile) {
          resolvedProfile = providerProfile;
          setLocalOnlyMode(false);
          lastSavedSnapshot.current = JSON.stringify(buildProfilePatch(providerProfile));
        }
      } catch (error) {
        // continue to existing API fallback if Supabase table is not ready
        console.warn("Supabase profile load failed", error);
      }
    }

    if (!resolvedProfile) {
      try {
        const p = await apiJson<{ profile: JobSeekerProfile }>("/job-seeker/profile", { token });
        resolvedProfile = p.profile;
        setLocalOnlyMode(false);
        lastSavedSnapshot.current = JSON.stringify(buildProfilePatch(p.profile));
      } catch (e) {
        if (!isOptionalEndpointError(e)) throw e;
        resolvedProfile = loadLocalDraft() ?? fallbackProfile();
        setLocalOnlyMode(true);
      }
    }

    let resumesData: Resume[] = [];
    if (isProfileBuilderEnabled()) {
      try {
        resumesData = await listResumes(user.id);
      } catch (error) {
        console.warn("Failed to load resumes from Supabase", error);
      }
    } else {
      const r = await (async () => {
        try {
          return await apiJson<{ resumes: Resume[] }>("/job-seeker/resume", { token });
        } catch (e) {
          if (isOptionalEndpointError(e)) return { resumes: [] as Resume[] };
          throw e;
        }
      })();
      resumesData = r.resumes;
    }

    const g = await (async () => {
      try {
        return await apiJson<{ generatedResumes: GeneratedResume[] }>("/job-seeker/generated-resumes", { token });
      } catch (e) {
        if (isOptionalEndpointError(e)) return { generatedResumes: [] as GeneratedResume[] };
        throw e;
      }
    })();

    setProfile(resolvedProfile);
    const parsedPhone = splitPhoneWithCode(resolvedProfile.phone, "+91");
    setPhoneCountryCode(parsedPhone.countryCode);
    setResumes(resumesData);
    setGeneratedResumes(g.generatedResumes);
  }

  useEffect(() => {
    (async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  async function saveNow(nextProfile: JobSeekerProfile, requestId: number) {
    if (!token) return;
    setSaveState("saving");
    setError(null);

    if (localOnlyMode) {
      saveLocalDraft(nextProfile);
      setProfile(nextProfile);
      lastSavedSnapshot.current = JSON.stringify(buildProfilePatch(nextProfile));

      if (isProfileBuilderEnabled() && user?.id) {
        try {
          await syncProfileToSupabase(user.id, nextProfile);
          console.info("Local-only mode: synced to Supabase");
        } catch (syncError) {
          console.warn("Local-only mode: Supabase sync failed", syncError);
        }
      }

      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 3000);
      return;
    }

    try {
      const updated = await apiJson<{ profile: JobSeekerProfile }>("/job-seeker/profile", {
        method: "PATCH",
        token,
        body: buildProfilePatch(nextProfile),
      });

      // Ignore out-of-order responses from older save requests.
      if (requestId !== latestSaveRequestId.current) return;

      setProfile(updated.profile);
      const parsedPhone = splitPhoneWithCode(updated.profile.phone, "+91");
      setPhoneCountryCode(parsedPhone.countryCode);
      lastSavedSnapshot.current = JSON.stringify(buildProfilePatch(updated.profile));

      if (isProfileBuilderEnabled() && user?.id) {
        try {
          await syncProfileToSupabase(user.id, updated.profile);
          console.info("Synced profile to Supabase");
        } catch (syncError) {
          console.warn("Supabase sync failed", syncError);
          const message = syncError instanceof Error ? syncError.message : String(syncError);
          setError(`Supabase sync failed: ${message}`);
        }
      }

      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 3000);
    } catch (e) {
      // Ignore stale failures from superseded save requests.
      if (requestId !== latestSaveRequestId.current) return;

      if (isOptionalEndpointError(e)) {
        setLocalOnlyMode(true);
        saveLocalDraft(nextProfile);
        setProfile(nextProfile);
        lastSavedSnapshot.current = JSON.stringify(buildProfilePatch(nextProfile));
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 3000);
        return;
      }
      setSaveState("error");
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to update profile");
    }
  }

  async function persistBasicsToSupabase() {
    if (!isProfileBuilderEnabled() || !user || !profile) return;
    try {
      await syncProfileToSupabase(user.id, profile);
      console.info("Basics persisted to Supabase.");
    } catch (err) {
      console.error("Basics persistence failed", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function scheduleSave(nextProfile: JobSeekerProfile) {
    const snapshot = JSON.stringify(buildProfilePatch(nextProfile));
    if (snapshot === lastSavedSnapshot.current) {
      setSaveState("idle");
      return;
    }

    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const requestId = ++latestSaveRequestId.current;
    saveTimer.current = window.setTimeout(() => {
      void saveNow(nextProfile, requestId);
    }, 450);
  }

  async function uploadResume(file: File) {
    if (!token || !user) return;
    const form = new FormData();
    form.append("resume", file);
    const apiResponse = await apiFormData("/job-seeker/resume", form, token);

    if (isProfileBuilderEnabled()) {
      const resumeUrl = (apiResponse as any)?.resumeUrl || null;
      if (resumeUrl) {
        await addResumeUrl(user.id, resumeUrl);
      }
    }

    await load();
  }

  async function generateResumeVersion() {
    if (!token || !profile) return;

    setError(null);
    const payload = {
      template: resumeTemplate,
      title: resumeTitle,
      snapshot: buildProfilePatch(profile),
    };

    await apiJson<{ generatedResume: GeneratedResume }>("/job-seeker/generated-resumes", {
      method: "POST",
      token,
      body: payload as any,
    });
    setResumeTitle("");
    await load();
  }

  async function deleteGeneratedResume(id: string) {
    if (!token) return;
    setError(null);
    await apiJson<{ ok: boolean }>(`/job-seeker/generated-resumes/${id}`, {
      method: "DELETE",
      token,
    });
    await load();
  }

  async function setPrimaryGeneratedResume(id: string | null) {
    if (!token) return;
    setError(null);
    const updated = await apiJson<{ profile: JobSeekerProfile }>("/job-seeker/profile", {
      method: "PATCH",
      token,
      body: { activeGeneratedResumeId: id },
    });
    setProfile(updated.profile);
  }

  async function uploadPhoto(file: File) {
    if (!profile) return;
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    const next = { ...profile, photoDataUrl: dataUrl };
    setProfile(next);
    scheduleSave(next);
  }

  if (isLoading) {
    return (
      <div className="grid">
        <div className="card">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grid gap-4">
        <div className="card border-danger/60 bg-danger/10 text-danger">{error ?? "Profile not found."}</div>
      </div>
    );
  }

  const education = profile.education ?? [];
  const experience = profile.experience ?? [];
  const projects = profile.projects ?? [];
  const certifications = profile.certifications ?? [];
  const achievements = profile.achievements ?? [];
  const languages = profile.languages ?? [];
  const interests = profile.interests ?? [];

  const stepDone: Record<ProfileStep, boolean> = {
    BASICS:
      profile.fullName.trim().length >= 2 &&
      Boolean(profile.headline?.trim()) &&
      Boolean(profile.location?.trim()) &&
      Boolean(profile.desiredRole?.trim()) &&
      Boolean(profile.about?.trim() && profile.about.trim().length >= 50),
    SKILLS: profile.skills.length >= 3,
    EXPERIENCE: experience.length >= 1 || profile.isFresher,
    PROJECTS: projects.length >= 1,
    EDUCATION: education.length >= 1,
    CERTIFICATIONS: certifications.length >= 1 || achievements.length >= 1,
    RESUME: hasResume,
  };

  const saveLabel = saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "";

  const stepIndex = steps.findIndex((s) => s.key === step);
  const canBack = stepIndex > 0;
  const canNext = stepIndex < steps.length - 1;

  function back() {
    if (!canBack) return;
    setStep(steps[stepIndex - 1]!.key);
  }

  async function next() {
    if (!stepDone[step]) {
      setError(`Complete the ${steps[stepIndex]?.label.toLowerCase()} step before moving forward.`);
      return;
    }
    if (!canNext) return;

    if (step === "BASICS" && profile) {
      try {
        await saveNow(profile);
        await persistBasicsToSupabase();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save basics before moving.");
        return;
      }
    }

    setError(null);
    setStep(steps[stepIndex + 1]!.key);
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="bg-gradient-to-r from-white to-[#AAAAAA] bg-clip-text text-[28px] font-bold text-transparent">Profile Builder</h2>
          <p className="text-sm text-text-secondary">
            Inline editing + instant saving. Your visibility controls what recruiters can view.
          </p>
        </div>
        {saveLabel ? (
          <div className="flex items-center gap-2 text-xs text-[#777777] animate-fade-in">
            {saveState === "saved" ? <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-[pulse-check_1.5s_ease-in-out_infinite]" /> : null}
            {saveLabel}
          </div>
        ) : null}
        {isProfileBuilderEnabled() && profile ? (
          <button
            type="button"
            className="btn btn-xs"
            onClick={async () => {
              if (!user?.id) {
                alert("No user id.");
                return;
              }
              try {
                await syncProfileToSupabase(user.id, profile);
                alert("Supabase debug sync successful. Check tables basics/skills/etc.");
              } catch (err) {
                alert(`Supabase debug sync failed: ${err instanceof Error ? err.message : String(err)}`);
                console.error(err);
              }
            }}
          >
            Debug sync to Supabase
          </button>
        ) : null}
      </Card>

      {localOnlyMode ? (
        <Card className="border-amber-500/50 bg-amber-500/10 text-amber-300">
          Profile sync service is being upgraded. Your edits are saved locally for now.
        </Card>
      ) : null}

      {error ? <Card className="border-danger/60 bg-danger/10 text-danger">{error}</Card> : null}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="profile-tabs-scroll flex gap-2 overflow-x-auto pb-1">
              {steps.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={s.key === step}
                  className={
                    "shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-medium transition " +
                    (s.key === step
                      ? "border-[rgba(26,115,232,0.3)] bg-[rgba(26,115,232,0.15)] text-white"
                      : "border-transparent bg-transparent text-[#666666] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#AAAAAA]")
                  }
                  onClick={() => {
                    setError(null);
                    setStep(s.key);
                  }}
                  aria-current={s.key === step ? "step" : undefined}
                  title={s.subtitle}
                >
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            <ProgressBar value={completion} />
            {!stepDone[step] ? (
              <span className="inline-flex w-fit items-center rounded-full border border-[rgba(26,115,232,0.25)] bg-[rgba(26,115,232,0.1)] px-3 py-1 text-xs text-[#8AB4F8]">
                Optional: complete this section to improve profile completion
              </span>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={back} disabled={!canBack}>
                  Back
                </Button>
                <Button variant="primary" onClick={next} disabled={!canNext}>
                  Next
                </Button>
              </div>
            </div>
          </Card>

          {step === "BASICS" ? (
            <div className="card grid" style={{ gap: 16 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 999,
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {profile.photoDataUrl ? (
                    <img src={profile.photoDataUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div className="muted" style={{ fontWeight: 800 }}>
                      {profile.fullName
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((x) => x[0]?.toUpperCase())
                        .join("") || "U"}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 240, display: "grid", gap: 10 }}>
                  <div className="grid grid-2">
                    <div className="field">
                      <label className="label">Full name</label>
                      <input
                        className="input"
                        value={profile.fullName}
                        onChange={(e) => {
                          const next = { ...profile, fullName: e.target.value };
                          setProfile(next);
                          scheduleSave(next);
                        }}
                        onBlur={() => scheduleSave(profile)}
                        required
                      />
                    </div>

                    <div className="field">
                      <label className="label">Headline</label>
                      <input
                        className="input"
                        value={profile.headline ?? ""}
                        onChange={(e) => {
                          const next = { ...profile, headline: e.target.value || null };
                          setProfile(next);
                          scheduleSave(next);
                        }}
                        placeholder="e.g., Frontend Developer | React | TypeScript"
                      />
                    </div>
                  </div>

                  <div className="grid grid-2">
                    <div className="field">
                      <label className="label">Location</label>
                      <SearchableLocationInput
                        className="input"
                        value={profile.location ?? ""}
                        onChange={(value) => {
                          const next = { ...profile, location: value || null };
                          setProfile(next);
                          scheduleSave(next);
                        }}
                        placeholder="City, State"
                      />
                    </div>

                    <div className="field">
                      <label className="label">Desired role</label>
                      <input
                        className="input"
                        value={profile.desiredRole ?? ""}
                        onChange={(e) => {
                          const next = { ...profile, desiredRole: e.target.value || null };
                          setProfile(next);
                          scheduleSave(next);
                        }}
                        placeholder="e.g., Software Engineer"
                      />
                    </div>
                  </div>
                </div>

                <div style={{ minWidth: 220, display: "grid", gap: 12 }}>
                  <ProgressBar value={completion} />
                  <div className="field" style={{ margin: 0 }}>
                    <label className="label">Profile photo</label>
                    <input
                      className="input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadPhoto(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-2">
                <div className="field">
                  <label className="label">Phone</label>
                  <PhonePickerInput
                    className="w-full"
                    countryCode={phoneCountryCode}
                    onCountryCodeChange={(code) => {
                      setPhoneCountryCode(code);
                      const parsedPhone = splitPhoneWithCode(profile.phone, code);
                      const next = { ...profile, phone: composePhoneWithCode(code, parsedPhone.phone) || null };
                      setProfile(next);
                      scheduleSave(next);
                    }}
                    value={splitPhoneWithCode(profile.phone, phoneCountryCode).phone}
                    onChange={(value) => {
                      const next = { ...profile, phone: composePhoneWithCode(phoneCountryCode, value) || null };
                      setProfile(next);
                      scheduleSave(next);
                    }}
                    placeholder="Optional"
                  />
                </div>

                <div className="field">
                  <label className="label">Visibility</label>
                  <select
                    className="select"
                    value={profile.visibility}
                    onChange={(e) => {
                      const next = { ...profile, visibility: e.target.value as any };
                      setProfile(next);
                      scheduleSave(next);
                    }}
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private</option>
                  </select>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Private profiles are hidden from recruiter browsing.
                  </div>
                </div>
              </div>

              <div className="grid grid-2">
                <div className="field">
                  <label className="label">Experience (years)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={60}
                    value={profile.experienceYears}
                    onChange={(e) => {
                      const next = { ...profile, experienceYears: clampNumber(Number(e.target.value), 0, 60) };
                      setProfile(next);
                      scheduleSave(next);
                    }}
                  />
                </div>

                <div className="field">
                  <label className="label">Fresher</label>
                  <label className="badge badge-accent" style={{ width: "fit-content" }}>
                    <input
                      type="checkbox"
                      checked={profile.isFresher}
                      onChange={(e) => {
                        const next = { ...profile, isFresher: e.target.checked };
                        setProfile(next);
                        scheduleSave(next);
                      }}
                    />
                    Mark as fresher
                  </label>
                </div>
              </div>

              <div className="field">
                <div className="flex items-center justify-between">
                  <label className="label">About</label>
                  <button
                    type="button"
                    className="text-xs text-accent hover:text-text"
                    onClick={() => {
                      setSummaryDraft(generateSummaryFromProfile(profile, summaryNotes));
                      setSummaryModalOpen(true);
                    }}
                  >
                    ✨ Generate with AI
                  </button>
                </div>
                <textarea
                  className="input"
                  style={{ minHeight: 110, resize: "vertical" }}
                  value={profile.about ?? ""}
                  onChange={(e) => {
                    const next = { ...profile, about: e.target.value || null };
                    setProfile(next);
                    scheduleSave(next);
                  }}
                  placeholder="Write a concise professional summary (goals, strengths, what you are looking for)."
                />
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {profile.about?.length ?? 0}/500
                </div>
              </div>
            </div>
          ) : null}

          {step === "SKILLS" ? (
            <>
              <div className="card grid" style={{ gap: 12 }}>
                <SectionHeader title="Skills" subtitle="Add skills as chips. These are used for job matching." />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {profile.skills.length === 0 ? <div className="muted">No skills added yet.</div> : null}
                  {profile.skills.map((s) => (
                    <Chip
                      key={s.toLowerCase()}
                      label={s}
                      onRemove={() => {
                        const nextSkills = removeCaseInsensitive(profile.skills, s);
                        const nextLevels = { ...(profile.skillLevels ?? {}) };
                        delete nextLevels[s];
                        const next = { ...profile, skills: nextSkills, skillLevels: nextLevels };
                        setProfile(next);
                        scheduleSave(next);
                      }}
                    />
                  ))}
                </div>
                <SkillAdder
                  onAdd={(skill) => {
                    const nextSkills = addUniqueCaseInsensitive(profile.skills, skill);
                    const nextLevels = { ...(profile.skillLevels ?? {}) };
                    const normalized = skill.trim().replace(/\s+/g, " ");
                    if (normalized && !nextLevels[normalized]) nextLevels[normalized] = 3;
                    const next = { ...profile, skills: nextSkills, skillLevels: nextLevels };
                    setProfile(next);
                    scheduleSave(next);
                  }}
                />

                {getSkillSuggestions(profile.desiredRole ?? "").length > 0 ? (
                  <div className="card" style={{ padding: 12 }}>
                    <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                      Suggested skills for <strong>{profile.desiredRole}</strong>:
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {getSkillSuggestions(profile.desiredRole ?? "").map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="btn bg-surface-active text-xs"
                          onClick={() => {
                            const nextSkills = addUniqueCaseInsensitive(profile.skills, suggestion);
                            const nextLevels = { ...(profile.skillLevels ?? {}) };
                            if (!nextLevels[suggestion]) nextLevels[suggestion] = 3;
                            const next = { ...profile, skills: nextSkills, skillLevels: nextLevels };
                            setProfile(next);
                            scheduleSave(next);
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="muted" style={{ fontSize: 13 }}>
                  Add at least 3 technical skills to proceed. Skills are tag-based only.
                </div>
              </div>

              <LanguagesSection
                items={languages}
                onChange={(nextItems) => {
                  const nextProfile = { ...profile, languages: nextItems };
                  setProfile(nextProfile);
                  scheduleSave(nextProfile);
                }}
              />

              <div className="card grid" style={{ gap: 12 }}>
                <SectionHeader title="Interests" subtitle="Optional topics you care about." />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {interests.length === 0 ? <div className="muted">No interests added.</div> : null}
                  {interests.map((s) => (
                    <Chip
                      key={s.toLowerCase()}
                      label={s}
                      onRemove={() => {
                        const nextProfile = { ...profile, interests: removeCaseInsensitive(interests, s) };
                        setProfile(nextProfile);
                        scheduleSave(nextProfile);
                      }}
                    />
                  ))}
                </div>
                <SkillAdder
                  placeholder="Add an interest (e.g., FinTech, Accessibility)"
                  onAdd={(value) => {
                    const nextProfile = { ...profile, interests: addUniqueCaseInsensitive(interests, value) };
                    setProfile(nextProfile);
                    scheduleSave(nextProfile);
                  }}
                />
              </div>
            </>
          ) : null}

          {step === "EXPERIENCE" ? (
            <ExperienceSection
              items={experience}
              onImproveAI={(id) => {
                const target = experience.find((x) => x.id === id);
                if (!target) return;
                const improved = improveBulletsFromText(target.summary, !target.endDate);
                const nextItems = experience.map((x) => (x.id === id ? { ...x, summary: improved } : x));
                const next = { ...profile, experience: nextItems };
                setProfile(next);
                scheduleSave(next);
              }}
              onChange={(nextItems) => {
                const next = { ...profile, experience: nextItems };
                setProfile(next);
                scheduleSave(next);
              }}
            />
          ) : null}

          {step === "PROJECTS" ? (
            <>
              <ProjectsSection
                items={projects}
                onImproveAI={(id) => {
                  const target = projects.find((x) => x.id === id);
                  if (!target) return;
                  const improved = improveBulletsFromText(target.summary, true);
                  const nextItems = projects.map((x) => (x.id === id ? { ...x, summary: improved } : x));
                  const next = { ...profile, projects: nextItems };
                  setProfile(next);
                  scheduleSave(next);
                }}
                onChange={(nextItems) => {
                  const next = { ...profile, projects: nextItems };
                  setProfile(next);
                  scheduleSave(next);
                }}
              />
            </>
          ) : null}

          {step === "CERTIFICATIONS" ? (
            <>
              <CertificationsSection
                items={certifications}
                onChange={(nextItems) => {
                  const next = { ...profile, certifications: nextItems };
                  setProfile(next);
                  scheduleSave(next);
                }}
              />
            </>
          ) : null}

          {step === "CERTIFICATIONS" ? (
            <>
              <AchievementsSection
                items={achievements}
                onChange={(nextItems) => {
                  const next = { ...profile, achievements: nextItems };
                  setProfile(next);
                  scheduleSave(next);
                }}
              />
            </>
          ) : null}

          {step === "EDUCATION" ? (
            <EducationSection
              items={education}
              onChange={(nextItems) => {
                const next = { ...profile, education: nextItems };
                setProfile(next);
                scheduleSave(next);
              }}
            />
          ) : null}

          {step === "RESUME" ? (
            <div className="card grid" style={{ gap: 14 }}>
              <div>
                <h3 style={{ marginTop: 0 }}>Resume</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Upload a PDF/DOC, or generate a resume from your profile. Recruiters can only access your resume if you apply.
                </p>
              </div>

              <div className="field">
                <label className="label">Upload resume (max 5MB)</label>
                <input
                  className="input"
                  type="file"
                  accept="application/pdf,.pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadResume(file);
                    e.currentTarget.value = "";
                  }}
                />
              </div>

              {resumes.length === 0 ? (
                <div className="muted">No resumes uploaded yet.</div>
              ) : (
                <div className="grid">
                  {resumes.map((r) => (
                    <div key={r.id} className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 800 }}>{r.originalName}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        Uploaded: {new Date(r.createdAt).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void openResumePreview(r.id, token!)}
                      >
                        Preview
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />

              <div className="grid" style={{ gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>Generate from profile</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Creates a version you can download as PDF. You can keep multiple versions.
                  </div>
                </div>

                <div className="grid grid-2">
                  <div className="field">
                    <label className="label">Template</label>
                    <select className="select" value={resumeTemplate} onChange={(e) => setResumeTemplate(e.target.value as ResumeTemplate)}>
                      {templateCatalog.map((meta) => (
                        <option key={meta.id} value={meta.id}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Title</label>
                    <input
                      className="input"
                      value={resumeTitle}
                      onChange={(e) => setResumeTitle(e.target.value)}
                      placeholder="Optional (e.g., SDE Intern Resume)"
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-primary" onClick={() => void generateResumeVersion()}>
                    Generate resume
                  </button>
                  <Link to="/job-seeker/resume-builder" className="btn">
                    Open resume builder
                  </Link>
                  <div className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                    Generate here quickly, or open Resume Builder for advanced editing and downloads.
                  </div>
                </div>

                {generatedResumes.length === 0 ? (
                  <div className="muted">No generated resumes yet.</div>
                ) : (
                  <div className="grid" style={{ gap: 10 }}>
                    {generatedResumes.map((gr) => {
                      const isPrimary = (profile.activeGeneratedResumeId ?? null) === gr.id;
                      return (
                        <div key={gr.id} className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "start" }}>
                            <div>
                              <div style={{ fontWeight: 900 }}>{gr.title}</div>
                              <div className="muted" style={{ fontSize: 13 }}>
                                Template: {gr.template} • Created: {new Date(gr.createdAt).toLocaleString()}
                              </div>
                            </div>
                            {isPrimary ? <span className="badge badge-accent">Primary</span> : <span className="badge">Version</span>}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" className="btn" onClick={() => void downloadGeneratedResumePdf(gr)}>
                              Download PDF
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => void setPrimaryGeneratedResume(gr.id)}
                              disabled={isPrimary}
                            >
                              Set primary
                            </button>
                            <button type="button" className="btn" onClick={() => void deleteGeneratedResume(gr.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {profile.activeGeneratedResumeId ? (
                      <button type="button" className="btn" onClick={() => void setPrimaryGeneratedResume(null)}>
                        Clear primary
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <ProfilePreviewCard profile={profile} completion={completion} hasResume={hasResume} onOpen={() => setPreviewOpen(true)} />

          <Card className="space-y-3">
            <div className="text-sm font-semibold">Profile readiness</div>
            <ProgressBar value={completion} />
            <div className="text-xs text-text-muted">
              Complete the tabs to unlock stronger job matches.
            </div>
          </Card>
        </div>
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">Full preview</h3>
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </div>
          <div className="mx-auto w-full max-w-[560px] rounded-2xl bg-white p-6 text-[#0F172A]">
            <div className="text-2xl font-semibold">{profile.fullName}</div>
            <div className="text-sm text-[#475569]">{profile.headline || "Add a headline"}</div>
            <div className="mt-2 text-xs text-[#64748B]">
              {(profile.location || "Location") + " · " + (profile.desiredRole || "Desired role")}
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#334155]">Summary</div>
              <div className="mt-2 text-sm text-[#1F2937]">{profile.about || "Add a summary."}</div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#334155]">Skills</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {(profile.skills ?? []).slice(0, 10).map((skill) => (
                  <span key={skill} className="rounded-full bg-[#E2E8F0] px-2 py-1">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#334155]">Experience</div>
              <div className="mt-2 text-sm text-[#1F2937]">
                {experience.length === 0 ? "Add experience items." : `${experience.length} role(s)`}
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#334155]">Education</div>
              <div className="mt-2 text-sm text-[#1F2937]">
                {education.length === 0 ? "Add education items." : `${education.length} record(s)`}
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#334155]">Projects</div>
              <div className="mt-2 text-sm text-[#1F2937]">
                {projects.length === 0 ? "Add projects to highlight work." : `${projects.length} project(s)`}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={summaryModalOpen} onClose={() => setSummaryModalOpen(false)}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-text">Generate Professional Summary</h3>
          <div className="text-sm text-text-secondary">Use your profile context and optional notes to draft a polished summary.</div>

          <div className="field">
            <label className="label">Extra notes for AI</label>
            <textarea
              className="input"
              style={{ minHeight: 90, resize: "vertical" }}
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              placeholder="Example: Focus on leadership and fintech roles."
            />
          </div>

          <div className="field">
            <label className="label">Generated summary</label>
            <textarea
              className="input"
              style={{ minHeight: 150, resize: "vertical" }}
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setSummaryDraft(generateSummaryFromProfile(profile, summaryNotes))}
            >
              Regenerate
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const next = { ...profile, about: summaryDraft || null };
                setProfile(next);
                scheduleSave(next);
                setSummaryModalOpen(false);
              }}
            >
              Accept
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SkillAdder({
  onAdd,
  placeholder,
}: {
  onAdd: (value: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <input
        className="input"
        style={{ flex: 1, minWidth: 220 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? "Add a skill (press Enter)"}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const next = value;
          setValue("");
          onAdd(next);
        }}
      />
      <button
        type="button"
        className="btn"
        onClick={() => {
          const next = value;
          setValue("");
          onAdd(next);
        }}
      >
        Add
      </button>
    </div>
  );
}

function EducationSection({
  items,
  onChange,
}: {
  items: EducationItem[];
  onChange: (items: EducationItem[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function add() {
    const next: EducationItem = {
      id: globalThis.crypto?.randomUUID?.() ?? uid("edu"),
      level: "BACHELOR",
      institution: "",
      degree: "",
      fieldOfStudy: "",
      awardingBody: null,
      startYear: new Date().getFullYear(),
      endYear: null,
      grade: null,
    };
    onChange([next, ...items]);
    setEditingId(next.id);
  }

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <SectionHeader title="Education" subtitle="Add your education history." />
        <button type="button" className="btn" onClick={add}>
          Add education
        </button>
      </div>

      {items.length === 0 ? <div className="muted">No education added yet.</div> : null}

      <div className="grid" style={{ gap: 10 }}>
        {items.map((it) => {
          const isEditing = editingId === it.id;
          return (
            <div key={it.id} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
              {!isEditing ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 900 }}>{it.institution || "(Institution)"}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {(it.degree || "(Degree)") + (it.fieldOfStudy ? ` • ${it.fieldOfStudy}` : "")}
                      </div>
                      {it.level ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          {EDUCATION_LEVEL_OPTIONS.find((x) => x.value === it.level)?.label ?? it.level}
                          {it.awardingBody ? ` • ${it.awardingBody}` : ""}
                        </div>
                      ) : null}
                      <div className="muted" style={{ fontSize: 13 }}>
                        {it.startYear} – {it.endYear ?? "Present"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn" onClick={() => setEditingId(it.id)}>
                        Edit
                      </button>
                      <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                        Remove
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-2">
                    <div className="field">
                      <label className="label">Education level</label>
                      <select
                        className="input"
                        value={it.level ?? "BACHELOR"}
                        onChange={(e) =>
                          onChange(items.map((x) => (x.id === it.id ? { ...x, level: e.target.value as EducationItem["level"] } : x)))
                        }
                      >
                        {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label">Institution</label>
                      <input
                        className="input"
                        value={it.institution}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, institution: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Degree</label>
                      <input
                        className="input"
                        value={it.degree}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, degree: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Field of study / stream</label>
                      <input
                        className="input"
                        value={it.fieldOfStudy}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, fieldOfStudy: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">{getEducationBodyLabel(it.level)}</label>
                      <input
                        className="input"
                        value={it.awardingBody ?? ""}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, awardingBody: e.target.value || null } : x)))}
                        placeholder={it.level === "SCHOOL" ? "CBSE, ICSE, State Board" : "Optional"}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Grade</label>
                      <input
                        className="input"
                        value={it.grade ?? ""}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, grade: e.target.value || null } : x)))}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="field">
                      <label className="label">Start year</label>
                      <input
                        className="input"
                        type="number"
                        min={1950}
                        max={2100}
                        value={it.startYear}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, startYear: Number(e.target.value) } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">End year</label>
                      <input
                        className="input"
                        type="number"
                        min={1950}
                        max={2100}
                        value={it.endYear ?? ""}
                        onChange={(e) =>
                          onChange(items.map((x) => (x.id === it.id ? { ...x, endYear: e.target.value ? Number(e.target.value) : null } : x)))
                        }
                        placeholder="Present"
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary" onClick={() => setEditingId(null)}>
                      Done
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExperienceSection({
  items,
  onImproveAI,
  onChange,
}: {
  items: ExperienceItem[];
  onImproveAI: (id: string) => void;
  onChange: (items: ExperienceItem[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function add() {
    const next: ExperienceItem = {
      id: globalThis.crypto?.randomUUID?.() ?? uid("exp"),
      company: "",
      title: "",
      location: null,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: null,
      summary: "",
    };
    onChange([next, ...items]);
    setEditingId(next.id);
  }

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <SectionHeader title="Experience" subtitle="Add internships, jobs, or volunteer roles." />
        <button type="button" className="btn" onClick={add}>
          Add experience
        </button>
      </div>
      {items.length === 0 ? <div className="muted">No experience added yet.</div> : null}

      <div className="grid" style={{ gap: 10 }}>
        {items.map((it) => {
          const isEditing = editingId === it.id;
          return (
            <div key={it.id} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
              {!isEditing ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>{it.title || "(Title)"}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {(it.company || "(Company)") + (it.location ? ` • ${it.location}` : "")}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {it.startDate} – {it.endDate ?? "Present"}
                    </div>
                    {it.summary ? <div className="muted" style={{ fontSize: 13 }}>{it.summary}</div> : null}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn" onClick={() => onImproveAI(it.id)}>
                      Improve with AI
                    </button>
                    <button type="button" className="btn" onClick={() => setEditingId(it.id)}>
                      Edit
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-2">
                    <div className="field">
                      <label className="label">Title</label>
                      <input
                        className="input"
                        value={it.title}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Company</label>
                      <input
                        className="input"
                        value={it.company}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, company: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Location</label>
                      <SearchableLocationInput
                        className="input"
                        value={it.location ?? ""}
                        onChange={(value) => onChange(items.map((x) => (x.id === it.id ? { ...x, location: value || null } : x)))}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="field">
                      <label className="label">Start date</label>
                      <input
                        className="input"
                        type="date"
                        value={it.startDate.slice(0, 10)}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, startDate: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">End date</label>
                      <input
                        className="input"
                        type="date"
                        value={it.endDate ? it.endDate.slice(0, 10) : ""}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, endDate: e.target.value || null } : x)))}
                        placeholder="Present"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Summary</label>
                    <textarea
                      className="input"
                      style={{ minHeight: 90, resize: "vertical" }}
                      value={it.summary}
                      onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, summary: e.target.value } : x)))}
                      placeholder="What did you do? What impact did you create?"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary" onClick={() => setEditingId(null)}>
                      Done
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectsSection({
  items,
  onImproveAI,
  onChange,
}: {
  items: ProjectItem[];
  onImproveAI: (id: string) => void;
  onChange: (items: ProjectItem[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState<Record<string, string>>({});

  function add() {
    const next: ProjectItem = {
      id: globalThis.crypto?.randomUUID?.() ?? uid("prj"),
      name: "",
      link: null,
      summary: "",
      skills: [],
    };
    onChange([next, ...items]);
    setEditingId(next.id);
  }

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <SectionHeader title="Projects" subtitle="Showcase real work with links and technologies." />
        <button type="button" className="btn" onClick={add}>
          Add project
        </button>
      </div>
      {items.length === 0 ? <div className="muted">No projects added yet.</div> : null}

      <div className="grid" style={{ gap: 10 }}>
        {items.map((it) => {
          const isEditing = editingId === it.id;
          return (
            <div key={it.id} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
              {!isEditing ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>{it.name || "(Project name)"}</div>
                    {it.link ? (
                      <div className="muted" style={{ fontSize: 13 }}>
                        {it.link}
                      </div>
                    ) : null}
                    {it.summary ? <div className="muted" style={{ fontSize: 13 }}>{it.summary}</div> : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {it.skills.map((s) => (
                        <Chip key={`${it.id}_${s.toLowerCase()}`} label={s} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn" onClick={() => onImproveAI(it.id)}>
                      Improve with AI
                    </button>
                    <button type="button" className="btn" onClick={() => setEditingId(it.id)}>
                      Edit
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-2">
                    <div className="field">
                      <label className="label">Project name</label>
                      <input
                        className="input"
                        value={it.name}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">GitHub link</label>
                      <input
                        className="input"
                        value={it.link ?? ""}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, link: e.target.value || null } : x)))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Description</label>
                    <textarea
                      className="input"
                      style={{ minHeight: 90, resize: "vertical" }}
                      value={it.summary}
                      onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, summary: e.target.value } : x)))}
                      placeholder="What is it? What did you build?"
                    />
                  </div>
                  <div className="field">
                    <label className="label">Technologies</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {it.skills.map((s) => (
                        <Chip
                          key={`${it.id}_${s.toLowerCase()}`}
                          label={s}
                          onRemove={() =>
                            onChange(
                              items.map((x) =>
                                x.id === it.id ? { ...x, skills: removeCaseInsensitive(x.skills, s) } : x
                              )
                            )
                          }
                        />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                      <input
                        className="input"
                        style={{ flex: 1, minWidth: 220 }}
                        value={skillDraft[it.id] ?? ""}
                        onChange={(e) => setSkillDraft((m) => ({ ...m, [it.id]: e.target.value }))}
                        placeholder="Add a skill (press Enter)"
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const v = skillDraft[it.id] ?? "";
                          setSkillDraft((m) => ({ ...m, [it.id]: "" }));
                          onChange(items.map((x) => (x.id === it.id ? { ...x, skills: addUniqueCaseInsensitive(x.skills, v) } : x)));
                        }}
                      />
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          const v = skillDraft[it.id] ?? "";
                          setSkillDraft((m) => ({ ...m, [it.id]: "" }));
                          onChange(items.map((x) => (x.id === it.id ? { ...x, skills: addUniqueCaseInsensitive(x.skills, v) } : x)));
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary" onClick={() => setEditingId(null)}>
                      Done
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CertificationsSection({
  items,
  onChange,
}: {
  items: CertificationItem[];
  onChange: (items: CertificationItem[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [verificationMode, setVerificationMode] = useState<Record<string, "URL" | "UPLOAD">>({});

  function getMode(item: CertificationItem) {
    return verificationMode[item.id] ?? (item.credentialUrl?.startsWith("uploaded:") ? "UPLOAD" : "URL");
  }

  function add() {
    const next: CertificationItem = {
      id: globalThis.crypto?.randomUUID?.() ?? uid("crt"),
      name: "",
      issuer: "",
      issuedOn: new Date().toISOString().slice(0, 10),
      expiresOn: null,
      credentialUrl: null,
    };
    onChange([next, ...items]);
    setEditingId(next.id);
  }

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <SectionHeader title="Certifications" subtitle="Add certificates and credentials." />
        <button type="button" className="btn" onClick={add}>
          Add certification
        </button>
      </div>
      {items.length === 0 ? <div className="muted">No certifications added yet.</div> : null}

      <div className="grid" style={{ gap: 10 }}>
        {items.map((it) => {
          const isEditing = editingId === it.id;
          return (
            <div key={it.id} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
              {!isEditing ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>{it.name || "(Certification)"}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {(it.issuer || "(Issuer)") + ` • ${it.issuedOn}`}
                    </div>
                    {it.credentialUrl ? (
                      <div className="muted" style={{ fontSize: 13 }}>
                        {it.credentialUrl.startsWith("uploaded:")
                          ? `Uploaded proof: ${it.credentialUrl.replace("uploaded:", "")}`
                          : it.credentialUrl}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn" onClick={() => setEditingId(it.id)}>
                      Edit
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-2">
                    <div className="field">
                      <label className="label">Name</label>
                      <input
                        className="input"
                        value={it.name}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Issuer</label>
                      <input
                        className="input"
                        value={it.issuer}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, issuer: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Issued on</label>
                      <input
                        className="input"
                        type="date"
                        value={it.issuedOn.slice(0, 10)}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, issuedOn: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Expires on</label>
                      <input
                        className="input"
                        type="date"
                        value={it.expiresOn ? it.expiresOn.slice(0, 10) : ""}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, expiresOn: e.target.value || null } : x)))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="field" style={{ display: "grid", gap: 8 }}>
                    <label className="label">Verification method</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className={`btn ${getMode(it) === "URL" ? "btn-primary" : ""}`}
                        aria-pressed={getMode(it) === "URL"}
                        onClick={() => setVerificationMode((prev) => ({ ...prev, [it.id]: "URL" }))}
                      >
                        URL
                      </button>
                      <button
                        type="button"
                        className={`btn ${getMode(it) === "UPLOAD" ? "btn-primary" : ""}`}
                        aria-pressed={getMode(it) === "UPLOAD"}
                        onClick={() => setVerificationMode((prev) => ({ ...prev, [it.id]: "UPLOAD" }))}
                      >
                        Upload proof
                      </button>
                    </div>

                    {getMode(it) === "URL" ? (
                      <input
                        className="input"
                        value={it.credentialUrl?.startsWith("uploaded:") ? "" : it.credentialUrl ?? ""}
                        onChange={(e) =>
                          onChange(items.map((x) => (x.id === it.id ? { ...x, credentialUrl: e.target.value || null } : x)))
                        }
                        placeholder="https://credential-link"
                      />
                    ) : (
                      <input
                        className="input"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          onChange(items.map((x) => (x.id === it.id ? { ...x, credentialUrl: `uploaded:${file.name}` } : x)));
                        }}
                      />
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary" onClick={() => setEditingId(null)}>
                      Done
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AchievementsSection({
  items,
  onChange,
}: {
  items: AchievementItem[];
  onChange: (items: AchievementItem[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function add() {
    const next: AchievementItem = {
      id: globalThis.crypto?.randomUUID?.() ?? uid("ach"),
      title: "",
      description: "",
      date: null,
    };
    onChange([next, ...items]);
    setEditingId(next.id);
  }

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <SectionHeader title="Achievements" subtitle="Awards, recognitions, results." />
        <button type="button" className="btn" onClick={add}>
          Add achievement
        </button>
      </div>
      {items.length === 0 ? <div className="muted">No achievements added yet.</div> : null}
      <div className="grid" style={{ gap: 10 }}>
        {items.map((it) => {
          const isEditing = editingId === it.id;
          return (
            <div key={it.id} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
              {!isEditing ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>{it.title || "(Achievement)"}</div>
                    {it.date ? <div className="muted" style={{ fontSize: 13 }}>{it.date}</div> : null}
                    {it.description ? <div className="muted" style={{ fontSize: 13 }}>{it.description}</div> : null}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn" onClick={() => setEditingId(it.id)}>
                      Edit
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-2">
                    <div className="field">
                      <label className="label">Title</label>
                      <input
                        className="input"
                        value={it.title}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Date</label>
                      <input
                        className="input"
                        type="date"
                        value={it.date ? it.date.slice(0, 10) : ""}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, date: e.target.value || null } : x)))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Description</label>
                    <textarea
                      className="input"
                      style={{ minHeight: 90, resize: "vertical" }}
                      value={it.description}
                      onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, description: e.target.value } : x)))}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary" onClick={() => setEditingId(null)}>
                      Done
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LanguagesSection({
  items,
  onChange,
}: {
  items: LanguageItem[];
  onChange: (items: LanguageItem[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function add() {
    const next: LanguageItem = {
      id: uid("lng"),
      name: "",
      proficiency: "INTERMEDIATE",
    };
    onChange([next, ...items]);
    setEditingId(next.id);
  }

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <SectionHeader title="Languages" subtitle="Add languages and proficiency." />
        <button type="button" className="btn" onClick={add}>
          Add language
        </button>
      </div>
      {items.length === 0 ? <div className="muted">No languages added yet.</div> : null}
      <div className="grid" style={{ gap: 10 }}>
        {items.map((it) => {
          const isEditing = editingId === it.id;
          return (
            <div key={it.id} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
              {!isEditing ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>{it.name || "(Language)"}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{it.proficiency}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn" onClick={() => setEditingId(it.id)}>
                      Edit
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-2">
                    <div className="field">
                      <label className="label">Language</label>
                      <input
                        className="input"
                        value={it.name}
                        onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Proficiency</label>
                      <select
                        className="select"
                        value={it.proficiency}
                        onChange={(e) =>
                          onChange(
                            items.map((x) =>
                              x.id === it.id ? { ...x, proficiency: e.target.value as any } : x
                            )
                          )
                        }
                      >
                        <option value="BEGINNER">Basic</option>
                        <option value="INTERMEDIATE">Conversational</option>
                        <option value="ADVANCED">Fluent</option>
                        <option value="NATIVE">Native</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary" onClick={() => setEditingId(null)}>
                      Done
                    </button>
                    <button type="button" className="btn" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
