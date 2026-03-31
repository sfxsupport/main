// ============================================================
// firebaseAuth.js — Firebase Authentication for sfxsupport.com
// Ask Krrish — Google Sign-In via Popup
// ============================================================
// Replace the firebaseConfig values below with your actual
// Firebase project credentials from the Firebase Console.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// -----------------------------------------------------------
// 🔧 YOUR FIREBASE CONFIG — swap these placeholder values
// -----------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDe6wr2S1mV1fLh6oUyJU-peFePXUrFaJ8",
  authDomain: "auth.sfxsupport.com",
  projectId: "ai-learning-platform-f7628",
  storageBucket: "ai-learning-platform-f7628.firebasestorage.app",
  messagingSenderId: "936110831826",
  appId: "1:936110831826:web:25c1cb95776362931ed50b",
  measurementId: "G-FYXHHLFTY5"
};

// -----------------------------------------------------------
// Initialise Firebase + Google Provider
// -----------------------------------------------------------
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// Force account picker every time so user can switch accounts
provider.setCustomParameters({ prompt: "select_account" });

// -----------------------------------------------------------
// GOOGLE LOGIN — call from login page
// -----------------------------------------------------------
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user };
  } catch (error) {
    // User closed popup — silent, no error shown
    if (
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) {
      return { success: false, error: null };
    }
    return { success: false, error: getFriendlyError(error.code) };
  }
}

// -----------------------------------------------------------
// LOGOUT — redirects to /login after sign out
// -----------------------------------------------------------
export async function logoutUser() {
  try {
    await signOut(auth);
    window.location.href = "/login/";
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

// -----------------------------------------------------------
// ROUTE GUARD — protect pages; redirects to /login if not authed
// Pass a callback that receives the user object when authed.
// -----------------------------------------------------------
export function requireAuth(onAuthed) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (typeof onAuthed === "function") onAuthed(user);
    } else {
      window.location.href = "/login/";
    }
  });
}

// -----------------------------------------------------------
// REDIRECT IF ALREADY LOGGED IN — use on the login page so
// authenticated users skip straight to /chatbot.
// -----------------------------------------------------------
export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = "/chatbot/";
    }
  });
}

// -----------------------------------------------------------
// Internal — human-readable Firebase error messages
// -----------------------------------------------------------
function getFriendlyError(code) {
  const map = {
    "auth/popup-blocked":          "Popup was blocked. Please allow popups for this site.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/too-many-requests":      "Too many attempts. Please wait a moment and try again.",
    "auth/user-disabled":          "This account has been disabled. Contact admin.",
    "auth/account-exists-with-different-credential": "An account already exists with this email."
  };
  return map[code] || "Something went wrong. Please try again.";
}