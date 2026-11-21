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
const password = "ManagerPass1!";
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

async function makeUser(label, roleCode) {
  const email = `um-${label}-${suffix}@gmail.com`;
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
    account_status: "active",
    is_blocked: false,
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
  assert((await api("/api/users", { jar: createCookieJar() })).status === 401, "unauthenticated user list is denied (HTTP 401)");

  const superadmin = await makeUser("superadmin", "superadmin");
  const manager = await makeUser("admin", "admin");
  const standard = await makeUser("user", "user");

  const standardSession = await signIn(standard.email);
  assert(standardSession.result.status === 200, "standard user signs in (HTTP 200)");
  const standardList = await api("/api/users", { jar: standardSession.jar });
  assert(standardList.status === 403, "standard user cannot open user management (HTTP 403)");

  const managerSession = await signIn(manager.email);
  assert(managerSession.result.status === 200, "admin signs in (HTTP 200)");
  const adminList = await api("/api/users", { jar: managerSession.jar });
  assert(adminList.status === 200, "admin can open user management (HTTP 200)");
  assert(adminList.json.role === "admin", "admin role is reported by the server");
  assert(
    Array.isArray(adminList.json.users) && adminList.json.users.every((user) => user.role === "user"),
    "admin list contains only standard Users",
  );
  assert(
    !adminList.json.users.some((user) => user.id === manager.id || user.id === superadmin.id),
    "admin and superadmin accounts are hidden from admin",
  );

  const added = await api("/api/users", {
    method: "POST",
    jar: managerSession.jar,
    body: {
      firstName: "Added",
      lastName: "Member",
      email: `um-added-${suffix}@gmail.com`,
      role: "user",
    },
  });
  assert(added.status === 201, "admin can add a standard user (HTTP 201)");
  assert(typeof added.json.temporaryPassword === "string" && added.json.temporaryPassword.length >= 12, "add response returns a one-time temporary password");
  createdUserIds.push(added.json.user.id);
  assert(added.json.user.role === "user", "added user is forced to the standard User role");

  const tempLogin = await signIn(added.json.user.email, added.json.temporaryPassword);
  assert(tempLogin.result.status === 200, "temporary password signs in (HTTP 200)");
  assert(tempLogin.result.json.requiresPasswordSetup === true, "added user must set a new password on first login");

  const badRole = await api("/api/users", {
    method: "POST",
    jar: managerSession.jar,
    body: {
      firstName: "Nope",
      lastName: "Admin",
      email: `um-nope-${suffix}@gmail.com`,
      role: "admin",
    },
  });
  assert(badRole.status === 400, "admin cannot create an admin account (HTTP 400)");

  const badField = await api("/api/users", {
    method: "POST",
    jar: managerSession.jar,
    body: {
      firstName: "Nope",
      lastName: "Blocked",
      email: `um-nope-block-${suffix}@gmail.com`,
      role: "user",
      is_blocked: true,
    },
  });
  assert(badField.status === 400, "server-owned block field is rejected (HTTP 400)");

  const superSession = await signIn(superadmin.email);
  assert(superSession.result.status === 200, "superadmin signs in (HTTP 200)");
  const superList = await api("/api/users", { jar: superSession.jar });
  assert(superList.status === 200, "superadmin can open user management (HTTP 200)");
  assert(
    ["superadmin", "admin", "user"].every((role) => superList.json.users.some((user) => user.role === role)),
    "superadmin list includes all roles",
  );

  const edit = await api(`/api/users/${standard.id}`, {
    method: "PATCH",
    jar: managerSession.jar,
    body: { firstName: "Renamed", lastName: "Member" },
  });
  assert(edit.status === 200, "admin can edit a standard user (HTTP 200)");
  const { data: editedProfile } = await admin
    .from("app_user")
    .select("first_name, last_name")
    .eq("id", standard.id)
    .single();
  assert(editedProfile.first_name === "Renamed", "first name change is persisted");

  const roleEdit = await api(`/api/users/${standard.id}`, {
    method: "PATCH",
    jar: managerSession.jar,
    body: { role: "admin" },
  });
  assert(roleEdit.status === 400, "admin cannot promote a user (HTTP 400)");

  const hiddenEdit = await api(`/api/users/${superadmin.id}`, {
    method: "PATCH",
    jar: managerSession.jar,
    body: { firstName: "Hidden" },
  });
  assert(hiddenEdit.status === 404, "admin cannot edit a hidden superadmin (HTTP 404)");

  const block = await api(`/api/users/${standard.id}/status`, {
    method: "POST",
    jar: managerSession.jar,
    body: { action: "block" },
  });
  assert(block.status === 200 && block.json.user.isBlocked === true, "admin can block a standard user (HTTP 200)");
  const blockedLogin = await signIn(standard.email);
  assert(blockedLogin.result.status === 403, "blocked user cannot sign in (HTTP 403)");

  const unblock = await api(`/api/users/${standard.id}/status`, {
    method: "POST",
    jar: managerSession.jar,
    body: { action: "unblock" },
  });
  assert(unblock.status === 200 && unblock.json.user.isBlocked === false, "admin can unblock a standard user (HTTP 200)");
  const unblockedLogin = await signIn(standard.email);
  assert(unblockedLogin.result.status === 200, "unblocked user can sign in again (HTTP 200)");

  const lastBlock = await api(`/api/users/${superadmin.id}/status`, {
    method: "POST",
    jar: superSession.jar,
    body: { action: "block" },
  });
  assert(lastBlock.status === 409, "last active superadmin cannot be blocked (HTTP 409)");

  const lastDemote = await api(`/api/users/${superadmin.id}`, {
    method: "PATCH",
    jar: superSession.jar,
    body: { role: "user" },
  });
  assert(lastDemote.status === 409, "last active superadmin cannot be demoted (HTTP 409)");

  console.log("\nAll S1-DEV-05 user management checks passed.");
} finally {
  await cleanup();
  console.log("Cleaned up verification users.");
}
