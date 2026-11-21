import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = process.env.APP_ORIGIN ?? "http://localhost:3001";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const suffix = Date.now();
const createdUserIds = [];

function assert(condition, message) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`✓ ${message}`);
}

function createCookieJar() {
  const cookies = new Map();

  return {
    header() {
      return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    absorb(response) {
      const rawCookies =
        typeof response.headers.getSetCookie === "function"
          ? response.headers.getSetCookie()
          : response.headers.get("set-cookie")
            ? [response.headers.get("set-cookie")]
            : [];

      for (const item of rawCookies) {
        const pair = item.split(";")[0];
        const separator = pair.indexOf("=");
        if (separator < 0) continue;

        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        const expired =
          !value ||
          /max-age=0/i.test(item) ||
          /expires=thu, 01 jan 1970/i.test(item);

        if (expired) cookies.delete(name);
        else cookies.set(name, value);
      }
    },
  };
}

async function api(path, { method = "GET", body, jar, redirect = "manual" } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (jar) {
    const cookieHeader = jar.header();
    if (cookieHeader) headers.Cookie = cookieHeader;
  }

  const response = await fetch(new URL(path, origin), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect,
  });

  if (jar) jar.absorb(response);

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON responses are returned as text for debugging.
    }
  }

  return { status: response.status, json, text, headers: response.headers };
}

async function makeUser({
  label,
  password,
  passwordSetupRequired,
  accountStatus = "active",
  isBlocked = false,
}) {
  const email = `auth-${label}-${suffix}@gmail.com`;

  const { data: role, error: roleError } = await admin
    .from("app_role")
    .select("role_id")
    .eq("role_code", "user")
    .single();
  if (roleError || !role) {
    throw new Error(`Could not resolve the standard user role: ${roleError?.message}`);
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: "Auth",
      last_name: "Verify",
      password_setup_required: passwordSetupRequired,
    },
  });
  if (authError || !authData.user) {
    throw new Error(`Could not create ${email}: ${authError?.message ?? "no user returned"}`);
  }

  createdUserIds.push(authData.user.id);

  const { error: profileError } = await admin.from("app_user").insert({
    id: authData.user.id,
    email,
    first_name: "Auth",
    last_name: "Verify",
    role_id: role.role_id,
    account_status: accountStatus,
    is_blocked: isBlocked,
  });
  if (profileError) {
    throw new Error(`Could not create the profile for ${email}: ${profileError.message}`);
  }

  return { id: authData.user.id, email };
}

async function cleanup() {
  for (const id of [...createdUserIds].reverse()) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (!error) break;
      if (attempt === 3) console.warn(`Cleanup warning for ${id}: ${error.message}`);
      else await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}

