import { useState } from "react";
import type { MatchBreakdown } from "../../utils/matchScore";
import { matchColor } from "../../utils/matchScore";

/* ─── Circular arc badge ─── */
export function MatchScoreBadge({ breakdown }: { breakdown: MatchBreakdown }) {
  const [showTip, setShowTip] = useState(false);
  const { score } = breakdown;
  const color = matchColor(score);
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        className="relative flex items-center justify-center"
        onClick={() => setShowTip(!showTip)}
        style={{ width: 48, height: 48 }}
        aria-label={`Match score ${score}%`}
        aria-expanded={showTip}
        aria-haspopup="dialog"
      >
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle
            cx="24" cy="24" r={r}
            fill="none" stroke={color} strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform="rotate(-90 24 24)"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <span className="absolute text-xs font-bold" style={{ color }}>{score}%</span>
      </button>

      {showTip && (
        <>
          <button type="button" aria-label="Close match breakdown" className="fixed inset-0 z-40" onClick={() => setShowTip(false)} />
          <div className="absolute top-full mt-2 z-50 w-72 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-lift animate-fade-in text-left">
            <div className="text-xs font-semibold text-[var(--text)] mb-3">Match Breakdown</div>
            <div className="space-y-2 text-xs">
              <Row label="Role match" pts={breakdown.rolePts} max={15} />
              <Row label={`Skills (${breakdown.matchedSkills.length} matched)`} pts={breakdown.skillPts} max={50} />
              <Row label="Location" pts={breakdown.locationPts} max={10} />
              <Row label="Experience" pts={breakdown.experiencePts} max={10} />
              <Row label="Industry" pts={breakdown.industryPts} max={5} />
            </div>
            {breakdown.matchedSkills.length > 0 && (
              <div className="mt-3 pt-2 border-t border-[var(--border)]">
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">Matched Skills</div>
                <div className="flex flex-wrap gap-1">
                  {breakdown.matchedSkills.map((s) => (
                    <span key={s} className="rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] text-[#22c55e]">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {breakdown.missingSkills.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">Missing Skills</div>
                <div className="flex flex-wrap gap-1">
                  {breakdown.missingSkills.map((s) => (
                    <span key={s} className="rounded-full bg-[#ef4444]/15 px-2 py-0.5 text-[10px] text-[#ef4444]">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, pts, max }: { label: string; pts: number; max: number }) {
  const pct = max > 0 ? (pts / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-[var(--text-secondary)]">
        <span>{label}</span>
        <span className="font-medium text-[var(--text)]">+{pts}</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-[var(--border)]">
        <div className="h-1 rounded-full bg-[var(--accent)]" style={{ width: `${pct}%`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}
