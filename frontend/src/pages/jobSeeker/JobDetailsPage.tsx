import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiJson, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { GeneratedResume, Job, Resume } from "../../types";
import { downloadGeneratedResumePdf } from "../../utils/generatedResumePdf";
import { openResumePreview } from "../../utils/resumePreview";

export function JobDetailsPage() {
  const { jobId } = useParams();
  const { token } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [generatedResumes, setGeneratedResumes] = useState<GeneratedResume[]>([]);
  const [activeGeneratedId, setActiveGeneratedId] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<string>("");
  const [appliedNote, setAppliedNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token || !jobId) return;
      try {
        setError(null);
        const [jobRes, profileRes, resumeRes, genRes] = await Promise.all([
          apiJson<{ job: Job }>(`/jobs/${jobId}`, { token }),
          apiJson<{ profile: any }>("/job-seeker/profile", { token }),
          apiJson<{ resumes: Resume[] }>("/job-seeker/resume", { token }),
          apiJson<{ generatedResumes: GeneratedResume[] }>("/job-seeker/generated-resumes", { token }),
        ]);

        setJob(jobRes.job);
        setResumes(resumeRes.resumes);
        setGeneratedResumes(genRes.generatedResumes);
        setActiveGeneratedId(profileRes.profile?.activeGeneratedResumeId ?? null);

        const defaultGen = profileRes.profile?.activeGeneratedResumeId ?? genRes.generatedResumes[0]?.id ?? "";
        const defaultUpload = resumeRes.resumes[0]?.id ?? "";
        const nextSel = defaultGen ? `gen:${defaultGen}` : defaultUpload ? `up:${defaultUpload}` : "";
        setSelectedResume(nextSel);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load job");
      }
    })();
  }, [token, jobId]);

  async function apply() {
    if (!token || !jobId) return;
    if (!selectedResume) {
      setError("Select a resume to include before applying.");
      return;
    }
    setBusy(true);
    setError(null);
    setAppliedNote(null);
    try {
      const payload: { jobId: string; generatedResumeId?: string; resumeId?: string } = { jobId };
      if (selectedResume.startsWith("gen:")) payload.generatedResumeId = selectedResume.replace("gen:", "");
      if (selectedResume.startsWith("up:")) payload.resumeId = selectedResume.replace("up:", "");

      await apiJson("/job-seeker/applications", { method: "POST", token, body: payload });
      setAppliedNote("Application submitted with your selected resume.");
      setBusy(false);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to apply");
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginTop: 0 }}>Job Details</h2>
          <div className="muted">Review the job fully before applying.</div>
        </div>
        <Link to="/job-seeker/jobs" className="btn">
          Back to Jobs
        </Link>
      </div>

      {error ? <div className="card">{error}</div> : null}

      {!job ? (
        <div className="card">Loading...</div>
      ) : (
        <div className="card grid" style={{ gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{job.title}</div>
              <div className="muted">
                {job.companyName} • {job.location} • {job.role}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Type: {job.jobType.replace("_", " ")} • Min exp: {job.minExperienceYears} yrs
              </div>
            </div>
            {job.openToFreshers ? <span className="badge badge-accent">Open to Freshers</span> : null}
          </div>

          <div>
            <div className="label">Required skills</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {job.requiredSkills.map((s) => (
                <span key={s} className="badge">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="label">Description</div>
            <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{job.description}</div>
          </div>

          <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Resume to attach</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Choose a generated PDF or uploaded resume. You can generate more from your profile.
            </div>

            <select
              className="select"
              value={selectedResume}
              onChange={(e) => setSelectedResume(e.target.value)}
            >
              <option value="">Select a resume</option>
              {generatedResumes.map((gr) => (
                <option key={gr.id} value={`gen:${gr.id}`}>
                  Generated • {gr.title || "Resume"} {gr.id === activeGeneratedId ? "(Primary)" : ""}
                </option>
              ))}
              {resumes.map((r) => (
                <option key={r.id} value={`up:${r.id}`}>
                  Uploaded • {r.originalName}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to="/job-seeker/profile" className="btn">
                Manage resumes
              </Link>
              {selectedResume.startsWith("gen:") ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const id = selectedResume.replace("gen:", "");
                    const match = generatedResumes.find((g) => g.id === id);
                    if (match) void downloadGeneratedResumePdf(match);
                  }}
                >
                  Download selected
                </button>
              ) : null}
              {selectedResume.startsWith("up:") ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const id = selectedResume.replace("up:", "");
                    void openResumePreview(id, token!);
                  }}
                >
                  Preview uploaded
                </button>
              ) : null}
            </div>
          </div>

          <button type="button" className="btn btn-primary" onClick={() => void apply()} disabled={busy}>
            {busy ? "Applying..." : "Apply (one-click)"}
          </button>

          {appliedNote ? <div className="muted" style={{ fontWeight: 600 }}>{appliedNote}</div> : null}
        </div>
      )}
    </div>
  );
}
