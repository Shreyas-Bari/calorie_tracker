// public/goals.js
// Goals & Profile page logic — auth guard, BMR/TDEE calculation (Mifflin-St Jeor),
// live recalculation, Firestore profile/goals persistence, weight log sync.

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── DOM References ──
const appLoading      = document.getElementById("app-loading");
const toastContainer  = document.getElementById("toast-container");
const sidebar         = document.getElementById("sidebar");
const hamburger       = document.getElementById("hamburger");
const sidebarOverlay  = document.getElementById("sidebar-overlay");
const userAvatar      = document.getElementById("user-avatar");
const userDisplayName = document.getElementById("user-display-name");
const userEmailEl     = document.getElementById("user-email");
const btnSignout      = document.getElementById("btn-signout");

// Profile fields
const profileName     = document.getElementById("profile-name");
const profileEmail    = document.getElementById("profile-email");
const profileAge      = document.getElementById("profile-age");
const profileWeight   = document.getElementById("profile-weight");
const profileHeight   = document.getElementById("profile-height");

// Calculated readouts
const calcBmr         = document.getElementById("calc-bmr");
const calcTdee        = document.getElementById("calc-tdee");
const calcRec         = document.getElementById("calc-rec");
const recPro          = document.getElementById("rec-pro");
const recCarb         = document.getElementById("rec-carb");
const recFat          = document.getElementById("rec-fat");
const recFib          = document.getElementById("rec-fib");

// Target inputs
const targetCal       = document.getElementById("target-cal");
const targetPro       = document.getElementById("target-pro");
const targetCarb      = document.getElementById("target-carb");
const targetFat       = document.getElementById("target-fat");
const targetFib       = document.getElementById("target-fib");

// Buttons
const btnApply        = document.getElementById("btn-apply");
const btnSave         = document.getElementById("btn-save");

// Account info
const acctCreated     = document.getElementById("acct-created");
const acctProvider    = document.getElementById("acct-provider");
const acctLastLogin   = document.getElementById("acct-last-login");

// ── State ──
let currentUserId = null;
let lastCalcResult = null; // Stores the latest BMR/TDEE/macro calculation

// ── Activity Multipliers ──
const ACTIVITY_MULT = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

// ── Goal Adjustments ──
// { calOffset, proteinPct, carbsPct, fatPct }
const GOAL_CONFIG = {
  loss:        { calOffset: -500, proteinPct: 0.35, carbsPct: 0.40, fatPct: 0.25 },
  maintenance: { calOffset: 0,    proteinPct: 0.30, carbsPct: 0.45, fatPct: 0.25 },
  gain:        { calOffset: 300,  proteinPct: 0.30, carbsPct: 0.50, fatPct: 0.20 },
  muscle:      { calOffset: 200,  proteinPct: 0.40, carbsPct: 0.35, fatPct: 0.25 },
};

// ──────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────
function showToast(type, message, duration = 4000) {
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  toastContainer.appendChild(t);
  setTimeout(() => { t.classList.add("removing"); t.addEventListener("animationend", () => t.remove()); }, duration);
}

// ──────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────
hamburger.addEventListener("click", () => { sidebar.classList.toggle("open"); sidebarOverlay.classList.toggle("active"); });
sidebarOverlay.addEventListener("click", () => { sidebar.classList.remove("open"); sidebarOverlay.classList.remove("active"); });
btnSignout.addEventListener("click", async () => {
  try { await signOut(auth); window.location.href = "./login.html"; }
  catch (e) { console.error("Sign-out error:", e); showToast("error", "Failed to sign out."); }
});

// ──────────────────────────────────────────────
// BMR / TDEE Calculation (Mifflin-St Jeor)
// ──────────────────────────────────────────────
function getFormValues() {
  const age    = parseInt(profileAge.value) || 0;
  const weight = parseFloat(profileWeight.value) || 0;
  const height = parseInt(profileHeight.value) || 0;
  const gender = document.querySelector('input[name="gender"]:checked')?.value || "male";
  const activity = document.querySelector('input[name="activity"]:checked')?.value || "moderate";
  const goalType = document.querySelector('input[name="goal-type"]:checked')?.value || "maintenance";
  return { age, weight, height, gender, activity, goalType };
}

function calculateBMR(weight, height, age, gender) {
  // Mifflin-St Jeor equation
  const base = 10 * weight + 6.25 * height - 5 * age;
  if (gender === "female") return Math.round(base - 161);
  return Math.round(base + 5); // male or other
}

