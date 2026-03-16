import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const titleMap: Array<{ test: RegExp; title: string }> = [
  { test: /^\/login$/, title: "Login | Hireflow" },
  { test: /^\/register$/, title: "Register | Hireflow" },
  { test: /^\/recruiter\/register$/, title: "Recruiter Register | Hireflow" },
  { test: /^\/recruiter\/pending$/, title: "Recruiter Pending | Hireflow" },
  { test: /^\/forgot-password$/, title: "Forgot Password | Hireflow" },
  { test: /^\/reset-password$/, title: "Reset Password | Hireflow" },
  { test: /^\/onboarding$/, title: "Onboarding | Hireflow" },
  { test: /^\/job-seeker\/dashboard$/, title: "Dashboard | Hireflow" },
  { test: /^\/job-seeker\/profile$/, title: "Profile Builder | Hireflow" },
  { test: /^\/job-seeker\/resume-builder$/, title: "Resume Builder | Hireflow" },
  { test: /^\/job-seeker\/jobs$/, title: "Jobs & Internships | Hireflow" },
  { test: /^\/job-seeker\/saved$/, title: "Saved Jobs | Hireflow" },
  { test: /^\/job-seeker\/interview-prep$/, title: "Interview Prep | Hireflow" },
  { test: /^\/job-seeker\/experience-feed$/, title: "Community Feed | Hireflow" },
  { test: /^\/job-seeker\/complaints$/, title: "Feedback | Hireflow" },
  { test: /^\/job-seeker\/settings$/, title: "Settings | Hireflow" },
  { test: /^\/recruiter\/dashboard$/, title: "Recruiter Dashboard | Hireflow" },
  { test: /^\/recruiter\/jobs$/, title: "My Postings | Hireflow" },
  { test: /^\/recruiter\/post-job$/, title: "Post Job | Hireflow" },
  { test: /^\/recruiter\/applicants$/, title: "Applicants | Hireflow" },
  { test: /^\/recruiter\/experience-feed$/, title: "Community Feed | Hireflow" },
  { test: /^\/recruiter\/complaints$/, title: "Feedback | Hireflow" },
  { test: /^\/recruiter\/settings$/, title: "Settings | Hireflow" },
  { test: /^\/job-seeker\/notifications$/, title: "Notifications | Hireflow" },
  { test: /^\/recruiter\/notifications$/, title: "Notifications | Hireflow" },
  { test: /^\/job-seeker\/jobs\/.+/, title: "Job Details | Hireflow" },
  { test: /^\/admin\/job-review$/, title: "Admin Job Review | Hireflow" },
  { test: /^\/admin$/, title: "Admin Dashboard | Hireflow" },
  { test: /^\/admin\/recruiters$/, title: "Recruiter Verification | Hireflow" },
  { test: /^\/admin\/applicants$/, title: "Applicant Management | Hireflow" },
];

export function PageTitleSync() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    const match = titleMap.find((item) => item.test.test(pathname));
    document.title = match?.title ?? "Hireflow";
  }, [location.pathname]);

  return null;
}
