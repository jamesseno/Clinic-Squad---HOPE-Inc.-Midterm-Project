"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setMessage("Open this page using the invitation link sent to your email.");
        return;
      }
      setReady(true);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 12) {
      setMessage("Choose a password with at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setMessage("We could not set your password. The link may have expired; contact an administrator for a new invitation.");
      return;
    }

    setPassword("");
    setConfirmation("");
    setMessage("Your password has been set successfully.");
  }

  return (
    <main>
      <h1>Set your password</h1>
      <p>This invitation is for one-time account setup. Choose a password of at least 12 characters.</p>
      {ready ? (
        <form onSubmit={handleSubmit}>
          <label>
            New password
            <input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label>
            Confirm password
            <input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
          </label>
          <button disabled={submitting} type="submit">
            {submitting ? "Saving..." : "Set password"}
          </button>
        </form>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
