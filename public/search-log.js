// public/search-log.js
// Food Search & Logging page logic — Indian food database, debounced search,
// serving calculator, Firestore meal logging, sidebar interactions.

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────
const appLoading       = document.getElementById("app-loading");
const toastContainer   = document.getElementById("toast-container");

// Sidebar
const sidebar          = document.getElementById("sidebar");
const hamburger        = document.getElementById("hamburger");
const sidebarOverlay   = document.getElementById("sidebar-overlay");
const userAvatar       = document.getElementById("user-avatar");
const userDisplayName  = document.getElementById("user-display-name");
const userEmail        = document.getElementById("user-email");
const btnSignout       = document.getElementById("btn-signout");

// Header
const currentDate      = document.getElementById("current-date");

// Search
const searchInput      = document.getElementById("search-input");
const searchClear      = document.getElementById("search-clear");
const categoryPills    = document.getElementById("category-pills");
const resultsCount     = document.getElementById("results-count");
const foodGrid         = document.getElementById("food-grid");
const emptyState       = document.getElementById("empty-state");

// Detail modal
const modalOverlay     = document.getElementById("detail-modal-overlay");
const modalClose       = document.getElementById("modal-close");
const modalFoodName    = document.getElementById("modal-food-name");
const modalFoodCategory = document.getElementById("modal-food-category");
const servingInput     = document.getElementById("serving-input");
const servingMinus     = document.getElementById("serving-minus");
const servingPlus      = document.getElementById("serving-plus");
const servingChips     = document.getElementById("serving-chips");
const modalCalories    = document.getElementById("modal-calories");
const modalProtein     = document.getElementById("modal-protein");
const modalCarbs       = document.getElementById("modal-carbs");
const modalFat         = document.getElementById("modal-fat");
const modalFiber       = document.getElementById("modal-fiber");
const microGrid        = document.getElementById("micro-grid");
const btnLog           = document.getElementById("btn-log");

// Recent
const recentList       = document.getElementById("recent-list");
const recentEmpty      = document.getElementById("recent-empty");

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
let currentUserId = null;
let selectedFood  = null;
let activeCategory = "all";
let debounceTimer = null;

