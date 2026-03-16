import type { ExternalJob } from "../hooks/useExternalJobs";

export function formatDeadline(deadline?: string): string {
  if (!deadline) return "Open until filled";

  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "Open until filled";
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Closed";
  if (diffDays === 0) return "Closes today";
  if (diffDays === 1) return "Closes tomorrow";
  if (diffDays <= 7) return `Closes in ${diffDays} days`;

  return `Apply by ${date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })}`;
}

export function formatPostedAt(postedAt: string): string {
  const date = new Date(postedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatSalary(min?: number, max?: number, currency = "INR"): string {
  if (!min && !max) return "Salary not disclosed";
  const fmt = (n: number) =>
    currency === "INR"
      ? `₹${n >= 100000 ? (n / 100000).toFixed(1) + "L" : (n / 1000).toFixed(0) + "K"}`
      : `$${(n / 1000).toFixed(0)}K`;
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max as number)}`;
}

export function formatLocation(location: ExternalJob["location"]): string {
  if (location.isRemote) return "Remote";
  const parts = [location.city, location.state].filter(Boolean);
  const place = parts.join(", ");
  if (location.isHybrid) return `${place} (Hybrid)`;
  return place || location.country;
}

export function getJobTypeBadge(type: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    full_time: { label: "Full-Time", color: "bg-blue-500/20 text-blue-400" },
    part_time: { label: "Part-Time", color: "bg-purple-500/20 text-purple-400" },
    internship: { label: "Internship", color: "bg-green-500/20 text-green-400" },
    contract: { label: "Contract", color: "bg-amber-500/20 text-amber-400" },
    freelance: { label: "Freelance", color: "bg-slate-500/20 text-slate-300" },
  };
  return map[type] || { label: type, color: "bg-gray-500/20 text-gray-400" };
}

export function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    jsearch: "JSearch",
    adzuna: "Adzuna",
    serpapi: "Google Jobs",
    greenhouse: "Company Direct",
    lever: "Company Direct",
    github_simplify: "SimplifyJobs",
    github_pittcsc: "PittCSC",
  };
  return labels[source] || source;
}
