import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import {
  ArrowLeft, BookOpen, CalendarDays, ChevronDown, ChevronUp, ClipboardList,
  LogOut, MapPin, MessageCircle, Pencil, Plus, Printer, Search, Store,
  UserRound, Users, X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
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
function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" data-testid="modal-backdrop">
      <div className="modal" data-testid="form-modal">
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
function Topbar({ title, subtitle, onBack, onLogout, ownerName }) {
  const chip = ownerName || "Owner";
  return (
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><BookOpen size={18} /></div><span>AccountEase</span></div>
      <div className="topbar-right">
        <div className="user-chip"><div className="avatar">{initials(chip)}</div><div><b>{chip}</b><small>Owner account</small></div></div>
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
            <span>{fmtDate(r.date)}<small>{r.item}</small></span>
            <b>{INR(r.amount)}</b>
          </div>
        ))}
        <div className="print-total"><span>Current balance</span><b>{INR(balance)}</b></div>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose} data-testid="print-close-button">Close</button>
        <button className="button primary" onClick={() => { window.print(); toast.success("Print dialog opened"); }} data-testid="print-confirm-button"><Printer size={16} /> Print statement</button>
      </div>
    </Modal>
  );
}

function RecordFormModal({ mode, initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial);
  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const disabled = saving || !form.item.trim() || form.amount === "" || form.balance === "";
  return (
    <Modal title={mode === "edit" ? "Edit ledger record" : "Add ledger record"} onClose={onClose}>
      <p className="modal-copy">Record the transaction and manual running balance for this customer.</p>
      <div className="two-col">
        <Field label="Date" name="record-date" type="date" value={form.date} onChange={update("date")} />
        <Field label="Item" name="record-item" placeholder="What was purchased?" value={form.item} onChange={update("item")} />
      </div>
      <div className="two-col">
        <Field label="Quantity" name="record-quantity" value={form.quantity} onChange={update("quantity")} />
        <Field label="Rate" name="record-rate" placeholder="0" value={form.rate} onChange={update("rate")} />
      </div>
      <div className="two-col">
        <Field label="Amount" name="record-amount" placeholder="0" value={form.amount} onChange={update("amount")} />
        <Field label="Manual balance" name="record-balance" placeholder="0" value={form.balance} onChange={update("balance")} />
      </div>
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
        <small className="login-footer">Private ledger workspace · Built for everyday business</small>
      </div>
    </main>
  );
}

function Organizations({ owner, onSelect, onLogout }) {
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
      <Topbar onLogout={onLogout} ownerName={owner?.name} />
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

function Customers({ shop, owner, onBack, onSelect, onLogout }) {
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
      <Topbar title={shop.name} subtitle="Customer book" onBack={onBack} onLogout={onLogout} ownerName={owner?.name} />
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

function Ledger({ shop, customer, owner, onBack, onLogout }) {
  const [records, setRecords] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(customer.balance);
  const [open, setOpen] = useState(-1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });
  const [entryOpen, setEntryOpen] = useState(false);
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
      quantity: form.quantity || "1",
      rate: form.rate || "0",
      amount: form.amount || "0",
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

  const entryInitial = editing
    ? { date: editing.date, item: editing.item, quantity: String(editing.quantity ?? "1"), rate: String(editing.rate ?? ""), amount: String(editing.amount ?? ""), balance: String(editing.balance ?? "") }
    : { date: isoToday(), item: "", quantity: "1", rate: "", amount: "", balance: "" };

  return (
    <div className="app-shell">
      <Topbar title={customer.name} subtitle="Customer ledger" onBack={onBack} onLogout={onLogout} ownerName={owner?.name} />
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
          <div className="balance-box"><small>Running balance</small><b>{INR(balance)}</b><span>manually recorded</span></div>
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
          <button className="text-action" onClick={() => window.print()} data-testid="print-all-records-button"><Printer size={16} /> Print all</button>
        </div>
        <div className="records-list" data-testid="ledger-records-list">
          {records === null && <div className="empty"><ClipboardList size={25} /><b>Loading records…</b><span>One moment.</span></div>}
          {records !== null && records.map((r, i) => (
            <div className={`record ${open === i ? "expanded" : ""}`} key={r.id}>
              <button className="record-header" onClick={() => setOpen(open === i ? -1 : i)} data-testid={`ledger-record-${i}`}>
                <span className="record-date"><span className="record-dot" /><b>{fmtDate(r.date)}</b><small>{r.item}</small></span>
                <span className="record-balance"><b>{INR(r.balance)}</b><small>balance</small></span>
                {open === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {open === i && (
                <div className="record-detail" data-testid={`ledger-record-detail-${i}`}>
                  <div><span>Item</span><b>{r.item}</b></div>
                  <div><span>Quantity</span><b>{r.quantity}</b></div>
                  <div><span>Rate</span><b>{INR(r.rate)}</b></div>
                  <div><span>Amount</span><b>{INR(r.amount)}</b></div>
                  <div className="detail-balance"><span>Balance after entry</span><b>{INR(r.balance)}</b></div>
                  <div className="record-actions">
                    <button className="whatsapp-small" onClick={() => shareToMobile(customer.mobile_number, `AccountEase statement for ${customer.name}\n${fmtDate(r.date)} · ${r.item}\nAmount: ${INR(r.amount)}\nBalance: ${INR(r.balance)}`)} data-testid={`whatsapp-record-${i}`}><MessageCircle size={16} /> Share</button>
                    <button className="edit-small" onClick={() => startEdit(r)} data-testid={`edit-record-${i}`}><Pencil size={15} /> Edit</button>
                    <button className="delete-small" onClick={() => removeRecord(r)} data-testid={`delete-record-${i}`}><X size={15} /> Delete</button>
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
      <button className="whatsapp-fab" onClick={() => shareToMobile(customer.mobile_number, `AccountEase statement\nCustomer: ${customer.name}\nMobile: ${customer.mobile_number}\nCurrent balance: ${INR(balance)}\n\n${(records || []).map((r) => `${fmtDate(r.date)} · ${r.item} · ${INR(r.amount)} · Balance ${INR(r.balance)}`).join("\n")}`)} data-testid="whatsapp-all-records-button">
        <MessageCircle size={24} /><span>Share on WhatsApp</span>
      </button>
      <button className="fab" onClick={() => { setEditing(null); setEntryOpen(true); }} data-testid="add-ledger-record-button"><Plus size={24} /></button>
      {entryOpen && <RecordFormModal mode={editing ? "edit" : "add"} initial={entryInitial} onClose={() => { setEntryOpen(false); setEditing(null); }} onSave={saveRecord} saving={saving} />}
    </div>
  );
}

// ---------- root ----------
function App() {
  const [owner, setOwner] = useState(null); // null = unknown/logged out
  const [booted, setBooted] = useState(false);
  const [shop, setShop] = useState(null);
  const [customer, setCustomer] = useState(null);

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
  };

  if (!booted) return <div className="app-shell" data-testid="app-boot"><div className="empty"><b>Loading…</b></div></div>;

  return (
    <BrowserRouter>
      {!owner ? (
        <Login onLogin={setOwner} />
      ) : customer ? (
        <Ledger shop={shop} customer={customer} owner={owner} onBack={() => setCustomer(null)} onLogout={logout} />
      ) : shop ? (
        <Customers shop={shop} owner={owner} onBack={() => setShop(null)} onSelect={setCustomer} onLogout={logout} />
      ) : (
        <Organizations owner={owner} onSelect={setShop} onLogout={logout} />
      )}
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}
export default App;
