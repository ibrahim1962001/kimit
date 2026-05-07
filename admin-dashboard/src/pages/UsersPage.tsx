import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchUsers, updateUserStatus, adjustCredits } from '../api/admin.api';
import { useToast } from '../components/Toast';
import { Search, Eye, Plus, Minus, Ban, Lock, Unlock, Database, Users as UsersIcon } from 'lucide-react';

type User = {
  id: number; email: string; display_name: string | null; plan: string;
  credit_balance: number; credit_status: string; dataset_count: number;
  created_at: string; firebase_uid: string;
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

export function UsersPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creditModal, setCreditModal] = useState<{ user: User; mode: 'add' | 'deduct' } | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => fetchUsers(page, 20, search),
  });

  const handleStatusChange = async (user: User, newStatus: string) => {
    try {
      await updateUserStatus(user.id, newStatus);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      showToast(`User ${newStatus} successfully`);
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleCredit = async () => {
    if (!creditModal) return;
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    try {
      const finalAmount = creditModal.mode === 'deduct' ? -amount : amount;
      await adjustCredits(creditModal.user.id, finalAmount, creditReason || 'Admin adjustment');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      showToast(`Credits ${creditModal.mode === 'add' ? 'added' : 'deducted'} successfully`);
      setCreditModal(null);
      setCreditAmount('');
      setCreditReason('');
    } catch {
      showToast('Failed to adjust credits', 'error');
    }
  };

  const users: User[] = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Users Management</div>
          <div className="page-sub">{total} total registered users</div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">All Users</div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#3d5570' }} />
            <input
              className="search-input"
              style={{ paddingLeft: '34px' }}
              placeholder="Search by email or name..."
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div className="empty-state"><UsersIcon size={40} /><p>No users found</p></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Credits</th>
                <th>Status</th>
                <th>Datasets</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{u.display_name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{u.email}</div>
                  </td>
                  <td><span className="badge active">{u.plan}</span></td>
                  <td>
                    <span style={{ fontWeight: 800, color: '#00e5ff' }}>{u.credit_balance.toFixed(1)}</span>
                  </td>
                  <td><StatusBadge status={u.credit_status} /></td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Database size={12} color="#64748b" /> {u.dataset_count}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/users/${u.id}`)} title="View Detail">
                        <Eye size={12} />
                      </button>
                      <button className="btn btn-success btn-sm" onClick={() => { setCreditModal({ user: u, mode: 'add' }); setCreditAmount(''); setCreditReason(''); }} title="Add Credits">
                        <Plus size={12} />
                      </button>
                      <button className="btn btn-warning btn-sm" onClick={() => { setCreditModal({ user: u, mode: 'deduct' }); setCreditAmount(''); setCreditReason(''); }} title="Deduct Credits">
                        <Minus size={12} />
                      </button>
                      {u.credit_status === 'active'
                        ? <button className="btn btn-warning btn-sm" onClick={() => handleStatusChange(u, 'frozen')} title="Freeze"><Lock size={12} /></button>
                        : u.credit_status === 'frozen'
                          ? <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(u, 'active')} title="Unfreeze"><Unlock size={12} /></button>
                          : null
                      }
                      {u.credit_status !== 'banned' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange(u, 'banned')} title="Ban">
                          <Ban size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <span className="page-info">Page {page} of {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Credit Adjustment Modal */}
      {creditModal && (
        <div className="modal-overlay" onClick={() => setCreditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {creditModal.mode === 'add' ? '➕ Add Credits' : '➖ Deduct Credits'}
              </span>
              <button className="modal-close" onClick={() => setCreditModal(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              User: <strong style={{ color: '#fff' }}>{creditModal.user.email}</strong>
              {' — '}Current balance: <strong style={{ color: '#00e5ff' }}>{creditModal.user.credit_balance.toFixed(1)}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Amount</label>
              <input className="form-input" type="number" min="0.1" step="0.1" placeholder="e.g. 50"
                value={creditAmount} onChange={(e: ChangeEvent<HTMLInputElement>) => setCreditAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reason (optional)</label>
              <input className="form-input" placeholder="e.g. Manual top-up, Refund..."
                value={creditReason} onChange={(e: ChangeEvent<HTMLInputElement>) => setCreditReason(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setCreditModal(null)}>Cancel</button>
              <button
                className={`btn ${creditModal.mode === 'add' ? 'btn-success' : 'btn-warning'}`}
                onClick={handleCredit}
              >
                {creditModal.mode === 'add' ? 'Add Credits' : 'Deduct Credits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
