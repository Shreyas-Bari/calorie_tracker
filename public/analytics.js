// public/analytics.js
// Analytics page — Daily/Weekly/Monthly nutrition analysis with Chart.js.
// Reads from Firestore: users/{uid}/daily_logs/{date}/items, weightLogs, goals.

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc, getDoc, collection, getDocs, query, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── DOM References ──
const appLoading      = document.getElementById("app-loading");
const toastContainer  = document.getElementById("toast-container");
const sidebar         = document.getElementById("sidebar");
const hamburger       = document.getElementById("hamburger");
const sidebarOverlay  = document.getElementById("sidebar-overlay");
const userAvatar      = document.getElementById("user-avatar");
const userDisplayName = document.getElementById("user-display-name");
const userEmail       = document.getElementById("user-email");
const btnSignout      = document.getElementById("btn-signout");
const currentDateEl   = document.getElementById("current-date");
const tabBar          = document.getElementById("tab-bar");

// ── Chart instances ──
let macroPieChart = null;
let weeklyCalChart = null;
let weeklyMacroChart = null;
let monthlyCalChart = null;
let monthlyWeightChart = null;

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
function dateStringOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatShortDate(ds) {
  const parts = ds.split("-");
  const d = new Date(+parts[0], +parts[1]-1, +parts[2]);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function formatDayLabel(ds) {
  const parts = ds.split("-");
  const d = new Date(+parts[0], +parts[1]-1, +parts[2]);
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

// ── Sidebar toggle ──
hamburger.addEventListener("click", () => { sidebar.classList.toggle("open"); sidebarOverlay.classList.toggle("active"); });
sidebarOverlay.addEventListener("click", () => { sidebar.classList.remove("open"); sidebarOverlay.classList.remove("active"); });

// ── Sign Out ──
btnSignout.addEventListener("click", async () => {
  try { await signOut(auth); window.location.href = "./login.html"; }
  catch (e) { console.error("Sign-out error:", e); showToast("error", "Failed to sign out."); }
});

// ── Tab Switching ──
tabBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
});

// ── Chart.js Defaults ──
function configureChartDefaults() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.color = "rgba(241, 245, 249, 0.55)";
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.labels.boxWidth = 14;
  Chart.defaults.plugins.legend.labels.padding = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(10, 8, 30, 0.9)";
  Chart.defaults.plugins.tooltip.borderColor = "rgba(255,255,255,0.1)";
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
  Chart.defaults.scale.grid = { color: "rgba(255, 255, 255, 0.09)" };
  Chart.defaults.scale.border = { color: "rgba(255, 255, 255, 0.12)" };
}

// ── Firestore Loaders ──
async function loadUserData(uid) {
  try { const s = await getDoc(doc(db, "users", uid)); return s.exists() ? s.data() : null; }
  catch (e) { console.error("Load user error:", e); return null; }
}

async function loadDayItems(uid, dateStr) {
  try {
    const ref = collection(db, "users", uid, "daily_logs", dateStr, "items");
    const snap = await getDocs(ref);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return items;
  } catch { return []; }
}

async function loadMultipleDays(uid, numDays) {
  const results = {};
  const promises = [];
  for (let i = 0; i < numDays; i++) {
    const ds = dateStringOffset(-i);
    promises.push(
      loadDayItems(uid, ds).then(items => { results[ds] = items; })
    );
  }
  await Promise.all(promises);
  return results;
}

async function loadWeightLogs(uid, numDays) {
  try {
    const ref = collection(db, "users", uid, "weightLogs");
    const q2 = query(ref, orderBy("date", "desc"), limit(numDays));
    const snap = await getDocs(q2);
    const entries = [];
    snap.forEach(d => entries.push({ id: d.id, ...d.data() }));
    return entries;
  } catch { return []; }
}

// ── Aggregate day data ──
function aggregateDay(items) {
  let cal = 0, pro = 0, carb = 0, fat = 0, fib = 0;
  items.forEach(it => {
    cal  += it.calories || 0;
    pro  += it.protein  || 0;
    carb += it.carbs    || 0;
    fat  += it.fat      || 0;
    fib  += it.fiber    || 0;
  });
  return { cal: Math.round(cal), pro: Math.round(pro), carb: Math.round(carb), fat: Math.round(fat), fib: Math.round(fib), count: items.length };
}

