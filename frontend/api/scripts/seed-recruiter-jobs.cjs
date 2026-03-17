require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const RECRUITER_EMAIL = "t.m.s10099@gmail.com";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const usersRes = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersRes.error) throw new Error(usersRes.error.message);

  const authUser = (usersRes.data.users || []).find(
    (u) => String(u.email || "").toLowerCase() === RECRUITER_EMAIL,
  );

  if (!authUser) {
    throw new Error(`Auth user not found for ${RECRUITER_EMAIL}`);
  }

  const recruiterId = authUser.id;
  const fullName = authUser.user_metadata?.full_name || "Recruiter";
  const companyName = authUser.user_metadata?.company_name || "Talent Matrix Solutions";

  const profileUpsert = await supabase.from("profiles").upsert(
    {
      id: recruiterId,
      email: RECRUITER_EMAIL,
      role: "RECRUITER",
      full_name: fullName,
      recruiter_approval_status: "APPROVED",
    },
    { onConflict: "id" },
  );

  if (profileUpsert.error) throw new Error(profileUpsert.error.message);

  const recruiterProfileUpsert = await supabase.from("recruiter_profiles").upsert(
    {
      user_id: recruiterId,
      company_name: companyName,
      designation: "Talent Acquisition Lead",
      bio: "Recruiter account seeded with demo listings.",
    },
    { onConflict: "user_id" },
  );

  if (recruiterProfileUpsert.error) throw new Error(recruiterProfileUpsert.error.message);

  const now = Date.now();
  const inDays = (d) => new Date(now + 1000 * 60 * 60 * 24 * d).toISOString();
  const reviewedAt = new Date().toISOString();

  const jobs = [
    {
      recruiter_id: recruiterId,
      title: "Frontend Developer (React + TypeScript)",
      company_name: companyName,
      location: "Bengaluru, India",
      role: "Frontend Developer",
      required_skills: ["React", "TypeScript", "Tailwind CSS", "REST APIs", "Jest"],
      job_type: "FULL_TIME",
      min_experience_years: 1,
      description:
        "Build and maintain responsive frontend features for recruiting workflows, collaborate with design and backend teams, and improve UI performance.",
      open_to_freshers: true,
      review_status: "APPROVED",
      admin_feedback: null,
      reviewed_at: reviewedAt,
      application_deadline: inDays(30),
    },
    {
      recruiter_id: recruiterId,
      title: "Backend Engineer (Node.js + Supabase)",
      company_name: companyName,
      location: "Bengaluru, India",
      role: "Backend Engineer",
      required_skills: ["Node.js", "TypeScript", "PostgreSQL", "Supabase", "API Design"],
      job_type: "FULL_TIME",
      min_experience_years: 2,
      description:
        "Design backend APIs, optimize database queries, and own service reliability for hiring and candidate management systems.",
      open_to_freshers: false,
      review_status: "APPROVED",
      admin_feedback: null,
      reviewed_at: reviewedAt,
      application_deadline: inDays(45),
    },
    {
      recruiter_id: recruiterId,
      title: "Campus Hiring Intern",
      company_name: companyName,
      location: "Remote (India)",
      role: "Talent Acquisition Intern",
      required_skills: ["Communication", "Excel", "Candidate Screening", "Scheduling"],
      job_type: "INTERNSHIP",
      min_experience_years: 0,
      description:
        "Support campus outreach, coordinate interviews, and maintain applicant tracking updates for internship and entry-level roles.",
      open_to_freshers: true,
      review_status: "APPROVED",
      admin_feedback: null,
      reviewed_at: reviewedAt,
      application_deadline: inDays(21),
    },
  ];

  const insertRes = await supabase.from("jobs").insert(jobs).select("id,title,created_at");
  if (insertRes.error) throw new Error(insertRes.error.message);

  console.log(
    JSON.stringify(
      {
        recruiterId,
        insertedCount: insertRes.data?.length || 0,
        jobs: insertRes.data || [],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
