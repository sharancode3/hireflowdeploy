import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthLayout";
import { Logo } from "../components/Logo";
import { useAuth } from "../auth/AuthContext";
import { resendVerificationEmail, signInWithEmail } from "../services/authService";

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

function FeatureIcon({ color, path }: { color: string; path: string }) {
  return (
    <span className="auth-feature-icon" style={{ color, background: `${color}1A` }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d={path} />
      </svg>
    </span>
  );
}

const featureCards = [
  {
    title: "Verified Opportunities",
    description: "Every listing is screened so candidates and teams move with confidence.",
    color: "#22C55E",
    iconPath: "M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4zm-3 9l2 2 4-4",
  },
  {
    title: "AI Match Insights",
    description: "Hireflow highlights best-fit roles and applicants faster.",
    color: "#1A73E8",
    iconPath: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
  },
  {
    title: "Pipeline Clarity",
    description: "Track applications, interviews, and decisions in one clean flow.",
    color: "#F59E0B",
    iconPath: "M4 19V5m8 14V9m8 10V7",
  },
] as const;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "";
  const verify = params.get("verify") === "1";
  const verified = params.get("verified") === "1";
  const callbackError = params.get("error") === "confirmation_failed";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const payload = await signInWithEmail(email, password);
      login(payload);
      navigate(next || "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in right now.");
    } finally {
      setBusy(false);
    }
  }

  async function onResendConfirmation() {
    if (!email.trim()) {
      setError("Enter your email above, then click resend confirmation.");
      return;
    }
    setResending(true);
    setResent(false);
    try {
      await resendVerificationEmail(email.trim());
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend confirmation email right now.");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthSplitLayout
      pageClassName="text-text auth-premium-page"
      leftPanel={
        <>
          <div className="auth-hero-pattern" />
          <div className="auth-left-logo-wrap">
            <Logo />
          </div>
          <div className="auth-left-content relative z-10">
            <div className="space-y-4">
              <h1 className="auth-hero-title">Connect talent to opportunity.</h1>
              <p className="auth-hero-subtitle">
                Hireflow gives your hiring workflow clarity, speed, and trust from the first click.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {featureCards.map((item) => (
                <div key={item.title} className="auth-feature-row">
                  <FeatureIcon color={item.color} path={item.iconPath} />
                  <div>
                    <div className="auth-feature-title">{item.title}</div>
                    <div className="auth-feature-description">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      }
      rightPanel={
        <div className="auth-form-wrap w-full">
          <div className="auth-form-card login-form-card auth-card-premium">
            <div className="mb-8 flex justify-center">
              <Logo />
            </div>

            <div className="mb-8 text-center">
              <h2 className="auth-card-title">Welcome back</h2>
              <p className="auth-card-subtitle">Sign in to continue to Hireflow</p>
            </div>

            {verify ? (
              <div className="card mb-5" style={{ padding: 12 }} role="status">
                Account created. Please check your email and confirm your address before signing in.
              </div>
            ) : null}

            {verified ? (
              <div className="card mb-5" style={{ padding: 12 }} role="status">
                Email verified successfully. You can sign in now.
              </div>
            ) : null}

            {callbackError ? (
              <div className="card mb-5" style={{ padding: 12 }} role="alert">
                We could not confirm your email link. Please request a new confirmation email and try again.
              </div>
            ) : null}

            {error ? (
              <div className="auth-error-banner mb-5" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  className="auth-error-dismiss"
                  onClick={() => setError(null)}
                >
                  x
                </button>
              </div>
            ) : null}

            {resent ? (
              <div className="card mb-5" style={{ padding: 12 }} role="status">
                Confirmation email resent. Check inbox and spam folder.
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
              <label className="auth-field-block">
                <span className="auth-label">EMAIL ADDRESS</span>
                <span className="auth-input-shell">
                  <span className="auth-input-icon" aria-hidden="true"><MailIcon /></span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input"
                    placeholder="you@example.com"
                  />
                </span>
              </label>

              <label className="auth-field-block">
                <span className="auth-label">PASSWORD</span>
                <span className="auth-input-shell">
                  <span className="auth-input-icon" aria-hidden="true"><LockIcon /></span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="auth-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </label>

              <div className="text-right">
                <Link to="/forgot-password" className="auth-inline-link">Forgot password?</Link>
              </div>

              {error?.toLowerCase().includes("verify your email") ? (
                <button type="button" className="auth-inline-link" onClick={onResendConfirmation} disabled={resending}>
                  {resending ? "Resending..." : "Resend confirmation email"}
                </button>
              ) : null}

              <button type="submit" disabled={busy} className="auth-submit-btn">
                {busy ? <span className="auth-spinner" aria-label="Signing in" /> : "Sign in"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-text-secondary">
              New to Hireflow? <Link to="/register" className="auth-inline-link">Create an account</Link>
            </div>
          </div>
        </div>
      }
    />
  );
}
