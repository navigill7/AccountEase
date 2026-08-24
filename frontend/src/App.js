import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import {
  ArrowLeft, BookOpen, CalendarDays, ChevronDown, ChevronUp, ClipboardList,
  Download, HandCoins, LogOut, MapPin, MessageCircle, Pencil, Plus, Power, Printer, Search, Shield, Store,
  UserPlus, UserRound, Users, X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./App.css";
import * as API from "./api";

// ---------- formatters ----------
const INR = (v) => {
  const n = Number(v ?? 0);
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const isoToday = () => new Date().toISOString().slice(0, 10);
const initials = (s) => s.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// ---------- primitives ----------
function Modal({ title, children, onClose, wide }) {
  return (
    <div className="modal-backdrop" data-testid="modal-backdrop">
      <div className={wide ? "modal wide" : "modal"} data-testid="form-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">AccountEase</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} data-testid="modal-close-button"><X size={19} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} data-testid={`field-${props.name}`} />
    </label>
  );
}
function SearchBox({ value, onChange, placeholder, testId }) {
  return (
    <div className="search-box">
      <Search size={18} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} />
    </div>
  );
}
function Topbar({ title, subtitle, onBack, onLogout, ownerName, isAdmin, onAdmin }) {
  const chip = ownerName || "Owner";
  return (
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><BookOpen size={18} /></div><span>AccountEase</span></div>
      <div className="topbar-right">
        {isAdmin && onAdmin && (
          <button className="admin-chip" onClick={onAdmin} data-testid="admin-nav-button" title="Admin dashboard">
            <Shield size={15} /> <span>Admin</span>
          </button>
        )}
        <div className="user-chip"><div className="avatar">{initials(chip)}</div><div><b>{chip}</b><small>{isAdmin ? "Admin & owner" : "Owner account"}</small></div></div>
        <button className="logout" onClick={onLogout} data-testid="logout-button"><LogOut size={16} /> <span>Sign out</span></button>
      </div>
      {title && <div className="mobile-page-title"><b>{title}</b><small>{subtitle}</small></div>}
      {onBack && <button className="mobile-back" onClick={onBack} data-testid="mobile-back-button"><ArrowLeft size={18} /></button>}
    </header>
  );
}

// ---------- modals ----------
function AddShop({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: "", address: "" });
  return (
    <Modal title="Add a new shop" onClose={onClose}>
      <p className="modal-copy">Keep each counter, branch, or family business organized in one place.</p>
      <Field label="Shop name" name="shop-name" placeholder="e.g. Rajesh Provision Store" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Field label="Address · optional" name="shop-address" placeholder="Where is this shop?" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose} data-testid="add-shop-cancel">Cancel</button>
        <button className="button primary" disabled={saving || !form.name.trim()} onClick={() => onSave(form)} data-testid="add-shop-submit">{saving ? "Saving…" : "Save shop"} <Plus size={16} /></button>
      </div>
    </Modal>
  );
}

function AddCustomer({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: "", mobile: "", father: "", address: "" });
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const mobileOk = /^\+?\d[\d\s-]{5,19}$/.test(form.mobile.trim());
  return (
    <Modal title="Add customer" onClose={onClose}>
      <p className="modal-copy">Start a fresh khata for someone who shops with you.</p>
      <Field label="Full name" name="name" placeholder="Customer name" value={form.name} onChange={update} />
      <Field label="Mobile number" name="mobile" placeholder="10 digit mobile number" value={form.mobile} onChange={update} />
      <div className="two-col">
        <Field label="Father's name" name="father" placeholder="Optional" value={form.father} onChange={update} />
        <Field label="Address" name="address" placeholder="Area / locality" value={form.address} onChange={update} />
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose} data-testid="add-customer-cancel">Cancel</button>
        <button className="button primary" disabled={saving || !form.name.trim() || !mobileOk} onClick={() => onSave(form)} data-testid="add-customer-submit">{saving ? "Saving…" : "Create khata"} <UserRound size={16} /></button>
      </div>
    </Modal>
  );
}

function PrintModal({ customer, records, balance, onClose }) {
  return (
    <Modal title="Print preview" onClose={onClose}>
      <div className="print-sheet" data-testid="print-preview">
        <div className="print-brand"><BookOpen size={18} /> AccountEase <span>Customer statement</span></div>
        <h3>{customer.name}</h3>
        <p>{customer.mobile_number} · {customer.address || "—"}</p>
        <div className="print-rule" />
        {records.length === 0 && <p className="muted">No records yet.</p>}
        {records.map((r) => (
          <div className="print-row" key={r.id}>
            <span>{fmtDate(r.date)}<small>{r.item} · Paid {INR(r.paid)}</small></span>
            <b>{INR(r.balance)}</b>
          </div>
        ))}
        <div className="print-total"><span>Total outstanding</span><b>{INR(balance)}</b></div>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose} data-testid="print-close-button">Close</button>
        <button className="button primary" onClick={() => { window.print(); toast.success("Print dialog opened"); }} data-testid="print-confirm-button"><Printer size={16} /> Print statement</button>
      </div>
    </Modal>
  );
}

function NumField({ label, name, value, onChange, step = "0.01" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        onChange={onChange}
        onWheel={(e) => e.currentTarget.blur()}
        data-testid={`field-${name}`}
      />
    </label>
  );
}

