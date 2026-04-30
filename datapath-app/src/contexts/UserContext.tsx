import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { authApi } from '../api/auth.api';

interface UserData {
  profile?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  activity?: Record<string, unknown>;
}

interface UserContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  smartRegisterOrLogin: (email: string, password: string) => Promise<void>;
  fetchUserData: (uid: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // جلب كافة بيانات المستخدم من الكولكشنات المختلفة
  const fetchUserData = async (uid: string, email: string) => {
    try {
      const data: UserData = {};
      
      // جلب البيانات من users_profile
      const profileRef = doc(db, 'users_profile', uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        data.profile = profileSnap.data();
      } else {
        // إذا لم يكن موجوداً، يمكننا البحث بواسطة الإيميل أيضاً
        const q = query(collection(db, 'users_profile'), where('email', '==', email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          data.profile = querySnapshot.docs[0].data();
        }
      }

      // جلب البيانات من users_settings
      const settingsRef = doc(db, 'users_settings', uid);
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) data.settings = settingsSnap.data();

      // جلب البيانات من users_activity
      const activityRef = doc(db, 'users_activity', uid);
      const activitySnap = await getDoc(activityRef);
      if (activitySnap.exists()) data.activity = activitySnap.data();

      setUserData(data);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  // مراقبة حالة تسجيل الدخول
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        try {
          await authApi.sync(); // Sync user to backend!
          await fetchUserData(currentUser.uid, currentUser.email);
        } catch (err) {
          console.error("Failed to sync user or fetch data:", err);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // القاعدة الذهبية: التحقق الذكي عند التسجيل (Check-then-Login)
  const smartRegisterOrLogin = async (email: string, password: string) => {
    try {
      // 1. Try to sign in first
      await signInWithEmailAndPassword(auth, email, password);
      return;
    } catch (err: unknown) {
      const code = (err as any).code;
      // 2. If it's a wrong password or user not found, try to register
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;
          
          // إنشاء ملفات مبدئية في الكولكشنات
          await setDoc(doc(db, 'users_profile', newUser.uid), {
            email: newUser.email,
            createdAt: new Date().toISOString()
          });
          
          await setDoc(doc(db, 'users_settings', newUser.uid), {
            theme: 'dark',
            notifications: true
          });
        } catch (regErr: unknown) {
          const regCode = (regErr as any).code;
          if (regCode === 'auth/email-already-in-use') {
            // If email exists, then the original sign-in failure was actually a wrong password!
            throw new Error('wrong-password');
          }
          throw regErr;
        }
      } else {
        throw err;
      }
    }
  };

  const logout = async () => {
    await auth.signOut();
  };

  return (
    <UserContext.Provider value={{ user, userData, loading, smartRegisterOrLogin, fetchUserData, logout }}>
      {children}
    </UserContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
