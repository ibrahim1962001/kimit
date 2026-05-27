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
  creditBalance: number;
  creditStatus: string;
  plan: string;
  smartRegisterOrLogin: (email: string, password: string) => Promise<void>;
  fetchUserData: (uid: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditStatus, setCreditStatus] = useState('active');
  const [plan, setPlan] = useState('free');

  // Fetch all user data from different collections
  const fetchUserData = async (uid: string, email: string) => {
    try {
      const data: UserData = {};
      
      // Fetch data from users_profile
      const profileRef = doc(db, 'users_profile', uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        data.profile = profileSnap.data();
      } else {
        // If not found, we can also search by email
        const q = query(collection(db, 'users_profile'), where('email', '==', email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          data.profile = querySnapshot.docs[0].data();
        }
      }

      // Fetch data from users_settings
      const settingsRef = doc(db, 'users_settings', uid);
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) data.settings = settingsSnap.data();

      // Fetch data from users_activity
      const activityRef = doc(db, 'users_activity', uid);
      const activitySnap = await getDoc(activityRef);
      if (activitySnap.exists()) data.activity = activitySnap.data();

      setUserData(data);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  // Monitor login state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        try {
          const synced = await authApi.sync();
          setCreditBalance(synced.credit_balance);
          setCreditStatus(synced.credit_status);
          setPlan(synced.plan);
          await fetchUserData(currentUser.uid, currentUser.email);
        } catch (err) {
          console.error("Failed to sync user or fetch data:", err);
        }
      } else {
        setUserData(null);
        setCreditBalance(0);
        setCreditStatus('active');
        setPlan('free');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Golden Rule: Smart Check during registration (Check-then-Login)
  const smartRegisterOrLogin = async (email: string, password: string) => {
    try {
      // 1. Try to sign in first
      await signInWithEmailAndPassword(auth, email, password);
      return;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      // 2. If it's a wrong password or user not found, try to register
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;
          
          // Create initial files in collections
          await setDoc(doc(db, 'users_profile', newUser.uid), {
            email: newUser.email,
            createdAt: new Date().toISOString()
          });
          
          await setDoc(doc(db, 'users_settings', newUser.uid), {
            theme: 'dark',
            notifications: true
          });
        } catch (regErr: unknown) {
          const regCode = (regErr as { code?: string }).code;
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
    <UserContext.Provider value={{
      user, userData, loading, creditBalance, creditStatus, plan,
      smartRegisterOrLogin, fetchUserData, logout,
    }}>
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
