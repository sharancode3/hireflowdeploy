import { useEffect, useMemo, useState, useRef } from "react";
import { apiJson } from "../api/client";
import type { Trends } from "../types";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { LineChart } from "../components/Charts";
import { EmptyState } from "../components/ui/EmptyState";
import { SALARY_DATA } from "../data/salaryData";

type TrendResponse = { trends: Trends };

function normalizeSeries(items: { label: string; value: number }[] | undefined, max = 12) {
  if (!Array.isArray(items)) return [] as { label: string; value: number }[];
  return items
    .filter((x) => x && typeof x.label === "string" && Number.isFinite(Number(x.value)))
    .slice(0, max)
    .map((x) => ({ label: x.label, value: Number(x.value) }));
}

/* ─── Animated counter ──────────────────────────────── */
function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(tick);
      }
    }
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

/* ─── Hero stat card ────────────────────────────────── */
function HeroStat({ label, value, subtitle, icon, color }: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden p-5 group hover:-translate-y-0.5 transition-all duration-200 hover:shadow-lg hover:shadow-black/20">
      <div className="flex items-start gap-3">
        <div className="rounded-xl p-2.5" style={{ background: `${color}15` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{label}</div>
          <div className="mt-1 font-bold text-[var(--text)]" style={{ fontSize: "clamp(14px, 1.5vw, 22px)" }}>{value}</div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtitle}</div>
        </div>
      </div>
      <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full opacity-20 blur-xl" style={{ background: color }} />
    </Card>
  );
}

