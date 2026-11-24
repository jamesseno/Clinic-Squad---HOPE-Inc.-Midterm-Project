"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ModuleWorkspace from "@/components/ModuleWorkspace";

interface Department { deptcode: string; deptname: string; is_deleted: boolean; stamp: string | null; }

export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [permissions, setPermissions] = useState<{ add: boolean; edit: boolean; delete: boolean; canViewDeleted: boolean; canRestore: boolean } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ deptcode: "", deptname: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (includeDeleted) params.set("includeDeleted", "true");
      const res = await fetch(`/api/departments?${params}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) { if (res.status === 401) { router.replace("/"); return; } setError(body.error ?? "Could not load departments."); return; }
      setDepartments(body.departments ?? []);
      setPermissions(body.permissions ?? null);
    } catch { setError("Could not reach the department service."); }
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
      const res = await fetch(isEdit ? `/api/departments/${encodeURIComponent(editing!)}` : "/api/departments", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { deptname: form.deptname } : form),
      });
      const body = await res.json();
      if (!res.ok) { setFormError(body.error ?? "Could not save."); return; }
      setFormOpen(false); setNotice(isEdit ? "Department updated." : "Department added.");
      await load();
    } catch { setFormError("Could not reach the service."); }
    finally { setSaving(false); }
  }

  async function changeStatus(dept: Department, restore: boolean) {
    if (!restore && !window.confirm(`Delete department ${dept.deptcode}?`)) return;
    setNotice(null); setError(null);
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(dept.deptcode)}`, { method: restore ? "POST" : "DELETE" });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? "Could not change status."); return; }
      setNotice(restore ? "Department restored." : "Department deleted.");
      await load();
    } catch { setError("Could not reach the service."); }
  }

  const page = (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>Departments</h1>
        {permissions?.add && <button onClick={() => { setEditing(null); setForm({ deptcode: "", deptname: "" }); setFormError(null); setFormOpen(true); }}>Add Department</button>}
      </div>
      {notice && <p style={{ color: "green" }}>{notice}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ marginBottom: 12 }}>
        <input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {permissions?.canViewDeleted && <label style={{ marginLeft: 12 }}><input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} /> Show deleted</label>}
      </div>
      {loading ? <p>Loading...</p> : (
        <table border={1} cellPadding={6}>
          <thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.deptcode} style={{ opacity: d.is_deleted ? 0.5 : 1 }}>
                <td>{d.deptcode}</td><td>{d.deptname}</td><td>{d.is_deleted ? "Deleted" : "Active"}</td>
                <td>
                  {!d.is_deleted && permissions?.edit && <button onClick={() => { setEditing(d.deptcode); setForm({ deptcode: d.deptcode, deptname: d.deptname }); setFormError(null); setFormOpen(true); }}>Edit</button>}
                  {!d.is_deleted && permissions?.delete && <button onClick={() => changeStatus(d, false)} style={{ marginLeft: 4 }}>Delete</button>}
                  {d.is_deleted && permissions?.canRestore && <button onClick={() => changeStatus(d, true)}>Restore</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {formOpen && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3>{editing ? "Edit Department" : "Add Department"}</h3>
          {formError && <p style={{ color: "red" }}>{formError}</p>}
          <form onSubmit={save}>
            {!editing && <div><label>Code: <input value={form.deptcode} onChange={(e) => setForm({ ...form, deptcode: e.target.value })} required maxLength={3} /></label></div>}
            <div><label>Name: <input value={form.deptname} onChange={(e) => setForm({ ...form, deptname: e.target.value })} required maxLength={20} /></label></div>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setFormOpen(false)} style={{ marginLeft: 8 }}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  );

  return <ModuleWorkspace section="Department">{page}</ModuleWorkspace>;
}
