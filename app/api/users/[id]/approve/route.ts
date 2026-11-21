import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getManagerContext, resolveRoleId } from "@/lib/user-management";
import type { ManagedRole } from "@/lib/user-management";
import { validateApproveUser } from "@/lib/user-validation";

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

/** Superadmin-only approval of a pending account, optionally as an Admin. */
export async function POST(request: Request, context: RouteContext) {
  const { id: targetId } = await context.params;

  let rawPayload: unknown;
  const text = await request.text();
  if (text) {
    try {
      rawPayload = JSON.parse(text);
    } catch {
      return fail("Request body must be valid JSON.", 400);
    }
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

  if (access.context.roleCode !== "superadmin") {
    return fail("Only a Superadmin can approve accounts.", 403);
  }

  const validation = validateApproveUser(rawPayload);
  if (!validation.ok) return fail(validation.error, 400, validation.fieldErrors);
  const { role: designateRole } = validation.value;

  const { data: target, error: targetError } = await admin
    .from("app_user")
    .select("id, email, first_name, last_name, role_id, account_status, is_blocked")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError) {
    console.error("Approval target lookup failed:", targetError.message);
    return fail("Could not look up that user.", 500);
  }
  if (!target) return fail("User not found.", 404);

  const { data: targetRole } = await admin
    .from("app_role")
    .select("role_code")
    .eq("role_id", target.role_id)
    .maybeSingle();
  const targetRoleCode = (targetRole?.role_code ?? "user") as ManagedRole;

  if (target.account_status === "active") {
    return fail("That account is already active.", 409);
  }
  if (target.is_blocked) {
    return fail("Unblock the account before approving it.", 409);
  }

  const update: Record<string, string | number> = { account_status: "active" };
  const resultingRole: ManagedRole = designateRole ?? targetRoleCode;

  if (designateRole && designateRole !== targetRoleCode) {
    const resolved = await resolveRoleId(admin, designateRole);
    if (resolved === null) return fail("Could not resolve the requested role.", 500);
    update.role_id = resolved;
  }

  // The session client keeps RLS and the app_user guard trigger authoritative.
  const { error: updateError } = await supabase
    .from("app_user")
    .update(update)
    .eq("id", targetId);

  if (updateError) {
    console.error("User approval failed:", updateError.message);
    return fail("Could not approve that user.", 500);
  }

  return NextResponse.json(
    {
      user: {
        id: targetId,
        email: target.email,
        firstName: target.first_name,
        lastName: target.last_name,
        role: resultingRole,
        accountStatus: "active",
        isBlocked: false,
      },
    },
    { headers: noStore },
  );
}
