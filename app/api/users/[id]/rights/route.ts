import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getManagerContext } from "@/lib/user-management";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface TargetUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

type TargetResult =
  | { ok: true; target: TargetUser }
  | { ok: false; status: number; error: string };

/**
 * Shared target gate for reading and writing rights. Rights belong to
 * standard User accounts only; Admin and Superadmin accounts keep the access
 * granted by their role, and pending or blocked accounts cannot be edited.
 */
async function loadTarget(
  admin: ReturnType<typeof createAdminClient>,
  managerRole: "admin" | "superadmin",
  targetId: string,
): Promise<TargetResult> {
  const { data: target, error } = await admin
    .from("app_user")
    .select("id, email, first_name, last_name, role_id, account_status, is_blocked")
    .eq("id", targetId)
    .maybeSingle();

  if (error) {
    console.error("Rights target lookup failed:", error.message);
    return { ok: false, status: 500, error: "Could not look up that user." };
  }
  if (!target) return { ok: false, status: 404, error: "User not found." };

  const { data: role, error: roleError } = await admin
    .from("app_role")
    .select("role_code")
    .eq("role_id", target.role_id)
    .maybeSingle();

  if (roleError || !role) {
    console.error("Rights target role lookup failed:", roleError?.message ?? "No role row.");
    return { ok: false, status: 500, error: "Could not verify that user's role." };
  }

  // An Admin may only see standard Users, so hide anything else as not found.
  if (managerRole === "admin" && role.role_code !== "user") {
    return { ok: false, status: 404, error: "User not found." };
  }

  if (role.role_code !== "user") {
    return {
      ok: false,
      status: 409,
      error: "Rights can only be managed for standard User accounts.",
    };
  }

  if (target.account_status !== "active" || target.is_blocked) {
    return {
      ok: false,
      status: 409,
      error: "Rights can only be managed for active, unblocked accounts.",
    };
  }

  return {
    ok: true,
    target: {
      id: target.id,
      email: target.email,
      firstName: target.first_name,
      lastName: target.last_name,
    },
  };
}

function parseRightIds(payload: unknown): { ok: true; value: number[] } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = (payload as { rightIds?: unknown }).rightIds;
  if (!Array.isArray(raw)) {
    return { ok: false, error: "rightIds must be an array of right ids." };
  }
  if (raw.length > 500) {
    return { ok: false, error: "Too many rights were supplied." };
  }

  const ids = new Set<number>();
  for (const value of raw) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      return { ok: false, error: "Every right id must be a positive integer." };
    }
    ids.add(value);
  }

  return { ok: true, value: [...ids] };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: targetId } = await context.params;

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    supabase = await createClient();
    admin = createAdminClient();
  } catch (configError) {
    console.error("Rights configuration error:", configError);
    return fail("Rights management is not configured on the server.", 500);
  }

  const access = await getManagerContext(supabase, admin);
  if (!access.ok) return fail(access.error, access.status);

  const target = await loadTarget(admin, access.context.roleCode, targetId);
  if (!target.ok) return fail(target.error, target.status);

  const [modulesResult, rightsResult, grantsResult] = await Promise.all([
    admin
      .from("module")
      .select("module_id, module_code, module_name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    admin
      .from("rights_catalog")
      .select("right_id, module_id, right_code, right_name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    admin
      .from("user_permission")
      .select("right_id")
      .eq("user_id", targetId)
      .eq("is_deleted", false),
  ]);

  if (modulesResult.error || rightsResult.error || grantsResult.error) {
    console.error(
      "Rights catalogue lookup failed:",
      modulesResult.error?.message ??
        rightsResult.error?.message ??
        grantsResult.error?.message,
    );
    return fail("Could not load the rights catalogue.", 500);
  }

  const rightsByModule = new Map<number, Array<{ id: number; code: string; name: string }>>();
  for (const right of rightsResult.data ?? []) {
    const list = rightsByModule.get(right.module_id) ?? [];
    list.push({ id: right.right_id, code: right.right_code, name: right.right_name });
    rightsByModule.set(right.module_id, list);
  }

  return NextResponse.json(
    {
      user: target.target,
      modules: (modulesResult.data ?? []).map((module) => ({
        id: module.module_id,
        code: module.module_code,
        name: module.module_name,
        rights: rightsByModule.get(module.module_id) ?? [],
      })),
      grantedRightIds: (grantsResult.data ?? []).map((row) => row.right_id),
    },
    { status: 200, headers: noStore },
  );
}

export async function PUT(request: Request, context: RouteContext) {
  const { id: targetId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }

  const parsed = parseRightIds(payload);
  if (!parsed.ok) return fail(parsed.error, 400);

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    supabase = await createClient();
    admin = createAdminClient();
  } catch (configError) {
    console.error("Rights configuration error:", configError);
    return fail("Rights management is not configured on the server.", 500);
  }

  const access = await getManagerContext(supabase, admin);
  if (!access.ok) return fail(access.error, access.status);

  const target = await loadTarget(admin, access.context.roleCode, targetId);
  if (!target.ok) return fail(target.error, target.status);

  // The RPC runs as the signed-in manager, so RLS, the manager gate, and the
  // audit trigger all see the real actor. It applies the whole selection in a
  // single transaction and reports how many grants/revokes it wrote.
  const { data, error } = await supabase.rpc("set_user_rights", {
    p_user_id: targetId,
    p_right_ids: parsed.value,
  });

  if (error) {
    console.error("Rights update failed:", error.message);
    if (error.code === "42501") return fail(error.message, 403);
    if (error.code === "P0002") return fail("User not found.", 404);
    if (error.code === "22023") return fail(error.message, 400);
    return fail("Could not save the selected rights.", 500);
  }

  return NextResponse.json(
    {
      user: target.target,
      granted: Number((data as { granted?: number } | null)?.granted ?? 0),
      revoked: Number((data as { revoked?: number } | null)?.revoked ?? 0),
      total: Number((data as { total?: number } | null)?.total ?? 0),
    },
    { status: 200, headers: noStore },
  );
}
