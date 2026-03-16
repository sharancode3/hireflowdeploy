import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthLayout";
import { useAuth } from "../auth/AuthContext";
import { signInWithEmail, signOut } from "../services/authService";

export function RecruiterLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const data = await signInWithEmail(email, password);

      if (data.user.role !== "RECRUITER") {
        await signOut().catch(() => undefined);
        setError("This account is not registered as a recruiter.");
        return;
      }

      login(data);

      if (data.user.recruiterApprovalStatus === "PENDING") {
        navigate("/recruiter/pending", { replace: true });
      } else if (data.user.recruiterApprovalStatus === "REJECTED") {
        navigate("/recruiter/pending", { replace: true });
      } else {
        navigate("/recruiter/dashboard", { replace: true });
      }
    } catch {
      setError("Incorrect email or password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout
      pageClassName="text-text"
      rightPanel={
        <div className="auth-form-card login-form-card w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold text-text">Recruiter Login</h2>
            <p className="text-sm text-text-secondary">Sign in to your recruiter account</p>
          </div>

          {error ? <div className="rounded-xl border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="field">
              <span className="label">Work Email Address</span>
              <input className="input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            <label className="field">
              <span className="label">Password</span>
              <span className="flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:border-accent">
                <input
                  className="h-full w-full border-0 bg-transparent px-0 text-sm text-text outline-none"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)} className="text-xs text-text-secondary hover:text-text">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            <button type="submit" disabled={busy} className="recruiter-submit-btn">
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="text-center text-sm text-text-secondary">
            Need a recruiter account? <Link to="/recruiter/register" className="text-accent hover:underline">Register here</Link>
          </div>
        </div>
      }
      leftPanel={
        <div className="auth-left-content">
          <h1 className="text-4xl font-bold text-text">Recruiter Workspace</h1>
          <p className="mt-3 text-sm text-text-secondary">Manage jobs, applicants, and pipeline updates from one place.</p>
        </div>
      }
    />
  );
}
