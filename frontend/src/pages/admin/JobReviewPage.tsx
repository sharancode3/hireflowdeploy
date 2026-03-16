import { useEffect, useState } from "react";
import { fetchReviewJobs, reviewJob, type ReviewJobItem } from "../../admin/adminData";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";

function statusBadge(status: ReviewJobItem["reviewStatus"]) {
  if (status === "APPROVED") return <Badge variant="green">Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="red">Rejected</Badge>;
  if (status === "NEEDS_REVISION") return <Badge variant="amber">Needs Revision</Badge>;
  return <Badge variant="amber">Pending Review</Badge>;
}

export function AdminJobReviewPage() {
  const [jobs, setJobs] = useState<ReviewJobItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ jobId: string; action: "REJECT" | "REQUEST_REVISION" } | null>(null);
  const [feedback, setFeedback] = useState("");

  async function load() {
    const data = await fetchReviewJobs();
    setJobs(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function review(jobId: string, action: "APPROVE" | "REJECT" | "REQUEST_REVISION", note?: string) {
    setBusy(true);
    setError(null);
    try {
      await reviewJob(jobId, action, note);
      setModal(null);
      setFeedback("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit review action");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-2xl font-semibold">Admin Job Review</h1>
        <p className="text-sm text-text-secondary">Review queue for recruiter postings.</p>
      </Card>

      {error ? <Card className="border-danger/50 bg-danger/10 text-danger">{error}</Card> : null}

      {jobs.length === 0 ? (
        <Card>No jobs in review queue.</Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{job.title}</div>
                  <div className="text-xs text-text-secondary">{job.companyName} · {job.location} · {job.role}</div>
                  <div className="text-xs text-text-muted">Recruiter: {job.recruiter.email}</div>
                </div>
                {statusBadge(job.reviewStatus)}
              </div>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{job.description}</p>
              {job.adminFeedback ? <div className="text-xs text-amber-300">Feedback: {job.adminFeedback}</div> : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={busy} onClick={() => void review(job.id, "APPROVE")}>Approve</Button>
                <Button variant="danger" disabled={busy} onClick={() => setModal({ jobId: job.id, action: "REJECT" })}>Reject</Button>
                <Button variant="secondary" disabled={busy} onClick={() => setModal({ jobId: job.id, action: "REQUEST_REVISION" })}>Request Revision</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)}>
        {modal ? (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">{modal.action === "REJECT" ? "Reject Posting" : "Request Revision"}</h3>
            <p className="text-sm text-text-secondary">Feedback is required.</p>
            <textarea
              className="input min-h-[120px]"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Explain the reason and what to fix."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={busy || feedback.trim().length < 10}
                onClick={() => void review(modal.jobId, modal.action, feedback.trim())}
              >
                Submit
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
