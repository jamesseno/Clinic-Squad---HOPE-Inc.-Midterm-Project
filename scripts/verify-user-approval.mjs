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
const password = "ApprovalPass1!";
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
        if (!value || /max-age=0/i.test(item) || /expires=thu, 01 jan 1970/i.test(item)) {
          cookies.delete(name);
        } else {
          cookies.set(name, value);
        }
      }
    },
  };
}

async function api(path, { method = "GET", body, jar } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (jar) {
    const cookie = jar.header();
    if (cookie) headers.Cookie = cookie;
  }

  const response = await fetch(new URL(path, origin), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  if (jar) jar.absorb(response);

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON responses are kept as text for debugging.
    }
  }

  return { status: response.status, json, text };
}

async function roleId(roleCode) {
  const { data, error } = await admin
    .from("app_role")
    .select("role_id")
    .eq("role_code", roleCode)
    .single();
  if (error || !data) throw new Error(`Could not resolve ${roleCode} role: ${error?.message}`);
  return data.role_id;
}

async function makeUser(label, roleCode, accountStatus = "active", isBlocked = false) {
  const email = `sda-${label}-${suffix}@gmail.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: label,
      last_name: "Verification",
      password_setup_required: false,
    },
  });
  if (error || !data.user) throw new Error(`Could not create ${email}: ${error?.message}`);

  createdUserIds.push(data.user.id);
  const { error: profileError } = await admin.from("app_user").insert({
    id: data.user.id,
    email,
    first_name: label,
    last_name: "Verification",
    role_id: await roleId(roleCode),
    account_status: accountStatus,
    is_blocked: isBlocked,
  });
  if (profileError) throw new Error(`Could not create profile for ${email}: ${profileError.message}`);

  return { id: data.user.id, email };
}

async function signIn(email, passwordValue = password) {
  const jar = createCookieJar();
  const result = await api("/api/auth/login", {
    method: "POST",
    body: { email, password: passwordValue },
    jar,
  });
  return { jar, result };
}

async function profileFor(userId) {
  const { data, error } = await admin
    .from("app_user")
    .select("account_status, is_blocked, role_id")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error(`Could not read profile ${userId}: ${error?.message}`);
  const { data: role } = await admin
    .from("app_role")
    .select("role_code")
    .eq("role_id", data.role_id)
    .single();
  return { ...data, roleCode: role?.role_code };
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
  assert(
    (await api(`/api/users/${"00000000-0000-0000-0000-000000000000"}/approve`, {
      method: "POST",
      body: {},
      jar: createCookieJar(),
    })).status === 401,
    "unauthenticated approval is denied (HTTP 401)",
  );

  const superadmin = await makeUser("superadmin", "superadmin");
  const manager = await makeUser("admin", "admin");
  const standard = await makeUser("user", "user");
  const pending = await makeUser("pending", "user", "pending");
  const pendingAdmin = await makeUser("pendingadmin", "user", "pending");
  const pendingBlocked = await makeUser("blockedpending", "user", "pending", true);

  const standardSession = await signIn(standard.email);
  assert(standardSession.result.status === 200, "standard user signs in (HTTP 200)");
  const userApprove = await api(`/api/users/${pending.id}/approve`, {
    method: "POST",
    body: {},
    jar: standardSession.jar,
  });
  assert(userApprove.status === 403, "standard user cannot approve (HTTP 403)");

  const managerSession = await signIn(manager.email);
  assert(managerSession.result.status === 200, "admin signs in (HTTP 200)");
  const adminApprove = await api(`/api/users/${pending.id}/approve`, {
    method: "POST",
    body: {},
    jar: managerSession.jar,
  });
  assert(adminApprove.status === 403, "admin cannot approve (HTTP 403)");
  assert(
    (await profileFor(pending.id)).account_status === "pending",
    "failed approval attempts leave the account pending",
  );

  const pendingLogin = await signIn(pending.email);
  assert(pendingLogin.result.status === 403, "pending user cannot sign in (HTTP 403)");
  assert(
    pendingLogin.result.json.error === "This account is pending admin approval.",
    "pending sign-in reports the approval requirement",
  );

  const superSession = await signIn(superadmin.email);
  assert(superSession.result.status === 200, "superadmin signs in (HTTP 200)");
  const superList = await api("/api/users", { jar: superSession.jar });
  assert(superList.status === 200, "superadmin can open user management (HTTP 200)");
  const listedSuperadmin = superList.json.users.find((user) => user.id === superadmin.id);
  assert(listedSuperadmin?.protected === true, "last active superadmin row is marked protected");
  assert(
    superList.json.users.filter((user) => user.protected).length === 1,
    "only the last active superadmin row is protected",
  );

  const approve = await api(`/api/users/${pending.id}/approve`, {
    method: "POST",
    body: {},
    jar: superSession.jar,
  });
  assert(approve.status === 200 && approve.json.user.accountStatus === "active", "superadmin can approve a pending user (HTTP 200)");
  assert((await profileFor(pending.id)).account_status === "active", "approval is persisted (active)");
  const approvedLogin = await signIn(pending.email);
  assert(approvedLogin.result.status === 200, "approved user can sign in (HTTP 200)");

  const approveAdmin = await api(`/api/users/${pendingAdmin.id}/approve`, {
    method: "POST",
    body: { role: "admin" },
    jar: superSession.jar,
  });
  assert(approveAdmin.status === 200 && approveAdmin.json.user.role === "admin", "superadmin can approve a pending user as Admin (HTTP 200)");
  assert((await profileFor(pendingAdmin.id)).roleCode === "admin", "designated admin role is persisted");

  const designate = await api(`/api/users/${standard.id}`, {
    method: "PATCH",
    body: { role: "admin" },
    jar: superSession.jar,
  });
  assert(designate.status === 200 && designate.json.user.role === "admin", "superadmin can designate an Admin via edit (HTTP 200)");
  assert((await profileFor(standard.id)).roleCode === "admin", "designated admin via edit is persisted");

  const adminPromote = await api(`/api/users/${pending.id}`, {
    method: "PATCH",
    body: { role: "admin" },
    jar: managerSession.jar,
  });
  assert(adminPromote.status === 400, "admin cannot designate or change roles (HTTP 400)");

  const duplicateApprove = await api(`/api/users/${pending.id}/approve`, {
    method: "POST",
    body: {},
    jar: superSession.jar,
  });
  assert(duplicateApprove.status === 409, "approving an already-active user is rejected (HTTP 409)");

  const blockedApprove = await api(`/api/users/${pendingBlocked.id}/approve`, {
    method: "POST",
    body: {},
    jar: superSession.jar,
  });
  assert(blockedApprove.status === 409, "approving a blocked pending user is rejected (HTTP 409)");

  const serverOwnedField = await api(`/api/users/${pendingBlocked.id}/approve`, {
    method: "POST",
    body: { account_status: "active" },
    jar: superSession.jar,
  });
  assert(serverOwnedField.status === 400, "approval rejects server-owned status fields (HTTP 400)");

  const lastBlock = await api(`/api/users/${superadmin.id}/status`, {
    method: "POST",
    body: { action: "block" },
    jar: superSession.jar,
  });
  assert(lastBlock.status === 409, "last active superadmin cannot be disabled by blocking (HTTP 409)");

  const lastDemote = await api(`/api/users/${superadmin.id}`, {
    method: "PATCH",
    body: { role: "user" },
    jar: superSession.jar,
  });
  assert(lastDemote.status === 409, "last active superadmin cannot be demoted (HTTP 409)");

  const lastDelete = await api(`/api/users/${superadmin.id}`, {
    method: "DELETE",
    jar: superSession.jar,
  });
  assert(lastDelete.status === 409, "last active superadmin cannot be removed (HTTP 409)");

  const finalProfile = await profileFor(superadmin.id);
  assert(
    finalProfile.roleCode === "superadmin" &&
      finalProfile.account_status === "active" &&
      finalProfile.is_blocked === false,
    "last superadmin remains active, unblocked, and superadmin after guard attempts",
  );

  console.log("\nAll S1-DEV-06 approval and guard checks passed.");
} finally {
  await cleanup();
  console.log("Cleaned up verification users.");
}
