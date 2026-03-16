import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "../types";
import { useAuth } from "./AuthContext";
import { hasCompletedOnboarding } from "./onboarding";

export function RequireAuth({ role }: { role?: UserRole }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="card">Restoring your session...</div>;
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (user.isAdmin) {
    if (role && role !== user.role) {
      return <Navigate to="/admin" replace />;
    }
    if (location.pathname === "/onboarding") {
      return <Navigate to="/admin" replace />;
    }
    return <Outlet />;
  }

  if (user.role === "RECRUITER") {
    const status = user.recruiterApprovalStatus ?? "PENDING";

    if ((status === "PENDING" || status === "REJECTED") && location.pathname !== "/recruiter/pending") {
      return <Navigate to="/recruiter/pending" replace />;
    }

    if (status === "APPROVED" && location.pathname === "/recruiter/pending") {
      return <Navigate to="/recruiter/dashboard" replace />;
    }
  }

  const isOnboardingRoute = location.pathname === "/onboarding";
  const isDone = hasCompletedOnboarding(user.id);
  if (!isDone && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }
  if (isDone && isOnboardingRoute) {
    return <Navigate to={user.role === "JOB_SEEKER" ? "/job-seeker" : "/recruiter/dashboard"} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === "JOB_SEEKER" ? "/job-seeker" : "/recruiter/dashboard"} replace />;
  }

  return <Outlet />;
}
