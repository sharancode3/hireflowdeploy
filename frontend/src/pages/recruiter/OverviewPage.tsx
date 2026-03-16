import { useEffect, useState } from "react";
import { apiJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { PageSkeleton } from "../../components/ui/PageSkeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { DualLineChart } from "../../components/Charts";
import { useCountUp } from "../../hooks/useCountUp";
import type { ApplicationWithJob } from "../../types";

/* ── types ── */
type Funnel = { applied: number; shortlisted: number; interview: number; offered: number; hired: number };
type Weekly = { labels: string[]; views: number[]; applications: number[] };
type TopJob = { title: string; company: string; applicants: number } | null;

type Overview = {
  jobsCount: number;
  applicationsTotal: number;
  shortlisted: number;
  rejected: number;
  interviews: number;
  offered: number;
  hired: number;
  funnel: Funnel;
  weekly: Weekly;
  topJob: TopJob;
  avgTimeToHire: number;
  qualityScore: number;
};

/* ── icons ── */
function IconBriefcase() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="14" height="10" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
}
function IconUsers() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="3"/><circle cx="14" cy="8" r="2.5"/><path d="M1 17c0-3 2.7-5 6-5s6 2 6 5M14 11c2.2 0 4 1.3 4 3.5"/></svg>;
}
function IconStar() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5"><path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.5L10 14.7 5.1 17.2l.9-5.5-4-3.9 5.5-.8z"/></svg>;
}
function IconCalendar() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="14" height="14" rx="2"/><path d="M7 2v3M13 2v3M3 9h14"/></svg>;
}
function IconTrophy() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5"><path d="M6 3h8v5a4 4 0 0 1-8 0V3z"/><path d="M6 5H4a2 2 0 0 0 0 4h2m8-4h2a2 2 0 0 1 0 4h-2"/><path d="M8 14h4m-2-6v6m-3 3h6"/></svg>;
}
function IconClock() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2.5"/></svg>;
}

/* ── stat card with count-up ── */
function StatCard({ value, label, icon, accent, gradient }: { value: number; label: string; icon: React.ReactNode; accent: string; gradient: string }) {
  const animated = useCountUp(value);
  return (
    <Card className={`relative overflow-hidden p-5 bg-gradient-to-br ${gradient}`}>
      <div className="rounded-lg p-2 w-fit" style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
        {icon}
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold text-[var(--text)] tabular-nums">{animated}</div>
        <div className="text-xs text-[var(--muted)] mt-0.5">{label}</div>
      </div>
    </Card>
  );
}

const statMeta = [
  { key: "jobsCount" as const, label: "Active Jobs", icon: <IconBriefcase />, accent: "var(--accent)", gradient: "from-[#4F8EF7]/10 to-[#6366F1]/5" },
  { key: "applicationsTotal" as const, label: "Total Applicants", icon: <IconUsers />, accent: "var(--accent-teal)", gradient: "from-[#2DD4BF]/10 to-[#14B8A6]/5" },
  { key: "shortlisted" as const, label: "Shortlisted", icon: <IconStar />, accent: "var(--accent-amber)", gradient: "from-[#F59E0B]/10 to-[#D97706]/5" },
  { key: "interviews" as const, label: "Interviews", icon: <IconCalendar />, accent: "var(--accent-purple)", gradient: "from-[#8B5CF6]/10 to-[#7C3AED]/5" },
];

