import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY before running this script.",
  );
}

const email = `verify-${Date.now()}@gmail.com`;
const password = "RegistrationTest123!";
const payload = {
  name: "Registration Verifier",
  email,
  phone: "+1 555 0100",
  password,
  confirmPassword: password,
  terms: true,
};

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

let createdUserId = null;

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function post(body) {
  const response = await fetch(`${origin}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, json };
}

async function run() {
  const override = await post({ ...payload, account_status: "active", role: "superadmin" });
  check(override.status === 400, "server-controlled fields are rejected (HTTP 400)");

  const registration = await post(payload);
  check(registration.status === 201, `registration succeeded (HTTP ${registration.status})`);
  check(
    registration.json.account_status === "pending",
    "API response reports account_status=pending",
  );

  createdUserId = registration.json.user?.id ?? null;
  check(Boolean(createdUserId), "API returned a user id");

  const duplicate = await post(payload);
  check(duplicate.status === 409, "duplicate email rejected (HTTP 409)");

  const { data: profile, error: profileError } = await admin
    .from("app_user")
    .select("id, email, first_name, last_name, account_status, role_id")
    .eq("id", createdUserId)
    .single();

  check(!profileError && Boolean(profile), "profile row exists in public.app_user");
  check(profile?.account_status === "pending", "profile.account_status === 'pending'");
  check(Boolean(profile?.role_id), "profile was assigned the standard user role");

  // An anonymous caller has no INSERT/UPDATE policy on app_user.
  await anon
    .from("app_user")
    .update({ account_status: "active" })
    .eq("id", createdUserId);

  const { data: afterAttempt } = await admin
    .from("app_user")
    .select("account_status")
    .eq("id", createdUserId)
    .single();

  check(
    afterAttempt?.account_status === "pending",
    "status remains pending after unauthorized update attempt",
  );

  console.log("\nAll S1-DEV-02 registration checks passed.");
}

try {
  await run();
} catch (error) {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (createdUserId) {
    await admin.from("app_user").delete().eq("id", createdUserId);
    const { error: deleteError } = await admin.auth.admin.deleteUser(createdUserId);
    if (deleteError) {
      console.warn(`Cleanup warning: could not delete auth user: ${deleteError.message}`);
    } else {
      console.log("Cleaned up verification user.");
    }
  }
}
