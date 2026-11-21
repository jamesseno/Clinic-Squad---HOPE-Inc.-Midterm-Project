import { NextResponse } from "next/server";
import { checkAppUserAccess, requiresPasswordSetup } from "@/lib/auth-access";
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
    console.error("Session configuration error:", configError);
    return NextResponse.json(
      { error: "Authentication is not configured on the server." },
      { status: 500, headers: noStore },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "No active session." },
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

  return NextResponse.json(
    {
      user: { id: user.id, email: user.email ?? access.profile.email },
      account_status: access.profile.account_status,
      role_id: access.profile.role_id,
      requiresPasswordSetup: requiresPasswordSetup(user.user_metadata),
    },
    { status: 200, headers: noStore },
  );
}