function calculateAll() {
  const { age, weight, height, gender, activity, goalType } = getFormValues();

  // Need at least age, weight, height to calculate
  if (age < 13 || weight < 20 || height < 100) {
    calcBmr.innerHTML = `--<span class="calc-stat-unit"> kcal</span>`;
    calcTdee.innerHTML = `--<span class="calc-stat-unit"> kcal</span>`;
    calcRec.innerHTML = `--<span class="calc-stat-unit"> kcal</span>`;
    recPro.innerHTML = `--<span class="calc-macro-unit">g</span>`;
    recCarb.innerHTML = `--<span class="calc-macro-unit">g</span>`;
    recFat.innerHTML = `--<span class="calc-macro-unit">g</span>`;
    recFib.innerHTML = `--<span class="calc-macro-unit">g</span>`;
    lastCalcResult = null;
    return;
  }

  const bmr = calculateBMR(weight, height, age, gender);
  const mult = ACTIVITY_MULT[activity] || 1.55;
  const tdee = Math.round(bmr * mult);

  const goal = GOAL_CONFIG[goalType] || GOAL_CONFIG.maintenance;
  const recCal = Math.round(Math.max(1200, tdee + goal.calOffset)); // Floor at 1200

  // Macros in grams (protein & carbs = 4 kcal/g, fat = 9 kcal/g)
  const proteinG = Math.round((recCal * goal.proteinPct) / 4);
  const carbsG   = Math.round((recCal * goal.carbsPct) / 4);
  const fatG     = Math.round((recCal * goal.fatPct) / 9);
  const fiberG   = gender === "female" ? 25 : 30;

  // Update UI
  calcBmr.innerHTML  = `${bmr}<span class="calc-stat-unit"> kcal</span>`;
  calcTdee.innerHTML = `${tdee}<span class="calc-stat-unit"> kcal</span>`;
  calcRec.innerHTML  = `${recCal}<span class="calc-stat-unit"> kcal</span>`;
  recPro.innerHTML   = `${proteinG}<span class="calc-macro-unit">g</span>`;
  recCarb.innerHTML  = `${carbsG}<span class="calc-macro-unit">g</span>`;
  recFat.innerHTML   = `${fatG}<span class="calc-macro-unit">g</span>`;
  recFib.innerHTML   = `${fiberG}<span class="calc-macro-unit">g</span>`;

  lastCalcResult = { bmr, tdee, recCal, proteinG, carbsG, fatG, fiberG };
}

// ──────────────────────────────────────────────
// Apply Recommended Targets
// ──────────────────────────────────────────────
btnApply.addEventListener("click", () => {
  if (!lastCalcResult) {
    showToast("info", "Fill in your age, weight, and height first.");
    return;
  }
  targetCal.value  = lastCalcResult.recCal;
  targetPro.value  = lastCalcResult.proteinG;
  targetCarb.value = lastCalcResult.carbsG;
  targetFat.value  = lastCalcResult.fatG;
  targetFib.value  = lastCalcResult.fiberG;
  showToast("success", "Recommended targets applied. Don't forget to save!");
});

// ──────────────────────────────────────────────
// Live Recalculation Listeners
// ──────────────────────────────────────────────
[profileAge, profileWeight, profileHeight].forEach(el => el.addEventListener("input", calculateAll));
document.querySelectorAll('input[name="gender"]').forEach(r => r.addEventListener("change", calculateAll));
document.querySelectorAll('input[name="activity"]').forEach(r => r.addEventListener("change", calculateAll));
document.querySelectorAll('input[name="goal-type"]').forEach(r => r.addEventListener("change", calculateAll));

// ──────────────────────────────────────────────
// Firestore: Load Profile
// ──────────────────────────────────────────────
async function loadProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.error("Load profile error:", err);
    return null;
  }
}

