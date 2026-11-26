"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ModuleWorkspace from "@/components/ModuleWorkspace";

interface JobHistory { empno: string; jobcode: string; effdate: string; salary: number | null; deptcode: string | null; is_deleted: boolean; }
interface Employee {
  empno: string; lastname: string; firstname: string; gender: string;
  birthdate: string | null; hiredate: string | null; sepdate: string | null;
  is_deleted: boolean; stamp: string | null;
  currentJob: { jobcode: string; jobdesc: string; deptcode: string | null; deptname: string | null; salary: number | null; effdate: string } | null;
}
interface DepartmentOption { deptcode: string; deptname: string | null; }

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("");
  const [department, setDepartment] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [permissions, setPermissions] = useState<{
    add: boolean; edit: boolean; delete: boolean; canViewDeleted: boolean; canRestore: boolean;
    canViewJobHistory: boolean; canViewSalary: boolean; canAddJobHistory: boolean;
    canEditJobHistory: boolean; canDeleteJobHistory: boolean;
  } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ empno: "", lastname: "", firstname: "", gender: "M", birthdate: "", hiredate: "", sepdate: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileEmp, setProfileEmp] = useState<Employee | null>(null);
  const [jobHistory, setJobHistory] = useState<JobHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState({ jobcode: "", effdate: "", salary: "", deptcode: "" });
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [editingJobHistory, setEditingJobHistory] = useState<JobHistory | null>(null);
  const [jobSaving, setJobSaving] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (gender) params.set("gender", gender);
      if (department) params.set("dept", department);
      if (includeDeleted) params.set("includeDeleted", "true");
      const res = await fetch(`/api/employees?${params}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) { if (res.status === 401) { router.replace("/"); return; } setError(body.error ?? "Could not load employees."); return; }
      setEmployees(body.employees ?? []);
      setPermissions(body.permissions ?? null);
      setDepartmentOptions(body.departments ?? []);
    } catch { setError("Could not reach the employee service."); }
    finally { setLoading(false); }
  }, [query, gender, department, includeDeleted, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function openProfile(emp: Employee) {
    setProfileEmp(emp);
    setHistoryLoading(true);
    setHistoryError(null);
    setJobHistory([]);
    if (!permissions?.canViewJobHistory) {
      setHistoryError("You do not have the View Job History right.");
      setHistoryLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(emp.empno)}/jobs`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 401) { router.replace("/"); return; }
        setHistoryError(body.error ?? "Could not load job history.");
        return;
      }
      setJobHistory(body.jobs ?? []);
    } catch { setHistoryError("Could not reach the job history service."); }
    finally { setHistoryLoading(false); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError(null); setNotice(null);
    try {
      const isEdit = editing !== null;
      const res = await fetch(isEdit ? `/api/employees/${encodeURIComponent(editing!)}` : "/api/employees", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit
          ? { lastname: form.lastname, firstname: form.firstname, gender: form.gender, birthdate: form.birthdate, hiredate: form.hiredate, sepdate: form.sepdate }
          : form),
      });
      const body = await res.json();
      if (!res.ok) { setFormError(body.error ?? "Could not save."); return; }
      setFormOpen(false); setNotice(isEdit ? "Employee updated." : "Employee added.");
      await load();
    } catch { setFormError("Could not reach the service."); }
    finally { setSaving(false); }
  }

  async function changeStatus(emp: Employee, restore: boolean) {
    if (!restore && !window.confirm(`Delete employee ${emp.empno}?`)) return;
    setNotice(null); setError(null);
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(emp.empno)}`, { method: restore ? "POST" : "DELETE" });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? "Could not change status."); return; }
      setNotice(restore ? "Employee restored." : "Employee deleted.");
      await load();
      if (profileEmp?.empno === emp.empno) setProfileEmp(null);
    } catch { setError("Could not reach the service."); }
  }

  async function saveJobHistory(e: React.FormEvent) {
    e.preventDefault();
    if (!profileEmp) return;
    setJobSaving(true); setJobError(null);
    try {
      const isEdit = editingJobHistory !== null;
      const url = isEdit
        ? `/api/employees/${encodeURIComponent(profileEmp.empno)}/jobs/${encodeURIComponent(editingJobHistory.jobcode)}/${encodeURIComponent(editingJobHistory.effdate)}`
        : `/api/employees/${encodeURIComponent(profileEmp.empno)}/jobs`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobcode: jobForm.jobcode, effdate: jobForm.effdate, salary: Number(jobForm.salary), deptcode: jobForm.deptcode || null }),
      });
      const body = await res.json();
      if (!res.ok) { setJobError(body.error ?? "Could not add job history."); return; }
      setJobFormOpen(false); setEditingJobHistory(null); setJobForm({ jobcode: "", effdate: "", salary: "", deptcode: "" });
      await openProfile(profileEmp);
    } catch { setJobError("Could not reach the service."); }
    finally { setJobSaving(false); }
  }

  async function changeJobHistoryStatus(jh: JobHistory, restore: boolean) {
    if (!profileEmp || (!restore && !window.confirm("Delete this job history entry?"))) return;
    setJobError(null);
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(profileEmp.empno)}/jobs/${encodeURIComponent(jh.jobcode)}/${encodeURIComponent(jh.effdate)}`, { method: restore ? "POST" : "DELETE" });
      const body = await res.json();
      if (!res.ok) { setJobError(body.error ?? "Could not change job history status."); return; }
      await openProfile(profileEmp);
    } catch { setJobError("Could not reach the service."); }
  }

  const page = (
    <div>
      {profileEmp ? (
        <div>
          <button onClick={() => setProfileEmp(null)} style={{ marginBottom: 12 }}>← Back to list</button>
          <h2>{profileEmp.firstname} {profileEmp.lastname} ({profileEmp.empno})</h2>
          <p>Gender: {profileEmp.gender} | Hired: {profileEmp.hiredate} | {profileEmp.sepdate ? `Separated: ${profileEmp.sepdate}` : "Active"}</p>
          <h3>Job History / Timeline</h3>
          {permissions?.canAddJobHistory && <button onClick={() => { setEditingJobHistory(null); setJobFormOpen(true); setJobForm({ jobcode: "", effdate: "", salary: "", deptcode: "" }); setJobError(null); }}>Add Entry</button>}
          {jobError && <p style={{ color: "red" }}>{jobError}</p>}
          {jobFormOpen && (
            <div style={{ marginTop: 8, padding: 8, border: "1px solid #ccc" }}>
              <h4>{editingJobHistory ? "Edit Job History Entry" : "Add Job History Entry"}</h4>
              <form onSubmit={saveJobHistory}>
                <div><label>Job Code: <input value={jobForm.jobcode} onChange={(e) => setJobForm({ ...jobForm, jobcode: e.target.value })} required maxLength={4} /></label></div>
                <div><label>Effective Date: <input type="date" value={jobForm.effdate} onChange={(e) => setJobForm({ ...jobForm, effdate: e.target.value })} required /></label></div>
                <div><label>Salary: <input type="number" value={jobForm.salary} onChange={(e) => setJobForm({ ...jobForm, salary: e.target.value })} required min={0} step="0.01" /></label></div>
                <div><label>Dept Code: <input value={jobForm.deptcode} onChange={(e) => setJobForm({ ...jobForm, deptcode: e.target.value })} maxLength={3} /></label></div>
                <button type="submit" disabled={jobSaving}>{jobSaving ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => { setJobFormOpen(false); setEditingJobHistory(null); }} style={{ marginLeft: 8 }}>Cancel</button>
              </form>
            </div>
          )}
          {historyLoading && <p>Loading job history...</p>}
          {historyError && <p role="alert" style={{ color: "red" }}>{historyError}</p>}
          {!historyLoading && !historyError && permissions?.canViewJobHistory && (
            jobHistory.length === 0 ? <p>No job history entries found.</p> : (
              <table border={1} cellPadding={6} style={{ marginTop: 8 }}>
                <thead><tr><th>Effective Date</th><th>Job</th><th>Department</th><th>Salary</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {jobHistory.map((jh) => (
                    <tr key={`${jh.jobcode}-${jh.effdate}`} style={{ opacity: jh.is_deleted ? 0.5 : 1 }}>
                      <td>{jh.effdate}</td><td>{jh.jobcode}</td><td>{jh.deptcode ?? "-"}</td>
                      <td>{permissions.canViewSalary ? jh.salary : "—"}</td><td>{jh.is_deleted ? "Deleted" : "Active"}</td>
                      <td>
                        {!jh.is_deleted && permissions.canEditJobHistory && <button onClick={() => {
                          setEditingJobHistory(jh);
                          setJobForm({ jobcode: jh.jobcode, effdate: jh.effdate, salary: jh.salary === null ? "" : String(jh.salary), deptcode: jh.deptcode ?? "" });
                          setJobFormOpen(true); setJobError(null);
                        }}>Edit</button>}
                        {!jh.is_deleted && permissions.canDeleteJobHistory && <button onClick={() => changeJobHistoryStatus(jh, false)} style={{ marginLeft: 4 }}>Delete</button>}
                        {jh.is_deleted && permissions.canDeleteJobHistory && <button onClick={() => changeJobHistoryStatus(jh, true)}>Restore</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h1>Employees</h1>
            {permissions?.add && <button onClick={() => { setEditing(null); setForm({ empno: "", lastname: "", firstname: "", gender: "M", birthdate: "", hiredate: "", sepdate: "" }); setFormError(null); setFormOpen(true); }}>Add Employee</button>}
          </div>
          {notice && <p style={{ color: "green" }}>{notice}</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}
          <div style={{ marginBottom: 12 }}>
            <input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="">All genders</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            {permissions?.canViewJobHistory && <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="">All departments</option>
              {departmentOptions.map((option) => <option key={option.deptcode} value={option.deptcode}>{option.deptcode} — {option.deptname ?? option.deptcode}</option>)}
            </select>}
            {permissions?.canViewDeleted && <label style={{ marginLeft: 12 }}><input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} /> Show deleted</label>}
          </div>
          {loading ? <p>Loading...</p> : (
            employees.length === 0 ? <p>No employees match the current filters.</p> : (
              <table border={1} cellPadding={6}>
                <thead><tr><th>Emp No</th><th>Name</th><th>Gender</th><th>Separation Date</th><th>Current Job</th><th>Department</th><th>Actions</th></tr></thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.empno} style={{ opacity: emp.is_deleted ? 0.5 : 1 }}>
                      <td>{emp.empno}</td><td>{emp.firstname} {emp.lastname}</td><td>{emp.gender}</td><td>{emp.sepdate ?? "—"}</td>
                      <td>{emp.currentJob?.jobdesc ?? "-"}</td>
                      <td>{emp.currentJob?.deptname ?? "-"}</td>
                      <td>
                        <button onClick={() => openProfile(emp)}>Profile</button>
                        {!emp.is_deleted && permissions?.edit && <button onClick={() => { setEditing(emp.empno); setForm({ empno: emp.empno, lastname: emp.lastname, firstname: emp.firstname, gender: emp.gender, birthdate: emp.birthdate ?? "", hiredate: emp.hiredate ?? "", sepdate: emp.sepdate ?? "" }); setFormError(null); setFormOpen(true); }} style={{ marginLeft: 4 }}>Edit</button>}
                        {!emp.is_deleted && permissions?.delete && <button onClick={() => changeStatus(emp, false)} style={{ marginLeft: 4 }}>Delete</button>}
                        {emp.is_deleted && permissions?.canRestore && <button onClick={() => changeStatus(emp, true)} style={{ marginLeft: 4 }}>Restore</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {formOpen && (
            <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
              <h3>{editing ? "Edit Employee" : "Add Employee"}</h3>
              {formError && <p style={{ color: "red" }}>{formError}</p>}
              <form onSubmit={save}>
                {!editing && <div><label>Emp No: <input value={form.empno} onChange={(e) => setForm({ ...form, empno: e.target.value })} required maxLength={5} /></label></div>}
                <div><label>Last Name: <input value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} required maxLength={15} /></label></div>
                <div><label>First Name: <input value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} required maxLength={15} /></label></div>
                <div><label>Gender: <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="M">M</option><option value="F">F</option></select></label></div>
                <div><label>Birth Date: <input type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} /></label></div>
                <div><label>Hire Date: <input type="date" value={form.hiredate} onChange={(e) => setForm({ ...form, hiredate: e.target.value })} /></label></div>
                <div><label>Separation Date: <input type="date" value={form.sepdate} onChange={(e) => setForm({ ...form, sepdate: e.target.value })} /></label></div>
                <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => setFormOpen(false)} style={{ marginLeft: 8 }}>Cancel</button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return <ModuleWorkspace section="Employee">{page}</ModuleWorkspace>;
}
