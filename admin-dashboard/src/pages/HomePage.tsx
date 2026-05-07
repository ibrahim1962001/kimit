import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../api/admin.api';
import { Users, CreditCard, Database, Clock } from 'lucide-react';

export function HomePage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: fetchStats });

  const cards = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: <Users size={22} />, color: 'cyan' },
    { label: 'Credits Issued', value: `${(stats?.total_credits_issued ?? 0).toFixed(0)}`, icon: <CreditCard size={22} />, color: 'green' },
    { label: 'Pending Requests', value: stats?.pending_charge_requests ?? 0, icon: <Clock size={22} />, color: 'amber' },
    { label: 'Total Datasets', value: stats?.total_datasets ?? 0, icon: <Database size={22} />, color: 'purple' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard Overview</div>
          <div className="page-sub">Welcome back, Admin — here's what's happening</div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <div className="stats-grid">
          {cards.map(card => (
            <div key={card.label} className={`stat-card ${card.color}`}>
              <div className="stat-card-icon">{card.icon}</div>
              <div className="stat-card-value">{card.value.toLocaleString()}</div>
              <div className="stat-card-label">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '32px', marginTop: '8px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a href="/users" className="btn btn-ghost">👥 Manage Users</a>
          <a href="/charge-requests" className="btn btn-warning">💰 Review Charge Requests</a>
          <a href="/sub-admins" className="btn btn-ghost">🛡️ Manage Sub-Admins</a>
        </div>
      </div>
    </div>
  );
}
