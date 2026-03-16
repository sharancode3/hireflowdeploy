import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { AuthSplitLayout } from "../components/AuthLayout";
import { getPhoneCountryByCode } from "../data/phoneCountries";
import { PhonePickerInput } from "../components/ui/PhonePickerInput";
import { composePhoneWithCode, countDigits } from "../utils/phone";
import { savePendingRegistration } from "../auth/pendingRegistration";
import { signUpWithEmail } from "../services/authService";

function FeatureIcon({ color, path }: { color: string; path: string }) {
  return (
    <span className="recruiter-feature-icon" style={{ color, background: `${color}26` }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d={path} />
      </svg>
    </span>
  );
}

const recruiterFeatureCards = [
  {
    title: "Verified Candidates Only",
    description: "Every applicant profile is complete and reviewed.",
    color: "var(--color-success)",
    iconPath: "M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4zm-3 9l2 2 4-4",
  },
  {
    title: "Admin-Approved Postings",
    description: "Your listings go live only after Hireflow review.",
    color: "var(--color-accent)",
    iconPath: "M9 6h10v12H5V6h4zm0 0V4h6v2",
  },
  {
    title: "Full Hiring Dashboard",
    description: "Track applicants, manage listings and send updates.",
    color: "var(--accent-purple)",
    iconPath: "M5 19V9M12 19V5M19 19v-7",
  },
] as const;

export function RecruiterRegisterPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [checkingEmail, setCheckingEmail] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [designation, setDesignation] = useState("");
  const [designationSearch, setDesignationSearch] = useState("");
  const [designationOpen, setDesignationOpen] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const roleOptions = [
    "HR Manager",
    "Talent Acquisition Lead",
    "Founder",
    "Recruiter",
    "Hiring Manager",
    "People Operations",
    "Head of HR",
    "Technical Recruiter",
    "Campus Recruiter",
    "Staffing Specialist",
  ];

  const selectedCountry = getPhoneCountryByCode(countryCode);
  const filteredRoles = roleOptions.filter((r) => r.toLowerCase().includes(designationSearch.toLowerCase()));

  const passwordStrength = getPasswordStrength(password);

  function setFieldError(field: string, message?: string) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function isLikelyGibberish(input: string) {
    const clean = input.trim().toLowerCase();
    if (clean.length < 3) return true;
    if (/^(.)\1{2,}$/.test(clean.replace(/\s+/g, ""))) return true;
    if (/\d{2,}/.test(clean)) return true;
    if (clean.length > 5 && !/[aeiou]/.test(clean)) return true;
    return false;
  }

  function validateFullName(value: string) {
    const v = value.trim();
    if (!/^[A-Za-z][A-Za-z\s'-]{1,79}$/.test(v)) {
      return "Please enter a valid full name (letters and spaces only).";
    }
    if (/(.)\1{3,}/.test(v.replace(/\s+/g, ""))) {
      return "Please enter a valid full name (letters and spaces only).";
    }
    return "";
  }

  function validateEmail(value: string) {
    const v = value.trim().toLowerCase();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    if (!emailRegex.test(v)) return "Please enter a valid work email address.";
    return "";
  }

  function validateCompanyName(value: string) {
    const v = value.trim();
    if (v.length < 2 || v.length > 100) return "Please enter a valid company name.";
    if (/^\d+$/.test(v)) return "Please enter a valid company name.";
    if (/^(.)\1{3,}$/i.test(v.replace(/\s+/g, ""))) return "Please enter a valid company name.";
    return "";
  }

  function validateWebsite(value: string) {
    if (!value.trim()) return "Please enter a valid URL, e.g. https://yourcompany.com";
    try {
      const url = new URL(value.trim());
      if (!(url.protocol === "https:" || url.protocol === "http:")) {
        return "Please enter a valid URL, e.g. https://yourcompany.com";
      }
      if (!/[.]([a-z]{2,})$/i.test(url.hostname)) {
        return "Please enter a valid URL, e.g. https://yourcompany.com";
      }
      return "";
    } catch {
      return "Please enter a valid URL, e.g. https://yourcompany.com";
    }
  }

  function validateDesignation(value: string) {
    const v = value.trim();
    if (v.length < 3 || isLikelyGibberish(v)) return "Please enter a valid role or designation.";
    return "";
  }

  function validatePhone(value: string) {
    const digits = countDigits(value);
    if (!digits) return "Please enter a valid phone number for the selected country.";
    if (digits < selectedCountry.min || digits > selectedCountry.max) {
      return "Please enter a valid phone number for the selected country.";
    }
    return "";
  }

  async function checkEmailExists(candidate: string) {
    const normalized = candidate.trim().toLowerCase();
    const formatErr = validateEmail(normalized);
    if (formatErr) {
      setFieldError("email", formatErr);
      return;
    }
    setCheckingEmail(true);
    try {
      setFieldError("email");
    } catch {
      // noop on network failure
    } finally {
      setCheckingEmail(false);
    }
  }

  function validateAllFields() {
    const next: Record<string, string> = {};
    const fullNameErr = validateFullName(fullName);
    const emailErr = validateEmail(email);
    const companyErr = validateCompanyName(companyName);
    const websiteErr = validateWebsite(companyWebsite);
    const desigErr = validateDesignation(designation);
    const phoneErr = validatePhone(phone);

    if (fullNameErr) next.fullName = fullNameErr;
    if (emailErr) next.email = emailErr;
    if (passwordStrength.level === "weak") {
      next.password = "Password is too weak. Use a mix of uppercase, lowercase, numbers, and symbols.";
    }
    if (companyErr) next.companyName = companyErr;
    if (websiteErr) next.companyWebsite = websiteErr;
    if (desigErr) next.designation = desigErr;
    if (phoneErr) next.phone = phoneErr;

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  const hasBlockingErrors = busy || checkingEmail || Object.keys(fieldErrors).length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateAllFields()) return;
    setBusy(true);
    setError(null);

    try {
      await signUpWithEmail(email.trim().toLowerCase(), password, {
        // TODO: supabase.auth.signUp({ email, password, options: { data: { full_name, role, phone } } })
        fullName,
        role: "RECRUITER",
        phone: composePhoneWithCode(countryCode, phone),
        companyName,
      });
      localStorage.setItem(
        "hireflow_recruiter_application_summary",
        JSON.stringify({
          fullName,
          email: email.trim().toLowerCase(),
          companyName,
          designation,
          status: "PENDING",
          submittedAt: new Date().toISOString(),
        }),
      );
      savePendingRegistration({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        mobile: composePhoneWithCode(countryCode, phone),
        role: "RECRUITER",
        companyName: companyName.trim(),
      });
      navigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`, { replace: true });
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Unable to submit recruiter registration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout
      pageClassName="text-text recruiter-register-page"
      leftPanelClassName="recruiter-left-panel"
      rightPanelClassName="recruiter-right-panel"
      leftPanel={
        <>
          <div className="recruiter-left-orb" />
          <div className="recruiter-left-logo-wrap">
            <Logo />
          </div>
          <div className="recruiter-left-content">
            <div className="space-y-4">
              <h1 className="text-[40px] font-bold leading-tight text-text">Hire smarter with Hireflow.</h1>
              <p className="max-w-xl text-base leading-[1.6] text-text-muted">
                Post verified jobs, reach the right candidates and manage your entire hiring pipeline in one place.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {recruiterFeatureCards.map((item, idx) => (
                <div
                  key={item.title}
                  className="recruiter-feature-card"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <FeatureIcon color={item.color} path={item.iconPath} />
                  <div>
                    <div className="text-sm font-semibold text-text">{item.title}</div>
                    <div className="recruiter-feature-desc text-[13px] text-text-muted">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      }
      rightPanel={
        <div className="auth-form-card recruiter-form-card recruiter-form-shell w-full">
          {/* TODO: Audit all fixed-width values on recruiter register page and replace with responsive units (%, rem, vw/vh, clamp). */}
          <h2 className="mb-[6px] text-2xl font-bold text-text">Create Recruiter Account</h2>
          <p className="mb-6 text-[13px] text-text-secondary">Fill in your details below. Your account will be reviewed before activation.</p>

          <div className="h-1.5 w-full rounded-full bg-surface-raised">
            <div className="h-full w-1/2 rounded-full bg-[linear-gradient(90deg,var(--color-accent)_0%,var(--color-accent-hover)_100%)]" />
          </div>

          {error ? <div className="mt-4 rounded-lg border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

          <form className="recruiter-form-fields mt-5" onSubmit={onSubmit}>
            <label className="field">
              <span className="label">Full Name</span>
              <input
                className="input"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setFieldError("fullName", validateFullName(e.target.value) || undefined);
                }}
              />
              {fieldErrors.fullName ? <span className="text-xs text-danger">{fieldErrors.fullName}</span> : null}
            </label>

            <label className="field">
              <span className="label">Work Email Address</span>
              <input
                className="input"
                required
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldError("email", validateEmail(e.target.value) || undefined);
                }}
                onBlur={(e) => {
                  const normalized = e.target.value.trim().toLowerCase();
                  setEmail(normalized);
                  void checkEmailExists(normalized);
                }}
              />
              {checkingEmail ? <span className="text-xs text-text-secondary">Checking email availability...</span> : null}
              {fieldErrors.email ? <span className="text-xs text-danger">{fieldErrors.email}</span> : null}
            </label>

            <label className="field">
              <span className="label">Password</span>
              <span className="flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]">
                <input
                  className="h-full w-full border-0 bg-transparent px-0 text-sm text-text outline-none"
                  required
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (getPasswordStrength(e.target.value).level === "weak") {
                      setFieldError("password", "Password is too weak. Use a mix of uppercase, lowercase, numbers, and symbols.");
                    } else {
                      setFieldError("password");
                    }
                  }}
                />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)} className="text-xs text-text-secondary hover:text-text">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span>Password strength:</span>
                <span className={passwordStrength.level === "strong" ? "text-green-500" : passwordStrength.level === "medium" ? "text-amber-500" : "text-danger"}>
                  {passwordStrength.label}
                </span>
              </div>
              {fieldErrors.password ? <span className="text-xs text-danger">{fieldErrors.password}</span> : null}
            </label>

            <label className="field">
              <span className="label">Company Name</span>
              <input
                className="input"
                required
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setFieldError("companyName", validateCompanyName(e.target.value) || undefined);
                }}
              />
              {fieldErrors.companyName ? <span className="text-xs text-danger">{fieldErrors.companyName}</span> : null}
            </label>

            <label className="field">
              <span className="label">Company Website</span>
              <input
                className="input"
                required
                type="url"
                placeholder="https://example.com"
                value={companyWebsite}
                onChange={(e) => {
                  setCompanyWebsite(e.target.value);
                  setFieldError("companyWebsite", validateWebsite(e.target.value) || undefined);
                }}
              />
              {fieldErrors.companyWebsite ? <span className="text-xs text-danger">{fieldErrors.companyWebsite}</span> : null}
            </label>

            <label className="field relative">
              <span className="label">Your Role or Designation</span>
              <input
                className="input"
                required
                placeholder="HR Manager, Founder, Talent Lead"
                value={designationSearch || designation}
                onFocus={() => setDesignationOpen(true)}
                onChange={(e) => {
                  setDesignationSearch(e.target.value);
                  setDesignation(e.target.value);
                  setFieldError("designation", validateDesignation(e.target.value) || undefined);
                }}
                onBlur={() => {
                  setTimeout(() => setDesignationOpen(false), 120);
                }}
              />
              {designationOpen ? (
                <div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-surface p-1 shadow-lift">
                  {filteredRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      className="w-full rounded px-3 py-2 text-left text-sm text-text hover:bg-surface-raised"
                      onMouseDown={() => {
                        setDesignation(role);
                        setDesignationSearch(role);
                        setDesignationOpen(false);
                        setFieldError("designation");
                      }}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              ) : null}
              {fieldErrors.designation ? <span className="text-xs text-danger">{fieldErrors.designation}</span> : null}
            </label>

            <label className="field relative">
              <span className="label">Phone Number</span>
              <PhonePickerInput
                className="w-full"
                countryCode={countryCode}
                onCountryCodeChange={(code) => {
                  setCountryCode(code);
                  const country = getPhoneCountryByCode(code);
                  const digits = countDigits(phone);
                  if (!digits || digits < country.min || digits > country.max) {
                    setFieldError("phone", "Please enter a valid phone number for the selected country.");
                  } else {
                    setFieldError("phone");
                  }
                }}
                value={phone}
                onChange={(value) => {
                  setPhone(value);
                  setFieldError("phone", validatePhone(value) || undefined);
                }}
                required
                placeholder="9876543210"
              />
              {fieldErrors.phone ? <span className="text-xs text-danger">{fieldErrors.phone}</span> : null}
            </label>

            <div className="recruiter-notice-box">
              Your account will be reviewed by the Hireflow admin team before you can post jobs. This typically takes 1 to 2 business days.
            </div>

            <button type="submit" disabled={hasBlockingErrors} className="recruiter-submit-btn disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Submitting..." : "Submit for Review"}
            </button>
          </form>

          <div className="mt-4 text-center text-[13px] text-text-secondary">
            Already have recruiter credentials? <Link className="text-[var(--color-accent)] hover:underline" to="/recruiter/login">Back to recruiter login</Link>
          </div>
        </div>
      }
    />
  );
}

function getPasswordStrength(password: string): { level: "weak" | "medium" | "strong"; label: string } {
  const length = password.length;
  const checks = [/[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  if (length >= 10 && checks >= 3) return { level: "strong", label: "Strong" };
  if (length >= 8 && checks >= 2) return { level: "medium", label: "Medium" };
  return { level: "weak", label: "Weak" };
}