// ── Nutrition Score ──
function calculateNutritionScore(totals, goals) {
  if (totals.count === 0) return 0;
  const target = goals.targetCalories || 2000;
  const calRatio = totals.cal / target;
  // Calorie adherence: 100 if within 10%, drops off
  let calScore = 0;
  if (calRatio >= 0.9 && calRatio <= 1.1) calScore = 40;
  else if (calRatio >= 0.8 && calRatio <= 1.2) calScore = 30;
  else if (calRatio >= 0.7 && calRatio <= 1.3) calScore = 20;
  else calScore = 10;

  // Macro balance (protein, carbs, fat ratios)
  const totalMacroG = totals.pro + totals.carb + totals.fat;
  let macroScore = 0;
  if (totalMacroG > 0) {
    const proRatio = totals.pro / totalMacroG;
    const carbRatio = totals.carb / totalMacroG;
    const fatRatio = totals.fat / totalMacroG;
    // Ideal: ~30% P, 45% C, 25% F
    const proDiff = Math.abs(proRatio - 0.30);
    const carbDiff = Math.abs(carbRatio - 0.45);
    const fatDiff = Math.abs(fatRatio - 0.25);
    const avgDiff = (proDiff + carbDiff + fatDiff) / 3;
    macroScore = Math.round(Math.max(0, 35 * (1 - avgDiff * 5)));
  }

  // Fiber bonus
  const fiberTarget = goals.targetFiber || 30;
  const fiberScore = Math.min(15, Math.round(15 * (totals.fib / fiberTarget)));

  // Variety bonus (number of items logged)
  const varietyScore = Math.min(10, totals.count * 2);

  return Math.min(100, calScore + macroScore + fiberScore + varietyScore);
}

function getScoreGrade(score) {
  if (score >= 80) return { text: "Excellent", cls: "excellent" };
  if (score >= 60) return { text: "Good", cls: "good" };
  if (score >= 40) return { text: "Fair", cls: "fair" };
  return { text: "Needs Improvement", cls: "poor" };
}

// ── Generate Insights ──
function generateInsights(totals, goals) {
  const insights = [];
  const target = goals.targetCalories || 2000;

  if (totals.count === 0) {
    insights.push({
      type: "info",
      title: "No meals logged today",
      desc: "Start logging your meals to see personalized nutrition insights."
    });
    return insights;
  }

  // Calorie adherence
  const calDiff = totals.cal - target;
  if (Math.abs(calDiff) <= target * 0.1) {
    insights.push({ type: "success", title: "Great calorie balance", desc: `You're within 10% of your ${target} kcal target. Keep it up!` });
  } else if (calDiff > 0) {
    insights.push({ type: "warning", title: `${calDiff} kcal over target`, desc: `You've consumed ${totals.cal} kcal against your ${target} kcal target. Consider lighter options for remaining meals.` });
  } else {
    insights.push({ type: "info", title: `${Math.abs(calDiff)} kcal remaining`, desc: `You have room for ${Math.abs(calDiff)} more kcal today. Consider a balanced snack.` });
  }

  // Protein check
  const proTarget = goals.targetProtein || 140;
  const proGap = proTarget - totals.pro;
  if (proGap > 20) {
    insights.push({
      type: "warning",
      title: `${proGap}g short of protein target`,
      desc: "Recommended: Paneer, Greek Yogurt, Chicken Breast, Dal, or Eggs."
    });
  } else if (proGap <= 0) {
    insights.push({ type: "success", title: "Protein target achieved", desc: `You've hit ${totals.pro}g of your ${proTarget}g protein goal.` });
  }

  // Fiber check
  const fibTarget = goals.targetFiber || 30;
  if (totals.fib < fibTarget * 0.5) {
    insights.push({
      type: "error",
      title: "Low fiber intake",
      desc: "Try adding whole grains, fruits, vegetables, or legumes like Rajma and Chole."
    });
  }

  // Fat check
  const fatTarget = goals.targetFat || 70;
  if (totals.fat > fatTarget * 1.3) {
    insights.push({
      type: "warning",
      title: "Fat intake above target",
      desc: `You've consumed ${totals.fat}g fat vs your ${fatTarget}g target. Consider reducing fried foods.`
    });
  }

  return insights;
}

