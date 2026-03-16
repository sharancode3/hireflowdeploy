import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { resendVerificationEmail } from "../services/authService";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const initialEmail = params.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const canResend = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function onResend(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await resendVerificationEmail(email);
      setSent(true);
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend verification email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-shell" style={{ gridTemplateColumns: "1fr", maxWidth: 780 }}>
          <section className="auth-card" aria-label="Verify email">
            <Logo />
            <h2 style={{ marginTop: 12 }}>Confirm your email</h2>
            <p className="auth-subtitle">
              Check your inbox. We sent a confirmation link to <strong>{email || "your email"}</strong>. Click the link to activate your account.
            </p>

            {error ? (
              <div className="card border-danger/60 bg-danger/10 text-danger" style={{ padding: 12, marginTop: 12 }}>
                {error}
              </div>
            ) : null}

            {sent ? (
              <div className="card" style={{ padding: 12, marginTop: 12 }}>
                Email resent. Please check your inbox and spam folder.
              </div>
            ) : null}

            <p className="muted" style={{ marginTop: 12 }}>
              Did not receive the email? Check your spam folder or resend it below.
            </p>

            <form onSubmit={onResend} className="grid" style={{ marginTop: 14 }}>
              <label className="auth-field-block" htmlFor="verify-email-input">
                <span className="auth-label">EMAIL ADDRESS</span>
                <span className="auth-input-shell">
                  <input
                    id="verify-email-input"
                    className="auth-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </span>
              </label>

              <div className="auth-actions">
                <button className="btn btn-primary" type="submit" disabled={busy || !canResend || cooldown > 0}>
                  {busy ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
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