// ──────────────────────────────────────────────
// Indian Food Database (~60 items)
// All values are per 100g
// ──────────────────────────────────────────────
const FOOD_DATABASE = [
  // ── Breakfast ──
  { id: "poha", name: "Poha (Flattened Rice)", category: "Breakfast", calories: 248, protein: 4.4, carbs: 34.2, fat: 10.4, fiber: 2.6, iron: 1.4, calcium: 9, vitaminC: 1.2, vitaminA: 15, potassium: 85, sodium: 280 },
  { id: "upma", name: "Upma (Semolina)", category: "Breakfast", calories: 175, protein: 4.2, carbs: 24.5, fat: 6.8, fiber: 1.8, iron: 1.0, calcium: 18, vitaminC: 0.5, vitaminA: 10, potassium: 60, sodium: 340 },
  { id: "idli", name: "Idli (Steamed Rice Cake)", category: "Breakfast", calories: 152, protein: 3.9, carbs: 28.5, fat: 1.8, fiber: 1.2, iron: 0.8, calcium: 12, vitaminC: 0.3, vitaminA: 5, potassium: 45, sodium: 390 },
  { id: "dosa_plain", name: "Dosa (Plain)", category: "Breakfast", calories: 168, protein: 4.1, carbs: 27.6, fat: 4.5, fiber: 1.0, iron: 1.2, calcium: 22, vitaminC: 0.8, vitaminA: 8, potassium: 65, sodium: 310 },
  { id: "masala_dosa", name: "Masala Dosa", category: "Breakfast", calories: 208, protein: 4.8, carbs: 28.3, fat: 8.5, fiber: 2.1, iron: 1.5, calcium: 28, vitaminC: 5.2, vitaminA: 22, potassium: 180, sodium: 350 },
  { id: "paratha", name: "Aloo Paratha", category: "Breakfast", calories: 260, protein: 5.6, carbs: 30.2, fat: 13.0, fiber: 2.8, iron: 1.8, calcium: 32, vitaminC: 6.0, vitaminA: 18, potassium: 210, sodium: 400 },
  { id: "thepla", name: "Thepla (Methi Paratha)", category: "Breakfast", calories: 235, protein: 6.2, carbs: 28.8, fat: 10.5, fiber: 3.2, iron: 2.4, calcium: 45, vitaminC: 3.5, vitaminA: 120, potassium: 170, sodium: 380 },
  { id: "puri", name: "Puri (Fried Bread)", category: "Breakfast", calories: 310, protein: 5.0, carbs: 35.0, fat: 16.5, fiber: 1.6, iron: 1.5, calcium: 20, vitaminC: 0, vitaminA: 5, potassium: 55, sodium: 290 },
  { id: "medu_vada", name: "Medu Vada", category: "Breakfast", calories: 289, protein: 10.5, carbs: 24.0, fat: 17.0, fiber: 3.5, iron: 2.0, calcium: 35, vitaminC: 1.0, vitaminA: 8, potassium: 200, sodium: 320 },
  { id: "uttapam", name: "Uttapam", category: "Breakfast", calories: 185, protein: 5.2, carbs: 26.0, fat: 6.5, fiber: 2.0, iron: 1.3, calcium: 25, vitaminC: 4.0, vitaminA: 30, potassium: 120, sodium: 360 },

  // ── Lunch/Dinner ──
  { id: "roti", name: "Roti / Chapati", category: "Lunch/Dinner", calories: 240, protein: 7.8, carbs: 43.0, fat: 3.5, fiber: 3.2, iron: 2.2, calcium: 30, vitaminC: 0, vitaminA: 5, potassium: 115, sodium: 290 },
  { id: "rice_white", name: "White Rice (Cooked)", category: "Lunch/Dinner", calories: 130, protein: 2.7, carbs: 28.0, fat: 0.3, fiber: 0.4, iron: 0.2, calcium: 10, vitaminC: 0, vitaminA: 0, potassium: 35, sodium: 1 },
  { id: "rice_brown", name: "Brown Rice (Cooked)", category: "Lunch/Dinner", calories: 112, protein: 2.6, carbs: 23.5, fat: 0.9, fiber: 1.8, iron: 0.4, calcium: 10, vitaminC: 0, vitaminA: 0, potassium: 43, sodium: 1 },
  { id: "dal_toor", name: "Toor Dal (Arhar)", category: "Lunch/Dinner", calories: 128, protein: 8.5, carbs: 18.5, fat: 2.0, fiber: 3.8, iron: 2.5, calcium: 42, vitaminC: 1.5, vitaminA: 12, potassium: 320, sodium: 250 },
  { id: "dal_moong", name: "Moong Dal", category: "Lunch/Dinner", calories: 118, protein: 9.2, carbs: 16.0, fat: 1.5, fiber: 3.2, iron: 2.0, calcium: 35, vitaminC: 1.0, vitaminA: 8, potassium: 280, sodium: 180 },
  { id: "rajma", name: "Rajma (Kidney Bean Curry)", category: "Lunch/Dinner", calories: 140, protein: 7.8, carbs: 18.8, fat: 3.5, fiber: 5.5, iron: 3.2, calcium: 40, vitaminC: 2.0, vitaminA: 15, potassium: 350, sodium: 380 },
  { id: "chole", name: "Chole (Chickpea Curry)", category: "Lunch/Dinner", calories: 162, protein: 8.5, carbs: 20.2, fat: 5.5, fiber: 6.2, iron: 3.8, calcium: 48, vitaminC: 3.0, vitaminA: 20, potassium: 290, sodium: 400 },
  { id: "paneer_butter", name: "Paneer Butter Masala", category: "Lunch/Dinner", calories: 218, protein: 10.5, carbs: 8.0, fat: 17.0, fiber: 1.2, iron: 1.0, calcium: 180, vitaminC: 4.0, vitaminA: 250, potassium: 120, sodium: 420 },
  { id: "palak_paneer", name: "Palak Paneer", category: "Lunch/Dinner", calories: 178, protein: 9.8, carbs: 6.5, fat: 13.0, fiber: 2.5, iron: 3.5, calcium: 220, vitaminC: 12.0, vitaminA: 3500, potassium: 350, sodium: 380 },
  { id: "aloo_gobi", name: "Aloo Gobi", category: "Lunch/Dinner", calories: 105, protein: 2.5, carbs: 12.8, fat: 5.2, fiber: 2.8, iron: 0.8, calcium: 25, vitaminC: 18.0, vitaminA: 35, potassium: 250, sodium: 320 },
  { id: "bhindi_masala", name: "Bhindi Masala (Okra)", category: "Lunch/Dinner", calories: 98, protein: 2.2, carbs: 10.5, fat: 5.5, fiber: 3.5, iron: 1.2, calcium: 82, vitaminC: 15.0, vitaminA: 360, potassium: 200, sodium: 280 },
  { id: "jeera_rice", name: "Jeera Rice", category: "Lunch/Dinner", calories: 158, protein: 3.0, carbs: 29.0, fat: 3.2, fiber: 0.6, iron: 0.3, calcium: 14, vitaminC: 0, vitaminA: 2, potassium: 50, sodium: 250 },
  { id: "biryani_chicken", name: "Chicken Biryani", category: "Lunch/Dinner", calories: 192, protein: 11.5, carbs: 22.0, fat: 6.5, fiber: 0.8, iron: 1.2, calcium: 28, vitaminC: 2.0, vitaminA: 25, potassium: 180, sodium: 450 },
  { id: "biryani_veg", name: "Veg Biryani", category: "Lunch/Dinner", calories: 165, protein: 4.2, carbs: 25.5, fat: 5.0, fiber: 1.5, iron: 1.0, calcium: 22, vitaminC: 5.0, vitaminA: 45, potassium: 150, sodium: 420 },
  { id: "chicken_curry", name: "Chicken Curry", category: "Lunch/Dinner", calories: 175, protein: 14.0, carbs: 5.5, fat: 11.0, fiber: 1.0, iron: 1.5, calcium: 25, vitaminC: 3.0, vitaminA: 60, potassium: 250, sodium: 400 },
  { id: "fish_curry", name: "Fish Curry", category: "Lunch/Dinner", calories: 142, protein: 15.5, carbs: 4.0, fat: 7.2, fiber: 0.8, iron: 1.8, calcium: 35, vitaminC: 4.0, vitaminA: 50, potassium: 290, sodium: 380 },
  { id: "egg_curry", name: "Egg Curry", category: "Lunch/Dinner", calories: 162, protein: 10.5, carbs: 6.0, fat: 11.0, fiber: 0.8, iron: 2.0, calcium: 50, vitaminC: 3.0, vitaminA: 180, potassium: 160, sodium: 420 },
  { id: "dal_makhani", name: "Dal Makhani", category: "Lunch/Dinner", calories: 155, protein: 7.0, carbs: 16.0, fat: 7.5, fiber: 4.0, iron: 2.8, calcium: 55, vitaminC: 1.5, vitaminA: 120, potassium: 300, sodium: 380 },
  { id: "mixed_sabzi", name: "Mixed Vegetable Sabzi", category: "Lunch/Dinner", calories: 88, protein: 2.5, carbs: 10.0, fat: 4.5, fiber: 3.0, iron: 1.0, calcium: 40, vitaminC: 15.0, vitaminA: 400, potassium: 220, sodium: 290 },
  { id: "sambhar", name: "Sambhar", category: "Lunch/Dinner", calories: 68, protein: 3.5, carbs: 9.8, fat: 1.5, fiber: 2.8, iron: 1.5, calcium: 30, vitaminC: 8.0, vitaminA: 200, potassium: 250, sodium: 380 },
  { id: "rasam", name: "Rasam", category: "Lunch/Dinner", calories: 35, protein: 1.5, carbs: 5.8, fat: 0.5, fiber: 0.8, iron: 0.6, calcium: 12, vitaminC: 5.0, vitaminA: 80, potassium: 120, sodium: 350 },

  // ── Snacks ──
  { id: "samosa", name: "Samosa", category: "Snacks", calories: 262, protein: 4.5, carbs: 28.0, fat: 15.0, fiber: 2.5, iron: 1.5, calcium: 18, vitaminC: 4.0, vitaminA: 12, potassium: 150, sodium: 350 },
  { id: "vada_pav", name: "Vada Pav", category: "Snacks", calories: 290, protein: 5.8, carbs: 35.0, fat: 14.5, fiber: 2.8, iron: 1.8, calcium: 25, vitaminC: 5.0, vitaminA: 10, potassium: 200, sodium: 420 },
  { id: "bhel_puri", name: "Bhel Puri", category: "Snacks", calories: 175, protein: 4.2, carbs: 25.5, fat: 6.5, fiber: 2.2, iron: 1.2, calcium: 15, vitaminC: 3.0, vitaminA: 8, potassium: 130, sodium: 480 },
  { id: "sev_puri", name: "Sev Puri", category: "Snacks", calories: 205, protein: 4.0, carbs: 22.0, fat: 11.5, fiber: 2.0, iron: 1.0, calcium: 12, vitaminC: 4.0, vitaminA: 10, potassium: 110, sodium: 500 },
  { id: "pani_puri", name: "Pani Puri / Golgappa", category: "Snacks", calories: 150, protein: 3.0, carbs: 22.0, fat: 5.5, fiber: 1.5, iron: 0.8, calcium: 10, vitaminC: 6.0, vitaminA: 5, potassium: 90, sodium: 520 },
  { id: "pakora", name: "Pakora (Onion Bhaji)", category: "Snacks", calories: 275, protein: 5.5, carbs: 22.0, fat: 18.5, fiber: 2.5, iron: 1.5, calcium: 30, vitaminC: 3.5, vitaminA: 15, potassium: 140, sodium: 380 },
  { id: "dhokla", name: "Dhokla", category: "Snacks", calories: 160, protein: 6.0, carbs: 24.0, fat: 4.5, fiber: 2.0, iron: 1.5, calcium: 28, vitaminC: 1.0, vitaminA: 5, potassium: 130, sodium: 450 },
  { id: "kachori", name: "Kachori", category: "Snacks", calories: 320, protein: 6.5, carbs: 30.0, fat: 20.0, fiber: 3.0, iron: 2.0, calcium: 22, vitaminC: 1.0, vitaminA: 8, potassium: 160, sodium: 380 },
  { id: "cutlet_veg", name: "Vegetable Cutlet", category: "Snacks", calories: 188, protein: 4.5, carbs: 20.0, fat: 10.0, fiber: 2.8, iron: 1.2, calcium: 25, vitaminC: 8.0, vitaminA: 200, potassium: 180, sodium: 350 },

  // ── Beverages ──
  { id: "chai", name: "Chai (Milk Tea)", category: "Beverages", calories: 55, protein: 2.0, carbs: 7.5, fat: 1.8, fiber: 0, iron: 0.2, calcium: 55, vitaminC: 0.5, vitaminA: 20, potassium: 70, sodium: 25 },
  { id: "coffee_milk", name: "Coffee with Milk", category: "Beverages", calories: 48, protein: 2.2, carbs: 5.5, fat: 1.8, fiber: 0, iron: 0.1, calcium: 60, vitaminC: 0.2, vitaminA: 18, potassium: 90, sodium: 30 },
  { id: "lassi_sweet", name: "Sweet Lassi", category: "Beverages", calories: 105, protein: 3.5, carbs: 16.0, fat: 3.0, fiber: 0, iron: 0.1, calcium: 120, vitaminC: 1.0, vitaminA: 30, potassium: 150, sodium: 50 },
  { id: "lassi_mango", name: "Mango Lassi", category: "Beverages", calories: 120, protein: 3.2, carbs: 20.0, fat: 3.0, fiber: 0.5, iron: 0.2, calcium: 110, vitaminC: 12.0, vitaminA: 300, potassium: 180, sodium: 45 },
  { id: "buttermilk", name: "Buttermilk / Chaas", category: "Beverages", calories: 28, protein: 2.0, carbs: 3.0, fat: 0.8, fiber: 0, iron: 0.1, calcium: 70, vitaminC: 0.5, vitaminA: 8, potassium: 100, sodium: 220 },
  { id: "nimbu_pani", name: "Nimbu Pani (Lemonade)", category: "Beverages", calories: 42, protein: 0.2, carbs: 10.5, fat: 0, fiber: 0.1, iron: 0.1, calcium: 5, vitaminC: 18.0, vitaminA: 2, potassium: 45, sodium: 180 },
  { id: "coconut_water", name: "Coconut Water", category: "Beverages", calories: 19, protein: 0.7, carbs: 3.7, fat: 0.2, fiber: 0, iron: 0.3, calcium: 24, vitaminC: 2.4, vitaminA: 0, potassium: 250, sodium: 105 },

  // ── Dairy ──
  { id: "paneer_raw", name: "Paneer (Raw)", category: "Dairy", calories: 265, protein: 18.3, carbs: 1.2, fat: 20.8, fiber: 0, iron: 0.5, calcium: 480, vitaminC: 0, vitaminA: 180, potassium: 100, sodium: 18 },
  { id: "curd", name: "Curd / Yogurt", category: "Dairy", calories: 60, protein: 3.5, carbs: 4.7, fat: 3.1, fiber: 0, iron: 0.1, calcium: 120, vitaminC: 0.5, vitaminA: 25, potassium: 150, sodium: 45 },
  { id: "milk_whole", name: "Whole Milk", category: "Dairy", calories: 62, protein: 3.3, carbs: 4.8, fat: 3.3, fiber: 0, iron: 0.03, calcium: 120, vitaminC: 0, vitaminA: 46, potassium: 150, sodium: 44 },
  { id: "ghee", name: "Ghee (Clarified Butter)", category: "Dairy", calories: 900, protein: 0, carbs: 0, fat: 100, fiber: 0, iron: 0, calcium: 0, vitaminC: 0, vitaminA: 680, potassium: 0, sodium: 0 },

  // ── Grains & Staples ──
  { id: "oats", name: "Oats (Cooked)", category: "Grains", calories: 68, protein: 2.5, carbs: 12.0, fat: 1.4, fiber: 1.7, iron: 0.6, calcium: 9, vitaminC: 0, vitaminA: 0, potassium: 60, sodium: 2 },
  { id: "wheat_flour", name: "Whole Wheat Flour (Atta)", category: "Grains", calories: 340, protein: 12.0, carbs: 72.0, fat: 1.7, fiber: 10.7, iron: 3.6, calcium: 34, vitaminC: 0, vitaminA: 0, potassium: 360, sodium: 2 },
  { id: "bread_wheat", name: "Wheat Bread (1 slice ≈ 30g)", category: "Grains", calories: 265, protein: 9.0, carbs: 49.0, fat: 3.2, fiber: 2.7, iron: 3.6, calcium: 260, vitaminC: 0, vitaminA: 0, potassium: 100, sodium: 490 },
  { id: "muesli", name: "Muesli", category: "Grains", calories: 370, protein: 9.5, carbs: 67.0, fat: 6.0, fiber: 7.0, iron: 4.5, calcium: 50, vitaminC: 0, vitaminA: 0, potassium: 450, sodium: 20 },

  // ── Fruits & Vegetables ──
  { id: "banana", name: "Banana", category: "Fruits & Vegetables", calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, iron: 0.3, calcium: 5, vitaminC: 8.7, vitaminA: 64, potassium: 358, sodium: 1 },
  { id: "apple", name: "Apple", category: "Fruits & Vegetables", calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, iron: 0.1, calcium: 6, vitaminC: 4.6, vitaminA: 54, potassium: 107, sodium: 1 },
  { id: "mango", name: "Mango", category: "Fruits & Vegetables", calories: 60, protein: 0.8, carbs: 15.0, fat: 0.4, fiber: 1.6, iron: 0.2, calcium: 11, vitaminC: 36.4, vitaminA: 1082, potassium: 168, sodium: 1 },
  { id: "papaya", name: "Papaya", category: "Fruits & Vegetables", calories: 43, protein: 0.5, carbs: 11.0, fat: 0.3, fiber: 1.7, iron: 0.3, calcium: 20, vitaminC: 62.0, vitaminA: 950, potassium: 182, sodium: 8 },
  { id: "pomegranate", name: "Pomegranate", category: "Fruits & Vegetables", calories: 83, protein: 1.7, carbs: 18.7, fat: 1.2, fiber: 4.0, iron: 0.3, calcium: 10, vitaminC: 10.2, vitaminA: 0, potassium: 236, sodium: 3 },
  { id: "spinach", name: "Spinach (Palak, Cooked)", category: "Fruits & Vegetables", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, iron: 3.6, calcium: 136, vitaminC: 9.8, vitaminA: 5240, potassium: 466, sodium: 70 },
  { id: "tomato", name: "Tomato", category: "Fruits & Vegetables", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, iron: 0.3, calcium: 10, vitaminC: 13.7, vitaminA: 833, potassium: 237, sodium: 5 },

  // ── International Staples ──
  { id: "chicken_breast", name: "Chicken Breast (Grilled)", category: "Lunch/Dinner", calories: 165, protein: 31.0, carbs: 0, fat: 3.6, fiber: 0, iron: 1.0, calcium: 15, vitaminC: 0, vitaminA: 6, potassium: 256, sodium: 74 },
  { id: "egg_boiled", name: "Boiled Egg", category: "Breakfast", calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0, iron: 1.2, calcium: 50, vitaminC: 0, vitaminA: 520, potassium: 126, sodium: 124 },
  { id: "egg_omelette", name: "Egg Omelette", category: "Breakfast", calories: 182, protein: 11.0, carbs: 1.5, fat: 14.5, fiber: 0.2, iron: 1.5, calcium: 55, vitaminC: 1.0, vitaminA: 530, potassium: 140, sodium: 350 },
];

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
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
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
// Search Engine
// ──────────────────────────────────────────────

