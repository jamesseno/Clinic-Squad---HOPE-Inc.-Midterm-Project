"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ModuleWorkspace from "@/components/ModuleWorkspace";

interface Sale { transno: string; salesdate: string; custno: string | null; empno: string | null; is_deleted: boolean; stamp: string | null; balance: { total_amount: number; paid_amount: number; balance: number } | null; }

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [permissions, setPermissions] = useState<{ add: boolean; edit: boolean; delete: boolean; canViewDeleted: boolean; canRestore: boolean; canViewPayment: boolean; canAddPayment: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (includeDeleted) params.set("includeDeleted", "true");
      const res = await fetch(`/api/sales?${params}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) { if (res.status === 401) { router.replace("/"); return; } setError(body.error ?? "Could not load sales."); return; }
      setSales(body.sales ?? []);
      setPermissions(body.permissions ?? null);
    } catch { setError("Could not reach the sales service."); }
    finally { setLoading(false); }
  }, [query, includeDeleted, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function changeStatus(sale: Sale, restore: boolean) {
    if (!restore && !window.confirm(`Delete sale ${sale.transno}?`)) return;
    setNotice(null); setError(null);
    try {
      const res = await fetch(`/api/sales/${encodeURIComponent(sale.transno)}`, { method: restore ? "POST" : "DELETE" });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? "Could not change status."); return; }
      setNotice(restore ? "Sale restored." : "Sale deleted.");
      await load();
    } catch { setError("Could not reach the service."); }
  }

  const page = (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>Sales</h1>
        {permissions?.add && <button onClick={() => window.location.href = "/sales/new"}>New Sale</button>}
      </div>
      {notice && <p style={{ color: "green" }}>{notice}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ marginBottom: 12 }}>
        <input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {permissions?.canViewDeleted && <label style={{ marginLeft: 12 }}><input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} /> Show deleted</label>}
      </div>
      {loading ? <p>Loading...</p> : (
        <table border={1} cellPadding={6}>
          <thead><tr><th>Trans No</th><th>Date</th><th>Customer</th><th>Employee</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.transno} style={{ opacity: s.is_deleted ? 0.5 : 1 }}>
                <td>{s.transno}</td><td>{s.salesdate}</td><td>{s.custno ?? "-"}</td><td>{s.empno ?? "-"}</td>
                <td>{s.balance?.total_amount?.toFixed(2) ?? "-"}</td>
                <td>{s.balance?.paid_amount?.toFixed(2) ?? "-"}</td>
                <td>{s.balance?.balance?.toFixed(2) ?? "-"}</td>
                <td>{s.is_deleted ? "Deleted" : "Active"}</td>
                <td>
                  <button onClick={() => window.location.href = `/sales/${s.transno}`}>View</button>
                  {!s.is_deleted && permissions?.delete && <button onClick={() => changeStatus(s, false)} style={{ marginLeft: 4 }}>Delete</button>}
                  {s.is_deleted && permissions?.canRestore && <button onClick={() => changeStatus(s, true)} style={{ marginLeft: 4 }}>Restore</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return <ModuleWorkspace section="Sale">{page}</ModuleWorkspace>;
}
