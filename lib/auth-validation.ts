/**
 * Shared validation for login and first-login password setup.
 *
 * The API routes reject unknown keys so clients cannot submit server-owned
 * fields such as `account_status`, `role_id`, or `is_blocked`.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LOGIN_FIELDS = ["email", "password", "remember"] as const;
export const SET_PASSWORD_FIELDS = ["password", "confirmPassword"] as const;

export type LoginField = (typeof LOGIN_FIELDS)[number] | "form";
export type SetPasswordField = (typeof SET_PASSWORD_FIELDS)[number] | "form";

export type LoginFieldErrors = Partial<Record<LoginField, string>>;
export type SetPasswordFieldErrors = Partial<Record<SetPasswordField, string>>;

export interface ValidLogin {
  email: string;
  password: string;
  remember: boolean;
}

export interface ValidSetPassword {
  password: string;
}

export type LoginValidation =
  | { ok: true; value: ValidLogin }
  | { ok: false; error: string; fieldErrors: LoginFieldErrors };

export type SetPasswordValidation =
  | { ok: true; value: ValidSetPassword }
  | { ok: false; error: string; fieldErrors: SetPasswordFieldErrors };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(
  payload: Record<string, unknown>,
  allowed: readonly string[],
): string[] {
  const allowedKeys = new Set<string>(allowed);
  return Object.keys(payload).filter((key) => !allowedKeys.has(key));
}

export function validateLogin(payload: unknown): LoginValidation {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      fieldErrors: { form: "Request body must be a JSON object." },
    };
  }

  const unknownKeys = unexpectedKeys(payload, LOGIN_FIELDS);
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: `Field(s) ${unknownKeys.join(", ")} cannot be set during login.`,
      fieldErrors: { form: "Unexpected fields were submitted." },
    };
  }

  const fieldErrors: LoginFieldErrors = {};
  const rawEmail = payload.email;
  const password = payload.password;

  if (typeof rawEmail !== "string" || rawEmail.trim() === "") {
    fieldErrors.email = "Enter your email address.";
  } else if (rawEmail.length > 255 || !EMAIL_PATTERN.test(rawEmail.trim())) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (typeof password !== "string" || password.length === 0) {
    fieldErrors.password = "Enter your password.";
  } else if (password.length > 200) {
    fieldErrors.password = "Password is too long.";
  }

  if (payload.remember !== undefined && typeof payload.remember !== "boolean") {
    fieldErrors.form = "Remember me must be true or false.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  return {
    ok: true,
    value: {
      email: (rawEmail as string).trim().toLowerCase(),
      password: password as string,
      remember: payload.remember === true,
    },
  };
}

export function validateSetPassword(payload: unknown): SetPasswordValidation {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      fieldErrors: { form: "Request body must be a JSON object." },
    };
  }

  const unknownKeys = unexpectedKeys(payload, SET_PASSWORD_FIELDS);
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: `Field(s) ${unknownKeys.join(", ")} cannot be set during password setup.`,
      fieldErrors: { form: "Unexpected fields were submitted." },
    };
  }

  const fieldErrors: SetPasswordFieldErrors = {};
  const password = payload.password;
  const confirmation = payload.confirmPassword;

  if (typeof password !== "string" || password.length === 0) {
    fieldErrors.password = "Enter a new password.";
  } else if (password.length < 12) {
    fieldErrors.password = "Password must be at least 12 characters.";
  } else if (!/[a-z]/.test(password)) {
    fieldErrors.password = "Password must include a lowercase letter.";
  } else if (!/[A-Z]/.test(password)) {
    fieldErrors.password = "Password must include an uppercase letter.";
  } else if (!/[0-9]/.test(password)) {
    fieldErrors.password = "Password must include a number.";
  }

  if (typeof confirmation !== "string" || confirmation.length === 0) {
    fieldErrors.confirmPassword = "Confirm your new password.";
  } else if (password !== confirmation) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  return { ok: true, value: { password: password as string } };
}
