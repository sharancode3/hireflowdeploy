import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { env } from "../env";

export const assistantRouter = Router();

assistantRouter.use("/ai", requireAuth);

const askSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  pagePath: z.string().trim().optional(),
  role: z.enum(["JOB_SEEKER", "RECRUITER"]).optional(),
});

function localFallback(message: string, pagePath: string, role: "JOB_SEEKER" | "RECRUITER") {
  const q = message.toLowerCase();

  if (q.includes("internship") || q.includes("open today") || q.includes("jobs today")) {
    return "Open Jobs & Internships, set filters: Job Type = Internship, Experience = Fresher/Junior, then review recent listings and apply directly. Use Save on external listings and Apply on Hireflow listings for full tracking.";
  }

  if (q.includes("profile") || q.includes("resume") || q.includes("shortlist")) {
    return "For stronger shortlist chances: complete Profile Builder basics, align headline/skills with target role, add quantified achievements, and keep one updated resume as primary.";
  }

  if (q.includes("coding") || q.includes("interview") || q.includes("dsa")) {
    return "Use a weekly loop: 4 DSA sessions, 2 role-specific CS sessions, 2 mock rounds. Focus first on arrays/strings, hashing, trees, graphs, then system/API fundamentals for your role.";
  }

  if (role === "RECRUITER") {
    return "For recruiter flow: Post Job, keep skills/experience criteria clear, monitor Applicants pipeline, then move candidates through shortlist and interview stages.";
  }

  if (pagePath.includes("jobs")) {
    return "You are on jobs flow. I can help with filters, application strategy, and profile tweaks to improve match quality.";
  }

  return "I am tuned for Hireflow. Ask me about jobs/internships discovery, profile optimization, resume quality, and interview prep with platform-specific steps.";
}

function websiteContext(role: "JOB_SEEKER" | "RECRUITER", pagePath: string) {
  return [
    "You are Hireflow AI, assistant for the Hireflow placement and internship portal.",
    "Always answer with actionable steps inside this product before giving generic advice.",
    "Key areas: Job Seeker dashboard, Profile Builder, Jobs & Internships, Saved Jobs, Resume Builder, Interview Prep, Recruiter dashboard, Post Job, Applicants pipeline.",
    `Current user role: ${role}.`,
    `Current page path: ${pagePath || "/"}.`,
    "If user asks internships open today, tell them where to filter and how to apply inside Hireflow.",
    "Keep responses concise and practical.",
  ].join("\n");
}

assistantRouter.post("/ai/assistant", async (req, res) => {
  const authed = req as unknown as AuthenticatedRequest;
  const parsed = askSchema.safeParse(req.body || {});

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid assistant request" });
  }

  const { message } = parsed.data;
  const pagePath = parsed.data.pagePath || "/";
  const role = parsed.data.role || "JOB_SEEKER";

  if (!env.HUGGINGFACE_API_KEY) {
    return res.json({ reply: localFallback(message, pagePath, role) });
  }

  try {
    const model = env.HUGGINGFACE_MODEL || "meta-llama/Llama-3.1-8B-Instruct";
    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: websiteContext(role, pagePath) },
          { role: "user", content: message },
        ],
        temperature: 0.2,
        max_tokens: 350,
      }),
    });

    if (!response.ok) {
      return res.json({ reply: localFallback(message, pagePath, role) });
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.json({ reply: localFallback(message, pagePath, role) });
    }

    return res.json({ reply });
  } catch {
    return res.json({ reply: localFallback(message, pagePath, role) });
  }
});
