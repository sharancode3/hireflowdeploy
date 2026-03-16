const ONBOARDING_KEY = "hireflow_onboarding_done";

function keyForUser(userId: string) {
  return `${ONBOARDING_KEY}:${userId}`;
}

export function hasCompletedOnboarding(userId: string) {
  return localStorage.getItem(keyForUser(userId)) === "1";
}

export function completeOnboarding(userId: string) {
  localStorage.setItem(keyForUser(userId), "1");
}
