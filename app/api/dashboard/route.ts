import { NextResponse } from "next/server";
import { checkAppUserAccess } from "@/lib/auth-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let admin: ReturnType<typeof createAdminClient>;

  try {
    supabase = await createClient();
    admin = createAdminClient();
  } catch (configError) {
    console.error("Dashboard configuration error:", configError);
    return NextResponse.json(
      { error: "The workspace is not configured on the server." },
      { status: 500, headers: noStore },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401, headers: noStore },
    );
  }

  const access = await checkAppUserAccess(admin, { userId: user.id });
  if (!access.ok) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: noStore },
    );
  }

  const profile = await admin
    .from("app_user")
    .select("first_name, last_name, role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile.error || !profile.data) {
    console.error("Dashboard profile lookup failed:", profile.error?.message ?? "No profile row.");
    return NextResponse.json(
      { error: "Could not load your workspace." },
      { status: 500, headers: noStore },
    );
  }

  const roleResult = await admin
    .from("app_role")
    .select("role_code")
    .eq("role_id", profile.data.role_id)
    .maybeSingle();

  if (roleResult.error || !roleResult.data) {
    console.error("Dashboard role lookup failed:", roleResult.error?.message ?? "No role row.");
    return NextResponse.json(
      { error: "Could not verify your workspace role." },
      { status: 500, headers: noStore },
    );
  }

  const roleCode = roleResult.data.role_code as "superadmin" | "admin" | "user";

  const allModulesResult = await admin
    .from("module")
    .select("module_id, module_code, module_name, description, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (allModulesResult.error) {
    console.error("Dashboard module lookup failed:", allModulesResult.error.message);
    return NextResponse.json(
      { error: "Could not load workspace modules." },
      { status: 500, headers: noStore },
    );
  }

  let visibleModules = allModulesResult.data ?? [];

  if (roleCode !== "superadmin") {
    const [roleRightsResult, userRightsResult] = await Promise.all([
      admin
        .from("role_permission")
        .select("right_id")
        .eq("role_id", profile.data.role_id),
      admin
        .from("user_permission")
        .select("right_id")
        .eq("user_id", user.id)
        .eq("is_deleted", false),
    ]);

    if (roleRightsResult.error || userRightsResult.error) {
      console.error(
        "Dashboard permission lookup failed:",
        roleRightsResult.error?.message ?? userRightsResult.error?.message,
      );
      return NextResponse.json(
        { error: "Could not verify your module permissions." },
        { status: 500, headers: noStore },
      );
    }

    const rightIds = [
      ...new Set([
        ...(roleRightsResult.data ?? []).map((row) => row.right_id),
        ...(userRightsResult.data ?? []).map((row) => row.right_id),
      ]),
    ];

    if (rightIds.length === 0) {
      visibleModules = [];
    } else {
      const rightsResult = await admin
        .from("rights_catalog")
        .select("module_id")
        .in("right_id", rightIds)
        .eq("is_active", true);

      if (rightsResult.error) {
        console.error("Dashboard rights catalogue lookup failed:", rightsResult.error.message);
        return NextResponse.json(
          { error: "Could not verify your module permissions." },
          { status: 500, headers: noStore },
        );
      }

      const moduleIds = new Set((rightsResult.data ?? []).map((row) => row.module_id));
      visibleModules = visibleModules.filter((module) => moduleIds.has(module.module_id));
    }
  }

  let pendingApprovals: number | null = null;
  if (roleCode === "superadmin" || roleCode === "admin") {
    const pendingResult = await admin
      .from("app_user")
      .select("id", { count: "exact", head: true })
      .eq("account_status", "pending")
      .eq("is_blocked", false);

    if (!pendingResult.error) pendingApprovals = pendingResult.count;
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email ?? access.profile.email,
        firstName: profile.data.first_name,
        lastName: profile.data.last_name,
      },
      role: roleCode,
      modules: visibleModules.map((module) => ({
        id: module.module_id,
        code: module.module_code,
        name: module.module_name,
        description: module.description,
      })),
      pendingApprovals,
    },
    { status: 200, headers: noStore },
  );
}
