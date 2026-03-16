import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireGuest() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="card">Restoring your session...</div>;
  }

  if (user) {
    if (user.isAdmin) {
      return <Navigate to="/admin" replace />;
    }
    if (user.role === "RECRUITER") {
      if (user.recruiterApprovalStatus === "APPROVED") {
        return <Navigate to="/recruiter/dashboard" replace />;
      }
      return <Navigate to="/recruiter/pending" replace />;
    }
    return <Navigate to="/job-seeker" replace />;
  }

  return <Outlet />;
}