/* ── Funnel SVG ── */
function FunnelChart({ funnel }: { funnel: Funnel }) {
  const stages = [
    { label: "Applied", value: funnel.applied, color: "#4F8EF7" },
    { label: "Shortlisted", value: funnel.shortlisted, color: "#2DD4BF" },
    { label: "Interview", value: funnel.interview, color: "#8B5CF6" },
    { label: "Offered", value: funnel.offered, color: "#F59E0B" },
    { label: "Hired", value: funnel.hired, color: "#22C55E" },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const widthPct = Math.min(Math.max((s.value / max) * 100, 8), 100);
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-20 text-xs text-[var(--muted)] text-right shrink-0">{s.label}</span>
            <div className="flex-1 relative h-8 overflow-hidden">
              <div
                className="h-full rounded-md flex items-center justify-end pr-3 transition-all duration-700 ease-out"
                style={{
                  width: `${widthPct}%`,
                  background: `linear-gradient(90deg, ${s.color}20, ${s.color}60)`,
                  borderLeft: `3px solid ${s.color}`,
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <span className="text-xs font-bold text-[var(--text)]">{s.value}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Radial Gauge ── */
function RadialGauge({ value, max, label, unit, color }: { value: number; max: number; label: string; unit: string; color: string }) {
  const animated = useCountUp(value);
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r={radius} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-[var(--text)] tabular-nums">{animated}</span>
          <span className="text-[10px] text-[var(--muted)]">{unit}</span>
        </div>
      </div>
      <span className="text-xs text-[var(--muted)]">{label}</span>
    </div>
  );
}

/* ── Main Page ── */
export function RecruiterOverviewPage() {
  const { token } = useAuth();
  const GUIDE_KEY = "hireflow_rec_guide_dismissed";
  const LEGACY_GUIDE_KEY = "talvion_rec_guide_dismissed";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recentApps, setRecentApps] = useState<ApplicationWithJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(
    () => {
      const current = localStorage.getItem(GUIDE_KEY);
      if (current) return current !== "1";
      const legacy = localStorage.getItem(LEGACY_GUIDE_KEY);
      if (legacy) {
        localStorage.setItem(GUIDE_KEY, legacy);
        return legacy !== "1";
      }
      return true;
    },
  );

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        setError(null);
        const data = await apiJson<{ overview: Overview }>("/recruiter/overview", { token });
        setOverview(data.overview);
        const apps = await apiJson<{ applications: ApplicationWithJob[] }>("/recruiter/applications?status=APPLIED", { token });
        setRecentApps(apps.applications.slice(0, 6));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load overview");
      }
    })();
  }, [token]);

  if (!overview && !error) return <PageSkeleton />;

  const totalApplications = overview?.applicationsTotal ?? 0;
  const shortlistedRate = totalApplications > 0 ? Math.round(((overview?.shortlisted ?? 0) / totalApplications) * 100) : 0;
  const interviewRate = totalApplications > 0 ? Math.round(((overview?.interviews ?? 0) / totalApplications) * 100) : 0;
  const hireRate = totalApplications > 0 ? Math.round(((overview?.hired ?? 0) / totalApplications) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Recruiter Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Pipeline overview &amp; analytics at a glance.</p>
      </div>

      {error && <Card className="border-[var(--danger)]/30 p-4 text-sm text-[var(--danger)]">{error}</Card>}

      {/* Getting Started Guide */}
      {showGuide && (
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-transparent pointer-events-none" />
          <div className="relative flex flex-wrap items-start justify-between gap-4 p-5">
            <div>
              <Badge variant="blue" className="mb-2">Getting Started</Badge>
              <ol className="mt-2 space-y-1.5 text-sm text-[var(--text-secondary)]">
                {[
                  ["1", "Complete your", "/recruiter/profile", "Company Profile"],
                  ["2", "Post a", "/recruiter/post-job", "Job"],
                  ["3", "Review", "/recruiter/applicants", "Applicants"],
                  ["4", "Schedule", "/recruiter/interviews", "Interviews"],
                ].map(([n, pre, to, label]) => (
                  <li key={n} className="flex items-baseline gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[10px] font-bold text-[var(--accent)]">{n}</span>
                    {pre} <Link to={to} className="text-[var(--accent)] hover:underline">{label}</Link>
                  </li>
                ))}
              </ol>
            </div>
            <Button variant="ghost" className="text-xs shrink-0" onClick={() => { localStorage.setItem(GUIDE_KEY, "1"); localStorage.removeItem(LEGACY_GUIDE_KEY); setShowGuide(false); }}>Dismiss</Button>
          </div>
        </Card>
      )}

      {/* Stat Cards Row */}
      {overview && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger-list">
          {statMeta.map((s) => (
            <StatCard key={s.key} value={overview[s.key]} label={s.label} icon={s.icon} accent={s.accent} gradient={s.gradient} />
          ))}
        </div>
      )}

      {overview && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Shortlist Rate</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">{shortlistedRate}%</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{overview.shortlisted} of {totalApplications} applicants</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Interview Rate</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">{interviewRate}%</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{overview.interviews} candidates moved to interviews</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Hire Rate</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">{hireRate}%</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{overview.hired} hires from total applications</div>
          </Card>
        </div>
      )}

      {overview && overview.jobsCount === 0 ? (
        <EmptyState
          title="No jobs posted yet"
          description="Post your first job to start receiving applications."
          action={<Link to="/recruiter/post-job"><Button variant="primary">Post a Job</Button></Link>}
        />
      ) : overview && (
        <>
          {/* Analytics Grid: 2 columns */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Views vs Applications chart */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Views vs Applications</h2>
              <DualLineChart
                title="Weekly Traffic"
                labels={overview.weekly.labels}
                dataset1={{ label: "Views", values: overview.weekly.views, color: "#4F8EF7" }}
                dataset2={{ label: "Applications", values: overview.weekly.applications, color: "#2DD4BF" }}
                height={240}
              />
            </Card>

            {/* Application Funnel */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Application Funnel</h2>
              <FunnelChart funnel={overview.funnel} />
            </Card>
          </div>

          {/* Bottom Row: 3 columns */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Top Performing Job */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-lg p-2" style={{ background: "color-mix(in srgb, var(--accent-amber) 12%, transparent)", color: "var(--accent-amber)" }}>
                  <IconTrophy />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Top Performing Job</h3>
              </div>
              {overview.topJob ? (
                <div>
                  <p className="text-base font-semibold text-[var(--text)] leading-tight">{overview.topJob.title}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">{overview.topJob.company}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-[var(--accent-teal)] tabular-nums">{overview.topJob.applicants}</span>
                    <span className="text-xs text-[var(--muted)]">applicants</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">No jobs yet</p>
              )}
            </Card>

            {/* Time to Hire Gauge */}
            <Card className="p-5 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 mb-3 self-start">
                <div className="rounded-lg p-2" style={{ background: "color-mix(in srgb, var(--accent-purple) 12%, transparent)", color: "var(--accent-purple)" }}>
                  <IconClock />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Avg Time to Hire</h3>
              </div>
              <RadialGauge
                value={overview.avgTimeToHire}
                max={30}
                label="Average across all positions"
                unit="days"
                color="#8B5CF6"
              />
            </Card>

            {/* Candidate Quality Score */}
            <Card className="p-5 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 mb-3 self-start">
                <div className="rounded-lg p-2" style={{ background: "color-mix(in srgb, var(--accent-teal) 12%, transparent)", color: "var(--accent-teal)" }}>
                  <IconStar />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Candidate Quality Score</h3>
              </div>
              <RadialGauge
                value={overview.qualityScore}
                max={100}
                label="Shortlisted + Interviewed / Total"
                unit="%"
                color="#2DD4BF"
              />
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { to: "/recruiter/post-job", icon: <IconBriefcase />, label: "Post a Job", sub: "Create new opening", color: "var(--accent)" },
              { to: "/recruiter/applicants", icon: <IconUsers />, label: "View Applicants", sub: "Review candidates", color: "var(--accent-teal)" },
              { to: "/recruiter/listings", icon: <IconCalendar />, label: "Manage Listings", sub: "Update statuses and visibility", color: "var(--accent-purple)" },
            ].map((a) => (
              <Link key={a.to} to={a.to} className="min-w-0">
                <Card className="group flex items-center gap-3 p-4 hover-glow cursor-pointer">
                  <div className="rounded-lg p-2 transition-colors" style={{ background: `color-mix(in srgb, ${a.color} 10%, transparent)`, color: a.color }}>{a.icon}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{a.label}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{a.sub}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">Recent Activity</h3>
              <Link to="/recruiter/applicants" className="text-xs text-[var(--accent)] hover:underline">View all applicants</Link>
            </div>
            {recentApps.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No recent applications yet.</p>
            ) : (
              <div className="space-y-2">
                {recentApps.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-[var(--text)]">{a.job.title}</div>
                      <div className="text-xs text-[var(--muted)]">Applied {new Date(a.createdAt).toLocaleDateString()}</div>
                    </div>
                    <Badge variant="blue">{a.status.replace("_", " ")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
