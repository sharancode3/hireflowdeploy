import { useCallback, useEffect, useRef, useState } from "react";
import type { Job, JobSeekerProfile } from "../types";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

/* ─── Tone variants ─── */
type Tone = "professional" | "conversational" | "enthusiastic";

const OPENERS: Record<Tone, string[]> = {
  professional: [
    "I am writing to express my interest in the {title} position at {company}.",
    "Please accept this letter as my formal application for the {title} role at {company}.",
    "With a strong foundation in {skills}, I am eager to contribute to {company} as a {title}.",
  ],
  conversational: [
    "I was excited to come across the {title} opening at {company} — it's exactly the kind of role I've been looking for.",
    "When I saw {company} was hiring for a {title}, I knew I had to reach out.",
    "I'd love to bring my {skills} experience to {company} as your next {title}.",
  ],
  enthusiastic: [
    "I am thrilled to apply for the {title} role at {company} — this opportunity aligns perfectly with my passion and skill set!",
    "Nothing excites me more than the chance to join {company} as a {title} and make an immediate impact!",
    "The {title} position at {company} genuinely excites me, and I believe my background makes me a strong fit!",
  ],
};

const CLOSINGS: Record<Tone, string> = {
  professional:
    "I would welcome the opportunity to discuss how my qualifications align with your team's needs. Thank you for considering my application.",
  conversational:
    "I'd love to chat more about how I can contribute to your team. Thanks for taking the time to review my application — I hope to hear from you soon!",
  enthusiastic:
    "I cannot wait to discuss this opportunity further — I'm confident I can add real value from day one. Thank you so much for considering me!",
};

function interp(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function generateLetter(
  profile: JobSeekerProfile,
  job: Job,
  tone: Tone,
  strength: string,
  achievement: string,
  variant: number,
): string {
  const name = profile.fullName || "Applicant";
  const headline = profile.headline || profile.desiredRole || "professional";
  const about = profile.about || "";
  const matchedSkills = job.requiredSkills
    .filter((s) => (profile.skills ?? []).map((x) => x.toLowerCase()).includes(s.toLowerCase()))
    .slice(0, 3);
  const skillList = matchedSkills.length > 0 ? matchedSkills.join(", ") : (profile.skills ?? []).slice(0, 3).join(", ");

  const openers = OPENERS[tone];
  const opener = interp(openers[variant % openers.length], {
    title: job.title,
    company: job.companyName,
    skills: skillList,
  });

  const bodySkills =
    matchedSkills.length > 0
      ? `My expertise in ${matchedSkills.join(", ")} directly aligns with the requirements of this role.`
      : `I bring a versatile skill set including ${skillList} that I am eager to apply.`;

  const strengthLine = strength.trim()
    ? ` One of my key strengths is ${strength.trim()}, which I believe would be particularly valuable in this position.`
    : "";
  const achievementLine = achievement.trim()
    ? ` A highlight of my career so far has been ${achievement.trim()}.`
    : "";

  const aboutLine = about.length > 20 ? ` ${about.slice(0, 200).trim()}.` : "";

  const body = `As a ${headline}, I have developed strong competencies that prepare me for this opportunity. ${bodySkills}${strengthLine}${achievementLine}${aboutLine}`;

  const closing = CLOSINGS[tone];

  return `Dear Hiring Manager,\n\n${opener}\n\n${body}\n\n${closing}\n\nSincerely,\n${name}`;
}

/* ─── Component ─── */
export function CoverLetterModal({
  open,
  onClose,
  job,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
  profile: JobSeekerProfile;
}) {
  const [tone, setTone] = useState<Tone>("professional");
  const [strength, setStrength] = useState("");
  const [achievement, setAchievement] = useState("");
  const [variant, setVariant] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullText = useRef("");

  const generate = useCallback(() => {
    const letter = generateLetter(profile, job, tone, strength, achievement, variant);
    fullText.current = letter;
    setDisplayText("");
    let idx = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      idx += 1;
      if (idx >= letter.length) {
        setDisplayText(letter);
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setDisplayText(letter.slice(0, idx));
      }
    }, 8);
  }, [profile, job, tone, strength, achievement, variant]);

  useEffect(() => {
    if (open) generate();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [open, generate]);

  function regenerate() {
    setVariant((v) => v + 1);
  }

  useEffect(() => {
    if (variant > 0) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  function copy() {
    navigator.clipboard.writeText(fullText.current);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob([fullText.current], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cover_Letter_${job.companyName.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-4" style={{ maxHeight: "80vh", overflowY: "auto" }}>
        <h2 className="text-lg font-semibold text-[var(--text)]">Cover Letter Generator</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left: Form */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Job Title</label>
              <input className="input-base w-full" value={job.title} readOnly />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Company</label>
              <input className="input-base w-full" value={job.companyName} readOnly />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Tone</label>
              <div className="flex gap-2">
                {(["professional", "conversational", "enthusiastic"] as Tone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tone === t}
                    className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition ${
                      tone === t
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-active)]"
                    }`}
                    onClick={() => setTone(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Key strength to highlight</label>
              <input
                className="input-base w-full"
                placeholder="e.g., problem-solving under pressure"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Specific achievement</label>
              <input
                className="input-base w-full"
                placeholder="e.g., reduced load time by 40%"
                value={achievement}
                onChange={(e) => setAchievement(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={regenerate}>Regenerate</Button>
              <Button variant="primary" onClick={generate}>Generate</Button>
            </div>
          </div>

          {/* Right: Output */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <pre className="whitespace-pre-wrap text-sm text-[var(--text)] font-sans leading-relaxed min-h-[300px]">
              {displayText}
              <span className="inline-block w-0.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5" />
            </pre>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="primary" onClick={copy}>
            {copied ? "✓ Copied" : "Copy to Clipboard"}
          </Button>
          <Button variant="secondary" onClick={download}>Download .txt</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
