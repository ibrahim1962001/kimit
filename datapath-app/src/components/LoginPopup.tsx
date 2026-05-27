import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { X, Loader2, AlertCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
interface LoginPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Mode = 'login' | 'register';

export const LoginPopup: React.FC<LoginPopupProps> = ({ isOpen, onClose, onSuccess }) => {
  const { smartRegisterOrLogin } = useUser();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on click outside window
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Reset fields on open
  useEffect(() => {
    if (isOpen) { setError(null); setEmail(''); setPassword(''); setMode('login'); }
  }, [isOpen]);

  if (!isOpen) return null;

  // ─── Google Sign In ────────────────────────────────────────────────
  // 💡 This is the function that calls Google sign in — you can replace its content
  //    with your own if you use a system other than Firebase.
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('popup-closed-by-user')) setError('Login window closed.');
        else if (err.message.includes('network-request-failed')) setError('Connection error. Check your internet.');
        else setError('Google Sign-In failed.');
      }
    } finally { setLoading(false); }
  };

  // ─── Email Sign In ────────────────────────────────────────────────────────
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter email and password.'); return; }
    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
        await smartRegisterOrLogin(email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('email-already-in-use')) setError('Email already in use.');
        else if (err.message.includes('user-not-found')) setError('No account with this email.');
        else if (err.message.includes('wrong-password')) setError('Incorrect password.');
        else if (err.message.includes('weak-password')) setError('Weak password (min 6 characters).');
        else if (err.message.includes('invalid-email')) setError('Invalid email.');
        else setError('An error occurred. Try again.');
      }
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Overlay */}
      <div className="lp-overlay" aria-modal="true" role="dialog" aria-label="Login Window">
        {/* Card */}
        <div className="lp-card" ref={cardRef}>
          {/* Close button */}
          <button className="lp-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>

          {/* Small Google logo with title */}
          <div className="lp-header">
            <div className="lp-logo-badge">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            <div>
              <h2 className="lp-title">
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </h2>
              <p className="lp-subtitle">Welcome to Kimit AI Studio</p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="lp-error" role="alert">
              <AlertCircle size={13} />
              <span>{error}</span>
            </div>
          )}

          {/* ─── Main Google Button ─────────────────────────────────────────── */}
          {/* 👇 Replace { handleGoogleSignIn } with your function: e.g. signInWithGoogle() */}
          <button
            id="lp-google-btn"
            className="lp-google-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
            type="button"
          >
            {loading ? (
              <Loader2 size={18} className="lp-spin" />
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" className="lp-g-icon">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          {/* "OR" divider */}
          <div className="lp-divider"><span>or</span></div>

          {/* ─── Email Form ─────────────────────────────────────────────── */}
          <form className="lp-form" onSubmit={handleEmailAuth} noValidate>
            {/* Email field */}
            <div className="lp-field">
              <Mail size={15} className="lp-field-icon" />
              <input
                id="lp-email"
                type="email"
                className="lp-input"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                dir="ltr"
              />
            </div>

            {/* Password field */}
            <div className="lp-field">
              <Lock size={15} className="lp-field-icon" />
              <input
                id="lp-password"
                type={showPass ? 'text' : 'password'}
                className="lp-input lp-input-pass"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                disabled={loading}
                dir="ltr"
              />
              <button
                type="button"
                className="lp-eye-btn"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? 'Hide Password' : 'Show Password'}
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Submit button */}
            <button
              id="lp-submit-btn"
              type="submit"
              className="lp-submit-btn"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="lp-spin" /> : null}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Link to toggle between sign in and create account */}
          <p className="lp-switch">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button type="button" className="lp-switch-btn" onClick={() => { setMode('register'); setError(null); }}>
                  Create a new account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="lp-switch-btn" onClick={() => { setMode('login'); setError(null); }}>
                  Sign In
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ─── Inline Styles ──────────────────────────────────────────────────── */}
      <style>{`
        /* Overlay: Shaded background */
        .lp-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 80px 24px 24px;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          animation: lp-fade 0.2s ease;
        }

        @keyframes lp-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* Card: The window itself */
        .lp-card {
          position: relative;
          width: 100%;
          max-width: 320px;
          background: rgba(10, 15, 35, 0.96);
          border: 1px solid rgba(99, 102, 241, 0.28);
          border-radius: 20px;
          padding: 28px 22px 22px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.6),
            0 0 0 1px rgba(99, 102, 241, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(24px);
          animation: lp-slide 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
          direction: ltr;
          font-family: 'Plus Jakarta Sans', 'Noto Sans Arabic', system-ui, -apple-system, sans-serif;
        }

        @keyframes lp-slide {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        /* Close button */
        .lp-close {
          position: absolute;
          top: 12px;
          left: 12px;   /* left because direction is RTL */
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.18s;
          z-index: 1;
        }
        .lp-close:hover {
          background: rgba(239,68,68,0.15);
          color: #f87171;
          border-color: rgba(239,68,68,0.3);
        }

        /* Window Header */
        .lp-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-left: 8px; /* space from X button */
        }
        .lp-logo-badge {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .lp-title {
          font-size: 16px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
          line-height: 1.2;
        }
        .lp-subtitle {
          font-size: 11px;
          color: #475569;
          margin: 3px 0 0;
        }

        /* Error message */
        .lp-error {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          background: rgba(239,68,68,0.09);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 12px;
          line-height: 1.4;
        }

        /* Google Button */
        .lp-google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(66,133,244,0.15), rgba(52,168,83,0.08));
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #e2e8f0;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.22s;
          font-family: inherit;
          letter-spacing: 0.01em;
        }
        .lp-google-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(66,133,244,0.25), rgba(52,168,83,0.15));
          border-color: rgba(66,133,244,0.4);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(66,133,244,0.2);
        }
        .lp-google-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
        .lp-google-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .lp-g-icon { flex-shrink: 0; }

        /* "OR" divider */
        .lp-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #334155;
          font-size: 11px;
        }
        .lp-divider::before,
        .lp-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }

        /* Form */
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Input field */
        .lp-field {
          position: relative;
          display: flex;
          align-items: center;
        }
        .lp-field-icon {
          position: absolute;
          right: 12px;
          color: #475569;
          pointer-events: none;
          flex-shrink: 0;
        }
        .lp-input {
          width: 100%;
          padding: 10px 36px 10px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 13px;
          font-family: inherit;
          transition: border-color 0.2s, background 0.2s;
          outline: none;
          box-sizing: border-box;
        }
        .lp-input::placeholder { color: #475569; }
        .lp-input:focus {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.06);
        }
        .lp-input:disabled { opacity: 0.5; }
        .lp-input-pass { padding-left: 36px; }

        /* Show/hide password button */
        .lp-eye-btn {
          position: absolute;
          left: 10px;
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .lp-eye-btn:hover { color: #818cf8; }

        /* Submit button */
        .lp-submit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 11px 16px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 11px;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.22s;
          font-family: inherit;
          margin-top: 2px;
          letter-spacing: 0.02em;
        }
        .lp-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99,102,241,0.35);
        }
        .lp-submit-btn:active:not(:disabled) { transform: scale(0.98); }
        .lp-submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        /* Toggle link */
        .lp-switch {
          font-size: 12px;
          color: #475569;
          text-align: center;
          margin: 0;
          line-height: 1.5;
        }
        .lp-switch-btn {
          background: none;
          border: none;
          color: #818cf8;
          cursor: pointer;
          font-size: inherit;
          font-family: inherit;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s;
        }
        .lp-switch-btn:hover { color: #a5b4fc; }

        /* Loading spinner icon */
        .lp-spin {
          animation: lp-spin-anim 0.7s linear infinite;
        }
        @keyframes lp-spin-anim {
          to { transform: rotate(360deg); }
        }

        /* ─── Mobile Design ─────────────────────────────────────────────── */
        @media (max-width: 480px) {
          .lp-overlay {
            align-items: flex-end;
            justify-content: center;
            padding: 0;
          }
          .lp-card {
            max-width: 100%;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            border-top-left-radius: 22px;
            border-top-right-radius: 22px;
            animation: lp-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            padding-bottom: 32px; /* Extra space for safe area */
          }
          @keyframes lp-slide-up {
            from { opacity: 0; transform: translateY(100%); }
            to   { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>
    </>
  );
};
