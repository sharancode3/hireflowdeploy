import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { ApiError, apiJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { SearchableLocationInput } from "../../components/ui/SearchableLocationInput";
import {
  getRecruiterJobListingPreferences,
  updateRecruiterJobListingPreferences,
} from "../../services/recruiterJobListingPrefs";

type SubmitState = "idle" | "submitting" | "success" | "error";

type DraftJob = {
  title: string;
  company: string;
  location: string;
  workplaceType: "Onsite" | "Hybrid" | "Remote";
  industry: string;
  experienceLevel: "Entry" | "Mid" | "Senior" | "Lead";
  employmentType: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  description: string;
  requirements: string;
  deadline: string;
  skills: string;
  screeningQuestions: string;
};

const defaultDraft: DraftJob = {
  title: "",
  company: "",
  location: "",
  workplaceType: "Hybrid",
  industry: "",
  experienceLevel: "Mid",
  employmentType: "Full-time",
  salaryMin: "",
  salaryMax: "",
  currency: "USD",
  description: "",
  requirements: "",
  deadline: "",
  skills: "",
  screeningQuestions: ""
};

const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Temporary"
] as const;

const INDUSTRIES = [
  "Software",
  "Fintech",
  "Healthcare",
  "Education",
  "E-commerce",
  "Marketing",
  "Manufacturing"
];

