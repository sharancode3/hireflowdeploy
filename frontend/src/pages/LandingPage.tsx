import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div className="container">
      <div className="page-narrow grid">
        <div className="card" style={{ textAlign: "center" }}>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Hireflow</h1>
          <p className="muted" style={{ margin: 0 }}>
            Choose your role to continue.
          </p>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>Job Seeker</h2>
            <div className="button-row" style={{ justifyContent: "flex-start" }}>
              <Link className="btn btn-primary" to="/login">
                Login
              </Link>
              <Link className="btn" to="/register?role=JOB_SEEKER">
                Register
              </Link>
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>Recruiter (Hire)</h2>
            <div className="button-row" style={{ justifyContent: "flex-start" }}>
              <Link className="btn btn-primary" to="/login">
                Login
              </Link>
              <Link className="btn" to="/register?role=RECRUITER">
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
