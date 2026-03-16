import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiJson, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { RecruiterProfile } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { PageSkeleton } from "../../components/ui/PageSkeleton";
import { SearchableLocationInput } from "../../components/ui/SearchableLocationInput";

type ExtraProfile = {
  logoUrl: string;
  companySize: string;
  linkedinUrl: string;
  twitterUrl: string;
};

const EXTRA_PROFILE_STORAGE_KEY = "hireflow_recruiter_profile_extra";

export function RecruiterProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [extra, setExtra] = useState<ExtraProfile>({
    logoUrl: "",
    companySize: "",
    linkedinUrl: "",
    twitterUrl: "",
  });

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        setError(null);
        const data = await apiJson<{ profile: RecruiterProfile }>("/recruiter/profile", { token });
        setProfile(data.profile);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load company profile");
      }
    })();
  }, [token]);

  useEffect(() => {
    const raw = window.localStorage.getItem(EXTRA_PROFILE_STORAGE_KEY);
    if (!raw) return;
    try {
      setExtra(JSON.parse(raw) as ExtraProfile);
    } catch {
      window.localStorage.removeItem(EXTRA_PROFILE_STORAGE_KEY);
    }
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!token || !profile) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const data = await apiJson<{ profile: RecruiterProfile }>("/recruiter/profile", {
        method: "PATCH", token,
        body: {
          companyName: profile.companyName,
          website: profile.website,
          location: profile.location,
          description: profile.description,
        },
      });
      setProfile(data.profile);
      window.localStorage.setItem(EXTRA_PROFILE_STORAGE_KEY, JSON.stringify(extra));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to update company profile");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors";
  const labelCls = "text-xs font-medium text-[var(--muted)] mb-1.5 block";

  if (!profile && !error) return <PageSkeleton rows={2} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Company Profile</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Keep your company information up to date.</p>
        </div>
        {saved && <Badge variant="teal" className="animate-fade-in-up">Saved</Badge>}
      </div>

      {error && <Card className="border-[var(--danger)]/30 p-4 text-sm text-[var(--danger)]">{error}</Card>}

      {profile && (
        <form onSubmit={onSave}>
          <Card className="p-6 space-y-5">
            <fieldset disabled={busy} className="space-y-5 disabled:cursor-not-allowed disabled:opacity-80">
            {/* Company avatar */}
            <div className="flex items-center gap-4">
              {extra.logoUrl ? (
                <img
                  src={extra.logoUrl}
                  alt="Company logo"
                  className="h-14 w-14 rounded-2xl border border-[var(--border)] object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-teal)]/10 flex items-center justify-center text-xl font-bold text-[var(--accent)]">
                  {profile.companyName?.[0]?.toUpperCase() ?? "C"}
                </div>
              )}
              <div>
                <div className="text-base font-semibold text-[var(--text)]">{profile.companyName || "Company Name"}</div>
                <div className="text-xs text-[var(--muted)]">
                  {(profile.location || "Location not set") + (extra.companySize ? ` • ${extra.companySize}` : "")}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Company Name</label>
                <input className={inputCls} value={profile.companyName} onChange={(e) => setProfile({ ...profile, companyName: e.target.value })} required />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input className={inputCls} value={profile.website ?? ""} onChange={(e) => setProfile({ ...profile, website: e.target.value || null })} placeholder="https://..." />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Location</label>
                <SearchableLocationInput
                  className={inputCls}
                  value={profile.location ?? ""}
                  onChange={(value) => setProfile({ ...profile, location: value || null })}
                  placeholder="San Francisco, United States"
                />
              </div>
              <div>
                <label className={labelCls}>Logo URL</label>
                <input
                  className={inputCls}
                  value={extra.logoUrl}
                  onChange={(e) => setExtra({ ...extra, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div>
                <label className={labelCls}>Company Size</label>
                <input
                  className={inputCls}
                  value={extra.companySize}
                  onChange={(e) => setExtra({ ...extra, companySize: e.target.value })}
                  placeholder="51-200 employees"
                />
              </div>
              <div>
                <label className={labelCls}>LinkedIn URL</label>
                <input
                  className={inputCls}
                  value={extra.linkedinUrl}
                  onChange={(e) => setExtra({ ...extra, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
              <div>
                <label className={labelCls}>X / Twitter URL</label>
                <input
                  className={inputCls}
                  value={extra.twitterUrl}
                  onChange={(e) => setExtra({ ...extra, twitterUrl: e.target.value })}
                  placeholder="https://x.com/..."
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] min-h-[120px] resize-y"
                value={profile.description ?? ""}
                onChange={(e) => setProfile({ ...profile, description: e.target.value || null })}
                placeholder="What your company does, your mission, and work culture..."
              />
            </div>

            <Button variant="primary" type="submit" loading={busy}>
              {busy ? "Saving..." : "Save Profile"}
            </Button>
            </fieldset>
          </Card>
        </form>
      )}
    </div>
  );
}
