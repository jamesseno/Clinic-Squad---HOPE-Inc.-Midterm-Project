"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import ModuleWorkspace from "@/components/ModuleWorkspace";

interface AuditEntry {
  audit_id: number;
  table_name: string;
  action: string;
  record_key: string | null;
  old_values: unknown;
  new_values: unknown;
  action_by: string;
  action_at: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const [table, setTable] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (event?: FormEvent<HTMLFormElement>, targetPage = page) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(targetPage) });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (action) params.set("action", action);
      if (table.trim()) params.set("table", table.trim());
      if (actor.trim()) params.set("actor", actor.trim());
      const response = await fetch(`/api/audit?${params}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load audit history.");
      setEntries(body.entries ?? []);
      setPage(body.page);
    } catch (cause) {
      setEntries([]);
      setError(cause instanceof Error ? cause.message : "Could not load audit history.");
    } finally {
      setLoading(false);
    }
  }, [action, actor, from, page, table, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <ModuleWorkspace section="Audit">
      <div>
        <h1>Audit history</h1>
        <p>Restricted to authorized superadmins. Audit entries are read-only.</p>
        <form onSubmit={(event) => void load(event, 1)} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label>
            Action
            <select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">All actions</option>
              <option value="ADD">Add</option>
              <option value="EDIT">Edit</option>
              <option value="DELETE">Delete</option>
              <option value="RESTORE">Restore</option>
            </select>
          </label>
          <label>Table <input maxLength={30} value={table} onChange={(event) => setTable(event.target.value)} /></label>
          <label>Actor <input maxLength={50} value={actor} onChange={(event) => setActor(event.target.value)} /></label>
          <button type="submit" disabled={loading}>Filter</button>
        </form>
        {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
        {loading ? <p>Loading audit history...</p> : (
          <>
            <table border={1} cellPadding={6}>
              <thead><tr><th>When</th><th>Table</th><th>Action</th><th>Record</th><th>Actor</th><th>Old values</th><th>New values</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.audit_id}>
                    <td>{new Date(entry.action_at).toLocaleString()}</td>
                    <td>{entry.table_name}</td>
                    <td>{entry.action}</td>
                    <td>{entry.record_key ?? "—"}</td>
                    <td>{entry.action_by}</td>
                    <td><pre>{entry.old_values ? JSON.stringify(entry.old_values, null, 2) : "—"}</pre></td>
                    <td><pre>{entry.new_values ? JSON.stringify(entry.new_values, null, 2) : "—"}</pre></td>
                  </tr>
                ))}
                {entries.length === 0 && <tr><td colSpan={7}>No audit entries found.</td></tr>}
              </tbody>
            </table>
            <p>
              <button type="button" onClick={() => void load(undefined, Math.max(page - 1, 1))} disabled={loading || page <= 1}>Previous</button>
              <span style={{ margin: "0 12px" }}>Page {page}</span>
              <button type="button" onClick={() => void load(undefined, page + 1)} disabled={loading || entries.length < 100}>Next</button>
            </p>
          </>
        )}
      </div>
    </ModuleWorkspace>
  );
}
