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
import { startExternalJobsScheduler } from "./services/externalJobsService";

async function bootstrap() {
  const app = express();

  const configuredOrigins = env.CORS_ORIGIN
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const localOriginPattern = /^https?:\/\/localhost(?::\d+)?$/;
  const codespacesOriginPattern = /^https:\/\/[a-z0-9-]+\.(?:app\.github\.dev|githubpreview\.dev)$/i;

  app.use(
    cors({
      credentials: false,
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (configuredOrigins.includes("*") || configuredOrigins.includes(origin)) return callback(null, true);
        if (localOriginPattern.test(origin) || codespacesOriginPattern.test(origin)) return callback(null, true);
        return callback(new Error("CORS origin not allowed"));
      },
    })
  );
  app.use(helmet());
  app.use(express.json({ limit: "12mb" }));

  app.use(healthRouter);
  app.use(externalJobsRouter);
  app.use(recruiterSupabaseRouter);

  startExternalJobsScheduler();

  app.use(notFound);
  app.use(errorHandler);

  app.listen(env.PORT, () => {
    console.log(`[Server] Running on port ${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
