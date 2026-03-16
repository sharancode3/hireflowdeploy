import { config } from "../config";

export async function openResumePreview(resumeId: string, token: string) {
  const res = await fetch(`${config.apiBaseUrl}/files/resume/${resumeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data && typeof data === "object" && "error" in data ? (data as any).error : "Failed to load resume";
    throw new Error(String(message));
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
