import { useNavigate } from "react-router-dom";
import { Footer } from "../components/Footer";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="container">
        <section className="hero">
          <h1>Build Your Career. Hire Smarter.</h1>
          <p className="subtext">A simple, modern platform for hiring and job searching</p>

          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={() => navigate("/login")}
            >
              Job Seeker
            </button>
            <button type="button" className="btn" onClick={() => navigate("/login")}
            >
              Hire (Recruiter)
            </button>
          </div>

          <p className="subtext">
            New here? <a href="/register">Create an account</a>
          </p>
        </section>

        <section className="grid">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Why Hireflow</h2>
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <div className="card card-ghost">
                <h3 style={{ marginTop: 0 }}>Professional profiles</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Build a LinkedIn-style profile with skills, education, and experience.
                </p>
              </div>
              <div className="card card-ghost">
                <h3 style={{ marginTop: 0 }}>Fast applications</h3>
                <p className="muted" style={{ margin: 0 }}>
                  One-click apply, clear job details, and realistic status tracking.
                </p>
              </div>
              <div className="card card-ghost">
                <h3 style={{ marginTop: 0 }}>Organized hiring</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Shortlist, reject, and schedule interviews with minimal effort.
                </p>
              </div>
              <div className="card card-ghost">
                <h3 style={{ marginTop: 0 }}>Data-driven trends</h3>
                <p className="muted" style={{ margin: 0 }}>
                  A dedicated Hire Trends page with charts and real-looking insights.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-2">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>How it works (Job Seeker)</h2>
            <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              <li>Create your profile and add skills.</li>
              <li>Filter jobs by role, location, and skill.</li>
              <li>Apply in one click and track updates.</li>
            </ol>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>How it works (Recruiter)</h2>
            <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              <li>Set up your company profile.</li>
              <li>Post jobs and review applicants.</li>
              <li>Shortlist and schedule interviews.</li>
            </ol>
          </div>
        </section>

        <section className="grid">
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0 }}>Hiring trends preview</h2>
              <button className="btn" type="button" onClick={() => navigate("/trends")}>View Hire Trends</button>
            </div>
            <div className="grid grid-3" style={{ marginTop: 12 }}>
              <div className="card card-ghost">
                <div className="muted">Top role</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Frontend Developer</div>
              </div>
              <div className="card card-ghost">
                <div className="muted">Trending skill</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>React + TypeScript</div>
              </div>
              <div className="card card-ghost">
                <div className="muted">Hiring momentum</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Up this quarter</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
