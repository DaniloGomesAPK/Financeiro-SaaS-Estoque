import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  User,
} from '../lib/firebase';
import { CompanyAccess, CompanyRole, UserProfile } from '../types';

interface ExtendedUserProfile extends UserProfile {
  trialStartedAt?: string;
  trialEndsAt?: string;
  accessUntil?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: ExtendedUserProfile | null;
  companyAccess: CompanyAccess | null;
  companyId: string | null;
  role: CompanyRole | null;
  loading: boolean;
  accessLoading: boolean;
  hasAccess: boolean;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  registerWithEmail: (e: string, p: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  isFirebaseReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const sevenDaysFromNowIso = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
};

const timestampToIso = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return undefined;
};

const normalizeAccess = (data: any, companyId: string): CompanyAccess => ({
  companyId,
  status: data?.status || 'expired',
  plan: data?.plan || 'trial',
  trialStartedAt: timestampToIso(data?.trialStartedAt),
  trialEndsAt: timestampToIso(data?.trialEndsAt),
  accessUntil: timestampToIso(data?.accessUntil),
  updatedAt: timestampToIso(data?.updatedAt) || (typeof data?.updatedAt === 'string' ? data.updatedAt : undefined),
  updatedBy: data?.updatedBy || '',
});

/**
 * Compatibility strategy:
 * - Existing users are migrated as legacy and keep companyId = uid.
 * - New users start with a 7-day trial and companyId = uid.
 * - The future Admin app can move additional users into the same companyId.
 */
