// public/search-log.js
// Unified Food Search & Journal — two-column workspace.
// Left: search + inline calculator. Right: today's live journal with delete.
// Firestore path: users/{uid}/daily_logs/{date}/items/{auto-id}

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection, addDoc, deleteDoc, doc, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── SVG Icons for meal types ──
const MEAL_SVG = {
  breakfast: '<svg viewBox="0 0 24 24"><path d="M12 2v4"/><path d="M6.34 6.34l2.83 2.83"/><path d="M2 12h4"/><circle cx="12" cy="17" r="5"/></svg>',
  lunch:     '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>',
  dinner:    '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>',
  snacks:    '<svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
};
const TRASH_SVG = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

// ── DOM ──
const appLoading     = document.getElementById("app-loading");
const toastContainer = document.getElementById("toast-container");
const sidebar        = document.getElementById("sidebar");
const hamburger      = document.getElementById("hamburger");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const userAvatar     = document.getElementById("user-avatar");
const userDisplayName = document.getElementById("user-display-name");
const userEmail      = document.getElementById("user-email");
const btnSignout     = document.getElementById("btn-signout");
const currentDateEl  = document.getElementById("current-date");
const searchInput    = document.getElementById("search-input");
const searchClear    = document.getElementById("search-clear");
const categoryPills  = document.getElementById("category-pills");
const resultsCount   = document.getElementById("results-count");
const foodListEl     = document.getElementById("food-list");
const emptyState     = document.getElementById("empty-state");
const calcPanel      = document.getElementById("calculator-panel");
const calcFoodName   = document.getElementById("calc-food-name");
const calcFoodCat    = document.getElementById("calc-food-cat");
const calcClose      = document.getElementById("calc-close");
const servingInput   = document.getElementById("serving-input");
const servingMinus   = document.getElementById("serving-minus");
const servingPlus    = document.getElementById("serving-plus");
const servingChips   = document.getElementById("serving-chips");
const calcCal        = document.getElementById("calc-cal");
const calcPro        = document.getElementById("calc-pro");
const calcCarb       = document.getElementById("calc-carb");
const calcFat        = document.getElementById("calc-fat");
const calcFib        = document.getElementById("calc-fib");
const btnLog         = document.getElementById("btn-log");
const journalGroups  = document.getElementById("journal-groups");
const journalEmpty   = document.getElementById("journal-empty");
const totalsCal      = document.getElementById("totals-cal");
const totalsPro      = document.getElementById("totals-pro");
const totalsCarb     = document.getElementById("totals-carb");
const totalsFat      = document.getElementById("totals-fat");
const totalsFib      = document.getElementById("totals-fib");

// ── State ──
let currentUserId = null;
let selectedFood  = null;
let activeCategory = "all";
let debounceTimer = null;
let todayItems    = []; // in-memory mirror of Firestore items

