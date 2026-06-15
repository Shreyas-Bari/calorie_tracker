// public/dashboard.js
// Dashboard page logic — auth guard, Firestore data loading, UI hydration,
// calorie ring animation, macro bars, water tracker, and sidebar interactions.

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────
const appLoading        = document.getElementById("app-loading");
const toastContainer    = document.getElementById("toast-container");

// Header
const greetingEmoji     = document.getElementById("greeting-emoji");
const greetingText      = document.getElementById("greeting-text");
const userFirstName     = document.getElementById("user-first-name");
const streakCount       = document.getElementById("streak-count");
const currentDate       = document.getElementById("current-date");

// Sidebar
const sidebar           = document.getElementById("sidebar");
const hamburger         = document.getElementById("hamburger");
const sidebarOverlay    = document.getElementById("sidebar-overlay");
const userAvatar        = document.getElementById("user-avatar");
const userDisplayName   = document.getElementById("user-display-name");
const userEmail         = document.getElementById("user-email");
const btnSignout        = document.getElementById("btn-signout");

// Calorie ring
const calRing           = document.getElementById("cal-ring");
const calConsumed       = document.getElementById("cal-consumed");
const calTargetDisplay  = document.getElementById("cal-target-display");
const statConsumed      = document.getElementById("stat-consumed");
const statRemaining     = document.getElementById("stat-remaining");
const statBurned        = document.getElementById("stat-burned");

// Macro cards
const proteinConsumed   = document.getElementById("protein-consumed");
const proteinTarget     = document.getElementById("protein-target");
const proteinBar        = document.getElementById("protein-bar");
const carbsConsumed     = document.getElementById("carbs-consumed");
const carbsTarget       = document.getElementById("carbs-target");
const carbsBar          = document.getElementById("carbs-bar");
const fatConsumed       = document.getElementById("fat-consumed");
const fatTarget         = document.getElementById("fat-target");
const fatBar            = document.getElementById("fat-bar");
const fiberConsumed     = document.getElementById("fiber-consumed");
const fiberTarget       = document.getElementById("fiber-target");
const fiberBar          = document.getElementById("fiber-bar");

// Summary cards
const mealsCount        = document.getElementById("meals-count");
const mealsBadge        = document.getElementById("meals-badge");
const waterAmount       = document.getElementById("water-amount");
const waterBadge        = document.getElementById("water-badge");
const waterTracker      = document.getElementById("water-tracker");
const weightValue       = document.getElementById("weight-value");
const weightTrend       = document.getElementById("weight-trend");
const weightTrendText   = document.getElementById("weight-trend-text");
const scoreValue        = document.getElementById("score-value");
const scoreRing         = document.getElementById("score-ring");
const scoreBadge        = document.getElementById("score-badge");
const scoreInsights     = document.getElementById("score-insights");

// Meal list
const mealList          = document.getElementById("meal-list");
const mealEmpty         = document.getElementById("meal-empty");

// ──────────────────────────────────────────────
// Toast System
// ──────────────────────────────────────────────
function showToast(type, message, duration = 4000) {
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => toast.remove());
  }, duration);
}

// ──────────────────────────────────────────────
// Utility: Date Helpers
// ──────────────────────────────────────────────
function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate() {
  const now = new Date();
  return now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", emoji: "☀️" };
  if (hour < 17) return { text: "Good afternoon", emoji: "🌤️" };
  if (hour < 21) return { text: "Good evening", emoji: "🌅" };
  return { text: "Good night", emoji: "🌙" };
}

// ──────────────────────────────────────────────
// Utility: Animate counting
// ──────────────────────────────────────────────
function animateCount(element, target, duration = 800) {
  const start = parseInt(element.textContent) || 0;
  const diff = target - start;
  if (diff === 0) return;

  const startTime = performance.now();

  function tick(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out quad
    const eased = 1 - (1 - progress) * (1 - progress);
    element.textContent = Math.round(start + diff * eased);
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

// ──────────────────────────────────────────────
// Sidebar Toggle (Mobile)
// ──────────────────────────────────────────────
hamburger.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  sidebarOverlay.classList.toggle("active");
});

sidebarOverlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");
});

// ──────────────────────────────────────────────
// Sign Out
// ──────────────────────────────────────────────
btnSignout.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "./login.html";
  } catch (error) {
    console.error("Sign-out error:", error);
    showToast("error", "Failed to sign out. Please try again.");
  }
});