/**
 * Search the food database with optional category filter.
 * Architecture-ready for future async API integration.
 */
function searchFoods(queryStr, category = "all") {
  let results = FOOD_DATABASE;

  // Category filter
  if (category !== "all") {
    results = results.filter((f) => f.category === category);
  }

  // Text search (case-insensitive substring match)
  if (queryStr && queryStr.trim().length > 0) {
    const terms = queryStr.toLowerCase().trim().split(/\s+/);
    results = results.filter((food) => {
      const target = food.name.toLowerCase();
      return terms.every((term) => target.includes(term));
    });
  }

  return results;
}

// ──────────────────────────────────────────────
// Render: Food Grid
// ──────────────────────────────────────────────

/** Map category names to CSS badge class + short label */
const CATEGORY_BADGE_MAP = {
  "Breakfast":            { cls: "badge-breakfast",   label: "Breakfast" },
  "Lunch/Dinner":         { cls: "badge-lunch-dinner", label: "Lunch/Dinner" },
  "Snacks":               { cls: "badge-snacks",      label: "Snacks" },
  "Beverages":            { cls: "badge-beverages",   label: "Beverages" },
  "Dairy":                { cls: "badge-dairy",       label: "Dairy" },
  "Grains":               { cls: "badge-grains",      label: "Grains" },
  "Fruits & Vegetables":  { cls: "badge-fruits-veg",  label: "Fruits & Veg" },
};

