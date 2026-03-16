import type { User, UserRole } from "../types";

export type SignUpMetadata = {
  fullName?: string;
  role?: UserRole;
  phone?: string;
  companyName?: string;
};

export type AuthSession = {
  token: string;
  user: User;
};

export type AuthStateChangePayload = {
  event: string;
  token: string | null;
  user: User | null;
};

export function signInWithEmail(email: string, password: string): Promise<AuthSession>;
export function signUpWithEmail(email: string, password: string, metadata?: SignUpMetadata): Promise<AuthSession>;
export function resendVerificationEmail(email: string): Promise<void>;
export function signOut(): Promise<void>;
export function getCurrentUser(): Promise<User | null>;
export function onAuthStateChange(callback: (payload: AuthStateChangePayload) => void): () => void;
export function getCurrentSession(): Promise<{ token: string | null; user: User | null }>;
