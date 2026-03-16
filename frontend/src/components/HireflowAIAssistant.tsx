import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Message = { id: string; from: "ai" | "user"; text: string };

const quickSuggestions = [
  "Improve my summary",
  "Suggest skills for my role",
  "How to prepare for interviews",
];

function pageHint(pathname: string) {
  if (pathname.includes("resume-builder")) return "I can help optimize your resume for ATS and role-specific keywords.";
  if (pathname.includes("profile")) return "I can help write profile summaries and improve your experience bullets.";
  if (pathname.includes("jobs")) return "I can help tailor your profile for roles you are viewing.";
  return "I can help with resume writing, skills, interviews, and career strategy.";
}

export function HireflowAIAssistant() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const messageCounterRef = useRef(2);
  const storageKey = `hireflow_ai_session:${user?.id ?? "guest"}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as Message[];
    } catch {
      // Ignore invalid persisted data.
    }
    return [
      { id: "m1", from: "ai", text: `Hi ${user?.email?.split("@")[0] ?? "there"}! I am Hireflow AI. How can I help you today?` },
      { id: "m2", from: "ai", text: pageHint(location.pathname) },
    ];
  });

  const contextualTip = useMemo(() => pageHint(location.pathname), [location.pathname]);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  function sendMessage(content?: string) {
    const value = (content ?? text).trim();
    if (!value) return;

    messageCounterRef.current += 1;
    const userMsg: Message = { id: `u_${messageCounterRef.current}`, from: "user", text: value };
    setMessages((prev) => [...prev, userMsg]);
    setText("");
    setTyping(true);

    window.setTimeout(() => {
      messageCounterRef.current += 1;
      const aiMsg: Message = {
        id: `a_${messageCounterRef.current}`,
        from: "ai",
        text: `Great prompt. ${contextualTip} For this request: "${value}", I recommend starting with 3 quantified achievements and role-specific keywords.`,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setTyping(false);
    }, 700);
  }

  if (!user) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[120]">
      {open ? (
        <div className="pointer-events-auto flex h-[500px] w-[360px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lift max-sm:h-[65vh] max-sm:w-[calc(100vw-16px)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-text">Hireflow AI</div>
              <div className="flex items-center gap-1 text-xs text-text-muted"><span className="h-2 w-2 rounded-full bg-green-500" />Online</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-raised hover:text-text"
                onClick={() => setMinimized((v) => !v)}
                aria-label={minimized ? "Expand assistant" : "Minimize assistant"}
                aria-pressed={minimized}
              >
                {minimized ? "Expand" : "Minimize"}
              </button>
              <button type="button" aria-label="Close assistant" className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-raised hover:text-text" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>

          {!minimized ? <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${m.from === "user" ? "bg-[var(--color-accent)] text-[var(--color-sidebar-active-text)]" : "bg-surface-raised text-text"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {typing ? (
              <div className="inline-flex rounded-2xl bg-surface-raised px-3 py-2 text-sm text-text-muted">...</div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {quickSuggestions.map((s) => (
                <button key={s} type="button" onClick={() => sendMessage(s)} className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary hover:border-[var(--color-accent)] hover:text-text">
                  {s}
                </button>
              ))}
            </div>
          </div> : null}

          {!minimized ? <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask anything about your career..."
                className="h-10 flex-1 rounded-lg border border-border bg-surface-raised px-3 text-sm text-text outline-none"
              />
              <button type="button" aria-label="Send message" onClick={() => sendMessage()} className="btn-base h-10 w-10 rounded-lg p-0 text-[var(--color-sidebar-active-text)]" style={{ background: "linear-gradient(120deg,var(--color-accent),var(--accent-purple))" }}>
                →
              </button>
            </div>
          </div> : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tooltip-trigger pointer-events-auto relative mt-3 flex h-14 w-14 items-center justify-center rounded-full text-[var(--color-sidebar-active-text)] shadow-lift transition hover:scale-110"
        style={{ background: "linear-gradient(120deg,var(--color-accent),var(--accent-purple))", animation: "pulse-glow 2.5s ease-in-out infinite" }}
        aria-label="Ask Hireflow AI"
      >
        <span className="tooltip">Ask Hireflow AI</span>
        H
      </button>
    </div>
  );
}
