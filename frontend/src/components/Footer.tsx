import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <div className="brand" style={{ pointerEvents: "none" }} aria-hidden="true">
            <span className="brand-mark" />
            <span className="brand-name">Hireflow</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            A clean, modern platform for hiring and job searching.
          </p>
        </div>

        <div className="footer-links" aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/trends">Hire Trends</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </div>
      </div>
    </footer>
  );
}
