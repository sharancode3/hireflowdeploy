import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Briefcase,
  Building2,
  FileEdit,
  FileText,
  Flag,
  LayoutDashboard,
  ShieldCheck,
  MessageSquare,
  Rss,
  Settings,
  UserCircle,
} from "lucide-react";
import { config } from "../config";
import { useAuth } from "../auth/AuthContext";

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { group: string; items: NavItem[] };

const jobSeekerNav: NavGroup[] = [
  {
    group: "MAIN",
    items: [
      { to: "/job-seeker/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/job-seeker/jobs", label: "Jobs & Internships", icon: Briefcase },
    ],
  },
  {
    group: "WORKSPACE",
    items: [
      { to: "/job-seeker/profile", label: "Profile Builder", icon: UserCircle },
      { to: "/job-seeker/resume-builder", label: "Resume Builder", icon: FileEdit },
      { to: "/job-seeker/interview-prep", label: "Interview Prep", icon: MessageSquare },
      { to: "/job-seeker/saved", label: "Saved", icon: Bookmark },
    ],
  },
  {
    group: "COMMUNITY",
    items: [
      { to: "/job-seeker/experience-feed", label: "Community Feed", icon: Rss },
      { to: "/job-seeker/complaints", label: "Feedback", icon: Flag },
    ],
  },
  {
    group: "ACCOUNT",
    items: [{ to: "/job-seeker/settings", label: "Settings", icon: Settings }],
  },
];

const recruiterNav: NavGroup[] = [
  {
    group: "MAIN",
    items: [
      { to: "/recruiter/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/recruiter/listings", label: "Job Listings", icon: Briefcase },
      { to: "/recruiter/applicants", label: "Applications", icon: FileText },
    ],
  },
  {
    group: "WORKSPACE",
    items: [
      { to: "/recruiter/post-job", label: "Post a Job", icon: UserCircle },
      { to: "/recruiter/interviews", label: "Interviews", icon: MessageSquare },
      { to: "/recruiter/shortlisted", label: "Shortlisted", icon: Bookmark },
      { to: "/recruiter/profile", label: "Company Profile", icon: FileEdit },
    ],
  },
  {
    group: "ACCOUNT",
    items: [{ to: "/recruiter/settings", label: "Settings", icon: Settings }],
  },
];

const adminNav: NavGroup[] = [
  {
    group: "ADMIN",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/recruiters", label: "Recruiter Verification", icon: ShieldCheck },
      { to: "/admin/applicants", label: "Applicant Management", icon: Briefcase },
      { to: "/admin/job-review", label: "Job Review", icon: Building2 },
    ],
  },
  {
    group: "ACCOUNT",
    items: [{ to: "/job-seeker/settings", label: "Settings", icon: Settings }],
  },
];

export function AppSidebar({
  mobile,
  onNavigate,
  collapsed = false,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
} = {}) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.email && config.adminEmails.includes(user.email.trim().toLowerCase()));
  const groups = isAdmin ? adminNav : (user?.role === "RECRUITER" ? recruiterNav : jobSeekerNav);

  const baseClass = mobile
    ? "flex flex-col gap-6"
    : `hidden lg:flex lg:max-h-[calc(100vh-64px)] lg:flex-col lg:gap-6 lg:overflow-y-auto lg:border-r lg:border-[var(--color-border)] lg:bg-[var(--color-sidebar-bg)] lg:px-3 lg:py-6 lg:transition-all lg:duration-300 ${collapsed ? "lg:w-[60px]" : "lg:w-[256px]"}`;

  return (
    <aside className={baseClass}>
      {groups.map((group, groupIndex) => (
        <div key={group.group} className="space-y-2">
          {!collapsed || mobile ? (
            <div className={(groupIndex === 0 ? "mb-1 px-2" : "mt-4 mb-1 px-2") + " text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-placeholder)]"}>{group.group}</div>
          ) : null}
          <nav className="flex flex-col gap-1">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={collapsed && !mobile ? item.label : undefined}
                className={({ isActive }) =>
                  [
                    "group relative overflow-hidden flex items-center rounded-lg py-2 text-sm transition duration-150",
                    collapsed && !mobile ? "justify-center px-0" : "gap-[10px] px-3",
                    isActive
                      ? "border-l-2 border-l-[var(--color-accent)] bg-[var(--color-sidebar-active-bg)] text-[var(--color-sidebar-active-text)] font-medium"
                      : "border-l-2 border-l-transparent text-[var(--color-sidebar-text)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="animate-sidebar-sheen pointer-events-none absolute inset-0 -translate-x-full opacity-0 group-hover:opacity-100" />
                    <span
                      className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center transition-colors duration-150 group-hover:text-[var(--color-accent)]"
                      style={{ color: isActive ? "var(--color-accent)" : "var(--color-sidebar-text)" }}
                    >
                      <item.icon size={18} strokeWidth={2} />
                    </span>
                    {!collapsed || mobile ? <span className="whitespace-nowrap overflow-visible text-[14px] font-medium">{item.label}</span> : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}