function renderFoodGrid(foods) {
  foodGrid.innerHTML = "";

  if (foods.length === 0) {
    emptyState.classList.add("visible");
    foodGrid.style.display = "none";
    resultsCount.innerHTML = `Showing <strong>0</strong> foods`;
    return;
  }

  emptyState.classList.remove("visible");
  foodGrid.style.display = "grid";
  resultsCount.innerHTML = `Showing <strong>${foods.length}</strong> food${foods.length > 1 ? "s" : ""}`;

  foods.forEach((food) => {
    const badge = CATEGORY_BADGE_MAP[food.category] || { cls: "badge-breakfast", label: food.category };

    const card = document.createElement("div");
    card.className = "food-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `View details for ${food.name}`);
    card.innerHTML = `
      <div class="food-card-header">
        <p class="food-name">${food.name}</p>
        <span class="food-category-badge ${badge.cls}">${badge.label}</span>
      </div>
      <p class="food-cal-highlight">${food.calories} <span>kcal</span></p>
      <p class="food-serving-label">per 100g serving</p>
      <div class="food-macros-row">
        <div class="food-macro-item">
          <span class="food-macro-dot protein"></span>
          P: ${food.protein}g
        </div>
        <div class="food-macro-item">
          <span class="food-macro-dot carbs"></span>
          C: ${food.carbs}g
        </div>
        <div class="food-macro-item">
          <span class="food-macro-dot fat"></span>
          F: ${food.fat}g
        </div>
      </div>
    `;

    card.addEventListener("click", () => openDetailModal(food));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetailModal(food);
      }
    });

    foodGrid.appendChild(card);
  });
}

