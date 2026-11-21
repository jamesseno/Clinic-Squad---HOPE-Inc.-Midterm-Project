import { NextResponse } from "next/server";
import { checkAppUserAccess } from "@/lib/auth-access";
import { validateResetConfirm } from "@/lib/auth-validation";
import {
  claimPasswordResetToken,
  findPasswordResetToken,
  releasePasswordResetToken,
} from "@/lib/password-reset";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function errorResponse(error: string, status: number, fieldErrors?: Record<string, string>) {
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

  const validation = validateResetConfirm(payload);
  if (!validation.ok) {
    return errorResponse(validation.error, 400, validation.fieldErrors);
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (configError) {
    console.error("Password reset configuration error:", configError);
    return errorResponse("Password reset is not configured on the server.", 500);
  }

  const token = await findPasswordResetToken(admin, validation.value.token);
  if (!token.ok) {
    return errorResponse(token.error, token.status);
  }

  const access = await checkAppUserAccess(admin, { userId: token.row.user_id });
  if (!access.ok) {
    return errorResponse(access.error, access.status);
  }

  const claimed = await claimPasswordResetToken(admin, token.row);
  if (!claimed) {
    return errorResponse("This reset link has already been used or has expired.", 400);
  }

  // Supabase Auth hashes the password. The token is released only if the
  // update fails, so a network/database error can be retried with the link.
  const { error: updateError } = await admin.auth.admin.updateUserById(access.profile.id, {
    password: validation.value.password,
  });

  if (updateError) {
    await releasePasswordResetToken(admin, token.row);
    const message = updateError.message.toLowerCase();
    if (message.includes("password")) {
      return errorResponse("Password does not meet the required rules.", 400, {
        password: "Password does not meet the required rules.",
      });
    }
    console.error("Reset password update failed:", updateError.message);
    return errorResponse("We could not reset your password. Please try again.", 500);
  }

  return NextResponse.json(
    {
      message: "Password reset successfully. Sign in with your new password.",
      requiresPasswordSetup: false,
    },
    { status: 200, headers: noStore },
  );
}
