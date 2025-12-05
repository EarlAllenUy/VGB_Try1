import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginAsDemo: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
  loginAsDemo: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (firebaseUser: User) => {
    try {
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: userData.username || firebaseUser.email?.split('@')[0] || 'User',
          role: userData.role || 'user',
        });
      } else {
        // Fallback if user record doesn't exist in Firestore yet
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.email?.split('@')[0] || 'User',
          role: 'user',
        });
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setUser(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser);
      } else {
        // If we have a demo user active, do not clear it automatically on init
        // unless we are sure we want to reset. 
        // We check if the current user state is a demo user.
        // But since this effect runs on mount, user state might be null initially.
        // We rely on the button click for demo login.
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.log("Sign out finished");
    }
    setUser(null);
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await fetchUserProfile(auth.currentUser);
    }
  };

  const loginAsDemo = (role: UserRole) => {
    // FIXED: Use stable IDs for demo accounts. 
    // This ensures that if you create a review, reload the page, and login as demo again,
    // you are still the "owner" of that review and can delete it.
    const stableId = role === 'admin' ? 'demo-admin-stable-id' : 'demo-user-stable-id';
    
    setUser({
        uid: stableId,
        email: `demo.${role}@vgb.com`,
        username: role === 'admin' ? 'Demo Admin' : 'Demo User',
        role: role
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser, loginAsDemo }}>
      {children}
    </AuthContext.Provider>
  );
};