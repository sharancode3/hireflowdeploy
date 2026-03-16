import { useEffect, useState } from "react";
import { apiJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { openResumePreview } from "../../utils/resumePreview";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/PageSkeleton";

type Row = {
  applicationId: string;
  status: string;
  interviewAt: string | null;
  job: { id: string; title: string; companyName: string; location: string };
  candidate: {
    id: string;
    fullName: string;
    location?: string | null;
    phone?: string | null;
    headline?: string | null;
    desiredRole?: string | null;
    isFresher?: boolean;
    skills: string[];
    experienceYears: number;
    latestResume: { id: string; originalName: string } | null;
  };
};

export function RecruiterShortlistedPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadRows() {
    if (!token) return;
    const data = await apiJson<{ applications: Row[] }>("/recruiter/applications?status=SHORTLISTED", { token });
    setRows(data.applications);
  }

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        setError(null);
        await loadRows();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load shortlisted");
      }
    })();
  }, [token]);

  async function removeFromShortlist(applicationId: string) {
    if (!token || busyId) return;
    setBusyId(applicationId);
    setError(null);
    try {
      await apiJson(`/recruiter/applications/${applicationId}`, {
        method: "DELETE",
        token,
      });
      await loadRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove shortlisted candidate");
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null && !error) return <TableSkeleton cols={4} rows={4} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Shortlisted</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Candidates you've shortlisted across all jobs.</p>
      </div>

      {error && <Card className="border-[var(--danger)]/30 p-4 text-sm text-[var(--danger)]">{error}</Card>}

      {rows && rows.length === 0 ? (
        <EmptyState
          title="No shortlisted candidates"
          description="Shortlist candidates from the Applicants page to see them here."
        />
      ) : (
        <div className="space-y-3 stagger-list">
          {rows?.map((r) => (
            <Card key={r.applicationId} className="p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-[var(--accent-teal)]/10 flex items-center justify-center text-xs font-bold text-[var(--accent-teal)]">
                    {r.candidate.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{r.candidate.fullName}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {r.candidate.experienceYears} yrs
                      {r.candidate.desiredRole ? ` • ${r.candidate.desiredRole}` : ""}
                      {r.candidate.location ? ` • ${r.candidate.location}` : ""}
                    </div>
                    {r.candidate.phone ? <div className="text-[11px] text-[var(--muted)]">Phone: {r.candidate.phone}</div> : null}
                    {r.candidate.headline ? <div className="text-[11px] text-[var(--muted)]">{r.candidate.headline}</div> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="teal">Shortlisted</Badge>
                  <span className="text-xs text-[var(--muted)]">{r.job.title}</span>
                  {r.candidate.latestResume ? (
                    <Button variant="ghost" className="text-xs" onClick={() => void openResumePreview(r.candidate.latestResume!.id, token!)}>Resume</Button>
                  ) : null}
                  <Button
                    variant="danger"
                    className="text-xs"
                    disabled={busyId === r.applicationId}
                    onClick={() => void removeFromShortlist(r.applicationId)}
                  >
                    {busyId === r.applicationId ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
