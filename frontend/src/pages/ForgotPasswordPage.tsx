import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { config } from "../config";
import { supabase } from "../lib/supabaseClient";

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getResetRedirectUrl() {
    const base = import.meta.env.BASE_URL || "/";
    const prefix = base === "/" ? "" : base.replace(/\/$/, "");
    const pathForSpa = "reset-password";
    const lowerAppUrl = config.publicAppUrl.toLowerCase();
    const lowerPrefix = prefix.toLowerCase();
    const appBase = config.publicAppUrl
      ? (prefix && lowerAppUrl.endsWith(lowerPrefix) ? config.publicAppUrl : `${config.publicAppUrl}${prefix}`)
      : `${window.location.origin}${prefix}`;

    // Use `/?/path` format so static hosts (e.g. GitHub Pages) can restore SPA routes.
    return `${appBase}/?/${pathForSpa}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getResetRedirectUrl(),
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-shell" style={{ gridTemplateColumns: "1fr", maxWidth: 780 }}>
          <section className="auth-card" aria-label="Password reset">
            <Logo />
            <h2 style={{ marginTop: 12 }}>Reset password</h2>
            <p className="auth-subtitle">
              Enter your email and we will send a secure reset link.
            </p>

            {error ? <div className="card border-danger/60 bg-danger/10 text-danger" style={{ padding: 12, marginTop: 12 }}>{error}</div> : null}

            {sent ? (
              <div className="card" style={{ padding: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 900 }}>Check your inbox</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  If an account exists for <span style={{ fontWeight: 700 }}>{email}</span>, a reset link would be sent.
                </div>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="grid" style={{ marginTop: 14 }}>
              <label className="auth-field-block" htmlFor="email">
                <span className="auth-label">EMAIL ADDRESS</span>
                <span className="auth-input-shell">
                  <span className="auth-input-icon" aria-hidden="true"><MailIcon /></span>
                  <input
                    id="email"
                    className="auth-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </span>
              </label>

              <div className="auth-actions">
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? "Sending..." : "Send reset link"}
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
