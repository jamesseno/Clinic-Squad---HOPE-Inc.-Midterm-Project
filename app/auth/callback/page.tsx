"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifying your invitation...");

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setMessage("We could not verify the invitation. Check your connection and try the link again.");
        return;
      }
      if (!data.session) {
        setMessage("This invitation link is invalid or expired. Ask an administrator to send a new one.");
        return;
      }

      router.replace("/set-password");
    });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main>
      <h1>Invitation verification</h1>
      <p role="status">{message}</p>
    </main>
  );
}
