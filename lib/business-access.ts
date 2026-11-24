import type { SupabaseClient } from "@supabase/supabase-js";

export type BusinessRole = "superadmin" | "admin" | "user";
export type BusinessRight =
  | "add_customer"
  | "edit_customer"
  | "delete_customer"
  | "add_product"
  | "edit_product"
  | "delete_product"
  | "add_price"
  | "edit_price"
  | "delete_price"
  | "view_department"
  | "add_department"
  | "edit_department"
  | "delete_department"
  | "view_job"
  | "add_job"
  | "edit_job"
  | "delete_job"
  | "view_employee"
  | "add_employee"
  | "edit_employee"
  | "delete_employee"
  | "view_job_history"
  | "add_job_history"
  | "edit_job_history"
  | "delete_job_history";

export interface BusinessAccess {
  userId: string;
  email: string;
  roleCode: BusinessRole;
  rights: ReadonlySet<BusinessRight>;
}

export type BusinessAccessResult =
  | { ok: true; access: BusinessAccess }
  | { ok: false; status: number; error: string };

const isBusinessRole = (value: string): value is BusinessRole =>
  value === "superadmin" || value === "admin" || value === "user";

export async function getBusinessAccess(
  session: SupabaseClient,
  admin: SupabaseClient,
): Promise<BusinessAccessResult> {
  const {
    data: { user },
    error: authError,
  } = await session.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "Sign in to continue." };
  }

  const { data: profile, error: profileError } = await admin
    .from("app_user")
    .select("id, email, role_id, account_status, is_blocked")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Business profile lookup failed:", profileError.message);
    return { ok: false, status: 500, error: "Could not verify your account." };
  }
  if (!profile) {
    return { ok: false, status: 403, error: "This account is not registered." };
  }
  if (profile.account_status !== "active" || profile.is_blocked) {
    return { ok: false, status: 403, error: "This account does not have active access." };
  }

  const { data: role, error: roleError } = await admin
    .from("app_role")
    .select("role_code")
    .eq("role_id", profile.role_id)
    .maybeSingle();

  if (roleError || !role || !isBusinessRole(role.role_code)) {
    console.error("Business role lookup failed:", roleError?.message ?? "No valid role row.");
    return { ok: false, status: 500, error: "Could not verify your role." };
  }

  const [roleRights, userRights] = await Promise.all([
    admin.from("role_permission").select("right_id").eq("role_id", profile.role_id),
    admin
      .from("user_permission")
      .select("right_id")
      .eq("user_id", user.id)
      .eq("is_deleted", false),
  ]);

  if (roleRights.error || userRights.error) {
    console.error(
      "Business permission lookup failed:",
      roleRights.error?.message ?? userRights.error?.message,
    );
    return { ok: false, status: 500, error: "Could not verify your permissions." };
  }

  const rightIds = [
    ...new Set([
      ...(roleRights.data ?? []).map((row) => row.right_id),
      ...(userRights.data ?? []).map((row) => row.right_id),
    ]),
  ];

  let rights = new Set<BusinessRight>();
  if (rightIds.length > 0) {
    const { data: rightRows, error: rightsError } = await admin
      .from("rights_catalog")
      .select("right_code")
      .in("right_id", rightIds)
      .eq("is_active", true);

    if (rightsError) {
      console.error("Business rights catalogue lookup failed:", rightsError.message);
      return { ok: false, status: 500, error: "Could not verify your permissions." };
    }

    const businessCodes = new Set<BusinessRight>([
      "add_customer",
      "edit_customer",
      "delete_customer",
      "add_product",
      "edit_product",
      "delete_product",
      "add_price",
      "edit_price",
      "delete_price",
    ]);
    rights = new Set(
      (rightRows ?? []).flatMap((row) =>
        businessCodes.has(row.right_code as BusinessRight)
          ? [row.right_code as BusinessRight]
          : [],
      ),
    );
  }

  return {
    ok: true,
    access: {
      userId: user.id,
      email: user.email ?? profile.email,
      roleCode: role.role_code,
      rights,
    },
  };
}

export function hasAnyBusinessRight(
  access: BusinessAccess,
  rightCodes: readonly BusinessRight[],
): boolean {
  return rightCodes.some((rightCode) => access.rights.has(rightCode));
}