// ──────────────────────────────────────────────
// Render: Calorie Ring
// ──────────────────────────────────────────────
function renderCalorieRing(consumed, target) {
  const circumference = 2 * Math.PI * 72; // r=72
  const percent = Math.min(consumed / target, 1);
  const offset = circumference * (1 - percent);

  // Animate ring
  calRing.style.strokeDashoffset = offset;

  // Animate count
  animateCount(calConsumed, consumed);

  calTargetDisplay.textContent = target;
  statConsumed.textContent = `${consumed} kcal`;
  statRemaining.textContent = `${Math.max(0, target - consumed)} kcal`;
  statBurned.textContent = `0 kcal`; // Placeholder until exercise tracking
}

// ──────────────────────────────────────────────
// Render: Macro Bars
// ──────────────────────────────────────────────
function renderMacro(currentEl, targetEl, barEl, consumed, target) {
  animateCount(currentEl, consumed);
  targetEl.textContent = target;
  const pct = Math.min((consumed / target) * 100, 100);
  barEl.style.width = `${pct}%`;
}

// ──────────────────────────────────────────────
// Render: Water Tracker (8 drops)
// ──────────────────────────────────────────────
function renderWaterTracker(currentGlasses) {
  waterTracker.innerHTML = "";
  const totalGlasses = 8;

  for (let i = 0; i < totalGlasses; i++) {
    const drop = document.createElement("div");
    drop.className = `water-drop ${i < currentGlasses ? "filled" : ""}`;
    drop.title = `Glass ${i + 1}`;
    drop.addEventListener("click", () => handleWaterClick(i + 1));
    waterTracker.appendChild(drop);
  }

  const liters = (currentGlasses * 0.25).toFixed(1); // ~250ml per glass
  waterAmount.textContent = liters;
  waterBadge.textContent = `${currentGlasses} / ${totalGlasses}`;

  if (currentGlasses >= 6) {
    waterBadge.className = "summary-card-badge badge-good";
  } else if (currentGlasses >= 3) {
    waterBadge.className = "summary-card-badge badge-warn";
  } else {
    waterBadge.className = "summary-card-badge badge-info";
  }
}

// ──────────────────────────────────────────────
// Handle: Water Click — toggle glasses
// ──────────────────────────────────────────────
let currentWaterGlasses = 0;
let currentUserId = null;