// ──────────────────────────────────────────────
// Indian Food Database (~60 items, per 100g)
// ──────────────────────────────────────────────
const FOOD_DB = [
  // Breakfast
  { id:"poha",         name:"Poha (Flattened Rice)",   category:"Breakfast",    calories:248, protein:4.4,  carbs:34.2, fat:10.4, fiber:2.6 },
  { id:"upma",         name:"Upma (Semolina)",         category:"Breakfast",    calories:175, protein:4.2,  carbs:24.5, fat:6.8,  fiber:1.8 },
  { id:"idli",         name:"Idli (Steamed Rice Cake)",category:"Breakfast",    calories:152, protein:3.9,  carbs:28.5, fat:1.8,  fiber:1.2 },
  { id:"dosa_plain",   name:"Dosa (Plain)",            category:"Breakfast",    calories:168, protein:4.1,  carbs:27.6, fat:4.5,  fiber:1.0 },
  { id:"masala_dosa",  name:"Masala Dosa",             category:"Breakfast",    calories:208, protein:4.8,  carbs:28.3, fat:8.5,  fiber:2.1 },
  { id:"paratha",      name:"Aloo Paratha",            category:"Breakfast",    calories:260, protein:5.6,  carbs:30.2, fat:13.0, fiber:2.8 },
  { id:"thepla",       name:"Thepla (Methi Paratha)",  category:"Breakfast",    calories:235, protein:6.2,  carbs:28.8, fat:10.5, fiber:3.2 },
  { id:"puri",         name:"Puri (Fried Bread)",      category:"Breakfast",    calories:310, protein:5.0,  carbs:35.0, fat:16.5, fiber:1.6 },
  { id:"medu_vada",    name:"Medu Vada",               category:"Breakfast",    calories:289, protein:10.5, carbs:24.0, fat:17.0, fiber:3.5 },
  { id:"uttapam",      name:"Uttapam",                 category:"Breakfast",    calories:185, protein:5.2,  carbs:26.0, fat:6.5,  fiber:2.0 },
  { id:"egg_boiled",   name:"Boiled Egg",              category:"Breakfast",    calories:155, protein:12.6, carbs:1.1,  fat:10.6, fiber:0   },
  { id:"egg_omelette", name:"Egg Omelette",            category:"Breakfast",    calories:182, protein:11.0, carbs:1.5,  fat:14.5, fiber:0.2 },

  // Lunch/Dinner
  { id:"roti",            name:"Roti / Chapati",          category:"Lunch/Dinner", calories:240, protein:7.8,  carbs:43.0, fat:3.5,  fiber:3.2 },
  { id:"rice_white",      name:"White Rice (Cooked)",     category:"Lunch/Dinner", calories:130, protein:2.7,  carbs:28.0, fat:0.3,  fiber:0.4 },
  { id:"rice_brown",      name:"Brown Rice (Cooked)",     category:"Lunch/Dinner", calories:112, protein:2.6,  carbs:23.5, fat:0.9,  fiber:1.8 },
  { id:"dal_toor",        name:"Toor Dal (Arhar)",        category:"Lunch/Dinner", calories:128, protein:8.5,  carbs:18.5, fat:2.0,  fiber:3.8 },
  { id:"dal_moong",       name:"Moong Dal",               category:"Lunch/Dinner", calories:118, protein:9.2,  carbs:16.0, fat:1.5,  fiber:3.2 },
  { id:"rajma",           name:"Rajma (Kidney Bean Curry)",category:"Lunch/Dinner",calories:140, protein:7.8,  carbs:18.8, fat:3.5,  fiber:5.5 },
  { id:"chole",           name:"Chole (Chickpea Curry)",  category:"Lunch/Dinner", calories:162, protein:8.5,  carbs:20.2, fat:5.5,  fiber:6.2 },
  { id:"paneer_butter",   name:"Paneer Butter Masala",    category:"Lunch/Dinner", calories:218, protein:10.5, carbs:8.0,  fat:17.0, fiber:1.2 },
  { id:"palak_paneer",    name:"Palak Paneer",            category:"Lunch/Dinner", calories:178, protein:9.8,  carbs:6.5,  fat:13.0, fiber:2.5 },
  { id:"aloo_gobi",       name:"Aloo Gobi",               category:"Lunch/Dinner", calories:105, protein:2.5,  carbs:12.8, fat:5.2,  fiber:2.8 },
  { id:"bhindi_masala",   name:"Bhindi Masala (Okra)",    category:"Lunch/Dinner", calories:98,  protein:2.2,  carbs:10.5, fat:5.5,  fiber:3.5 },
  { id:"jeera_rice",      name:"Jeera Rice",              category:"Lunch/Dinner", calories:158, protein:3.0,  carbs:29.0, fat:3.2,  fiber:0.6 },
  { id:"biryani_chicken", name:"Chicken Biryani",         category:"Lunch/Dinner", calories:192, protein:11.5, carbs:22.0, fat:6.5,  fiber:0.8 },
  { id:"biryani_veg",     name:"Veg Biryani",             category:"Lunch/Dinner", calories:165, protein:4.2,  carbs:25.5, fat:5.0,  fiber:1.5 },
  { id:"chicken_curry",   name:"Chicken Curry",           category:"Lunch/Dinner", calories:175, protein:14.0, carbs:5.5,  fat:11.0, fiber:1.0 },
  { id:"chicken_breast",  name:"Chicken Breast (Grilled)",category:"Lunch/Dinner", calories:165, protein:31.0, carbs:0,    fat:3.6,  fiber:0   },
  { id:"chicken_tikka",   name:"Chicken Tikka",           category:"Lunch/Dinner", calories:148, protein:22.0, carbs:3.5,  fat:5.2,  fiber:0.5 },
  { id:"fish_curry",      name:"Fish Curry",              category:"Lunch/Dinner", calories:142, protein:15.5, carbs:4.0,  fat:7.2,  fiber:0.8 },
  { id:"egg_curry",       name:"Egg Curry",               category:"Lunch/Dinner", calories:162, protein:10.5, carbs:6.0,  fat:11.0, fiber:0.8 },
  { id:"dal_makhani",     name:"Dal Makhani",             category:"Lunch/Dinner", calories:155, protein:7.0,  carbs:16.0, fat:7.5,  fiber:4.0 },
  { id:"mixed_sabzi",     name:"Mixed Vegetable Sabzi",   category:"Lunch/Dinner", calories:88,  protein:2.5,  carbs:10.0, fat:4.5,  fiber:3.0 },
  { id:"sambhar",         name:"Sambhar",                 category:"Lunch/Dinner", calories:68,  protein:3.5,  carbs:9.8,  fat:1.5,  fiber:2.8 },
  { id:"rasam",           name:"Rasam",                   category:"Lunch/Dinner", calories:35,  protein:1.5,  carbs:5.8,  fat:0.5,  fiber:0.8 },

  // Snacks
  { id:"samosa",      name:"Samosa",              category:"Snacks", calories:262, protein:4.5,  carbs:28.0, fat:15.0, fiber:2.5 },
  { id:"vada_pav",    name:"Vada Pav",            category:"Snacks", calories:290, protein:5.8,  carbs:35.0, fat:14.5, fiber:2.8 },
  { id:"bhel_puri",   name:"Bhel Puri",           category:"Snacks", calories:175, protein:4.2,  carbs:25.5, fat:6.5,  fiber:2.2 },
  { id:"pani_puri",   name:"Pani Puri / Golgappa",category:"Snacks", calories:150, protein:3.0,  carbs:22.0, fat:5.5,  fiber:1.5 },
  { id:"pakora",      name:"Pakora (Onion Bhaji)",category:"Snacks", calories:275, protein:5.5,  carbs:22.0, fat:18.5, fiber:2.5 },
  { id:"dhokla",      name:"Dhokla",              category:"Snacks", calories:160, protein:6.0,  carbs:24.0, fat:4.5,  fiber:2.0 },
  { id:"kachori",     name:"Kachori",             category:"Snacks", calories:320, protein:6.5,  carbs:30.0, fat:20.0, fiber:3.0 },
  { id:"cutlet_veg",  name:"Vegetable Cutlet",    category:"Snacks", calories:188, protein:4.5,  carbs:20.0, fat:10.0, fiber:2.8 },

  // Beverages
  { id:"chai",          name:"Chai (Milk Tea)",      category:"Beverages", calories:55,  protein:2.0, carbs:7.5,  fat:1.8, fiber:0   },
  { id:"coffee_milk",   name:"Coffee with Milk",     category:"Beverages", calories:48,  protein:2.2, carbs:5.5,  fat:1.8, fiber:0   },
  { id:"lassi_sweet",   name:"Sweet Lassi",          category:"Beverages", calories:105, protein:3.5, carbs:16.0, fat:3.0, fiber:0   },
  { id:"lassi_mango",   name:"Mango Lassi",          category:"Beverages", calories:120, protein:3.2, carbs:20.0, fat:3.0, fiber:0.5 },
  { id:"buttermilk",    name:"Buttermilk / Chaas",   category:"Beverages", calories:28,  protein:2.0, carbs:3.0,  fat:0.8, fiber:0   },
  { id:"nimbu_pani",    name:"Nimbu Pani (Lemonade)",category:"Beverages", calories:42,  protein:0.2, carbs:10.5, fat:0,   fiber:0.1 },
  { id:"coconut_water", name:"Coconut Water",        category:"Beverages", calories:19,  protein:0.7, carbs:3.7,  fat:0.2, fiber:0   },

  // Dairy
  { id:"paneer_raw",  name:"Paneer (Raw)",             category:"Dairy", calories:265, protein:18.3, carbs:1.2,  fat:20.8, fiber:0   },
  { id:"curd",        name:"Curd / Yogurt",            category:"Dairy", calories:60,  protein:3.5,  carbs:4.7,  fat:3.1,  fiber:0   },
  { id:"milk_whole",  name:"Whole Milk",               category:"Dairy", calories:62,  protein:3.3,  carbs:4.8,  fat:3.3,  fiber:0   },
  { id:"ghee",        name:"Ghee (Clarified Butter)",  category:"Dairy", calories:900, protein:0,    carbs:0,    fat:100,  fiber:0   },

  // Grains
  { id:"oats",        name:"Oats (Cooked)",            category:"Grains", calories:68,  protein:2.5,  carbs:12.0, fat:1.4, fiber:1.7 },
  { id:"wheat_flour", name:"Whole Wheat Flour (Atta)", category:"Grains", calories:340, protein:12.0, carbs:72.0, fat:1.7, fiber:10.7},
  { id:"bread_wheat", name:"Wheat Bread (per 100g)",   category:"Grains", calories:265, protein:9.0,  carbs:49.0, fat:3.2, fiber:2.7 },
  { id:"muesli",      name:"Muesli",                   category:"Grains", calories:370, protein:9.5,  carbs:67.0, fat:6.0, fiber:7.0 },

  // Fruits & Vegetables
  { id:"banana",      name:"Banana",                    category:"Fruits & Vegetables", calories:89, protein:1.1, carbs:22.8, fat:0.3, fiber:2.6 },
  { id:"apple",       name:"Apple",                     category:"Fruits & Vegetables", calories:52, protein:0.3, carbs:13.8, fat:0.2, fiber:2.4 },
  { id:"mango",       name:"Mango",                     category:"Fruits & Vegetables", calories:60, protein:0.8, carbs:15.0, fat:0.4, fiber:1.6 },
  { id:"papaya",      name:"Papaya",                    category:"Fruits & Vegetables", calories:43, protein:0.5, carbs:11.0, fat:0.3, fiber:1.7 },
  { id:"pomegranate", name:"Pomegranate",               category:"Fruits & Vegetables", calories:83, protein:1.7, carbs:18.7, fat:1.2, fiber:4.0 },
  { id:"spinach",     name:"Spinach (Palak, Cooked)",   category:"Fruits & Vegetables", calories:23, protein:2.9, carbs:3.6,  fat:0.4, fiber:2.2 },
  { id:"tomato",      name:"Tomato",                    category:"Fruits & Vegetables", calories:18, protein:0.9, carbs:3.9,  fat:0.2, fiber:1.2 },
];

