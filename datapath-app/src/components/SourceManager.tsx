/**
 * SourceManager.tsx — Database Integration Layer
 *
 * A premium "Source Manager" component that allows users to switch between:
 *   - File Upload (CSV / Excel / JSON)
 *   - External API / SQL Database (UI-ready template)
 *   - Google Sheets (integration hook placeholder)
 *
 * The component is fully styled with the Kimit Dark/Gold theme and is
 * designed for future back-end integration via the onConnect callback.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Upload, Sheet, Globe, ChevronRight,
  Check, Loader2, AlertCircle, Wifi, WifiOff,
  Plug, Server, Key, Eye, EyeOff, RefreshCw,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceType = 'file' | 'sql' | 'api' | 'sheets';

interface DataSource {
  id: SourceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  available: boolean;
}

interface SQLConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  query: string;
}

interface APIConfig {
  url: string;
  method: 'GET' | 'POST';
  headers: string;
  body: string;
  dataPath: string;
}

interface SourceManagerProps {
  /** Called when user selects file upload mode */
  onFileUploadMode?: () => void;
  /** Called when external source connection is initiated */
  onConnect?: (type: SourceType, config: SQLConfig | APIConfig | null) => Promise<void>;
  /** Current active source type */
  activeSource?: SourceType;
  /** Callback on successful data import */
  onSuccess?: (result: any) => void;
}

// ── Source Definitions ────────────────────────────────────────────────────────

const SOURCES: DataSource[] = [
  {
    id: 'file',
    label: 'File Upload',
    description: 'CSV, Excel (.xlsx), or JSON files — up to 50 MB',
    icon: <Upload size={20} />,
    badge: 'Active',
    badgeColor: '#10b981',
    available: true,
  },
  {
    id: 'sql',
    label: 'SQL Database',
    description: 'Connect to PostgreSQL, MySQL, or SQLite via connection string',
    icon: <Database size={20} />,
    badge: 'Pro',
    badgeColor: '#d4af37',
    available: true,
  },
  {
    id: 'api',
    label: 'REST / GraphQL API',
    description: 'Fetch live data from any REST endpoint or GraphQL query',
    icon: <Globe size={20} />,
    badge: 'Pro',
    badgeColor: '#d4af37',
    available: true,
  },
  {
    id: 'sheets',
    label: 'Google Sheets',
    description: 'Import data directly from a shared Google Sheets document',
    icon: <Sheet size={20} />,
    badge: 'New',
    badgeColor: '#10b981',
    available: true,
  },
];

// ── SQL Config Form ────────────────────────────────────────────────────────────

