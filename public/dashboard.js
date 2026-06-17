// public/dashboard.js
// Dashboard page logic — auth guard, Firestore data loading (daily_logs path),
// calorie ring, macro bars, water tracker, meals list. Emoji-free SVG icons.

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, getDocs, orderBy, limit, query,
  serverTimestamp, where,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── SVG Icon library (meal types) ──
const MEAL_ICONS = {
  breakfast: '<svg viewBox="0 0 24 24"><path d="M12 2v4"/><path d="M6.34 6.34l2.83 2.83"/><path d="M2 12h4"/><circle cx="12" cy="17" r="5"/><line x1="12" y1="22" x2="12" y2="22"/></svg>',
  lunch:     '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  dinner:    '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>',
  snacks:    '<svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
};

// ── DOM ──
const appLoading       = document.getElementById("app-loading");
const toastContainer   = document.getElementById("toast-container");
const greetingText     = document.getElementById("greeting-text");
const userFirstName    = document.getElementById("user-first-name");
const streakCount      = document.getElementById("streak-count");
const currentDate      = document.getElementById("current-date");
const sidebar          = document.getElementById("sidebar");
const hamburger        = document.getElementById("hamburger");
const sidebarOverlay   = document.getElementById("sidebar-overlay");
const userAvatar       = document.getElementById("user-avatar");
const userDisplayName  = document.getElementById("user-display-name");
const userEmail        = document.getElementById("user-email");
const btnSignout       = document.getElementById("btn-signout");
const calRing          = document.getElementById("cal-ring");
const calConsumed      = document.getElementById("cal-consumed");
const calTargetDisplay = document.getElementById("cal-target-display");
const statConsumed     = document.getElementById("stat-consumed");
const statRemaining    = document.getElementById("stat-remaining");
const statBurned       = document.getElementById("stat-burned");
const proteinConsumed  = document.getElementById("protein-consumed");
const proteinTarget    = document.getElementById("protein-target");
const proteinBar       = document.getElementById("protein-bar");
const carbsConsumed    = document.getElementById("carbs-consumed");
const carbsTarget      = document.getElementById("carbs-target");
const carbsBar         = document.getElementById("carbs-bar");
const fatConsumed      = document.getElementById("fat-consumed");
const fatTarget        = document.getElementById("fat-target");
const fatBar           = document.getElementById("fat-bar");
const fiberConsumed    = document.getElementById("fiber-consumed");
const fiberTarget      = document.getElementById("fiber-target");
const fiberBar         = document.getElementById("fiber-bar");
const waterAmount      = document.getElementById("water-amount");
const waterBadge       = document.getElementById("water-badge");
const waterTracker     = document.getElementById("water-tracker");
const weightValue      = document.getElementById("weight-value");
const weightTrend      = document.getElementById("weight-trend");
const weightTrendText  = document.getElementById("weight-trend-text");
const mealList         = document.getElementById("meal-list");
const mealEmpty        = document.getElementById("meal-empty");

// ── Toast ──
function showToast(type, message, duration = 4000) {
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  toastContainer.appendChild(t);
  setTimeout(() => { t.classList.add("removing"); t.addEventListener("animationend", () => t.remove()); }, duration);
}

