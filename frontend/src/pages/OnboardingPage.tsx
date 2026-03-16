import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, apiJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { completeOnboarding } from "../auth/onboarding";
import { PhonePickerInput } from "../components/ui/PhonePickerInput";
import { SearchableLocationInput } from "../components/ui/SearchableLocationInput";
import { composePhoneWithCode } from "../utils/phone";

const statusOptions = ["Student", "Fresher / Entry Level", "Working Professional", "Career Transition", "Other"];
const lookingFor = ["Full-time job", "Part-time job", "Internship", "Freelance", "Remote only"];
const availability = ["Immediately", "Within 2 weeks", "Within a month", "Not actively looking"];

function addTag(list: string[], value: string) {
  const clean = value.trim();
  if (!clean) return list;
  if (list.includes(clean)) return list;
  return [...list, clean];
}

function isOptionalProfileSyncError(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}

export function OnboardingPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [dob, setDob] = useState("");

  const [desiredRole, setDesiredRole] = useState("");
  const [status, setStatus] = useState(statusOptions[0]);
  const [experienceYears, setExperienceYears] = useState(0);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  const [preferences, setPreferences] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [currency, setCurrency] = useState("INR");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [availabilityValue, setAvailabilityValue] = useState(availability[0]);

  const progress = useMemo(() => Math.round((step / 3) * 100), [step]);

  function onSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      setSkills((prev) => addTag(prev, skillInput));
      setSkillInput("");
    }
  }

  function onLocationKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      setPreferredLocations((prev) => addTag(prev, locationInput));
      setLocationInput("");
    }
  }

  async function finish() {
    if (!user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (user.role === "JOB_SEEKER" && token) {
        const payload = {
          fullName: fullName || user.email.split("@")[0],
          phone: composePhoneWithCode(phoneCountryCode, phone),
          location: `${city}${region ? `, ${region}` : ""}`,
          desiredRole,
          experienceYears,
          skills,
        };
        try {
          await apiJson("/job-seeker/profile", { method: "PATCH", token, body: payload });
        } catch (error) {
          // Backend is currently in migration mode and may not expose this endpoint yet.
          if (!isOptionalProfileSyncError(error)) {
            throw error;
          }
        }
      }

      completeOnboarding(user.id);
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message || "Unable to complete onboarding right now.");
      } else {
        setSubmitError("Unable to complete onboarding right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 text-center">
          <h1 className="text-3xl font-bold text-text">You are all set! Welcome to Hireflow.</h1>
          <button
            type="button"
            onClick={() => navigate(user?.role === "JOB_SEEKER" ? "/job-seeker" : "/recruiter")}
            className="btn-base mt-6 h-11 rounded-lg px-6 font-semibold text-[var(--color-sidebar-active-text)]"
            style={{ background: "linear-gradient(120deg, var(--color-accent), var(--color-accent-hover))" }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-4 text-text sm:p-8">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="mb-6">
          <div className="mb-3 h-2 w-full rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-accent),var(--color-accent-hover))]" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Step {step} of 3</div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-text">Personal details</h2>
            <input className="input" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <div className="text-xs text-text-muted">Looks better with a photo! (Photo upload will be added in next milestone.)</div>
            <PhonePickerInput
              className="w-full"
              countryCode={phoneCountryCode}
              onCountryCodeChange={setPhoneCountryCode}
              value={phone}
              onChange={setPhone}
              placeholder="9876543210"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SearchableLocationInput className="input" placeholder="City" value={city} onChange={setCity} />
              <input className="input" placeholder="State / Region" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-text">Career profile</h2>
            <input className="input" placeholder="Desired job role" value={desiredRole} onChange={(e) => setDesiredRole(e.target.value)} />
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min={0}
              value={experienceYears}
              onChange={(e) => setExperienceYears(Math.max(0, Number(e.target.value)))}
              placeholder="Years of experience"
            />
            <div>
              <input
                className="input"
                placeholder="Primary skills (press Enter)"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={onSkillKeyDown}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span key={s} className="rounded-full bg-[color:color-mix(in_srgb,var(--color-accent)_20%,transparent)] px-3 py-1 text-xs text-[var(--color-accent)]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-text">Placement / opportunity preferences</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {lookingFor.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={preferences.includes(item)}
                    onChange={(e) =>
                      setPreferences((prev) =>
                        e.target.checked ? [...prev, item] : prev.filter((x) => x !== item),
                      )
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
            <div>
              <SearchableLocationInput
                className="input"
                placeholder="Preferred locations (press Enter)"
                value={locationInput}
                onChange={setLocationInput}
                onKeyDown={onLocationKeyDown}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {preferredLocations.map((s) => (
                  <span key={s} className="rounded-full bg-[color:color-mix(in_srgb,var(--accent-purple)_20%,transparent)] px-3 py-1 text-xs text-[var(--accent-purple)]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[120px_1fr_1fr]">
              <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option>INR</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
              <input className="input" type="number" placeholder="Min" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
              <input className="input" type="number" placeholder="Max" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
            </div>
            <select className="select" value={availabilityValue} onChange={(e) => setAvailabilityValue(e.target.value)}>
              {availability.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        ) : null}

        {submitError ? (
          <div className="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {submitError}
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
            className="btn-base rounded-lg border border-border px-4 text-text-secondary disabled:opacity-50"
          >
            Back
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              disabled={submitting}
              className="btn-base rounded-lg px-5 font-semibold text-[var(--color-sidebar-active-text)]"
              style={{ background: "linear-gradient(120deg, var(--color-accent), var(--color-accent-hover))" }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void finish()}
              disabled={submitting}
              className="btn-base rounded-lg px-5 font-semibold text-[var(--color-sidebar-active-text)]"
              style={{ background: "linear-gradient(120deg, var(--color-accent), var(--color-accent-hover))" }}
            >
              {submitting ? "Finishing..." : "Finish setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