// ── Render: Daily Tab ──
function renderDailyTab(todayTotals, goals) {
  // Nutrition Score
  const score = calculateNutritionScore(todayTotals, goals);
  const grade = getScoreGrade(score);
  const scoreEl = document.getElementById("score-value");
  const gradeEl = document.getElementById("score-grade");
  const ringEl = document.getElementById("score-ring-fill");
  scoreEl.textContent = score;
  gradeEl.textContent = grade.text;
  gradeEl.className = `score-grade ${grade.cls}`;
  const circ = 2 * Math.PI * 68;
  ringEl.style.strokeDashoffset = circ * (1 - score / 100);

  // Macro Pie Chart
  const ctx = document.getElementById("chart-macro-pie");
  if (macroPieChart) macroPieChart.destroy();
  macroPieChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Protein", "Carbs", "Fat", "Fiber"],
      datasets: [{
        data: [todayTotals.pro, todayTotals.carb, todayTotals.fat, todayTotals.fib],
        backgroundColor: ["#F472B6", "#FBBF24", "#34D399", "#60A5FA"],
        borderColor: "transparent",
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed}g`
          }
        }
      }
    }
  });

  // Calorie Breakdown
  const breakdownEl = document.getElementById("cal-breakdown-rows");
  const meals = [
    { label: "Protein", value: todayTotals.pro, unit: "g", color: "#F472B6", pct: todayTotals.pro > 0 ? Math.round((todayTotals.pro * 4 / Math.max(todayTotals.cal, 1)) * 100) : 0 },
    { label: "Carbs", value: todayTotals.carb, unit: "g", color: "#FBBF24", pct: todayTotals.carb > 0 ? Math.round((todayTotals.carb * 4 / Math.max(todayTotals.cal, 1)) * 100) : 0 },
    { label: "Fat", value: todayTotals.fat, unit: "g", color: "#34D399", pct: todayTotals.fat > 0 ? Math.round((todayTotals.fat * 9 / Math.max(todayTotals.cal, 1)) * 100) : 0 },
    { label: "Fiber", value: todayTotals.fib, unit: "g", color: "#60A5FA", pct: 0 },
  ];
  breakdownEl.innerHTML = meals.map(m => `
    <div class="breakdown-row">
      <span class="breakdown-dot" style="background:${m.color}"></span>
      <span class="breakdown-label">${m.label}</span>
      <span class="breakdown-value">${m.value}${m.unit}</span>
      <span class="breakdown-pct">${m.pct > 0 ? m.pct + '%' : '--'}</span>
    </div>
  `).join("");

  // Insights
  const insightsEl = document.getElementById("insights-list");
  const insights = generateInsights(todayTotals, goals);
  insightsEl.innerHTML = insights.map(i => {
    const iconSvgs = {
      success: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    };
    return `
      <div class="insight-item">
        <div class="insight-icon ${i.type}">${iconSvgs[i.type]}</div>
        <div class="insight-text">
          <p class="insight-title">${i.title}</p>
          <p class="insight-desc">${i.desc}</p>
        </div>
      </div>
    `;
  }).join("");
}

// ── Render: Weekly Tab ──
function renderWeeklyTab(daysData, goals) {
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const ds = dateStringOffset(-i);
    const items = daysData[ds] || [];
    last7.push({ date: ds, ...aggregateDay(items) });
  }

  // Stat Tiles
  const daysWithData = last7.filter(d => d.count > 0);
  const n = daysWithData.length || 1;
  const avgCal  = Math.round(daysWithData.reduce((s, d) => s + d.cal, 0) / n);
  const avgPro  = Math.round(daysWithData.reduce((s, d) => s + d.pro, 0) / n);
  const avgCarb = Math.round(daysWithData.reduce((s, d) => s + d.carb, 0) / n);
  const avgFat  = Math.round(daysWithData.reduce((s, d) => s + d.fat, 0) / n);

  document.getElementById("weekly-avg-cal").textContent = avgCal;
  document.getElementById("weekly-avg-pro").textContent = avgPro;
  document.getElementById("weekly-avg-carb").textContent = avgCarb;
  document.getElementById("weekly-avg-fat").textContent = avgFat;

  const labels = last7.map(d => formatDayLabel(d.date));
  const target = goals.targetCalories || 2000;

  // Calorie Bar Chart
  const ctxCal = document.getElementById("chart-weekly-cal");
  if (weeklyCalChart) weeklyCalChart.destroy();
  weeklyCalChart = new Chart(ctxCal, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Calories",
          data: last7.map(d => d.cal),
          backgroundColor: last7.map(d => d.cal > target ? "rgba(248,113,113,0.7)" : "rgba(108,99,255,0.7)"),
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "Target",
          data: last7.map(() => target),
          type: "line",
          borderColor: "rgba(34,211,238,0.6)",
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} kcal` } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            padding: 8,
            callback: v => v + " kcal"
          }
        },
        x: {
          ticks: {
            padding: 8
          }
        }
      }
    }
  });

  // Macro Stacked Bar
  const ctxMacro = document.getElementById("chart-weekly-macro");
  if (weeklyMacroChart) weeklyMacroChart.destroy();
  weeklyMacroChart = new Chart(ctxMacro, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Protein (g)", data: last7.map(d => d.pro), backgroundColor: "#F472B6", borderRadius: 4, borderSkipped: false },
        { label: "Carbs (g)", data: last7.map(d => d.carb), backgroundColor: "#FBBF24", borderRadius: 4, borderSkipped: false },
        { label: "Fat (g)", data: last7.map(d => d.fat), backgroundColor: "#34D399", borderRadius: 4, borderSkipped: false },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: {
          stacked: true,
          ticks: {
            padding: 8
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            padding: 8,
            callback: v => v + "g"
          }
        }
      }
    }
  });
}

