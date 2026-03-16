import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  EMAIL_MODE: z.enum(["log", "disabled"]).default("log"),
  EMAIL_FROM: z.string().email().default("no-reply@hireflow.local"),
  ADMIN_EMAILS: z.string().default(""),
  JSEARCH_API_KEY: z.string().optional(),
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
  SERPAPI_KEY: z.string().optional(),
  EXTERNAL_JOBS_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  EXTERNAL_JOBS_POSTED_WINDOW_DAYS: z.coerce.number().int().min(1).max(60).default(14),
  EXTERNAL_JOBS_SYNC_KEY: z.string().optional(),
});

export const env = envSchema.parse({
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  JSEARCH_API_KEY: process.env.JSEARCH_API_KEY,
  ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
  ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
  SERPAPI_KEY: process.env.SERPAPI_KEY,
  EXTERNAL_JOBS_SYNC_INTERVAL_MINUTES: process.env.EXTERNAL_JOBS_SYNC_INTERVAL_MINUTES,
  EXTERNAL_JOBS_POSTED_WINDOW_DAYS: process.env.EXTERNAL_JOBS_POSTED_WINDOW_DAYS,
  EXTERNAL_JOBS_SYNC_KEY: process.env.EXTERNAL_JOBS_SYNC_KEY,
  EMAIL_MODE: process.env.EMAIL_MODE,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
});
