import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/supabase/config";

export async function proxy(request: NextRequest) {
  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const changedCookies: Array<{
    name: string;
    value: string;
    options?: CookieOptions;
  }> = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          changedCookies.push({ name, value, options });
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const userId = error ? null : (data?.claims?.sub ?? null);

  if (userId) {
    // A valid Auth token is not enough: the app_user row must still be active
    // and unblocked. This invalidates sessions after an admin blocks a user.
    const { data: profile, error: profileError } = await supabase
      .from("app_user")
      .select("account_status, is_blocked")
      .eq("id", userId)
      .maybeSingle();

    const accessDenied =
      profileError !== null ||
      !profile ||
      profile.account_status !== "active" ||
      profile.is_blocked;

    if (accessDenied) {
      await supabase.auth.signOut();
      const redirect = NextResponse.redirect(
        new URL("/?auth=session_invalid", request.url),
      );
      changedCookies.forEach(({ name, value, options }) => {
        redirect.cookies.set(name, value, options);
      });
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