// ──────────────────────────────────────────────
// Debounced Search Handler
// ──────────────────────────────────────────────
function handleSearchInput() {
  clearTimeout(debounceTimer);
  const q = searchInput.value;

  // Show/hide clear button
  searchClear.classList.toggle("visible", q.length > 0);

  debounceTimer = setTimeout(() => {
    const results = searchFoods(q, activeCategory);
    renderFoodGrid(results);
  }, 300);
}

searchInput.addEventListener("input", handleSearchInput);

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.remove("visible");
  searchInput.focus();
  const results = searchFoods("", activeCategory);
  renderFoodGrid(results);
});

// ──────────────────────────────────────────────
// Category Pills
// ──────────────────────────────────────────────
categoryPills.addEventListener("click", (e) => {
  const pill = e.target.closest(".pill");
  if (!pill) return;

  // Update active state
  categoryPills.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
  pill.classList.add("active");

  activeCategory = pill.dataset.category;

  // Re-run search with new category
  const results = searchFoods(searchInput.value, activeCategory);
  renderFoodGrid(results);
});

// ──────────────────────────────────────────────
// Detail Modal: Open
// ──────────────────────────────────────────────
function openDetailModal(food) {
  selectedFood = food;

  // Set food info
  modalFoodName.textContent = food.name;
  const badge = CATEGORY_BADGE_MAP[food.category] || { cls: "badge-breakfast", label: food.category };
  modalFoodCategory.textContent = badge.label;
  modalFoodCategory.className = `modal-food-category ${badge.cls}`;

  // Reset serving to 100g
  servingInput.value = 100;
  updateServingChips(100);
  computeAndRenderNutrition(food, 100);

  // Auto-select meal type based on time of day
  autoSelectMealType();

  // Show modal
  modalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

// ──────────────────────────────────────────────
// Detail Modal: Close
// ──────────────────────────────────────────────
function closeDetailModal() {
  modalOverlay.classList.remove("active");
  document.body.style.overflow = "";
  selectedFood = null;
}

modalClose.addEventListener("click", closeDetailModal);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeDetailModal();
});

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay.classList.contains("active")) {
    closeDetailModal();
  }
});

