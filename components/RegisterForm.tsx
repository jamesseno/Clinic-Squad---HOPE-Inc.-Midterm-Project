"use client";

/**
 * Optional drop-in form for teams that want to wire the existing register view
 * to the API. The repository's current UI is intentionally left unchanged.
 * Copy this file together with RegisterForm.module.css to use it.
 */
import { useMemo, useState, type FormEvent } from "react";
import {
  getPasswordStrength,
  validateRegistration,
  type RegistrationField,
  type RegistrationFieldErrors,
} from "@/lib/registration";
import styles from "./RegisterForm.module.css";

export interface RegisterFormProps {
  apiUrl?: string;
  loginHref?: string;
  onSuccess?: (response: RegisterSuccessResponse) => void;
}

export interface RegisterSuccessResponse {
  message: string;
  account_status: "pending";
  requiresEmailConfirmation: boolean;
  user: { id: string; email: string };
}

type FormValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
};

const INITIAL_VALUES: FormValues = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  terms: false,
};

export default function RegisterForm({
  apiUrl = "/api/auth/register",
  loginHref,
  onSuccess,
}: RegisterFormProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<RegisterSuccessResponse | null>(null);

  const strength = useMemo(() => getPasswordStrength(values.password), [values.password]);

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setServerError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const validation = validateRegistration(values);
    if (!validation.ok) {
      setErrors(validation.fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as RegisterSuccessResponse & {
        error?: string;
        fieldErrors?: RegistrationFieldErrors;
      };

      if (!response.ok) {
        if (payload.fieldErrors) setErrors(payload.fieldErrors);
        setServerError(payload.error ?? "Registration failed. Please try again.");
        return;
      }

      setSuccess(payload);
      onSuccess?.(payload);
    } catch {
      setServerError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className={styles.card} aria-live="polite">
        <div className={styles.successIcon} aria-hidden="true">✓</div>
        <span className={styles.badge}>Status: Pending</span>
        <h2 className={styles.successTitle}>Account created</h2>
        <p className={styles.successText}>
          Your account (<strong>{success.user.email}</strong>) has been created and is{" "}
          <strong>pending admin approval</strong>. You will be able to sign in once an
          administrator approves it.
        </p>
        {success.requiresEmailConfirmation && (
          <div className={`${styles.alert} ${styles.note}`}>
            We also sent a confirmation link to your email. Please confirm your address before
            requesting approval.
          </div>
        )}
        <div className={styles.note}>
          Nothing to do on your end right now — an administrator will review your registration
          shortly.
        </div>
      </section>
    );
  }

  const errorFor = (field: RegistrationField) => errors[field];

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>Create your account</h2>
        <p className={styles.subtitle}>
          New accounts are reviewed by an administrator before activation.
        </p>
      </header>

      {serverError && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
          {serverError}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-name">Full name</label>
          <input
            id="register-name"
            className={`${styles.input} ${errorFor("name") ? styles.inputError : ""}`}
            value={values.name}
            onChange={(event) => setField("name", event.target.value)}
            autoComplete="name"
            placeholder="Jordan Lee"
            aria-invalid={Boolean(errorFor("name"))}
          />
          {errorFor("name") && <p className={styles.errorText}>{errorFor("name")}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-email">Email address</label>
          <input
            id="register-email"
            type="email"
            className={`${styles.input} ${errorFor("email") ? styles.inputError : ""}`}
            value={values.email}
            onChange={(event) => setField("email", event.target.value)}
            autoComplete="email"
            placeholder="jordan@example.com"
            aria-invalid={Boolean(errorFor("email"))}
          />
          {errorFor("email") && <p className={styles.errorText}>{errorFor("email")}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-phone">Phone number (optional)</label>
          <input
            id="register-phone"
            type="tel"
            className={`${styles.input} ${errorFor("phone") ? styles.inputError : ""}`}
            value={values.phone}
            onChange={(event) => setField("phone", event.target.value)}
            autoComplete="tel"
            placeholder="+1 (555) 000-0000"
            aria-invalid={Boolean(errorFor("phone"))}
          />
          {errorFor("phone") && <p className={styles.errorText}>{errorFor("phone")}</p>}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              className={`${styles.input} ${errorFor("password") ? styles.inputError : ""}`}
              value={values.password}
              onChange={(event) => setField("password", event.target.value)}
              autoComplete="new-password"
              aria-invalid={Boolean(errorFor("password"))}
            />
            <div className={styles.strength}>
              <div className={styles.strengthTrack}>
                <div
                  className={`${styles.strengthFill} ${styles[strength.className]}`}
                  style={{ width: `${strength.score * 25}%` }}
                />
              </div>
              <span className={styles.strengthLabel}>Strength: {strength.label}</span>
            </div>
            {errorFor("password") && <p className={styles.errorText}>{errorFor("password")}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-confirm-password">Confirm password</label>
            <input
              id="register-confirm-password"
              type="password"
              className={`${styles.input} ${errorFor("confirmPassword") ? styles.inputError : ""}`}
              value={values.confirmPassword}
              onChange={(event) => setField("confirmPassword", event.target.value)}
              autoComplete="new-password"
              aria-invalid={Boolean(errorFor("confirmPassword"))}
            />
            {errorFor("confirmPassword") && (
              <p className={styles.errorText}>{errorFor("confirmPassword")}</p>
            )}
          </div>
        </div>

        <label className={styles.terms}>
          <input
            type="checkbox"
            checked={values.terms}
            onChange={(event) => setField("terms", event.target.checked)}
          />
          <span>I agree to the Terms and Privacy Policy.</span>
        </label>
        {errorFor("terms") && <p className={styles.errorText}>{errorFor("terms")}</p>}

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Register"}
        </button>
      </form>

      {loginHref && (
        <p className={styles.footer}>
          Already have an account? <a href={loginHref}>Log in</a>
        </p>
      )}
    </section>
  );
}
