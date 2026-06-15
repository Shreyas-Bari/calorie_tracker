// public/auth-guard.js
// Reusable authentication guards to protect private pages and redirect authenticated users.
// Uses Firebase v10 CDN imports as per the project specification.

import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/**
 * Promise-based one-shot check to get the current authenticated user.
 * @returns {Promise<import("firebase/auth").User|null>}
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Protects a page. Redirects to login.html if the user is not logged in.
 * @param {function(import("firebase/auth").User): void} [callback] - Optional callback with user object
 */
export function requireAuth(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "./login.html";
    } else {
      if (callback) {
        callback(user);
      }
    }
  });
}

/**
 * Bounces authenticated users away from auth pages (login/signup) back to the dashboard.
 */
export function redirectIfAuthenticated() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = "./index.html";
    }
  });
}

/**
 * Signs the user out and redirects to the login page.
 */
export async function signOutAndRedirect() {
  try {
    await signOut(auth);
    window.location.href = "./login.html";
  } catch (error) {
    console.error("Sign out error:", error);
  }
}
