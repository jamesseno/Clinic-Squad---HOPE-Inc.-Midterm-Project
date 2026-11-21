import type { SupabaseClient } from "@supabase/supabase-js";

export type RoleCode = "superadmin" | "admin" | "user";
export type ManagerRole = Extract<RoleCode, "superadmin" | "admin">;
export type ManagedRole = RoleCode;

export interface ManagerContext {
  userId: string;
  email: string;
  roleCode: ManagerRole;
}

export type ManagerContextResult =
  | { ok: true; context: ManagerContext }
  | { ok: false; status: number; error: string };

/**
 * Server-side manager gate. Role comes from the authenticated app_user row,
 * never from the request body or a client-supplied header.
 */
export async function getManagerContext(
  supabase: SupabaseClient,
  admin: SupabaseClient,
): Promise<ManagerContextResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: "Sign in to continue." };
  }

  const { data: profile, error: profileError } = await admin
    .from("app_user")
    .select("id, email, account_status, is_blocked, role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Manager profile lookup failed:", profileError.message);
    return { ok: false, status: 500, error: "Could not verify your account." };
  }

  if (!profile) {
    return { ok: false, status: 403, error: "This account is not registered." };
  }
  if (profile.is_blocked) {
    return { ok: false, status: 403, error: "This account is blocked." };
  }
  if (profile.account_status !== "active") {
    return { ok: false, status: 403, error: "This account is pending approval." };
  }

  const { data: role, error: roleError } = await admin
    .from("app_role")
    .select("role_code")
    .eq("role_id", profile.role_id)
    .maybeSingle();

  if (roleError || !role) {
    console.error("Manager role lookup failed:", roleError?.message ?? "No role row.");
    return { ok: false, status: 500, error: "Could not verify your role." };
  }

  if (role.role_code !== "superadmin" && role.role_code !== "admin") {
    return { ok: false, status: 403, error: "You do not have access to user management." };
  }

  return {
    ok: true,
    context: {
      userId: user.id,
      email: user.email ?? profile.email,
      roleCode: role.role_code,
    },
  };
}

export async function resolveRoleId(
  admin: SupabaseClient,
  roleCode: ManagedRole,
): Promise<number | null> {
  const { data, error } = await admin
    .from("app_role")
    .select("role_id")
    .eq("role_code", roleCode)
    .maybeSingle();

  if (error || !data) {
    console.error("Managed role lookup failed:", error?.message ?? `No ${roleCode} role row.`);
    return null;
  }

  return data.role_id;
}

/**
 * The last active, unblocked Superadmin must remain available. Returns true
 * only when `userId` is that account.
 */
export async function isLastActiveSuperadmin(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: role, error: roleError } = await admin
    .from("app_role")
    .select("role_id")
    .eq("role_code", "superadmin")
    .maybeSingle();

  if (roleError || !role) return false;

  const { data: admins, error } = await admin
    .from("app_user")
    .select("id")
    .eq("role_id", role.role_id)
    .eq("account_status", "active")
    .eq("is_blocked", false);

  if (error) {
    console.error("Superadmin guard lookup failed:", error.message);
    return false;
  }

  return admins?.length === 1 && admins[0]?.id === userId;
}
