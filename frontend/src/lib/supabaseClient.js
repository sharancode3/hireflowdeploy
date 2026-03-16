import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseEnv) {
	console.error(
		"Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for production builds.",
	);
}

// Keep the app shell renderable even when env vars are missing on static hosts.
const runtimeSupabaseUrl = hasSupabaseEnv ? supabaseUrl : "https://example.supabase.co";
const runtimeSupabaseAnonKey = hasSupabaseEnv ? supabaseAnonKey : "missing-supabase-anon-key";

export const supabase = createClient(runtimeSupabaseUrl, runtimeSupabaseAnonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
});

export const isSupabaseConfigured = hasSupabaseEnv;
