import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSubAdmins, addSubAdmin, updateSubAdmin, deleteSubAdmin } from '../api/admin.api';
import { useToast } from '../components/Toast';
import { Plus, Trash2, Shield, ToggleLeft, ToggleRight } from 'lucide-react';

type AdminUser = {
  id: number; email: string; firebase_uid: string;
  role: string; is_active: boolean; can_approve_charges: boolean; created_at: string;
};

export function SubAdminsPage() {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ email: '', firebase_uid: '', role: 'sub_admin', can_approve_charges: true });

  const { data: admins = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['sub-admins'],
    queryFn: fetchSubAdmins,
  });

  const handleAdd = async () => {
    if (!form.email || !form.firebase_uid) { showToast('Email and UID are required', 'error'); return; }
    try {
      await addSubAdmin(form);
      qc.invalidateQueries({ queryKey: ['sub-admins'] });
      showToast('Admin added successfully');
      setAddModal(false);
      setForm({ email: '', firebase_uid: '', role: 'sub_admin', can_approve_charges: true });
    } catch (e: any) {
      showToast(e?.response?.data?.detail || 'Failed to add admin', 'error');
    }
  };

  const handleToggle = async (admin: AdminUser, field: 'is_active' | 'can_approve_charges') => {
    try {
      await updateSubAdmin(admin.id, { [field]: !admin[field] });
      qc.invalidateQueries({ queryKey: ['sub-admins'] });
      showToast('Updated successfully');
    } catch { showToast('Failed', 'error'); }
  };

  const handleDelete = async (admin: AdminUser) => {
    if (!confirm(`Remove admin access for ${admin.email}?`)) return;
    try {
      await deleteSubAdmin(admin.id);
      qc.invalidateQueries({ queryKey: ['sub-admins'] });
      showToast('Admin removed');
    } catch { showToast('Failed', 'error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Sub-Admins</div>
          <div className="page-sub">Manage team members and their permissions</div>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>
          <Plus size={16} /> Add Sub-Admin
        </button>
      </div>

      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title"><Shield size={16} style={{ display: 'inline', marginRight: 8 }} />Team Members</div>
        </div>

        {isLoading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : admins.length === 0 ? (
          <div className="empty-state"><Shield size={40} /><p>No sub-admins yet</p></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th>Can Approve Charges</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{a.email}</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{a.firebase_uid.slice(0, 20)}...</div>
                  </td>
                  <td><span className={`badge ${a.role}`}>{a.role}</span></td>
                  <td>
                    <button
                      className={`btn btn-sm ${a.is_active ? 'btn-success' : 'btn-ghost'}`}
                      onClick={() => handleToggle(a, 'is_active')}
                      style={{ gap: 4 }}
                    >
                      {a.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {a.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${a.can_approve_charges ? 'btn-success' : 'btn-ghost'}`}
                      onClick={() => handleToggle(a, 'can_approve_charges')}
                    >
                      {a.can_approve_charges ? '✅ Yes' : '❌ No'}
                    </button>
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(a.created_at).toLocaleDateString()}</td>
                  <td>
                    {a.role !== 'super_admin' && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Sub-Admin Modal */}
      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">➕ Add Sub-Admin</span>
              <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="admin@example.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Firebase UID</label>
              <input className="form-input" placeholder="Get from Firebase Console"
                value={form.firebase_uid} onChange={e => setForm(f => ({ ...f, firebase_uid: e.target.value }))} />
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                Find in Firebase Console → Authentication → Users
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="sub_admin">Sub Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="checkbox" id="can_approve"
                checked={form.can_approve_charges}
                onChange={e => setForm(f => ({ ...f, can_approve_charges: e.target.checked }))}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="can_approve" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Can approve charge requests
              </label>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Add Admin</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
