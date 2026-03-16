import type { JobSeekerProfile } from "../types";

type Tip = { id: string; icon: string; text: string; tab: string };

export function getSmartTips(profile: JobSeekerProfile): Tip[] {
  const tips: Tip[] = [];

  if ((profile.skills ?? []).length < 6) {
    tips.push({
      id: "skills",
      icon: "💡",
      text: "Add 2+ more skills — profiles with 8+ skills get 3x more recruiter views.",
      tab: "skills",
    });
  }

  if (!(profile.about ?? "").trim() || (profile.about ?? "").length < 100) {
    tips.push({
      id: "about",
      icon: "💡",
      text: "Expand your summary — aim for 150+ characters for better ATS matching.",
      tab: "about",
    });
  }

  if ((profile.experience ?? []).length === 0 && !profile.isFresher) {
    tips.push({
      id: "experience",
      icon: "💡",
      text: "Add at least one internship or freelance project to stand out.",
      tab: "experience",
    });
  }

  if ((profile.projects ?? []).length < 2) {
    tips.push({
      id: "projects",
      icon: "💡",
      text: "Add a second project — multi-project profiles rank higher in search.",
      tab: "projects",
    });
  }

  if (!(profile.phone ?? "").trim()) {
    tips.push({
      id: "phone",
      icon: "💡",
      text: "Add a phone number — recruiters are 50% more likely to reach out.",
      tab: "general",
    });
  }

  if (!(profile.location ?? "").trim()) {
    tips.push({
      id: "location",
      icon: "💡",
      text: "Add your location to improve job matching accuracy.",
      tab: "general",
    });
  }

  if ((profile.education ?? []).length === 0) {
    tips.push({
      id: "education",
      icon: "💡",
      text: "Add your education — even current enrollment helps build credibility.",
      tab: "education",
    });
  }

  return tips.slice(0, 3);
}

export function SmartTips({
  profile,
  onGoToTab,
}: {
  profile: JobSeekerProfile;
  onGoToTab?: (tab: string) => void;
}) {
  const tips = getSmartTips(profile);
  if (tips.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Smart Suggestions</div>
      {tips.map((tip) => (
        <div
          key={tip.id}
          className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-3 flex items-start gap-2"
        >
          <span className="text-base flex-shrink-0">{tip.icon}</span>
          <div className="flex-1 text-xs text-[var(--text-secondary)]">
            {tip.text}
            {onGoToTab && (
              <button
                type="button"
                className="ml-1 text-[var(--accent)] hover:underline font-medium"
                onClick={() => onGoToTab(tip.tab)}
              >
                Fix this →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
