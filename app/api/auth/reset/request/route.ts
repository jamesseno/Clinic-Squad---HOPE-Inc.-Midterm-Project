import { NextResponse } from "next/server";
import { checkAppUserAccess } from "@/lib/auth-access";
import { validateResetRequest } from "@/lib/auth-validation";
import { getAppOrigin } from "@/lib/app-origin";
import { hashResetToken, issuePasswordResetToken } from "@/lib/password-reset";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

const genericMessage =
  "If an account matches that email, reset instructions are on the way.";

function genericResponse() {
  return NextResponse.json({ message: genericMessage }, { status: 200, headers: noStore });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: noStore },
    );
  }

  const validation = validateResetRequest(payload);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error, fieldErrors: validation.fieldErrors },
      { status: 400, headers: noStore },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  let origin: string;
  try {
    admin = createAdminClient();
    origin = getAppOrigin();
  } catch (configError) {
    console.error("Password reset configuration error:", configError);
    return NextResponse.json(
      { error: "Password reset is not configured on the server." },
      { status: 500, headers: noStore },
    );
  }

  const { email } = validation.value;
  const access = await checkAppUserAccess(admin, { email });

  // Always return the same response whether or not the account exists. Pending
  // and blocked accounts deliberately receive no reset token.
  if (access.ok) {
    try {
      const { token } = await issuePasswordResetToken(admin, access.profile.id);
      const redirectTo = new URL("/set-password", origin);
      redirectTo.searchParams.set("reset_token", token);

      const { error: emailError } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo.toString(),
      });

      if (emailError) {
        console.error("Reset email could not be sent:", emailError.message);
        await admin
          .from("password_reset_token")
          .update({ used: true })
          .eq("token_hash", hashResetToken(token));
      }
    } catch (issueError) {
      console.error("Password reset token could not be issued:", issueError);
    }
  }

  return genericResponse();
}
