import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { fetchAdminMe } from '../api/admin.api';

export type AdminRole = 'super_admin' | 'sub_admin';

interface AdminInfo {
  role: AdminRole;
  canApproveCharges: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  adminInfo: AdminInfo | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SUPER_ADMIN_UIDS = (import.meta.env.VITE_SUPER_ADMIN_UID as string || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

function resolveAdminInfoFromEnv(uid: string): AdminInfo | null {
  if (SUPER_ADMIN_UIDS.includes(uid)) {
    return { role: 'super_admin', canApproveCharges: true };
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setAdminInfo(null);
        setLoading(false);
        return;
      }
      try {
        const me = await fetchAdminMe();
        setAdminInfo({
          role: me.role as AdminRole,
          canApproveCharges: me.can_approve_charges,
        });
      } catch {
        setAdminInfo(resolveAdminInfoFromEnv(u.uid));
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    setAdminInfo(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      adminInfo,
      isAdmin: adminInfo !== null,
      isSuperAdmin: adminInfo?.role === 'super_admin',
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