function RecordFormModal({ mode, initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial);
  const [manualAmount, setManualAmount] = useState(false);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const round2 = (n) => Math.round(n * 100) / 100;

  const setField = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const onQty = (e) => {
    const q = e.target.value;
    const amount = manualAmount ? form.amount : String(round2(toNum(q) * toNum(form.rate)));
    const balance = String(round2(toNum(amount) - toNum(form.paid)));
    setField({ quantity: q, amount, balance });
  };
  const onRate = (e) => {
    const r = e.target.value;
    const amount = manualAmount ? form.amount : String(round2(toNum(form.quantity) * toNum(r)));
    const balance = String(round2(toNum(amount) - toNum(form.paid)));
    setField({ rate: r, amount, balance });
  };
  const onAmount = (e) => {
    const a = e.target.value;
    setManualAmount(true);
    const balance = String(round2(toNum(a) - toNum(form.paid)));
    setField({ amount: a, balance });
  };
  const onPaid = (e) => {
    const p = e.target.value;
    const balance = String(round2(toNum(form.amount) - toNum(p)));
    setField({ paid: p, balance });
  };
  const onDate = (e) => setField({ date: e.target.value });
  const onItem = (e) => setField({ item: e.target.value });

  const isNumeric = (v) => v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v)) && Number(v) >= 0;
  const disabled =
    saving ||
    !form.item.trim() ||
    !isNumeric(form.quantity) ||
    !isNumeric(form.rate) ||
    !isNumeric(form.amount) ||
    !isNumeric(form.paid);

  return (
    <Modal title={mode === "edit" ? "Edit ledger record" : "Add ledger record"} onClose={onClose}>
      <p className="modal-copy">
        <b>Amount</b> auto-fills from Quantity × Rate; <b>Balance</b> is Amount − Paid. You can still tweak Amount by hand if the rate isn&apos;t uniform.
      </p>
      <div className="two-col">
        <Field label="Date" name="record-date" type="date" value={form.date} onChange={onDate} />
        <Field label="Item" name="record-item" placeholder="What was purchased?" value={form.item} onChange={onItem} />
      </div>
      <div className="two-col">
        <NumField label="Quantity" name="record-quantity" value={form.quantity} onChange={onQty} step="0.001" />
        <NumField label="Rate (₹)" name="record-rate" value={form.rate} onChange={onRate} />
      </div>
      <div className="two-col">
        <NumField label="Amount (₹)" name="record-amount" value={form.amount} onChange={onAmount} />
        <NumField label="Paid (₹)" name="record-paid" value={form.paid} onChange={onPaid} />
      </div>
      <label className="field">
        <span>Outstanding balance (₹) · auto</span>
        <input name="record-balance" value={form.balance} readOnly data-testid="field-record-balance" className="readonly-input" />
      </label>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose} data-testid="add-record-cancel">Cancel</button>
        <button className="button primary" onClick={() => onSave(form)} disabled={disabled} data-testid="add-record-submit">
          {saving ? "Saving…" : mode === "edit" ? "Update record" : "Save record"} <Plus size={16} />
        </button>
      </div>
    </Modal>
  );
}

// ---------- pages ----------
function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const owner = await API.login(username.trim(), password);
      toast.success(`Welcome back, ${owner.name}`);
      onLogin(owner);
    } catch (err) {
      toast.error(API.apiErr(err, "Sign in failed"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="login-page">
      <div className="login-art"><div className="art-copy">
        <div className="brand light"><div className="brand-mark"><BookOpen size={18} /></div><span>AccountEase</span></div>
        <h1>Your shop.<br /><em>Your records.</em><br />Always in hand.</h1>
        <p>A calmer way to keep every customer account clear, current, and close.</p>
        <div className="ledger-art"><div className="ledger-lines" /><span>khata / खाते</span></div>
      </div></div>
      <div className="login-panel">
        <div className="login-form">
          <span className="eyebrow">Owner sign in</span>
          <h2>Welcome back</h2>
          <p className="muted">Pick up where your shop left off.</p>
          <form onSubmit={submit} data-testid="login-form">
            <Field label="Username" name="username" placeholder="Enter username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <label className="field"><span>Password</span>
              <div className="password-field">
                <input name="password" type={show ? "text" : "password"} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="field-password" />
                <button type="button" onClick={() => setShow(!show)} data-testid="password-toggle">{show ? "Hide" : "Show"}</button>
              </div>
            </label>
            <button className="button primary full" type="submit" disabled={loading} data-testid="login-submit-button">
              {loading ? "Signing in…" : "Sign in"} <ArrowLeft className="flip" size={17} />
            </button>
          </form>
          <div className="demo-note"><span>Demo access</span><b>rajesh</b><b>demo123</b></div>
        </div>
        <small className="login-footer">Private ledger workspace · Built for everyday business · <a href="/admin">Admin sign in →</a></small>
      </div>
    </main>
  );
}

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const owner = await API.login(username.trim(), password);
      if (!owner.is_admin) {
        API.logout();
        toast.error("This account does not have admin access.");
        return;
      }
      toast.success(`Welcome back, ${owner.name}`);
      onLogin(owner);
    } catch (err) {
      toast.error(API.apiErr(err, "Sign in failed"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="login-page">
      <div className="login-art"><div className="art-copy">
        <div className="brand light"><div className="brand-mark"><Shield size={18} /></div><span>AccountEase</span></div>
        <h1>Admin<br /><em>control panel.</em></h1>
        <p>Onboard shop owners, manage access, and keep the platform in order.</p>
        <div className="ledger-art"><div className="ledger-lines" /><span>admin / व्यवस्थापक</span></div>
      </div></div>
      <div className="login-panel">
        <div className="login-form">
          <span className="eyebrow">Admin sign in</span>
          <h2>Admin access</h2>
          <p className="muted">Sign in with an admin account to manage owners.</p>
          <form onSubmit={submit} data-testid="admin-login-form">
            <Field label="Username" name="admin-username" placeholder="Enter admin username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <label className="field"><span>Password</span>
              <div className="password-field">
                <input name="admin-password" type={show ? "text" : "password"} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="admin-field-password" />
                <button type="button" onClick={() => setShow(!show)} data-testid="admin-password-toggle">{show ? "Hide" : "Show"}</button>
              </div>
            </label>
            <button className="button primary full" type="submit" disabled={loading} data-testid="admin-login-submit-button">
              {loading ? "Signing in…" : "Sign in"} <ArrowLeft className="flip" size={17} />
            </button>
          </form>
          <div className="demo-note"><span>Demo access</span><b>rajesh</b><b>demo123</b></div>
        </div>
        <small className="login-footer"><a href="/">Owner sign in instead →</a></small>
      </div>
    </main>
  );
}

function emptyBulkRow() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: isoToday(),
    item: "",
    quantity: "1",
    mrp: "",
    less: "0",
    amount: "",
    manualAmount: false,
  };
}

