import type { JobSeekerProfile, ResumeSettings } from "../../types";
import { buildSectionOrder } from "../../utils/resumeIntelligence";

function accentVar(accent: ResumeSettings["accent"]) {
  if (accent === "NEUTRAL") return "var(--text)";
  if (accent === "MUTED") return "var(--muted)";
  return "var(--accent)";
}

function densityVars(density: ResumeSettings["density"]) {
  if (density === "COMPACT") return { gap: 8, font: 11.5, h1: 24 };
  if (density === "SPACIOUS") return { gap: 14, font: 12.5, h1: 28 };
  return { gap: 10, font: 12, h1: 26 };
}

function splitBullets(text: string) {
  if (!text) return [] as string[];
  const parts = text
    .split(/\n|•|●|·/)
    .map((t) => t.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [text.trim()];
}

function renderTextOrList(text: string) {
  const bullets = splitBullets(text);
  if (bullets.length > 1) {
    return (
      <ul className="resumeList">
        {bullets.map((b, idx) => (
          <li key={`${b.slice(0, 24)}-${idx}`}>{b}</li>
        ))}
      </ul>
    );
  }
  return <p className="resumeP">{text}</p>;
}

export function SingleColumnTemplate(props: {
  profile: JobSeekerProfile;
  settings: ResumeSettings;
  variant: "ATS_PLAIN" | "TECH_FOCUSED" | "EXECUTIVE" | "STARTUP" | "ACADEMIC";
}) {
  const p = props.profile;
  const s = props.settings;
  const d = densityVars(s.density);
  const sections = buildSectionOrder(props.variant, s.sectionOrder).filter((k) => !s.hiddenSections?.[k]);

  return (
    <div
      className="resumePage"
      style={
        {
          "--resume-accent": accentVar(s.accent),
          "--resume-gap": `${d.gap}px`,
          "--resume-font": `${d.font}px`,
          "--resume-h1": `${d.h1}px`,
        } as any
      }
      data-template={props.variant}
    >
      <header className="resumeHeader">
        <div>
          <div className="resumeName">{p.fullName || "Your Name"}</div>
          <div className="resumeMeta">{[p.headline, p.desiredRole].filter(Boolean).join(" • ")}</div>
          <div className="resumeMeta">{[p.location, p.phone].filter(Boolean).join(" • ")}</div>
        </div>
      </header>

      <div className="resumeDivider" />

      <main className="resumeBody">
        {sections.includes("SUMMARY") && p.about ? (
          <section className="resumeSection">
            <h2 className="resumeH2">Professional Summary</h2>
            {renderTextOrList(p.about)}
          </section>
        ) : null}

        {sections.includes("SKILLS") && p.skills?.length ? (
          <section className="resumeSection">
            <h2 className="resumeH2">Skills</h2>
            <p className="resumeP">{p.skills.slice(0, 28).join(", ")}</p>
          </section>
        ) : null}

        {sections.includes("EXPERIENCE") && p.experience?.length ? (
          <section className="resumeSection">
            <h2 className="resumeH2">Experience</h2>
            <div className="resumeStack">
              {p.experience.slice(0, 6).map((it) => (
                <div key={it.id} className="resumeItem">
                  <div className="resumeRow">
                    <h3 className="resumeRole">{[it.title, it.company].filter(Boolean).join(" — ")}</h3>
                    <div className="resumeMuted">
                      {[it.startDate ? it.startDate.slice(0, 10) : "", it.endDate ? it.endDate.slice(0, 10) : "Present"]
                        .filter(Boolean)
                        .join(" → ")}
                    </div>
                  </div>
                  {it.location ? <div className="resumeMuted">{it.location}</div> : null}
                  {it.summary ? renderTextOrList(it.summary) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("PROJECTS") && p.projects?.length ? (
          <section className="resumeSection">
            <h2 className="resumeH2">Projects</h2>
            <div className="resumeStack">
              {p.projects.slice(0, 6).map((pr) => (
                <div key={pr.id} className="resumeItem">
                  <div className="resumeRow">
                    <h3 className="resumeRole">{pr.name}</h3>
                    {pr.link ? <div className="resumeMuted">{pr.link}</div> : null}
                  </div>
                  {(pr.skills ?? []).length ? <div className="resumeMuted">Stack: {(pr.skills ?? []).slice(0, 8).join(", ")}</div> : null}
                  {pr.summary ? renderTextOrList(pr.summary) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("EDUCATION") && p.education?.length ? (
          <section className="resumeSection">
            <h2 className="resumeH2">Education</h2>
            <div className="resumeStack">
              {p.education.slice(0, 5).map((ed) => (
                <div key={ed.id} className="resumeItem">
                  <div className="resumeRow">
                    <h3 className="resumeRole">{ed.institution}</h3>
                    <div className="resumeMuted">
                      {ed.startYear} – {ed.endYear ?? "Present"}
                    </div>
                  </div>
                  <div className="resumeMuted">
                    {[ed.degree, ed.fieldOfStudy, ed.grade ? `Grade: ${ed.grade}` : ""]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("CERTIFICATIONS") && p.certifications?.length ? (
          <section className="resumeSection">
            <h2 className="resumeH2">Certifications</h2>
            <ul className="resumeList">
              {p.certifications.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <span className="resumeStrong">{c.name}</span>
                  <span className="resumeMuted"> — {c.issuer}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {sections.includes("ACHIEVEMENTS") && p.achievements?.length ? (
          <section className="resumeSection">
            <h2 className="resumeH2">Achievements</h2>
            <ul className="resumeList">
              {p.achievements.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <span className="resumeStrong">{a.title}</span>
                  {a.description ? <span className="resumeMuted"> — {a.description}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {sections.includes("LANGUAGES") && p.languages?.length ? (
          <section className="resumeSection">
            <h2 className="resumeH2">Languages</h2>
            <p className="resumeP">
              {p.languages
                .slice(0, 6)
                .map((l) => `${l.name} (${l.proficiency})`)
                .join(", ")}
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
