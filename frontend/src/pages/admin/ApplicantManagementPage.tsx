import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  fetchApplicants,
  type ApplicantItem,
  type ApplicationStatus,
  updateApplicantStatus,
} from "../../admin/adminData";

const statusOptions: Array<"ALL" | ApplicationStatus> = [
  "ALL",
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "OFFERED",
  "HIRED",
  "REJECTED",
];

function badgeForStatus(status: ApplicationStatus) {
  if (status === "HIRED" || status === "SHORTLISTED") return "green" as const;
  if (status === "OFFERED" || status === "INTERVIEW_SCHEDULED") return "amber" as const;
  if (status === "REJECTED") return "red" as const;
  return "blue" as const;
}

export function ApplicantManagementPage() {
  const [rows, setRows] = useState<ApplicantItem[]>([]);
  const [status, setStatus] = useState<"ALL" | ApplicationStatus>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApplicants(status, search);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applicants");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  async function saveStatus(row: ApplicantItem, nextStatus: ApplicationStatus) {
    setBusyId(row.id);
    setError(null);
    try {
      const interviewAt = nextStatus === "INTERVIEW_SCHEDULED" ? new Date(Date.now() + 86400000).toISOString() : null;
      await updateApplicantStatus(row.id, nextStatus, interviewAt);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update applicant");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-1">
        <h1 className="text-2xl font-semibold">Applicant Management</h1>
        <p className="text-sm text-text-secondary">Search, view, edit, and manage candidate applications.</p>
      </Card>

      {error ? <Card className="border-danger/60 bg-danger/10 text-danger">{error}</Card> : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs text-text-muted">Status</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              {statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-xs text-text-muted">Search</label>
            <input
              className="input"
              placeholder="Candidate, email, role, company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Button variant="secondary" onClick={() => void load()}>
            Search
          </Button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="text-sm text-text-secondary">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-text-secondary">No applicants found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                  <th className="px-3 py-2">Candidate</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Applied</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-3 py-3">
                      <div className="font-medium text-text">{row.candidateName}</div>
                      <div className="text-xs text-text-secondary">{row.candidateEmail}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-text">{row.roleTitle}</div>
                      <div className="text-xs text-text-muted">{row.companyName} - {row.location}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={badgeForStatus(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-xs text-text-secondary">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={busyId === row.id}
                          className="text-xs"
                          onClick={() => void saveStatus(row, "SHORTLISTED")}
                        >
                          Shortlist
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busyId === row.id}
                          className="text-xs"
                          onClick={() => void saveStatus(row, "INTERVIEW_SCHEDULED")}
                        >
                          Schedule
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busyId === row.id}
                          className="text-xs"
                          onClick={() => void saveStatus(row, "REJECTED")}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
