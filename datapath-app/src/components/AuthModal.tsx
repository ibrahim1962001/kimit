import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { X, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isFullscreen?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, isFullscreen }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Auth Error:", err);
      if (err instanceof Error) {
        // Firebase-specific error codes
        if (err.message.includes('popup-closed-by-user')) {
          setError('Login window was closed.');
        } else if (err.message.includes('network-request-failed')) {
          setError('Connection error. Check your internet.');
        } else {
          setError(`Login failed. (${err.message.split(' (')[0]})`);
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-modal-overlay ${isFullscreen ? 'fullscreen' : ''}`} onClick={isFullscreen ? undefined : onClose}>
      <div className="auth-modal-card" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        {!isFullscreen && (
          <button className="auth-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        )}

        {/* Icon */}
        <div className="auth-icon-wrap">
          <Sparkles size={28} />
        </div>

        {/* Title */}
        <h2 className="auth-title">Welcome to Kimit AI</h2>
        <p className="auth-subtitle">
          {isFullscreen ? 'Sign in to access the platform' : 'Sign in to access the AI chat'}
        </p>

        {/* Error */}
        {error && (
          <div className="auth-error">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          className="auth-google-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={20} className="auth-spin" />
          ) : (
            <svg className="auth-google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>

        {/* Divider */}
        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Guest note */}
        <p className="auth-guest-note">
          You can browse the platform as a guest, but chat requires sign in.
        </p>

        {/* Footer */}
        <p className="auth-footer">
          By continuing, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span>
        </p>
      </div>

      <style>{`
        .auth-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(12px);
          animation: auth-fade-in 0.2s ease;
          padding: 20px;
        }

        .auth-modal-overlay.fullscreen {
          background: #020617; /* Solid background for fullscreen */
          backdrop-filter: none;
        }

        @keyframes auth-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .auth-modal-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: rgba(15,23,42,0.92);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 24px;
          padding: 36px 32px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          box-shadow:
            0 24px 80px rgba(0,0,0,0.5),
            0 0 0 1px rgba(99,102,241,0.1),
            inset 0 1px 0 rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          animation: auth-card-in 0.3s ease;
          direction: ltr;
          font-family: 'Plus Jakarta Sans', 'Noto Sans Arabic', system-ui, -apple-system, sans-serif;
        }

        @keyframes auth-card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .auth-close-btn {
          position: absolute;
          top: 14px;
          left: 14px;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .auth-close-btn:hover {
          background: rgba(239,68,68,0.15);
          color: #f87171;
          border-color: rgba(239,68,68,0.3);
        }

        .auth-icon-wrap {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 8px 32px rgba(99,102,241,0.4);
        }

        .auth-title {
          font-size: 22px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 4px 0 0;
          text-align: center;
        }

        .auth-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
          text-align: center;
          line-height: 1.5;
        }

        .auth-error {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 14px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 13px;
        }

        .auth-google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          padding: 14px 24px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          color: #e2e8f0;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s;
          font-family: inherit;
          margin-top: 4px;
        }

        .auth-google-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          border-color: rgba(99,102,241,0.4);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }

        .auth-google-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }

        .auth-google-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-google-icon {
          flex-shrink: 0;
        }

        .auth-spin {
          animation: auth-spin-anim 0.8s linear infinite;
        }

        @keyframes auth-spin-anim {
          to { transform: rotate(360deg); }
        }

        .auth-divider {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #334155;
          font-size: 12px;
        }

        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }

        .auth-guest-note {
          font-size: 12px;
          color: #475569;
          text-align: center;
          margin: 0;
          line-height: 1.6;
        }

        .auth-footer {
          font-size: 10px;
          color: #334155;
          text-align: center;
          margin: 8px 0 0;
          line-height: 1.5;
        }

        .auth-footer span {
          color: #818cf8;
          cursor: pointer;
        }

        .auth-footer span:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};
