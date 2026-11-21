import { NextResponse } from "next/server";
import { validateRegistration, type RegistrationFieldErrors } from "@/lib/registration";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

interface RegisterSuccessBody {
  message: string;
  account_status: "pending";
  requiresEmailConfirmation: boolean;
  user: { id: string; email: string };
}

function errorResponse(
  error: string,
  status: number,
  fieldErrors?: RegistrationFieldErrors,
) {
  const body = fieldErrors ? { error, fieldErrors } : { error };
  return NextResponse.json(body, { status, headers: noStore });
}

function isDuplicateEmailError(message: string, code: string): boolean {
  return (
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    (message.includes("email") && message.includes("exists"))
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const validation = validateRegistration(payload);
  if (!validation.ok) {
    return errorResponse(validation.error, 400, validation.fieldErrors);
  }

  const { firstName, lastName, email, phone, password } = validation.value;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (configError) {
    console.error("Registration configuration error:", configError);
    return errorResponse("Registration is not configured on the server.", 500);
  }

  // The role is always resolved here. Clients cannot request admin roles.
  const { data: role, error: roleError } = await admin
    .from("app_role")
    .select("role_id")
    .eq("role_code", "user")
    .maybeSingle();

  if (roleError || !role) {
    console.error("Standard user role is unavailable:", roleError?.message);
    return errorResponse("Registration is not configured on the server.", 500);
  }

  const { data: existingProfile, error: lookupError } = await admin
    .from("app_user")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (lookupError) {
    console.error("Duplicate-email pre-check failed:", lookupError.message);
  } else if (existingProfile) {
    return errorResponse("An account with this email already exists.", 409);
  }

  // Supabase Auth creates the user and hashes the password. Using the admin
  // API keeps the flow server-controlled and avoids anonymous signup throttles.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      ...(phone ? { phone } : {}),
    },
  });

  if (authError) {
    const message = (authError.message ?? "").toLowerCase();
    const code = (authError as { code?: string }).code ?? "";

    if (isDuplicateEmailError(message, code)) {
      return errorResponse("An account with this email already exists.", 409);
    }
    if (message.includes("password")) {
      return errorResponse("Password does not meet the required rules.", 400, {
        password: "Password does not meet the required rules.",
      });
    }

    console.error("Supabase Auth user creation failed:", authError.message);
    return errorResponse("Registration failed. Please try again.", 500);
  }

  if (!authData.user) {
    console.error("Supabase Auth returned no user and no error.");
    return errorResponse("Registration failed. Please try again.", 500);
  }

  // `account_status` is hardcoded here. It is never read from the request,
  // and the database CHECK constraint/RLS policy reject other values.
  const { error: profileError } = await admin.from("app_user").insert({
    id: authData.user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    role_id: role.role_id,
    account_status: "pending",
    is_blocked: false,
  });

  if (profileError) {
    console.error("Profile insert failed:", profileError.message);
    const { error: cleanupError } = await admin.auth.admin.deleteUser(authData.user.id);
    if (cleanupError) {
      console.error("Cleanup after failed profile insert failed:", cleanupError.message);
    }
    return errorResponse("Registration failed. Please try again.", 500);
  }

  const body: RegisterSuccessBody = {
    message: "Account created. It is pending admin approval.",
    account_status: "pending",
    requiresEmailConfirmation: false,
    user: { id: authData.user.id, email: authData.user.email ?? email },
  };

  return NextResponse.json(body, { status: 201, headers: noStore });
}
