import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getManagerContext,
  resolveRoleId,
  type ManagedRole,
} from "@/lib/user-management";
import { validateAddUser } from "@/lib/user-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number, fieldErrors?: Record<string, string>) {
  return NextResponse.json(fieldErrors ? { error, fieldErrors } : { error }, {
    status,
    headers: noStore,
  });
}

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    supabase = await createClient();
    admin = createAdminClient();
  } catch (configError) {
    console.error("User management configuration error:", configError);
    return fail("User management is not configured on the server.", 500);
  }

  const access = await getManagerContext(supabase, admin);
  if (!access.ok) return fail(access.error, access.status);

  // RLS returns only profiles the acting manager can manage. Keep the scope
  // explicit as defense in depth: Admin sees standard Users only; Superadmin
  // sees every account.
  let usersQuery = supabase
    .from("app_user")
    .select("id, email, first_name, last_name, role_id, account_status, is_blocked, created_at, updated_at")
    .order("created_at", { ascending: true });

  const { data: roles, error: rolesError } = await admin
    .from("app_role")
    .select("role_id, role_code");
  if (rolesError || !roles) {
    console.error("Role lookup failed:", rolesError?.message ?? "No roles returned.");
    return fail("Could not load roles.", 500);
  }
  const roleById = new Map<number, string>();
  const roleIdByCode = new Map<string, number>();
  for (const role of roles) {
    if (role.role_id === null || role.role_code === null) continue;
    roleById.set(role.role_id, role.role_code);
    roleIdByCode.set(role.role_code, role.role_id);
  }

  const standardRoleId = roleIdByCode.get("user");
  if (access.context.roleCode === "admin") {
    if (standardRoleId === undefined) return fail("Could not load roles.", 500);
    usersQuery = usersQuery.eq("role_id", standardRoleId);
  }

  const { data: users, error: usersError } = await usersQuery;
  if (usersError) {
    console.error("User list lookup failed:", usersError.message);
    return fail("Could not load users.", 500);
  }

  return NextResponse.json(
    {
      role: access.context.roleCode,
      users: (users ?? []).map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: roleById.get(user.role_id ?? 0) ?? "user",
        accountStatus: user.account_status,
        isBlocked: user.is_blocked,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })),
    },
    { status: 200, headers: noStore },
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    supabase = await createClient();
    admin = createAdminClient();
  } catch (configError) {
    console.error("User management configuration error:", configError);
    return fail("User management is not configured on the server.", 500);
  }

  const access = await getManagerContext(supabase, admin);
  if (!access.ok) return fail(access.error, access.status);

  // Admins can only create standard users. Superadmins may create any role.
  const allowedRoles: ManagedRole[] =
    access.context.roleCode === "superadmin" ? ["user", "admin", "superadmin"] : ["user"];
  const validation = validateAddUser(payload, allowedRoles);
  if (!validation.ok) return fail(validation.error, 400, validation.fieldErrors);

  const { firstName, lastName, email, role } = validation.value;
  const roleId = await resolveRoleId(admin, role);
  if (roleId === null) return fail("Could not resolve the requested role.", 500);

  const { data: existing, error: existingError } = await admin
    .from("app_user")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existingError) {
    console.error("Duplicate user lookup failed:", existingError.message);
    return fail("Could not verify whether that email is already in use.", 500);
  }
  if (existing) {
    return fail("A user with that email already exists.", 409, { email: "Email already in use." });
  }

  const temporaryPassword = `Aa1!${randomBytes(18).toString("base64url")}`;
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      password_setup_required: true,
    },
  });

  if (authError || !authData.user) {
    const message = authError?.message ?? "No Auth user was returned.";
    if (/already (exists|registered)|duplicate/i.test(message)) {
      return fail("A user with that email already exists.", 409, { email: "Email already in use." });
    }
    console.error("Auth user creation failed:", message);
    return fail("Could not create the Auth account.", 500);
  }

  const { error: profileError } = await admin.from("app_user").insert({
    id: authData.user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    role_id: roleId,
    account_status: "active",
    is_blocked: false,
  });

  if (profileError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(authData.user.id);
    if (cleanupError) console.error("Auth cleanup after failed profile insert:", cleanupError.message);
    console.error("Profile insert failed:", profileError.message);
    return fail("Could not create the user profile.", 500);
  }

  return NextResponse.json(
    {
      user: {
        id: authData.user.id,
        email,
        firstName,
        lastName,
        role,
        accountStatus: "active",
        isBlocked: false,
      },
      temporaryPassword,
    },
    { status: 201, headers: noStore },
  );
}
