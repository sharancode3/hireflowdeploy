import { useEffect, useMemo, useState } from "react";
import { apiJson, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { JobSeekerProfile, RecruiterProfile } from "../types";
import { loadUserSettings, saveUserSettings, type UserSettings } from "../data/settings";
import { useTheme } from "../theme/ThemeContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";

/* ─── icons ─────────────────────────────────────────── */
function IconPalette() {
  return <svg width="18" height="18" fill="none" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="9" r="7"/><circle cx="9" cy="5" r="1.2" fill="currentColor"/><circle cx="5.5" cy="8" r="1.2" fill="currentColor"/><circle cx="7" cy="12" r="1.2" fill="currentColor"/></svg>;
}
function IconShield() {
  return <svg width="18" height="18" fill="none" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.5"><path d="M9 2L3 5v4c0 3.6 2.6 6.7 6 7.5 3.4-.8 6-3.9 6-7.5V5L9 2z"/></svg>;
}
function IconBell() {
  return <svg width="18" height="18" fill="none" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.5"><path d="M7 14a2 2 0 0 0 4 0M4.5 11c0 0-.5-1-.5-3.5C4 4.5 6.2 3 9 3s5 1.5 5 4.5c0 2.5-.5 3.5-.5 3.5H4.5z"/></svg>;
}
function IconFile() {
  return <svg width="18" height="18" fill="none" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.5"><path d="M5 2h5.5L14 5.5V16H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M10 2v4h4"/></svg>;
}
function IconBriefcase() {
  return <svg width="18" height="18" fill="none" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="14" height="9" rx="1.5"/><path d="M6 6V4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 12 4.5V6"/></svg>;
}
function IconUser() {
  return <svg width="18" height="18" fill="none" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="6" r="3"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>;
}
function IconLink() {
  return <svg width="18" height="18" fill="none" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.5"><path d="M7.5 10.5l3-3M6 12a3 3 0 0 1 0-4.24l1.5-1.5M12 6a3 3 0 0 1 0 4.24l-1.5 1.5"/></svg>;
}
function IconChevron({ open }: { open: boolean }) {
  return <svg width="16" height="16" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}><path d="M4 6l4 4 4-4"/></svg>;
}

