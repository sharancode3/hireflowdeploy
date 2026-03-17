require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const RECRUITER_EMAIL = "t.m.s10099@gmail.com";
const SEEKER_EMAIL = "sharans.cs24@bmsce.ac.in";
const TARGET_ACTIVE_JOBS = 10;

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makeJobTemplates(companyName) {
  return [
    ["Frontend Engineer", "Frontend Engineer", ["React", "TypeScript", "Tailwind", "Jest"], "FULL_TIME", 1, true],
    ["Backend Engineer", "Backend Engineer", ["Node.js", "PostgreSQL", "Supabase", "REST"], "FULL_TIME", 2, false],
    ["Campus Hiring Intern", "Talent Acquisition Intern", ["Communication", "Excel", "Scheduling"], "INTERNSHIP", 0, true],
    ["Data Analyst", "Data Analyst", ["SQL", "Python", "Power BI", "Statistics"], "FULL_TIME", 1, true],
    ["UI UX Designer", "Product Designer", ["Figma", "Prototyping", "UX Research"], "FULL_TIME", 1, true],
    ["QA Engineer", "QA Engineer", ["Manual Testing", "Selenium", "API Testing"], "FULL_TIME", 1, true],
    ["DevOps Engineer", "DevOps Engineer", ["Docker", "CI/CD", "AWS", "Monitoring"], "FULL_TIME", 3, false],
    ["Product Manager", "Product Manager", ["Roadmapping", "Analytics", "Stakeholder Management"], "FULL_TIME", 3, false],
    ["ML Engineer", "Machine Learning Engineer", ["Python", "ML", "Pandas", "Model Deployment"], "FULL_TIME", 2, false],
    ["Support Associate", "Customer Support", ["Customer Communication", "Ticketing", "Troubleshooting"], "PART_TIME", 0, true],
    ["Security Analyst", "Security Analyst", ["SIEM", "Incident Response", "Network Security"], "CONTRACT", 2, false],
    ["Android Developer", "Mobile Developer", ["Kotlin", "Android SDK", "REST APIs"], "FULL_TIME", 1, true],
  ].map((row, idx) => ({
    recruiter_id: null,
    title: row[0],
    company_name: companyName,
    location: idx % 3 === 0 ? "Bengaluru, India" : idx % 3 === 1 ? "Hyderabad, India" : "Remote (India)",
    role: row[1],
    required_skills: row[2],
    job_type: row[3],
    min_experience_years: row[4],
    description: `${row[0]} role at ${companyName}. Work on real hiring/product outcomes with cross-functional teams.`,
    open_to_freshers: row[5],
    review_status: "APPROVED",
    admin_feedback: null,
    reviewed_at: new Date().toISOString(),
    application_deadline: addDays(25 + idx),
  }));
}

async function listAllUsers(supabase) {
  const all = [];
  let page = 1;
  while (true) {
    const res = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (res.error) throw new Error(res.error.message);
    const users = res.data.users || [];
    all.push(...users);
    if (users.length < 200) break;
    page += 1;
  }
  return all;
}

