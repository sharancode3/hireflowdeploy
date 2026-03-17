const api = "http://localhost:4000";

async function j(path, { method = "GET", token, body } = {}) {
  const res = await fetch(api + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`${method} ${path} ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data;
}

function rand8() {
  return Math.random().toString(16).slice(2, 10);
}

(async () => {
  const rand = rand8();
  const pw = "Password123!";
  const seekerEmail = `seeker_${rand}@example.com`;
  const recruiterEmail = `recruiter_${rand}@example.com`;
  const adminEmail = (process.env.ADMIN_EMAILS || "admin@hireflow.local").split(",")[0]?.trim() || "admin@hireflow.local";

  const seeker = await j("/auth/register", {
    method: "POST",
    body: { email: seekerEmail, password: pw, role: "JOB_SEEKER", jobSeeker: { fullName: "Test Seeker" } },
  });

  const recruiter = await j("/auth/register", {
    method: "POST",
    body: {
      email: recruiterEmail,
      password: pw,
      role: "RECRUITER",
      recruiter: { companyName: "Test Company" },
    },
  });

  let admin;
  try {
    admin = await j("/auth/register", {
      method: "POST",
      body: {
        email: adminEmail,
        password: pw,
        role: "RECRUITER",
        recruiter: { companyName: "Admin Company" },
      },
    });
  } catch {
    admin = await j("/auth/login", {
      method: "POST",
      body: {
        email: adminEmail,
        password: pw,
      },
    });
  }

  const job = await j("/recruiter/jobs", {
    method: "POST",
    token: recruiter.token,
    body: {
      title: "Junior Developer",
      location: "Remote",
      role: "Software Engineer",
      requiredSkills: ["React", "TypeScript"],
      description: `Entry-level role. ${"A".repeat(30)}`,
      openToFreshers: true,
    },
  });

  const jobs = await j("/jobs", { method: "GET", token: seeker.token });
  const preApprovalVisible = jobs.jobs.some((x) => x.id === job.job.id);

  await j("/admin/job-review", {
    method: "GET",
    token: admin.token,
  });

  await j(`/admin/job-review/${job.job.id}`, {
    method: "PATCH",
    token: admin.token,
    body: { action: "APPROVE" },
  });

  const jobsAfterApprove = await j("/jobs", { method: "GET", token: seeker.token });
  const postApprovalVisible = jobsAfterApprove.jobs.some((x) => x.id === job.job.id);

  const application = await j("/job-seeker/applications", {
    method: "POST",
    token: seeker.token,
    body: { jobId: job.job.id },
  });

  const applicants = await j(`/recruiter/jobs/${job.job.id}/applicants`, {
    method: "GET",
    token: recruiter.token,
  });

  await j(`/recruiter/applications/${application.application.id}`, {
    method: "PATCH",
    token: recruiter.token,
    body: { status: "SHORTLISTED" },
  });

  const notifications = await j("/notifications", { method: "GET", token: seeker.token });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        seekerEmail,
        recruiterEmail,
        adminEmail,
        jobId: job.job.id,
        jobCount: jobs.jobs.length,
        preApprovalVisible,
        postApprovalVisible,
        applicantCount: applicants.applicants.length,
        notifCount: notifications.notifications.length,
      },
      null,
      2,
    )}\n`,
  );
})().catch((e) => {
  process.stderr.write(`${e.stack || String(e)}\n`);
  process.exit(1);
});
