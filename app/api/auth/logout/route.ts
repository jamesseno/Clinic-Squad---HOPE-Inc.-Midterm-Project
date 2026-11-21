import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

export async function POST() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (configError) {
    console.error("Logout configuration error:", configError);
    return NextResponse.json(
      { error: "Authentication is not configured on the server." },
      { status: 500, headers: noStore },
    );
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Supabase sign-out failed:", error.message);
    return NextResponse.json(
      { error: "Sign-out failed. Please try again." },
      { status: 500, headers: noStore },
    );
  }

  return new NextResponse(null, { status: 204, headers: noStore });
}