// ──────────────────────────────────────────────
// Serving Calculator
// ──────────────────────────────────────────────

function computeAndRenderNutrition(food, grams) {
  const factor = grams / 100;

  // Macros
  const cal     = (food.calories * factor).toFixed(0);
  const protein = (food.protein * factor).toFixed(1);
  const carbs   = (food.carbs * factor).toFixed(1);
  const fat     = (food.fat * factor).toFixed(1);
  const fiber   = (food.fiber * factor).toFixed(1);

  modalCalories.innerHTML = `${cal} <span>kcal</span>`;
  modalProtein.innerHTML  = `${protein} <span>g</span>`;
  modalCarbs.innerHTML    = `${carbs} <span>g</span>`;
  modalFat.innerHTML      = `${fat} <span>g</span>`;
  modalFiber.innerHTML    = `${fiber} <span>g</span>`;

  // Micronutrients
  const micros = [
    { name: "Iron",       value: (food.iron * factor).toFixed(1),      unit: "mg" },
    { name: "Calcium",    value: (food.calcium * factor).toFixed(0),   unit: "mg" },
    { name: "Vitamin C",  value: (food.vitaminC * factor).toFixed(1),  unit: "mg" },
    { name: "Vitamin A",  value: (food.vitaminA * factor).toFixed(0),  unit: "IU" },
    { name: "Potassium",  value: (food.potassium * factor).toFixed(0), unit: "mg" },
    { name: "Sodium",     value: (food.sodium * factor).toFixed(0),    unit: "mg" },
  ];

  microGrid.innerHTML = micros
    .map(
      (m) => `
      <div class="micro-tag">
        <span class="micro-tag-name">${m.name}</span>
        <span class="micro-tag-value">${m.value}${m.unit}</span>
      </div>
    `
    )
    .join("");
}

