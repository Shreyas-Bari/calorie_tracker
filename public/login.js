// public/login.js
// Login page logic — email/password sign-in, Google sign-in, password reset modal,
// form validation, auth persistence control, and Firestore updates.

import { auth, googleProvider, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────
const loginForm      = document.getElementById("login-form");
const emailInput     = document.getElementById("login-email");
const passwordInput  = document.getElementById("login-password");
const rememberMe     = document.getElementById("remember-me");
const btnLogin       = document.getElementById("btn-login");
const btnGoogleLogin = document.getElementById("btn-google-login");

// Forgot Password Modal Elements
const btnForgot       = document.getElementById("btn-forgot");
const forgotModal      = document.getElementById("forgot-modal");
const btnCancelReset  = document.getElementById("btn-cancel-reset");
const btnSendReset    = document.getElementById("btn-send-reset");
const resetEmailInput = document.getElementById("reset-email");

// Password toggle
const togglePassword  = document.getElementById("toggle-password");

// Toast Container
const toastContainer = document.getElementById("toast-container");

// ──────────────────────────────────────────────
// Auth State — redirect if already logged in
// ──────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "./index.html";
  }
});

// ──────────────────────────────────────────────
// Toast Notification System
// ──────────────────────────────────────────────
function showToast(type, message, duration = 4000) {
  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => toast.remove());
  }, duration);
}

// ──────────────────────────────────────────────
// Validation Helpers
// ──────────────────────────────────────────────
function setFieldState(groupId, state, errorMsg) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.classList.remove("valid", "invalid");
  if (state === "valid") group.classList.add("valid");
  if (state === "invalid") {
    group.classList.add("invalid");
    if (errorMsg) {
      const errEl = group.querySelector(".input-error");
      if (errEl) errEl.textContent = errorMsg;
    }
  }
}

function validateEmail() {
  const val = emailInput.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!val || !emailRegex.test(val)) {
    setFieldState("group-email", "invalid", "Please enter a valid email address");
    return false;
  }
  setFieldState("group-email", "valid");
  return true;
}

function validatePassword() {
  const val = passwordInput.value;
  if (!val) {
    setFieldState("group-password", "invalid", "Please enter your password");
    return false;
  }
  setFieldState("group-password", "valid");
  return true;
}

function validateResetEmail() {
  const val = resetEmailInput.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!val || !emailRegex.test(val)) {
    setFieldState("group-reset-email", "invalid", "Please enter a valid email address");
    return false;
  }
  setFieldState("group-reset-email", "valid");
  return true;
}

// Inline validation on blur
emailInput.addEventListener("blur", validateEmail);
passwordInput.addEventListener("blur", validatePassword);
resetEmailInput.addEventListener("blur", validateResetEmail);

// ──────────────────────────────────────────────
// Password Visibility Toggle
// ──────────────────────────────────────────────
if (togglePassword) {
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";

    // Swap eye icons
    const eyeIcon    = togglePassword.querySelector("#eye-icon");
    const eyeOffIcon = togglePassword.querySelector("#eye-off-icon");
    if (eyeIcon && eyeOffIcon) {
      eyeIcon.style.display    = isPassword ? "none" : "block";
      eyeOffIcon.style.display = isPassword ? "block" : "none";
    }

    togglePassword.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
}

// ──────────────────────────────────────────────
// Forgot Password Modal Handlers
// ──────────────────────────────────────────────
btnForgot.addEventListener("click", (e) => {
  e.preventDefault();
  forgotModal.classList.add("active");
  resetEmailInput.focus();
});

function closeModal() {
  forgotModal.classList.remove("active");
  resetEmailInput.value = "";
  setFieldState("group-reset-email", "neutral");
}

btnCancelReset.addEventListener("click", closeModal);

// Close modal when clicking outside content area
forgotModal.addEventListener("click", (e) => {
  if (e.target === forgotModal) {
    closeModal();
  }
});

// ──────────────────────────────────────────────
// Button Loading Indicator state
// ──────────────────────────────────────────────
function setLoading(button, loading) {
  if (loading) {
    button.classList.add("loading");
    button.disabled = true;
  } else {
    button.classList.remove("loading");
    button.disabled = false;
  }
}

