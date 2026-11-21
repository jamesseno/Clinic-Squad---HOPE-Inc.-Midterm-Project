import { NextResponse } from "next/server";
import { checkAppUserAccess, requiresPasswordSetup } from "@/lib/auth-access";
import { validateLogin } from "@/lib/auth-validation";
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

function authErrorResponse(message: string): NextResponse {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password") ||
    normalized.includes("wrong password")
  ) {
    return errorResponse("The email or password is incorrect.", 401);
  }
  if (normalized.includes("email not confirmed")) {
    return errorResponse("Confirm your email address before signing in.", 403);
  }
  if (normalized.includes("rate") && normalized.includes("limit")) {
    return errorResponse("Too many attempts. Please try again later.", 429);
  }

  console.error("Supabase sign-in failed:", message);
  return errorResponse("Sign-in failed. Please try again.", 500);
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const validation = validateLogin(payload);
  if (!validation.ok) {
    return errorResponse(validation.error, 400, validation.fieldErrors);
  }

  const { email, password } = validation.value;

  let admin: ReturnType<typeof createAdminClient>;
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    admin = createAdminClient();
    supabase = await createClient();
  } catch (configError) {
    console.error("Login configuration error:", configError);
    return errorResponse("Authentication is not configured on the server.", 500);
  }

  // Deny blocked and pending accounts before Supabase Auth creates a session.
  const access = await checkAppUserAccess(admin, { email });
  if (!access.ok) {
    return errorResponse(access.error, access.status);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return authErrorResponse(error.message);
  }
  if (!data.user) {
    console.error("Supabase sign-in returned no user and no error.");
    return errorResponse("Sign-in failed. Please try again.", 500);
  }

  // Re-check after authentication so a profile change during sign-in cannot
  // leave a session for a blocked or pending account.
  const postLoginAccess = await checkAppUserAccess(admin, { userId: data.user.id });
  if (!postLoginAccess.ok) {
    await supabase.auth.signOut();
    return errorResponse(postLoginAccess.error, postLoginAccess.status);
  }

  return NextResponse.json(
    {
      message: "Signed in.",
      user: { id: data.user.id, email: data.user.email ?? email },
      account_status: "active",
      requiresPasswordSetup: requiresPasswordSetup(data.user.user_metadata),
    },
    { status: 200, headers: noStore },
  );
}
