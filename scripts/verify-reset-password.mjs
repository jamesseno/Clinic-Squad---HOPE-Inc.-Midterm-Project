import { createHash, randomBytes } from "node:crypto";
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

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
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

async function makeUser({ label, password, accountStatus = "active", isBlocked = false }) {
  const email = `reset-${label}-${suffix}@gmail.com`;

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
      first_name: "Reset",
      last_name: "Verify",
      password_setup_required: false,
    },
  });
  if (authError || !authData.user) {
    throw new Error(`Could not create ${email}: ${authError?.message ?? "no user returned"}`);
  }
  createdUserIds.push(authData.user.id);

  const { error: profileError } = await admin.from("app_user").insert({
    id: authData.user.id,
    email,
    first_name: "Reset",
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

async function tokensFor(userId) {
  const { data, error } = await admin
    .from("password_reset_token")
    .select("password_reset_token_id, user_id, token_hash, expires_at, used")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not read reset tokens: ${error.message}`);
  return data ?? [];
}

async function insertToken(userId, token, { expiresAt, used = false } = {}) {
  const value = {
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    used,
  };
  const { error } = await admin.from("password_reset_token").insert(value);
  if (error) throw new Error(`Could not create a reset token: ${error.message}`);
}

async function signIn(email, password) {
  return api("/api/auth/login", {
    method: "POST",
    body: { email, password },
    jar: createCookieJar(),
  });
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
  const invalidRequest = await api("/api/auth/reset/request", {
    method: "POST",
    body: { email: "someone@gmail.com", account_status: "active" },
  });
  assert(invalidRequest.status === 400, "server-controlled reset fields are rejected (HTTP 400)");

  const unknownRequest = await api("/api/auth/reset/request", {
    method: "POST",
    body: { email: `no-one-${suffix}@gmail.com` },
  });
  assert(
    unknownRequest.status === 200 && unknownRequest.json?.message?.includes("If an account"),
    "unknown email returns the same generic response (HTTP 200)",
  );

  const active = await makeUser({ label: "active", password: "InitialPass123!" });

  const request = await api("/api/auth/reset/request", {
    method: "POST",
    body: { email: active.email },
  });
  assert(request.status === 200, "reset request is accepted (HTTP 200)");

  const requestedTokens = await tokensFor(active.id);
  assert(
    requestedTokens.length === 1 &&
      requestedTokens[0].used === false &&
      /^[a-f0-9]{64}$/.test(requestedTokens[0].token_hash) &&
      new Date(requestedTokens[0].expires_at).getTime() > Date.now(),
    "request stores a hashed, unused token with a future expiry",
  );

  const token = newToken();
  await insertToken(active.id, token);

  const verify = await api(`/api/auth/reset/verify?token=${encodeURIComponent(token)}`);
  assert(verify.status === 200 && verify.json?.valid === true, "valid token verifies (HTTP 200)");

  const weakPassword = await api("/api/auth/reset/confirm", {
    method: "POST",
    body: { token, password: "short", confirmPassword: "short" },
  });
  assert(weakPassword.status === 400, "weak reset password is rejected (HTTP 400)");

  const mismatch = await api("/api/auth/reset/confirm", {
    method: "POST",
    body: { token, password: "StrongReset123!", confirmPassword: "Different123!" },
  });
  assert(mismatch.status === 400, "mismatched reset passwords are rejected (HTTP 400)");

  const confirm = await api("/api/auth/reset/confirm", {
    method: "POST",
    body: { token, password: "StrongReset123!", confirmPassword: "StrongReset123!" },
  });
  assert(confirm.status === 200, "valid token sets a new password (HTTP 200)");

  const reused = await api("/api/auth/reset/confirm", {
    method: "POST",
    body: { token, password: "AnotherReset123!", confirmPassword: "AnotherReset123!" },
  });
  assert(reused.status === 400, "reset token cannot be reused (HTTP 400)");

  const verifyUsed = await api(`/api/auth/reset/verify?token=${encodeURIComponent(token)}`);
  assert(verifyUsed.status === 400 && verifyUsed.json?.valid === false, "used token fails verification");

  const oldPassword = await signIn(active.email, "InitialPass123!");
  assert(oldPassword.status === 401, "old password no longer signs in (HTTP 401)");

  const newPassword = await signIn(active.email, "StrongReset123!");
  assert(newPassword.status === 200, "new password signs in (HTTP 200)");

  const expiredToken = newToken();
  await insertToken(active.id, expiredToken, {
    expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
  });

  const verifyExpired = await api(`/api/auth/reset/verify?token=${encodeURIComponent(expiredToken)}`);
  assert(verifyExpired.status === 400, "expired token fails verification (HTTP 400)");

  const confirmExpired = await api("/api/auth/reset/confirm", {
    method: "POST",
    body: {
      token: expiredToken,
      password: "ExpiredReset123!",
      confirmPassword: "ExpiredReset123!",
    },
  });
  assert(confirmExpired.status === 400, "expired token cannot reset a password (HTTP 400)");

  const afterExpired = await signIn(active.email, "StrongReset123!");
  assert(afterExpired.status === 200, "password is unchanged after an expired token attempt");

  const malformed = await api("/api/auth/reset/confirm", {
    method: "POST",
    body: { token: "not-a-token", password: "Malformed123!", confirmPassword: "Malformed123!" },
  });
  assert(malformed.status === 400, "malformed token is rejected (HTTP 400)");

  const unknownToken = await api("/api/auth/reset/confirm", {
    method: "POST",
    body: {
      token: newToken(),
      password: "UnknownToken123!",
      confirmPassword: "UnknownToken123!",
    },
  });
  assert(unknownToken.status === 400, "unknown token is rejected (HTTP 400)");

  const revocableToken = newToken();
  await insertToken(active.id, revocableToken);

  await api("/api/auth/reset/request", {
    method: "POST",
    body: { email: active.email },
  });
  const afterNewRequest = await tokensFor(active.id);
  const revokedRow = afterNewRequest.find((row) => row.token_hash === hashToken(revocableToken));
  assert(revokedRow?.used === true, "a newer request revokes the older unused token");

  const confirmRevoked = await api("/api/auth/reset/confirm", {
    method: "POST",
    body: {
      token: revocableToken,
      password: "RevokedReset123!",
      confirmPassword: "RevokedReset123!",
    },
  });
  assert(confirmRevoked.status === 400, "revoked token cannot reset a password (HTTP 400)");

  const blocked = await makeUser({
    label: "blocked",
    password: "BlockedPass123!",
    isBlocked: true,
  });
  const blockedRequest = await api("/api/auth/reset/request", {
    method: "POST",
    body: { email: blocked.email },
  });
  const blockedTokens = await tokensFor(blocked.id);
  assert(
    blockedRequest.status === 200 && blockedTokens.length === 0,
    "blocked account receives no reset token",
  );

  const blockedToken = newToken();
  await insertToken(blocked.id, blockedToken);
  const blockedConfirm = await api("/api/auth/reset/confirm", {
    method: "POST",
    body: {
      token: blockedToken,
      password: "BlockedReset123!",
      confirmPassword: "BlockedReset123!",
    },
  });
  assert(blockedConfirm.status === 403, "blocked account cannot complete a reset (HTTP 403)");

  const pending = await makeUser({
    label: "pending",
    password: "PendingPass123!",
    accountStatus: "pending",
  });
  const pendingRequest = await api("/api/auth/reset/request", {
    method: "POST",
    body: { email: pending.email },
  });
  const pendingTokens = await tokensFor(pending.id);
  assert(
    pendingRequest.status === 200 && pendingTokens.length === 0,
    "pending account receives no reset token",
  );

  console.log("\nAll S1-DEV-04 password reset checks passed.");
} finally {
  await cleanup();
  console.log("Cleaned up verification users.");
}
