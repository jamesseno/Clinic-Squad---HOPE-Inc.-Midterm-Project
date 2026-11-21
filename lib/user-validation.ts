import type { ManagedRole } from "./user-management";

/**
 * Add/edit payload validation. Server-owned fields such as `id`, `role_id`,
 * `account_status`, and `is_blocked` are never accepted from the browser.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[A-Za-z][A-Za-z'’ .-]*$/;

export const ADD_USER_FIELDS = ["firstName", "lastName", "email", "role"] as const;
export const EDIT_USER_FIELDS = ["firstName", "lastName", "role"] as const;

export type UserField = "firstName" | "lastName" | "email" | "role" | "form";
export type UserFieldErrors = Partial<Record<UserField, string>>;

export interface ValidAddUser {
  firstName: string;
  lastName: string;
  email: string;
  role: ManagedRole;
}

export interface ValidEditUser {
  firstName?: string;
  lastName?: string;
  role?: ManagedRole;
}

export type AddUserValidation =
  | { ok: true; value: ValidAddUser }
  | { ok: false; error: string; fieldErrors: UserFieldErrors };

export type EditUserValidation =
  | { ok: true; value: ValidEditUser }
  | { ok: false; error: string; fieldErrors: UserFieldErrors };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownKeys(payload: Record<string, unknown>, allowed: readonly string[]) {
  const allowedKeys = new Set<string>(allowed);
  return Object.keys(payload).filter((key) => !allowedKeys.has(key));
}

function validateName(value: unknown, label: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) return `Enter the ${label}.`;
  const name = value.trim();
  if (name.length > 80) return `${label} must be 80 characters or fewer.`;
  if (!NAME_PATTERN.test(name)) return `${label} contains unsupported characters.`;
  return undefined;
}

function validateRole(value: unknown, allowed: readonly ManagedRole[]): ManagedRole | undefined {
  if (typeof value !== "string") return undefined;
  return allowed.includes(value as ManagedRole) ? (value as ManagedRole) : undefined;
}

export function validateAddUser(
  payload: unknown,
  allowedRoles: readonly ManagedRole[],
): AddUserValidation {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      fieldErrors: { form: "Request body must be a JSON object." },
    };
  }

  const extras = unknownKeys(payload, ADD_USER_FIELDS);
  if (extras.length > 0) {
    return {
      ok: false,
      error: `Field(s) ${extras.join(", ")} cannot be set when adding a user.`,
      fieldErrors: { form: "Unexpected fields were submitted." },
    };
  }

  const fieldErrors: UserFieldErrors = {};
  const firstNameError = validateName(payload.firstName, "first name");
  const lastNameError = validateName(payload.lastName, "last name");
  if (firstNameError) fieldErrors.firstName = firstNameError;
  if (lastNameError) fieldErrors.lastName = lastNameError;

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email) {
    fieldErrors.email = "Enter an email address.";
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  const role = validateRole(payload.role, allowedRoles);
  if (!role) {
    fieldErrors.role = `Choose one of: ${allowedRoles.join(", ")}.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
  }

  return {
    ok: true,
    value: {
      firstName: (payload.firstName as string).trim(),
      lastName: (payload.lastName as string).trim(),
      email,
      role: role as ManagedRole,
    },
  };
}

export function validateEditUser(
  payload: unknown,
  allowedRoles: readonly ManagedRole[],
): EditUserValidation {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      fieldErrors: { form: "Request body must be a JSON object." },
    };
  }

  const extras = unknownKeys(payload, EDIT_USER_FIELDS);
  if (extras.length > 0) {
    return {
      ok: false,
      error: `Field(s) ${extras.join(", ")} cannot be set when editing a user.`,
      fieldErrors: { form: "Unexpected fields were submitted." },
    };
  }

  const fieldErrors: UserFieldErrors = {};
  const value: ValidEditUser = {};

  if (payload.firstName !== undefined) {
    const error = validateName(payload.firstName, "first name");
    if (error) fieldErrors.firstName = error;
    else value.firstName = (payload.firstName as string).trim();
  }
  if (payload.lastName !== undefined) {
    const error = validateName(payload.lastName, "last name");
    if (error) fieldErrors.lastName = error;
    else value.lastName = (payload.lastName as string).trim();
  }
  if (payload.role !== undefined) {
    const role = validateRole(payload.role, allowedRoles);
    if (!role) fieldErrors.role = `Choose one of: ${allowedRoles.join(", ")}.`;
    else value.role = role;
  }
  if (value.firstName === undefined && value.lastName === undefined && value.role === undefined) {
    fieldErrors.form = "Provide at least one field to update.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
  }

  return { ok: true, value };
}
