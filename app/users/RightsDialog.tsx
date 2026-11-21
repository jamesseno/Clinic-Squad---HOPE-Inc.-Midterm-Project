"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Users.module.css";

interface RightsRight {
  id: number;
  code: string;
  name: string;
}

interface RightsModule {
  id: number;
  code: string;
  name: string;
  rights: RightsRight[];
}

interface RightsUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface RightsResponse {
  user?: RightsUser;
  modules?: RightsModule[];
  grantedRightIds?: number[];
  error?: string;
}

interface SaveResponse {
  granted?: number;
  revoked?: number;
  total?: number;
  error?: string;
}

interface RightsDialogProps {
  user: RightsUser;
  onClose: () => void;
  onSaved: (summary: { granted: number; revoked: number; total: number }) => void;
}

export default function RightsDialog({ user, onClose, onSaved }: RightsDialogProps) {
  const [modules, setModules] = useState<RightsModule[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const loadRights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/rights`, {
        cache: "no-store",
      });
      const body = (await response.json()) as RightsResponse;

      if (!response.ok) {
        setError(body.error ?? "Could not load this user's rights.");
        return;
      }

      const granted = new Set(body.grantedRightIds ?? []);
      setModules(body.modules ?? []);
      setSaved(granted);
      setDraft(new Set(granted));
    } catch {
      setError("Could not reach the rights service.");
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    // Initial fetch: state updates happen after the network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRights();
  }, [loadRights]);

  const dirty = useMemo(() => {
    if (draft.size !== saved.size) return true;
    for (const id of draft) {
      if (!saved.has(id)) return true;
    }
    return false;
  }, [draft, saved]);

  const closeSafely = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm("Discard unsaved rights changes?")) return;
    onClose();
  }, [dirty, onClose, saving]);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSafely();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSafely]);

  function toggleRight(rightId: number) {
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(rightId)) next.delete(rightId);
      else next.add(rightId);
      return next;
    });
  }

  function setModule(module: RightsModule, selected: boolean) {
    setDraft((current) => {
      const next = new Set(current);
      for (const right of module.rights) {
        if (selected) next.add(right.id);
        else next.delete(right.id);
      }
      return next;
    });
  }

  function selectAll() {
    setDraft(new Set(modules.flatMap((module) => module.rights.map((right) => right.id))));
  }

  function clearAll() {
    setDraft(new Set());
  }

  function reset() {
    setDraft(new Set(saved));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/rights`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rightIds: [...draft] }),
      });
      const body = (await response.json()) as SaveResponse;

      if (!response.ok) {
        setError(body.error ?? "Could not save the selected rights.");
        return;
      }

      onSaved({
        granted: body.granted ?? 0,
        revoked: body.revoked ?? 0,
        total: body.total ?? draft.size,
      });
    } catch {
      setError("Could not reach the rights service.");
    } finally {
      setSaving(false);
    }
  }

  const totalRights = modules.reduce((sum, module) => sum + module.rights.length, 0);

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={closeSafely}>
      <section
        ref={dialogRef}
        className={`${styles.modal} ${styles.modalWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rights-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.rightsHeader}>
          <div>
            <p className={styles.eyebrow}>USER ACCESS</p>
            <h2 id="rights-dialog-title">Manage rights</h2>
            <p className={styles.rightsContext}>
              {user.firstName} {user.lastName} · {user.email}
            </p>
          </div>
          <button
            ref={closeRef}
            className={styles.iconButton}
            type="button"
            aria-label="Close rights dialog"
            onClick={closeSafely}
            disabled={saving}
          >
            ×
          </button>
        </header>

        <div className={styles.rightsToolbar}>
          <span>
            <strong>Module permissions</strong>
            <small>Choose the actions this user can perform.</small>
          </span>
          <div className={styles.toolbarActions}>
            <button
              className={styles.linkButton}
              type="button"
              onClick={selectAll}
              disabled={loading || saving || modules.length === 0}
            >
              Select all
            </button>
            <button
              className={styles.linkButton}
              type="button"
              onClick={clearAll}
              disabled={loading || saving || draft.size === 0}
            >
              Clear all
            </button>
            <button
              className={styles.linkButton}
              type="button"
              onClick={reset}
              disabled={loading || saving || !dirty}
            >
              Reset
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.rightsState} role="status">
            <h3>Loading rights…</h3>
            <p>Reading the rights catalogue and this user&apos;s current access.</p>
          </div>
        ) : null}

        {!loading && error && modules.length === 0 ? (
          <div className={styles.rightsState}>
            <h3>Could not load rights</h3>
            <p>{error}</p>
            <button className={styles.secondary} type="button" onClick={() => void loadRights()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && modules.length > 0 ? (
          <div className={styles.permissionGroups}>
            {modules.map((module) => {
              const selected = module.rights.filter((right) => draft.has(right.id)).length;
              const allSelected = module.rights.length > 0 && selected === module.rights.length;
              const someSelected = selected > 0 && !allSelected;

              return (
                <fieldset className={styles.permissionGroup} key={module.id}>
                  <legend className={styles.permissionLegend}>
                    <label className={styles.moduleHead}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(element) => {
                          if (element) element.indeterminate = someSelected;
                        }}
                        onChange={() => setModule(module, !allSelected)}
                        disabled={saving}
                        aria-label={`Select all ${module.name} rights`}
                      />
                      <span className={styles.moduleTitle}>{module.name}</span>
                      <span className={styles.moduleCount}>
                        {selected}/{module.rights.length}
                      </span>
                    </label>
                  </legend>

                  <div className={styles.moduleActions}>
                    <button
                      className={styles.moduleAction}
                      type="button"
                      onClick={() => setModule(module, true)}
                      disabled={saving || allSelected}
                    >
                      All
                    </button>
                    <button
                      className={styles.moduleAction}
                      type="button"
                      onClick={() => setModule(module, false)}
                      disabled={saving || selected === 0}
                    >
                      None
                    </button>
                  </div>

                  <div className={styles.permissionList}>
                    {module.rights.map((right) => (
                      <label className={styles.permissionCheck} key={right.id}>
                        <input
                          type="checkbox"
                          checked={draft.has(right.id)}
                          onChange={() => toggleRight(right.id)}
                          disabled={saving}
                        />
                        <span>{right.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        ) : null}

        <div className={styles.guardrailNotes}>
          <strong>Access guardrails</strong>
          <ul>
            <li>Rights can only be managed for active, unblocked standard User accounts.</li>
            <li>Admin and Superadmin accounts keep the access granted by their role.</li>
            <li>Zero rights is allowed; the user simply sees no module tiles.</li>
            <li>
              Every saved change is written to <code>audit_log</code> with the acting
              manager.
            </li>
          </ul>
          {error && modules.length > 0 ? (
            <p className={styles.rightsValidation} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className={styles.rightsFooter}>
          <span className={styles.rightsSummary}>
            {draft.size} of {totalRights} rights selected
            {dirty ? " · unsaved changes" : ""}
          </span>
          <div className={styles.modalActions}>
            <button className={styles.secondary} type="button" onClick={closeSafely} disabled={saving}>
              Cancel
            </button>
            <button
              className={styles.primary}
              type="button"
              onClick={() => void save()}
              disabled={loading || saving || modules.length === 0 || !dirty}
            >
              {saving ? "Saving…" : "Save rights"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