const SQLConfigForm: React.FC<{
  config: SQLConfig;
  onChange: (c: SQLConfig) => void;
  showPass: boolean;
  onTogglePass: () => void;
}> = ({ config, onChange, showPass, onTogglePass }) => {
  const field = (
    label: string,
    key: keyof SQLConfig,
    placeholder: string,
    type: string = 'text',
    mono: boolean = false
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type === 'password' ? (showPass ? 'text' : 'password') : type}
          value={config[key]}
          onChange={e => onChange({ ...config, [key]: e.target.value })}
          placeholder={placeholder}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#070c18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '9px 12px', paddingRight: type === 'password' ? 36 : 12,
            color: '#e2e8f0', fontSize: mono ? 12 : 13,
            fontFamily: mono ? 'monospace' : 'inherit', outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={onTogglePass}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0 }}>
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
        {field('Host / IP', 'host', 'localhost')}
        {field('Port', 'port', '5432')}
      </div>
      {field('Database Name', 'database', 'production_db')}
      {field('Username', 'username', 'admin')}
      {field('Password', 'password', '••••••••', 'password')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          SQL Query
        </label>
        <textarea
          value={config.query}
          onChange={e => onChange({ ...config, query: e.target.value })}
          rows={3}
          placeholder="SELECT * FROM sales LIMIT 10000;"
          style={{
            background: '#070c18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '9px 12px', color: '#e2e8f0',
            fontSize: 12, fontFamily: 'monospace', outline: 'none',
            resize: 'vertical', transition: 'border-color 0.2s',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
      </div>
    </div>
  );
};

// ── API Config Form ───────────────────────────────────────────────────────────

const APIConfigForm: React.FC<{
  config: APIConfig;
  onChange: (c: APIConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10 }}>
        <select
          value={config.method}
          onChange={e => onChange({ ...config, method: e.target.value as 'GET' | 'POST' })}
          style={{
            background: '#070c18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '9px 12px', color: '#d4af37',
            fontSize: 12, fontWeight: 700, outline: 'none',
          }}
        >
          <option>GET</option>
          <option>POST</option>
        </select>
        <input
          type="url"
          value={config.url}
          onChange={e => onChange({ ...config, url: e.target.value })}
          placeholder="https://api.example.com/v1/data"
          style={{
            background: '#070c18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '9px 12px', color: '#e2e8f0',
            fontSize: 13, outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Headers (JSON)
        </label>
        <textarea
          value={config.headers}
          onChange={e => onChange({ ...config, headers: e.target.value })}
          rows={2}
          placeholder={'{ "Authorization": "Bearer TOKEN", "Content-Type": "application/json" }'}
          style={{
            background: '#070c18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '9px 12px', color: '#e2e8f0',
            fontSize: 11, fontFamily: 'monospace', outline: 'none', resize: 'vertical',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Response Data Path (JSONPath)
        </label>
        <input
          type="text"
          value={config.dataPath}
          onChange={e => onChange({ ...config, dataPath: e.target.value })}
          placeholder="data.results  or  $.records[*]"
          style={{
            background: '#070c18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '9px 12px', color: '#e2e8f0',
            fontSize: 13, outline: 'none', fontFamily: 'monospace',
          }}
        />
      </div>
    </div>
  );
};

// ── Google Sheets Config Form ────────────────────────────────────────────────
const SheetsConfigForm: React.FC<{
  url: string;
  onChange: (url: string) => void;
}> = ({ url, onChange }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Google Sheet URL
        </label>
        <input
          type="url"
          value={url}
          onChange={e => onChange(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/.../edit"
          style={{
            background: '#070c18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '9px 12px', color: '#e2e8f0',
            fontSize: 13, outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        <p style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
          Ensure the sheet is "Public" or "Anyone with the link can view".
        </p>
      </div>
    </div>
  );
};

// ── Connection Status Banner ───────────────────────────────────────────────────

const StatusBanner: React.FC<{ status: 'idle' | 'connecting' | 'connected' | 'error'; message: string }> = ({ status, message }) => {
  const config = {
    idle:       { icon: <Plug size={13} />,      color: '#475569', bg: 'rgba(71,85,105,0.1)',    border: 'rgba(71,85,105,0.2)'     },
    connecting: { icon: <Loader2 size={13} className="spin" />, color: '#d4af37', bg: 'rgba(212,175,55,0.08)', border: 'rgba(212,175,55,0.25)' },
    connected:  { icon: <Wifi size={13} />,       color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)'   },
    error:      { icon: <WifiOff size={13} />,    color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)'    },
  }[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
        borderRadius: 10, background: config.bg, border: `1px solid ${config.border}`,
        fontSize: 11, color: config.color, fontWeight: 600,
      }}
    >
      {config.icon} {message}
    </motion.div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const SourceManager: React.FC<SourceManagerProps> = ({
  onFileUploadMode,
  onConnect,
  onSuccess,
  activeSource = 'file',
}) => {
  const [selected, setSelected] = useState<SourceType>(activeSource);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Not connected');
  const [showPassword, setShowPassword] = useState(false);

  const [sqlConfig, setSqlConfig] = useState<SQLConfig>({
    host: '', port: '5432', database: '', username: '', password: '', query: 'SELECT * FROM table LIMIT 10000;',
  });
  const [apiConfig, setApiConfig] = useState<APIConfig>({
    url: '', method: 'GET', headers: '{}', body: '', dataPath: 'data',
  });
  const [sheetsUrl, setSheetsUrl] = useState('');

  const handleSelect = (id: SourceType) => {
    if (!SOURCES.find(s => s.id === id)?.available) return;
    setSelected(id);
    setConnectionStatus('idle');
    setStatusMessage('Not connected');
    if (id === 'file' && onFileUploadMode) onFileUploadMode();
  };

  const handleConnect = async () => {
    if (!onConnect) {
      // Demo mode — simulate connection
      setConnectionStatus('connecting');
      setStatusMessage('Establishing connection…');
      await new Promise(r => setTimeout(r, 1800));
      // Randomly succeed or show credential error for demo
      const success = selected === 'api'
        ? apiConfig.url.startsWith('http')
        : sqlConfig.host.length > 0;
      if (success) {
        setConnectionStatus('connected');
        setStatusMessage(`Connected to ${selected === 'sql' ? sqlConfig.host : apiConfig.url}`);
      } else {
        setConnectionStatus('error');
        setStatusMessage('Connection failed — check your credentials and try again');
      }
      return;
    }
    setConnectionStatus('connecting');
    setStatusMessage('Establishing connection…');
    try {
      if (selected === 'sheets') {
        const { datasetsApi } = await import('../api/datasets.api');
        const result = await datasetsApi.importSheets(sheetsUrl);
        if (onSuccess) onSuccess(result);
        // If onConnect exists, we might still want to call it or just use the result
        if (onConnect) await onConnect(selected, null);
      } else {
        await onConnect(selected, selected === 'sql' ? sqlConfig : apiConfig);
      }
      setConnectionStatus('connected');
      setStatusMessage('Successfully connected!');
    } catch (err) {
      setConnectionStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const canConnect = selected === 'sql'
    ? sqlConfig.host.length > 0 && sqlConfig.database.length > 0
    : selected === 'api'
    ? apiConfig.url.length > 0
    : selected === 'sheets'
    ? sheetsUrl.length > 0
    : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Source Selector Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {SOURCES.map(source => {
          const isSelected = selected === source.id;
          const isAvail = source.available;
          return (
            <motion.div
              key={source.id}
              whileHover={isAvail ? { y: -2 } : {}}
              whileTap={isAvail ? { scale: 0.97 } : {}}
              onClick={() => handleSelect(source.id)}
              style={{
                padding: '14px', borderRadius: 12, cursor: isAvail ? 'pointer' : 'not-allowed',
                border: `1px solid ${isSelected ? 'rgba(212,175,55,0.45)' : 'rgba(255,255,255,0.06)'}`,
                background: isSelected
                  ? 'rgba(212,175,55,0.06)'
                  : 'rgba(255,255,255,0.02)',
                opacity: isAvail ? 1 : 0.5,
                transition: 'all 0.2s',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: 'linear-gradient(90deg, #d4af37, #a3820a)',
                }} />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: isSelected ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isSelected ? '#d4af37' : '#64748b', transition: 'all 0.2s',
                }}>
                  {source.icon}
                </div>
                {isSelected && <Check size={12} color="#d4af37" />}
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#e2e8f0' : '#94a3b8', marginBottom: 3 }}>
                {source.label}
              </div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>
                {source.description}
              </div>

              {source.badge && (
                <span style={{
                  display: 'inline-block', marginTop: 8, fontSize: 8, fontWeight: 800,
                  padding: '2px 6px', borderRadius: 4,
                  background: `${source.badgeColor}22`,
                  color: source.badgeColor,
                  border: `1px solid ${source.badgeColor}44`,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {source.badge}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Configuration Panel ── */}
      <AnimatePresence mode="wait">
        {selected === 'sql' && (
          <motion.div
            key="sql"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={14} color="#d4af37" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#d4af37' }}>SQL Connection</span>
            </div>

            {/* Database type pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {['PostgreSQL', 'MySQL', 'SQLite', 'MSSQL'].map(db => (
                <span key={db} style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#64748b', cursor: 'pointer',
                }}>
                  {db}
                </span>
              ))}
            </div>

            <SQLConfigForm
              config={sqlConfig}
              onChange={setSqlConfig}
              showPass={showPassword}
              onTogglePass={() => setShowPassword(v => !v)}
            />
          </motion.div>
        )}

        {selected === 'api' && (
          <motion.div
            key="api"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={14} color="#d4af37" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#d4af37' }}>API Configuration</span>
            </div>
            <APIConfigForm config={apiConfig} onChange={setApiConfig} />
          </motion.div>
        )}

        {selected === 'file' && (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '20px', borderRadius: 12, textAlign: 'center',
              background: 'rgba(16,185,129,0.04)', border: '2px dashed rgba(16,185,129,0.2)',
            }}
          >
            <Upload size={24} color="#10b981" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              File upload mode is active.<br />
              Drag a CSV, Excel, or JSON file onto the drop zone.
            </p>
          </motion.div>
        )}

        {selected === 'sheets' && (
          <motion.div
            key="sheets"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sheet size={14} color="#d4af37" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#d4af37' }}>Google Sheets Import</span>
            </div>
            <SheetsConfigForm url={sheetsUrl} onChange={setSheetsUrl} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status & Connect ── */}
      <StatusBanner status={connectionStatus} message={statusMessage} />

      {(selected === 'sql' || selected === 'api' || selected === 'sheets') && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleConnect}
            disabled={connectionStatus === 'connecting' || !canConnect}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 13,
              border: 'none', cursor: canConnect ? 'pointer' : 'not-allowed',
              background: connectionStatus === 'connected'
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : canConnect
                ? 'linear-gradient(135deg, #d4af37, #a3820a)'
                : 'rgba(255,255,255,0.05)',
              color: connectionStatus === 'connected' ? '#fff' : canConnect ? '#000' : '#475569',
              transition: 'all 0.2s',
              opacity: !canConnect && connectionStatus !== 'connecting' ? 0.5 : 1,
            }}
          >
            {connectionStatus === 'connecting' ? (
              <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…</>
            ) : connectionStatus === 'connected' ? (
              <><Check size={14} /> Connected</>
            ) : (
              <><Plug size={14} /> Connect &amp; Import</>
            )}
          </button>

          {connectionStatus === 'connected' && (
            <button
              onClick={() => { setConnectionStatus('idle'); setStatusMessage('Not connected'); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px 16px', borderRadius: 10, fontWeight: 700, fontSize: 12,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                color: '#94a3b8', cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} /> Reconnect
            </button>
          )}
        </div>
      )}

      {/* Pro feature notice */}
      {(selected === 'sql' || selected === 'api' || selected === 'sheets') && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px',
          borderRadius: 10, background: 'rgba(212,175,55,0.05)',
          border: '1px solid rgba(212,175,55,0.12)',
        }}>
          <AlertCircle size={13} color="#d4af37" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 10.5, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
            External data sources require a{' '}
            <strong style={{ color: '#d4af37' }}>Kimit Pro</strong> subscription.
            Database credentials are never stored — all connections are ephemeral and secured via TLS.
            The import pipeline normalises your data into the standard Kimit schema automatically.
          </p>
        </div>
      )}

      {/* Source icons bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 0' }}>
        <span style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Compatible with</span>
        {['PostgreSQL', 'MySQL', 'MongoDB', 'Snowflake', 'BigQuery', 'Supabase', 'REST API'].map(s => (
          <span key={s} style={{
            fontSize: 8.5, padding: '2px 7px', borderRadius: 4,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            color: '#475569',
          }}>
            {s}
          </span>
        ))}
      </div>

      {/* Chevron link to docs */}
      <button style={{
        display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
        color: '#d4af37', fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0, alignSelf: 'flex-start',
      }}>
        <ChevronRight size={12} /> View integration documentation
      </button>
    </div>
  );
};
