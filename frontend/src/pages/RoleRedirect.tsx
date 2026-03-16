import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RoleRedirect(props: { jobSeekerTo: string; recruiterTo: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="card">Restoring your session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === "RECRUITER" && (user.recruiterApprovalStatus === "PENDING" || user.recruiterApprovalStatus === "REJECTED")) {
    return <Navigate to="/recruiter/pending" replace />;
  }

  return <Navigate to={user.role === "JOB_SEEKER" ? props.jobSeekerTo : props.recruiterTo} replace />;
}