async function handleWaterClick(glassNumber) {
  if (!currentUserId) return;

  // Toggle: if clicking the same filled glass, unfill from that point
  if (glassNumber === currentWaterGlasses) {
    currentWaterGlasses = glassNumber - 1;
  } else {
    currentWaterGlasses = glassNumber;
  }

  renderWaterTracker(currentWaterGlasses);

  // Persist to Firestore
  const today = getTodayDateString();
  const waterRef = doc(db, "users", currentUserId, "waterLogs", today);

  try {
    await setDoc(waterRef, {
      glasses: currentWaterGlasses,
      liters: parseFloat((currentWaterGlasses * 0.25).toFixed(2)),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("Error saving water log:", error);
    showToast("error", "Failed to save water intake.");
  }
}

// ──────────────────────────────────────────────
// Render: Nutrition Score
// ──────────────────────────────────────────────
function renderNutritionScore(consumed, goals) {
  let score = 0;
  const insights = [];

  // Calorie adherence (0–40 points)
  const calRatio = consumed.calories / goals.targetCalories;
  if (calRatio >= 0.85 && calRatio <= 1.1) {
    score += 40;
    insights.push({ text: "✓ Calorie target on track", positive: true });
  } else if (calRatio >= 0.6 && calRatio <= 1.25) {
    score += 25;
    insights.push({ text: "⚡ Calories slightly off target", positive: false });
  } else {
    score += 10;
    insights.push({ text: "⚠ Calories significantly off", positive: false });
  }

  // Protein (0–20)
  const protRatio = consumed.protein / goals.targetProtein;
  if (protRatio >= 0.8) {
    score += 20;
    insights.push({ text: "✓ Excellent protein intake", positive: true });
  } else if (protRatio >= 0.5) {
    score += 12;
    insights.push({ text: `Need ${Math.round(goals.targetProtein - consumed.protein)}g more protein`, positive: false });
  } else {
    score += 5;
    insights.push({ text: "⚠ Protein intake too low", positive: false });
  }

  // Carbs (0–20)
  const carbsRatio = consumed.carbs / goals.targetCarbs;
  if (carbsRatio >= 0.7 && carbsRatio <= 1.15) {
    score += 20;
  } else {
    score += 10;
  }

  // Fat (0–20)
  const fatRatio = consumed.fat / goals.targetFat;
  if (fatRatio >= 0.7 && fatRatio <= 1.15) {
    score += 20;
  } else {
    score += 10;
  }

  // Clamp to 100
  score = Math.min(score, 100);

  // If nothing consumed, show 0
  if (consumed.calories === 0) {
    score = 0;
    insights.length = 0;
    insights.push({ text: "Log meals to see your score", positive: false });
  }

  // Update DOM
  animateCount(scoreValue, score, 1000);

  const circumference = 2 * Math.PI * 18;
  const offset = circumference * (1 - score / 100);
  scoreRing.style.strokeDashoffset = offset;

  // Badge
  if (score >= 80) {
    scoreBadge.textContent = "Excellent";
    scoreBadge.className = "summary-card-badge badge-good";
  } else if (score >= 50) {
    scoreBadge.textContent = "Good";
    scoreBadge.className = "summary-card-badge badge-warn";
  } else {
    scoreBadge.textContent = "Needs work";
    scoreBadge.className = "summary-card-badge badge-info";
  }

  // Insights
  scoreInsights.innerHTML = insights
    .map((ins) => `<p class="score-insight-item ${ins.positive ? "positive" : "negative"}">${ins.text}</p>`)
    .join("");
}

// ──────────────────────────────────────────────
// Render: Today's Meals
// ──────────────────────────────────────────────
function renderMeals(meals) {
  if (!meals || meals.length === 0) {
    mealEmpty.style.display = "flex";
    mealsCount.textContent = "0";
    mealsBadge.textContent = "0 logged";
    return;
  }

  mealEmpty.style.display = "none";

  // Clear previous non-empty items
  mealList.querySelectorAll(".meal-item").forEach((el) => el.remove());

  const mealTypeConfig = {
    breakfast: { icon: "🌅", label: "Breakfast" },
    lunch:     { icon: "☀️", label: "Lunch" },
    dinner:    { icon: "🌙", label: "Dinner" },
    snacks:    { icon: "🍿", label: "Snacks" },
  };

  meals.forEach((meal) => {
    const config = mealTypeConfig[meal.type] || { icon: "🍴", label: meal.type };
    const el = document.createElement("div");
    el.className = "meal-item";
    el.innerHTML = `
      <div class="meal-type-icon ${meal.type}">${config.icon}</div>
      <div class="meal-info">
        <p class="meal-name">${config.label}${meal.items ? ` · ${meal.items.length} item${meal.items.length > 1 ? "s" : ""}` : ""}</p>
        <p class="meal-time">${meal.time || ""}</p>
      </div>
      <div class="meal-calories">
        <p class="meal-cal-value">${meal.totalCalories || 0}</p>
        <p class="meal-cal-label">kcal</p>
      </div>
    `;
    mealList.insertBefore(el, mealEmpty);
  });

  mealsCount.textContent = meals.length;
  mealsBadge.textContent = `${meals.length} logged`;
}

// ──────────────────────────────────────────────
// Load: User Data from Firestore
// ──────────────────────────────────────────────
async function loadUserData(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.warn("No user document found. Using defaults.");
      return null;
    }

    return userSnap.data();
  } catch (error) {
    console.error("Error loading user data:", error);
    showToast("error", "Failed to load your profile data.");
    return null;
  }
}