/* ─── toggle switch ─────────────────────────────────── */
function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group py-1.5">
      <div>
        <div className="text-sm text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">{label}</div>
        {desc && <div className="text-[10px] text-[var(--muted)] mt-0.5">{desc}</div>}
      </div>
      <button type="button" onClick={() => onChange(!checked)} className="relative shrink-0" role="switch" aria-checked={checked} aria-label={label}>
        <div className={`h-5 w-9 rounded-full transition-colors ${checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
        <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </button>
    </label>
  );
}

/* ─── accordion section ─────────────────────────────── */
function SettingsSection({ icon, title, desc, children, defaultOpen = false }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-5 text-left hover:bg-[var(--surface-raised)]/50 transition-colors"
      >
        <div className="rounded-lg p-2 bg-[var(--accent)]/10 text-[var(--accent)]">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
          <div className="text-xs text-[var(--muted)]">{desc}</div>
        </div>
        <IconChevron open={open} />
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-5 py-4 space-y-4">
          {children}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ═══  MAIN PAGE  ══════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════ */
export function SettingsPage() {
  const { token, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [jsProfile, setJsProfile] = useState<JobSeekerProfile | null>(null);
  const [recProfile, setRecProfile] = useState<RecruiterProfile | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isJobSeeker = user?.role === "JOB_SEEKER";
  const isRecruiter = user?.role === "RECRUITER";

  useEffect(() => {
    if (!user) return;
    setSettings(loadUserSettings(user.id));
  }, [user]);

  useEffect(() => {
    (async () => {
      if (!token || !user) return;
      try {
        setError(null);
        if (user.role === "JOB_SEEKER") {
          const p = await apiJson<{ profile: JobSeekerProfile }>("/job-seeker/profile", { token });
          setJsProfile(p.profile);
        }
        if (user.role === "RECRUITER") {
          const p = await apiJson<{ profile: RecruiterProfile }>("/recruiter/profile", { token });
          setRecProfile(p.profile);
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
          setError(null);
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to load settings");
      }
    })();
  }, [token, user]);

  const visibility = useMemo(() => {
    if (isJobSeeker) return jsProfile?.visibility ?? "PUBLIC";
    return "PUBLIC";
  }, [isJobSeeker, jsProfile]);

  async function saveVisibility(next: "PUBLIC" | "PRIVATE") {
    if (!token || !user || user.role !== "JOB_SEEKER") return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiJson<{ profile: JobSeekerProfile }>("/job-seeker/profile", {
        method: "PATCH",
        token,
        body: { visibility: next },
      });
      setJsProfile(updated.profile);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        setJsProfile((prev) => (prev ? { ...prev, visibility: next } : prev));
        return;
      }
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to update visibility");
    } finally {
      setBusy(false);
    }
  }

  function updateSettings(mutator: (s: UserSettings) => UserSettings) {
    if (!user || !settings) return;
    const next = mutator(settings);
    setSettings(next);
    saveUserSettings(user.id, next);
  }

  if (!user || !settings) {
    return (
      <div className="flex-1 px-8 py-6">
        <div className="mx-auto max-w-[700px] space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--surface)]" />)}
        </div>
      </div>
    );
  }

  const themes: { value: typeof theme; label: string; desc: string }[] = [
    { value: "light", label: "Light", desc: "Clean & bright" },
    { value: "soft-dark", label: "Soft Dark", desc: "Easy on the eyes" },
    { value: "high-contrast", label: "High Contrast", desc: "Maximum clarity" },
  ];

  return (
    <div className="flex-1 px-8 py-6">
      <div className="mx-auto max-w-[700px] space-y-4">

        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Changes save instantly and persist across sessions.</p>
        </div>

        {error && <Card className="p-4 border-[var(--danger)]/30 text-sm text-[var(--danger)]">{error}</Card>}

        {/* ① Appearance */}
        <SettingsSection icon={<IconPalette />} title="Appearance" desc="Theme & display preferences" defaultOpen>
          <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Theme</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {themes.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setTheme(t.value); updateSettings(s => ({ ...s, theme: t.value })); }}
                aria-pressed={theme === t.value}
                className={`rounded-xl border p-3 transition-all text-left ${theme === t.value ? "border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]/30" : "border-[var(--border)] hover:border-[var(--border-active)]"}`}
              >
                <div className="text-sm font-medium text-[var(--text)]">{t.label}</div>
                <div className="text-[10px] text-[var(--muted)]">{t.desc}</div>
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* ② Privacy */}
        <SettingsSection icon={<IconShield />} title="Privacy" desc="Profile visibility & data controls">
          {isJobSeeker ? (
            <div className="space-y-3">
              <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Profile Visibility</div>
              <p className="text-xs text-[var(--text-secondary)]">Public profiles can be discovered by recruiters. Private profiles are hidden from browsing.</p>
              <div className="flex gap-2">
                <Button
                  variant={visibility === "PUBLIC" ? "primary" : "secondary"}
                  disabled={busy}
                  onClick={() => void saveVisibility("PUBLIC")}
                  className="text-xs"
                >
                  Public
                </Button>
                <Button
                  variant={visibility === "PRIVATE" ? "primary" : "secondary"}
                  disabled={busy}
                  onClick={() => void saveVisibility("PRIVATE")}
                  className="text-xs"
                >
                  Private
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">Recruiter profiles are always public in this demo.</p>
          )}
        </SettingsSection>

        {/* ③ Notifications */}
        <SettingsSection icon={<IconBell />} title="Notifications" desc="Manage what alerts you receive">
          <Toggle
            checked={settings.notifications.applicationUpdates}
            onChange={(v) => updateSettings(s => ({ ...s, notifications: { ...s.notifications, applicationUpdates: v } }))}
            label="Application updates"
            desc="When your application status changes"
          />
          <Toggle
            checked={settings.notifications.productUpdates}
            onChange={(v) => updateSettings(s => ({ ...s, notifications: { ...s.notifications, productUpdates: v } }))}
            label="Product updates"
            desc="New features and announcements"
          />
        </SettingsSection>

        {/* ④ Resume Defaults */}
        <SettingsSection icon={<IconFile />} title="Resume Defaults" desc="Default template & preferences">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Default Template</label>
              <select
                value={settings.resume.defaultTemplate}
                onChange={(e) => updateSettings(s => ({ ...s, resume: { ...s.resume, defaultTemplate: e.target.value as any } }))}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="ats-plain">ATS Classic</option>
                <option value="classic">Modern Split</option>
                <option value="minimal">Creative Card</option>
                <option value="modern">Minimal Prose</option>
                <option value="tech-focused">Tech-Focused</option>
                <option value="executive">Executive</option>
                <option value="startup">Startup / Product</option>
                <option value="academic">Academic</option>
              </select>
            </div>
            <Toggle
              checked={settings.account.rememberFilters}
              onChange={(v) => updateSettings(s => ({ ...s, account: { ...s.account, rememberFilters: v } }))}
              label="Remember filters"
              desc="Persist search filters between sessions"
            />
          </div>
        </SettingsSection>

        {/* ⑤ Job Preferences (job seeker only) */}
        {isJobSeeker && (
          <SettingsSection icon={<IconBriefcase />} title="Job Preferences" desc="Used to improve job matching">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              These preferences are pulled from your profile. To update them, visit your
              <a href="/job-seeker/profile" className="text-[var(--accent)] hover:underline ml-1">Profile Builder</a>.
            </p>
            <div className="grid grid-cols-1 gap-3 mt-2 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Desired Role</div>
                <div className="text-sm text-[var(--text)] font-medium mt-1">{jsProfile?.desiredRole || "Not set"}</div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Location</div>
                <div className="text-sm text-[var(--text)] font-medium mt-1">{jsProfile?.location || "Not set"}</div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Experience</div>
                <div className="text-sm text-[var(--text)] font-medium mt-1">{jsProfile?.isFresher ? "Fresher" : `${jsProfile?.experienceYears ?? 0} years`}</div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Skills</div>
                <div className="text-sm text-[var(--text)] font-medium mt-1">{jsProfile?.skills?.length ? `${jsProfile.skills.length} skills` : "None"}</div>
              </div>
            </div>
          </SettingsSection>
        )}

        {/* ⑥ Account */}
        <SettingsSection icon={<IconUser />} title="Account" desc="Profile info & danger zone">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-sm font-bold text-[var(--accent)]">
                {user.email[0].toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">{user.email}</div>
                <div className="text-xs text-[var(--muted)]">
                  {user.role === "JOB_SEEKER" ? "Job Seeker" : "Recruiter"}
                  {isRecruiter && recProfile ? ` • ${recProfile.companyName}` : ""}
                  {isJobSeeker && jsProfile ? ` • ${jsProfile.fullName}` : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button variant="secondary" onClick={logout}>Log out</Button>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>Delete Account</Button>
          </div>
        </SettingsSection>

        {/* ⑦ Integrations */}
        <SettingsSection icon={<IconLink />} title="Integrations" desc="Connect external services">
          <div className="space-y-3">
            {[
              { name: "LinkedIn", desc: "Import profile data", connected: false },
              { name: "GitHub", desc: "Show repositories & contributions", connected: false },
              { name: "Portfolio", desc: "Link your personal website", connected: false },
            ].map(int => (
              <div key={int.name} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
                <div>
                  <div className="text-sm font-medium text-[var(--text)]">{int.name}</div>
                  <div className="text-[10px] text-[var(--muted)]">{int.desc}</div>
                </div>
                <Button variant={int.connected ? "ghost" : "secondary"} className="text-xs">
                  {int.connected ? "Connected" : "Connect"}
                </Button>
              </div>
            ))}
          </div>
        </SettingsSection>
      </div>

      {/* Delete Account Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-2">Delete Account?</h2>
        <p className="text-sm text-[var(--muted)] mb-6">
          This will permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setShowDeleteModal(false); logout(); }}>Delete Account</Button>
        </div>
      </Modal>
    </div>
  );
}
