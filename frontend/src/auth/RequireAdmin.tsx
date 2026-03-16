import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { config } from "../config";

export function RequireAdmin() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="card">Restoring your session...</div>;
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const email = user.email.trim().toLowerCase();
  const inAllowlist = config.adminEmails.includes(email);

  if (!inAllowlist) {
    return <Navigate to={user.role === "JOB_SEEKER" ? "/job-seeker/dashboard" : "/recruiter/dashboard"} replace />;
  }

  return <Outlet />;
}
