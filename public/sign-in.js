// public/sign-in.js
// Registration page logic — handles email/password signup, Google signup,
// form validation, password strength, and Firestore user document creation.

import { auth, db, googleProvider } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────
const signupForm      = document.getElementById("signup-form");
const nameInput       = document.getElementById("signup-name");
const emailInput      = document.getElementById("signup-email");
const passwordInput   = document.getElementById("signup-password");
const confirmInput    = document.getElementById("signup-confirm");
const btnSignup       = document.getElementById("btn-signup");
const btnGoogleSignup = document.getElementById("btn-google-signup");

// Password strength
const strengthFill  = document.getElementById("strength-fill");
const strengthLabel = document.getElementById("strength-label");

// Password toggles
const togglePassword = document.getElementById("toggle-password");
const toggleConfirm  = document.getElementById("toggle-confirm");

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
const toastContainer = document.getElementById("toast-container");

/**
 * Show a toast notification.
 * @param {"success"|"error"|"info"} type
 * @param {string} message
 * @param {number} duration  ms before auto-dismiss (default 4000)
 */
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

/** Mark an input group as valid / invalid / neutral. */
function setFieldState(groupId, state, errorMsg) {
  const group = document.getElementById(groupId);
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

function validateName() {
  const val = nameInput.value.trim();
  if (!val) {
    setFieldState("group-name", "invalid", "Please enter your name");
    return false;
  }
  setFieldState("group-name", "valid");
  return true;
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
  if (val.length < 8) {
    setFieldState("group-password", "invalid", "Password must be at least 8 characters");
    return false;
  }
  setFieldState("group-password", "valid");
  return true;
}

function validateConfirm() {
  const val = confirmInput.value;
  if (!val || val !== passwordInput.value) {
    setFieldState("group-confirm", "invalid", "Passwords do not match");
    return false;
  }
  setFieldState("group-confirm", "valid");
  return true;
}

// Inline validation on blur
nameInput.addEventListener("blur", validateName);
emailInput.addEventListener("blur", validateEmail);
passwordInput.addEventListener("blur", validatePassword);
confirmInput.addEventListener("blur", validateConfirm);

// ──────────────────────────────────────────────
// Password Strength Meter
// ──────────────────────────────────────────────
passwordInput.addEventListener("input", () => {
  const val = passwordInput.value;
  if (!val) {
    strengthFill.removeAttribute("data-strength");
    strengthFill.style.width = "0%";
    strengthLabel.textContent = "";
    strengthLabel.removeAttribute("data-strength");
    return;
  }

  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  let strength;
  if (score <= 2) strength = "weak";
  else if (score <= 3) strength = "medium";
  else strength = "strong";

  strengthFill.setAttribute("data-strength", strength);
  strengthLabel.setAttribute("data-strength", strength);
  strengthLabel.textContent =
    strength === "weak" ? "Weak password" :
    strength === "medium" ? "Moderate — add symbols or numbers" :
    "Strong password";
});

// ──────────────────────────────────────────────
// Password Visibility Toggles
// ──────────────────────────────────────────────
function setupPasswordToggle(toggleBtn, input) {
  toggleBtn.addEventListener("click", () => {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";

    // Swap eye icons
    const eyeIcon    = toggleBtn.querySelector("svg:first-child");
    const eyeOffIcon = toggleBtn.querySelector("svg:last-child");
    if (eyeIcon && eyeOffIcon) {
      eyeIcon.style.display    = isPassword ? "none" : "block";
      eyeOffIcon.style.display = isPassword ? "block" : "none";
    }

    toggleBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
}

setupPasswordToggle(togglePassword, passwordInput);
setupPasswordToggle(toggleConfirm, confirmInput);

// ──────────────────────────────────────────────
// Firestore User Document Creation
// ──────────────────────────────────────────────

/**
 * Create the initial Firestore user document at users/{uid}.
 * Called on first registration — sets default profile, goals, and settings.
 *
 * @param {import("firebase/auth").User} user
 * @param {"email"|"google"} provider
 */
async function createUserDocument(user, provider) {
  const userRef = doc(db, "users", user.uid);

  // Check if document already exists (e.g. Google user signing up again)
  const existingDoc = await getDoc(userRef);
  if (existingDoc.exists()) {
    // Just update the lastLogin timestamp
    await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
    return;
  }

  const userData = {
    profile: {
      name: user.displayName || "",
      email: user.email || "",
      age: null,
      gender: null,
      height: null,    // in cm
      weight: null,    // in kg
      activityLevel: null,  // sedentary | light | moderate | active | very_active
      photoURL: user.photoURL || null,
    },
    goals: {
      type: "maintenance",  // weight_loss | weight_gain | muscle_gain | maintenance
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 250,
      targetFat: 70,
      targetFiber: 30,
      targetWater: 3.0,  // liters
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
}

// ──────────────────────────────────────────────
// Firebase Error → User-Friendly Message
// ──────────────────────────────────────────────
function getAuthErrorMessage(code) {
  const messages = {
    "auth/email-already-in-use": "An account with this email already exists. Please log in instead.",
    "auth/invalid-email": "The email address is not valid.",
    "auth/operation-not-allowed": "Email/password sign-up is not enabled. Please contact support.",
    "auth/weak-password": "Password is too weak. Use at least 8 characters with a mix of letters and numbers.",
    "auth/network-request-failed": "Network error. Please check your internet connection.",
    "auth/too-many-requests": "Too many attempts. Please try again in a few minutes.",
    "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
    "auth/cancelled-popup-request": "Only one popup request is allowed at a time.",
    "auth/popup-blocked": "Sign-in popup was blocked by the browser. Please allow popups for this site.",
  };
  return messages[code] || "An unexpected error occurred. Please try again.";
}

// ──────────────────────────────────────────────
// Set Loading State on Button
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
// Email/Password Registration
// ──────────────────────────────────────────────
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Run all validations
  const isNameValid     = validateName();
  const isEmailValid    = validateEmail();
  const isPasswordValid = validatePassword();
  const isConfirmValid  = validateConfirm();

  if (!isNameValid || !isEmailValid || !isPasswordValid || !isConfirmValid) {
    showToast("error", "Please fix the errors above before continuing.");
    return;
  }

  const name     = nameInput.value.trim();
  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  setLoading(btnSignup, true);

  try {
    // 1. Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Update display name
    await updateProfile(user, { displayName: name });

    // 3. Create Firestore user document
    await createUserDocument(user, "email");

    showToast("success", "Account created successfully! Redirecting...");

    // 4. Redirect to dashboard after a short delay
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1200);

  } catch (error) {
    console.error("Registration error:", error);
    showToast("error", getAuthErrorMessage(error.code));
    setLoading(btnSignup, false);
  }
});

// ──────────────────────────────────────────────
// Google Sign-Up
// ──────────────────────────────────────────────
btnGoogleSignup.addEventListener("click", async () => {
  setLoading(btnSignup, true);
  btnGoogleSignup.disabled = true;

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Create Firestore document (will skip if existing)
    await createUserDocument(user, "google");

    showToast("success", `Welcome, ${user.displayName || "there"}! Redirecting...`);

    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1200);

  } catch (error) {
    console.error("Google sign-up error:", error);
    showToast("error", getAuthErrorMessage(error.code));
  } finally {
    setLoading(btnSignup, false);
    btnGoogleSignup.disabled = false;
  }
});
