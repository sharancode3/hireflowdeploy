import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { fetchAdminOverview, fetchRecentLogins, type RecentLoginItem } from "../../admin/adminData";

export function AdminDashboardPage() {
  const [overview, setOverview] = useState({
    pendingRecruiters: 0,
    totalApplications: 0,
    pendingJobReviews: 0,
  });
  const [recentLogins, setRecentLogins] = useState<RecentLoginItem[]>([]);
  const [tableAvailable, setTableAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [stats, logins] = await Promise.all([fetchAdminOverview(), fetchRecentLogins(40)]);
      setOverview(stats);
      setRecentLogins(logins.rows);
      setTableAvailable(logins.tableAvailable);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredLogins = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return recentLogins;
    return recentLogins.filter((item) => {
      const hay = `${item.fullName} ${item.email} ${item.role}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [recentLogins, search]);

  return (
    <div className="space-y-6">
      <Card className="space-y-1">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-text-secondary">Monitor platform activity and verify recruiters.</p>
      </Card>

      {error ? <Card className="border-danger/60 bg-danger/10 text-danger">{error}</Card> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Pending Recruiters</div>
          <div className="mt-2 text-3xl font-semibold">{overview.pendingRecruiters}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Applications</div>
          <div className="mt-2 text-3xl font-semibold">{overview.totalApplications}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-text-muted">Jobs Pending Review</div>
          <div className="mt-2 text-3xl font-semibold">{overview.pendingJobReviews}</div>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recently Logged In Users</h2>
            <p className="text-xs text-text-muted">Shows latest account sign-ins recorded by the app.</p>
          </div>
          <div className="flex gap-2">
            <input
              className="input h-10 w-[260px]"
              placeholder="Search user/email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        </div>

        {!tableAvailable ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
            Login-events table is not available yet. Run the latest SQL migration to enable recent login tracking.
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-text-secondary">Loading...</div>
        ) : filteredLogins.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-raised p-4 text-sm text-text-secondary">No login activity found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogins.map((row) => (
                  <tr key={row.id} className="border-b border-border/70">
                    <td className="px-3 py-2">
                      <div className="font-medium text-text">{row.fullName}</div>
                      <div className="text-xs text-text-secondary">{row.email}</div>
                    </td>
                    <td className="px-3 py-2">{row.role === "RECRUITER" ? "Recruiter" : "Job Seeker"}</td>
                    <td className="px-3 py-2">{row.source}</td>
                    <td className="px-3 py-2">{new Date(row.loggedInAt).toLocaleString()}</td>
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
