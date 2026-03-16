import { MiniSparkline } from "../../components/Charts";
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

function topSkills(profile: JobSeekerProfile) {
  const levels = profile.skillLevels ?? {};
  const skills = profile.skills ?? [];
  return skills
    .slice()
    .sort((a, b) => (levels[b] ?? 0) - (levels[a] ?? 0))
    .slice(0, 8);
}

export function TechnicalTemplate(props: { profile: JobSeekerProfile; settings: ResumeSettings }) {
  const p = props.profile;
  const s = props.settings;

  const sections = s.sectionOrder.filter((k) => !s.hiddenSections?.[k]);

  const sparkLabels = ["W1", "W2", "W3", "W4", "W5", "W6"];
  const sparkValues = [12, 18, 16, 22, 26, 30];

  const skillsTop = topSkills(p);

  return (
    <div
      className="resumePage"
      style={
        {
          "--resume-accent": accentVar(s.accent),
        } as any
      }
      data-template="TECHNICAL"
    >
      <header className="resumeHeader resumeHeaderTech">
        <div>
          <div className="resumeName">{p.fullName || "Your Name"}</div>
          <div className="resumeMeta">{[p.headline, p.desiredRole].filter(Boolean).join(" • ")}</div>
          <div className="resumeMeta">{[p.location, p.phone].filter(Boolean).join(" • ")}</div>
        </div>
        {s.showCharts ? (
          <div style={{ width: 220 }}>
            <div className="resumeMuted" style={{ fontSize: 12, marginBottom: 6 }}>
              Skill growth
            </div>
            <MiniSparkline labels={sparkLabels} values={sparkValues} />
          </div>
        ) : null}
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
            <h3 className="resumeH3">Top skills</h3>
            <div className="resumeStack">
              {skillsTop.map((sk) => (
                <div key={sk} className="resumeSkillRow">
                  <div className="resumeRow" style={{ gap: 10 }}>
                    <div className="resumeStrong">{sk}</div>
                    <div className="resumeMuted" style={{ fontSize: 12 }}>
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

        {sections.includes("EXPERIENCE") && p.experience?.length ? (
          <section className="resumeSection">
            <h3 className="resumeH3">Experience timeline</h3>
            <div className={s.showTimeline ? "resumeTimeline" : "resumeStack"}>
              {p.experience.slice(0, 6).map((it) => (
                <div key={it.id} className={s.showTimeline ? "resumeTimelineItem" : "resumeItem"}>
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
                  {it.location ? <div className="resumeMuted">{it.location}</div> : null}
                  {it.summary ? <div className="resumeP">{it.summary}</div> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("PROJECTS") && p.projects?.length ? (
          <section className="resumeSection">
            <h3 className="resumeH3">Project highlights</h3>
            <div className="resumeStack">
              {p.projects.slice(0, 5).map((pr) => (
                <div key={pr.id} className="resumeItem">
                  <div className="resumeRow">
                    <div className="resumeStrong">{pr.name}</div>
                    <div className="resumeMuted">{(pr.skills ?? []).slice(0, 6).join(", ")}</div>
                  </div>
                  {pr.summary ? <div className="resumeP">{pr.summary}</div> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="resumeGrid2">
          {sections.includes("EDUCATION") && p.education?.length ? (
            <section className="resumeSection">
              <h3 className="resumeH3">Education</h3>
              <div className="resumeStack">
                {p.education.slice(0, 3).map((ed) => (
                  <div key={ed.id} className="resumeItem">
                    <div className="resumeStrong">{ed.institution}</div>
                    <div className="resumeMuted">
                      {[ed.degree, ed.fieldOfStudy].filter(Boolean).join(" • ")}
                    </div>
                    <div className="resumeMuted">
                      {ed.startYear} – {ed.endYear ?? "Present"}
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
                {p.certifications.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <span className="resumeStrong">{c.name}</span>
                    <span className="resumeMuted"> — {c.issuer}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
