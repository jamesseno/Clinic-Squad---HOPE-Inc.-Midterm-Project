"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import styles from "./Dashboard.module.css";

interface DashboardModule {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

interface DashboardData {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  role: "superadmin" | "admin" | "user";
  modules: DashboardModule[];
  pendingApprovals: number | null;
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
  return code
    .split("_")
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moduleNotice, setModuleNotice] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const body = (await response.json()) as DashboardData & { error?: string };
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
    // Initial fetch: all state updates happen after the network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  if (error) return <main className={styles.error}><p role="alert">{error}</p></main>;
  if (!data) return <main className={styles.loading}><p>Loading workspace...</p></main>;

  const name = `${data.user.firstName} ${data.user.lastName}`.trim();
  const isManager = data.role === "admin" || data.role === "superadmin";

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar} aria-label="Workspace sidebar">
        <Link className={styles.brand} href="/dashboard" aria-label="Hope dashboard">
          <span className={styles.brandMark} aria-hidden="true">H</span>
          <span>hope.</span>
        </Link>

        <nav className={styles.nav} aria-label="Workspace navigation">
          <p className={styles.navLabel}>WORKSPACE</p>
          <Link className={`${styles.navLink} ${styles.navLinkActive}`} href="/dashboard" aria-current="page">
            <span className={styles.navIcon} aria-hidden="true">OV</span>
            Overview
          </Link>
          {data.modules.map((module) => (
            module.code === "customer" || module.code === "product" || module.code === "human_resources" ? (
              <Link
                className={styles.navLink}
                href={module.code === "customer" ? "/customers" : module.code === "product" ? "/products" : "/employees"}
                key={module.id}
              >
                <span className={styles.navIcon} aria-hidden="true">{moduleInitials(module.code)}</span>
                {module.name}
              </Link>
            ) : (
              <button
                className={styles.navButton}
                type="button"
                key={module.id}
                onClick={() => setModuleNotice(`${module.name} is available once its module screen is implemented.`)}
              >
                <span className={styles.navIcon} aria-hidden="true">{moduleInitials(module.code)}</span>
                {module.name}
              </button>
            )
          ))}

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
          <p className={styles.breadcrumb}>Workspace <span aria-hidden="true">/</span> <strong>Overview</strong></p>
          <span>{name}</span>
        </header>

        <div className={styles.content}>
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>WORKSPACE / OVERVIEW</p>
              <h1>Good morning, {data.user.firstName}</h1>
              <p>A quick view of your workspace and available modules.</p>
            </div>
          </div>

          <section className={styles.summary} aria-label="Workspace summary">
            <article className={styles.summaryCard}>
              <span>Modules available</span>
              <strong>{data.modules.length}</strong>
              <small>Based on your assigned rights</small>
            </article>
            {isManager && (
              <article className={styles.summaryCard}>
                <span>Pending approvals</span>
                <strong>{data.pendingApprovals ?? 0}</strong>
                <small>Users waiting for access</small>
              </article>
            )}
            <article className={styles.summaryCard}>
              <span>Account role</span>
              <strong>{data.role}</strong>
              <small>Current workspace access</small>
            </article>
          </section>

          <section className={styles.modulesCard} aria-labelledby="modules-title">
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.eyebrow}>YOUR WORKSPACE</p>
                <h2 id="modules-title">Modules</h2>
              </div>
              <span className={styles.badge}>Rights-aware</span>
            </div>
            {moduleNotice ? (
              <p className={styles.moduleNotice} role="status" aria-live="polite">
                {moduleNotice}
              </p>
            ) : null}

            {data.modules.length > 0 ? (
              <div className={styles.moduleGrid}>
                {data.modules.map((module) => (
                  module.code === "customer" || module.code === "product" || module.code === "human_resources" ? (
                    <Link
                      className={styles.moduleTile}
                      href={module.code === "customer" ? "/customers" : module.code === "product" ? "/products" : "/employees"}
                      key={module.id}
                    >
                      <span className={styles.moduleIcon} aria-hidden="true">{moduleInitials(module.code)}</span>
                      <span>
                        <strong>{module.name}</strong>
                        <small>{module.description ?? "Workspace module"}</small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ) : (
                    <button
                      className={styles.moduleTile}
                      type="button"
                      key={module.id}
                      onClick={() => setModuleNotice(`${module.name} is available once its module screen is implemented.`)}
                    >
                      <span className={styles.moduleIcon} aria-hidden="true">{moduleInitials(module.code)}</span>
                      <span>
                        <strong>{module.name}</strong>
                        <small>{module.description ?? "Workspace module"}</small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </button>
                  )
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <h3>No modules assigned</h3>
                <p>Ask an administrator to review your account rights.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
