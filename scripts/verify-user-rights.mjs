import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = process.env.APP_ORIGIN ?? "http://localhost:3001";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const suffix = Date.now();
const password = "RightsPass1!";
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
      const raw = typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : response.headers.get("set-cookie")
          ? [response.headers.get("set-cookie")]
          : [];
      for (const item of raw) {
        const pair = item.split(";")[0];
        const separator = pair.indexOf("=");
        if (separator < 0) continue;
        const [name, value] = [pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()];
        if (!name || !value || value.startsWith(";") || /max-age=0/i.test(item) || /expires=thu, 01 jan 1970/i.test(item)) cookies.delete(name);
        else cookies.set(name, value);
      }
    },
  };
}

async function api(path, { method = "GET", body, jar } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (jar) headers.Cookie = jar.header();
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
    try { json = JSON.parse(text); } catch { /* Keep non-JSON text for diagnosis. */ }
  }
  return { status: response.status, json, text };
}

async function roleId(roleCode) {
  const { data, error } = await admin.from("app_role").select("role_id").eq("role_code", roleCode).single();
  if (error || !data) throw new Error(`Could not resolve ${roleCode}: ${error?.message}`);
  return data.role_id;
}

async function makeUser(label, roleCode) {
  const email = `rights-${label}-${suffix}@gmail.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: label, last_name: "Verification", password_setup_required: false },
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

async function signIn(email) {
  const jar = createCookieJar();
  const result = await api("/api/auth/login", { method: "POST", body: { email, password }, jar });
  return { jar, result };
}

async function cleanup() {
  for (const id of [...createdUserIds].reverse()) {
    await admin.auth.admin.deleteUser(id);
  }
}

try {
  const unauthenticated = await api("/api/users/00000000-0000-0000-0000-000000000000/rights");
  assert(unauthenticated.status === 401, "unauthenticated rights access is denied (HTTP 401)");

  const superadmin = await makeUser("superadmin", "superadmin");
  const manager = await makeUser("admin", "admin");
  const standard = await makeUser("user", "user");

  const userSession = await signIn(standard.email);
  assert(userSession.result.status === 200, "standard user signs in for rights verification");
  const denied = await api(`/api/users/${standard.id}/rights`, { jar: userSession.jar });
  assert(denied.status === 403, "standard user cannot open or modify rights (HTTP 403)");

  const managerSession = await signIn(manager.email);
  assert(managerSession.result.status === 200, "admin signs in for rights verification");

  const catalogue = await api(`/api/users/${standard.id}/rights`, { jar: managerSession.jar });
  assert(catalogue.status === 200, "admin can load a standard user's rights (HTTP 200)");
  const moduleNames = (catalogue.json.modules ?? []).map((module) => module.name);
  assert(
    ["Customer", "Product", "Human Resources", "Sales", "Reports"].every((name) => moduleNames.includes(name)),
    "rights dialogue catalogue contains all five required modules",
  );
  const counts = Object.fromEntries((catalogue.json.modules ?? []).map((module) => [module.name, module.rights.length]));
  assert(
    counts.Customer === 3 && counts.Product === 6 && counts["Human Resources"] === 13 && counts.Sales === 7 && counts.Reports === 7,
    "catalogue action counts are 3 / 6 / 13 / 7 / 7",
  );

  const customerIds = (catalogue.json.modules.find((module) => module.name === "Customer")?.rights ?? []).map((right) => right.id);
  assert(customerIds.length === 3, "Customer module exposes three per-action rights");

  const granted = await api(`/api/users/${standard.id}/rights`, {
    method: "PUT",
    jar: managerSession.jar,
    body: { rightIds: customerIds },
  });
  assert(granted.status === 200 && granted.json.granted === 3 && granted.json.total === 3, "admin grants selected Customer rights (HTTP 200)");

  const { data: activePerms } = await admin.from("user_permission").select("right_id").eq("user_id", standard.id).eq("is_deleted", false);
  assert(activePerms?.length === 3, "three Customer rights are persisted as active grants");

  const { data: addAudit } = await admin
    .from("audit_log")
    .select("action, action_by, record_key")
    .eq("table_name", "user_permission")
    .eq("action", "ADD")
    .ilike("record_key", `${standard.id}|%`)
    .order("audit_id", { ascending: false })
    .limit(10);
  assert((addAudit?.length ?? 0) >= 3, "grant changes are recorded in audit_log as ADD");
  assert(addAudit?.every((row) => row.action_by === manager.email), "ADD audit rows name the acting admin by JWT identity");

  const revoked = await api(`/api/users/${standard.id}/rights`, {
    method: "PUT",
    jar: managerSession.jar,
    body: { rightIds: [] },
  });
  assert(revoked.status === 200 && revoked.json.revoked === 3 && revoked.json.total === 0, "admin can clear all rights (HTTP 200)");

  const { data: deleteAudit } = await admin
    .from("audit_log")
    .select("audit_id")
    .eq("table_name", "user_permission")
    .eq("action", "DELETE")
    .ilike("record_key", `${standard.id}|%`);
  assert((deleteAudit?.length ?? 0) >= 3, "rights revocations are recorded in audit_log as DELETE");

  const restored = await api(`/api/users/${standard.id}/rights`, {
    method: "PUT",
    jar: managerSession.jar,
    body: { rightIds: customerIds },
  });
  assert(restored.status === 200 && restored.json.granted === 3 && restored.json.total === 3, "re-granting revoked rights works (HTTP 200)");

  const { data: restoreAudit } = await admin
    .from("audit_log")
    .select("audit_id")
    .eq("table_name", "user_permission")
    .eq("action", "RESTORE")
    .ilike("record_key", `${standard.id}|%`);
  assert((restoreAudit?.length ?? 0) >= 3, "re-grants are recorded in audit_log as RESTORE");

  const invalid = await api(`/api/users/${standard.id}/rights`, {
    method: "PUT",
    jar: managerSession.jar,
    body: { rightIds: [999999] },
  });
  assert(invalid.status === 400, "unknown right ids are rejected (HTTP 400)");

  const hiddenTarget = await api(`/api/users/${superadmin.id}/rights`, { jar: managerSession.jar });
  assert(hiddenTarget.status === 404, "admin cannot manage a superadmin account (HTTP 404)");

  const superSession = await signIn(superadmin.email);
  assert(superSession.result.status === 200, "superadmin signs in for rights verification");
  const superUpdate = await api(`/api/users/${standard.id}/rights`, {
    method: "PUT",
    jar: superSession.jar,
    body: { rightIds: [] },
  });
  assert(superUpdate.status === 200, "superadmin can manage standard-user rights (HTTP 200)");

  console.log("\nAll S1-DEV-07 user rights checks passed.");
} finally {
  await cleanup();
  console.log("Cleaned up verification users.");
}
