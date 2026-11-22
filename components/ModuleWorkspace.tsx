"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import styles from "./ModuleWorkspace.module.css";

interface WorkspaceData {
  user: { firstName: string; lastName: string; email: string };
  role: "superadmin" | "admin" | "user";
  modules: Array<{ id: number; code: string; name: string }>;
}

interface ModuleWorkspaceProps {
  section: string;
  children: ReactNode;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function moduleInitials(code: string) {
  return code.split("_").map((part) => part[0]?.toUpperCase()).join("").slice(0, 2);
}

export default function ModuleWorkspace({ section, children }: ModuleWorkspaceProps) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const body = (await response.json()) as WorkspaceData & { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/");
          return;
        }
        setError(body.error ?? "Could not load the workspace.");
        return;
      }
      setData(body);
    } catch {
      setError("Could not reach the workspace service.");
    }
  }, [router]);

  useEffect(() => {
    // Load the authenticated workspace after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspace();
  }, [loadWorkspace]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  if (error) return <main className={styles.state} role="alert">{error}</main>;
  if (!data) return <main className={styles.state}>Loading workspace...</main>;

  const name = `${data.user.firstName} ${data.user.lastName}`.trim();
  const isManager = data.role === "admin" || data.role === "superadmin";

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar} aria-label="Workspace sidebar">
        <Link className={styles.brand} href="/dashboard" aria-label="Hope dashboard">
          <span className={styles.brandMark} aria-hidden="true">H</span>
          <span>hope.</span>
        </Link>
        <nav className={styles.nav} aria-label="Workspace navigation">
          <p className={styles.navLabel}>WORKSPACE</p>
          <Link className={styles.navLink} href="/dashboard">
            <span className={styles.navIcon} aria-hidden="true">OV</span>
            Overview
          </Link>
          {data.modules.map((module) => {
            const href = module.code === "customer"
              ? "/customers"
              : module.code === "product"
                ? "/products"
                : null;
            return href ? (
              <Link
                className={`${styles.navLink} ${section === module.name ? styles.navLinkActive : ""}`}
                href={href}
                key={module.id}
                aria-current={section === module.name ? "page" : undefined}
              >
                <span className={styles.navIcon} aria-hidden="true">{moduleInitials(module.code)}</span>
                {module.name}
              </Link>
            ) : null;
          })}
          {isManager && (
            <>
              <p className={styles.navLabel}>ADMINISTRATION</p>
              <Link className={styles.navLink} href="/users">
                <span className={styles.navIcon} aria-hidden="true">US</span>
                User management
              </Link>
            </>
          )}
        </nav>
        <div className={styles.footer}>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">{initials(name)}</span>
            <span><strong>{name}</strong><small>{data.role}</small></span>
          </div>
          <button className={styles.logout} type="button" onClick={logout}>Log out</button>
        </div>
      </aside>
      <div className={styles.body}>
        <header className={styles.topbar}>
          <p className={styles.breadcrumb}>Workspace <span aria-hidden="true">/</span> <strong>{section}</strong></p>
          <span>{name}</span>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
