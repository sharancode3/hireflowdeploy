import type { NextFunction, Request, Response } from "express";
import { env } from "../env";
import { HttpError } from "../utils/httpError";
import { getSupabaseAdmin, isSupabaseConfigured } from "../supabase";

export type AuthenticatedRequest = Request & { auth: { userId: string } };

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header) {
    return next(new HttpError(401, "Missing Authorization header"));
  }

  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return next(new HttpError(401, "Invalid Authorization header"));
  }

  if (!isSupabaseConfigured()) {
    return next(new HttpError(503, "Supabase is not configured on the backend"));
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return next(new HttpError(401, "Invalid or expired token"));
    }

    (req as AuthenticatedRequest).auth = { userId: data.user.id };
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
}

export function requireAdmin() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header("authorization");
    if (!header) return next(new HttpError(401, "Missing Authorization header"));

    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token) {
      return next(new HttpError(401, "Invalid Authorization header"));
    }

    if (!isSupabaseConfigured()) {
      return next(new HttpError(503, "Supabase is not configured on the backend"));
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) {
      return next(new HttpError(401, "User not found"));
    }

    const allowlist = env.ADMIN_EMAILS.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!allowlist.includes(data.user.email.toLowerCase())) {
      return next(new HttpError(403, "Admin access required"));
    }

    return next();
  };
}
