require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const DUMMY_RECRUITERS = [
  {
    email: "demo.recruiter.pending1@hireflow.local",
    fullName: "Aarav Sharma",
    companyName: "NextHire Labs",
    designation: "Talent Acquisition Lead",
    website: "https://nexthire.example.com",
    status: "PENDING",
  },
  {
    email: "demo.recruiter.pending2@hireflow.local",
    fullName: "Meera Nair",
    companyName: "Orbit Talent",
    designation: "HR Manager",
    website: "https://orbittalent.example.com",
    status: "PENDING",
  },
  {
    email: "demo.recruiter.approved1@hireflow.local",
    fullName: "Rohan Gupta",
    companyName: "CampusOrbit Pvt Ltd",
    designation: "Recruitment Specialist",
    website: "https://campusorbit.example.com",
    status: "APPROVED",
  },
  {
    email: "demo.recruiter.approved2@hireflow.local",
    fullName: "Diya Reddy",
    companyName: "InternBridge Systems",
    designation: "People Operations",
    website: "https://internbridge.example.com",
    status: "APPROVED",
  },
  {
    email: "demo.recruiter.rejected1@hireflow.local",
    fullName: "Nikhil Verma",
    companyName: "ProtoHire Works",
    designation: "Hiring Coordinator",
    website: "https://protohire.example.com",
    status: "REJECTED",
  },
];

function randomPassword() {
  return `HF_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}!`;
}

async function listAllUsers(admin) {
  const all = [];
  let page = 1;
  while (true) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw new Error(result.error.message);
    const users = result.data.users || [];
    all.push(...users);
    if (users.length < 200) break;
    page += 1;
  }
  return all;
}

async function getOrCreateAuthUser(admin, email, fullName) {
  const users = await listAllUsers(admin);
  const existing = users.find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
  if (existing) return existing;

  const created = await admin.auth.admin.createUser({
    email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "RECRUITER",
    },
  });

  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || `Unable to create auth user for ${email}`);
  }

  return created.data.user;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seeded = [];

  for (const item of DUMMY_RECRUITERS) {
    const authUser = await getOrCreateAuthUser(supabase, item.email, item.fullName);

    const profileUpsert = await supabase.from("profiles").upsert(
      {
        id: authUser.id,
        email: item.email.toLowerCase(),
        role: "RECRUITER",
        full_name: item.fullName,
        recruiter_approval_status: item.status,
      },
      { onConflict: "id" },
    );
    if (profileUpsert.error) throw new Error(profileUpsert.error.message);

    const recruiterProfileUpsert = await supabase.from("recruiter_profiles").upsert(
      {
        user_id: authUser.id,
        company_name: item.companyName,
        company_website: item.website,
        designation: item.designation,
      },
      { onConflict: "user_id" },
    );
    if (recruiterProfileUpsert.error) throw new Error(recruiterProfileUpsert.error.message);

    seeded.push({ userId: authUser.id, email: item.email, status: item.status });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        seededCount: seeded.length,
        seeded,
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
