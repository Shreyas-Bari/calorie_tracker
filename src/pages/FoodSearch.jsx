import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Utensils, 
  X,
  Check,
  Lock,
  AlertTriangle
} from 'lucide-react';

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
  { id:"tomato",      name:"Tomato",                    category:"Fruits & Vegetables", calories:18, protein:0.9, carbs:3.9,  fat:0.2, fiber:1.2 }
];

const CATEGORIES = ["All", "Breakfast", "Lunch/Dinner", "Snacks", "Beverages", "Dairy", "Grains", "Fruits & Vegetables"];

export default function FoodSearch({ user }) {
  // Initialize to today in local time
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Modal/calculator states
  const [selectedFood, setSelectedFood] = useState(null);
  const [servingGrams, setServingGrams] = useState(100);
  const [mealSlot, setMealSlot] = useState('Breakfast');
  
  // Log items for selected date
  const [loggedItems, setLoggedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const isToday = selectedDate === todayStr;

  // Firestore path: users/{uid}/daily_logs/{date}/items
  const loadLoggedItems = async () => {
    setLoading(true);
    try {
      const ref = collection(db, "users", user.uid, "daily_logs", selectedDate, "items");
      const snap = await getDocs(ref);
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setLoggedItems(items);
    } catch (e) {
      console.error("Error loading daily food items: ", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoggedItems();
  }, [user.uid, selectedDate]);

  // Handle Date Navigation
  const changeDateByOffset = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    const newDateStr = d.toLocaleDateString('en-CA');
    if (newDateStr > todayStr) return; // Block future dates
    setSelectedDate(newDateStr);
  };

  // Filter food database based on query & category
  const filteredFoods = FOOD_DB.filter(food => {
    const matchesQuery = food.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || food.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  // Calculate macros dynamically for the selected food and serving size (per 100g base)
  const getCalculatedMacros = () => {
    if (!selectedFood) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    const ratio = servingGrams / 100;
    return {
      calories: Math.round(selectedFood.calories * ratio),
      protein: parseFloat((selectedFood.protein * ratio).toFixed(1)),
      carbs: parseFloat((selectedFood.carbs * ratio).toFixed(1)),
      fat: parseFloat((selectedFood.fat * ratio).toFixed(1)),
      fiber: parseFloat((selectedFood.fiber * ratio).toFixed(1))
    };
  };

  const calculated = getCalculatedMacros();

  // Log food to Firestore
  const handleLogFood = async () => {
    if (!selectedFood || !isToday) return;
    try {
      const ref = collection(db, "users", user.uid, "daily_logs", selectedDate, "items");
      const newItem = {
        foodName: selectedFood.name,
        calories: calculated.calories,
        protein: calculated.protein,
        carbs: calculated.carbs,
        fat: calculated.fat,
        fiber: calculated.fiber,
        servingGrams: servingGrams,
        mealType: mealSlot,
        loggedAt: serverTimestamp()
      };
      await addDoc(ref, newItem);
      
      // Reset search selector & reload daily logs
      setSelectedFood(null);
      setServingGrams(100);
      loadLoggedItems();
    } catch (e) {
      console.error("Error logging food: ", e);
    }
  };

  // Delete logged item
  const handleDeleteItem = async (itemId) => {
    if (!isToday) return;
    try {
      const docRef = doc(db, "users", user.uid, "daily_logs", selectedDate, "items", itemId);
      await deleteDoc(docRef);
      loadLoggedItems();
    } catch (e) {
      console.error("Error deleting logged food: ", e);
    }
  };

  // Formatted date label
  const getDisplayDateLabel = () => {
    if (isToday) return "Today";
    return new Date(selectedDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  // Sum daily totals
  const dailyTotals = loggedItems.reduce((acc, it) => {
    acc.calories += it.calories || 0;
    acc.protein += it.protein || 0;
    acc.carbs += it.carbs || 0;
    acc.fat += it.fat || 0;
    acc.fiber += it.fiber || 0;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  // Open food card for the modal
  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setServingGrams(100);
    setMealSlot('Breakfast');
  };

  return (
    <div className="space-y-6">
      {/* Page Header and Date Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Food Search & Journal
            {!isToday && <Lock className="w-5 h-5 text-amber-500" />}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Search the database and manage your daily logs</p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-md">
          <button 
            onClick={() => changeDateByOffset(-1)} 
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 px-3 font-semibold text-sm text-white min-w-[140px] justify-center relative">
            <Calendar className={`w-4 h-4 ${isToday ? 'text-accent-teal' : 'text-amber-500'}`} />
            <span className={!isToday ? 'text-amber-500' : ''}>{getDisplayDateLabel()}</span>
            <input 
              type="date" 
              value={selectedDate}
              max={todayStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute opacity-0 w-full h-full cursor-pointer"
            />
          </div>

          <button 
            onClick={() => changeDateByOffset(1)} 
            disabled={isToday}
            className={`p-2 rounded-xl transition-colors ${
              isToday ? 'text-white/10 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Past Date Alert Bar */}
      <AnimatePresence>
        {!isToday && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <span className="font-bold">Viewing archived log for {getDisplayDateLabel()} — Read-only mode.</span> 
                <span className="ml-1 opacity-80">You cannot modify past journal entries.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative">
        
        {/* Left Pane (2/3 width) - Search & Grid */}
        <div className="lg:col-span-8 space-y-6">
          {/* Search Bar & Category Filters */}
          <GlassCard className="space-y-4" delay={0.05} hover={false}>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              {/* Search Input */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search food item (e.g. Roti, Poha, Chicken, Mango)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all duration-300 rounded-xl py-3.5 pl-12 pr-10 text-sm text-white placeholder-slate-500 outline-none"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-4 text-slate-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Results count */}
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap shrink-0">
                {filteredFoods.length} items
              </span>
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                    activeCategory === cat 
                      ? 'bg-gradient-to-r from-accent-purple to-accent-teal text-white shadow-md shadow-accent-purple/20' 
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </GlassCard>

          {/* 3-Column Food Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 pb-4">
            {filteredFoods.length === 0 ? (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-3">
                  <Search className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-400">No food items match your search</p>
                <p className="text-xs text-slate-500 mt-1">Try a different keyword or category filter</p>
              </div>
            ) : (
              filteredFoods.map((food, index) => (
                <motion.div
                  key={food.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3), ease: [0.33, 1, 0.68, 1] }}
                  onClick={() => handleSelectFood(food)}
                  className={`relative overflow-hidden bg-slate-950/40 backdrop-blur-xl border rounded-2xl p-5 shadow-glass cursor-pointer hover:scale-[1.01] hover:border-indigo-500/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-300 ${
                    selectedFood?.id === food.id 
                      ? 'border-accent-teal/40 shadow-[0_0_20px_rgba(34,211,238,0.15)]' 
                      : 'border-white/[0.06]'
                  }`}
                >
                  {/* Inner subtle gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                  <div className="relative z-10">
                    {/* Food title & category */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-100 leading-snug">{food.name}</h3>
                        <span className="inline-block mt-1.5 text-[9px] font-bold text-accent-teal/80 bg-accent-teal/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          {food.category}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-slate-100 leading-none">{food.calories}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">kcal</p>
                      </div>
                    </div>

                    {/* Serving label */}
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">per 100g serving</p>

                    {/* Macro tag pills */}
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-center py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/15 text-[10px] font-bold text-accent-pink">
                        P {food.protein}g
                      </span>
                      <span className="flex-1 text-center py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/15 text-[10px] font-bold text-accent-yellow">
                        C {food.carbs}g
                      </span>
                      <span className="flex-1 text-center py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-[10px] font-bold text-accent-green">
                        F {food.fat}g
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane (1/3 width) - Sticky Log Sidebar */}
        <div className="lg:col-span-4 sticky top-8">
          <GlassCard className={`flex flex-col h-[calc(100vh-140px)] border-t-2 ${isToday ? 'border-t-accent-teal' : 'border-t-amber-500/80'}`} delay={0.15} hover={false}>
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-4">
              <p className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                <Utensils className={`w-4 h-4 ${isToday ? 'text-accent-teal' : 'text-amber-500'}`} />
                Current Log Tracker
              </p>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{loggedItems.length} logged</span>
            </div>

            {/* Logged items list */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs">
                  Loading food items...
                </div>
              ) : loggedItems.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-3">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-400">Empty log tracker</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Use the food cards to search and log entries.</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {loggedItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex flex-col gap-3 bg-white/[0.02] border border-white/[0.04] p-3.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-sm font-bold text-white leading-snug">{item.foodName}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                            {item.mealType} &middot; {item.servingGrams}g
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-extrabold text-slate-100">{item.calories}</p>
                          <p className="text-[9px] text-slate-500 font-semibold uppercase mt-0.5">kcal</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-accent-pink bg-pink-500/10 px-1.5 py-0.5 rounded">P {item.protein}g</span>
                          <span className="text-[9px] font-bold text-accent-yellow bg-yellow-500/10 px-1.5 py-0.5 rounded">C {item.carbs}g</span>
                          <span className="text-[9px] font-bold text-accent-green bg-emerald-500/10 px-1.5 py-0.5 rounded">F {item.fat}g</span>
                        </div>
                        {isToday && (
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                            title="Remove log entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Daily Summary totals at the bottom */}
            <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4 shrink-0">
              <div className="flex items-center justify-between text-white font-extrabold">
                <span className="text-sm">Total Logged</span>
                <span className="text-lg bg-gradient-to-r from-accent-purple to-accent-teal bg-clip-text text-transparent">{dailyTotals.calories} kcal</span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-slate-400">
                <div className="bg-white/5 border border-white/10 py-2 rounded-xl">
                  <p className="font-bold text-accent-pink">{dailyTotals.protein}g</p>
                  <p className="uppercase mt-0.5 text-slate-500 font-bold">Pro</p>
                </div>
                <div className="bg-white/5 border border-white/10 py-2 rounded-xl">
                  <p className="font-bold text-accent-yellow">{dailyTotals.carbs}g</p>
                  <p className="uppercase mt-0.5 text-slate-500 font-bold">Carb</p>
                </div>
                <div className="bg-white/5 border border-white/10 py-2 rounded-xl">
                  <p className="font-bold text-accent-green">{dailyTotals.fat}g</p>
                  <p className="uppercase mt-0.5 text-slate-500 font-bold">Fat</p>
                </div>
                <div className="bg-white/5 border border-white/10 py-2 rounded-xl">
                  <p className="font-bold text-accent-blue">{dailyTotals.fiber}g</p>
                  <p className="uppercase mt-0.5 text-slate-500 font-bold">Fib</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Modal Overlay — appears when a food card is clicked */}
      <AnimatePresence>
        {selectedFood && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedFood(null); }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal Content - Made larger and more prominent per requirements */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative w-full max-w-2xl bg-slate-950/90 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 shadow-[0_16px_64px_0_rgba(0,0,0,0.6)] z-10"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-5 mb-6">
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-extrabold text-slate-100">{selectedFood.name}</h3>
                  <span className="inline-block mt-2 text-[10px] font-bold text-accent-teal bg-accent-teal/10 px-2.5 py-1 rounded-full uppercase tracking-widest border border-accent-teal/20">
                    {selectedFood.category}
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedFood(null)}
                  className="p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Serving size & Meal slot — side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Serving size */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 ml-1">Quantity (Grams)</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setServingGrams(Math.max(10, servingGrams - 50))}
                      className="p-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      value={servingGrams}
                      min="10"
                      max="2000"
                      onChange={(e) => setServingGrams(Math.max(1, parseInt(e.target.value) || 0))}
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-center transition-all duration-300 rounded-xl py-3.5 text-lg font-bold text-white outline-none"
                    />
                    <button
                      onClick={() => setServingGrams(servingGrams + 50)}
                      className="p-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick Chips */}
                  <div className="flex gap-2 mt-4">
                    {[50, 100, 150, 200, 250].map((grams) => (
                      <button
                        key={grams}
                        onClick={() => setServingGrams(grams)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                          servingGrams === grams 
                            ? 'bg-accent-teal text-canvas shadow-sm' 
                            : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400'
                        }`}
                      >
                        {grams}g
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meal slot */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 ml-1">Meal Classification</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setMealSlot(slot)}
                        className={`py-3.5 rounded-xl text-xs font-semibold uppercase transition-all duration-300 ${
                          mealSlot === slot 
                            ? 'bg-gradient-to-r from-accent-purple to-accent-teal text-white shadow-md' 
                            : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Calculated metrics display */}
              <div className="grid grid-cols-5 gap-3 bg-white/[0.02] border border-white/[0.04] p-5 rounded-xl text-center mb-6">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Calories</p>
                  <p className="text-xl font-extrabold text-slate-100 mt-1">{calculated.calories}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">kcal</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Protein</p>
                  <p className="text-xl font-extrabold text-accent-pink mt-1">{calculated.protein}g</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">P</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Carbs</p>
                  <p className="text-xl font-extrabold text-accent-yellow mt-1">{calculated.carbs}g</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">C</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fat</p>
                  <p className="text-xl font-extrabold text-accent-green mt-1">{calculated.fat}g</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">F</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fiber</p>
                  <p className="text-xl font-extrabold text-accent-blue mt-1">{calculated.fiber}g</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Fb</p>
                </div>
              </div>

              {/* Log button */}
              {isToday ? (
                <button
                  onClick={handleLogFood}
                  className="w-full py-4 bg-gradient-to-r from-accent-purple to-accent-teal hover:from-accent-purple/90 hover:to-accent-teal/90 text-white font-bold rounded-xl text-base transition-all duration-300 shadow-md shadow-accent-purple/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Check className="w-5 h-5" /> Log This Food
                </button>
              ) : (
                <div className="w-full py-4 bg-white/5 border border-white/10 text-slate-400 font-bold rounded-xl text-base flex items-center justify-center gap-2 cursor-not-allowed">
                  <Lock className="w-5 h-5" /> Cannot log to past dates
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
