import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appOrigin = process.env.APP_ORIGIN;
const rosterJson = process.env.TEAM_SUPERADMINS_JSON;

if (!supabaseUrl || !serviceRoleKey || !appOrigin || !rosterJson) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_ORIGIN, and TEAM_SUPERADMINS_JSON before running this script.",
  );
}

const origin = new URL(appOrigin);
if (
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  (origin.protocol !== "https:" && origin.hostname !== "localhost" && origin.hostname !== "127.0.0.1")
) {
  throw new Error("APP_ORIGIN must be an HTTPS origin (HTTP is allowed only for localhost).");
}

let roster;
try {
  roster = JSON.parse(rosterJson);
} catch {
  throw new Error("TEAM_SUPERADMINS_JSON must be a JSON array of { first_name, last_name, email } objects.");
}

if (!Array.isArray(roster) || roster.length === 0) {
  throw new Error("TEAM_SUPERADMINS_JSON must contain at least one team member.");
}

const seenEmails = new Set();
for (const member of roster) {
  if (
    !member ||
    typeof member.first_name !== "string" ||
    !member.first_name.trim() ||
    typeof member.last_name !== "string" ||
    !member.last_name.trim() ||
    typeof member.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)
  ) {
    throw new Error("Each roster entry must include non-empty first_name, last_name, and a valid email.");
  }

  const normalizedEmail = member.email.trim().toLowerCase();
  if (seenEmails.has(normalizedEmail)) {
    throw new Error(`Duplicate email in TEAM_SUPERADMINS_JSON: ${normalizedEmail}`);
  }
  seenEmails.add(normalizedEmail);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const { data: role, error: roleError } = await supabase
  .from("app_role")
  .select("role_id")
  .eq("role_code", "superadmin")
  .single();

if (roleError || !role) {
  throw new Error(
    `The superadmin role is unavailable. Apply the schema and seed first: ${roleError?.message ?? "No matching role row."}`,
  );
}

const redirectTo = new URL("/auth/callback", origin).toString();

async function findExistingProfile(email) {
  const { data, error } = await supabase
    .from("app_user")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (error) throw new Error(`Could not check existing profile for ${email}: ${error.message}`);
  return data;
}

async function findExistingAuthUser(email) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not check existing Auth users: ${error.message}`);

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }

  throw new Error("Stopped while checking Auth users after 100 pages.");
}

for (const member of roster) {
  const email = member.email.trim().toLowerCase();
  const existingProfile = await findExistingProfile(email);
  const existingAuthUser = await findExistingAuthUser(email);

  if (existingProfile || existingAuthUser) {
    console.warn(`Skipped ${email}: an Auth user or profile already exists; reconcile it manually before proceeding.`);
    continue;
  }

  const { data: invitation, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      first_name: member.first_name.trim(),
      last_name: member.last_name.trim(),
      password_setup_required: true,
    },
  });

  if (inviteError || !invitation.user) {
    throw new Error(`Invitation failed for ${email}: ${inviteError?.message ?? "No user was returned."}`);
  }

  const { error: profileError } = await supabase.from("app_user").insert({
    id: invitation.user.id,
    email,
    first_name: member.first_name.trim(),
    last_name: member.last_name.trim(),
    role_id: role.role_id,
    account_status: "active",
    is_blocked: false,
  });

  if (profileError) {
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(invitation.user.id);
    const cleanupStatus = cleanupError
      ? ` Auth cleanup also failed: ${cleanupError.message}`
      : " The Auth account was removed, invalidating the invitation.";
    throw new Error(`Profile creation failed for ${email}: ${profileError.message}.${cleanupStatus}`);
  }

  console.log(`Invitation sent for ${email}. No invitation URL or token was logged.`);
}