try {
  const invalidPayload = await api("/api/auth/login", {
    method: "POST",
    body: {
      email: "someone@gmail.com",
      password: "Pass1234",
      account_status: "active",
    },
    jar: createCookieJar(),
  });
  assert(invalidPayload.status === 400, "server-controlled login fields are rejected (HTTP 400)");

  const active = await makeUser({
    label: "active",
    password: "ActivePass123!",
    passwordSetupRequired: false,
  });
  const activeJar = createCookieJar();

  const wrongPassword = await api("/api/auth/login", {
    method: "POST",
    body: { email: active.email, password: "WrongPass123!" },
    jar: activeJar,
  });
  assert(wrongPassword.status === 401, "incorrect password is rejected (HTTP 401)");

  const activeLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: active.email, password: "ActivePass123!" },
    jar: activeJar,
  });
  assert(activeLogin.status === 200, "active user signs in (HTTP 200)");
  assert(activeLogin.json?.account_status === "active", "login reports account_status=active");
  assert(activeLogin.json?.requiresPasswordSetup === false, "registered user does not need first-password setup");

  const activeSession = await api("/api/auth/session", { jar: activeJar });
  assert(activeSession.status === 200, "session cookie authenticates a protected request");
  assert(activeSession.json?.user?.id === active.id, "session resolves the signed-in user");

  const logout = await api("/api/auth/logout", { method: "POST", jar: activeJar });
  assert(logout.status === 204, "logout destroys the session (HTTP 204)");

  const signedOut = await api("/api/auth/session", { jar: activeJar });
  assert(signedOut.status === 401, "session is denied after logout (HTTP 401)");

  const blocked = await makeUser({
    label: "blocked",
    password: "BlockedPass123!",
    passwordSetupRequired: false,
  });
  const blockedJar = createCookieJar();

  const blockedLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: blocked.email, password: "BlockedPass123!" },
    jar: blockedJar,
  });
  assert(blockedLogin.status === 200, "user signs in before being blocked (HTTP 200)");

  const blockedSessionBefore = await api("/api/auth/session", { jar: blockedJar });
  assert(blockedSessionBefore.status === 200, "session works while the account is unblocked");

  const { error: blockError } = await admin
    .from("app_user")
    .update({ is_blocked: true })
    .eq("id", blocked.id);
  if (blockError) throw new Error(`Could not block the test user: ${blockError.message}`);

  const blockedSessionAfter = await api("/api/auth/session", { jar: blockedJar });
  assert(
    blockedSessionAfter.status === 307 &&
      blockedSessionAfter.headers.get("location")?.includes("auth=session_invalid"),
    "blocking a user invalidates the active session (redirect to login)",
  );

  const blockedLoginAfter = await api("/api/auth/login", {
    method: "POST",
    body: { email: blocked.email, password: "BlockedPass123!" },
    jar: createCookieJar(),
  });
  assert(blockedLoginAfter.status === 403, "blocked user cannot sign in (HTTP 403)");

  const pending = await makeUser({
    label: "pending",
    password: "PendingPass123!",
    passwordSetupRequired: false,
    accountStatus: "pending",
  });
  const pendingLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: pending.email, password: "PendingPass123!" },
    jar: createCookieJar(),
  });
  assert(pendingLogin.status === 403, "pending user cannot sign in (HTTP 403)");

  const firstLogin = await makeUser({
    label: "firstlogin",
    password: "TempPass123!",
    passwordSetupRequired: true,
  });
  const firstJar = createCookieJar();

  const firstLoginResult = await api("/api/auth/login", {
    method: "POST",
    body: { email: firstLogin.email, password: "TempPass123!" },
    jar: firstJar,
  });
  assert(firstLoginResult.status === 200, "first-login user signs in (HTTP 200)");
  assert(firstLoginResult.json?.requiresPasswordSetup === true, "login reports first-password setup required");

  const weakPassword = await api("/api/auth/set-password", {
    method: "POST",
    body: { password: "short", confirmPassword: "short" },
    jar: firstJar,
  });
  assert(weakPassword.status === 400, "weak first password is rejected (HTTP 400)");

  const setup = await api("/api/auth/set-password", {
    method: "POST",
    body: {
      password: "NewStrongPass123!",
      confirmPassword: "NewStrongPass123!",
    },
    jar: firstJar,
  });
  assert(setup.status === 200, "first-password setup succeeds (HTTP 200)");
  assert(setup.json?.requiresPasswordSetup === false, "setup clears the first-login flag");

  const afterSetupSession = await api("/api/auth/session", { jar: firstJar });
  assert(afterSetupSession.status === 200, "session remains valid after password setup");
  assert(afterSetupSession.json?.requiresPasswordSetup === false, "session reports setup complete");

  await api("/api/auth/logout", { method: "POST", jar: firstJar });

  const oldPasswordLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: firstLogin.email, password: "TempPass123!" },
    jar: createCookieJar(),
  });
  assert(oldPasswordLogin.status === 401, "temporary password no longer works (HTTP 401)");

  const newPasswordLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: firstLogin.email, password: "NewStrongPass123!" },
    jar: createCookieJar(),
  });
  assert(newPasswordLogin.status === 200, "new password works after setup (HTTP 200)");
  assert(newPasswordLogin.json?.requiresPasswordSetup === false, "new login does not require setup again");

  console.log("\nAll S1-DEV-03 authentication checks passed.");
} finally {
  await cleanup();
  console.log("Cleaned up verification users.");
}
