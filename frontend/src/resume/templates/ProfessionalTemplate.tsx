import type { JobSeekerProfile, ResumeSettings, SkillProficiency } from "../../types";

function accentVar(accent: ResumeSettings["accent"]) {
  if (accent === "NEUTRAL") return "var(--text)";
  if (accent === "MUTED") return "var(--muted)";
  return "var(--accent)";
}

function levelPct(level: SkillProficiency | undefined) {
  const v = typeof level === "number" ? level : 3;
  return Math.max(1, Math.min(5, v)) * 20;
}

export function ProfessionalTemplate(props: { profile: JobSeekerProfile; settings: ResumeSettings }) {
  const p = props.profile;
  const s = props.settings;

  const sections = s.sectionOrder.filter((k) => !s.hiddenSections?.[k]);

  return (
    <div
      className="resumePage resumeTwoCol"
      style={
        {
          "--resume-accent": accentVar(s.accent),
        } as any
      }
      data-template="PROFESSIONAL"
    >
      <aside className="resumeSide" style={{ background: "#1A1A2E", color: "#F8FAFC", margin: "-22px 0 -22px -22px", padding: "22px 16px 22px 16px", borderRight: "none" }}>
        <div className="resumeName" style={{ fontSize: 20 }}>{p.fullName || "Your Name"}</div>
        <div className="resumeMeta" style={{ color: "#CBD5E1" }}>{[p.headline, p.desiredRole].filter(Boolean).join(" • ")}</div>
        <div className="resumeMeta" style={{ color: "#94A3B8" }}>{[p.location, p.phone].filter(Boolean).join(" • ")}</div>

        {sections.includes("SKILLS") && p.skills?.length ? (
          <section className="resumeSection" style={{ marginTop: 14 }}>
            <h3 className="resumeH3" style={{ color: "#E2E8F0" }}>Skills</h3>
            <div className="resumeStack">
              {p.skills.slice(0, 14).map((sk) => (
                <div key={sk} className="resumeSkillRow">
                  <div className="resumeRow" style={{ gap: 10 }}>
                    <div className="resumeStrong" style={{ color: "#F8FAFC" }}>{sk}</div>
                    <div className="resumeMuted" style={{ fontSize: 12, color: "#CBD5E1" }}>
                      {p.skillLevels?.[sk] ? `${p.skillLevels[sk]}/5` : "—"}
                    </div>
                  </div>
                  {s.showSkillBars ? (
                    <div className="resumeBarTrack">
                      <div className="resumeBarFill" style={{ width: `${levelPct(p.skillLevels?.[sk])}%` }} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("LANGUAGES") && p.languages?.length ? (
          <section className="resumeSection" style={{ marginTop: 14 }}>
            <h3 className="resumeH3" style={{ color: "#E2E8F0" }}>Languages</h3>
            <div className="resumeChips">
              {p.languages.slice(0, 6).map((l) => (
                <span key={l.id} className="resumeChip" style={{ background: "rgba(248,250,252,0.08)", color: "#E2E8F0", borderColor: "rgba(248,250,252,0.2)" }}>
                  {l.name} ({l.proficiency})
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("CERTIFICATIONS") && p.certifications?.length ? (
          <section className="resumeSection" style={{ marginTop: 14 }}>
            <h3 className="resumeH3" style={{ color: "#E2E8F0" }}>Certifications</h3>
            <ul className="resumeList">
              {p.certifications.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <span className="resumeStrong" style={{ color: "#F8FAFC" }}>{c.name}</span>
                  <div className="resumeMuted" style={{ color: "#CBD5E1" }}>{c.issuer}</div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>

      <main className="resumeMain" style={{ background: "#ffffff" }}>
        {sections.includes("SUMMARY") && p.about ? (
          <section className="resumeSection">
            <h3 className="resumeH3">Summary</h3>
            <p className="resumeP">{p.about}</p>
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
              {p.projects.slice(0, 5).map((pr) => (
                <div key={pr.id} className="resumeItem">
                  <div className="resumeRow">
                    <div className="resumeStrong">{pr.name}</div>
                    {pr.link ? <div className="resumeMuted">{pr.link}</div> : null}
                  </div>
                  <div className="resumeMuted">{(pr.skills ?? []).slice(0, 8).join(", ")}</div>
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
      </main>
    </div>
  );
}
