"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import ModuleWorkspace from "@/components/ModuleWorkspace";
import styles from "@/components/ModuleWorkspace.module.css";
import { useRouter } from "next/navigation";

interface Product {
  prodcode: string;
  description: string | null;
  unit: "pc" | "ea" | "mtr" | "pkg" | "ltr" | null;
  is_deleted: boolean;
  stamp: string | null;
  currentPrice: { effdate: string; unitprice: number } | null;
}

interface ProductPermissions {
  add: boolean;
  edit: boolean;
  delete: boolean;
  canViewDeleted: boolean;
  canViewPrices: boolean;
  addPrice: boolean;
  editPrice: boolean;
  deletePrice: boolean;
  canRestore: boolean;
}

interface ProductForm {
  prodcode: string;
  description: string;
  unit: "pc" | "ea" | "mtr" | "pkg" | "ltr";
}

interface Price {
  prodcode: string;
  effdate: string;
  unitprice: number;
  is_deleted: boolean;
  stamp: string | null;
}

interface ProductResponse {
  products?: Product[];
  permissions?: ProductPermissions;
  error?: string;
  fieldErrors?: Record<string, string>;
  product?: Product;
}

interface PriceResponse {
  prices?: Price[];
  permissions?: Pick<ProductPermissions, "addPrice" | "editPrice" | "deletePrice">;
  error?: string;
  fieldErrors?: Record<string, string>;
}

interface PriceForm {
  effdate: string;
  unitprice: string;
}

