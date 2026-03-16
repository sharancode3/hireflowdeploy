import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { resendVerificationEmail } from "../services/authService";
import { useState } from "react";

export function RecruiterPendingPage() {
  const { user, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const summary = useMemo(() => {
    try {
      const raw = localStorage.getItem("hireflow_recruiter_application_summary");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const status = user?.recruiterApprovalStatus ?? "PENDING";
  const steps = ["Application Submitted", "Under Admin Review", "Account Approved", "Account Active"];
  const activeStep = status === "APPROVED" ? 4 : status === "PENDING" ? 2 : 1;

  useEffect(() => {
    if (status === "APPROVED") {
      navigate("/recruiter/dashboard", { replace: true });
      return;
    }

    const id = window.setInterval(() => {
      void refreshMe();
    }, 20000);

    return () => window.clearInterval(id);
  }, [status, refreshMe, navigate]);

  async function onResendVerification() {
    if (!user?.email || resendBusy || status !== "PENDING") return;
    setResendBusy(true);
    setResendMessage(null);
    setResendError(null);
    try {
      await resendVerificationEmail(user.email);
      setResendMessage("Verification email resent.");
    } catch (err) {
      if (err instanceof Error) setResendError(err.message);
      else setResendError("Unable to resend verification email.");
    } finally {
      setResendBusy(false);
    }
  }

  function onSwitchAccount() {
    logout();
    navigate("/recruiter/login", { replace: true });
  }

  return (
    <div className="auth-split-page text-text">
      <div className="auth-split-layout">
        <aside className="auth-left-panel">
          <div className="login-left-orb" />
          <div className="space-y-5">
            <h1 className="text-4xl font-bold leading-tight text-text">Recruiter Verification</h1>
            <p className="max-w-md text-sm text-text-secondary">
              Your Hireflow recruiter profile is now in the review queue.
            </p>
          </div>
        </aside>

        <section className="auth-right-panel">
          <div className="auth-form-card space-y-5">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--color-success)_10%,transparent)] text-[var(--color-success)] recruiter-checkmark">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-center text-3xl font-bold text-text">Application Submitted</h1>
            <p className="text-center text-sm leading-relaxed text-text-secondary">
              We have received your recruiter application. Our team will verify your details and notify you at your registered email.
              You cannot post jobs until your account is approved.
            </p>
            {status === "REJECTED" ? (
              <div className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
                Your recruiter application was rejected. Contact support at <a className="underline" href="mailto:support@hireflow.local">support@hireflow.local</a>.
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Application Progress</div>
              <div className="space-y-2">
                {steps.map((step, idx) => {
                  const stepNo = idx + 1;
                  const done = stepNo <= activeStep;
                  return (
                    <div key={step} className="flex items-center gap-2 text-sm">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${done ? "border-accent bg-accent text-[var(--color-sidebar-active-text)]" : "border-border text-text-secondary"}`}>
                        {stepNo}
                      </span>
                      <span className={done ? "text-text" : "text-text-secondary"}>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {summary ? (
              <div className="rounded-xl border border-border bg-surface p-4 text-sm">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Submitted Details</div>
                <div>Name: {summary.fullName}</div>
                <div>Company: {summary.companyName}</div>
                <div>Email: {summary.email}</div>
                <div>Role: {summary.designation}</div>
              </div>
            ) : null}

            <div className="text-xs text-text-secondary">Account reviews typically take 1-2 business days.</div>

            {resendMessage ? <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">{resendMessage}</div> : null}
            {resendError ? <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{resendError}</div> : null}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void onResendVerification()}
                disabled={resendBusy || status !== "PENDING"}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendBusy ? "Sending..." : "Resend Verification Email"}
              </button>
              <button
                type="button"
                onClick={onSwitchAccount}
                className="text-sm text-[var(--color-accent)] hover:text-text"
              >
                Log out and go to Recruiter Login
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
