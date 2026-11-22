import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Handles first-time signup vs. returning sign-in via Firestore profile check.
 * - First time: creates users/{userId} with isNewUser = true
 * - Return visit: updates lastLoginAt and returns isNewUser = false
 */
export const syncGoogleUserProfile = async (user, defaultTargetExam = "SBI PO") => {
  if (!user) return { profile: null, isNewUser: false };

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const newProfile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "Aspirant",
      photoURL: user.photoURL || "",
      targetExam: defaultTargetExam,
      role: "student",
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };
    await setDoc(userRef, newProfile);
    return { profile: { id: user.uid, ...newProfile }, isNewUser: true };
  }

  const existingData = snap.data();
  const updatedFields = {
    displayName: user.displayName || existingData.displayName,
    photoURL: user.photoURL || existingData.photoURL,
    lastLoginAt: serverTimestamp()
  };

  await setDoc(userRef, updatedFields, { merge: true });

  return {
    profile: { id: snap.id, ...existingData, ...updatedFields },
    isNewUser: false
  };
};

/**
 * Unified Google Sign-In / Sign-Up entry point.
 * Opens Google's account chooser in a popup (user picks a Gmail account,
 * no email/password typed in our app). Falls back to redirect if the
 * popup is blocked or unsupported.
 */
export const continueWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    if (
      err?.code === "auth/popup-blocked" ||
      err?.code === "auth/operation-not-supported-in-this-environment"
    ) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw err;
  }
};

/**
 * Completes the redirect flow on page return and surfaces any auth errors.
 * Still needed for the redirect fallback above.
 */
export const resolveGoogleRedirect = async () => {
  const result = await getRedirectResult(auth);
  return result?.user || null;
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const subscribeToAuth = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const getAuthErrorMessage = (error) => {
  switch (error?.code) {
    case "auth/configuration-not-found":
      return "Firebase Authentication is not enabled for this project. Enable Authentication and Google Sign-In in Firebase Console.";
    case "auth/operation-not-allowed":
      return "Google Sign-In is disabled. Enable Google under Firebase Console - Authentication - Sign-in method.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized. Add it under Firebase Console - Authentication - Settings - Authorized domains.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return ""; // user closed the chooser, not an error
    case "auth/popup-blocked":
      return "Popup was blocked. Please allow popups for this site and try again.";
    default:
      return error?.message || "Google authentication failed. Please try again.";
  }
};