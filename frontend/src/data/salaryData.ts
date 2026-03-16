/* ─── Salary data (INR LPA) per role per city ─── */
type SalaryBand = { low: number; median: number; high: number };

export const SALARY_DATA: Record<string, Record<string, SalaryBand>> = {
  "Software Engineer": {
    Bengaluru: { low: 6, median: 12, high: 24 },
    Hyderabad: { low: 5, median: 10, high: 20 },
    Pune: { low: 5, median: 9, high: 18 },
    Chennai: { low: 4.5, median: 9, high: 17 },
    Delhi: { low: 5, median: 10, high: 20 },
    Mumbai: { low: 5.5, median: 11, high: 22 },
    Remote: { low: 6, median: 13, high: 26 },
  },
  "Frontend Developer": {
    Bengaluru: { low: 5, median: 10, high: 20 },
    Hyderabad: { low: 4, median: 8, high: 16 },
    Pune: { low: 4, median: 8, high: 15 },
    Chennai: { low: 3.5, median: 7, high: 14 },
    Delhi: { low: 4, median: 8.5, high: 17 },
    Mumbai: { low: 4.5, median: 9, high: 18 },
    Remote: { low: 5, median: 11, high: 22 },
  },
  "Backend Developer": {
    Bengaluru: { low: 6, median: 12, high: 22 },
    Hyderabad: { low: 5, median: 10, high: 18 },
    Pune: { low: 5, median: 9, high: 17 },
    Chennai: { low: 4.5, median: 9, high: 16 },
    Delhi: { low: 5, median: 10, high: 19 },
    Mumbai: { low: 5.5, median: 11, high: 20 },
    Remote: { low: 6, median: 13, high: 25 },
  },
  "Data Analyst": {
    Bengaluru: { low: 4, median: 8, high: 16 },
    Hyderabad: { low: 3.5, median: 7, high: 14 },
    Pune: { low: 3.5, median: 7, high: 13 },
    Chennai: { low: 3, median: 6.5, high: 12 },
    Delhi: { low: 3.5, median: 7, high: 14 },
    Mumbai: { low: 4, median: 8, high: 15 },
    Remote: { low: 4, median: 9, high: 18 },
  },
  "Data Scientist": {
    Bengaluru: { low: 8, median: 16, high: 30 },
    Hyderabad: { low: 7, median: 14, high: 26 },
    Pune: { low: 6, median: 13, high: 24 },
    Chennai: { low: 6, median: 12, high: 22 },
    Delhi: { low: 7, median: 14, high: 26 },
    Mumbai: { low: 7.5, median: 15, high: 28 },
    Remote: { low: 8, median: 17, high: 32 },
  },
  "UI/UX Designer": {
    Bengaluru: { low: 4, median: 8, high: 15 },
    Hyderabad: { low: 3, median: 6, high: 12 },
    Pune: { low: 3, median: 6, high: 11 },
    Chennai: { low: 2.5, median: 5.5, high: 10 },
    Delhi: { low: 3, median: 6.5, high: 13 },
    Mumbai: { low: 3.5, median: 7, high: 14 },
    Remote: { low: 4, median: 9, high: 17 },
  },
  "Product Analyst": {
    Bengaluru: { low: 5, median: 10, high: 18 },
    Hyderabad: { low: 4, median: 8, high: 15 },
    Pune: { low: 4, median: 8, high: 14 },
    Chennai: { low: 3.5, median: 7, high: 13 },
    Delhi: { low: 4, median: 9, high: 16 },
    Mumbai: { low: 4.5, median: 9, high: 17 },
    Remote: { low: 5, median: 11, high: 20 },
  },
  "Marketing Associate": {
    Bengaluru: { low: 3, median: 5, high: 10 },
    Hyderabad: { low: 2.5, median: 4.5, high: 8 },
    Pune: { low: 2.5, median: 4.5, high: 8 },
    Chennai: { low: 2, median: 4, high: 7 },
    Delhi: { low: 2.5, median: 5, high: 9 },
    Mumbai: { low: 3, median: 5.5, high: 10 },
    Remote: { low: 3, median: 6, high: 11 },
  },
  "HR Associate": {
    Bengaluru: { low: 3, median: 5, high: 9 },
    Hyderabad: { low: 2.5, median: 4, high: 7 },
    Pune: { low: 2.5, median: 4, high: 7 },
    Chennai: { low: 2, median: 3.5, high: 6 },
    Delhi: { low: 2.5, median: 4.5, high: 8 },
    Mumbai: { low: 3, median: 5, high: 9 },
    Remote: { low: 3, median: 5.5, high: 10 },
  },
  "Operations Executive": {
    Bengaluru: { low: 3, median: 5.5, high: 10 },
    Hyderabad: { low: 2.5, median: 5, high: 9 },
    Pune: { low: 2.5, median: 4.5, high: 8 },
    Chennai: { low: 2, median: 4.5, high: 8 },
    Delhi: { low: 2.5, median: 5, high: 9 },
    Mumbai: { low: 3, median: 5.5, high: 10 },
    Remote: { low: 3, median: 6, high: 11 },
  },
};

export function getSalaryBand(role: string, city: string): SalaryBand | null {
  // Try exact role, then fuzzy
  const roleData = SALARY_DATA[role] ?? Object.entries(SALARY_DATA).find(([k]) => role.toLowerCase().includes(k.toLowerCase()))?.[1];
  if (!roleData) return null;
  return roleData[city] ?? roleData["Bengaluru"] ?? null;
}

export function getComparisons(role: string, currentCity: string): Array<{ city: string; band: SalaryBand }> {
  const roleData = SALARY_DATA[role] ?? Object.entries(SALARY_DATA).find(([k]) => role.toLowerCase().includes(k.toLowerCase()))?.[1];
  if (!roleData) return [];
  return Object.entries(roleData)
    .filter(([c]) => c !== currentCity)
    .slice(0, 3)
    .map(([city, band]) => ({ city, band }));
}

/* Salary by role chart data for Trends page */
export function salaryByRoleData(): Array<{ role: string; min: number; max: number; median: number }> {
  return Object.entries(SALARY_DATA).map(([role, cities]) => {
    const all = Object.values(cities);
    return {
      role: role.length > 16 ? role.slice(0, 14) + "…" : role,
      min: Math.min(...all.map((b) => b.low)),
      max: Math.max(...all.map((b) => b.high)),
      median: Math.round(all.reduce((s, b) => s + b.median, 0) / all.length * 10) / 10,
    };
  });
}
