import { Router } from "express";
import { isSupabaseConfigured } from "../supabase";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true, supabaseConfigured: isSupabaseConfigured() });
});
