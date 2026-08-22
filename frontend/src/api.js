import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = "ae_token";

export const api = axios.create({ baseURL: `${BASE}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function apiErr(e, fallback = "Something went wrong. Please try again.") {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(", ");
  if (d && typeof d.msg === "string") return d.msg;
  return e?.message || fallback;
}

// ---------- auth ----------
export async function login(username, password) {
  const { data } = await api.post("/auth/login", { username, password });
  setToken(data.token);
  return data.owner;
}
export async function me() {
  const { data } = await api.get("/auth/me");
  return data;
}
export function logout() {
  setToken(null);
}

// ---------- organizations ----------
export async function listOrganizations(q = "") {
  const { data } = await api.get("/organizations", { params: q ? { q } : {} });
  return data;
}
export async function createOrganization(payload) {
  const { data } = await api.post("/organizations", payload);
  return data;
}

// ---------- customers ----------
export async function listCustomers(orgId, q = "") {
  const { data } = await api.get(`/organizations/${orgId}/customers`, {
    params: q ? { q } : {},
  });
  return data;
}
export async function createCustomer(orgId, payload) {
  const { data } = await api.post(`/organizations/${orgId}/customers`, payload);
  return data;
}
export async function deleteCustomer(customerId) {
  await api.delete(`/customers/${customerId}`);
}
export async function getCustomer(customerId) {
  const { data } = await api.get(`/customers/${customerId}`);
  return data;
}

// ---------- admin ----------
export async function adminListOwners() {
  const { data } = await api.get("/admin/owners");
  return data;
}
export async function adminCreateOwner(payload) {
  const { data } = await api.post("/admin/owners", payload);
  return data;
}
export async function adminUpdateOwner(id, payload) {
  const { data } = await api.patch(`/admin/owners/${id}`, payload);
  return data;
}

// ---------- transactions ----------
export async function listTransactions(customerId, from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const { data } = await api.get(`/customers/${customerId}/transactions`, { params });
  return data;
}
export async function createTransaction(customerId, payload) {
  const { data } = await api.post(`/customers/${customerId}/transactions`, payload);
  return data;
}
export async function updateTransaction(txId, payload) {
  const { data } = await api.patch(`/transactions/${txId}`, payload);
  return data;
}
export async function deleteTransaction(txId) {
  await api.delete(`/transactions/${txId}`);
}
