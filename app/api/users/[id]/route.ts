import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getManagerContext,
  isLastActiveSuperadmin,
  resolveRoleId,
  type ManagedRole,
} from "@/lib/user-management";
import { validateEditUser } from "@/lib/user-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number, fieldErrors?: Record<string, string>) {
  return NextResponse.json(fieldErrors ? { error, fieldErrors } : { error }, {
    status,
    headers: noStore,
  });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: targetId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    supabase = await createClient();
    admin = createAdminClient();
  } catch (configError) {
    console.error("User management configuration error:", configError);
    return fail("User management is not configured on the server.", 500);
  }

  const access = await getManagerContext(supabase, admin);
  if (!access.ok) return fail(access.error, access.status);

  const { data: target, error: targetError } = await admin
    .from("app_user")
    .select("id, email, first_name, last_name, role_id, account_status, is_blocked")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError) {
    console.error("Target user lookup failed:", targetError.message);
    return fail("Could not look up that user.", 500);
  }
  if (!target) return fail("User not found.", 404);

  const { data: targetRole } = await admin
    .from("app_role")
    .select("role_code")
    .eq("role_id", target.role_id)
    .maybeSingle();
  const targetRoleCode = (targetRole?.role_code ?? "user") as ManagedRole;

  // Admin visibility and write scope: standard Users only.
  if (access.context.roleCode === "admin" && targetRoleCode !== "user") {
    return fail("User not found.", 404);
  }

  const allowedRoles: ManagedRole[] =
    access.context.roleCode === "superadmin" ? ["user", "admin", "superadmin"] : ["user"];
  const validation = validateEditUser(payload, allowedRoles);
  if (!validation.ok) return fail(validation.error, 400, validation.fieldErrors);

  const { firstName, lastName, role } = validation.value;

  if (role && access.context.roleCode !== "superadmin") {
    return fail("Only a Superadmin can change a user's role.", 403, {
      role: "You cannot change roles.",
    });
  }

  if (role && role !== targetRoleCode) {
    if (targetRoleCode === "superadmin" && (await isLastActiveSuperadmin(admin, targetId))) {
      return fail("The last active Superadmin cannot be demoted.", 409);
    }
  }

  let roleId: number | undefined;
  if (role && role !== targetRoleCode) {
    const resolved = await resolveRoleId(admin, role);
    if (resolved === null) return fail("Could not resolve the requested role.", 500);
    roleId = resolved;
  }

  const update: Record<string, string | number> = {};
  if (firstName !== undefined) update.first_name = firstName;
  if (lastName !== undefined) update.last_name = lastName;
  if (roleId !== undefined) update.role_id = roleId;

  // The session client keeps RLS and the app_user guard trigger authoritative.
  const { error: updateError } = await supabase.from("app_user").update(update).eq("id", targetId);
  if (updateError) {
    console.error("User update failed:", updateError.message);
    return fail("Could not update that user.", 500);
  }

  const metadataChanges: Record<string, string> = {};
  if (firstName !== undefined) metadataChanges.first_name = firstName;
  if (lastName !== undefined) metadataChanges.last_name = lastName;
  if (Object.keys(metadataChanges).length > 0) {
    const { data: authUser, error: authLookupError } = await admin.auth.admin.getUserById(targetId);
    if (authLookupError || !authUser.user) {
      console.error("Auth user lookup failed:", authLookupError?.message ?? "No user returned.");
      return fail("The profile changed, but Auth metadata could not be updated.", 500);
    }

    const { error: metadataError } = await admin.auth.admin.updateUserById(targetId, {
      user_metadata: { ...authUser.user.user_metadata, ...metadataChanges },
    });
    if (metadataError) {
      console.error("Auth metadata update failed:", metadataError.message);
      return fail("The profile changed, but Auth metadata could not be updated.", 500);
    }
  }

  return NextResponse.json(
    {
      user: {
        id: targetId,
        email: target.email,
        firstName: firstName ?? target.first_name,
        lastName: lastName ?? target.last_name,
        role: role ?? targetRoleCode,
        accountStatus: target.account_status,
        isBlocked: target.is_blocked,
      },
    },
    { headers: noStore },
  );
}
