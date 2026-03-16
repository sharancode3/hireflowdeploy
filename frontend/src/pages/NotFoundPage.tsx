import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Page not found</h2>
        <p className="muted">The page you requested doesn’t exist.</p>
        <Link to="/" className="btn btn-primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