// ──────────────────────────────────────────────
// Database Helpers (Firestore)
// ──────────────────────────────────────────────
async function createUserDocumentIfNeeded(user, provider) {
  const userRef = doc(db, "users", user.uid);
  try {
    const existingDoc = await getDoc(userRef);
    if (existingDoc.exists()) {
      await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
      return;
    }

    const userData = {
      profile: {
        name: user.displayName || "",
        email: user.email || "",
        age: null,
        gender: null,
        height: null,
        weight: null,
        activityLevel: null,
        photoURL: user.photoURL || null,
      },
      goals: {
        type: "maintenance",
        targetCalories: 2000,
        targetProtein: 140,
        targetCarbs: 250,
        targetFat: 70,
        targetFiber: 30,
        targetWater: 3.0,
      },
      settings: {
        theme: "dark",
        notifications: true,
        units: "metric",
      },
      streak: {
        current: 0,
        longest: 0,
        lastLogDate: null,
      },
      role: "user",
      status: "active",
      authProvider: provider,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    };

    await setDoc(userRef, userData);
  } catch (error) {
    console.error("Error updating/creating user document in Firestore:", error);
  }
}

// ──────────────────────────────────────────────
// Error Handling Helper
// ──────────────────────────────────────────────
function getAuthErrorMessage(code) {
  const messages = {
    "auth/invalid-email": "The email address is not valid.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Invalid email or password. Please verify and try again.",
    "auth/network-request-failed": "Network error. Please check your internet connection.",
    "auth/too-many-requests": "Access has been temporarily blocked due to many failed requests. Please try again later.",
    "auth/popup-closed-by-user": "Sign-in popup was closed before completion.",
    "auth/cancelled-popup-request": "Sign-in popup request cancelled.",
    "auth/popup-blocked": "Popup was blocked by your browser. Please allow popups for this site.",
  };
  return messages[code] || "An unexpected error occurred. Please try again.";
}

// ──────────────────────────────────────────────
// Password Reset Submission
// ──────────────────────────────────────────────
btnSendReset.addEventListener("click", async () => {
  if (!validateResetEmail()) return;

  const email = resetEmailInput.value.trim();
  setLoading(btnSendReset, true);

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("success", "Password reset email sent! Please check your inbox.");
    setTimeout(closeModal, 1500);
  } catch (error) {
    console.error("Password reset error:", error);
    // For security reasons, do not reveal if a user doesn't exist, but show standard firebase messages.
    showToast("error", getAuthErrorMessage(error.code));
  } finally {
    setLoading(btnSendReset, false);
  }
});

// ──────────────────────────────────────────────
// Email/Password Login Submission
// ──────────────────────────────────────────────
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const isEmailValid    = validateEmail();
  const isPasswordValid = validatePassword();

  if (!isEmailValid || !isPasswordValid) {
    showToast("error", "Please correct the validation errors before submitting.");
    return;
  }

  const email    = emailInput.value.trim();
  const password = passwordInput.value;
  const remember = rememberMe.checked;

  setLoading(btnLogin, true);

  try {
    // 1. Set Auth Persistence according to Remember Me
    const persistenceMode = remember ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistenceMode);

    // 2. Perform sign in
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 3. Update firestore document (lastLogin)
    await createUserDocumentIfNeeded(user, "email");

    showToast("success", "Successfully logged in! Redirecting...");

    // 4. Redirect
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1200);

  } catch (error) {
    console.error("Login error:", error);
    showToast("error", getAuthErrorMessage(error.code));
    setLoading(btnLogin, false);
  }
});

// ──────────────────────────────────────────────
// Google Sign-In
// ──────────────────────────────────────────────
btnGoogleLogin.addEventListener("click", async () => {
  setLoading(btnLogin, true);
  btnGoogleLogin.disabled = true;

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Ensure user document exists in firestore
    await createUserDocumentIfNeeded(user, "google");

    showToast("success", `Welcome back, ${user.displayName || "user"}!`);

    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1200);

  } catch (error) {
    console.error("Google login error:", error);
    showToast("error", getAuthErrorMessage(error.code));
  } finally {
    setLoading(btnLogin, false);
    btnGoogleLogin.disabled = false;
  }
});
