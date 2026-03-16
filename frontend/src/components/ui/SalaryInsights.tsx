import { getSalaryBand, getComparisons } from "../../data/salaryData";

export function SalaryInsights({ role, city }: { role: string; city: string }) {
  const band = getSalaryBand(role, city);
  if (!band) return null;

  const comparisons = getComparisons(role, city);
  const range = band.high - band.low;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Salary Insights</div>

      {/* Bar */}
      <div>
        <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1">
          <span>₹{band.low}L</span>
          <span>₹{band.median}L (Median)</span>
          <span>₹{band.high}L</span>
        </div>
        <div className="relative h-3 rounded-full bg-gradient-to-r from-[#ef4444]/30 via-[#f59e0b]/30 to-[#22c55e]/30">
          {/* Median marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-[var(--accent)]"
            style={{ left: `${((band.median - band.low) / range) * 100}%` }}
          />
        </div>
        <div className="flex gap-3 mt-2 text-xs">
          <span className="text-[var(--muted)]">Low</span>
          <span className="flex-1" />
          <span className="text-[var(--muted)]">High</span>
        </div>
      </div>

      {/* Comparisons */}
      {comparisons.length > 0 && (
        <div>
          <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-2">Same role in other cities</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {comparisons.map((c) => (
              <div key={c.city} className="rounded-lg border border-[var(--border)] p-2 text-center">
                <div className="font-medium text-[var(--text)]">{c.city}</div>
                <div className="text-[var(--muted)]">₹{c.band.median}L</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
