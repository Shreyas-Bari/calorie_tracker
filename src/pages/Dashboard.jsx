import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, orderBy, limit, query, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import { 
  Flame, 
  Sparkles, 
  Droplet, 
  Scale, 
  Coffee, 
  Sun, 
  Moon, 
  Plus, 
  Minus,
  Utensils,
  TrendingDown,
  TrendingUp
} from 'lucide-react';

export default function Dashboard({ user }) {
  const [greeting, setGreeting] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [streak, setStreak] = useState(0);
  const [goals, setGoals] = useState({
    targetCalories: 2000,
    targetProtein: 140,
    targetCarbs: 250,
    targetFat: 70,
    targetFiber: 30
  });

  const [consumed, setConsumed] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0
  });

  const [meals, setMeals] = useState([]);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [weightLogs, setWeightLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const getTodayDateString = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  };

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else if (h < 21) setGreeting("Good evening");
    else setGreeting("Good night");

    setDateStr(new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    }));

    const loadDashboardData = async () => {
      try {
        const today = getTodayDateString();
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.goals) {
            setGoals({
              targetCalories: data.goals.targetCalories || 2000,
              targetProtein: data.goals.targetProtein || 140,
              targetCarbs: data.goals.targetCarbs || 250,
              targetFat: data.goals.targetFat || 70,
              targetFiber: data.goals.targetFiber || 30
            });
          }
          if (data.streak) {
            setStreak(data.streak.current || 0);
          }
        }

        const itemsRef = collection(db, "users", user.uid, "daily_logs", today, "items");
        const itemsSnap = await getDocs(itemsRef);
        const loggedMeals = [];
        let cal = 0, pro = 0, carb = 0, fat = 0, fib = 0;
        
        itemsSnap.forEach((d) => {
          const item = d.data();
          loggedMeals.push({ id: d.id, ...item });
          cal += item.calories || 0;
          pro += item.protein || 0;
          carb += item.carbs || 0;
          fat += item.fat || 0;
          fib += item.fiber || 0;
        });

        setMeals(loggedMeals);
        setConsumed({
          calories: Math.round(cal),
          protein: Math.round(pro),
          carbs: Math.round(carb),
          fat: Math.round(fat),
          fiber: Math.round(fib)
        });

        const waterDoc = await getDoc(doc(db, "users", user.uid, "waterLogs", today));
        if (waterDoc.exists()) {
          setWaterGlasses(waterDoc.data().glasses || 0);
        }

        const weightRef = collection(db, "users", user.uid, "weightLogs");
        const q = query(weightRef, orderBy("date", "desc"), limit(2));
        const weightSnap = await getDocs(q);
        const weights = [];
        weightSnap.forEach((d) => weights.push(d.data()));
        setWeightLogs(weights);

      } catch (e) {
        console.error("Dashboard load error: ", e);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user.uid]);

  const handleWaterToggle = async (glassesCount) => {
    const today = getTodayDateString();
    setWaterGlasses(glassesCount);
    try {
      await setDoc(doc(db, "users", user.uid, "waterLogs", today), {
        glasses: glassesCount,
        liters: parseFloat((glassesCount * 0.25).toFixed(2)),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save water log: ", e);
    }
  };

  const getRemainingCalories = () => {
    return Math.max(0, goals.targetCalories - consumed.calories);
  };

  const caloriePercentage = Math.min((consumed.calories / goals.targetCalories) * 100, 100);

  const radius = 72;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (caloriePercentage / 100) * circumference;

  const mealIcons = {
    breakfast: Coffee,
    lunch: Sun,
    dinner: Moon,
    snacks: Utensils
  };

  return (
    <div className="space-y-8">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            {greeting}, {user.displayName ? user.displayName.split(' ')[0] : 'User'}
            <Sparkles className="w-6 h-6 text-accent-teal animate-pulse" />
          </h1>
          <p className="text-slate-400 text-sm mt-1">{dateStr}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2.5 backdrop-blur-md">
            <Flame className="w-5 h-5 text-accent-pink animate-pulse" />
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Streak</p>
              <p className="text-lg font-extrabold text-white leading-none mt-1">{streak} Days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Calorie Ring Snapshot */}
        <GlassCard className="flex flex-col items-center justify-center py-10" delay={0.1}>
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-6">Today's Snapshot</p>
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                stroke="rgba(255,255,255,0.03)"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <motion.circle
                stroke="url(#calorieGradient)"
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                strokeLinecap="round"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <defs>
                <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6C63FF" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-black text-white leading-none">{consumed.calories}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">of {goals.targetCalories} kcal</span>
            </div>
          </div>

          <div className="grid grid-cols-2 w-full gap-4 mt-8 pt-6 border-t border-white/[0.06] text-center">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Remaining</p>
              <p className="text-xl font-extrabold text-white mt-1">{getRemainingCalories()} kcal</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Logged Meals</p>
              <p className="text-xl font-extrabold text-accent-teal mt-1">{meals.length}</p>
            </div>
          </div>
        </GlassCard>

        {/* Middle Column: Macronutrient Bars */}
        <GlassCard className="flex flex-col" delay={0.2}>
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-6">Macronutrients</p>
          <div className="flex-1 flex flex-col justify-between gap-6">
            
            {/* Protein bar */}
            <div>
              <div className="flex justify-between text-sm font-semibold mb-2">
                <span className="text-slate-300">Protein</span>
                <span className="text-white">{consumed.protein}g / <span className="text-slate-500">{goals.targetProtein}g</span></span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((consumed.protein / goals.targetProtein) * 100, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-accent-pink rounded-full shadow-lg shadow-accent-pink/20"
                />
              </div>
            </div>

            {/* Carbs bar */}
            <div>
              <div className="flex justify-between text-sm font-semibold mb-2">
                <span className="text-slate-300">Carbs</span>
                <span className="text-white">{consumed.carbs}g / <span className="text-slate-500">{goals.targetCarbs}g</span></span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((consumed.carbs / goals.targetCarbs) * 100, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-accent-yellow rounded-full shadow-lg shadow-accent-yellow/20"
                />
              </div>
            </div>

            {/* Fat bar */}
            <div>
              <div className="flex justify-between text-sm font-semibold mb-2">
                <span className="text-slate-300">Fat</span>
                <span className="text-white">{consumed.fat}g / <span className="text-slate-500">{goals.targetFat}g</span></span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((consumed.fat / goals.targetFat) * 100, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-accent-green rounded-full shadow-lg shadow-accent-green/20"
                />
              </div>
            </div>

            {/* Fiber bar */}
            <div>
              <div className="flex justify-between text-sm font-semibold mb-2">
                <span className="text-slate-300">Fiber</span>
                <span className="text-white">{consumed.fiber}g / <span className="text-slate-500">{goals.targetFiber}g</span></span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((consumed.fiber / goals.targetFiber) * 100, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-accent-blue rounded-full shadow-lg shadow-accent-blue/20"
                />
              </div>
            </div>

          </div>
        </GlassCard>

        {/* Right Column: Weight & Water Trackers */}
        <div className="flex flex-col gap-6">
          {/* Water Widget */}
          <GlassCard className="flex-1 flex flex-col justify-between" delay={0.3}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Water Intake</p>
                <p className="text-xl font-extrabold text-white mt-1">{(waterGlasses * 0.25).toFixed(2)} L</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                waterGlasses >= 6 ? 'bg-accent-green/10 text-accent-green border border-accent-green/20' : 
                waterGlasses >= 3 ? 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20' : 
                'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
              }`}>
                {waterGlasses} / 8 Glasses
              </span>
            </div>

            <div className="flex items-center justify-between gap-2.5 py-4">
              {[...Array(8)].map((_, i) => {
                const filled = i < waterGlasses;
                return (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleWaterToggle(filled ? i : i + 1)}
                    className="focus:outline-none"
                  >
                    <Droplet className={`w-7 h-7 transition-colors duration-300 ${filled ? 'fill-accent-blue text-accent-blue drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]' : 'text-slate-600 hover:text-accent-blue/60'}`} />
                  </motion.button>
                );
              })}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleWaterToggle(Math.max(0, waterGlasses - 1))}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-colors"
              >
                <Minus className="w-3.5 h-3.5" /> Remove Glass
              </button>
              <button
                onClick={() => handleWaterToggle(Math.min(8, waterGlasses + 1))}
                className="flex-1 py-2 rounded-xl bg-accent-blue/10 border border-accent-blue/20 hover:bg-accent-blue/20 flex items-center justify-center gap-1.5 text-xs font-semibold text-accent-blue transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Glass
              </button>
            </div>
          </GlassCard>

          {/* Weight Widget */}
          <GlassCard className="flex-1 flex flex-col justify-center" delay={0.4}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent-teal/10 border border-accent-teal/20 flex items-center justify-center text-accent-teal">
                <Scale className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Current Weight</p>
                <p className="text-2xl font-black text-white mt-1">
                  {weightLogs.length > 0 ? weightLogs[0].weight : '--'}{' '}
                  <span className="text-xs text-slate-500 font-bold uppercase">kg</span>
                </p>
              </div>
              {weightLogs.length >= 2 && (() => {
                const diff = weightLogs[0].weight - weightLogs[1].weight;
                const gain = diff > 0.1;
                const loss = diff < -0.1;
                if (!gain && !loss) return null;
                return (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                    loss ? 'bg-accent-green/10 text-accent-green border border-accent-green/20' : 'bg-accent-pink/10 text-accent-pink border border-accent-pink/20'
                  }`}>
                    {loss ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                    {Math.abs(diff).toFixed(1)} kg
                  </div>
                );
              })()}
            </div>
          </GlassCard>
        </div>

      </div>

      {/* Daily Meals List Journal */}
      <GlassCard delay={0.5}>
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
          <p className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
            <Utensils className="w-4 h-4 text-accent-purple" />
            Today's Journal
          </p>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{meals.length} items logged</span>
        </div>

        <AnimatePresence mode="popLayout">
          {meals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 flex flex-col items-center text-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-3">
                <Utensils className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-400">Your journal is empty</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[240px]">Navigate to Food Search in the sidebar to search and log your meals.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meals.map((meal) => {
                const IconComponent = mealIcons[meal.mealType?.toLowerCase()] || Utensils;
                return (
                  <motion.div
                    key={meal.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl hover:bg-white/[0.04] transition-colors duration-200"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      meal.mealType?.toLowerCase() === 'breakfast' ? 'bg-accent-purple/10 text-accent-purple border border-accent-purple/20' :
                      meal.mealType?.toLowerCase() === 'lunch' ? 'bg-accent-teal/10 text-accent-teal border border-accent-teal/20' :
                      meal.mealType?.toLowerCase() === 'dinner' ? 'bg-accent-pink/10 text-accent-pink border border-accent-pink/20' :
                      'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{meal.foodName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">{meal.mealType} &middot; {meal.servingGrams}g</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white">{meal.calories}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">kcal</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </GlassCard>
    </div>
  );
}
