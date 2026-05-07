import axios from 'axios';
import { auth } from '../lib/firebase';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

async function getToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function authHeaders() {
  const token = await getToken();
  return { Authorization: `Bearer ${token}` };
}

const api = axios.create({ baseURL: BASE });

// ── Stats ──────────────────────────────────────────────────────────────────
export async function fetchStats() {
  const headers = await authHeaders();
  const { data } = await api.get('/admin/stats', { headers });
  return data;
}

// ── Users ──────────────────────────────────────────────────────────────────
export async function fetchUsers(page = 1, limit = 20, search = '') {
  const headers = await authHeaders();
  const { data } = await api.get('/admin/users', { headers, params: { page, limit, search } });
  return data;
}

export async function fetchUserDetail(userId: number) {
  const headers = await authHeaders();
  const { data } = await api.get(`/admin/users/${userId}`, { headers });
  return data;
}

export async function adjustCredits(userId: number, amount: number, reason: string) {
  const headers = await authHeaders();
  const { data } = await api.post(`/admin/users/${userId}/credits`, { amount, reason }, { headers });
  return data;
}

export async function updateUserStatus(userId: number, status: string) {
  const headers = await authHeaders();
  const { data } = await api.put(`/admin/users/${userId}/status`, { status }, { headers });
  return data;
}

// ── Charge Requests ────────────────────────────────────────────────────────
export async function fetchChargeRequests(statusFilter = 'pending', page = 1, limit = 20) {
  const headers = await authHeaders();
  const { data } = await api.get('/admin/charge-requests', {
    headers,
    params: { status_filter: statusFilter, page, limit },
  });
  return data;
}

export async function reviewChargeRequest(requestId: number, action: 'approve' | 'reject', note?: string) {
  const headers = await authHeaders();
  const { data } = await api.put(`/admin/charge-requests/${requestId}/review`, { action, note }, { headers });
  return data;
}

// ── Sub-Admins ─────────────────────────────────────────────────────────────
export async function fetchSubAdmins() {
  const headers = await authHeaders();
  const { data } = await api.get('/admin/sub-admins', { headers });
  return data;
}

export async function addSubAdmin(payload: { email: string; firebase_uid: string; role: string; can_approve_charges: boolean }) {
  const headers = await authHeaders();
  const { data } = await api.post('/admin/sub-admins', payload, { headers });
  return data;
}

export async function updateSubAdmin(adminId: number, patch: Record<string, unknown>) {
  const headers = await authHeaders();
  const { data } = await api.put(`/admin/sub-admins/${adminId}`, patch, { headers });
  return data;
}

export async function deleteSubAdmin(adminId: number) {
  const headers = await authHeaders();
  const { data } = await api.delete(`/admin/sub-admins/${adminId}`, { headers });
  return data;
}
