import type { JobSeekerProfile, ResumeSettings } from "../../types";

function accentVar(accent: ResumeSettings["accent"]) {
  if (accent === "NEUTRAL") return "var(--text)";
  if (accent === "MUTED") return "var(--muted)";
  return "var(--accent)";
}

function densityVars(density: ResumeSettings["density"]) {
  if (density === "COMPACT") return { gap: 8, font: 12, h1: 22 };
  if (density === "SPACIOUS") return { gap: 14, font: 13, h1: 26 };
  return { gap: 10, font: 12.5, h1: 24 };
}

export function AtsModernTemplate(props: { profile: JobSeekerProfile; settings: ResumeSettings }) {
  const p = props.profile;
  const s = props.settings;
  const d = densityVars(s.density);

  const sections = s.sectionOrder.filter((k) => !s.hiddenSections?.[k]);

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
      data-template="ATS_MODERN"
    >
      <header className="resumeHeader">
        <div>
          <div className="resumeName">{p.fullName || "Your Name"}</div>
          <div className="resumeMeta">
            {[p.headline, p.desiredRole].filter(Boolean).join(" • ")}
          </div>
          <div className="resumeMeta">
            {[p.location, p.phone].filter(Boolean).join(" • ")}
          </div>
        </div>
      </header>

      <div className="resumeDivider" />

      <main className="resumeBody">
        {sections.includes("SUMMARY") && p.about ? (
          <section className="resumeSection">
            <h3 className="resumeH3">Summary</h3>
            <p className="resumeP">{p.about}</p>
          </section>
        ) : null}

        {sections.includes("SKILLS") && p.skills?.length ? (
          <section className="resumeSection">
            <h3 className="resumeH3">Skills</h3>
            <div className="resumeChips">
              {p.skills.slice(0, 24).map((x) => (
                <span key={x} className="resumeChip">
                  {x}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("EXPERIENCE") && p.experience?.length ? (
          <section className="resumeSection">
            <h3 className="resumeH3">Experience</h3>
            <div className="resumeStack">
              {p.experience.slice(0, 6).map((it) => (
                <div key={it.id} className="resumeItem">
                  <div className="resumeRow">
                    <div className="resumeStrong">{[it.title, it.company].filter(Boolean).join(" — ")}</div>
                    <div className="resumeMuted">
                      {[
                        it.startDate ? it.startDate.slice(0, 10) : "",
                        it.endDate ? it.endDate.slice(0, 10) : "Present",
                      ]
                        .filter(Boolean)
                        .join(" → ")}
                    </div>
                  </div>
                  <div className="resumeMuted">{[it.location].filter(Boolean).join(" • ")}</div>
                  {it.summary ? <div className="resumeP">{it.summary}</div> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("PROJECTS") && p.projects?.length ? (
          <section className="resumeSection">
            <h3 className="resumeH3">Projects</h3>
            <div className="resumeStack">
              {p.projects.slice(0, 6).map((pr) => (
                <div key={pr.id} className="resumeItem">
                  <div className="resumeRow">
                    <div className="resumeStrong">{pr.name}</div>
                    {pr.link ? <div className="resumeMuted">{pr.link}</div> : null}
                  </div>
                  {(pr.skills ?? []).length ? (
                    <div className="resumeMuted">Stack: {(pr.skills ?? []).slice(0, 8).join(", ")}</div>
                  ) : null}
                  {pr.summary ? <div className="resumeP">{pr.summary}</div> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("EDUCATION") && p.education?.length ? (
          <section className="resumeSection">
            <h3 className="resumeH3">Education</h3>
            <div className="resumeStack">
              {p.education.slice(0, 4).map((ed) => (
                <div key={ed.id} className="resumeItem">
                  <div className="resumeRow">
                    <div className="resumeStrong">{ed.institution}</div>
                    <div className="resumeMuted">
                      {ed.startYear} – {ed.endYear ?? "Present"}
                    </div>
                  </div>
                  <div className="resumeMuted">
                    {[ed.degree, ed.fieldOfStudy, ed.grade ? `Grade: ${ed.grade}` : ""].filter(Boolean).join(" • ")}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("CERTIFICATIONS") && p.certifications?.length ? (
          <section className="resumeSection">
            <h3 className="resumeH3">Certifications</h3>
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
            <h3 className="resumeH3">Achievements</h3>
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
            <h3 className="resumeH3">Languages</h3>
            <div className="resumeChips">
              {p.languages.slice(0, 6).map((l) => (
                <span key={l.id} className="resumeChip">
                  {l.name} ({l.proficiency})
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
