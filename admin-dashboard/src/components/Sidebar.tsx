import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, CreditCard, ShieldCheck, LogOut
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../api/admin.api';

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: fetchStats, refetchInterval: 60000 });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/users', icon: <Users size={18} />, label: 'Users' },
    {
      to: '/charge-requests', icon: <CreditCard size={18} />, label: 'Charge Requests',
      badge: stats?.pending_charge_requests > 0 ? stats.pending_charge_requests : undefined,
    },
    { to: '/sub-admins', icon: <ShieldCheck size={18} />, label: 'Sub-Admins' },
  ];

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">⚡</div>
        <div>
          <div className="sidebar-brand-name">Kimit Admin</div>
          <div className="sidebar-brand-sub">Control Panel</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.icon}
            {item.label}
            {item.badge !== undefined && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="admin-user-card">
          <div>
            <div className="admin-user-email" title={user?.email ?? ''}>{user?.email}</div>
            <div className="admin-user-role">Admin</div>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
