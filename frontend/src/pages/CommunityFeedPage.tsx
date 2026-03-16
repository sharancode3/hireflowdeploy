import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { createCommunityPost, likeCommunityPost, listCommunityPosts } from "../community/storage";

function timeAgo(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const h = Math.floor(delta / (1000 * 60 * 60));
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function CommunityFeedPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [filter, setFilter] = useState<"ALL" | "JOB_SEEKER" | "RECRUITER">("ALL");
  const [version, setVersion] = useState(0);

  const posts = useMemo(() => {
    const all = listCommunityPosts();
    return filter === "ALL" ? all : all.filter((p) => p.role === filter);
  }, [filter, version]);

  function submitPost() {
    if (!user) return;
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (cleanTitle.length < 5 || cleanContent.length < 20) return;
    createCommunityPost({
      authorId: user.id,
      authorLabel: user.email.split("@")[0],
      role: user.role,
      title: cleanTitle,
      content: cleanContent,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6),
    });
    setTitle("");
    setContent("");
    setTags("");
    setVersion((v) => v + 1);
  }

  return (
    <div className="mx-auto max-w-[860px] space-y-4">
      <div className="card-base">
        <h1 className="text-2xl font-semibold">Experience Feed</h1>
        <p className="mt-2 text-sm text-text-secondary">Share interview experiences, company reviews, and practical preparation advice.</p>
      </div>

      <div className="card-base space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Create Post</div>
        <input className="input" placeholder="Post title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="input"
          style={{ minHeight: 120, resize: "vertical" }}
          placeholder="What happened? What should others learn from your experience?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <input className="input" placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-text-muted">Minimum 5 chars title and 20 chars content.</div>
          <button type="button" className="btn btn-primary" onClick={submitPost}>Publish</button>
        </div>
      </div>

      <div className="card-base space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn ${filter === "ALL" ? "btn-primary" : ""}`} onClick={() => setFilter("ALL")}>All</button>
          <button type="button" className={`btn ${filter === "JOB_SEEKER" ? "btn-primary" : ""}`} onClick={() => setFilter("JOB_SEEKER")}>Job Seekers</button>
          <button type="button" className={`btn ${filter === "RECRUITER" ? "btn-primary" : ""}`} onClick={() => setFilter("RECRUITER")}>Recruiters</button>
        </div>

        {posts.length === 0 ? (
          <div className="text-sm text-text-muted">No posts yet. Be the first to share.</div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-xl border border-border bg-surface-raised p-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-text">{post.title}</div>
                  <div className="text-[11px] text-text-muted">{timeAgo(post.createdAt)}</div>
                </div>
                <div className="mb-2 text-xs text-text-secondary">{post.authorLabel} ({post.role === "JOB_SEEKER" ? "Job Seeker" : "Recruiter"})</div>
                <p className="text-sm text-text-secondary">{post.content}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1">
                    {post.tags.map((t) => (
                      <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">#{t}</span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      likeCommunityPost(post.id);
                      setVersion((v) => v + 1);
                    }}
                  >
                    Helpful ({post.likes})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
