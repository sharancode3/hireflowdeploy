import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { clearPendingRegistration, loadPendingRegistration } from "../auth/pendingRegistration";
import { hasCompletedOnboarding } from "../auth/onboarding";

function mapRole(raw: unknown): "JOB_SEEKER" | "RECRUITER" {
  return raw === "RECRUITER" ? "RECRUITER" : "JOB_SEEKER";
}

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    async function run() {
      try {
        const search = new URLSearchParams(window.location.search);
        const hashRaw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
        const hash = new URLSearchParams(hashRaw);

        const code = search.get("code");
        const tokenHash = search.get("token_hash") || hash.get("token_hash");
        const type = (search.get("type") || hash.get("type")) as "signup" | "recovery" | null;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
          if (error) throw error;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw userError || new Error("Unable to load user after confirmation.");

        const user = userData.user;
        const pending = loadPendingRegistration();
        const role = mapRole(pending.role || user.user_metadata?.role);
        const fullName = pending.fullName || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
        const mobile = pending.mobile || user.user_metadata?.phone || null;

        const profileLookup = await supabase
          .from("profiles")
          .select("id,role,recruiter_approval_status")
          .eq("id", user.id)
          .maybeSingle();

        if (profileLookup.error) throw profileLookup.error;

        const existing = profileLookup.data;

        if (!existing) {
          const profilePayload = {
            id: user.id,
            email: String(user.email || pending.email || "").toLowerCase(),
            full_name: fullName,
            phone: mobile,
            role,
            recruiter_approval_status: role === "RECRUITER" ? "PENDING" : null,
          };

          const { error: profileWriteError } = await supabase
            .from("profiles")
            .upsert(profilePayload, { onConflict: "id" });
          if (profileWriteError) throw profileWriteError;

          if (role === "RECRUITER") {
            const companyName = pending.companyName || user.user_metadata?.company_name || "Recruiter";
            const { error: recruiterWriteError } = await supabase
              .from("recruiter_profiles")
              .upsert({ user_id: user.id, company_name: companyName }, { onConflict: "user_id" });
            if (recruiterWriteError) throw recruiterWriteError;
            clearPendingRegistration();
            navigate("/recruiter/pending", { replace: true });
            return;
          }

          const { error: seekerWriteError } = await supabase
            .from("job_seeker_profiles")
            .upsert({ user_id: user.id }, { onConflict: "user_id" });
          if (seekerWriteError) throw seekerWriteError;

          clearPendingRegistration();
          navigate("/onboarding", { replace: true });
          return;
        }

        clearPendingRegistration();

        if (existing.role === "RECRUITER") {
          if (existing.recruiter_approval_status === "PENDING" || existing.recruiter_approval_status === "REJECTED") {
            navigate("/recruiter/pending", { replace: true });
            return;
          }
          navigate("/recruiter/dashboard", { replace: true });
          return;
        }

        if (!hasCompletedOnboarding(user.id)) {
          navigate("/onboarding", { replace: true });
          return;
        }

        navigate("/job-seeker/dashboard", { replace: true });
      } catch {
        navigate("/login?error=confirmation_failed", { replace: true });
      }
    }

    void run();
  }, [navigate]);

  return (
    <div className="page-shell" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div className="card" style={{ width: 320, textAlign: "center" }}>
        Processing confirmation...
      </div>
    </div>
  );
}
