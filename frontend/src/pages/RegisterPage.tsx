import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthLayout";
import { Logo } from "../components/Logo";
import { PhonePickerInput } from "../components/ui/PhonePickerInput";
import { getPhoneCountryByCode } from "../data/phoneCountries";
import { countDigits } from "../utils/phone";
import { savePendingRegistration } from "../auth/pendingRegistration";
import { signUpWithEmail } from "../services/authService";
import type { UserRole } from "../types";

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

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 21a8 8 0 00-16 0" />
      <circle cx="12" cy="8" r="4" />
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
    description: "Every listing is screened so you spend time only on quality roles.",
    color: "#22C55E",
    iconPath: "M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4zm-3 9l2 2 4-4",
  },
  {
    title: "AI Match Insights",
    description: "Get recommendations based on your profile and goals.",
    color: "#1A73E8",
    iconPath: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
  },
  {
    title: "One Unified Flow",
    description: "Applications, interviews, and decisions in one dashboard.",
    color: "#F59E0B",
    iconPath: "M4 19V5m8 14V9m8 10V7",
  },
] as const;

function getPasswordStrength(password: string): { level: "weak" | "medium" | "strong"; label: string; fill: number } {
  const length = password.length;
  const charTypes = [/[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;

  if (length >= 10 && charTypes >= 3) return { level: "strong", label: "Strong", fill: 100 };
  if (length >= 8 && charTypes >= 2) return { level: "medium", label: "Medium", fill: 66 };
  return { level: "weak", label: "Weak", fill: 33 };
}

export function RegisterPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("JOB_SEEKER");

  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedCountry = getPhoneCountryByCode(countryCode);
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  function setFieldError(field: string, message?: string) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function validateEmail(value: string): string {
    const v = value.trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    return ok ? "" : "Please enter a valid email address.";
  }

  function validatePassword(value: string): string {
    return getPasswordStrength(value).level === "weak"
      ? "Use at least 8 chars and mix uppercase/lowercase/numbers/symbols."
      : "";
  }

  function validateFullName(value: string): string {
    const v = value.trim();
    if (!/^[A-Za-z][A-Za-z\s'-]{1,79}$/.test(v)) return "Please enter your full name.";
    return "";
  }

  function validatePhone(value: string): string {
    const digits = countDigits(value);
    if (digits < selectedCountry.min || digits > selectedCountry.max) {
      return "Please enter a valid phone number.";
    }
    return "";
  }

  function validateStep1() {
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    setFieldError("email", emailErr || undefined);
    setFieldError("password", passwordErr || undefined);
    return !emailErr && !passwordErr;
  }

  function validateStep2() {
    const fullNameErr = validateFullName(fullName);
    const phoneErr = validatePhone(phone);
    setFieldError("fullName", fullNameErr || undefined);
    setFieldError("phone", phoneErr || undefined);
    return !fullNameErr && !phoneErr;
  }

  async function onContinue(e: FormEvent) {
    e.preventDefault();
    if (!validateStep1()) return;

    if (role === "RECRUITER") {
      navigate("/recruiter/register", { replace: true });
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await signUpWithEmail(email.trim().toLowerCase(), password, { role: "JOB_SEEKER" });
      savePendingRegistration({ email: email.trim().toLowerCase(), role: "JOB_SEEKER" });
      setStep(2);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create account right now.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function onStep2Continue(e: FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;

    const normalizedEmail = email.trim().toLowerCase();
    const mobile = `${countryCode} ${phone}`.trim();

    savePendingRegistration({
      email: normalizedEmail,
      fullName: fullName.trim(),
      mobile,
      role: "JOB_SEEKER",
    });

    navigate(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`, { replace: true });
  }

  const progressFill = step === 1 ? "50%" : "100%";

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
              <h1 className="auth-hero-title">Start your journey.</h1>
              <p className="auth-hero-subtitle">
                Build your profile once and let Hireflow route you to better opportunities.
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
            {error ? (
              <div className="auth-error-banner mb-5" role="alert">
                <span>{error}</span>
                <button type="button" aria-label="Dismiss error" className="auth-error-dismiss" onClick={() => setError(null)}>
                  x
                </button>
              </div>
            ) : null}

            <div className="mb-4">
              <h2 className="auth-card-title">{step === 1 ? "Register" : "Almost there."}</h2>
              <p className="auth-card-subtitle">
                {step === 1 ? "Step 1 of 2 - create your account." : "Step 2 of 2 - your details before confirmation."}
              </p>
            </div>

            <div className="auth-progress-track" aria-label="Registration progress">
              <span className="auth-progress-fill" style={{ width: progressFill }} />
            </div>

            {step === 1 ? (
              <form onSubmit={onContinue} className="mt-5 space-y-4">
                <label className="auth-field-block">
                  <span className="auth-label">I AM A...</span>
                  <div className="auth-role-toggle">
                    <button
                      type="button"
                      className={role === "JOB_SEEKER" ? "active" : ""}
                      onClick={() => setRole("JOB_SEEKER")}
                    >
                      Job Seeker
                    </button>
                    <button
                      type="button"
                      className={role === "RECRUITER" ? "active" : ""}
                      onClick={() => setRole("RECRUITER")}
                    >
                      Recruiter
                    </button>
                  </div>
                </label>

                <label className="auth-field-block">
                  <span className="auth-label">EMAIL ADDRESS</span>
                  <span className="auth-input-shell">
                    <span className="auth-input-icon" aria-hidden="true"><MailIcon /></span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldError("email", validateEmail(e.target.value) || undefined);
                      }}
                      onBlur={() => setFieldError("email", validateEmail(email) || undefined)}
                      className="auth-input"
                      placeholder="you@example.com"
                    />
                  </span>
                  {fieldErrors.email ? <span className="auth-field-error">{fieldErrors.email}</span> : null}
                </label>

                <label className="auth-field-block">
                  <span className="auth-label">PASSWORD</span>
                  <span className="auth-input-shell">
                    <span className="auth-input-icon" aria-hidden="true"><LockIcon /></span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldError("password", validatePassword(e.target.value) || undefined);
                      }}
                      className="auth-input"
                      placeholder="Create a password"
                    />
                    <button type="button" className="auth-toggle" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>

                  <div className="auth-strength-wrap">
                    <div className="auth-strength-track">
                      <span className={`auth-strength-fill auth-strength-${passwordStrength.level}`} style={{ width: `${passwordStrength.fill}%` }} />
                    </div>
                    <span className={`auth-strength-label auth-strength-${passwordStrength.level}`}>{passwordStrength.label}</span>
                  </div>
                  {fieldErrors.password ? <span className="auth-field-error">{fieldErrors.password}</span> : null}
                </label>

                <button type="submit" disabled={busy} className="auth-submit-btn">
                  {busy ? <span className="auth-spinner" aria-label="Creating account" /> : role === "RECRUITER" ? "Continue as Recruiter" : "Continue"}
                </button>

                <div className="text-center text-sm text-text-secondary">
                  Already have an account? <Link to="/login" className="auth-inline-link">Sign in</Link>
                </div>
              </form>
            ) : (
              <form onSubmit={onStep2Continue} className="mt-5 space-y-4">
                <label className="auth-field-block">
                  <span className="auth-label">FULL NAME</span>
                  <span className="auth-input-shell">
                    <span className="auth-input-icon" aria-hidden="true"><UserIcon /></span>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (fieldErrors.fullName) setFieldError("fullName", validateFullName(e.target.value) || undefined);
                      }}
                      className="auth-input"
                      placeholder="Your full name"
                    />
                  </span>
                  {fieldErrors.fullName ? <span className="auth-field-error">{fieldErrors.fullName}</span> : null}
                </label>

                <label className="auth-field-block">
                  <span className="auth-label">PHONE NUMBER</span>
                  <PhonePickerInput
                    className="auth-phone-wrap"
                    value={phone}
                    onChange={(value) => {
                      setPhone(value);
                      if (fieldErrors.phone) setFieldError("phone", validatePhone(value) || undefined);
                    }}
                    countryCode={countryCode}
                    onCountryCodeChange={(code) => {
                      setCountryCode(code);
                      if (phone) setFieldError("phone", validatePhone(phone) || undefined);
                    }}
                    required
                    placeholder="9876543210"
                  />
                  {fieldErrors.phone ? <span className="auth-field-error">{fieldErrors.phone}</span> : null}
                </label>

                <button type="submit" className="auth-submit-btn">Continue</button>

                <button type="button" className="auth-back-link" onClick={() => setStep(1)}>
                  Back
                </button>
              </form>
            )}
          </div>
        </div>
      }
    />
  );
}
