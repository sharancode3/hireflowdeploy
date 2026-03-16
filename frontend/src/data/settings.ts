import type { UserRole } from "../types";

export type ResumeTemplate =
  | "ats-plain"
  | "tech-focused"
  | "executive"
  | "startup"
  | "academic"
  | "modern"
  | "classic"
  | "minimal";

export type UserSettings = {
  theme: "light" | "soft-dark" | "high-contrast";
  notifications: {
    productUpdates: boolean;
    applicationUpdates: boolean;
  };
  resume: {
    defaultTemplate: ResumeTemplate;
  };
  account: {
    rememberFilters: boolean;
  };
};

const DEFAULT_SETTINGS: UserSettings = {
  theme: "light",
  notifications: { productUpdates: true, applicationUpdates: true },
  resume: { defaultTemplate: "ats-plain" },
  account: { rememberFilters: true },
};

function key(userId: string) {
  return `hireflow_settings_v1:${userId}`;
}

function legacyKey(userId: string) {
  return `talvion_settings_v1:${userId}`;
}

export function loadUserSettings(userId: string): UserSettings {
  const raw = localStorage.getItem(key(userId)) ?? localStorage.getItem(legacyKey(userId));
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications ?? {}) },
      resume: { ...DEFAULT_SETTINGS.resume, ...(parsed.resume ?? {}) },
      account: { ...DEFAULT_SETTINGS.account, ...(parsed.account ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveUserSettings(userId: string, settings: UserSettings) {
  localStorage.setItem(key(userId), JSON.stringify(settings));
  localStorage.removeItem(legacyKey(userId));
}

export function roleHome(role: UserRole) {
  return role === "JOB_SEEKER" ? "/job-seeker" : "/recruiter";
}
