import { useCallback, useEffect, useState } from "react";
import { config } from "../config";

export type ExternalJob = {
  _id: string;
  title: string;
  company: string;
  location: {
    city?: string;
    state?: string;
    country: string;
    isRemote: boolean;
    isHybrid: boolean;
    isOnsite: boolean;
  };
  jobType: "full_time" | "part_time" | "internship" | "contract" | "freelance";
  experienceLevel: string;
  minExperienceYears: number;
  skills: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  applyUrl: string;
  applyFallbackUrl?: string;
  applyReliability?: "high" | "medium" | "low";
  applyIsDirect?: boolean;
  applicationDeadline?: string;
  activeUntil?: string;
  postedAt: string;
  source: string;
  description?: string;
};

type Filters = {
  q?: string;
  jobType?: string;
  location?: string;
  isRemote?: boolean;
  skills?: string;
  experienceLevel?: string;
  page?: number;
};

type Pagination = {
  page: number;
  total: number;
  pages: number;
  hasMore: boolean;
};

export function useExternalJobs(filters: Filters = {}) {
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, pages: 0, hasMore: false });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.jobType && filters.jobType !== "any") params.set("jobType", filters.jobType);
      if (filters.location) params.set("location", filters.location);
      if (filters.isRemote) params.set("isRemote", "true");
      if (filters.skills) params.set("skills", filters.skills);
      if (filters.experienceLevel && filters.experienceLevel !== "any") {
        params.set("experienceLevel", filters.experienceLevel);
      }
      params.set("page", String(filters.page || 1));
      params.set("limit", "20");

      const res = await fetch(`${config.apiBaseUrl}/external-jobs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");

      const data = await res.json();
      setJobs(data.jobs);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  return { jobs, loading, error, pagination, refetch: fetchJobs };
}

export async function fetchJobDetail(id: string): Promise<ExternalJob | null> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/external-jobs/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.job;
  } catch {
    return null;
  }
}
