/**
 * Shared validation for login, first-login password setup, and password reset.
 *
 * The API routes reject unknown keys so clients cannot submit server-owned
 * fields such as `account_status`, `role_id`, or `is_blocked`.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LOGIN_FIELDS = ["email", "password", "remember"] as const;
export const SET_PASSWORD_FIELDS = ["password", "confirmPassword"] as const;
export const RESET_REQUEST_FIELDS = ["email"] as const;
export const RESET_CONFIRM_FIELDS = ["token", "password", "confirmPassword"] as const;

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

export type ResetField = "token" | "email" | "password" | "confirmPassword" | "form";
export type ResetFieldErrors = Partial<Record<ResetField, string>>;

export interface ValidResetRequest {
  email: string;
}

export interface ValidResetConfirm {
  token: string;
  password: string;
}

export type ResetRequestValidation =
  | { ok: true; value: ValidResetRequest }
  | { ok: false; error: string; fieldErrors: ResetFieldErrors };

export type ResetConfirmValidation =
  | { ok: true; value: ValidResetConfirm }
  | { ok: false; error: string; fieldErrors: ResetFieldErrors };

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

export function validateResetRequest(payload: unknown): ResetRequestValidation {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      fieldErrors: { form: "Request body must be a JSON object." },
    };
  }

  const unknownKeys = unexpectedKeys(payload, RESET_REQUEST_FIELDS);
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: `Field(s) ${unknownKeys.join(", ")} cannot be set during a reset request.`,
      fieldErrors: { form: "Unexpected fields were submitted." },
    };
  }

  const rawEmail = payload.email;
  if (typeof rawEmail !== "string" || rawEmail.trim() === "") {
    return {
      ok: false,
      error: "Enter your email address.",
      fieldErrors: { email: "Enter your email address." },
    };
  }
  if (rawEmail.length > 255 || !EMAIL_PATTERN.test(rawEmail.trim())) {
    return {
      ok: false,
      error: "Enter a valid email address.",
      fieldErrors: { email: "Enter a valid email address." },
    };
  }

  return { ok: true, value: { email: rawEmail.trim().toLowerCase() } };
}

export function validateResetConfirm(payload: unknown): ResetConfirmValidation {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      fieldErrors: { form: "Request body must be a JSON object." },
    };
  }

  const unknownKeys = unexpectedKeys(payload, RESET_CONFIRM_FIELDS);
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: `Field(s) ${unknownKeys.join(", ")} cannot be set during a password reset.`,
      fieldErrors: { form: "Unexpected fields were submitted." },
    };
  }

  const fieldErrors: ResetFieldErrors = {};
  const token = payload.token;
  const password = payload.password;
  const confirmation = payload.confirmPassword;

  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    fieldErrors.token = "This reset link is invalid.";
  }

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

  return {
    ok: true,
    value: {
      token: token as string,
      password: password as string,
    },
  };
}
