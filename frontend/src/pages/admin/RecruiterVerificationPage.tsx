import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  fetchRecruiters,
  type RecruiterApprovalStatus,
  type RecruiterItem,
  updateRecruiterStatus,
} from "../../admin/adminData";

const statuses: Array<"ALL" | RecruiterApprovalStatus> = ["ALL", "PENDING", "APPROVED", "REJECTED"];

export function RecruiterVerificationPage() {
  const [rows, setRows] = useState<RecruiterItem[]>([]);
  const [status, setStatus] = useState<"ALL" | RecruiterApprovalStatus>("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecruiters(status, search);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recruiters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  async function updateStatus(userId: string, nextStatus: RecruiterApprovalStatus) {
    setBusyUserId(userId);
    setError(null);
    try {
      await updateRecruiterStatus(userId, nextStatus);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update recruiter status");
    } finally {
      setBusyUserId(null);
    }
  }

  const statusCounts = useMemo(() => {
    return {
      ALL: rows.length,
      PENDING: rows.filter((r) => r.status === "PENDING").length,
      APPROVED: rows.filter((r) => r.status === "APPROVED").length,
      REJECTED: rows.filter((r) => r.status === "REJECTED").length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <Card className="space-y-1">
        <h1 className="text-2xl font-semibold">Recruiter Verification</h1>
        <p className="text-sm text-text-secondary">Approve or reject recruiter accounts before they can post jobs.</p>
      </Card>

      {error ? <Card className="border-danger/60 bg-danger/10 text-danger">{error}</Card> : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs text-text-muted">Status</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item} ({statusCounts[item] ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs text-text-muted">Search</label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name/email"
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
          <div className="text-sm text-text-secondary">No recruiters found.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.userId} className="rounded-xl border border-border bg-surface-raised p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-text">{row.fullName || "Unnamed recruiter"}</div>
                    <div className="text-xs text-text-secondary">{row.email}</div>
                    <div className="mt-1 text-xs text-text-muted">
                      {row.companyName} {row.designation !== "-" ? `- ${row.designation}` : ""}
                    </div>
                    <div className="text-xs text-text-muted">{row.website}</div>
                  </div>
                  <Badge variant={row.status === "APPROVED" ? "green" : row.status === "REJECTED" ? "red" : "amber"}>
                    {row.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    disabled={busyUserId === row.userId}
                    onClick={() => void updateStatus(row.userId, "APPROVED")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busyUserId === row.userId}
                    onClick={() => void updateStatus(row.userId, "REJECTED")}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busyUserId === row.userId}
                    onClick={() => void updateStatus(row.userId, "PENDING")}
                  >
                    Mark Pending
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