/* ─── Horizontal bar (custom) ───────────────────────── */
function HorizontalBar({ items, color }: { items: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <div key={item.label} className="group">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[var(--text)] font-medium truncate">{item.label}</span>
            <span className="text-[var(--muted)] ml-2 shrink-0">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(4, (item.value / max) * 100)}%`,
                background: color,
                transitionDelay: `${idx * 60}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Donut chart (custom SVG) ──────────────────────── */
function DonutChart({ items, size = 200 }: { items: { label: string; value: number }[]; size?: number }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const colors = ["#4F8EF7", "#2DD4BF", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#10B981", "#6366F1"];
  const r = 70;
  const c = 2 * Math.PI * r;
  const [hovered, setHovered] = useState<number | null>(null);
  const segments = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const pct = item.value / total;
        const dash = pct * c;
        return {
          offset: acc.offset + dash,
          segments: [...acc.segments, { item, dash, currentOffset: acc.offset }],
        };
      },
      { offset: 0, segments: [] as Array<{ item: { label: string; value: number }; dash: number; currentOffset: number }> },
    ).segments;
  }, [c, items, total]);

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox="0 0 200 200" className="shrink-0">
        {segments.map(({ item, dash, currentOffset }, idx) => {
          return (
            <circle
              key={item.label}
              cx="100" cy="100" r={r}
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth={hovered === idx ? 28 : 24}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-currentOffset}
              transform="rotate(-90 100 100)"
              style={{ transition: "stroke-width 0.2s ease" }}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
        <text x="100" y="96" textAnchor="middle" className="text-2xl font-bold" fill="var(--text)">
          <AnimatedNumber value={total} />
        </text>
        <text x="100" y="114" textAnchor="middle" className="text-xs" fill="var(--muted)">total</text>
      </svg>
      <div className="space-y-1.5 min-w-0">
        {items.slice(0, 6).map((item, idx) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 text-xs cursor-default transition-opacity ${hovered !== null && hovered !== idx ? "opacity-40" : ""}`}
            onMouseEnter={() => setHovered(idx)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colors[idx % colors.length] }} />
            <span className="text-[var(--text)] truncate">{item.label}</span>
            <span className="text-[var(--muted)] ml-auto shrink-0">{Math.round((item.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Bubble chart (custom SVG) ─────────────────────── */
function BubbleChart({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  const colors = ["#4F8EF7", "#2DD4BF", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#10B981", "#6366F1"];
  const [hovered, setHovered] = useState<number | null>(null);

  const positions = items.slice(0, 10).map((_, idx) => {
    const angle = (idx / Math.min(items.length, 10)) * 2 * Math.PI - Math.PI / 2;
    const spread = idx < 3 ? 0 : 65 + idx * 8;
    return {
      cx: 160 + Math.cos(angle) * spread,
      cy: 120 + Math.sin(angle) * spread,
    };
  });

  return (
    <div className="overflow-hidden">
      <svg width="320" height="240" viewBox="0 0 320 240" className="mx-auto">
        {items.slice(0, 10).map((item, idx) => {
          const radius = 16 + (item.value / max) * 30;
          const pos = positions[idx];
          return (
            <g key={item.label} onMouseEnter={() => setHovered(idx)} onMouseLeave={() => setHovered(null)}>
              <circle
                cx={pos.cx} cy={pos.cy} r={radius}
                fill={`${colors[idx % colors.length]}${hovered === idx ? "40" : "20"}`}
                stroke={colors[idx % colors.length]}
                strokeWidth={hovered === idx ? 2 : 1}
                style={{ transition: "all 0.2s ease" }}
              />
              <text x={pos.cx} y={pos.cy - 4} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="600">
                {item.label.length > 10 ? item.label.slice(0, 10) + "…" : item.label}
              </text>
              <text x={pos.cx} y={pos.cy + 8} textAnchor="middle" fill="var(--muted)" fontSize="8">
                {item.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Skeleton ──────────────────────────────────────── */
function Shimmer({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-[var(--surface-raised)] ${className}`} />;
}

/* ─── Icons ─────────────────────────────────────────── */
function IconTrending() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 14l4-4 3 3 7-7M13 6h4v4" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="14" height="9" rx="2" /><path d="M7 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3" width="12" height="14" rx="1.5" /><path d="M8 7h1M11 7h1M8 10h1M11 10h1M8 13h4" />
    </svg>
  );
}
function IconDollar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="10" cy="10" r="7" /><path d="M10 6v8M7.5 8.5a2 2 0 0 1 2-1.5h1a2 2 0 0 1 0 3h-1a2 2 0 0 0 0 3h1a2 2 0 0 0 2-1.5" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ═══  MAIN PAGE  ══════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════ */
export function HireTrendsPage() {
  const [data, setData] = useState<TrendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"7d" | "30d" | "90d">("30d");

  const trends = useMemo(() => {
    const t = data?.trends;
    return {
      topRoles: normalizeSeries(t?.topRoles),
      trendingSkills: normalizeSeries(t?.trendingSkills),
      topCompanies: normalizeSeries(t?.topCompanies),
      industryHiring: normalizeSeries(t?.industryHiring),
      growth: normalizeSeries(t?.growth),
    } satisfies Trends;
  }, [data]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await apiJson<TrendResponse>("/trends");
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load trends");
      }
    })();
  }, []);

  if (!data && !error) {
    return (
      <div className="flex-1 px-8 py-6">
        <div className="mx-auto max-w-[1100px] space-y-6">
          <Shimmer className="h-8 w-48" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Shimmer key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Shimmer className="h-72" />
            <Shimmer className="h-72" />
            <Shimmer className="h-72" />
            <Shimmer className="h-72" />
          </div>
        </div>
      </div>
    );
  }

  const hasTrendData =
    trends.topRoles.length > 0 ||
    trends.trendingSkills.length > 0 ||
    trends.topCompanies.length > 0 ||
    trends.industryHiring.length > 0 ||
    trends.growth.length > 0;

  if (!error && !hasTrendData) {
    return (
      <div className="flex-1 px-8 py-6">
        <div className="mx-auto max-w-[1100px]">
          <Card className="p-6">
            <EmptyState
              title="No trend data available yet"
              description="Analytics will appear here once enough market activity is collected."
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-8 py-6">
      <div className="mx-auto max-w-[1100px] space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Talent Trends</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Premium analytics — market insights for Job Seekers &amp; Recruiters.</p>
          </div>
          <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
            {(["7d", "30d", "90d"] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setTimeFilter(f)}
                aria-pressed={timeFilter === f}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${timeFilter === f ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface-raised)]"}`}
              >
                {f === "7d" ? "7 Days" : f === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <Card className="p-4 border-[var(--danger)]/30 bg-[var(--danger)]/5 text-sm text-[var(--danger)]">{error}</Card>
        )}

        {/* Hero stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeroStat label="Top Hiring Role" value={trends.topRoles[0]?.label ?? "—"} subtitle={`${trends.topRoles[0]?.value ?? 0} openings`} icon={<IconBriefcase />} color="#4F8EF7" />
          <HeroStat label="Trending Skill" value={trends.trendingSkills[0]?.label ?? "—"} subtitle={`${trends.trendingSkills[0]?.value ?? 0} mentions`} icon={<IconTrending />} color="#2DD4BF" />
          <HeroStat label="Most Active Company" value={trends.topCompanies[0]?.label ?? "—"} subtitle={`${trends.topCompanies[0]?.value ?? 0} job posts`} icon={<IconBuilding />} color="#8B5CF6" />
          <HeroStat label="Avg Salary" value={(() => { const medians = Object.values(SALARY_DATA).flatMap(c => Object.values(c).map(b => b.median)); const avg = medians.length ? (medians.reduce((s, v) => s + v, 0) / medians.length) : 8.4; return `₹${avg.toFixed(1)} LPA`; })()} subtitle="Median across all roles" icon={<IconDollar />} color="#F59E0B" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">Top Hiring Roles</h3>
              <Badge variant="blue">{trends.topRoles.length} roles</Badge>
            </div>
            <HorizontalBar items={trends.topRoles} color="#4F8EF7" />
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">Hiring by Industry</h3>
              <Badge variant="purple">{trends.industryHiring.length} industries</Badge>
            </div>
            <DonutChart items={trends.industryHiring} />
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">Trending Skills</h3>
              <Badge variant="teal">Demand index</Badge>
            </div>
            <BubbleChart items={trends.trendingSkills} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {trends.trendingSkills.slice(0, 8).map(s => (
                <span key={s.label} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                  {s.label} <span className="text-[var(--accent-teal)]">({s.value})</span>
                </span>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">Companies Hiring Most</h3>
              <Badge variant="amber">{trends.topCompanies.length} companies</Badge>
            </div>
            <HorizontalBar items={trends.topCompanies} color="#F59E0B" />
          </Card>

          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Growth Momentum</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">Trend index across recent periods</p>
              </div>
              <Badge variant="blue">Trend</Badge>
            </div>
            <LineChart title="Growth" labels={trends.growth.map(x => x.label)} values={trends.growth.map(x => x.value)} height={220} />
          </Card>
        </div>

        {/* Personalized Insight */}
        <Card className="relative overflow-hidden p-6 border-[var(--accent-purple)]/20">
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[var(--accent-purple)]/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">✨</span>
              <h3 className="text-sm font-semibold text-[var(--text)]">Personalized Insight</h3>
              <Badge variant="purple">AI-powered</Badge>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Based on current market trends, <span className="text-[var(--text)] font-medium">{trends.trendingSkills[0]?.label ?? "React"}</span> is
              the most in-demand skill with <span className="text-[var(--accent-teal)] font-medium">{trends.trendingSkills[0]?.value ?? 0}</span> mentions.
              {" "}The top hiring role is <span className="text-[var(--text)] font-medium">{trends.topRoles[0]?.label ?? "Software Engineer"}</span> with
              <span className="text-[var(--accent)] font-medium"> {trends.topRoles[0]?.value ?? 0}</span> openings.
              Consider adding trending skills to your profile to boost your match score by ~40%.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {trends.trendingSkills.slice(0, 5).map(s => (
                <span key={s.label} className="rounded-full bg-[var(--accent-purple)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-purple)]">
                  + {s.label}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
