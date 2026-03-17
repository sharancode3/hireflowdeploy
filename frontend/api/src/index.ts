import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./env";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

import { healthRouter } from "./routes/health";
import { externalJobsRouter } from "./routes/admin/externalJobsPublic";
import { recruiterSupabaseRouter } from "./routes/recruiter/supabaseRecruiter";
import { assistantRouter } from "./routes/assistant";
import { startExternalJobsScheduler } from "./services/externalJobsService";

const app = express();

const configuredOrigins = env.CORS_ORIGIN
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const localOriginPattern = /^https?:\/\/localhost(?::\d+)?$/;
const codespacesOriginPattern = /^https:\/\/[a-z0-9-]+\.(?:app\.github\.dev|githubpreview\.dev)$/i;
const githubPagesOriginPattern = /^https:\/\/[a-z0-9-]+\.github\.io$/i;
const commonStaticHostPattern = /^https:\/\/[a-z0-9-]+\.(?:vercel\.app|netlify\.app)$/i;

app.use(
  cors({
    credentials: false,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes("*") || configuredOrigins.includes(origin)) return callback(null, true);
      if (localOriginPattern.test(origin) || codespacesOriginPattern.test(origin)) return callback(null, true);
      if (githubPagesOriginPattern.test(origin) || commonStaticHostPattern.test(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
  })
);
app.use(helmet());
app.use(express.json({ limit: "12mb" }));

app.use(healthRouter);
app.use(externalJobsRouter);
app.use(recruiterSupabaseRouter);
app.use(assistantRouter);

// Initialize jobs scheduler asynchronously
try {
  startExternalJobsScheduler();
} catch (err) {
  console.error("[Server] Error starting external jobs scheduler:", err);
}

app.use(notFound);
app.use(errorHandler);

export default app;
