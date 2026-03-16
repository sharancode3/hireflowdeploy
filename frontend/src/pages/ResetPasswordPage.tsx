import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { supabase } from "../lib/supabaseClient";

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

function strengthLabel(password: string) {
  const length = password.length;
  const kinds = [/[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  if (length >= 10 && kinds >= 3) return "Strong";
  if (length >= 8 && kinds >= 2) return "Medium";
  return "Weak";
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("This reset link is invalid or expired. Please request a new one.");
        setReady(false);
        return;
      }
      setReady(true);
      setError(null);
    })();
  }, []);

  const passwordStrength = useMemo(() => strengthLabel(password), [password]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-shell" style={{ gridTemplateColumns: "1fr", maxWidth: 780 }}>
          <section className="auth-card" aria-label="Set new password">
            <Logo />
            <h2 style={{ marginTop: 12 }}>Set new password</h2>
            <p className="auth-subtitle">Choose a new password for your account.</p>

            {error ? <div className="card border-danger/60 bg-danger/10 text-danger" style={{ padding: 12, marginTop: 12 }}>{error}</div> : null}
            {done ? (
              <div className="card" style={{ padding: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 900 }}>Password updated</div>
                <div className="muted" style={{ marginTop: 6 }}>Redirecting you to sign in...</div>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="grid" style={{ marginTop: 14 }}>
              <label className="auth-field-block" htmlFor="password">
                <span className="auth-label">NEW PASSWORD</span>
                <span className="auth-input-shell">
                  <span className="auth-input-icon" aria-hidden="true"><LockIcon /></span>
                  <input
                    id="password"
                    className="auth-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Enter new password"
                  />
                </span>
              </label>

              <label className="auth-field-block" htmlFor="confirmPassword" style={{ marginTop: 8 }}>
                <span className="auth-label">CONFIRM PASSWORD</span>
                <span className="auth-input-shell">
                  <span className="auth-input-icon" aria-hidden="true"><LockIcon /></span>
                  <input
                    id="confirmPassword"
                    className="auth-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Re-enter new password"
                  />
                </span>
              </label>

              <div className="muted" style={{ marginTop: 8 }}>Strength: {passwordStrength}</div>

              <div className="auth-actions">
                <button className="btn btn-primary" type="submit" disabled={busy || !ready || done}>
                  {busy ? "Updating..." : "Update password"}
                </button>
                <div className="muted">
                  <Link to="/login">Back to sign in</Link>
                </div>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
