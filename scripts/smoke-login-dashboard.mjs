import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = process.env.APP_ORIGIN ?? "http://localhost:3001";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const suffix = Date.now();
const email = `smoke-${suffix}@gmail.com`;
const password = "SmokePass123!";
const cookies = new Map();

function absorb(response) {
  const raw = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : response.headers.get("set-cookie")
      ? [response.headers.get("set-cookie")]
      : [];

  for (const item of raw) {
    const pair = item.split(";")[0];
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!value || /max-age=0/i.test(item) || /expires=thu, 01 jan 1970/i.test(item)) cookies.delete(name);
    else cookies.set(name, value);
  }
}

async function api(path, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const cookie = [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(new URL(path, origin), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
  absorb(response);
  const text = await response.text();
  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch { /* Non-JSON response retained for diagnosis. */ }
  }
  return { status: response.status, json };
}

async function cleanup(userId) {
  if (userId) await admin.auth.admin.deleteUser(userId);
}

let userId = null;
try {
  const { data: role, error: roleError } = await admin
    .from("app_role")
    .select("role_id")
    .eq("role_code", "user")
    .single();
  if (roleError || !role) throw new Error(`Could not resolve test role: ${roleError?.message}`);

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Smoke", last_name: "Test", password_setup_required: false },
  });
  if (authError || !authUser.user) throw new Error(`Could not create smoke user: ${authError?.message}`);
  userId = authUser.user.id;

  const { error: profileError } = await admin.from("app_user").insert({
    id: userId,
    email,
    first_name: "Smoke",
    last_name: "Test",
    role_id: role.role_id,
    account_status: "active",
    is_blocked: false,
  });
  if (profileError) throw new Error(`Could not create smoke profile: ${profileError.message}`);

  const dashboardBeforeLogin = await api("/api/dashboard");
  if (dashboardBeforeLogin.status !== 401) throw new Error("Dashboard was accessible while signed out.");
  console.log("PASS: signed-out dashboard access is denied");

  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (login.status !== 200) throw new Error(`Login failed with HTTP ${login.status}`);
  console.log("PASS: login establishes a session");

  const dashboard = await api("/api/dashboard");
  if (dashboard.status !== 200) throw new Error(`Dashboard failed with HTTP ${dashboard.status}`);
  if (!Array.isArray(dashboard.json?.modules)) throw new Error("Dashboard response omitted modules.");
  console.log("PASS: dashboard loads role-aware modules");

  const logout = await api("/api/auth/logout", { method: "POST" });
  if (logout.status !== 204) throw new Error(`Logout failed with HTTP ${logout.status}`);
  const afterLogout = await api("/api/dashboard");
  if (afterLogout.status !== 401) throw new Error("Dashboard remained accessible after logout.");
  console.log("PASS: logout invalidates dashboard access");
  console.log("\nS1-TST-05 smoke test passed.");
} finally {
  await cleanup(userId);
}
