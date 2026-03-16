import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createComplaintTicket, listComplaintTickets } from "../community/storage";

export function ComplaintsOpinionsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"FORM" | "SUBMISSIONS">("FORM");
  const [category, setCategory] = useState<"PLATFORM" | "JOB_POST" | "RECRUITER" | "OTHER">("PLATFORM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const mine = useMemo(
    () => listComplaintTickets().filter((t) => t.creatorId === user?.id),
    [user?.id, version],
  );

  function statusLabel(status: string) {
    if (status === "IN_REVIEW") return "In Progress";
    if (status === "RESOLVED") return "Resolved";
    return "Open";
  }

  function submitTicket() {
    if (!user) return;
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < 5 || cleanDescription.length < 50) return;
    createComplaintTicket({
      creatorId: user.id,
      creatorLabel: user.email.split("@")[0],
      role: user.role,
      category,
      subject: cleanTitle,
      details: cleanDescription,
    });
    const generated = `HF-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setSuccessRef(generated);
    setTitle("");
    setDescription("");
    setAttachmentName(null);
    setVersion((v) => v + 1);
  }

  return (
    <div className="mx-auto max-w-[860px] space-y-4">
      <div className="card-base">
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="mt-2 text-sm text-text-secondary">Share product feedback, report issues, and track your submissions.</p>
        {user?.role === "RECRUITER" ? (
          <div className="mt-3">
            <Link to="/recruiter/community-moderation" className="btn btn-secondary">Open Moderation Panel</Link>
          </div>
        ) : null}
      </div>

      <div className="card-base">
        <div className="mb-4 flex gap-2">
          <button className={"btn " + (activeTab === "FORM" ? "btn-primary" : "btn-secondary")} onClick={() => setActiveTab("FORM")} type="button">Submit Feedback</button>
          <button className={"btn " + (activeTab === "SUBMISSIONS" ? "btn-primary" : "btn-secondary")} onClick={() => setActiveTab("SUBMISSIONS")} type="button">My Submissions</button>
        </div>

        {activeTab === "FORM" ? (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Submit Feedback</div>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value as any)}>
              <option value="PLATFORM">Platform Bug</option>
              <option value="JOB_POST">Job Post Issue</option>
              <option value="RECRUITER">Recruiter Conduct</option>
              <option value="OTHER">Other</option>
            </select>
            <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea
              className="input"
              style={{ minHeight: 120, resize: "vertical" }}
              placeholder="Describe what happened and include useful context."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="text-xs text-text-muted">{description.trim().length}/50 minimum characters</div>
            <label className="field">
              <span className="label">Optional Attachment</span>
              <input
                className="input"
                type="file"
                onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? null)}
              />
              {attachmentName ? <span className="text-xs text-text-muted">Attached: {attachmentName}</span> : null}
            </label>
            <input className="input" placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-text-muted">Title min 5 chars. Description min 50 chars.</div>
              <button type="button" className="btn btn-primary" onClick={submitTicket}>Submit</button>
            </div>
            {successRef ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                Feedback submitted successfully. Reference ID: <span className="font-semibold">{successRef}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">My Submissions</div>
            {mine.length === 0 ? (
              <div className="text-sm text-text-muted">No submissions yet.</div>
            ) : (
              <div className="space-y-2">
                {mine.map((t) => (
                  <div key={t.id} className="rounded-xl border border-border bg-surface-raised p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-text">{t.subject}</div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        t.status === "OPEN"
                          ? "bg-red-500/10 text-red-400"
                          : t.status === "IN_REVIEW"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {statusLabel(t.status)}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">{t.category} • Updated {new Date(t.updatedAt).toLocaleString()}</div>
                    <p className="mt-2 text-sm text-text-secondary">{t.details}</p>
                    {t.adminNote ? <div className="mt-2 text-xs text-[#8AB4F8]">Admin note: {t.adminNote}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
