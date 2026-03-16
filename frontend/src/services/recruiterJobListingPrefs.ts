import { apiJson } from "../api/client";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

export type RecruiterJobListingPreferences = {
  postJobDraft?: JsonRecord | null;
  listingStages?: Record<string, "DRAFT" | "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED">;
};

export async function getRecruiterJobListingPreferences(token: string) {
  const data = await apiJson<{ preferences: RecruiterJobListingPreferences }>("/recruiter/job-listing-preferences", { token });
  return data.preferences || {};
}

export async function updateRecruiterJobListingPreferences(token: string, patch: RecruiterJobListingPreferences) {
  const data = await apiJson<{ preferences: RecruiterJobListingPreferences }>("/recruiter/job-listing-preferences", {
    method: "PATCH",
    token,
    body: patch,
  });
  return data.preferences || {};
}