const ensureUserProfile = async (currentUser: User): Promise<ExtendedUserProfile> => {
  const userDocRef = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(userDocRef);

  if (!snap.exists()) {
    const now = new Date().toISOString();
    const profile: ExtendedUserProfile = {
      email: currentUser.email || '',
      companyId: currentUser.uid,
      role: 'owner',
      status: 'trial',
      plan: 'trial',
      trialStartedAt: now,
      trialEndsAt: sevenDaysFromNowIso(),
    };
    await setDoc(userDocRef, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return profile;
  }

  const data = snap.data() || {};
  const isLegacyMigration = !data.companyId;
  const profile: ExtendedUserProfile = {
    email: currentUser.email || data.email || '',
    companyId: data.companyId || currentUser.uid,
    role: (data.role || 'owner') as CompanyRole,
    status: data.status || (isLegacyMigration ? 'legacy' : 'active'),
    plan: data.plan || (isLegacyMigration ? 'legacy' : undefined),
    trialStartedAt: timestampToIso(data.trialStartedAt),
    trialEndsAt: timestampToIso(data.trialEndsAt),
    accessUntil: timestampToIso(data.accessUntil),
  };

  await setDoc(
    userDocRef,
    {
      email: profile.email,
      companyId: profile.companyId,
      role: profile.role,
      status: profile.status,
      ...(profile.plan ? { plan: profile.plan } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return profile;
};

const ensureCompanyAccess = async (currentUser: User, profile: ExtendedUserProfile): Promise<CompanyAccess> => {
  const accessRef = doc(db, 'companyAccess', profile.companyId);
  const snap = await getDoc(accessRef);
  if (snap.exists()) return normalizeAccess(snap.data(), profile.companyId);

  // Only the owner bootstraps access. Additional members inherit the company's existing access document.
  if (profile.role !== 'owner') {
    return {
      companyId: profile.companyId,
      status: 'expired',
      plan: 'trial',
    };
  }

  if (profile.status === 'legacy' || profile.plan === 'legacy') {
    const payload = {
      companyId: profile.companyId,
      status: 'legacy',
      plan: 'legacy',
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(accessRef, payload);
    return { companyId: profile.companyId, status: 'legacy', plan: 'legacy' };
  }

  const started = profile.trialStartedAt ? new Date(profile.trialStartedAt) : new Date();
  const ends = profile.trialEndsAt ? new Date(profile.trialEndsAt) : new Date(sevenDaysFromNowIso());
  const payload = {
    companyId: profile.companyId,
    status: 'trial',
    plan: 'trial',
    trialStartedAt: Timestamp.fromDate(started),
    trialEndsAt: Timestamp.fromDate(ends),
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(accessRef, payload);
  return {
    companyId: profile.companyId,
    status: 'trial',
    plan: 'trial',
    trialStartedAt: started.toISOString(),
    trialEndsAt: ends.toISOString(),
  };
};

const evaluateAccess = (access: CompanyAccess | null): boolean => {
  if (!access) return false;
  if (access.status === 'legacy') return true;
  if (access.status === 'suspended' || access.status === 'expired') return false;
  const now = Date.now();
  if (access.status === 'trial') {
    return Boolean(access.trialEndsAt && new Date(access.trialEndsAt).getTime() >= now);
  }
  if (access.status === 'active') {
    return Boolean(access.accessUntil && new Date(access.accessUntil).getTime() >= now);
  }
  return false;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<ExtendedUserProfile | null>(null);
  const [companyAccess, setCompanyAccess] = useState<CompanyAccess | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [accessLoading, setAccessLoading] = useState<boolean>(true);

  const syncProfileAndAccess = async (currentUser: User) => {
    const profile = await ensureUserProfile(currentUser);
    setUserProfile(profile);
    try {
      const access = await ensureCompanyAccess(currentUser, profile);
      setCompanyAccess(access);
    } catch (error) {
      // Transitional fallback: prevents the existing company from being locked before the new rules are published.
      console.warn('Não foi possível inicializar companyAccess ainda:', error);
      setCompanyAccess(
        profile.status === 'legacy' || profile.plan === 'legacy'
          ? { companyId: profile.companyId, status: 'legacy', plan: 'legacy' }
          : {
              companyId: profile.companyId,
              status: 'trial',
              plan: 'trial',
              trialStartedAt: profile.trialStartedAt,
              trialEndsAt: profile.trialEndsAt,
            }
      );
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setLoading(true);
        setAccessLoading(true);
        setUser(currentUser);
        try {
          if (currentUser) {
            await syncProfileAndAccess(currentUser);
          } else {
            setUserProfile(null);
            setCompanyAccess(null);
            setAccessLoading(false);
          }
        } catch (error) {
          console.error('Erro ao sincronizar perfil/acesso:', error);
          setUserProfile(null);
          setCompanyAccess(null);
          setAccessLoading(false);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.warn('Auth state change error:', error);
        setLoading(false);
        setAccessLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Live access updates: the Admin app can release/suspend access and the client sees it immediately.
  useEffect(() => {
    if (!user || !userProfile?.companyId) return;
    const accessRef = doc(db, 'companyAccess', userProfile.companyId);
    const unsubscribe = onSnapshot(accessRef, (snap) => {
      if (snap.exists()) setCompanyAccess(normalizeAccess(snap.data(), userProfile.companyId));
      setAccessLoading(false);
    }, (error) => {
      console.warn('Falha ao observar companyAccess:', error);
      setAccessLoading(false);
    });
    return () => unsubscribe();
  }, [user, userProfile?.companyId]);

  const signInWithGoogle = async () => {
    const res = await signInWithPopup(auth, googleProvider);
    if (res.user) await syncProfileAndAccess(res.user);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    if (res.user) await syncProfileAndAccess(res.user);
  };

  const registerWithEmail = async (email: string, pass: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    if (res.user) await syncProfileAndAccess(res.user);
  };

  const logoutUser = async () => {
    await signOut(auth);
    setUserProfile(null);
    setCompanyAccess(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        companyAccess,
        companyId: userProfile?.companyId || null,
        role: userProfile?.role || null,
        loading,
        accessLoading,
        hasAccess: evaluateAccess(companyAccess),
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logoutUser,
        resetPassword,
        isFirebaseReady: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
