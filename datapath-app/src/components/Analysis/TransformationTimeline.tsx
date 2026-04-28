import React from 'react';
import { useKimitData } from '../../contexts/DataContext';
import { RotateCcw, History } from 'lucide-react';

export const TransformationTimeline: React.FC = () => {
  const { history, rollback } = useKimitData();

  if (history.length === 0) return null;

  return (
    <div className="glass-panel" style={{ 
      background: 'rgba(16, 185, 129, 0.03)', 
      border: '1px solid rgba(16, 185, 129, 0.2)', 
      padding: '12px 20px', 
      borderRadius: '12px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '20px',
      animation: 'slideDown 0.4s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#10b981' }}>
        <div style={{ padding: 8, background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%' }}>
          <History size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>Undo Engine Active</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>{history.length} snapshot(s) available for rollback.</div>
        </div>
      </div>
      
      <button 
        onClick={rollback}
        className="premium-button"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          background: '#10b981', 
          color: '#020617', 
          border: 'none', 
          padding: '8px 16px', 
          borderRadius: '8px', 
          cursor: 'pointer', 
          fontWeight: 700, 
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
        }}
      >
        <RotateCcw size={16} /> Undo Last Transformation
      </button>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