function updateServingChips(grams) {
  servingChips.querySelectorAll(".serving-chip").forEach((chip) => {
    chip.classList.toggle("active", parseInt(chip.dataset.grams) === grams);
  });
}

// Serving input change
servingInput.addEventListener("input", () => {
  let val = parseInt(servingInput.value) || 0;
  if (val < 1) val = 1;
  if (val > 2000) val = 2000;

  if (selectedFood) {
    computeAndRenderNutrition(selectedFood, val);
    updateServingChips(val);
  }
});

// Plus / Minus buttons
servingMinus.addEventListener("click", () => {
  let val = parseInt(servingInput.value) || 100;
  val = Math.max(10, val - 10);
  servingInput.value = val;
  if (selectedFood) {
    computeAndRenderNutrition(selectedFood, val);
    updateServingChips(val);
  }
});

servingPlus.addEventListener("click", () => {
  let val = parseInt(servingInput.value) || 100;
  val = Math.min(2000, val + 10);
  servingInput.value = val;
  if (selectedFood) {
    computeAndRenderNutrition(selectedFood, val);
    updateServingChips(val);
  }
});

// Quick-select chips
servingChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".serving-chip");
  if (!chip) return;

  const grams = parseInt(chip.dataset.grams);
  servingInput.value = grams;
  updateServingChips(grams);
  if (selectedFood) {
    computeAndRenderNutrition(selectedFood, grams);
  }
});

// ──────────────────────────────────────────────
// Auto-select meal type based on time of day
// ──────────────────────────────────────────────
function autoSelectMealType() {
  const hour = new Date().getHours();
  let mealType = "snacks";

  if (hour >= 5 && hour < 11)       mealType = "breakfast";
  else if (hour >= 11 && hour < 15) mealType = "lunch";
  else if (hour >= 18 && hour < 22) mealType = "dinner";

  const radio = document.getElementById(`meal-${mealType}`);
  if (radio) radio.checked = true;
}

