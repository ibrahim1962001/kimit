import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchUserDetail, adjustCredits, updateUserStatus } from '../api/admin.api';
import { useToast } from '../components/Toast';
import { ArrowLeft, Plus, Minus, Database, FileText, Ban, Lock, Unlock } from 'lucide-react';

export function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user-detail', id],
    queryFn: () => fetchUserDetail(Number(id)),
  });

  const [creditMode, setCreditMode] = useState<'add' | 'deduct' | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [datasetModal, setDatasetModal] = useState(false);

  const handleCredit = async () => {
    if (!creditMode) return;
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    try {
      await adjustCredits(Number(id), creditMode === 'deduct' ? -amount : amount, creditReason || 'Admin adjustment');
      qc.invalidateQueries({ queryKey: ['user-detail', id] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      showToast('Credits updated successfully');
      setCreditMode(null);
    } catch { showToast('Failed to update credits', 'error'); }
  };

  const handleStatus = async (status: string) => {
    try {
      await updateUserStatus(Number(id), status);
      qc.invalidateQueries({ queryKey: ['user-detail', id] });
      showToast(`Account ${status} successfully`);
    } catch { showToast('Failed', 'error'); }
  };

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!user) return <div className="empty-state"><p>User not found</p></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/users')}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div className="page-title">{user.display_name || user.email}</div>
            <div className="page-sub">{user.email} · uid: {user.firebase_uid}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-success btn-sm" onClick={() => setCreditMode('add')}>
            <Plus size={14} /> Add Credits
          </button>
          <button className="btn btn-warning btn-sm" onClick={() => setCreditMode('deduct')}>
            <Minus size={14} /> Deduct
          </button>
          {user.credit.status === 'active'
            ? <button className="btn btn-warning btn-sm" onClick={() => handleStatus('frozen')}><Lock size={14} /> Freeze</button>
            : <button className="btn btn-success btn-sm" onClick={() => handleStatus('active')}><Unlock size={14} /> Unfreeze</button>
          }
          {user.credit.status !== 'banned' && (
            <button className="btn btn-danger btn-sm" onClick={() => handleStatus('banned')}><Ban size={14} /> Ban</button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* User Info */}
        <div className="detail-card">
          <div className="detail-card-title">Account Info</div>
          <div className="info-row"><span className="info-label">Email</span><span className="info-value">{user.email}</span></div>
          <div className="info-row"><span className="info-label">Name</span><span className="info-value">{user.display_name || '—'}</span></div>
          <div className="info-row"><span className="info-label">Plan</span><span className="badge active">{user.plan}</span></div>
          <div className="info-row"><span className="info-label">Status</span><span className={`badge ${user.credit.status}`}>{user.credit.status}</span></div>
          <div className="info-row"><span className="info-label">Joined</span><span className="info-value">{new Date(user.created_at).toLocaleDateString()}</span></div>
        </div>

        {/* Credit Info */}
        <div className="detail-card">
          <div className="detail-card-title">Credit Balance</div>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="credit-balance">{user.credit.balance.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Available Credits</div>
          </div>
          <div className="info-row">
            <span className="info-label">Transactions</span>
            <span className="info-value">{user.transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Datasets */}
      <div className="table-card" style={{ marginBottom: 24 }}>
        <div className="table-card-header">
          <div className="table-card-title">
            <Database size={16} style={{ display: 'inline', marginRight: 8 }} />
            Uploaded Datasets ({user.datasets.length})
          </div>
          {user.datasets.length > 5 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setDatasetModal(true)}>View All</button>
          )}
        </div>
        {user.datasets.length === 0 ? (
          <div className="empty-state"><Database size={32} /><p>No datasets uploaded yet</p></div>
        ) : (
          <div style={{ padding: '16px' }}>
            {user.datasets.slice(0, 5).map((d: any) => (
              <div key={d.id} className="dataset-item">
                <div className="dataset-icon"><FileText size={16} /></div>
                <div>
                  <div className="dataset-name">{d.filename}</div>
                  <div className="dataset-meta">{d.row_count.toLocaleString()} rows · {d.col_count} cols · {d.source} · {new Date(d.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">Credit Transactions</div>
        </div>
        {user.transactions.length === 0 ? (
          <div className="empty-state"><p>No transactions yet</p></div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Amount</th><th>Reason</th><th>By</th><th>Date</th></tr></thead>
            <tbody>
              {user.transactions.map((t: any) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 800, color: t.amount > 0 ? '#34d399' : '#f87171' }}>
                    {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
                  </td>
                  <td>{t.reason || '—'}</td>
                  <td style={{ fontSize: 11, color: '#64748b' }}>{t.performed_by?.slice(0, 12) ?? 'system'}...</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Credit Modal */}
      {creditMode && (
        <div className="modal-overlay" onClick={() => setCreditMode(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{creditMode === 'add' ? '➕ Add Credits' : '➖ Deduct Credits'}</span>
              <button className="modal-close" onClick={() => setCreditMode(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Amount</label>
              <input className="form-input" type="number" min="0.1" step="0.1" placeholder="e.g. 50"
                value={creditAmount} onChange={e => setCreditAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <input className="form-input" placeholder="Optional reason" value={creditReason} onChange={e => setCreditReason(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setCreditMode(null)}>Cancel</button>
              <button className={`btn ${creditMode === 'add' ? 'btn-success' : 'btn-warning'}`} onClick={handleCredit}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Datasets Modal */}
      {datasetModal && (
        <div className="modal-overlay" onClick={() => setDatasetModal(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">All Datasets ({user.datasets.length})</span>
              <button className="modal-close" onClick={() => setDatasetModal(false)}>✕</button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {user.datasets.map((d: any) => (
                <div key={d.id} className="dataset-item">
                  <div className="dataset-icon"><FileText size={16} /></div>
                  <div>
                    <div className="dataset-name">{d.filename}</div>
                    <div className="dataset-meta">{d.row_count.toLocaleString()} rows · {d.col_count} cols · {d.source} · {new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
