import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Reset links are valid for 30 minutes and can be used only once. */
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export interface PasswordResetTokenRow {
  password_reset_token_id: number;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used: boolean;
}

export type TokenLookup =
  | { ok: true; row: PasswordResetTokenRow }
  | { ok: false; status: number; error: string };

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a one-time reset token. Older unused tokens for the same user are
 * revoked, so only the newest emailed link can be used.
 */
export async function issuePasswordResetToken(
  admin: SupabaseClient,
  userId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

  const { error: revokeError } = await admin
    .from("password_reset_token")
    .update({ used: true })
    .eq("user_id", userId)
    .eq("used", false);

  if (revokeError) {
    console.error("Could not revoke older reset tokens:", revokeError.message);
    throw new Error("Could not issue a reset token.");
  }

  const { error: insertError } = await admin.from("password_reset_token").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    used: false,
  });

  if (insertError) {
    console.error("Could not store a reset token:", insertError.message);
    throw new Error("Could not issue a reset token.");
  }

  return { token, expiresAt };
}

export async function findPasswordResetToken(
  admin: SupabaseClient,
  token: string,
): Promise<TokenLookup> {
  const { data, error } = await admin
    .from("password_reset_token")
    .select(
      "password_reset_token_id, user_id, token_hash, expires_at, used",
    )
    .eq("token_hash", hashResetToken(token))
    .maybeSingle();

  if (error) {
    console.error("Reset token lookup failed:", error.message);
    return { ok: false, status: 500, error: "Could not verify the reset link." };
  }
  if (!data) {
    return { ok: false, status: 400, error: "This reset link is invalid." };
  }
  if (data.used) {
    return { ok: false, status: 400, error: "This reset link has already been used." };
  }
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 400, error: "This reset link has expired." };
  }

  return { ok: true, row: data as PasswordResetTokenRow };
}

/**
 * Atomically claims an unused, unexpired token. A second concurrent request
 * cannot claim the same token because the update filters on `used = false`.
 */
export async function claimPasswordResetToken(
  admin: SupabaseClient,
  row: PasswordResetTokenRow,
): Promise<boolean> {
  const { data, error } = await admin
    .from("password_reset_token")
    .update({ used: true })
    .eq("password_reset_token_id", row.password_reset_token_id)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .select("password_reset_token_id")
    .maybeSingle();

  if (error) {
    console.error("Could not claim a reset token:", error.message);
    return false;
  }
  return data !== null;
}

export async function releasePasswordResetToken(
  admin: SupabaseClient,
  row: PasswordResetTokenRow,
): Promise<void> {
  const { error } = await admin
    .from("password_reset_token")
    .update({ used: false })
    .eq("password_reset_token_id", row.password_reset_token_id);

  if (error) {
    console.error("Could not release a reset token after failure:", error.message);
  }
}
