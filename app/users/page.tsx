"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import RightsDialog from "./RightsDialog";
import styles from "./Users.module.css";

type Role = "superadmin" | "admin" | "user";
type StatusFilter = "all" | "pending" | "active" | "blocked";
type SortOrder = "name" | "recent" | "role";

interface ManagedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  accountStatus: "pending" | "active";
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  protected: boolean;
}

interface FieldErrors {
  [key: string]: string | undefined;
}

type ModalState =
  | { mode: "add" }
  | { mode: "edit"; user: ManagedUser }
  | { mode: "rights"; user: ManagedUser }
  | null;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  role: "user",
};

const roleOrder: Record<Role, number> = { superadmin: 0, admin: 1, user: 2 };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [managerRole, setManagerRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("name");
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const body = (await response.json()) as {
        role?: Role;
        users?: ManagedUser[];
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setAccessError(body.error ?? "You do not have access to user management.");
        } else {
          setError(body.error ?? "Could not load users.");
        }
        return;
      }

      setManagerRole(body.role ?? "user");
      setUsers(body.users ?? []);
    } catch {
      setError("Could not reach the user management service.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    setLoading(true);
    setAccessError(null);
    setError(null);
    await loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    // Initial fetch: all state updates happen after the network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  const counts = useMemo(
    () => ({
      all: users.length,
      pending: users.filter((user) => user.accountStatus === "pending" && !user.isBlocked).length,
      active: users.filter((user) => user.accountStatus === "active" && !user.isBlocked).length,
      blocked: users.filter((user) => user.isBlocked).length,
    }),
    [users],
  );

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = users.filter((user) => {
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "blocked" && user.isBlocked) ||
        (statusFilter !== "blocked" &&
          !user.isBlocked &&
          user.accountStatus === statusFilter);
      const roleMatches = roleFilter === "all" || user.role === roleFilter;
      const searchMatches =
        !query ||
        `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(query);
      return statusMatches && roleMatches && searchMatches;
    });

    return filtered.sort((left, right) => {
      if (sortOrder === "recent") {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }
      if (sortOrder === "role") {
        return roleOrder[left.role] - roleOrder[right.role] || left.lastName.localeCompare(right.lastName);
      }
      return left.lastName.localeCompare(right.lastName) || left.firstName.localeCompare(right.firstName);
    });
  }, [users, statusFilter, roleFilter, search, sortOrder]);

  function openAdd() {
    setForm({ ...emptyForm, role: managerRole === "superadmin" ? "user" : "user" });
    setFieldErrors({});
    setModal({ mode: "add" });
  }

  function openEdit(user: ManagedUser) {
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    });
    setFieldErrors({});
    setModal({ mode: "edit", user });
  }

  async function submitModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;

    if (
      modal.mode === "edit" &&
      modal.user.protected &&
      form.role !== modal.user.role
    ) {
      setError("The last active Superadmin cannot be demoted.");
      return;
    }

    setBusy(true);
    setNotice(null);
    setError(null);
    setTemporaryPassword(null);
    setFieldErrors({});

    const isAdd = modal.mode === "add";
    const body = isAdd
      ? { firstName: form.firstName, lastName: form.lastName, email: form.email, role: form.role }
      : {
          firstName: form.firstName,
          lastName: form.lastName,
          ...(managerRole === "superadmin" ? { role: form.role } : {}),
        };

    try {
      const response = await fetch(
        isAdd ? "/api/users" : `/api/users/${encodeURIComponent(modal.user.id)}`,
        {
          method: isAdd ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        fieldErrors?: FieldErrors;
        temporaryPassword?: string;
        user?: ManagedUser;
      };

      if (!response.ok) {
        setError(result.error ?? "Could not save the user.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      if (result.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
      setNotice(isAdd ? "User added. Share the temporary password securely." : "User updated.");
      setModal(null);
      await refreshUsers();
    } catch {
      setError("Could not reach the user management service.");
    } finally {
      setBusy(false);
    }
  }

  async function changeBlockState(user: ManagedUser) {
    const action = user.isBlocked ? "unblock" : "block";
    const confirmed =
      action === "block"
        ? window.confirm(`Block ${user.firstName} ${user.lastName}? Their session will be invalidated.`)
        : true;
    if (!confirmed) return;

    setBusy(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Could not update that user's access.");
        return;
      }

      setNotice(action === "block" ? "User blocked." : "User unblocked.");
      await refreshUsers();
    } catch {
      setError("Could not reach the user management service.");
    } finally {
      setBusy(false);
    }
  }

  async function approveUser(user: ManagedUser, role: "user" | "admin") {
    setBusy(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Could not approve that user.");
        return;
      }

      setNotice(
        role === "admin"
          ? `${user.firstName} approved as Admin.`
          : `${user.firstName} approved and can now sign in.`,
      );
      await refreshUsers();
    } catch {
      setError("Could not reach the user management service.");
    } finally {
      setBusy(false);
    }
  }

  function openRights(user: ManagedUser) {
    setError(null);
    setNotice(null);
    setModal({ mode: "rights", user });
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div className={styles.state} role="status">
            <h2>Loading users…</h2>
            <p>Checking your access and loading the user list.</p>
          </div>
        </section>
      </main>
    );
  }

  if (accessError) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div className={styles.state}>
            <h2>Access denied</h2>
            <p>{accessError}</p>
            <p>
              <Link href="/">Return to sign in</Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>WORKSPACE / ADMINISTRATION</p>
          <h1 className={styles.title}>User management</h1>
          <p className={styles.subheading}>
            Review account status and manage access for your organization.
          </p>
        </div>
        <button className={styles.primary} type="button" onClick={openAdd}>
          + Add User
        </button>
      </header>

      {notice ? <div className={styles.toast}>{notice}</div> : null}
      {error ? <div className={styles.errorToast}>{error}</div> : null}
      {temporaryPassword ? (
        <div className={styles.toast}>
          Temporary password (shown once):
          <div className={styles.passwordBox}>{temporaryPassword}</div>
        </div>
      ) : null}

      <section className={styles.card} aria-label="User list">
        <div className={styles.cardHeading}>
          <div>
            <strong>Users</strong>
            <small>Manage account status and module rights</small>
          </div>
        </div>

        <div className={styles.scopeNote}>
          {managerRole === "admin"
            ? "Admin scope: standard Users only. Admin and Superadmin accounts are hidden."
            : "Superadmin scope: all accounts are visible."}
        </div>

        <div className={styles.tabs} role="group" aria-label="Filter users by status">
          {(["all", "pending", "active", "blocked"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              className={styles.tab}
              type="button"
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            >
              {status[0]?.toUpperCase()}
              {status.slice(1)} <span>{counts[status]}</span>
            </button>
          ))}
        </div>

        <div className={styles.filters}>
          <label>
            Search
            <input
              type="search"
              value={search}
              placeholder="Search name or email"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as Role | "all")}
            >
              <option value="all">All roles</option>
              <option value="user">User</option>
              {managerRole === "superadmin" ? (
                <>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </>
              ) : null}
            </select>
          </label>
          <label>
            Sort by
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            >
              <option value="name">Name A–Z</option>
              <option value="recent">Recently updated</option>
              <option value="role">Role</option>
            </select>
          </label>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Organization user accounts</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                <th scope="col"><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    <span className={styles.nameMeta}>Added {formatDate(user.createdAt)}</span>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeRole}`}>{user.role}</span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        user.isBlocked
                          ? styles.badgeBlocked
                          : user.accountStatus === "active"
                            ? styles.badgeActive
                            : styles.badgePending
                      }`}
                    >
                      {user.isBlocked ? "Blocked" : user.accountStatus}
                    </span>
                  </td>
                  <td>{formatDate(user.updatedAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      {managerRole === "superadmin" &&
                      user.accountStatus === "pending" &&
                      !user.isBlocked ? (
                        <>
                          <button
                            className={styles.approve}
                            type="button"
                            disabled={busy}
                            onClick={() => void approveUser(user, "user")}
                          >
                            Approve
                          </button>
                          <button
                            className={styles.approveAdmin}
                            type="button"
                            disabled={busy}
                            onClick={() => void approveUser(user, "admin")}
                          >
                            Approve as Admin
                          </button>
                        </>
                      ) : null}
                      <button className={styles.linkButton} type="button" onClick={() => openEdit(user)}>
                        Edit
                      </button>
                      {user.protected ? (
                        <span
                          className={styles.protected}
                          title="The last active Superadmin cannot be blocked or demoted."
                        >
                          Protected
                        </span>
                      ) : (
                        <button
                          className={user.isBlocked ? styles.secondary : styles.danger}
                          type="button"
                          disabled={busy}
                          onClick={() => void changeBlockState(user)}
                        >
                          {user.isBlocked ? "Unblock" : "Block"}
                        </button>
                      )}
                      {user.role === "user" && user.accountStatus === "active" && !user.isBlocked ? (
                        <button
                          className={styles.linkButton}
                          type="button"
                          disabled={busy}
                          onClick={() => openRights(user)}
                        >
                          Rights
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleUsers.length === 0 ? (
            <div className={styles.state}>
              <h3>No users found</h3>
              <p>Try another search or clear the selected filters.</p>
              <button
                className={styles.secondary}
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setSearch("");
                  setRoleFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>

        <div className={styles.footer}>
          <span>
            Showing {visibleUsers.length} of {users.length} users
          </span>
          <span>Approval, role, and status changes are enforced on the server.</span>
        </div>
      </section>

      {modal?.mode === "rights" ? (
        <RightsDialog
          user={{
            id: modal.user.id,
            email: modal.user.email,
            firstName: modal.user.firstName,
            lastName: modal.user.lastName,
          }}
          onClose={() => setModal(null)}
          onSaved={(summary) => {
            setModal(null);
            setNotice(
              `Rights updated: ${summary.granted} granted, ${summary.revoked} revoked, ${summary.total} total.`,
            );
          }}
        />
      ) : modal ? (
        <div className={styles.overlay} role="presentation" onMouseDown={() => setModal(null)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="user-modal-title">
              {modal.mode === "add" ? "Add user" : `Edit ${modal.user.firstName}`}
            </h2>
            <form onSubmit={(event) => void submitModal(event)}>
              <div className={styles.fields}>
                <label className={styles.field}>
                  First name
                  <input
                    value={form.firstName}
                    onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                    autoComplete="off"
                  />
                  {fieldErrors.firstName ? (
                    <span className={styles.fieldError}>{fieldErrors.firstName}</span>
                  ) : null}
                </label>
                <label className={styles.field}>
                  Last name
                  <input
                    value={form.lastName}
                    onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                    autoComplete="off"
                  />
                  {fieldErrors.lastName ? (
                    <span className={styles.fieldError}>{fieldErrors.lastName}</span>
                  ) : null}
                </label>
                {modal.mode === "add" ? (
                  <label className={styles.field}>
                    Email
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      autoComplete="off"
                    />
                    {fieldErrors.email ? (
                      <span className={styles.fieldError}>{fieldErrors.email}</span>
                    ) : null}
                  </label>
                ) : null}
                {managerRole === "superadmin" ? (
                  modal.mode === "edit" && modal.user.protected ? (
                    <div className={styles.field}>
                      Role
                      <input value="Superadmin" readOnly />
                      <span className={styles.fieldNote}>
                        The last active Superadmin cannot be demoted.
                      </span>
                    </div>
                  ) : (
                    <label className={styles.field}>
                      Role
                      <select
                        value={form.role}
                        onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">Superadmin</option>
                      </select>
                      {fieldErrors.role ? (
                        <span className={styles.fieldError}>{fieldErrors.role}</span>
                      ) : null}
                    </label>
                  )
                ) : (
                  <div className={styles.field}>
                    Role
                    <input value="User" readOnly />
                  </div>
                )}
                {fieldErrors.form ? (
                  <span className={styles.fieldError}>{fieldErrors.form}</span>
                ) : null}
              </div>
              <div className={styles.modalActions}>
                <button className={styles.secondary} type="button" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button className={styles.primary} type="submit" disabled={busy}>
                  {busy ? "Saving…" : modal.mode === "add" ? "Add User" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
