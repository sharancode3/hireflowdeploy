import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "./Logo";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />

        <nav className="nav" aria-label="Primary">
          <NavLink to="/" className={({ isActive }) => (isActive ? "active" : undefined)} end>
            Home
          </NavLink>
          <NavLink to="/trends" className={({ isActive }) => (isActive ? "active" : undefined)}>
            Hire Trends
          </NavLink>
          {!user ? (
            <>
              <NavLink to="/login" className={({ isActive }) => (isActive ? "active" : undefined)}>
                Login
              </NavLink>
              <NavLink to="/register" className={({ isActive }) => (isActive ? "active" : undefined)}>
                Register
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to={user.role === "JOB_SEEKER" ? "/job-seeker" : "/recruiter"}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                Dashboard
              </NavLink>
              <button className="btn" onClick={logout} type="button">
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
