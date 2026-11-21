import { NextResponse } from "next/server";
import { checkAppUserAccess } from "@/lib/auth-access";
import { validateSetPassword } from "@/lib/auth-validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function errorResponse(
  error: string,
  status: number,
  fieldErrors?: Record<string, string>,
) {
  const body = fieldErrors ? { error, fieldErrors } : { error };
  return NextResponse.json(body, { status, headers: noStore });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const validation = validateSetPassword(payload);
  if (!validation.ok) {
    return errorResponse(validation.error, 400, validation.fieldErrors);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    supabase = await createClient();
    admin = createAdminClient();
  } catch (configError) {
    console.error("Password setup configuration error:", configError);
    return errorResponse("Authentication is not configured on the server.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return errorResponse("Sign in before setting a password.", 401);
  }

  const access = await checkAppUserAccess(admin, { userId: user.id });
  if (!access.ok) {
    await supabase.auth.signOut();
    return errorResponse(access.error, access.status);
  }

  // Supabase Auth hashes the new password. Clearing the one-time setup flag
  // prevents a second first-login prompt. Metadata is merged, not replaced.
  const { error: updateError } = await supabase.auth.updateUser({
    password: validation.value.password,
    data: {
      password_setup_required: false,
      password_set_at: new Date().toISOString(),
    },
  });

  if (updateError) {
    const message = updateError.message.toLowerCase();
    if (message.includes("password")) {
      return errorResponse("Password does not meet the required rules.", 400, {
        password: "Password does not meet the required rules.",
      });
    }
    console.error("Supabase password update failed:", updateError.message);
    return errorResponse("We could not set your password. Please try again.", 500);
  }

  return NextResponse.json(
    {
      message: "Password set successfully.",
      account_status: "active",
      requiresPasswordSetup: false,
    },
    { status: 200, headers: noStore },
  );
}
