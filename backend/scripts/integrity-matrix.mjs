import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function id(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function expectFailure(label, fn) {
  try {
    await fn();
    return { ok: false, detail: `${label} unexpectedly succeeded` };
  } catch (err) {
    return { ok: true, detail: `${label} failed as expected: ${String(err.message || err)}` };
  }
}

async function assertNoError(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

async function run() {
  const results = [];

  // 1) Ensure integrity audit table exists.
  {
    const res = await supabase.from("integrity_audit_events").select("id").limit(1);
    if (res.error) {
      throw new Error(`integrity_audit_events table check failed: ${res.error.message}`);
    }
    results.push({ check: "audit_table_exists", ok: true });
  }

  // 2) Ensure required RPCs exist in schema cache before running transition tests.
  {
    const missing = [];

    const adminRpc = await supabase.rpc("admin_set_recruiter_approval", {
      p_recruiter_user_id: "00000000-0000-0000-0000-000000000000",
      p_next_status: "PENDING",
      p_reason: "schema-check",
    });

    if (adminRpc.error?.code === "PGRST202") {
      missing.push("admin_set_recruiter_approval");
    }

    const recruiterRpc = await supabase.rpc("recruiter_update_application_status", {
      p_application_id: "00000000-0000-0000-0000-000000000000",
      p_recruiter_user_id: "00000000-0000-0000-0000-000000000000",
      p_next_status: "APPLIED",
      p_interview_at: null,
    });

    if (recruiterRpc.error?.code === "PGRST202") {
      missing.push("recruiter_update_application_status");
    }

    if (missing.length > 0) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            blocker: "required_migrations_not_applied",
            missing,
            requiredMigrations: [
              "supabase/migrations/20260313_role_integrity_and_recruiter_flow.sql",
              "supabase/migrations/20260313_state_machine_audit_and_rpc_controls.sql",
            ],
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }

    results.push({ check: "required_rpcs_present", ok: true });
  }

  const recruiterEmail = `${id("recruiter")}@integrity.local`;
  const seekerEmail = `${id("seeker")}@integrity.local`;

  const recruiterUser = await supabase.auth.admin.createUser({
    email: recruiterEmail,
    password: "Password123!",
    email_confirm: true,
    user_metadata: { role: "RECRUITER" },
  });
  if (recruiterUser.error) throw new Error(`create recruiter user failed: ${recruiterUser.error.message}`);

  const seekerUser = await supabase.auth.admin.createUser({
    email: seekerEmail,
    password: "Password123!",
    email_confirm: true,
    user_metadata: { role: "JOB_SEEKER" },
  });
  if (seekerUser.error) throw new Error(`create seeker user failed: ${seekerUser.error.message}`);

  const recruiterId = recruiterUser.data.user.id;
  const seekerId = seekerUser.data.user.id;

  try {
    await assertNoError(
      await supabase.from("profiles").upsert({
        id: recruiterId,
        email: recruiterEmail,
        role: "RECRUITER",
        full_name: "Integrity Recruiter",
        recruiter_approval_status: "APPROVED",
      }, { onConflict: "id" }),
      "upsert recruiter profile",
    );

    await assertNoError(
      await supabase.from("profiles").upsert({
        id: seekerId,
        email: seekerEmail,
        role: "JOB_SEEKER",
        full_name: "Integrity Seeker",
        recruiter_approval_status: null,
      }, { onConflict: "id" }),
      "upsert seeker profile",
    );

    await assertNoError(
      await supabase.from("recruiter_profiles").upsert({ user_id: recruiterId, company_name: "Integrity Labs" }, { onConflict: "user_id" }),
      "upsert recruiter profile details",
    );

    await assertNoError(
      await supabase.from("job_seeker_profiles").upsert({ user_id: seekerId, skills: ["TypeScript"], experience_years: 2 }, { onConflict: "user_id" }),
      "upsert seeker profile details",
    );

    const jobInsert = await supabase.from("jobs").insert({
      recruiter_id: recruiterId,
      title: "Integrity Engineer",
      company_name: "Integrity Labs",
      location: "Remote",
      role: "Software Engineer",
      required_skills: ["TypeScript"],
      job_type: "FULL_TIME",
      min_experience_years: 1,
      description: "Integrity test role for validating state transitions and constraints.",
      open_to_freshers: false,
      review_status: "APPROVED",
    }).select("id").single();

    if (jobInsert.error) throw new Error(`insert job failed: ${jobInsert.error.message}`);
    const jobId = jobInsert.data.id;

    const appInsert = await supabase.from("applications").insert({
      job_id: jobId,
      job_seeker_id: seekerId,
      status: "APPLIED",
    }).select("id,status").single();

    if (appInsert.error) throw new Error(`insert application failed: ${appInsert.error.message}`);
    const applicationId = appInsert.data.id;

    // 2) Invalid recruiter approval transition should fail (APPROVED -> PENDING).
    {
      const out = await expectFailure("invalid recruiter approval transition", async () => {
        const res = await supabase
          .from("profiles")
          .update({ recruiter_approval_status: "PENDING" })
          .eq("id", recruiterId)
          .eq("role", "RECRUITER");
        if (res.error) throw res.error;
      });
      results.push({ check: "recruiter_approval_transition_guard", ok: out.ok, detail: out.detail });
    }

    // 3) Invalid application transition should fail (APPLIED -> OFFERED).
    {
      const out = await expectFailure("invalid application transition", async () => {
        const res = await supabase
          .from("applications")
          .update({ status: "OFFERED" })
          .eq("id", applicationId);
        if (res.error) throw res.error;
      });
      results.push({ check: "application_transition_guard", ok: out.ok, detail: out.detail });
    }

    // 4) RPC behavior.
    {
      const rpcAdmin = await supabase.rpc("admin_set_recruiter_approval", {
        p_recruiter_user_id: recruiterId,
        p_next_status: "REJECTED",
        p_reason: "integrity matrix test",
      });
      const ok = Boolean(rpcAdmin.error);
      results.push({
        check: "admin_approval_rpc_controlled",
        ok,
        detail: rpcAdmin.error ? rpcAdmin.error.message : "RPC call unexpectedly succeeded under service-role context",
      });
    }

    {
      const rpcRecruiter = await supabase.rpc("recruiter_update_application_status", {
        p_application_id: applicationId,
        p_recruiter_user_id: recruiterId,
        p_next_status: "SHORTLISTED",
        p_interview_at: null,
      });

      if (rpcRecruiter.error) {
        results.push({ check: "recruiter_application_rpc", ok: false, detail: rpcRecruiter.error.message });
      } else {
        results.push({ check: "recruiter_application_rpc", ok: true });
      }
    }

    // 5) Audit event exists for application state change.
    {
      const audit = await supabase
        .from("integrity_audit_events")
        .select("id,event_type,entity_table,entity_id,created_at")
        .eq("entity_table", "applications")
        .eq("entity_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(3);

      if (audit.error) {
        results.push({ check: "audit_event_written", ok: false, detail: audit.error.message });
      } else {
        const hasAppEvent = (audit.data || []).some((e) =>
          ["APPLICATION_STATUS_CHANGED", "RECRUITER_UPDATE_APPLICATION_STATUS"].includes(e.event_type),
        );
        results.push({ check: "audit_event_written", ok: hasAppEvent, detail: `events_found=${(audit.data || []).length}` });
      }
    }

    const failed = results.filter((x) => !x.ok);
    console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await supabase.auth.admin.deleteUser(recruiterId);
    await supabase.auth.admin.deleteUser(seekerId);
  }
}

run().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
