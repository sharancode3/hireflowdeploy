import type { JobSeekerProfile, ResumeSettings } from "../../types";

function accentColor(settings: ResumeSettings) {
  return settings.accentColor || "#1A73E8";
}

export function CreativeCardTemplate(props: { profile: JobSeekerProfile; settings: ResumeSettings }) {
  const p = props.profile;
  const c = accentColor(props.settings);

  const sections = props.settings.sectionOrder.filter((k) => !props.settings.hiddenSections?.[k]);

  return (
    <div className="resumePage" data-template="CREATIVE_CARD" style={{ border: "none", borderRadius: 18, overflow: "hidden", padding: 0 }}>
      <header style={{ background: c, color: "white", padding: "22px 28px" }}>
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{p.fullName || "Your Name"}</div>
        <div style={{ marginTop: 6, opacity: 0.9 }}>{[p.headline, p.desiredRole].filter(Boolean).join(" • ")}</div>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12 }}>
          {p.phone ? <span>Phone: {p.phone}</span> : null}
          {p.location ? <span>Location: {p.location}</span> : null}
        </div>
      </header>

      <main style={{ background: "#ffffff", padding: 24, display: "grid", gap: 14 }}>
        {sections.includes("SUMMARY") && p.about ? (
          <section className="resumeCardSection">
            <h3 className="resumeCardTitle">Professional Summary</h3>
            <p className="resumeP">{p.about}</p>
          </section>
        ) : null}

        {sections.includes("SKILLS") && p.skills?.length ? (
          <section className="resumeCardSection">
            <h3 className="resumeCardTitle">Skills</h3>
            <div className="resumeChips">
              {p.skills.slice(0, 20).map((s) => (
                <span key={s} className="resumeChip">{s}</span>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("EXPERIENCE") && p.experience?.length ? (
          <section className="resumeCardSection">
            <h3 className="resumeCardTitle">Experience</h3>
            <div className="resumeStack">
              {p.experience.slice(0, 5).map((it) => (
                <div key={it.id} className="resumeItem">
                  <div className="resumeRow">
                    <strong>{[it.title, it.company].filter(Boolean).join(" — ")}</strong>
                    <span className="resumeMuted">{[it.startDate?.slice(0, 10), it.endDate?.slice(0, 10) || "Present"].join(" → ")}</span>
                  </div>
                  {it.summary ? <p className="resumeP">{it.summary}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("PROJECTS") && p.projects?.length ? (
          <section className="resumeCardSection">
            <h3 className="resumeCardTitle">Projects</h3>
            <div className="resumeStack">
              {p.projects.slice(0, 4).map((pr) => (
                <div key={pr.id} className="resumeItem">
                  <div className="resumeRow">
                    <strong>{pr.name}</strong>
                    {pr.link ? <span className="resumeMuted">{pr.link}</span> : null}
                  </div>
                  <p className="resumeP">{pr.summary}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
