import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchChargeRequests, reviewChargeRequest } from '../api/admin.api';
import { useToast } from '../components/Toast';
import { Check, X, Eye } from 'lucide-react';

type ChargeRequest = {
  id: number; user_email: string; user_name: string | null; user_id: number;
  amount: number; transfer_number: string | null; screenshot_url: string | null;
  notes: string | null; status: string; review_note: string | null;
  reviewed_by: string | null; created_at: string; reviewed_at: string | null;
};

export function ChargeRequestsPage() {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<ChargeRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['charge-requests', tab, page],
    queryFn: () => fetchChargeRequests(tab, page),
    refetchInterval: 30000,
  });

  const handleReview = async (id: number, action: 'approve' | 'reject', note?: string) => {
    try {
      await reviewChargeRequest(id, action, note);
      qc.invalidateQueries({ queryKey: ['charge-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      showToast(`Request ${action}d successfully`);
      setRejectTarget(null);
      setRejectNote('');
    } catch {
      showToast('Failed to process request', 'error');
    }
  };

  const requests: ChargeRequest[] = data?.requests ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Charge Requests</div>
          <div className="page-sub">Manual credit top-up review and approval</div>
        </div>
      </div>

      <div className="tabs">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setPage(1); }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="table-card">
        {isLoading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state"><p>No {tab} requests</p></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Amount</th>
                <th>Transfer Ref</th>
                <th>Screenshot</th>
                <th>Status</th>
                <th>Date</th>
                {tab === 'pending' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: '#64748b' }}>#{r.id}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.user_name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{r.user_email}</div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 900, fontSize: 16, color: '#fbbf24' }}>
                      {r.amount.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>Credits</span>
                  </td>
                  <td>
                    {r.transfer_number
                      ? <code style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>{r.transfer_number}</code>
                      : <span style={{ color: '#3d5570' }}>—</span>
                    }
                  </td>
                  <td>
                    {r.screenshot_url ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => setPreview(r)}>
                        <Eye size={12} /> View
                      </button>
                    ) : <span style={{ color: '#3d5570' }}>—</span>}
                  </td>
                  <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  {tab === 'pending' && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success btn-sm" onClick={() => handleReview(r.id, 'approve')} title="Approve">
                          <Check size={12} /> Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setRejectTarget(r.id)} title="Reject">
                          <X size={12} /> Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <span className="page-info">Page {page} of {totalPages} — {total} total</span>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Screenshot Preview Modal */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Transfer Screenshot — Request #{preview.id}</span>
              <button className="modal-close" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div style={{ marginBottom: 16, fontSize: 13, color: '#94a3b8' }}>
              <strong style={{ color: '#fff' }}>{preview.user_email}</strong> · Amount: <strong style={{ color: '#fbbf24' }}>{preview.amount}</strong> credits
              {preview.transfer_number && <> · Ref: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>{preview.transfer_number}</code></>}
              {preview.notes && <div style={{ marginTop: 8, padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>📝 {preview.notes}</div>}
            </div>
            <img
              src={preview.screenshot_url!}
              alt="Transfer screenshot"
              className="screenshot-preview"
              onClick={() => window.open(preview.screenshot_url!, '_blank')}
            />
            {preview.status === 'pending' && (
              <div className="modal-footer">
                <button className="btn btn-danger" onClick={() => { setPreview(null); setRejectTarget(preview.id); }}>
                  <X size={14} /> Reject
                </button>
                <button className="btn btn-success" onClick={() => { handleReview(preview.id, 'approve'); setPreview(null); }}>
                  <Check size={14} /> Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Note Modal */}
      {rejectTarget !== null && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Reject Request #{rejectTarget}</span>
              <button className="modal-close" onClick={() => setRejectTarget(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Rejection Reason (optional)</label>
              <textarea className="form-textarea" placeholder="e.g. Transfer not found, incorrect amount..."
                value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleReview(rejectTarget, 'reject', rejectNote)}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
