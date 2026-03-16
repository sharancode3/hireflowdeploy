export function skillsToCsv(skills: string[]): string {
  return skills
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
}

export function csvToSkills(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