function BulkRecordModal({ onClose, onSaveMany, saving }) {
  const [rows, setRows] = useState([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()]);
  const [paid, setPaid] = useState("0");

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const round2 = (n) => Math.round(n * 100) / 100;

  const patchRow = (key, patch) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const recalc = (row, patch) => {
    const next = { ...row, ...patch };
    if (!next.manualAmount) {
      next.amount = String(round2(toNum(next.quantity) * (toNum(next.mrp) - toNum(next.less))));
    }
    return next;
  };

  const onDate = (row) => (e) => patchRow(row.key, { date: e.target.value });
  const onItem = (row) => (e) => patchRow(row.key, { item: e.target.value });
  const onQty = (row) => (e) => patchRow(row.key, recalc(row, { quantity: e.target.value }));
  const onMrp = (row) => (e) => patchRow(row.key, recalc(row, { mrp: e.target.value }));
  const onLess = (row) => (e) => patchRow(row.key, recalc(row, { less: e.target.value }));
  const onAmount = (row) => (e) => patchRow(row.key, { amount: e.target.value, manualAmount: true });

  const addRow = () => setRows((prev) => [...prev, emptyBulkRow()]);
  const removeRow = (key) => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));

  const isNumeric = (v) => v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v)) && Number(v) >= 0;
  const isFilled = (r) => r.item.trim() !== "" || isNumeric(r.mrp) || isNumeric(r.amount);
  const isValid = (r) => r.item.trim() !== "" && isNumeric(r.quantity) && isNumeric(r.mrp) && isNumeric(r.less) && isNumeric(r.amount);

  const filledRows = rows.filter(isFilled);
  const validRows = filledRows.filter(isValid);
  const hasInvalidFilledRow = filledRows.length !== validRows.length;

  const total = round2(validRows.reduce((sum, r) => sum + toNum(r.amount), 0));
  const paidOk = isNumeric(paid);
  const balance = round2(total - (paidOk ? toNum(paid) : 0));

  const disabled = saving || validRows.length === 0 || hasInvalidFilledRow || !paidOk;

  const handleSave = () => onSaveMany(validRows, paidOk ? toNum(paid) : 0, total);

  return (
    <Modal title="Add ledger records" wide onClose={onClose}>
      <p className="modal-copy">
        Add as many items as you need. <b>Amount</b> auto-fills from Qty × (MRP − Less); override it by hand if needed. Enter one <b>Paid</b> amount for the whole bill — <b>Balance</b> is Total − Paid. Blank rows are ignored.
      </p>
      <div className="bulk-table">
        <div className="bulk-row bulk-head">
          <span>Date</span>
          <span>Item</span>
          <span>Qty</span>
          <span>MRP (₹)</span>
          <span>Less (₹)</span>
          <span>Amount (₹)</span>
          <span />
        </div>
        {rows.map((row, idx) => (
          <div className="bulk-row" key={row.key} data-testid={`bulk-record-row-${idx}`}>
            <input type="date" value={row.date} onChange={onDate(row)} data-testid={`bulk-row-date-${idx}`} />
            <input type="text" placeholder="Item" value={row.item} onChange={onItem(row)} data-testid={`bulk-row-item-${idx}`} />
            <input type="number" min="0" step="0.001" placeholder="0" value={row.quantity} onChange={onQty(row)} data-testid={`bulk-row-quantity-${idx}`} />
            <input type="number" min="0" step="0.01" placeholder="0" value={row.mrp} onChange={onMrp(row)} data-testid={`bulk-row-mrp-${idx}`} />
            <input type="number" min="0" step="0.01" placeholder="0" value={row.less} onChange={onLess(row)} data-testid={`bulk-row-less-${idx}`} />
            <input type="number" min="0" step="0.01" placeholder="0" value={row.amount} onChange={onAmount(row)} data-testid={`bulk-row-amount-${idx}`} />
            <button
              type="button"
              className="icon-btn"
              onClick={() => removeRow(row.key)}
              disabled={rows.length <= 1}
              data-testid={`bulk-row-remove-${idx}`}
              title="Remove row"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="text-action" onClick={addRow} data-testid="bulk-add-row">
        <Plus size={15} /> Add another row
      </button>
      {hasInvalidFilledRow && (
        <p className="modal-copy" style={{ color: "#b54f35", marginTop: 14 }}>
          One or more rows are missing an item name or have an invalid number — fix or clear them before saving.
        </p>
      )}
      <div className="bulk-summary">
        <div className="bulk-summary-line">
          <span>Total (₹)</span>
          <b data-testid="bulk-total">{total.toFixed(2)}</b>
        </div>
        <label className="field">
          <span>Paid (₹)</span>
          <input type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} data-testid="bulk-paid" />
        </label>
        <div className="bulk-summary-line">
          <span>Outstanding balance (₹) · auto</span>
          <b data-testid="bulk-balance">{balance.toFixed(2)}</b>
        </div>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose} data-testid="bulk-record-cancel">Cancel</button>
        <button className="button primary" onClick={handleSave} disabled={disabled} data-testid="bulk-record-submit">
          {saving ? "Saving…" : `Save ${validRows.length || ""} record${validRows.length === 1 ? "" : "s"}`} <Plus size={16} />
        </button>
      </div>
    </Modal>
  );
}