// ── Render: Monthly Tab ──
function renderMonthlyTab(daysData, goals, weightEntries) {
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const ds = dateStringOffset(-i);
    const items = daysData[ds] || [];
    last30.push({ date: ds, ...aggregateDay(items) });
  }
  const target = goals.targetCalories || 2000;

  // Goal Achievement
  const daysLogged = last30.filter(d => d.count > 0);
  const daysOnTarget = daysLogged.filter(d => d.cal <= target * 1.1);
  const daysOff = daysLogged.filter(d => d.cal > target * 1.1);
  const pct = daysLogged.length > 0 ? Math.round((daysOnTarget.length / daysLogged.length) * 100) : 0;

  document.getElementById("monthly-goal-pct").textContent = pct + "%";
  document.getElementById("monthly-goal-desc").textContent =
    pct >= 80 ? "Outstanding consistency!" :
    pct >= 60 ? "Good progress, keep improving!" :
    pct >= 40 ? "Room for improvement." : "Let's get back on track!";
  document.getElementById("monthly-days-on").textContent = daysOnTarget.length;
  document.getElementById("monthly-days-off").textContent = daysOff.length;
  document.getElementById("monthly-days-logged").textContent = daysLogged.length;

  // Best / Worst Days
  if (daysLogged.length > 0) {
    // "Best day" = closest to target
    const sorted = [...daysLogged].sort((a, b) => Math.abs(a.cal - target) - Math.abs(b.cal - target));
    const best = sorted[0];
    const worst = [...daysLogged].sort((a, b) => (b.cal - target) - (a.cal - target))[0];
    document.getElementById("best-day-date").textContent = formatShortDate(best.date);
    document.getElementById("best-day-cal").textContent = best.cal + " kcal";
    document.getElementById("worst-day-date").textContent = formatShortDate(worst.date);
    document.getElementById("worst-day-cal").textContent = worst.cal + " kcal";
  }

  // 30-day Calorie Line Chart
  const ctxCal = document.getElementById("chart-monthly-cal");
  if (monthlyCalChart) monthlyCalChart.destroy();
  monthlyCalChart = new Chart(ctxCal, {
    type: "line",
    data: {
      labels: last30.map(d => formatShortDate(d.date)),
      datasets: [
        {
          label: "Calories",
          data: last30.map(d => d.cal || null),
          borderColor: "#6C63FF",
          backgroundColor: "rgba(108,99,255,0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          spanGaps: true,
        },
        {
          label: "Target",
          data: last30.map(() => target),
          borderColor: "rgba(34,211,238,0.5)",
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} kcal` } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            padding: 8,
            callback: v => v + " kcal"
          }
        },
        x: {
          offset: true,
          ticks: {
            padding: 8,
            maxTicksLimit: 10,
            maxRotation: 45,
            minRotation: 0
          }
        }
      }
    }
  });

  // Weight Trend Line Chart
  const ctxWeight = document.getElementById("chart-monthly-weight");
  if (monthlyWeightChart) monthlyWeightChart.destroy();

  if (weightEntries.length > 0) {
    // Sort chronologically
    const sortedW = [...weightEntries].sort((a, b) => {
      const da = a.date || a.id;
      const db = b.date || b.id;
      return da < db ? -1 : da > db ? 1 : 0;
    });
    monthlyWeightChart = new Chart(ctxWeight, {
      type: "line",
      data: {
        labels: sortedW.map(w => formatShortDate(w.date || w.id)),
        datasets: [{
          label: "Weight (kg)",
          data: sortedW.map(w => w.weight),
          borderColor: "#22D3EE",
          backgroundColor: "rgba(34,211,238,0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#22D3EE",
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} kg` } }
        },
        scales: {
          y: {
            ticks: {
              padding: 8,
              callback: v => v + " kg"
            }
          },
          x: {
            offset: true,
            ticks: {
              padding: 8
            }
          }
        }
      }
    });
  } else {
    // No weight data message
    const parent = ctxWeight.parentElement;
    ctxWeight.style.display = "none";
    const msg = document.createElement("div");
    msg.className = "analytics-empty";
    msg.innerHTML = `
      <div class="analytics-empty-icon">
        <svg viewBox="0 0 24 24"><path d="M6 2h12l3 7H3l3-7z"/><rect x="4" y="9" width="16" height="13" rx="2"/><line x1="12" y1="13" x2="12" y2="17"/></svg>
      </div>
      <p class="analytics-empty-title">No weight data yet</p>
      <p class="analytics-empty-text">Log your weight on the Goals &amp; Profile page to see trends here.</p>
    `;
    parent.appendChild(msg);
  }
}

