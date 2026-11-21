import type { SupabaseClient } from "@supabase/supabase-js";

export interface AppUserProfile {
  id: string;
  email: string;
  account_status: "pending" | "active";
  is_blocked: boolean;
  role_id: number;
}

export type AccessResult =
  | { ok: true; profile: AppUserProfile }
  | { ok: false; status: number; error: string };

type AccessIdentity = { userId: string; email?: never } | { email: string; userId?: never };

/**
 * Server-side access decision. A user may only authenticate when the matching
 * app_user row exists, is active, and is not blocked.
 */
export async function checkAppUserAccess(
  admin: SupabaseClient,
  identity: AccessIdentity,
): Promise<AccessResult> {
  let query = admin
    .from("app_user")
    .select("id, email, account_status, is_blocked, role_id");

  if ("userId" in identity) {
    query = query.eq("id", identity.userId);
  } else {
    query = query.ilike("email", identity.email);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("App user lookup failed:", error.message);
    return { ok: false, status: 500, error: "Could not verify account access." };
  }

  if (!data) {
    return { ok: false, status: 403, error: "This account is not registered." };
  }

  const profile = data as AppUserProfile;

  if (profile.is_blocked) {
    return { ok: false, status: 403, error: "This account is blocked. Contact an administrator." };
  }

  if (profile.account_status !== "active") {
    return {
      ok: false,
      status: 403,
      error: "This account is pending admin approval.",
    };
  }

  return { ok: true, profile };
}

export function requiresPasswordSetup(userMetadata: unknown): boolean {
  if (!userMetadata || typeof userMetadata !== "object") return false;
  return (userMetadata as Record<string, unknown>).password_setup_required === true;
}