function Organizations({ owner, onSelect, onLogout, onAdmin }) {
  const [shops, setShops] = useState(null); // null = loading
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (signal) => {
    setRefreshing(true);
    try {
      const data = await API.listOrganizations();
      if (!signal?.aborted) setShops(data);
    } catch (e) {
      if (!signal?.aborted) {
        toast.error(API.apiErr(e, "Could not load shops"));
        setShops((s) => s ?? []);
      }
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    refresh(ctrl.signal);
    return () => ctrl.abort();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!shops) return [];
    if (!query.trim()) return shops;
    const q = query.trim().toLowerCase();
    return shops.filter((s) => s.name.toLowerCase().includes(q));
  }, [shops, query]);

  const save = async (form) => {
    setSaving(true);
    try {
      const created = await API.createOrganization({ name: form.name.trim(), address: form.address.trim() || null });
      // Optimistic: prepend immediately so the UI feels instant.
      setShops((prev) => [{ ...created, customer_count: 0 }, ...(prev || [])]);
      setModal(false);
      toast.success("Shop added");
      refresh();
    } catch (e) {
      toast.error(API.apiErr(e, "Could not save shop"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar onLogout={onLogout} ownerName={owner?.name} isAdmin={owner?.is_admin} onAdmin={onAdmin} />
      <main className="content">
        <div className="page-intro">
          <div>
            <span className="eyebrow">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
            <h1>Good day, {owner?.name || "Owner"}</h1>
            <p className="muted">Here’s the shape of your business today.</p>
          </div>
          <div className="summary-stamp"><Store size={19} /><div><b>{shops?.length ?? 0} shops</b><small>under your care</small></div></div>
        </div>
        <div className="section-heading">
          <div><h2>Your shops</h2><p className="muted">Choose a shop to open its customer book. {refreshing && shops && <span className="refreshing" data-testid="refreshing-shops">· refreshing…</span>}</p></div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search shops" testId="organization-search-input" />
        </div>
        <div className="shop-grid" data-testid="organizations-list">
          {shops === null && <div className="empty"><Store size={24} /><b>Loading shops…</b><span>One moment.</span></div>}
          {shops !== null && filtered.map((shop, i) => (
            <button className="shop-card" key={shop.id} onClick={() => onSelect(shop)} data-testid={`organization-card-${shop.id}`}>
              <div className={`shop-icon ${["sage", "coral", "yellow"][i % 3]}`}><Store size={22} /></div>
              <div className="shop-card-copy"><h3>{shop.name}</h3><span><MapPin size={13} /> {shop.address || "No address on file"}</span></div>
              <div className="shop-count"><b>{shop.customer_count}</b><small>customers</small></div>
              <ArrowLeft className="card-arrow flip" size={18} />
            </button>
          ))}
          {shops !== null && filtered.length === 0 && shops.length > 0 && (
            <div className="empty"><Store size={24} /><b>No shops found</b><span>Try another name or add a new shop.</span></div>
          )}
          {shops !== null && shops.length === 0 && (
            <div className="empty"><Store size={24} /><b>No shops yet</b><span>Tap the + button to add your first shop.</span></div>
          )}
        </div>
      </main>
      <button className="fab" onClick={() => setModal(true)} data-testid="add-organization-button"><Plus size={24} /></button>
      {modal && <AddShop onClose={() => setModal(false)} onSave={save} saving={saving} />}
    </div>
  );
}

function Customers({ shop, owner, onBack, onSelect, onLogout, onAdmin }) {
  const [customers, setCustomers] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [print, setPrint] = useState(null);
  const [saving, setSaving] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeSelected, setCloseSelected] = useState("");

  const refresh = useCallback(async (signal) => {
    setRefreshing(true);
    try {
      const data = await API.listCustomers(shop.id);
      if (!signal?.aborted) setCustomers(data);
    } catch (e) {
      if (!signal?.aborted) {
        toast.error(API.apiErr(e, "Could not load customers"));
        setCustomers((c) => c ?? []);
      }
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, [shop.id]);
  useEffect(() => {
    const ctrl = new AbortController();
    refresh(ctrl.signal);
    return () => ctrl.abort();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!customers) return [];
    if (!query.trim()) return customers;
    const q = query.trim().toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.mobile_number || "").includes(q.replace(/\s+/g, "")));
  }, [customers, query]);

  const totalOutstanding = useMemo(() => (customers || []).reduce((sum, c) => sum + Number(c.balance || 0), 0), [customers]);

  const save = async (form) => {
    setSaving(true);
    try {
      const created = await API.createCustomer(shop.id, {
        name: form.name.trim(),
        mobile_number: form.mobile.trim(),
        father_name: form.father.trim() || null,
        address: form.address.trim() || null,
      });
      // Optimistic prepend for instant feedback
      setCustomers((prev) => [{ ...created, balance: created.balance ?? "0" }, ...(prev || [])]);
      setModal(false);
      toast.success("Customer khata created");
      refresh();
    } catch (e) {
      toast.error(API.apiErr(e, "Could not create customer"));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    const target = (customers || []).find((c) => String(c.id) === closeSelected);
    if (!target) return;
    if (!window.confirm(`Permanently delete ${target.name}'s account and all ledger records?`)) return;
    try {
      await API.deleteCustomer(target.id);
      // Optimistic removal
      setCustomers((prev) => (prev || []).filter((c) => c.id !== target.id));
      toast.success(`${target.name}'s account was permanently deleted`);
      setCloseSelected("");
      setCloseOpen(false);
      refresh();
    } catch (e) {
      toast.error(API.apiErr(e, "Could not close account"));
    }
  };

  const openPrint = async (c) => {
    try {
      const records = await API.listTransactions(c.id);
      setPrint({ customer: c, records, balance: c.balance });
    } catch (e) {
      toast.error(API.apiErr(e, "Could not load statement"));
    }
  };

  return (
    <div className="app-shell">
      <Topbar title={shop.name} subtitle="Customer book" onBack={onBack} onLogout={onLogout} ownerName={owner?.name} isAdmin={owner?.is_admin} onAdmin={onAdmin} />
      <main className="content narrow">
        <div className="breadcrumb"><button onClick={onBack} data-testid="organizations-back-button"><ArrowLeft size={16} /> All shops</button><span>/</span><b>{shop.name}</b></div>
        <div className="page-intro compact">
          <div>
            <span className="eyebrow">Customer book</span>
            <h1>{shop.name}</h1>
            <p className="muted">{customers?.length ?? 0} active customer accounts {refreshing && customers && <span className="refreshing" data-testid="refreshing-customers">· refreshing…</span>}</p>
          </div>
          <div className="book-total"><b>{INR(totalOutstanding)}</b><small>total outstanding</small></div>
        </div>
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name or mobile" testId="customer-search-input" />
          <button className="button primary desktop-add" onClick={() => setModal(true)} data-testid="desktop-add-customer-button"><Plus size={17} /> Add customer</button>
        </div>
        <div className="customer-table" data-testid="customers-list">
          <div className="table-head"><span>Customer</span><span>Mobile number</span><span>Statement</span></div>
          {customers === null && <div className="empty"><Users size={24} /><b>Loading customers…</b><span>One moment.</span></div>}
          {customers !== null && filtered.map((c) => (
            <div className="customer-row" key={c.id} onClick={() => onSelect(c)} data-testid={`customer-row-${c.id}`}>
              <div className="customer-name"><div className="avatar soft">{initials(c.name)}</div><b>{c.name}</b></div>
              <span>{c.mobile_number}</span>
              <button className="print-btn" onClick={(e) => { e.stopPropagation(); openPrint(c); }} aria-label={`Print ${c.name}`} data-testid={`print-customer-${c.id}`}><Printer size={17} /></button>
            </div>
          ))}
          {customers !== null && filtered.length === 0 && customers.length > 0 && (
            <div className="empty"><Users size={24} /><b>No customer found</b><span>Try searching by another name or number.</span></div>
          )}
          {customers !== null && customers.length === 0 && (
            <div className="empty"><Users size={24} /><b>No customers yet</b><span>Tap the + button to add your first customer.</span></div>
          )}
        </div>
      </main>
      <button className="fab" onClick={() => setModal(true)} data-testid="add-customer-button"><Plus size={24} /></button>
      <button className="close-account-button" onClick={() => setCloseOpen(true)} data-testid="close-account-button"><X size={16} /> Close account</button>
      {modal && <AddCustomer onClose={() => setModal(false)} onSave={save} saving={saving} />}
      {print && <PrintModal customer={print.customer} records={print.records} balance={print.balance} onClose={() => setPrint(null)} />}
      {closeOpen && (
        <Modal title="Close customer account" onClose={() => setCloseOpen(false)}>
          <p className="modal-copy">This permanently deletes the customer and every ledger record from this shop. This cannot be undone.</p>
          <label className="field"><span>Select account</span>
            <select value={closeSelected} onChange={(e) => setCloseSelected(e.target.value)} data-testid="close-account-select">
              <option value="">Choose a customer</option>
              {(customers || []).map((c) => <option key={c.id} value={c.id}>{`${c.name} · ${c.mobile_number}`}</option>)}
            </select>
          </label>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setCloseOpen(false)} data-testid="close-account-cancel">Keep account</button>
            <button className="button danger" disabled={!closeSelected} onClick={handleClose} data-testid="close-account-confirm">Yes, permanently delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Ledger({ shop, customer, owner, onBack, onLogout, onAdmin }) {
  const [records, setRecords] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(customer.balance);
  const [open, setOpen] = useState(-1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });
  const [entryOpen, setEntryOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editing, setEditing] = useState(null); // record being edited
  const [saving, setSaving] = useState(false);

  const share = (text) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  const shareToMobile = (mobile, text) => {
    const digits = (mobile || "").replace(/\D/g, "");
    const url = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const refresh = useCallback(async (signal) => {
    setRefreshing(true);
    try {
      const [data, fresh] = await Promise.all([
        API.listTransactions(customer.id, applied.from || undefined, applied.to || undefined),
        API.getCustomer(customer.id),
      ]);
      if (!signal?.aborted) {
        setRecords(data);
        setBalance(fresh.balance);
      }
    } catch (e) {
      if (!signal?.aborted) {
        toast.error(API.apiErr(e, "Could not load ledger"));
        setRecords((r) => r ?? []);
      }
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, [customer.id, applied]);
  useEffect(() => {
    const ctrl = new AbortController();
    refresh(ctrl.signal);
    return () => ctrl.abort();
  }, [refresh]);

  const saveRecord = async (form) => {
    setSaving(true);
    const payload = {
      date: form.date,
      item: form.item.trim(),
      quantity: form.quantity || "0",
      rate: form.rate || "0",
      amount: form.amount || "0",
      paid: form.paid || "0",
      // balance is authoritatively recomputed by the backend from amount - paid,
      // but we send our local view so audit logs / clients that skip recompute stay consistent.
      balance: form.balance || "0",
    };
    try {
      if (editing) {
        const updated = await API.updateTransaction(editing.id, payload);
        setRecords((prev) => (prev || []).map((r) => (r.id === updated.id ? updated : r)));
        toast.success("Ledger record updated");
      } else {
        const created = await API.createTransaction(customer.id, payload);
        setRecords((prev) => [created, ...(prev || [])]);
        setBalance(created.balance);
        toast.success("Ledger record saved");
      }
      setEntryOpen(false);
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(API.apiErr(e, "Could not save record"));
    } finally {
      setSaving(false);
    }
  };

  const saveManyRecords = async (rows, paidTotal, billTotal) => {
    if (!rows.length) return;
    setSaving(true);
    let succeeded = 0;
    let failed = 0;
    for (const row of rows) {
      const netRate = (Number(row.mrp) || 0) - (Number(row.less) || 0);
      const payload = {
        date: row.date,
        item: row.item.trim(),
        quantity: row.quantity || "0",
        rate: String(netRate),
        amount: row.amount || "0",
        paid: "0",
        balance: row.amount || "0",
        note: `MRP ₹${Number(row.mrp || 0).toFixed(2)}, Less ₹${Number(row.less || 0).toFixed(2)}`,
      };
      try {
        // eslint-disable-next-line no-await-in-loop
        const created = await API.createTransaction(customer.id, payload);
        setRecords((prev) => [created, ...(prev || [])]);
        succeeded += 1;
      } catch (e) {
        failed += 1;
      }
    }
    // Payment against the whole bill is recorded as one shared entry, same convention as
    // the regular "Record payment" flow — item rows above all carry paid=0.
    if (!failed && paidTotal > 0) {
      try {
        const paymentPayload = {
          date: rows[0].date,
          item: `Payment received — against bill of ${INR(billTotal)}`,
          quantity: "1",
          rate: "0",
          amount: "0",
          paid: String(paidTotal),
          balance: String(-Math.abs(paidTotal)),
        };
        const created = await API.createTransaction(customer.id, paymentPayload);
        setRecords((prev) => [created, ...(prev || [])]);
      } catch (e) {
        toast.error(API.apiErr(e, "Items saved, but recording the payment failed"));
      }
    }
    setSaving(false);
    if (succeeded) toast.success(`${succeeded} record${succeeded === 1 ? "" : "s"} saved`);
    if (failed) toast.error(`${failed} record${failed === 1 ? "" : "s"} failed to save`);
    if (!failed) setBulkOpen(false);
    refresh();
  };

  const removeRecord = async (r) => {
    if (!window.confirm(`Delete the record from ${fmtDate(r.date)} for "${r.item}"?`)) return;
    try {
      await API.deleteTransaction(r.id);
      setRecords((prev) => (prev || []).filter((x) => x.id !== r.id));
      toast.success("Record deleted");
      refresh();
    } catch (e) {
      toast.error(API.apiErr(e, "Could not delete record"));
    }
  };

  const startEdit = (r) => {
    setEditing(r);
    setEntryOpen(true);
  };

  const savePayment = async (form) => {
    setSaving(true);
    try {
      // Payments are stored as a special transaction with amount=0 so balance = -paid,
      // which reduces the SUM(balance) running outstanding without needing a separate table.
      const created = await API.createTransaction(customer.id, {
        date: form.date,
        item: form.note.trim() ? `Payment received — ${form.note.trim()}` : "Payment received",
        quantity: "1",
        rate: "0",
        amount: "0",
        paid: form.amount,
        balance: String(-Math.abs(Number(form.amount || 0))),
      });
      setRecords((prev) => [created, ...(prev || [])]);
      setPaymentOpen(false);
      toast.success(`Payment of ${INR(form.amount)} recorded`);
      refresh();
    } catch (e) {
      toast.error(API.apiErr(e, "Could not save payment"));
    } finally {
      setSaving(false);
    }
  };

  // Total received this month (client-side, no extra API call).
  const paidThisMonth = useMemo(() => {
    if (!records) return 0;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return records
      .filter((r) => {
        const d = new Date(`${r.date}T00:00:00`);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .reduce((sum, r) => sum + Number(r.paid || 0), 0);
  }, [records]);

  const entryInitial = editing
    ? { date: editing.date, item: editing.item, quantity: String(editing.quantity ?? "1"), rate: String(editing.rate ?? "0"), amount: String(editing.amount ?? "0"), paid: String(editing.paid ?? "0"), balance: String(editing.balance ?? "0") }
    : { date: isoToday(), item: "", quantity: "1", rate: "", amount: "", paid: "0", balance: "" };

  return (
    <div className="app-shell">
      <Topbar title={customer.name} subtitle="Customer ledger" onBack={onBack} onLogout={onLogout} ownerName={owner?.name} isAdmin={owner?.is_admin} onAdmin={onAdmin} />
      <main className="content narrow">
        <div className="breadcrumb"><button onClick={onBack} data-testid="customers-back-button"><ArrowLeft size={16} /> {shop.name}</button><span>/</span><b>{customer.name}</b></div>
        <section className="ledger-hero" data-testid="customer-details">
          <div className="avatar large">{initials(customer.name)}</div>
          <div className="ledger-person">
            <span className="eyebrow">Customer account</span>
            <h1>{customer.name}</h1>
            <p>{customer.mobile_number} <i>·</i> {customer.father_name ? `S/o ${customer.father_name}` : "No father's name"}</p>
            <span><MapPin size={13} /> {customer.address || "No address on file"}</span>
          </div>
          <div className="balance-stack">
            <div className="balance-box"><small>Total outstanding</small><b>{INR(balance)}</b><span>amount − paid, across all records</span></div>
            <div className="paid-chip" data-testid="paid-this-month">
              <HandCoins size={15} /><div><small>Paid this month</small><b>{INR(paidThisMonth)}</b></div>
            </div>
          </div>
        </section>
        <section className="filter-card">
          <div><CalendarDays size={18} /><b>Filter records</b></div>
          <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="ledger-from-date" /></label>
          <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="ledger-to-date" /></label>
          <button className="button secondary" onClick={() => { setApplied({ from, to }); setOpen(-1); toast.success("Showing matching records"); }} data-testid="ledger-apply-filter">Apply</button>
          {(applied.from || applied.to) && (
            <button className="text-action" onClick={() => { setFrom(""); setTo(""); setApplied({ from: "", to: "" }); }} data-testid="ledger-clear-filter">Clear</button>
          )}
        </section>
        <div className="records-head">
          <div><h2>Account history</h2><p className="muted">{records?.length ?? 0} records · newest first {refreshing && records && <span className="refreshing" data-testid="refreshing-records">· refreshing…</span>}</p></div>
          <div className="records-head-actions">
            <button className="text-action" onClick={() => exportStatementPdf({ shop, customer, records: records || [], balance })} data-testid="download-pdf-button"><Download size={16} /> Download PDF</button>
            <button className="text-action" onClick={() => window.print()} data-testid="print-all-records-button"><Printer size={16} /> Print all</button>
          </div>
        </div>
        <div className="records-list" data-testid="ledger-records-list">
          {records === null && <div className="empty"><ClipboardList size={25} /><b>Loading records…</b><span>One moment.</span></div>}
          {records !== null && records.map((r, i) => (
            <div className={`record ${open === i ? "expanded" : ""}`} key={r.id}>
              <div className="record-header-row">
                <button className="record-header" onClick={() => setOpen(open === i ? -1 : i)} data-testid={`ledger-record-${i}`} aria-expanded={open === i}>
                  <span className="record-date"><span className="record-dot" /><b>{fmtDate(r.date)}</b><small>{r.item}</small></span>
                  <span className="record-balance"><b>{INR(r.balance)}</b><small>outstanding</small></span>
                  {open === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <div className="record-quick-actions">
                  <button className="quick-icon edit" onClick={() => startEdit(r)} aria-label={`Edit record from ${fmtDate(r.date)}`} data-testid={`edit-record-${i}`}><Pencil size={15} /></button>
                  <button className="quick-icon delete" onClick={() => removeRecord(r)} aria-label={`Delete record from ${fmtDate(r.date)}`} data-testid={`delete-record-${i}`}><X size={15} /></button>
                </div>
              </div>
              {open === i && (
                <div className="record-detail" data-testid={`ledger-record-detail-${i}`}>
                  <div><span>Item</span><b>{r.item}</b></div>
                  <div><span>Quantity</span><b>{r.quantity}</b></div>
                  <div><span>Rate</span><b>{INR(r.rate)}</b></div>
                  <div><span>Amount</span><b>{INR(r.amount)}</b></div>
                  <div><span>Paid</span><b>{INR(r.paid)}</b></div>
                  <div className="detail-balance"><span>Outstanding balance</span><b>{INR(r.balance)}</b></div>
                  <div className="record-actions">
                    <button className="whatsapp-small" onClick={() => shareToMobile(customer.mobile_number, `AccountEase statement for ${customer.name}\n${fmtDate(r.date)} · ${r.item}\nAmount: ${INR(r.amount)} · Paid: ${INR(r.paid)}\nOutstanding: ${INR(r.balance)}`)} data-testid={`whatsapp-record-${i}`}><MessageCircle size={16} /> Share on WhatsApp</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {records !== null && records.length === 0 && (
            <div className="empty"><ClipboardList size={25} /><b>No records yet</b><span>Transactions for this customer will appear here.</span></div>
          )}
        </div>
      </main>
      <button className="whatsapp-fab" onClick={() => shareToMobile(customer.mobile_number, `AccountEase statement\nCustomer: ${customer.name}\nMobile: ${customer.mobile_number}\nTotal outstanding: ${INR(balance)}\n\n${(records || []).map((r) => `${fmtDate(r.date)} · ${r.item} · Amt ${INR(r.amount)} · Paid ${INR(r.paid)} · Owe ${INR(r.balance)}`).join("\n")}`)} data-testid="whatsapp-all-records-button">
        <MessageCircle size={24} /><span>Share on WhatsApp</span>
      </button>
      <button className="fab" onClick={() => { setEditing(null); setBulkOpen(true); }} data-testid="add-ledger-record-button"><Plus size={24} /></button>
      {entryOpen && editing && <RecordFormModal mode="edit" initial={entryInitial} onClose={() => { setEntryOpen(false); setEditing(null); }} onSave={saveRecord} saving={saving} />}
      {bulkOpen && <BulkRecordModal onClose={() => setBulkOpen(false)} onSaveMany={saveManyRecords} saving={saving} />}
    </div>
  );
}

// ---------- PDF export ----------
function exportStatementPdf({ shop, customer, records, balance }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor("#176b55");
  doc.text("AccountEase", marginX, 50);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#666");
  doc.setFontSize(10);
  doc.text("Customer statement", marginX, 66);

  doc.setTextColor("#182326");
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(customer.name, marginX, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#555");
  const line2 = [customer.mobile_number, customer.father_name ? `S/o ${customer.father_name}` : null, customer.address].filter(Boolean).join(" · ");
  doc.text(line2 || "—", marginX, 116);
  if (shop?.name) doc.text(`Shop: ${shop.name}`, marginX, 132);
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, marginX, 148);

  const rows = (records || []).map((r) => [
    fmtDate(r.date),
    r.item,
    String(r.quantity),
    Number(r.rate).toLocaleString("en-IN"),
    Number(r.amount).toLocaleString("en-IN"),
    Number(r.paid).toLocaleString("en-IN"),
    Number(r.balance).toLocaleString("en-IN"),
  ]);

  autoTable(doc, {
    startY: 170,
    head: [["Date", "Item", "Qty", "Rate (₹)", "Amount (₹)", "Paid (₹)", "Outstanding (₹)"]],
    body: rows.length ? rows : [["—", "No records yet", "", "", "", "", ""]],
    headStyles: { fillColor: [23, 107, 85], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: marginX, right: marginX },
  });

  const endY = doc.lastAutoTable.finalY + 20;
  const totalPaid = (records || []).reduce((s, r) => s + Number(r.paid || 0), 0);
  doc.setFontSize(11);
  doc.setTextColor("#182326");
  doc.text(`Total paid: Rs. ${totalPaid.toLocaleString("en-IN")}`, marginX, endY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#af4d2f");
  doc.setFontSize(13);
  doc.text(`Total outstanding: Rs. ${Number(balance || 0).toLocaleString("en-IN")}`, marginX, endY + 20);

  const safe = customer.name.replace(/[^a-z0-9]+/gi, "_");
  doc.save(`AccountEase_${safe}_${isoToday()}.pdf`);
}

// ---------- Payment modal ----------
function PaymentModal({ customer, onClose, onSave, saving }) {
  const [form, setForm] = useState({ date: isoToday(), amount: "", note: "" });
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const amountOk = form.amount !== "" && !Number.isNaN(Number(form.amount)) && Number(form.amount) > 0;
  return (
    <Modal title="Record a payment" onClose={onClose}>
      <p className="modal-copy">
        Money received from <b>{customer.name}</b>. This creates a payment entry that reduces the total outstanding without needing a fake item row.
      </p>
      <div className="two-col">
        <Field label="Date" name="payment-date" type="date" value={form.date} onChange={upd("date")} />
        <label className="field">
          <span>Amount received (₹)</span>
          <input
            name="payment-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={upd("amount")}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="0.00"
            data-testid="field-payment-amount"
          />
        </label>
      </div>
      <Field label="Note (optional)" name="payment-note" placeholder="e.g. Cash / UPI / Cheque #123" value={form.note} onChange={upd("note")} />
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose} data-testid="payment-cancel">Cancel</button>
        <button className="button primary" onClick={() => onSave(form)} disabled={saving || !amountOk} data-testid="payment-submit">
          {saving ? "Saving…" : "Save payment"} <HandCoins size={16} />
        </button>
      </div>
    </Modal>
  );
}

// ---------- Admin dashboard ----------
function AdminDashboard({ owner, onBack, onLogout }) {
  const [owners, setOwners] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "", mobile_number: "", is_admin: false });
  const [query, setQuery] = useState("");

  const refresh = useCallback(async (signal) => {
    setRefreshing(true);
    try {
      const data = await API.adminListOwners();
      if (!signal?.aborted) setOwners(data);
    } catch (e) {
      if (!signal?.aborted) toast.error(API.apiErr(e, "Could not load owners"));
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    refresh(ctrl.signal);
    return () => ctrl.abort();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!owners) return [];
    if (!query.trim()) return owners;
    const q = query.trim().toLowerCase();
    return owners.filter((o) => o.username.toLowerCase().includes(q) || o.name.toLowerCase().includes(q));
  }, [owners, query]);

  const create = async () => {
    setSaving(true);
    try {
      const created = await API.adminCreateOwner({
        username: form.username.trim().toLowerCase(),
        password: form.password,
        name: form.name.trim(),
        mobile_number: form.mobile_number.trim() || null,
        is_admin: form.is_admin,
      });
      setOwners((prev) => [{ ...created, shop_count: 0 }, ...(prev || [])]);
      toast.success(`${created.name} onboarded (username: ${created.username})`);
      setModalOpen(false);
      setForm({ username: "", password: "", name: "", mobile_number: "", is_admin: false });
    } catch (e) {
      toast.error(API.apiErr(e, "Could not create account"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    const nextActive = !row.is_active;
    const verb = nextActive ? "reactivate" : "deactivate";
    if (!window.confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} ${row.name}'s account?`)) return;
    try {
      const updated = await API.adminUpdateOwner(row.id, { is_active: nextActive });
      setOwners((prev) => (prev || []).map((o) => (o.id === updated.id ? updated : o)));
      toast.success(`${row.name} ${nextActive ? "reactivated" : "deactivated"}`);
    } catch (e) {
      toast.error(API.apiErr(e, `Could not ${verb} account`));
    }
  };

  const formValid =
    form.username.trim().length >= 3 &&
    form.password.length >= 4 &&
    form.name.trim().length > 0;

  return (
    <div className="app-shell">
      <Topbar title="Admin dashboard" subtitle="Owner accounts" onBack={onBack} onLogout={onLogout} ownerName={owner?.name} isAdmin={owner?.is_admin} />
      <main className="content">
        <div className="breadcrumb"><button onClick={onBack} data-testid="admin-back-button"><ArrowLeft size={16} /> Back to shops</button><span>/</span><b>Admin</b></div>
        <div className="page-intro compact">
          <div>
            <span className="eyebrow">Admin</span>
            <h1>Owner accounts</h1>
            <p className="muted">Onboard a new shop owner or deactivate an existing one. {refreshing && owners && <span className="refreshing">· refreshing…</span>}</p>
          </div>
          <div className="summary-stamp"><Shield size={18} /><div><b>{owners?.length ?? 0} accounts</b><small>{(owners || []).filter((o) => o.is_active).length} active</small></div></div>
        </div>
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Search by name or username" testId="admin-search-input" />
          <button className="button primary desktop-add" onClick={() => setModalOpen(true)} data-testid="desktop-add-owner-button"><UserPlus size={17} /> Onboard owner</button>
        </div>
        <div className="admin-table" data-testid="admin-owners-list">
          <div className="admin-head">
            <span>Owner</span><span>Username</span><span>Mobile</span><span>Shops</span><span>Status</span><span></span>
          </div>
          {owners === null && <div className="empty"><Users size={24} /><b>Loading accounts…</b><span>One moment.</span></div>}
          {owners !== null && filtered.map((o) => (
            <div className={`admin-row ${!o.is_active ? "inactive" : ""}`} key={o.id} data-testid={`admin-row-${o.id}`}>
              <div className="admin-name">
                <div className="avatar soft">{initials(o.name)}</div>
                <div>
                  <b>{o.name}</b>
                  {o.is_admin && <span className="tag admin">Admin</span>}
                </div>
              </div>
              <span className="mono">{o.username}</span>
              <span>{o.mobile_number || "—"}</span>
              <span>{o.shop_count}</span>
              <span>{o.is_active ? <span className="tag active">Active</span> : <span className="tag muted">Deactivated</span>}</span>
              <div className="admin-actions">
                {o.id === owner.id ? (
                  <span className="you-chip">You</span>
                ) : (
                  <button
                    className={o.is_active ? "button danger small" : "button primary small"}
                    onClick={() => toggleActive(o)}
                    data-testid={`toggle-active-${o.id}`}
                  >
                    <Power size={14} /> {o.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {owners !== null && filtered.length === 0 && owners.length > 0 && (
            <div className="empty"><Users size={24} /><b>No matches</b><span>Try another name or username.</span></div>
          )}
        </div>
      </main>
      <button className="fab" onClick={() => setModalOpen(true)} data-testid="add-owner-button"><Plus size={24} /></button>

      {modalOpen && (
        <Modal title="Onboard a new owner" onClose={() => setModalOpen(false)}>
          <p className="modal-copy">Create a fresh login for another shop owner. They can sign in immediately with these credentials.</p>
          <div className="two-col">
            <Field label="Full name" name="owner-name" placeholder="Owner's full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Field label="Mobile · optional" name="owner-mobile" placeholder="10-digit mobile" value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} />
          </div>
          <div className="two-col">
            <Field label="Username (≥3 chars)" name="owner-username" placeholder="e.g. suresh" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <Field label="Temporary password (≥4 chars)" name="owner-password" type="text" placeholder="Share with the owner" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <label className="checkbox-field">
            <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} data-testid="field-is-admin" />
            <span>Grant admin privileges (can manage other owners)</span>
          </label>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModalOpen(false)} data-testid="add-owner-cancel">Cancel</button>
            <button className="button primary" onClick={create} disabled={saving || !formValid} data-testid="add-owner-submit">
              {saving ? "Onboarding…" : "Onboard owner"} <UserPlus size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- root ----------
function App() {
  const [owner, setOwner] = useState(null); // null = unknown/logged out
  const [booted, setBooted] = useState(false);
  const [shop, setShop] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [adminView, setAdminView] = useState(false);

  useEffect(() => {
    (async () => {
      if (API.getToken()) {
        try { setOwner(await API.me()); } catch { API.logout(); }
      }
      setBooted(true);
    })();
  }, []);

  const logout = () => {
    API.logout();
    setOwner(null);
    setShop(null);
    setCustomer(null);
    setAdminView(false);
  };
  const openAdmin = () => setAdminView(true);
  const closeAdmin = () => setAdminView(false);

  if (!booted) return <div className="app-shell" data-testid="app-boot"><div className="empty"><b>Loading…</b></div></div>;

  const isAdminRoute = window.location.pathname.startsWith("/admin");

  if (isAdminRoute) {
    return (
      <BrowserRouter>
        {!owner ? (
          <AdminLogin onLogin={setOwner} />
        ) : owner.is_admin ? (
          <AdminDashboard owner={owner} onBack={() => { window.location.href = "/"; }} onLogout={logout} />
        ) : (
          <div className="app-shell" data-testid="admin-not-authorized">
            <div className="empty">
              <Shield size={24} />
              <b>Not authorized</b>
              <span>This account doesn't have admin access.</span>
              <button className="button secondary" onClick={logout} data-testid="admin-not-authorized-logout">Logout</button>
            </div>
          </div>
        )}
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      {!owner ? (
        <Login onLogin={setOwner} />
      ) : adminView && owner.is_admin ? (
        <AdminDashboard owner={owner} onBack={closeAdmin} onLogout={logout} />
      ) : customer ? (
        <Ledger shop={shop} customer={customer} owner={owner} onBack={() => setCustomer(null)} onLogout={logout} onAdmin={owner.is_admin ? openAdmin : undefined} />
      ) : shop ? (
        <Customers shop={shop} owner={owner} onBack={() => setShop(null)} onSelect={setCustomer} onLogout={logout} onAdmin={owner.is_admin ? openAdmin : undefined} />
      ) : (
        <Organizations owner={owner} onSelect={setShop} onLogout={logout} onAdmin={owner.is_admin ? openAdmin : undefined} />
      )}
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}
export default App;