// ── Hydrate Page ──
async function hydratePage(user) {
  currentDateEl.textContent = formatDisplayDate();
  userDisplayName.textContent = user.displayName || "NutriTrack User";
  userEmail.textContent = user.email || "";

  if (user.photoURL) {
    userAvatar.innerHTML = `<img src="${user.photoURL}" alt="Profile" referrerpolicy="no-referrer">`;
  } else {
    userAvatar.textContent = (user.displayName || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  configureChartDefaults();

  // Load data in parallel
  const [userData, allDaysData, weightEntries] = await Promise.all([
    loadUserData(user.uid),
    loadMultipleDays(user.uid, 30),
    loadWeightLogs(user.uid, 60),
  ]);

  const goals = userData?.goals || {
    targetCalories: 2000, targetProtein: 140,
    targetCarbs: 250, targetFat: 70, targetFiber: 30,
  };

  const todayStr = getTodayDateString();
  const todayItems = allDaysData[todayStr] || [];
  const todayTotals = aggregateDay(todayItems);

  // Render all tabs
  renderDailyTab(todayTotals, goals);
  renderWeeklyTab(allDaysData, goals);
  renderMonthlyTab(allDaysData, goals, weightEntries);
}

// ── Auth Guard ──
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "./login.html"; return; }
  try { await hydratePage(user); }
  catch (e) { console.error("Analytics hydration error:", e); showToast("error", "Something went wrong loading analytics."); }
  finally { appLoading.classList.add("hidden"); setTimeout(() => appLoading.remove(), 600); }
});