const emptyProduct: ProductForm = { prodcode: "", description: "", unit: "pc" };
const today = new Date().toISOString().slice(0, 10);

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [permissions, setPermissions] = useState<ProductPermissions | null>(null);
  const [query, setQuery] = useState("");
  const [asOf, setAsOf] = useState(today);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [pricePermissions, setPricePermissions] = useState<PriceResponse["permissions"] | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceForm, setPriceForm] = useState<PriceForm>({ effdate: today, unitprice: "" });
  const [editingPriceDate, setEditingPriceDate] = useState<string | null>(null);
  const [priceFormOpen, setPriceFormOpen] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ asOf });
      if (query.trim()) params.set("q", query.trim());
      if (includeDeleted) params.set("includeDeleted", "true");
      const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      const body = (await response.json()) as ProductResponse;
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/");
          return;
        }
        setError(body.error ?? "Could not load products.");
        return;
      }
      setProducts(body.products ?? []);
      setPermissions(body.permissions ?? null);
    } catch {
      setError("Could not reach the product service.");
    } finally {
      setLoading(false);
    }
  }, [asOf, includeDeleted, query, router]);

  useEffect(() => {
    // Load records after the page mounts and whenever filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts();
  }, [loadProducts]);

  async function loadPrices(product: Product) {
    setPriceLoading(true);
    setPriceError(null);
    setPrices([]);
    try {
      const params = includeDeleted ? "?includeDeleted=true" : "";
      const response = await fetch(
        `/api/products/${encodeURIComponent(product.prodcode)}/prices${params}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as PriceResponse;
      if (!response.ok) {
        setPriceError(body.error ?? "Could not load price history.");
        return;
      }
      setPrices(body.prices ?? []);
      setPricePermissions(body.permissions ?? null);
    } catch {
      setPriceError("Could not reach the price history service.");
    } finally {
      setPriceLoading(false);
    }
  }

  function startProductCreate() {
    setEditingProduct(null);
    setProductForm(emptyProduct);
    setFormError(null);
    setProductFormOpen(true);
  }

  function startProductEdit(product: Product) {
    setEditingProduct(product.prodcode);
    setProductForm({
      prodcode: product.prodcode,
      description: product.description ?? "",
      unit: product.unit ?? "pc",
    });
    setFormError(null);
    setProductFormOpen(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const isEditing = editingProduct !== null;
      const response = await fetch(
        isEditing ? `/api/products/${encodeURIComponent(editingProduct)}` : "/api/products",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEditing
              ? { description: productForm.description, unit: productForm.unit }
              : productForm,
          ),
        },
      );
      const body = (await response.json()) as ProductResponse;
      if (!response.ok) {
        setFormError(body.error ?? "Could not save this product.");
        return;
      }
      setProductFormOpen(false);
      setNotice(isEditing ? "Product updated." : "Product added.");
      await loadProducts();
    } catch {
      setFormError("Could not reach the product service.");
    } finally {
      setSaving(false);
    }
  }

  async function changeProductStatus(product: Product, restore: boolean) {
    if (!restore && !window.confirm(`Move ${product.prodcode} to deleted products?`)) return;
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.prodcode)}`, {
        method: restore ? "POST" : "DELETE",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not change the product status.");
        return;
      }
      setNotice(restore ? "Product restored." : "Product moved to deleted records.");
      await loadProducts();
    } catch {
      setError("Could not reach the product service.");
    }
  }

  function openPriceHistory(product: Product) {
    setSelectedProduct(product);
    setPriceFormOpen(false);
    setEditingPriceDate(null);
    setPriceForm({ effdate: today, unitprice: "" });
    setPriceError(null);
    void loadPrices(product);
  }

  function startPriceCreate() {
    setEditingPriceDate(null);
    setPriceForm({ effdate: today, unitprice: "" });
    setPriceError(null);
    setPriceFormOpen(true);
  }

  function startPriceEdit(price: Price) {
    setEditingPriceDate(price.effdate);
    setPriceForm({ effdate: price.effdate, unitprice: String(price.unitprice) });
    setPriceError(null);
    setPriceFormOpen(true);
  }

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct) return;
    setSaving(true);
    setPriceError(null);
    try {
      const isEditing = editingPriceDate !== null;
      const base = `/api/products/${encodeURIComponent(selectedProduct.prodcode)}/prices`;
      const response = await fetch(
        isEditing ? `${base}/${encodeURIComponent(editingPriceDate)}` : base,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ effdate: priceForm.effdate, unitprice: Number(priceForm.unitprice) }),
        },
      );
      const body = (await response.json()) as PriceResponse;
      if (!response.ok) {
        setPriceError(body.error ?? "Could not save this price.");
        return;
      }
      setPriceFormOpen(false);
      await loadPrices(selectedProduct);
      await loadProducts();
    } catch {
      setPriceError("Could not reach the price history service.");
    } finally {
      setSaving(false);
    }
  }

  async function changePriceStatus(price: Price, restore: boolean) {
    if (!selectedProduct) return;
    if (!restore && !window.confirm(`Delete the price effective ${price.effdate}?`)) return;
    setPriceError(null);
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(price.prodcode)}/prices/${encodeURIComponent(price.effdate)}`,
        { method: restore ? "POST" : "DELETE" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPriceError(body.error ?? "Could not change the price status.");
        return;
      }
      await loadPrices(selectedProduct);
      await loadProducts();
    } catch {
      setPriceError("Could not reach the price history service.");
    }
  }

  const content = (
    <>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>WORKSPACE / PRODUCT</p>
          <h1>Product &amp; price management</h1>
          <p>Maintain products, review price history, and check prices as of a date.</p>
        </div>
        {permissions?.add && (
          <button className={styles.primary} type="button" onClick={startProductCreate}>Add product</button>
        )}
      </div>

      <section className={styles.card} aria-labelledby="products-title">
        <div className={styles.cardHeading}>
          <div>
            <h2 id="products-title">Products</h2>
            <p>{products.length} record{products.length === 1 ? "" : "s"} shown</p>
          </div>
        </div>
        <div className={styles.toolbar}>
          <label className={styles.field} htmlFor="product-search">
            Search products
            <input
              className={styles.search}
              id="product-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Code or description"
            />
          </label>
          <label className={styles.field} htmlFor="price-as-of">
            Price as of
            <input id="price-as-of" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
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
          <p className={styles.empty}>Loading products...</p>
        ) : products.length === 0 ? (
          <p className={styles.empty}>No products match your search.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Product</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Price as of {asOf}</th>
                  <th scope="col">Audit stamp</th>
                  <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.prodcode}>
                    <td><strong>{product.prodcode}</strong></td>
                    <td>{product.description || <span className={styles.muted}>Not provided</span>}</td>
                    <td>{product.unit ?? "—"}</td>
                    <td>
                      {product.currentPrice
                        ? `${Number(product.currentPrice.unitprice).toFixed(2)} (${product.currentPrice.effdate})`
                        : "—"}
                    </td>
                    <td className={styles.muted}>{product.stamp ?? "—"}</td>
                    <td>
                      <div className={styles.actions}>
                        {permissions?.canViewPrices && (
                          <button className={styles.smallButton} type="button" onClick={() => openPriceHistory(product)}>
                            Prices
                          </button>
                        )}
                        {!product.is_deleted && permissions?.edit && (
                          <button className={styles.smallButton} type="button" onClick={() => startProductEdit(product)}>
                            Edit
                          </button>
                        )}
                        {product.is_deleted && permissions?.delete ? (
                          <button className={styles.smallButton} type="button" onClick={() => void changeProductStatus(product, true)}>
                            Restore
                          </button>
                        ) : !product.is_deleted && permissions?.delete ? (
                          <button className={styles.danger} type="button" onClick={() => void changeProductStatus(product, false)}>
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

      {productFormOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="product-form-title">
            <div className={styles.modalHeading}>
              <div>
                <p className={styles.eyebrow}>{editingProduct ? "EDIT RECORD" : "NEW RECORD"}</p>
                <h2 id="product-form-title">{editingProduct ? "Edit product" : "Add product"}</h2>
              </div>
              <button className={styles.secondary} type="button" onClick={() => setProductFormOpen(false)}>Close</button>
            </div>
            {formError && <p className={styles.error} role="alert">{formError}</p>}
            <form className={styles.form} onSubmit={saveProduct}>
              {!editingProduct && (
                <label className={styles.field}>
                  Product code
                  <input
                    required
                    maxLength={6}
                    value={productForm.prodcode}
                    onChange={(event) => setProductForm({ ...productForm, prodcode: event.target.value })}
                    autoComplete="off"
                  />
                </label>
              )}
              <label className={styles.field}>
                Description
                <input
                  required
                  maxLength={30}
                  value={productForm.description}
                  onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                Unit
                <select
                  value={productForm.unit}
                  onChange={(event) => setProductForm({ ...productForm, unit: event.target.value as ProductForm["unit"] })}
                >
                  <option value="pc">pc</option>
                  <option value="ea">ea</option>
                  <option value="mtr">mtr</option>
                  <option value="pkg">pkg</option>
                  <option value="ltr">ltr</option>
                </select>
              </label>
              <div className={styles.formActions}>
                <button className={styles.secondary} type="button" onClick={() => setProductFormOpen(false)}>Cancel</button>
                <button className={styles.primary} type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingProduct ? "Save changes" : "Add product"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedProduct && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="price-history-title">
            <div className={styles.modalHeading}>
              <div>
                <p className={styles.eyebrow}>PRICE HISTORY</p>
                <h2 id="price-history-title">{selectedProduct.prodcode} · {selectedProduct.description}</h2>
              </div>
              <button className={styles.secondary} type="button" onClick={() => setSelectedProduct(null)}>Close</button>
            </div>
            {priceError && <p className={styles.error} role="alert">{priceError}</p>}
            <div className={styles.cardHeading}>
              <div><p>Effective-dated prices are retained as history.</p></div>
              {pricePermissions?.addPrice && (
                <button className={styles.primary} type="button" onClick={startPriceCreate}>Add price</button>
              )}
            </div>
            {priceLoading ? (
              <p className={styles.empty}>Loading price history...</p>
            ) : prices.length === 0 ? (
              <p className={styles.empty}>No price history is recorded for this product.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Effective date</th>
                      <th scope="col">Unit price</th>
                      <th scope="col">Audit stamp</th>
                      <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((price) => (
                      <tr key={`${price.prodcode}-${price.effdate}`}>
                        <td>{price.effdate}</td>
                        <td>{Number(price.unitprice).toFixed(2)}</td>
                        <td className={styles.muted}>{price.stamp ?? "—"}</td>
                        <td>
                          <div className={styles.actions}>
                            {!price.is_deleted && pricePermissions?.editPrice && (
                              <button className={styles.smallButton} type="button" onClick={() => startPriceEdit(price)}>
                                Edit
                              </button>
                            )}
                            {price.is_deleted && pricePermissions?.deletePrice ? (
                              <button className={styles.smallButton} type="button" onClick={() => void changePriceStatus(price, true)}>
                                Restore
                              </button>
                            ) : !price.is_deleted && pricePermissions?.deletePrice ? (
                              <button className={styles.danger} type="button" onClick={() => void changePriceStatus(price, false)}>
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

            {priceFormOpen && (
              <form className={styles.form} onSubmit={savePrice}>
                <label className={styles.field}>
                  Effective date
                  <input required type="date" value={priceForm.effdate} onChange={(event) => setPriceForm({ ...priceForm, effdate: event.target.value })} />
                </label>
                <label className={styles.field}>
                  Unit price
                  <input required type="number" min="0.01" max="99999999.99" step="0.01" value={priceForm.unitprice} onChange={(event) => setPriceForm({ ...priceForm, unitprice: event.target.value })} />
                </label>
                <div className={styles.formActions}>
                  <button className={styles.secondary} type="button" onClick={() => setPriceFormOpen(false)}>Cancel</button>
                  <button className={styles.primary} type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingPriceDate ? "Save price" : "Add price"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );

  return <ModuleWorkspace section="Product">{content}</ModuleWorkspace>;
}
