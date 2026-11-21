import { NextResponse } from "next/server";
import { findPasswordResetToken } from "@/lib/password-reset";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return NextResponse.json(
      { valid: false, error: "This reset link is invalid." },
      { status: 400, headers: noStore },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (configError) {
    console.error("Password reset configuration error:", configError);
    return NextResponse.json(
      { error: "Password reset is not configured on the server." },
      { status: 500, headers: noStore },
    );
  }

  const result = await findPasswordResetToken(admin, token);
  if (!result.ok) {
    return NextResponse.json(
      { valid: false, error: result.error },
      { status: result.status, headers: noStore },
    );
  }

  return NextResponse.json(
    {
      valid: true,
      expiresAt: result.row.expires_at,
    },
    { status: 200, headers: noStore },
  );
}
