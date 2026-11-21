/**
 * Shared registration validation.
 *
 * The browser form and the API route use the same rules. The API additionally
 * rejects unknown keys, so a client can never submit `account_status`, `role`,
 * `role_id`, or any other server-owned field.
 */

export const REGISTRATION_FIELDS = [
  "name",
  "email",
  "phone",
  "password",
  "confirmPassword",
  "terms",
] as const;

export type RegistrationField = (typeof REGISTRATION_FIELDS)[number] | "form";

export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>;

export interface ValidRegistration {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  password: string;
}

export type RegistrationValidation =
  | { ok: true; value: ValidRegistration }
  | { ok: false; error: string; fieldErrors: RegistrationFieldErrors };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d\s.-]{7,30}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(
  fieldErrors: RegistrationFieldErrors,
  payload: Record<string, unknown>,
  key: string,
  message: string,
): string | null {
  const value = payload[key];
  if (typeof value !== "string" || value.trim() === "") {
    fieldErrors[key as RegistrationField] = message;
    return null;
  }
  return value.trim();
}

export function validateRegistration(payload: unknown): RegistrationValidation {
  if (!isRecord(payload)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      fieldErrors: { form: "Request body must be a JSON object." },
    };
  }

  const fieldErrors: RegistrationFieldErrors = {};
  const allowedKeys = new Set<string>(REGISTRATION_FIELDS);
  const unknownKeys = Object.keys(payload).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: `Field(s) ${unknownKeys.join(", ")} cannot be set during registration.`,
      fieldErrors: { form: "Unexpected fields were submitted." },
    };
  }

  const name = firstString(fieldErrors, payload, "name", "Enter your full name.");
  const email = firstString(fieldErrors, payload, "email", "Enter your email address.");
  const password = firstString(fieldErrors, payload, "password", "Enter a password.");
  const confirmPassword = firstString(
    fieldErrors,
    payload,
    "confirmPassword",
    "Confirm your password.",
  );

  let phone: string | null = null;
  if (payload.phone !== undefined && payload.phone !== null && payload.phone !== "") {
    if (typeof payload.phone !== "string" || !PHONE_PATTERN.test(payload.phone.trim())) {
      fieldErrors.phone = "Enter a valid phone number, or leave it blank.";
    } else {
      phone = payload.phone.trim();
    }
  }

  if (payload.terms !== true) {
    fieldErrors.terms = "You must agree to the Terms and Privacy Policy.";
  }

  let firstName = "";
  let lastName = "";
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      fieldErrors.name = "Enter both your first and last name.";
    } else {
      firstName = parts[0].slice(0, 100);
      lastName = parts.slice(1).join(" ").slice(0, 100);
    }
  }

  let normalizedEmail = "";
  if (email) {
    if (email.length > 255 || !EMAIL_PATTERN.test(email)) {
      fieldErrors.email = "Enter a valid email address.";
    } else {
      normalizedEmail = email.toLowerCase();
    }
  }

  if (password) {
    if (password.length < 8) {
      fieldErrors.password = "Password must be at least 8 characters.";
    } else if (!/[a-z]/.test(password)) {
      fieldErrors.password = "Password must include a lowercase letter.";
    } else if (!/[A-Z]/.test(password)) {
      fieldErrors.password = "Password must include an uppercase letter.";
    } else if (!/[0-9]/.test(password)) {
      fieldErrors.password = "Password must include a number.";
    }
  }

  if (password && confirmPassword && password !== confirmPassword) {
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
      firstName,
      lastName,
      email: normalizedEmail,
      phone,
      password: password as string,
    },
  };
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  className: "weak" | "fair" | "good" | "strong";
} {
  if (!password) return { score: 0, label: "Not set", className: "weak" };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: "Weak", className: "weak" };
  if (score === 3) return { score: 2, label: "Fair", className: "fair" };
  if (score === 4) return { score: 3, label: "Good", className: "good" };
  return { score: 4, label: "Strong", className: "strong" };
}