// ── Category badge styles ──
const CAT_STYLES = {
  "Breakfast":            { cls:"badge-breakfast",  bg:"rgba(251,191,36,0.12)",  color:"#FBBF24" },
  "Lunch/Dinner":         { cls:"badge-lunch",      bg:"rgba(108,99,255,0.12)",  color:"#8B83FF" },
  "Snacks":               { cls:"badge-snacks",     bg:"rgba(52,211,153,0.12)",  color:"#34D399" },
  "Beverages":            { cls:"badge-beverages",  bg:"rgba(34,211,238,0.12)",  color:"#22D3EE" },
  "Dairy":                { cls:"badge-dairy",      bg:"rgba(244,114,182,0.12)", color:"#F472B6" },
  "Grains":               { cls:"badge-grains",     bg:"rgba(251,191,36,0.12)",  color:"#FBBF24" },
  "Fruits & Vegetables":  { cls:"badge-fv",         bg:"rgba(52,211,153,0.12)",  color:"#34D399" },
};

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────
function getTodayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}
function formatDisplayDate() {
  return new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

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
// Search Engine
// ──────────────────────────────────────────────
function searchFoods(q, category) {
  let results = FOOD_DB;
  if (category !== "all") results = results.filter(f => f.category === category);
  if (q && q.trim().length > 0) {
    const terms = q.toLowerCase().trim().split(/\s+/);
    results = results.filter(food => {
      const target = food.name.toLowerCase();
      return terms.every(t => target.includes(t));
    });
  }
  return results;
}

function renderFoodList(foods) {
  foodListEl.innerHTML = "";
  if (foods.length === 0) {
    emptyState.classList.add("visible");
    foodListEl.style.display = "none";
    resultsCount.innerHTML = `Showing <strong>0</strong> foods`;
    return;
  }
  emptyState.classList.remove("visible");
  foodListEl.style.display = "flex";
  resultsCount.innerHTML = `Showing <strong>${foods.length}</strong> food${foods.length > 1 ? "s" : ""}`;

  foods.forEach(food => {
    const card = document.createElement("div");
    card.className = "food-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.innerHTML = `
      <div class="food-card-info">
        <p class="food-card-name">${food.name}</p>
        <p class="food-card-meta">${food.category} · per 100g</p>
      </div>
      <div class="food-card-macros">
        <span class="macro-dot p">${food.protein}g</span>
        <span class="macro-dot c">${food.carbs}g</span>
        <span class="macro-dot f">${food.fat}g</span>
      </div>
      <div class="food-card-cal">
        <p class="food-card-cal-value">${food.calories}</p>
        <p class="food-card-cal-unit">kcal</p>
      </div>`;
    card.addEventListener("click", () => openCalculator(food));
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCalculator(food); } });
    foodListEl.appendChild(card);
  });
}

// Debounced search
function handleSearchInput() {
  clearTimeout(debounceTimer);
  searchClear.classList.toggle("visible", searchInput.value.length > 0);
  debounceTimer = setTimeout(() => renderFoodList(searchFoods(searchInput.value, activeCategory)), 300);
}
searchInput.addEventListener("input", handleSearchInput);
searchClear.addEventListener("click", () => {
  searchInput.value = ""; searchClear.classList.remove("visible"); searchInput.focus();
  renderFoodList(searchFoods("", activeCategory));
});

// Category pills
categoryPills.addEventListener("click", e => {
  const pill = e.target.closest(".pill");
  if (!pill) return;
  categoryPills.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  pill.classList.add("active");
  activeCategory = pill.dataset.category;
  renderFoodList(searchFoods(searchInput.value, activeCategory));
});

// ──────────────────────────────────────────────
// Inline Calculator
// ──────────────────────────────────────────────
function openCalculator(food) {
  selectedFood = food;
  // Highlight selected card
  foodListEl.querySelectorAll(".food-card").forEach(c => c.classList.remove("selected"));
  const cards = foodListEl.querySelectorAll(".food-card");
  cards.forEach(c => { if (c.querySelector(".food-card-name").textContent === food.name) c.classList.add("selected"); });

  const style = CAT_STYLES[food.category] || CAT_STYLES["Breakfast"];
  calcFoodName.textContent = food.name;
  calcFoodCat.textContent = food.category;
  calcFoodCat.style.background = style.bg;
  calcFoodCat.style.color = style.color;

  servingInput.value = 100;
  updateServingChips(100);
  computeNutrition(food, 100);
  autoSelectMealType();

  calcPanel.classList.add("visible");
  calcPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeCalculator() {
  calcPanel.classList.remove("visible");
  selectedFood = null;
  foodListEl.querySelectorAll(".food-card").forEach(c => c.classList.remove("selected"));
}
calcClose.addEventListener("click", closeCalculator);

function computeNutrition(food, grams) {
  const f = grams / 100;
  calcCal.innerHTML  = `${(food.calories * f).toFixed(0)}<span class="calc-macro-unit"> kcal</span>`;
  calcPro.innerHTML  = `${(food.protein * f).toFixed(1)}<span class="calc-macro-unit">g</span>`;
  calcCarb.innerHTML = `${(food.carbs * f).toFixed(1)}<span class="calc-macro-unit">g</span>`;
  calcFat.innerHTML  = `${(food.fat * f).toFixed(1)}<span class="calc-macro-unit">g</span>`;
  calcFib.innerHTML  = `${(food.fiber * f).toFixed(1)}<span class="calc-macro-unit">g</span>`;
}

function updateServingChips(grams) {
  servingChips.querySelectorAll(".serving-chip").forEach(ch => ch.classList.toggle("active", parseInt(ch.dataset.grams) === grams));
}

servingInput.addEventListener("input", () => {
  let v = parseInt(servingInput.value) || 0;
  if (v < 1) v = 1; if (v > 2000) v = 2000;
  if (selectedFood) { computeNutrition(selectedFood, v); updateServingChips(v); }
});
servingMinus.addEventListener("click", () => {
  let v = Math.max(10, (parseInt(servingInput.value) || 100) - 10);
  servingInput.value = v;
  if (selectedFood) { computeNutrition(selectedFood, v); updateServingChips(v); }
});
servingPlus.addEventListener("click", () => {
  let v = Math.min(2000, (parseInt(servingInput.value) || 100) + 10);
  servingInput.value = v;
  if (selectedFood) { computeNutrition(selectedFood, v); updateServingChips(v); }
});
servingChips.addEventListener("click", e => {
  const ch = e.target.closest(".serving-chip");
  if (!ch) return;
  const g = parseInt(ch.dataset.grams);
  servingInput.value = g; updateServingChips(g);
  if (selectedFood) computeNutrition(selectedFood, g);
});

function autoSelectMealType() {
  const h = new Date().getHours();
  let m = "snacks";
  if (h >= 5 && h < 11) m = "breakfast";
  else if (h >= 11 && h < 15) m = "lunch";
  else if (h >= 18 && h < 22) m = "dinner";
  const r = document.getElementById(`meal-${m}`);
  if (r) r.checked = true;
}

// ──────────────────────────────────────────────
// Firestore: Log Food
// ──────────────────────────────────────────────
btnLog.addEventListener("click", async () => {
  if (!selectedFood || !currentUserId) return;
  const grams = parseInt(servingInput.value) || 100;
  const f = grams / 100;
  const mealType = document.querySelector('input[name="meal-type"]:checked')?.value || "snacks";

  const item = {
    foodId:       selectedFood.id,
    foodName:     selectedFood.name,
    category:     selectedFood.category,
    mealType,
    servingGrams: grams,
    calories:     parseFloat((selectedFood.calories * f).toFixed(1)),
    protein:      parseFloat((selectedFood.protein * f).toFixed(1)),
    carbs:        parseFloat((selectedFood.carbs * f).toFixed(1)),
    fat:          parseFloat((selectedFood.fat * f).toFixed(1)),
    fiber:        parseFloat((selectedFood.fiber * f).toFixed(1)),
    loggedAt:     serverTimestamp(),
  };

  btnLog.disabled = true;
  btnLog.classList.add("loading");

  try {
    const today = getTodayStr();
    const ref = collection(db, "users", currentUserId, "daily_logs", today, "items");
    const docRef = await addDoc(ref, item);

    // Update local state
    todayItems.push({ id: docRef.id, ...item, loggedAt: new Date() });
    renderJournal();
    renderTotals();

    showToast("success", `${selectedFood.name} logged as ${mealType} (${item.calories} kcal)`);
    closeCalculator();
  } catch (err) {
    console.error("Log error:", err);
    showToast("error", "Failed to log food. Please try again.");
  } finally {
    btnLog.disabled = false;
    btnLog.classList.remove("loading");
  }
});

// ──────────────────────────────────────────────
// Firestore: Delete Item
// ──────────────────────────────────────────────
async function deleteItem(itemId) {
  if (!currentUserId) return;
  try {
    const today = getTodayStr();
    await deleteDoc(doc(db, "users", currentUserId, "daily_logs", today, "items", itemId));
    todayItems = todayItems.filter(it => it.id !== itemId);
    renderJournal();
    renderTotals();
    showToast("info", "Item removed from today's log.");
  } catch (err) {
    console.error("Delete error:", err);
    showToast("error", "Failed to delete item.");
  }
}

// ──────────────────────────────────────────────
// Firestore: Load Today's Items
// ──────────────────────────────────────────────
async function loadTodayItems(uid) {
  try {
    const today = getTodayStr();
    const ref = collection(db, "users", uid, "daily_logs", today, "items");
    const snap = await getDocs(ref);
    todayItems = [];
    snap.forEach(d => todayItems.push({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Load items error:", err);
    todayItems = [];
  }
}

// ──────────────────────────────────────────────
// Render: Journal (Right Panel)
// ──────────────────────────────────────────────
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

function renderJournal() {
  journalGroups.innerHTML = "";

  if (todayItems.length === 0) {
    journalEmpty.style.display = "flex";
    return;
  }
  journalEmpty.style.display = "none";

  // Group by mealType
  const groups = {};
  MEAL_ORDER.forEach(m => { groups[m] = []; });
  todayItems.forEach(it => {
    const mt = it.mealType || "snacks";
    if (!groups[mt]) groups[mt] = [];
    groups[mt].push(it);
  });

  MEAL_ORDER.forEach(mt => {
    const items = groups[mt];
    const section = document.createElement("div");
    section.className = "meal-group";

    section.innerHTML = `
      <div class="meal-group-header">
        <div class="meal-group-icon ${mt}">${MEAL_SVG[mt]}</div>
        <span class="meal-group-label">${MEAL_LABELS[mt]}</span>
      </div>
      <div class="meal-group-items" id="group-${mt}"></div>`;

    const container = section.querySelector(`#group-${mt}`);

    if (items.length === 0) {
      container.innerHTML = `<p class="meal-group-empty">No items</p>`;
    } else {
      items.forEach(it => {
        const row = document.createElement("div");
        row.className = "journal-item";
        row.innerHTML = `
          <div class="journal-item-info">
            <p class="journal-item-name">${it.foodName}</p>
            <p class="journal-item-meta">${it.servingGrams}g</p>
          </div>
          <span class="journal-item-cal">${Math.round(it.calories)}</span>
          <span class="journal-item-cal-unit">kcal</span>
          <button class="journal-item-delete" aria-label="Delete ${it.foodName}" data-id="${it.id}">
            ${TRASH_SVG}
          </button>`;
        row.querySelector(".journal-item-delete").addEventListener("click", () => deleteItem(it.id));
        container.appendChild(row);
      });
    }

    journalGroups.appendChild(section);
  });
}

// ──────────────────────────────────────────────
// Render: Daily Totals
// ──────────────────────────────────────────────
function renderTotals() {
  let cal = 0, pro = 0, carb = 0, fat = 0, fib = 0;
  todayItems.forEach(it => {
    cal  += it.calories || 0;
    pro  += it.protein  || 0;
    carb += it.carbs    || 0;
    fat  += it.fat      || 0;
    fib  += it.fiber    || 0;
  });
  totalsCal.innerHTML  = `${Math.round(cal)} <span>kcal</span>`;
  totalsPro.textContent  = Math.round(pro);
  totalsCarb.textContent = Math.round(carb);
  totalsFat.textContent  = Math.round(fat);
  totalsFib.textContent  = Math.round(fib);
}

// ──────────────────────────────────────────────
// Auth Guard & Bootstrap
// ──────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "./login.html"; return; }
  currentUserId = user.uid;

  // Sidebar user info
  userDisplayName.textContent = user.displayName || "NutriTrack User";
  userEmail.textContent = user.email || "";
  if (user.photoURL) {
    userAvatar.innerHTML = `<img src="${user.photoURL}" alt="Profile" referrerpolicy="no-referrer">`;
  } else {
    userAvatar.textContent = (user.displayName || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  currentDateEl.textContent = formatDisplayDate();

  try {
    // Load today's logged items
    await loadTodayItems(user.uid);

    // Render search results (all foods)
    renderFoodList(searchFoods("", "all"));

    // Render journal & totals
    renderJournal();
    renderTotals();
  } catch (err) {
    console.error("Bootstrap error:", err);
    showToast("error", "Something went wrong loading the page.");
  } finally {
    appLoading.classList.add("hidden");
    setTimeout(() => appLoading.remove(), 600);
  }
});
