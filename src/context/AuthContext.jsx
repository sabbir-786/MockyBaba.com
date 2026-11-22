import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  subscribeToAuth,
  resolveGoogleRedirect,
  syncGoogleUserProfile,
  logoutUser,
  getAuthErrorMessage
} from "../firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 1. Redirect result runs in the background. It must NOT block loading.
    resolveGoogleRedirect().catch((err) => {
      if (!cancelled) setAuthError(getAuthErrorMessage(err));
    });

    // 2. Auth listener starts immediately.
    const unsubscribe = subscribeToAuth((user) => {
      if (cancelled) return;

      setCurrentUser(user);
      setLoading(false); // auth state is known, so unblock the UI now

      if (!user) {
        setUserProfile(null);
        setIsNewUser(false);
        return;
      }

      // 3. Firestore profile sync runs in the background.
      syncGoogleUserProfile(user)
        .then(({ profile, isNewUser: createdNow }) => {
          if (cancelled) return;
          setUserProfile(profile);
          setIsNewUser(createdNow);
        })
        .catch((err) => {
          console.error("Failed to sync user profile:", err);
          if (!cancelled) setUserProfile(null);
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    await logoutUser(); // onAuthStateChanged resets the state
  };

  const value = useMemo(
    () => ({ currentUser, userProfile, isNewUser, authError, loading, logout }),
    [currentUser, userProfile, isNewUser, authError, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
};