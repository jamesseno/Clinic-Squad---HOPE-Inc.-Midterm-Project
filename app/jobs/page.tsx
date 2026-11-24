"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ModuleWorkspace from "@/components/ModuleWorkspace";

interface Job { jobcode: string; jobdesc: string; is_deleted: boolean; stamp: string | null; }

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [permissions, setPermissions] = useState<{ add: boolean; edit: boolean; delete: boolean; canViewDeleted: boolean; canRestore: boolean } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ jobcode: "", jobdesc: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (includeDeleted) params.set("includeDeleted", "true");
      const res = await fetch(`/api/jobs?${params}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) { if (res.status === 401) { router.replace("/"); return; } setError(body.error ?? "Could not load jobs."); return; }
      setJobs(body.jobs ?? []);
      setPermissions(body.permissions ?? null);
    } catch { setError("Could not reach the job service."); }
    finally { setLoading(false); }
  }, [query, includeDeleted, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError(null); setNotice(null);
    try {
      const isEdit = editing !== null;
      const res = await fetch(isEdit ? `/api/jobs/${encodeURIComponent(editing!)}` : "/api/jobs", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { jobdesc: form.jobdesc } : form),
      });
      const body = await res.json();
      if (!res.ok) { setFormError(body.error ?? "Could not save."); return; }
      setFormOpen(false); setNotice(isEdit ? "Job updated." : "Job added.");
      await load();
    } catch { setFormError("Could not reach the service."); }
    finally { setSaving(false); }
  }

  async function changeStatus(job: Job, restore: boolean) {
    if (!restore && !window.confirm(`Delete job ${job.jobcode}?`)) return;
    setNotice(null); setError(null);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(job.jobcode)}`, { method: restore ? "POST" : "DELETE" });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? "Could not change status."); return; }
      setNotice(restore ? "Job restored." : "Job deleted.");
      await load();
    } catch { setError("Could not reach the service."); }
  }

  const page = (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>Jobs</h1>
        {permissions?.add && <button onClick={() => { setEditing(null); setForm({ jobcode: "", jobdesc: "" }); setFormError(null); setFormOpen(true); }}>Add Job</button>}
      </div>
      {notice && <p style={{ color: "green" }}>{notice}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ marginBottom: 12 }}>
        <input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {permissions?.canViewDeleted && <label style={{ marginLeft: 12 }}><input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} /> Show deleted</label>}
      </div>
      {loading ? <p>Loading...</p> : (
        <table border={1} cellPadding={6}>
          <thead><tr><th>Code</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.jobcode} style={{ opacity: j.is_deleted ? 0.5 : 1 }}>
                <td>{j.jobcode}</td><td>{j.jobdesc}</td><td>{j.is_deleted ? "Deleted" : "Active"}</td>
                <td>
                  {!j.is_deleted && permissions?.edit && <button onClick={() => { setEditing(j.jobcode); setForm({ jobcode: j.jobcode, jobdesc: j.jobdesc }); setFormError(null); setFormOpen(true); }}>Edit</button>}
                  {!j.is_deleted && permissions?.delete && <button onClick={() => changeStatus(j, false)} style={{ marginLeft: 4 }}>Delete</button>}
                  {j.is_deleted && permissions?.canRestore && <button onClick={() => changeStatus(j, true)}>Restore</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {formOpen && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3>{editing ? "Edit Job" : "Add Job"}</h3>
          {formError && <p style={{ color: "red" }}>{formError}</p>}
          <form onSubmit={save}>
            {!editing && <div><label>Code: <input value={form.jobcode} onChange={(e) => setForm({ ...form, jobcode: e.target.value })} required maxLength={4} /></label></div>}
            <div><label>Description: <input value={form.jobdesc} onChange={(e) => setForm({ ...form, jobdesc: e.target.value })} required maxLength={20} /></label></div>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setFormOpen(false)} style={{ marginLeft: 8 }}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  );

  return <ModuleWorkspace section="Job">{page}</ModuleWorkspace>;
}
