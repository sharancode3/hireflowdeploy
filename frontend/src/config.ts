function resolveApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim();

  if (!envUrl) return "/api";

  if (typeof window === "undefined") return envUrl;

  const host = window.location.hostname;
  const isBrowserLocal = host === "localhost" || host === "127.0.0.1";
  const isEnvLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(envUrl);

  // In remote previews/codespaces, localhost points to the user's machine, not the container backend.
  if (!isBrowserLocal && isEnvLocal) return "/api";

  return envUrl;
}

function resolvePublicAppUrl() {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    return `${window.location.origin}${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}`;
  }

  return "";
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  publicAppUrl: resolvePublicAppUrl(),
  adminEmails: (import.meta.env.VITE_ADMIN_EMAILS || "Sharan18x@gmail.com")
    .split(",")
    .map((item: string) => item.trim().toLowerCase())
    .filter(Boolean),
} as const;