function populateForm(userData) {
  if (!userData) return;

  const p = userData.profile || {};
  const g = userData.goals || {};

  // Profile fields
  if (p.age) profileAge.value = p.age;
  if (p.weight) profileWeight.value = p.weight;
  if (p.height) profileHeight.value = p.height;

  // Gender
  if (p.gender) {
    const radio = document.getElementById(`gender-${p.gender}`);
    if (radio) radio.checked = true;
  }

  // Activity level
  if (p.activityLevel) {
    const radio = document.getElementById(`act-${p.activityLevel.replace("_", "-")}`);
    if (radio) radio.checked = true;
  }

  // Goal type
  if (g.goalType) {
    const id = g.goalType === "maintenance" ? "goal-maintain" : `goal-${g.goalType}`;
    const radio = document.getElementById(id);
    if (radio) radio.checked = true;
  }

  // Custom targets
  if (g.targetCalories) targetCal.value = g.targetCalories;
  if (g.targetProtein)  targetPro.value = g.targetProtein;
  if (g.targetCarbs)    targetCarb.value = g.targetCarbs;
  if (g.targetFat)      targetFat.value = g.targetFat;
  if (g.targetFiber)    targetFib.value = g.targetFiber;

  // Recalculate with loaded values
  calculateAll();
}

// ──────────────────────────────────────────────
// Firestore: Save Profile & Goals
// ──────────────────────────────────────────────
btnSave.addEventListener("click", async () => {
  if (!currentUserId) return;

  const { age, weight, height, gender, activity, goalType } = getFormValues();

  // Validation
  if (!age || age < 13 || age > 100) {
    showToast("error", "Please enter a valid age (13–100).");
    profileAge.focus();
    return;
  }
  if (!weight || weight < 20 || weight > 300) {
    showToast("error", "Please enter a valid weight (20–300 kg).");
    profileWeight.focus();
    return;
  }
  if (!height || height < 100 || height > 250) {
    showToast("error", "Please enter a valid height (100–250 cm).");
    profileHeight.focus();
    return;
  }

  const tCal  = parseInt(targetCal.value) || 2000;
  const tPro  = parseInt(targetPro.value) || 140;
  const tCarb = parseInt(targetCarb.value) || 250;
  const tFat  = parseInt(targetFat.value) || 70;
  const tFib  = parseInt(targetFib.value) || 30;

  btnSave.disabled = true;
  btnSave.classList.add("loading");

  try {
    // Write profile + goals to users/{uid}
    await setDoc(doc(db, "users", currentUserId), {
      profile: {
        age,
        gender,
        height,
        weight,
        activityLevel: activity,
      },
      goals: {
        goalType,
        targetCalories: tCal,
        targetProtein: tPro,
        targetCarbs: tCarb,
        targetFat: tFat,
        targetFiber: tFib,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Also log weight to weightLogs for dashboard trend tracking
    const today = getTodayStr();
    await setDoc(doc(db, "users", currentUserId, "weightLogs", today), {
      weight,
      date: today,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    showToast("success", "Profile and goals saved successfully!");
  } catch (err) {
    console.error("Save error:", err);
    showToast("error", "Failed to save. Please try again.");
  } finally {
    btnSave.disabled = false;
    btnSave.classList.remove("loading");
  }
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function getTodayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

function formatDate(dateInput) {
  if (!dateInput) return "--";
  try {
    const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return "--"; }
}

function getProviderName(user) {
  if (!user || !user.providerData || user.providerData.length === 0) return "Email";
  const pid = user.providerData[0].providerId;
  if (pid === "google.com") return "Google";
  if (pid === "phone") return "Phone";
  return "Email";
}

// ──────────────────────────────────────────────
// Auth Guard & Bootstrap
// ──────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "./login.html"; return; }
  currentUserId = user.uid;

  // Sidebar user info
  profileName.value = user.displayName || "NutriTrack User";
  profileEmail.value = user.email || "";
  userDisplayName.textContent = user.displayName || "NutriTrack User";
  userEmailEl.textContent = user.email || "";

  if (user.photoURL) {
    userAvatar.innerHTML = `<img src="${user.photoURL}" alt="Profile" referrerpolicy="no-referrer">`;
  } else {
    userAvatar.textContent = (user.displayName || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  // Account info
  acctCreated.textContent = formatDate(user.metadata?.creationTime);
  acctProvider.textContent = getProviderName(user);
  acctLastLogin.textContent = formatDate(user.metadata?.lastSignInTime);

  try {
    const userData = await loadProfile(user.uid);
    populateForm(userData);
  } catch (err) {
    console.error("Bootstrap error:", err);
    showToast("error", "Something went wrong loading your profile.");
  } finally {
    appLoading.classList.add("hidden");
    setTimeout(() => appLoading.remove(), 600);
  }
});