// ── Date Helpers ──
function getTodayDateString() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}
function formatDisplayDate() {
  return new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// ── Animate count ──
function animateCount(el, target, dur = 800) {
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  if (diff === 0) return;
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    const e = 1 - (1 - p) * (1 - p);
    el.textContent = Math.round(start + diff * e);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Sidebar toggle ──
hamburger.addEventListener("click", () => { sidebar.classList.toggle("open"); sidebarOverlay.classList.toggle("active"); });
sidebarOverlay.addEventListener("click", () => { sidebar.classList.remove("open"); sidebarOverlay.classList.remove("active"); });

// ── Sign Out ──
btnSignout.addEventListener("click", async () => {
  try { await signOut(auth); window.location.href = "./login.html"; }
  catch (e) { console.error("Sign-out error:", e); showToast("error", "Failed to sign out."); }
});

// ── Render: Calorie Ring ──
function renderCalorieRing(consumed, target) {
  const circ = 2 * Math.PI * 72;
  calRing.style.strokeDashoffset = circ * (1 - Math.min(consumed / target, 1));
  animateCount(calConsumed, consumed);
  calTargetDisplay.textContent = target;
  statConsumed.textContent = `${consumed} kcal`;
  statRemaining.textContent = `${Math.max(0, target - consumed)} kcal`;
  statBurned.textContent = `0 kcal`;
}

// ── Render: Macro bars ──
function renderMacro(curEl, tgtEl, barEl, consumed, target) {
  animateCount(curEl, consumed);
  tgtEl.textContent = target;
  barEl.style.width = `${Math.min((consumed / target) * 100, 100)}%`;
}

// ── Render: Water Tracker ──
let currentWaterGlasses = 0;
let currentUserId = null;

function renderWaterTracker(glasses) {
  waterTracker.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const d = document.createElement("div");
    d.className = `water-drop ${i < glasses ? "filled" : ""}`;
    d.title = `Glass ${i + 1}`;
    d.addEventListener("click", () => handleWaterClick(i + 1));
    waterTracker.appendChild(d);
  }
  waterAmount.textContent = (glasses * 0.25).toFixed(1);
  waterBadge.textContent = `${glasses} / 8`;
  waterBadge.className = glasses >= 6 ? "summary-card-badge badge-good" : glasses >= 3 ? "summary-card-badge badge-warn" : "summary-card-badge badge-info";
}

async function handleWaterClick(n) {
  if (!currentUserId) return;
  currentWaterGlasses = n === currentWaterGlasses ? n - 1 : n;
  renderWaterTracker(currentWaterGlasses);
  try {
    await setDoc(doc(db, "users", currentUserId, "waterLogs", getTodayDateString()), {
      glasses: currentWaterGlasses, liters: parseFloat((currentWaterGlasses * 0.25).toFixed(2)),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) { console.error("Water save error:", e); showToast("error", "Failed to save water intake."); }
}

// ── Render: Today's Meals ──
function renderMeals(meals) {
  if (!meals || meals.length === 0) {
    mealEmpty.style.display = "flex";
    return;
  }
  mealEmpty.style.display = "none";
  mealList.querySelectorAll(".meal-item").forEach(el => el.remove());

  const labels = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

  meals.forEach(meal => {
    const icon = MEAL_ICONS[meal.mealType || meal.type] || MEAL_ICONS.snacks;
    const el = document.createElement("div");
    el.className = "meal-item";
    el.innerHTML = `
      <div class="meal-type-icon ${meal.mealType || meal.type}">${icon}</div>
      <div class="meal-info">
        <p class="meal-name">${meal.foodName || labels[meal.mealType || meal.type] || "Meal"}</p>
        <p class="meal-time">${meal.servingGrams ? meal.servingGrams + "g" : ""}${meal.loggedAt ? "" : ""}</p>
      </div>
      <div class="meal-calories">
        <p class="meal-cal-value">${meal.calories || meal.totalCalories || 0}</p>
        <p class="meal-cal-label">kcal</p>
      </div>`;
    mealList.insertBefore(el, mealEmpty);
  });
}

// ── Firestore Loaders ──
async function loadUserData(uid) {
  try { const s = await getDoc(doc(db, "users", uid)); return s.exists() ? s.data() : null; }
  catch (e) { console.error("Load user error:", e); return null; }
}

async function loadTodayItems(uid) {
  try {
    const today = getTodayDateString();
    const ref = collection(db, "users", uid, "daily_logs", today, "items");
    const snap = await getDocs(ref);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return items;
  } catch (e) { console.error("Load items error:", e); return []; }
}

async function loadWaterLog(uid) {
  try {
    const s = await getDoc(doc(db, "users", uid, "waterLogs", getTodayDateString()));
    return s.exists() ? s.data().glasses || 0 : 0;
  } catch (e) { console.error("Water load error:", e); return 0; }
}

async function loadLatestWeight(uid) {
  try {
    const ref = collection(db, "users", uid, "weightLogs");
    const q2 = query(ref, orderBy("date", "desc"), limit(2));
    const snap = await getDocs(q2);
    const entries = [];
    snap.forEach(d => entries.push(d.data()));
    return entries;
  } catch (e) { console.error("Weight load error:", e); return []; }
}

// ── Hydrate Dashboard ──
async function hydrateDashboard(user) {
  currentUserId = user.uid;
  greetingText.textContent = getGreeting();
  currentDate.textContent = formatDisplayDate();
  userFirstName.textContent = (user.displayName || "User").split(" ")[0];
  userDisplayName.textContent = user.displayName || "NutriTrack User";
  userEmail.textContent = user.email || "";

  if (user.photoURL) {
    userAvatar.innerHTML = `<img src="${user.photoURL}" alt="Profile" referrerpolicy="no-referrer">`;
  } else {
    userAvatar.textContent = (user.displayName || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  const [userData, items, waterGlasses, weightEntries] = await Promise.all([
    loadUserData(user.uid), loadTodayItems(user.uid),
    loadWaterLog(user.uid), loadLatestWeight(user.uid),
  ]);

  const goals = userData?.goals || { targetCalories: 2000, targetProtein: 140, targetCarbs: 250, targetFat: 70, targetFiber: 30 };
  streakCount.textContent = userData?.streak?.current || 0;

  // Aggregate totals from daily_logs items
  let totalCal = 0, totalP = 0, totalC = 0, totalF = 0, totalFb = 0;
  items.forEach(it => {
    totalCal += it.calories || 0;
    totalP   += it.protein || 0;
    totalC   += it.carbs || 0;
    totalF   += it.fat || 0;
    totalFb  += it.fiber || 0;
  });

  requestAnimationFrame(() => {
    renderCalorieRing(Math.round(totalCal), goals.targetCalories);
    renderMacro(proteinConsumed, proteinTarget, proteinBar, Math.round(totalP), goals.targetProtein);
    renderMacro(carbsConsumed, carbsTarget, carbsBar, Math.round(totalC), goals.targetCarbs);
    renderMacro(fatConsumed, fatTarget, fatBar, Math.round(totalF), goals.targetFat);
    renderMacro(fiberConsumed, fiberTarget, fiberBar, Math.round(totalFb), goals.targetFiber || 30);
    renderMeals(items);
    currentWaterGlasses = waterGlasses;
    renderWaterTracker(currentWaterGlasses);

    if (weightEntries.length > 0) {
      weightValue.textContent = weightEntries[0].weight || "--";
      if (weightEntries.length >= 2) {
        const diff = weightEntries[0].weight - weightEntries[1].weight;
        if (diff < -0.1) {
          weightTrend.className = "weight-trend down";
          weightTrend.querySelector("svg").innerHTML = '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>';
          weightTrendText.textContent = `${Math.abs(diff).toFixed(1)} kg down`;
        } else if (diff > 0.1) {
          weightTrend.className = "weight-trend up";
          weightTrend.querySelector("svg").innerHTML = '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>';
          weightTrendText.textContent = `${diff.toFixed(1)} kg up`;
        }
      }
    } else if (userData?.profile?.weight) {
      weightValue.textContent = userData.profile.weight;
    }
  });
}

// ── Auth Guard ──
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "./login.html"; return; }
  try { await hydrateDashboard(user); }
  catch (e) { console.error("Hydration error:", e); showToast("error", "Something went wrong."); }
  finally { appLoading.classList.add("hidden"); setTimeout(() => appLoading.remove(), 600); }
});