// ──────────────────────────────────────────────
// Load: Today's Meals from Firestore
// ──────────────────────────────────────────────
async function loadTodayMeals(uid) {
  try {
    const today = getTodayDateString();
    const mealsRef = collection(db, "users", uid, "meals");
    const q = query(mealsRef, where("date", "==", today), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const meals = [];
    snapshot.forEach((docSnap) => {
      meals.push({ id: docSnap.id, ...docSnap.data() });
    });

    return meals;
  } catch (error) {
    console.error("Error loading meals:", error);
    return [];
  }
}

// ──────────────────────────────────────────────
// Load: Today's Water Log
// ──────────────────────────────────────────────
async function loadWaterLog(uid) {
  try {
    const today = getTodayDateString();
    const waterRef = doc(db, "users", uid, "waterLogs", today);
    const waterSnap = await getDoc(waterRef);

    if (waterSnap.exists()) {
      return waterSnap.data().glasses || 0;
    }
    return 0;
  } catch (error) {
    console.error("Error loading water log:", error);
    return 0;
  }
}

// ──────────────────────────────────────────────
// Load: Latest Weight Log
// ──────────────────────────────────────────────
async function loadLatestWeight(uid) {
  try {
    const weightRef = collection(db, "users", uid, "weightLogs");
    const q = query(weightRef, orderBy("date", "desc"), limit(2));
    const snapshot = await getDocs(q);

    const entries = [];
    snapshot.forEach((docSnap) => entries.push(docSnap.data()));

    return entries;
  } catch (error) {
    console.error("Error loading weight logs:", error);
    return [];
  }
}

// ──────────────────────────────────────────────
// Hydrate Dashboard
// ──────────────────────────────────────────────
async function hydrateDashboard(user) {
  currentUserId = user.uid;

  // ---- Static header data ----
  const greeting = getGreeting();
  greetingText.textContent = greeting.text;
  greetingEmoji.textContent = greeting.emoji;
  currentDate.textContent = formatDisplayDate();

  const firstName = (user.displayName || "User").split(" ")[0];
  userFirstName.textContent = firstName;

  // Sidebar user info
  userDisplayName.textContent = user.displayName || "NutriTrack User";
  userEmail.textContent = user.email || "";

  // Avatar — photo or initials
  if (user.photoURL) {
    userAvatar.innerHTML = `<img src="${user.photoURL}" alt="Profile photo" referrerpolicy="no-referrer">`;
  } else {
    const initials = (user.displayName || "U")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    userAvatar.textContent = initials;
  }

  // ---- Fetch data in parallel ----
  const [userData, meals, waterGlasses, weightEntries] = await Promise.all([
    loadUserData(user.uid),
    loadTodayMeals(user.uid),
    loadWaterLog(user.uid),
    loadLatestWeight(user.uid),
  ]);

  // ---- Goals (from Firestore or defaults) ----
  const goals = userData?.goals || {
    targetCalories: 2000,
    targetProtein: 140,
    targetCarbs: 250,
    targetFat: 70,
    targetFiber: 30,
  };

  // ---- Streak ----
  const streak = userData?.streak?.current || 0;
  streakCount.textContent = streak;

  // ---- Aggregate today's nutrition from meals ----
  let totalCal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  meals.forEach((meal) => {
    totalCal     += meal.totalCalories || 0;
    totalProtein += meal.totalProtein  || 0;
    totalCarbs   += meal.totalCarbs    || 0;
    totalFat     += meal.totalFat      || 0;
    totalFiber   += meal.totalFiber    || 0;
  });

  // ---- Render everything with animations ----

  // Small delay to let the page paint first
  requestAnimationFrame(() => {
    // Calorie ring
    renderCalorieRing(Math.round(totalCal), goals.targetCalories);

    // Macro bars
    renderMacro(proteinConsumed, proteinTarget, proteinBar, Math.round(totalProtein), goals.targetProtein);
    renderMacro(carbsConsumed, carbsTarget, carbsBar, Math.round(totalCarbs), goals.targetCarbs);
    renderMacro(fatConsumed, fatTarget, fatBar, Math.round(totalFat), goals.targetFat);
    renderMacro(fiberConsumed, fiberTarget, fiberBar, Math.round(totalFiber), goals.targetFiber || 30);

    // Meals
    renderMeals(meals);

    // Water
    currentWaterGlasses = waterGlasses;
    renderWaterTracker(currentWaterGlasses);

    // Weight
    if (weightEntries.length > 0) {
      const latest = weightEntries[0];
      weightValue.textContent = latest.weight || "--";

      if (weightEntries.length >= 2) {
        const prev = weightEntries[1];
        const diff = latest.weight - prev.weight;
        if (diff < -0.1) {
          weightTrend.className = "weight-trend down";
          weightTrend.querySelector("svg").innerHTML = '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>';
          weightTrendText.textContent = `${Math.abs(diff).toFixed(1)} kg ↓`;
        } else if (diff > 0.1) {
          weightTrend.className = "weight-trend up";
          weightTrend.querySelector("svg").innerHTML = '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>';
          weightTrendText.textContent = `${diff.toFixed(1)} kg ↑`;
        } else {
          weightTrend.className = "weight-trend stable";
          weightTrend.querySelector("svg").innerHTML = '<line x1="5" y1="12" x2="19" y2="12"/>';
          weightTrendText.textContent = "Stable";
        }
      }
    } else if (userData?.profile?.weight) {
      weightValue.textContent = userData.profile.weight;
    }

    // Nutrition Score
    renderNutritionScore(
      { calories: totalCal, protein: totalProtein, carbs: totalCarbs, fat: totalFat },
      goals
    );
  });
}

// ──────────────────────────────────────────────
// Auth Guard & Bootstrap
// ──────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not authenticated → redirect to login
    window.location.href = "./login.html";
    return;
  }

  try {
    await hydrateDashboard(user);
  } catch (err) {
    console.error("Dashboard hydration error:", err);
    showToast("error", "Something went wrong loading your dashboard.");
  } finally {
    // Dismiss loading screen
    appLoading.classList.add("hidden");
    setTimeout(() => appLoading.remove(), 600);
  }
});