// ──────────────────────────────────────────────
// Log Food to Firestore
// ──────────────────────────────────────────────
btnLog.addEventListener("click", async () => {
  if (!selectedFood || !currentUserId) return;

  const grams    = parseInt(servingInput.value) || 100;
  const factor   = grams / 100;
  const mealType = document.querySelector('input[name="meal-type"]:checked')?.value || "snacks";

  // Compute final values
  const totalCalories = parseFloat((selectedFood.calories * factor).toFixed(1));
  const totalProtein  = parseFloat((selectedFood.protein * factor).toFixed(1));
  const totalCarbs    = parseFloat((selectedFood.carbs * factor).toFixed(1));
  const totalFat      = parseFloat((selectedFood.fat * factor).toFixed(1));
  const totalFiber    = parseFloat((selectedFood.fiber * factor).toFixed(1));

  const micronutrients = {
    iron:       parseFloat((selectedFood.iron * factor).toFixed(2)),
    calcium:    parseFloat((selectedFood.calcium * factor).toFixed(1)),
    vitaminC:   parseFloat((selectedFood.vitaminC * factor).toFixed(1)),
    vitaminA:   parseFloat((selectedFood.vitaminA * factor).toFixed(0)),
    potassium:  parseFloat((selectedFood.potassium * factor).toFixed(0)),
    sodium:     parseFloat((selectedFood.sodium * factor).toFixed(0)),
  };

  // Build the meal document (compatible with dashboard.js)
  const mealDoc = {
    foodId:         selectedFood.id,
    foodName:       selectedFood.name,
    category:       selectedFood.category,
    type:           mealType,
    date:           getTodayDateString(),
    time:           formatTime(),
    servingGrams:   grams,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    totalFiber,
    micronutrients,
    items: [{ name: selectedFood.name, grams, calories: totalCalories }],
    createdAt:      serverTimestamp(),
  };

  // Disable button & show spinner
  btnLog.disabled = true;
  btnLog.classList.add("loading");

  try {
    const mealsRef = collection(db, "users", currentUserId, "meals");
    await addDoc(mealsRef, mealDoc);

    showToast("success", `${selectedFood.name} logged as ${mealType} (${totalCalories} kcal)`);
    closeDetailModal();

    // Refresh recently logged
    await loadRecentlyLogged(currentUserId);
  } catch (error) {
    console.error("Error logging food:", error);
    showToast("error", "Failed to log food. Please try again.");
  } finally {
    btnLog.disabled = false;
    btnLog.classList.remove("loading");
  }
});

// ──────────────────────────────────────────────
// Load: Recently Logged (today)
// ──────────────────────────────────────────────
const MEAL_ICONS = {
  breakfast: "🌅",
  lunch:     "☀️",
  dinner:    "🌙",
  snacks:    "🍿",
};

async function loadRecentlyLogged(uid) {
  try {
    const today    = getTodayDateString();
    const mealsRef = collection(db, "users", uid, "meals");
    const q        = query(mealsRef, where("date", "==", today), orderBy("createdAt", "desc"), limit(5));
    const snapshot = await getDocs(q);

    const meals = [];
    snapshot.forEach((docSnap) => {
      meals.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderRecentlyLogged(meals);
  } catch (error) {
    console.error("Error loading recent meals:", error);
    // Silently fail — the section will just show the empty state
  }
}

function renderRecentlyLogged(meals) {
  // Remove existing rendered items (keep empty state element)
  recentList.querySelectorAll(".recent-item").forEach((el) => el.remove());

  if (meals.length === 0) {
    recentEmpty.style.display = "block";
    return;
  }

  recentEmpty.style.display = "none";

  meals.forEach((meal) => {
    const icon = MEAL_ICONS[meal.type] || "🍴";
    const el   = document.createElement("div");
    el.className = "recent-item";
    el.innerHTML = `
      <div class="recent-icon ${meal.type}">${icon}</div>
      <div class="recent-info">
        <p class="recent-name">${meal.foodName || "Meal"}</p>
        <p class="recent-meta">${meal.time || ""} · ${meal.servingGrams || 100}g · ${(meal.type || "").charAt(0).toUpperCase() + (meal.type || "").slice(1)}</p>
      </div>
      <div class="recent-cal">
        <p class="recent-cal-value">${meal.totalCalories || 0}</p>
        <p class="recent-cal-unit">kcal</p>
      </div>
    `;
    recentList.insertBefore(el, recentEmpty);
  });
}

// ──────────────────────────────────────────────
// Auth Guard & Bootstrap
// ──────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  currentUserId = user.uid;

  // Populate sidebar user info
  userDisplayName.textContent = user.displayName || "NutriTrack User";
  userEmail.textContent       = user.email || "";

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

  // Header date
  currentDate.textContent = formatDisplayDate();

  try {
    // Initial food grid render (show all)
    const allFoods = searchFoods("", "all");
    renderFoodGrid(allFoods);

    // Load recently logged meals
    await loadRecentlyLogged(user.uid);
  } catch (err) {
    console.error("Bootstrap error:", err);
    showToast("error", "Something went wrong loading the page.");
  } finally {
    // Dismiss loading screen
    appLoading.classList.add("hidden");
    setTimeout(() => appLoading.remove(), 600);
  }
});
