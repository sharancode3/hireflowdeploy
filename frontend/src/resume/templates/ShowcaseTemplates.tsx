import type { JobSeekerProfile, ResumeSettings } from "../../types";

function visibleSections(settings: ResumeSettings) {
  return settings.sectionOrder.filter((key) => !settings.hiddenSections?.[key]);
}

function bulletLines(text: string | null | undefined) {
  if (!text) return [] as string[];
  const lines = text
    .split(/\n|•|●|·/)
    .map((item) => item.trim())
    .filter(Boolean);
  return lines.length > 1 ? lines : [text.trim()];
}

function shortDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "Present";
}

export function EditorialSidebarTemplate(props: { profile: JobSeekerProfile; settings: ResumeSettings }) {
  const p = props.profile;
  const sections = visibleSections(props.settings);

  return (
    <div
      className="resumePage"
      data-template="EDITORIAL_SIDEBAR"
      style={{
        border: "8px solid #46545f",
        borderRadius: 0,
        padding: 0,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "31% 69%",
        minHeight: 1123,
      }}
    >
      <aside style={{ background: "#eef1f3", padding: "30px 20px", borderRight: "3px solid #4d4d4d" }}>
        <div style={{ fontSize: 10, lineHeight: 1.5, color: "#27313b", fontWeight: 700 }}>{p.fullName || "Your Name"}</div>
        <div style={{ marginTop: 6, fontSize: 9, color: "#334155" }}>{p.phone || "+1 555 555 5555"}</div>
        <div style={{ fontSize: 9, color: "#334155" }}>{p.location || "New Delhi, India"}</div>

        {sections.includes("SKILLS") && p.skills?.length ? (
          <section style={{ marginTop: 22 }}>
            <h3 style={{ fontSize: 13, marginBottom: 8, color: "#1f2937", fontWeight: 500 }}>Skills</h3>
            <ul style={{ paddingLeft: 14, margin: 0, fontSize: 9.5, lineHeight: 1.6, color: "#364152" }}>
              {p.skills.slice(0, 10).map((skill) => <li key={skill}>{skill}</li>)}
            </ul>
          </section>
        ) : null}

        {sections.includes("EDUCATION") && p.education?.length ? (
          <section style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 13, marginBottom: 8, color: "#1f2937", fontWeight: 500 }}>Education And Training</h3>
            {p.education.slice(0, 2).map((ed) => (
              <div key={ed.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: "#475569" }}>{ed.endYear ?? "Present"}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#111827", lineHeight: 1.4 }}>{ed.degree || ed.institution}</div>
                <div style={{ fontSize: 9, color: "#334155", lineHeight: 1.45 }}>{ed.institution}</div>
              </div>
            ))}
          </section>
        ) : null}

        {sections.includes("LANGUAGES") && p.languages?.length ? (
          <section style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 13, marginBottom: 8, color: "#1f2937", fontWeight: 500 }}>Languages</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {p.languages.slice(0, 4).map((language) => (
                <div key={language.id} style={{ fontSize: 9.5, color: "#334155" }}>
                  <div>{language.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{language.proficiency}</span>
                    <span style={{ flex: 1, height: 2, background: "#b8c0c7", display: "block" }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("ACHIEVEMENTS") && p.achievements?.length ? (
          <section style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 13, marginBottom: 8, color: "#1f2937", fontWeight: 500 }}>Interests And Hobbies</h3>
            <ul style={{ paddingLeft: 14, margin: 0, fontSize: 9.5, lineHeight: 1.6, color: "#364152" }}>
              {p.achievements.slice(0, 4).map((achievement) => <li key={achievement.id}>{achievement.title}</li>)}
            </ul>
          </section>
        ) : null}
      </aside>

      <main style={{ padding: "28px 24px", background: "#fff" }}>
        <div style={{ fontSize: 30, fontWeight: 300, color: "#4b5563", marginBottom: 18 }}>{p.fullName || "Your Name"}</div>

        {sections.includes("SUMMARY") && p.about ? (
          <section style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, color: "#374151", marginBottom: 6 }}>Summary</h3>
            <p style={{ margin: 0, fontSize: 10, lineHeight: 1.6, color: "#374151" }}>{p.about}</p>
          </section>
        ) : null}

        {sections.includes("EXPERIENCE") && p.experience?.length ? (
          <section>
            <h3 style={{ fontSize: 15, fontWeight: 500, color: "#374151", marginBottom: 10 }}>Experience</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {p.experience.slice(0, 4).map((item) => (
                <div key={item.id}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{item.company}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>{item.title}</div>
                  <div style={{ fontSize: 9, color: "#64748b" }}>{[item.location, `${shortDate(item.startDate)} - ${shortDate(item.endDate)}`].filter(Boolean).join(" | ")}</div>
                  <ul style={{ paddingLeft: 14, margin: "6px 0 0", fontSize: 9.5, lineHeight: 1.55, color: "#334155" }}>
                    {bulletLines(item.summary).slice(0, 4).map((line, idx) => <li key={`${item.id}-${idx}`}>{line}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export function FormalCenteredTemplate(props: { profile: JobSeekerProfile; settings: ResumeSettings }) {
  const p = props.profile;
  const sections = visibleSections(props.settings);

  return (
    <div className="resumePage" data-template="FORMAL_CENTERED" style={{ background: "#fff", padding: "28px 34px", borderRadius: 0 }}>
      <header style={{ textAlign: "center", borderBottom: "1px solid #d2d6db", paddingBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.4, color: "#111" }}>{(p.fullName || "YOUR NAME").toUpperCase()}</div>
        <div style={{ marginTop: 6, fontSize: 8.5, color: "#4b5563", lineHeight: 1.6 }}>{[p.location, p.phone, p.headline].filter(Boolean).join(" | ")}</div>
      </header>

      <main style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {sections.includes("SUMMARY") && p.about ? (
          <section>
            <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#111" }}>SUMMARY</div>
            <div style={{ height: 1, background: "#d2d6db", margin: "4px 0 6px" }} />
            <p style={{ margin: 0, fontSize: 9, lineHeight: 1.5, color: "#374151" }}>{p.about}</p>
          </section>
        ) : null}

        {sections.includes("SKILLS") && p.skills?.length ? (
          <section>
            <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#111" }}>SKILLS</div>
            <div style={{ height: 1, background: "#d2d6db", margin: "4px 0 6px" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px", fontSize: 8.8, color: "#111827" }}>
              {p.skills.slice(0, 12).map((skill) => (
                <div key={skill} style={{ display: "flex", gap: 5 }}>
                  <span>•</span>
                  <span>{skill}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections.includes("EXPERIENCE") && p.experience?.length ? (
          <section>
            <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#111" }}>EXPERIENCE</div>
            <div style={{ height: 1, background: "#d2d6db", margin: "4px 0 6px" }} />
            {p.experience.slice(0, 3).map((item) => (
              <div key={item.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 9, fontWeight: 700, color: "#111" }}>
                  <span>{item.title}</span>
                  <span>{`${shortDate(item.startDate)} to ${shortDate(item.endDate)}`}</span>
                </div>
                <div style={{ fontSize: 8.5, fontWeight: 600, color: "#374151" }}>{[item.company, item.location].filter(Boolean).join(" | ")}</div>
                <ul style={{ paddingLeft: 14, margin: "3px 0 0", fontSize: 8.5, lineHeight: 1.45, color: "#374151" }}>
                  {bulletLines(item.summary).slice(0, 3).map((line, idx) => <li key={`${item.id}-${idx}`}>{line}</li>)}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {sections.includes("EDUCATION") && p.education?.length ? (
            <section>
              <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#111" }}>EDUCATION AND TRAINING</div>
              <div style={{ height: 1, background: "#d2d6db", margin: "4px 0 6px" }} />
              {p.education.slice(0, 2).map((ed) => (
                <div key={ed.id} style={{ marginBottom: 6, fontSize: 8.5, color: "#111827" }}>
                  <div style={{ fontWeight: 700 }}>{ed.degree || ed.institution}</div>
                  <div>{ed.institution}</div>
                </div>
              ))}
            </section>
          ) : null}

          {sections.includes("LANGUAGES") && p.languages?.length ? (
            <section>
              <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#111" }}>LANGUAGES</div>
              <div style={{ height: 1, background: "#d2d6db", margin: "4px 0 6px" }} />
              {p.languages.slice(0, 4).map((language) => (
                <div key={language.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 8.5, color: "#111827" }}>
                  <span>{language.name}</span>
                  <span>{language.proficiency}</span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export function PastelProfileTemplate(props: { profile: JobSeekerProfile; settings: ResumeSettings }) {
  const p = props.profile;
  const sections = visibleSections(props.settings);

  return (
    <div
      className="resumePage"
      data-template="PASTEL_PROFILE"
      style={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid #d3d8e3",
        padding: "30px 26px 28px 42px",
        background: "#fff",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 20, background: "#f3f0ea" }}>
        <span style={{ position: "absolute", left: 4, top: 16, width: 10, height: 32, borderRadius: 999, background: "#9a7b53", transform: "rotate(28deg)" }} />
        <span style={{ position: "absolute", left: 5, top: 68, width: 8, height: 28, borderRadius: 999, background: "#a44d20", transform: "rotate(22deg)" }} />
        <span style={{ position: "absolute", left: 3, top: 122, width: 10, height: 36, borderRadius: 999, background: "#1d2f3f", transform: "rotate(81deg)" }} />
        <span style={{ position: "absolute", left: 5, top: 190, width: 9, height: 28, borderRadius: 999, background: "#5fa1ac", transform: "rotate(68deg)" }} />
        <span style={{ position: "absolute", left: 4, top: 266, width: 10, height: 44, borderRadius: 999, background: "#f47a45", transform: "rotate(26deg)" }} />
        <span style={{ position: "absolute", left: 6, bottom: 110, width: 9, height: 34, borderRadius: 999, background: "#e6d0b1", transform: "rotate(36deg)" }} />
        <span style={{ position: "absolute", left: 4, bottom: 32, width: 10, height: 42, borderRadius: 999, background: "#ff7f50", transform: "rotate(18deg)" }} />
      </div>

      <header style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 1.1, color: "#303030" }}>{(p.fullName || "Your Name").toUpperCase()}</div>
      </header>

      <main style={{ display: "grid", gridTemplateColumns: "1.35fr 0.9fr", gap: 16 }}>
        <div style={{ display: "grid", gap: 14 }}>
          {sections.includes("SUMMARY") && p.about ? (
            <section>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "#313131", marginBottom: 6 }}>SUMMARY</div>
              <p style={{ margin: 0, fontSize: 8.7, lineHeight: 1.55, color: "#374151" }}>{p.about}</p>
            </section>
          ) : null}

          {sections.includes("EXPERIENCE") && p.experience?.length ? (
            <section>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "#313131", marginBottom: 6 }}>EXPERIENCE</div>
              {p.experience.slice(0, 3).map((item) => (
                <div key={item.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#111827" }}>{item.title}</div>
                  <div style={{ fontSize: 8.4, color: "#475569", marginBottom: 3 }}>{[item.company, `${shortDate(item.startDate)} - ${shortDate(item.endDate)}`].filter(Boolean).join(" | ")}</div>
                  <ul style={{ paddingLeft: 14, margin: 0, fontSize: 8.4, lineHeight: 1.45, color: "#374151" }}>
                    {bulletLines(item.summary).slice(0, 3).map((line, idx) => <li key={`${item.id}-${idx}`}>{line}</li>)}
                  </ul>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <section style={{ background: "#f8d8cc", padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "#313131", marginBottom: 6 }}>CONTACT</div>
            <div style={{ fontSize: 8.5, lineHeight: 1.6, color: "#374151" }}>
              {p.phone ? <div>{p.phone}</div> : null}
              {p.location ? <div>{p.location}</div> : null}
              {p.headline ? <div>{p.headline}</div> : null}
            </div>
          </section>

          {sections.includes("SKILLS") && p.skills?.length ? (
            <section>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "#313131", marginBottom: 6 }}>SKILLS</div>
              <ul style={{ paddingLeft: 14, margin: 0, fontSize: 8.5, lineHeight: 1.5, color: "#374151" }}>
                {p.skills.slice(0, 8).map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            </section>
          ) : null}

          {sections.includes("EDUCATION") && p.education?.length ? (
            <section>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "#313131", marginBottom: 6 }}>EDUCATION AND TRAINING</div>
              {p.education.slice(0, 2).map((ed) => (
                <div key={ed.id} style={{ marginBottom: 7, fontSize: 8.4, color: "#374151" }}>
                  <div style={{ fontWeight: 700 }}>{ed.degree || ed.institution}</div>
                  <div>{ed.institution}</div>
                </div>
              ))}
            </section>
          ) : null}

          {sections.includes("LANGUAGES") && p.languages?.length ? (
            <section>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "#313131", marginBottom: 6 }}>LANGUAGES</div>
              {p.languages.slice(0, 3).map((language) => (
                <div key={language.id} style={{ marginBottom: 4, fontSize: 8.4, color: "#374151" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{language.name}</span>
                    <span>{language.proficiency}</span>
                  </div>
                  <div style={{ height: 2, background: "#f17c4b", marginTop: 2, width: language.proficiency === "NATIVE" ? "100%" : language.proficiency === "ADVANCED" ? "80%" : language.proficiency === "INTERMEDIATE" ? "60%" : "40%" }} />
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}