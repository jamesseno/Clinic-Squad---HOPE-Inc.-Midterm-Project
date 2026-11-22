"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import ModuleWorkspace from "@/components/ModuleWorkspace";
import styles from "@/components/ModuleWorkspace.module.css";
import { useRouter } from "next/navigation";

interface Customer {
  custno: string;
  custname: string | null;
  address: string | null;
  payterm: "COD" | "30D" | "45D" | null;
  is_deleted: boolean;
  stamp: string | null;
}

interface CustomerPermissions {
  add: boolean;
  edit: boolean;
  delete: boolean;
  canViewDeleted: boolean;
  canRestore: boolean;
}

interface CustomerForm {
  custno: string;
  custname: string;
  address: string;
  payterm: "COD" | "30D" | "45D";
}

interface CustomerResponse {
  customers?: Customer[];
  permissions?: CustomerPermissions;
  error?: string;
  fieldErrors?: Record<string, string>;
  customer?: Customer;
}

const emptyForm: CustomerForm = { custno: "", custname: "", address: "", payterm: "COD" };

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [permissions, setPermissions] = useState<CustomerPermissions | null>(null);
  const [query, setQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (includeDeleted) params.set("includeDeleted", "true");
      const response = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
      const body = (await response.json()) as CustomerResponse;
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/");
          return;
        }
        setError(body.error ?? "Could not load customers.");
        return;
      }
      setCustomers(body.customers ?? []);
      setPermissions(body.permissions ?? null);
    } catch {
      setError("Could not reach the customer service.");
    } finally {
      setLoading(false);
    }
  }, [includeDeleted, query, router]);

  useEffect(() => {
    // Load records after the page mounts and whenever filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCustomers();
  }, [loadCustomers]);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function startEdit(customer: Customer) {
    setEditing(customer.custno);
    setForm({
      custno: customer.custno,
      custname: customer.custname ?? "",
      address: customer.address ?? "",
      payterm: customer.payterm ?? "COD",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const isEditing = editing !== null;
      const response = await fetch(
        isEditing ? `/api/customers/${encodeURIComponent(editing)}` : "/api/customers",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEditing
              ? { custname: form.custname, address: form.address, payterm: form.payterm }
              : form,
          ),
        },
      );
      const body = (await response.json()) as CustomerResponse;
      if (!response.ok) {
        setFormError(body.error ?? "Could not save this customer.");
        return;
      }
      setFormOpen(false);
      setNotice(isEditing ? "Customer updated." : "Customer added.");
      await loadCustomers();
    } catch {
      setFormError("Could not reach the customer service.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(customer: Customer, restore: boolean) {
    const action = restore ? "restore" : "soft-delete";
    if (!restore && !window.confirm(`Move ${customer.custno} to deleted customers?`)) return;
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(customer.custno)}`, {
        method: restore ? "POST" : "DELETE",
      });
      const body = (await response.json()) as CustomerResponse;
      if (!response.ok) {
        setError(body.error ?? `Could not ${action} this customer.`);
        return;
      }
      setNotice(restore ? "Customer restored." : "Customer moved to deleted records.");
      await loadCustomers();
    } catch {
      setError("Could not reach the customer service.");
    }
  }

  const page = (
    <>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>WORKSPACE / CUSTOMER</p>
          <h1>Customer management</h1>
          <p>Search, maintain, and review customer payment terms.</p>
        </div>
        {permissions?.add && (
          <button className={styles.primary} type="button" onClick={startCreate}>Add customer</button>
        )}
      </div>

      <section className={styles.card} aria-labelledby="customers-title">
        <div className={styles.cardHeading}>
          <div>
            <h2 id="customers-title">Customers</h2>
            <p>{customers.length} record{customers.length === 1 ? "" : "s"} shown</p>
          </div>
        </div>
        <div className={styles.toolbar}>
          <label className={styles.field} htmlFor="customer-search">
            Search customers
            <input
              className={styles.search}
              id="customer-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Code, name, or address"
            />
          </label>
          {permissions?.canViewDeleted && (
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => setIncludeDeleted(event.target.checked)}
              />
              Include deleted
            </label>
          )}
        </div>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {loading ? (
          <p className={styles.empty}>Loading customers...</p>
        ) : customers.length === 0 ? (
          <p className={styles.empty}>No customers match your search.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Address</th>
                  <th scope="col">Payment term</th>
                  <th scope="col">Audit stamp</th>
                  <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.custno}>
                    <td><strong>{customer.custno}</strong></td>
                    <td>{customer.custname || <span className={styles.muted}>Not provided</span>}</td>
                    <td>{customer.address || <span className={styles.muted}>Not provided</span>}</td>
                    <td>{customer.payterm ?? "—"}</td>
                    <td className={styles.muted}>{customer.stamp ?? "—"}</td>
                    <td>
                      <div className={styles.actions}>
                        {!customer.is_deleted && permissions?.edit && (
                          <button className={styles.smallButton} type="button" onClick={() => startEdit(customer)}>
                            Edit
                          </button>
                        )}
                        {customer.is_deleted && permissions?.delete ? (
                          <button className={styles.smallButton} type="button" onClick={() => void changeStatus(customer, true)}>
                            Restore
                          </button>
                        ) : !customer.is_deleted && permissions?.delete ? (
                          <button className={styles.danger} type="button" onClick={() => void changeStatus(customer, false)}>
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
            <div className={styles.modalHeading}>
              <div>
                <p className={styles.eyebrow}>{editing ? "EDIT RECORD" : "NEW RECORD"}</p>
                <h2 id="customer-form-title">{editing ? "Edit customer" : "Add customer"}</h2>
              </div>
              <button className={styles.secondary} type="button" onClick={() => setFormOpen(false)}>Close</button>
            </div>
            {formError && <p className={styles.error} role="alert">{formError}</p>}
            <form className={styles.form} onSubmit={saveCustomer}>
              {!editing && (
                <label className={styles.field}>
                  Customer code
                  <input
                    required
                    maxLength={5}
                    value={form.custno}
                    onChange={(event) => setForm({ ...form, custno: event.target.value })}
                    autoComplete="off"
                  />
                </label>
              )}
              <label className={styles.field}>
                Customer name
                <input
                  required
                  maxLength={20}
                  value={form.custname}
                  onChange={(event) => setForm({ ...form, custname: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                Address
                <input
                  required
                  maxLength={50}
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                Payment term
                <select
                  value={form.payterm}
                  onChange={(event) => setForm({ ...form, payterm: event.target.value as CustomerForm["payterm"] })}
                >
                  <option value="COD">COD</option>
                  <option value="30D">30 days</option>
                  <option value="45D">45 days</option>
                </select>
              </label>
              <div className={styles.formActions}>
                <button className={styles.secondary} type="button" onClick={() => setFormOpen(false)}>Cancel</button>
                <button className={styles.primary} type="submit" disabled={saving}>
                  {saving ? "Saving..." : editing ? "Save changes" : "Add customer"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );

  return <ModuleWorkspace section="Customer">{page}</ModuleWorkspace>;
}
