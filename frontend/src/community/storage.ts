import type { UserRole } from "../types";

export type CommunityPost = {
  id: string;
  authorId: string;
  authorLabel: string;
  role: UserRole;
  title: string;
  content: string;
  tags: string[];
  likes: number;
  createdAt: string;
};

export type ComplaintStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";

export type ComplaintTicket = {
  id: string;
  creatorId: string;
  creatorLabel: string;
  role: UserRole;
  category: "PLATFORM" | "JOB_POST" | "RECRUITER" | "OTHER";
  subject: string;
  details: string;
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
  adminNote?: string;
};

const POSTS_KEY = "hireflow_community_posts_v1";
const COMPLAINTS_KEY = "hireflow_complaints_v1";

function parseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function now() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listCommunityPosts() {
  return parseArray<CommunityPost>(localStorage.getItem(POSTS_KEY)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createCommunityPost(input: Omit<CommunityPost, "id" | "likes" | "createdAt">) {
  const next: CommunityPost = {
    ...input,
    id: uid("post"),
    likes: 0,
    createdAt: now(),
  };
  const all = [next, ...listCommunityPosts()];
  localStorage.setItem(POSTS_KEY, JSON.stringify(all));
  return next;
}

export function likeCommunityPost(postId: string) {
  const all = listCommunityPosts().map((p) => (p.id === postId ? { ...p, likes: p.likes + 1 } : p));
  localStorage.setItem(POSTS_KEY, JSON.stringify(all));
}

export function listComplaintTickets() {
  return parseArray<ComplaintTicket>(localStorage.getItem(COMPLAINTS_KEY)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createComplaintTicket(input: Omit<ComplaintTicket, "id" | "status" | "createdAt" | "updatedAt">) {
  const next: ComplaintTicket = {
    ...input,
    id: uid("ticket"),
    status: "OPEN",
    createdAt: now(),
    updatedAt: now(),
  };
  const all = [next, ...listComplaintTickets()];
  localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(all));
  return next;
}

export function updateComplaintTicket(
  ticketId: string,
  patch: Partial<Pick<ComplaintTicket, "status" | "adminNote">>,
) {
  const all = listComplaintTickets().map((t) =>
    t.id === ticketId
      ? {
          ...t,
          ...patch,
          updatedAt: now(),
        }
      : t,
  );
  localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(all));
}