async function setApplicationStatus(supabase, applicationId, recruiterId, targetStatus, interviewAt) {
  const appRes = await supabase.from("applications").select("id,status").eq("id", applicationId).maybeSingle();
  if (appRes.error || !appRes.data) throw new Error(appRes.error?.message || "Application missing");
  const current = appRes.data.status;
  if (current === targetStatus) return;

  const call = async (status, interview) => {
    const rpc = await supabase.rpc("recruiter_update_application_status", {
      p_application_id: applicationId,
      p_recruiter_user_id: recruiterId,
      p_next_status: status,
      p_interview_at: interview || null,
    });
    if (rpc.error) throw new Error(rpc.error.message);
  };

  if (targetStatus === "SHORTLISTED") {
    if (current === "APPLIED") await call("SHORTLISTED", null);
    return;
  }

  if (targetStatus === "INTERVIEW_SCHEDULED") {
    if (current === "APPLIED") await call("SHORTLISTED", null);
    await call("INTERVIEW_SCHEDULED", interviewAt || addDays(3));
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const users = await listAllUsers(supabase);
  const recruiterUser = users.find((u) => String(u.email || "").toLowerCase() === RECRUITER_EMAIL);
  const seekerUser = users.find((u) => String(u.email || "").toLowerCase() === SEEKER_EMAIL);
  if (!recruiterUser) throw new Error(`Recruiter auth user not found: ${RECRUITER_EMAIL}`);
  if (!seekerUser) throw new Error(`Seeker auth user not found: ${SEEKER_EMAIL}`);

  const recruiterId = recruiterUser.id;
  const seekerId = seekerUser.id;
  const recruiterName = recruiterUser.user_metadata?.full_name || "Recruiter";
  const recruiterCompany = recruiterUser.user_metadata?.company_name || "Talent Matrix Solutions";
  const seekerName = seekerUser.user_metadata?.full_name || "Job Seeker";

  const p1 = await supabase.from("profiles").upsert({
    id: recruiterId,
    email: RECRUITER_EMAIL,
    role: "RECRUITER",
    full_name: recruiterName,
    recruiter_approval_status: "APPROVED",
  }, { onConflict: "id" });
  if (p1.error) throw new Error(p1.error.message);

  const p2 = await supabase.from("profiles").upsert({
    id: seekerId,
    email: SEEKER_EMAIL,
    role: "JOB_SEEKER",
    full_name: seekerName,
    phone: "+91 98765 43210",
    location: "Bengaluru, India",
    headline: "Full-stack developer focused on React and Node.js",
    about: "Seeded profile for recruiter E2E validation with realistic skills, projects, and interview readiness.",
    recruiter_approval_status: null,
  }, { onConflict: "id" });
  if (p2.error) throw new Error(p2.error.message);

  const rp = await supabase.from("recruiter_profiles").upsert({
    user_id: recruiterId,
    company_name: recruiterCompany,
    designation: "Talent Acquisition Lead",
    bio: "E2E seeded recruiter profile",
  }, { onConflict: "user_id" });
  if (rp.error) throw new Error(rp.error.message);

  const sp = await supabase.from("job_seeker_profiles").upsert({
    user_id: seekerId,
    experience_years: 2,
    desired_role: "Software Engineer",
    skills: ["React", "TypeScript", "Node.js", "SQL", "REST APIs", "Testing", "Communication"],
    is_fresher: false,
    visibility: "PUBLIC",
  }, { onConflict: "user_id" });
  if (sp.error) throw new Error(sp.error.message);

  const existingJobsRes = await supabase
    .from("jobs")
    .select("id,title,created_at")
    .eq("recruiter_id", recruiterId)
    .eq("review_status", "APPROVED")
    .order("created_at", { ascending: false });
  if (existingJobsRes.error) throw new Error(existingJobsRes.error.message);

  let approvedJobs = existingJobsRes.data || [];
  if (approvedJobs.length < TARGET_ACTIVE_JOBS) {
    const templates = makeJobTemplates(recruiterCompany);
    const needed = TARGET_ACTIVE_JOBS - approvedJobs.length;
    const toInsert = templates.slice(0, needed).map((j) => ({ ...j, recruiter_id: recruiterId }));
    const inserted = await supabase.from("jobs").insert(toInsert).select("id,title,created_at");
    if (inserted.error) throw new Error(inserted.error.message);

    const refreshed = await supabase
      .from("jobs")
      .select("id,title,created_at")
      .eq("recruiter_id", recruiterId)
      .eq("review_status", "APPROVED")
      .order("created_at", { ascending: false });
    if (refreshed.error) throw new Error(refreshed.error.message);
    approvedJobs = refreshed.data || [];
  }

  const targetJobs = approvedJobs.slice(0, 4);

  const appRows = [];
  for (const job of targetJobs) {
    const existing = await supabase
      .from("applications")
      .select("id,job_id,status")
      .eq("job_id", job.id)
      .eq("job_seeker_id", seekerId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      appRows.push(existing.data);
      continue;
    }

    const inserted = await supabase
      .from("applications")
      .insert({ job_id: job.id, job_seeker_id: seekerId, status: "APPLIED" })
      .select("id,job_id,status")
      .single();
    if (inserted.error) throw new Error(inserted.error.message);
    appRows.push(inserted.data);
  }

  // 2 shortlisted, 1 interview scheduled, 1 stays applied.
  if (appRows[0]) await setApplicationStatus(supabase, appRows[0].id, recruiterId, "SHORTLISTED");
  if (appRows[1]) await setApplicationStatus(supabase, appRows[1].id, recruiterId, "SHORTLISTED");
  if (appRows[2]) await setApplicationStatus(supabase, appRows[2].id, recruiterId, "INTERVIEW_SCHEDULED", addDays(2));

  console.log(JSON.stringify({
    recruiterId,
    seekerId,
    approvedJobsCount: approvedJobs.length,
    seededApplications: appRows.length,
    shortlistedApplicationIds: appRows.slice(0, 2).map((a) => a.id),
    interviewApplicationId: appRows[2]?.id || null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
