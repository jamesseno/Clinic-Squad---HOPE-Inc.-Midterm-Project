import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getManagerContext, isLastActiveSuperadmin } from "@/lib/user-management";
import type { ManagedRole } from "@/lib/user-management";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id: targetId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }

  const action =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).action
      : null;

  if (action !== "block" && action !== "unblock") {
    return fail("Choose block or unblock.", 400);
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

  if (access.context.roleCode === "admin" && targetRoleCode !== "user") {
    return fail("User not found.", 404);
  }

  if (action === "block" && targetRoleCode === "superadmin") {
    if (await isLastActiveSuperadmin(admin, targetId)) {
      return fail("The last active Superadmin cannot be blocked.", 409);
    }
  }

  const isBlocked = action === "block";
  const { error: updateError } = await supabase
    .from("app_user")
    .update({ is_blocked: isBlocked })
    .eq("id", targetId);

  if (updateError) {
    console.error("User block state update failed:", updateError.message);
    return fail("Could not update that user's access.", 500);
  }

  return NextResponse.json(
    {
      user: {
        id: targetId,
        email: target.email,
        firstName: target.first_name,
        lastName: target.last_name,
        role: targetRoleCode,
        accountStatus: target.account_status,
        isBlocked,
      },
    },
    { headers: noStore },
  );
}