function splitSkills(value: string) {
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function splitQuestions(value: string) {
  return value
    .split("\n")
    .map((q) => q.trim())
    .filter(Boolean);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function toDraftJob(value: Record<string, unknown> | null): DraftJob | null {
  if (!value) return null;

  const workplaceType = value.workplaceType;
  const experienceLevel = value.experienceLevel;

  return {
    title: typeof value.title === "string" ? value.title : defaultDraft.title,
    company: typeof value.company === "string" ? value.company : defaultDraft.company,
    location: typeof value.location === "string" ? value.location : defaultDraft.location,
    workplaceType: workplaceType === "Onsite" || workplaceType === "Hybrid" || workplaceType === "Remote"
      ? workplaceType
      : defaultDraft.workplaceType,
    industry: typeof value.industry === "string" ? value.industry : defaultDraft.industry,
    experienceLevel: experienceLevel === "Entry" || experienceLevel === "Mid" || experienceLevel === "Senior" || experienceLevel === "Lead"
      ? experienceLevel
      : defaultDraft.experienceLevel,
    employmentType: typeof value.employmentType === "string" ? value.employmentType : defaultDraft.employmentType,
    salaryMin: typeof value.salaryMin === "string" ? value.salaryMin : defaultDraft.salaryMin,
    salaryMax: typeof value.salaryMax === "string" ? value.salaryMax : defaultDraft.salaryMax,
    currency: typeof value.currency === "string" ? value.currency : defaultDraft.currency,
    description: typeof value.description === "string" ? value.description : defaultDraft.description,
    requirements: typeof value.requirements === "string" ? value.requirements : defaultDraft.requirements,
    deadline: typeof value.deadline === "string" ? value.deadline : defaultDraft.deadline,
    skills: typeof value.skills === "string" ? value.skills : defaultDraft.skills,
    screeningQuestions: typeof value.screeningQuestions === "string" ? value.screeningQuestions : defaultDraft.screeningQuestions,
  };
}

export function RecruiterPostJobPage() {
  const { token } = useAuth();
  const [title, setTitle] = useState(defaultDraft.title);
  const [company, setCompany] = useState(defaultDraft.company);
  const [location, setLocation] = useState(defaultDraft.location);
  const [workplaceType, setWorkplaceType] = useState<DraftJob["workplaceType"]>(
    defaultDraft.workplaceType
  );
  const [industry, setIndustry] = useState(defaultDraft.industry);
  const [experienceLevel, setExperienceLevel] = useState<DraftJob["experienceLevel"]>(
    defaultDraft.experienceLevel
  );
  const [employmentType, setEmploymentType] = useState(defaultDraft.employmentType);
  const [salaryMin, setSalaryMin] = useState(defaultDraft.salaryMin);
  const [salaryMax, setSalaryMax] = useState(defaultDraft.salaryMax);
  const [currency, setCurrency] = useState(defaultDraft.currency);
  const [description, setDescription] = useState(defaultDraft.description);
  const [requirements, setRequirements] = useState(defaultDraft.requirements);
  const [deadline, setDeadline] = useState(defaultDraft.deadline);
  const [skills, setSkills] = useState(defaultDraft.skills);
  const [screeningQuestions, setScreeningQuestions] = useState(defaultDraft.screeningQuestions);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [saveDraftBusy, setSaveDraftBusy] = useState(false);
  const draftHydratedRef = useRef(false);

  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const isSubmitting = submitState === "submitting";

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const prefs = await getRecruiterJobListingPreferences(token);
        const draft = toDraftJob((prefs.postJobDraft as Record<string, unknown> | null | undefined) ?? null);
        if (!draft) return;
        setTitle(draft.title);
        setCompany(draft.company);
        setLocation(draft.location);
        setWorkplaceType(draft.workplaceType);
        setIndustry(draft.industry);
        setExperienceLevel(draft.experienceLevel);
        setEmploymentType(draft.employmentType);
        setSalaryMin(draft.salaryMin);
        setSalaryMax(draft.salaryMax);
        setCurrency(draft.currency);
        setDescription(draft.description);
        setRequirements(draft.requirements);
        setDeadline(draft.deadline);
        setSkills(draft.skills);
        setScreeningQuestions(draft.screeningQuestions);
      } catch {
        // Draft persistence should not block posting flow.
      } finally {
        draftHydratedRef.current = true;
        setPrefsLoaded(true);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !prefsLoaded || !draftHydratedRef.current) return;

    const draft: DraftJob = {
      title,
      company,
      location,
      workplaceType,
      industry,
      experienceLevel,
      employmentType,
      salaryMin,
      salaryMax,
      currency,
      description,
      requirements,
      deadline,
      skills,
      screeningQuestions
    };

    const timer = window.setTimeout(() => {
      void updateRecruiterJobListingPreferences(token, { postJobDraft: draft }).catch(() => undefined);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    token,
    prefsLoaded,
    title,
    company,
    location,
    workplaceType,
    industry,
    experienceLevel,
    employmentType,
    salaryMin,
    salaryMax,
    currency,
    description,
    requirements,
    deadline,
    skills,
    screeningQuestions
  ]);

  const skillsList = useMemo(() => splitSkills(skills), [skills]);
  const questionsList = useMemo(() => splitQuestions(screeningQuestions), [screeningQuestions]);

  const checklist = [
    { label: "Clear title", complete: title.trim().length >= 4 },
    { label: "Role details", complete: !!industry && !!experienceLevel && !!employmentType },
    { label: "Compensation", complete: !!salaryMin && !!salaryMax },
    { label: "At least 3 skills", complete: skillsList.length >= 3 },
    { label: "Description and requirements", complete: description.trim().length > 40 && requirements.trim().length > 20 }
  ];

  const completion = Math.round(
    (checklist.filter((item) => item.complete).length / checklist.length) * 100
  );

  const resetForm = () => {
    setTitle(defaultDraft.title);
    setCompany(defaultDraft.company);
    setLocation(defaultDraft.location);
    setWorkplaceType(defaultDraft.workplaceType);
    setIndustry(defaultDraft.industry);
    setExperienceLevel(defaultDraft.experienceLevel);
    setEmploymentType(defaultDraft.employmentType);
    setSalaryMin(defaultDraft.salaryMin);
    setSalaryMax(defaultDraft.salaryMax);
    setCurrency(defaultDraft.currency);
    setDescription(defaultDraft.description);
    setRequirements(defaultDraft.requirements);
    setDeadline(defaultDraft.deadline);
    setSkills(defaultDraft.skills);
    setScreeningQuestions(defaultDraft.screeningQuestions);
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!title.trim() || !company.trim() || !location.trim() || !description.trim()) {
      setSubmitState("error");
      setErrorMessage("Please complete title, company, location, and description.");
      return;
    }

    if (deadline && deadline < todayString()) {
      setSubmitState("error");
      setErrorMessage("Application deadline cannot be in the past.");
      return;
    }

    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
      setSubmitState("error");
      setErrorMessage("Salary min cannot be greater than salary max.");
      return;
    }

    setSubmitState("submitting");
    setErrorMessage("");

    try {
      const mappedJobType =
        employmentType === "Internship"
          ? "INTERNSHIP"
          : employmentType === "Contract"
            ? "CONTRACT"
            : employmentType === "Part-time"
              ? "PART_TIME"
              : "FULL_TIME";

      await apiJson("/recruiter/jobs", {
        method: "POST",
        token,
        body: {
          title: title.trim(),
          companyName: company.trim(),
          location: location.trim(),
          jobType: mappedJobType,
          workplaceType,
          industry,
          role: title.trim(),
          experienceLevel,
          salaryMin: salaryMin ? Number(salaryMin) : null,
          salaryMax: salaryMax ? Number(salaryMax) : null,
          currency,
          minExperienceYears: experienceLevel === "Entry" ? 0 : experienceLevel === "Mid" ? 2 : experienceLevel === "Senior" ? 5 : 8,
          description: description.trim(),
          requirements: requirements.trim(),
          applicationDeadline: deadline ? new Date(deadline).toISOString() : null,
          openToFreshers: experienceLevel === "Entry",
          requiredSkills: skillsList,
          screeningQuestions: questionsList
        }
      });

      if (token) {
        void updateRecruiterJobListingPreferences(token, { postJobDraft: null }).catch(() => undefined);
      }

      setSubmitState("success");
      resetForm();
    } catch (error) {
      setSubmitState("error");
      if (error instanceof ApiError) {
        setErrorMessage(error.message || "Failed to create job");
      } else {
        setErrorMessage("Failed to create job");
      }
    }
  }

  async function saveDraftNow() {
    if (!token || saveDraftBusy) return;
    setSaveDraftBusy(true);
    try {
      const draft: DraftJob = {
        title,
        company,
        location,
        workplaceType,
        industry,
        experienceLevel,
        employmentType,
        salaryMin,
        salaryMax,
        currency,
        description,
        requirements,
        deadline,
        skills,
        screeningQuestions,
      };
      await updateRecruiterJobListingPreferences(token, { postJobDraft: draft });
    } finally {
      setSaveDraftBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Post a Job</h1>
        <p className="text-sm text-[var(--muted)]">
          Create a polished job post with structured details, compensation, and screening prompts.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">Role basics</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-[var(--muted)] md:col-span-2">
                Job title
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Senior Frontend Engineer"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>

              <label className="space-y-1 text-sm text-[var(--muted)]">
                Company
                <input
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={"Hireflow Labs"}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>

              <label className="space-y-1 text-sm text-[var(--muted)]">
                Location
                <SearchableLocationInput
                  required
                  value={location}
                  onChange={setLocation}
                  placeholder="Bengaluru, India"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>

              <label className="space-y-1 text-sm text-[var(--muted)]">
                Workplace type
                <select
                  value={workplaceType}
                  onChange={(e) => setWorkplaceType(e.target.value as DraftJob["workplaceType"])}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  <option value="Onsite">Onsite</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </label>

              <label className="space-y-1 text-sm text-[var(--muted)]">
                Employment type
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-[var(--muted)]">
                Industry
                <input
                  list="industry-options"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Software"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                />
                <datalist id="industry-options">
                  {INDUSTRIES.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </label>

              <label className="space-y-1 text-sm text-[var(--muted)]">
                Experience level
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as DraftJob["experienceLevel"])}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  <option value="Entry">Entry</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead</option>
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">Compensation and timeline</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm text-[var(--muted)]">
                Salary min
                <input
                  type="number"
                  min="0"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="1500000"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>

              <label className="space-y-1 text-sm text-[var(--muted)]">
                Salary max
                <input
                  type="number"
                  min="0"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="2500000"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </label>

              <label className="space-y-1 text-sm text-[var(--muted)]">
                Currency
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="INR">INR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm text-[var(--muted)]">
              Application deadline
              <input
                type="date"
                min={todayString()}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">Role details</h2>
            <label className="space-y-1 text-sm text-[var(--muted)]">
              Job description
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Describe scope, outcomes, and team context..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--muted)]">
              Requirements
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                rows={4}
                placeholder="Must-have experience, tools, and certifications..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--muted)]">
              Skills (comma-separated)
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="React, TypeScript, GraphQL"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--muted)]">
              Screening questions (one per line)
              <textarea
                value={screeningQuestions}
                onChange={(e) => setScreeningQuestions(e.target.value)}
                rows={4}
                placeholder="What is your notice period?\nDescribe one product you shipped end-to-end."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>
          </section>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Publish Job
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isSubmitting || saveDraftBusy || !token}
              onClick={() => void saveDraftNow()}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saveDraftBusy ? "Saving..." : "Save Draft"}
            </button>

            {submitState === "success" && (
              <p className="text-sm text-emerald-500">Job created successfully.</p>
            )}
            {submitState === "error" && (
              <p className="text-sm text-rose-500">{errorMessage}</p>
            )}
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Publishing checklist</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Completion: {completion}%</p>
            <ul className="mt-3 space-y-2 text-sm">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-2">
                  <span className="text-[var(--muted)]">{item.label}</span>
                  <span
                    className={
                      item.complete
                        ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500"
                        : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-500"
                    }
                  >
                    {item.complete ? "Done" : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Live preview</h3>
            <p className="mt-2 text-base font-semibold text-[var(--text)]">
              {title || "Untitled role"}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {(company || "Your company") + " • " + (location || "Location")}
            </p>
            <p className="mt-2 text-xs uppercase tracking-wide text-[var(--muted)]">
              {[workplaceType, employmentType, experienceLevel].filter(Boolean).join(" • ")}
            </p>
            <p className="mt-3 text-sm text-[var(--muted)] line-clamp-5">
              {description || "Your description preview will appear here."}
            </p>
            {!!skillsList.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                {skillsList.slice(0, 6).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
