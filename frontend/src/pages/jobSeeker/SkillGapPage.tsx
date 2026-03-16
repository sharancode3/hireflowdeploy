import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Job, JobSeekerProfile } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { PageSkeleton } from "../../components/ui/PageSkeleton";
import { EmptyState } from "../../components/ui/EmptyState";

/* ─── Estimated learning times (weeks) ─── */
const LEARNING_TIME: Record<string, number> = {
  React: 4, TypeScript: 3, "Node.js": 4, Express: 2, SQL: 3, MongoDB: 2,
  Java: 6, Python: 4, Django: 3, Flask: 2, AWS: 5, Azure: 5, Docker: 3,
  Kubernetes: 4, Figma: 2, "UI Design": 4, "Data Analysis": 3, "Power BI": 2,
  Excel: 1, Communication: 2, DSA: 6, "Next.js": 3, Tailwind: 1, Testing: 3,
};

export function SkillGapPage() {
  const { token } = useAuth();
  const LEARNING_KEY = "hireflow_learning";
  const LEGACY_LEARNING_KEY = "talvion_learning";
  const [profile, setProfile] = useState<JobSeekerProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetRole, setTargetRole] = useState("");
  const [learning, setLearning] = useState<Set<string>>(() => {
    try {
      const current = localStorage.getItem(LEARNING_KEY);
      if (current) return new Set(JSON.parse(current));
      const legacy = localStorage.getItem(LEGACY_LEARNING_KEY);
      if (legacy) {
        localStorage.setItem(LEARNING_KEY, legacy);
        return new Set(JSON.parse(legacy));
      }
      return new Set();
    } catch {
      return new Set();
    }
  });
  const [addSkillModal, setAddSkillModal] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const [p, j] = await Promise.all([
          apiJson<{ profile: JobSeekerProfile }>("/job-seeker/profile", { token }),
          apiJson<{ jobs: Job[] }>("/jobs", { token }),
        ]);
        setProfile(p.profile);
        setJobs(j.jobs);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [token]);

  /* All unique role titles */
  const roles = useMemo(() => Array.from(new Set(jobs.map((j) => j.title))).sort(), [jobs]);

  /* Top 10 skills for selected role */
  const roleSkills = useMemo(() => {
    if (!targetRole) return [];
    const matching = jobs.filter((j) => j.title === targetRole);
    const freq = new Map<string, number>();
    for (const j of matching) {
      for (const s of j.requiredSkills) {
        freq.set(s, (freq.get(s) ?? 0) + 1);
      }
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));
  }, [targetRole, jobs]);

  const userSkillsSet = useMemo(() => new Set((profile?.skills ?? []).map((s) => s.toLowerCase())), [profile]);

  const hasSkill = useCallback((skill: string) => userSkillsSet.has(skill.toLowerCase()), [userSkillsSet]);

  const missingSkills = useMemo(() => roleSkills.filter((r) => !hasSkill(r.skill)), [hasSkill, roleSkills]);

  const matchedSkills = useMemo(() => roleSkills.filter((r) => hasSkill(r.skill)), [hasSkill, roleSkills]);

  const toggleLearning = useCallback((skill: string) => {
    setLearning((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill); else next.add(skill);
      localStorage.setItem(LEARNING_KEY, JSON.stringify([...next]));
      localStorage.removeItem(LEGACY_LEARNING_KEY);
      return next;
    });
  }, []);

  const addSkillToProfile = useCallback(async (skill: string) => {
    if (!token || !profile) return;
    setAdding(true);
    try {
      const updated = [...(profile.skills ?? []), skill];
      const res = await apiJson<{ profile: JobSeekerProfile }>("/job-seeker/profile", {
        method: "PATCH", token, body: { skills: updated } as any,
      });
      setProfile(res.profile);
      setAddSkillModal(null);
    } catch { /* ignore */ }
    setAdding(false);
  }, [profile, token]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Skill Gap Analyzer</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Compare your skills against any role and build a roadmap to close the gap.
        </p>
        {targetRole && missingSkills.length > 0 && (
          <div className="mt-3">
            <Badge variant="amber">
              {missingSkills.length} skill{missingSkills.length !== 1 ? "s" : ""} away from {targetRole}
            </Badge>
          </div>
        )}
      </Card>

      {/* Two panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Your Skills */}
        <Card>
          <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Your Skills</h2>
          {(profile?.skills ?? []).length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No skills on your profile yet. Visit your Profile to add some.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(profile?.skills ?? []).map((s) => (
                <span
                  key={s}
                  className="rounded-full px-3 py-1 text-xs font-medium border"
                  style={{
                    borderColor: learning.has(s) ? "var(--accent)" : "var(--border)",
                    background: learning.has(s) ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface-raised)",
                    color: "var(--text)",
                  }}
                >
                  {learning.has(s) && <span className="mr-1">🔵</span>}
                  {s}
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Right: Target Role */}
        <Card>
          <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Target Role</h2>
          <select
            className="input-base w-full"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          >
            <option value="">Choose a role…</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          {targetRole && roleSkills.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-[var(--muted)] uppercase tracking-wider">Top skills for {targetRole}</div>
              <div className="flex flex-wrap gap-2">
                {roleSkills.map(({ skill, count }) => {
                  const has = hasSkill(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                        has
                          ? "border-[#22c55e]/50 bg-[#22c55e]/10 text-[#22c55e]"
                          : "border-[#ef4444]/50 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20"
                      }`}
                      onClick={() => { if (!has) setAddSkillModal(skill); }}
                    >
                      {has ? "✓" : "+"} {skill}
                      <span className="ml-1 opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {targetRole && roleSkills.length === 0 && (
            <p className="mt-4 text-xs text-[var(--muted)]">No skill data available for this role.</p>
          )}
        </Card>
      </div>

      {/* Learning Roadmap */}
      {targetRole && missingSkills.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">Learning Roadmap</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missingSkills.map(({ skill, count }) => {
              const weeks = LEARNING_TIME[skill] ?? 3;
              const isLearning = learning.has(skill);
              return (
                <Card key={skill} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text)]">{skill}</span>
                    {isLearning && <span className="text-xs text-[var(--accent)]">🔵 Learning</span>}
                  </div>
                  <div className="space-y-1 text-xs text-[var(--muted)]">
                    <div>Required by <span className="text-[var(--text)]">{count}</span> job{count > 1 ? "s" : ""}</div>
                    <div>Estimated: <span className="text-[var(--text)]">{weeks} week{weeks > 1 ? "s" : ""}</span></div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={isLearning ? "primary" : "secondary"}
                      className="text-xs flex-1"
                      onClick={() => toggleLearning(skill)}
                    >
                      {isLearning ? "Unmark" : "Mark as learning"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => setAddSkillModal(skill)}
                    >
                      Add to profile
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {targetRole && missingSkills.length === 0 && matchedSkills.length > 0 && (
        <Card className="text-center py-8">
          <div className="text-3xl mb-2">🎉</div>
          <h3 className="text-sm font-semibold text-[var(--text)]">You have all the top skills!</h3>
          <p className="text-xs text-[var(--muted)] mt-1">You&apos;re a strong match for {targetRole} positions.</p>
        </Card>
      )}

      {!targetRole && (
        <EmptyState
          title="Select a target role"
          description="Pick a role above to see which skills you need to learn."
        />
      )}

      {/* Add skill modal */}
      <Modal open={Boolean(addSkillModal)} onClose={() => setAddSkillModal(null)}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text)]">Add "{addSkillModal}" to your profile?</h3>
          <p className="text-sm text-[var(--muted)]">This will appear on your profile and improve your match scores.</p>
          <div className="flex gap-2">
            <Button variant="primary" loading={adding} onClick={() => addSkillModal && addSkillToProfile(addSkillModal)}>
              Add Skill
            </Button>
            <Button variant="secondary" onClick={() => setAddSkillModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
