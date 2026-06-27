import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, orderBy, limit, query, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import { 
  User, 
  Scale, 
  ChevronRight, 
  Target, 
  Activity, 
  Calculator,
  Save, 
  Sparkles,
  ClipboardList,
  AlertCircle
} from 'lucide-react';

const ACTIVITY_LEVELS = [
  { level: "sedentary", label: "Sedentary", desc: "Little to no exercise", multiplier: 1.2 },
  { level: "light", label: "Lightly Active", desc: "Light exercise 1-3 days/wk", multiplier: 1.375 },
  { level: "moderate", label: "Moderately Active", desc: "Moderate sports 3-5 days/wk", multiplier: 1.55 },
  { level: "active", label: "Very Active", desc: "Hard sports 6-7 days/wk", multiplier: 1.725 },
  { level: "extra_active", label: "Extra Active", desc: "Physical job or 2x training", multiplier: 1.9 }
];

const GOAL_TYPES = [
  { type: "loss", label: "Weight Loss", desc: "Deficit of 500 kcal/day" },
  { type: "maintain", label: "Maintenance", desc: "Eat at TDEE baseline" },
  { type: "gain", label: "Weight Gain", desc: "Surplus of 300 kcal/day" },
  { type: "muscle", label: "Muscle Gain", desc: "Surplus of 200 kcal/day" }
];

export default function Goals({ user }) {
  // Profile state
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState('Male');
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(70);
  const [activity, setActivity] = useState('moderate');
  const [goalType, setGoalType] = useState('maintain');

  // Calculated recommended values
  const [recommended, setRecommended] = useState({
    calories: 2000,
    protein: 140,
    carbs: 250,
    fat: 70,
    fiber: 30
  });

  // Custom Target Inputs
  const [customCal, setCustomCal] = useState(2000);
  const [customPro, setCustomPro] = useState(140);
  const [customCarb, setCustomCarb] = useState(250);
  const [customFat, setCustomFat] = useState(70);
  const [customFib, setCustomFib] = useState(30);

  // Weight logs state
  const [weightValue, setWeightValue] = useState('');
  const [weightHistory, setWeightHistory] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // 1. Initial Load of Goals & Weight History
  const loadGoalsAndHistory = async () => {
    try {
      // Load user doc
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.profile) {
          setAge(data.profile.age || 25);
          setGender(data.profile.gender || 'Male');
          setHeight(data.profile.height || 170);
          setWeight(data.profile.weight || 70);
          setActivity(data.profile.activityLevel || 'moderate');
        }
        if (data.goals) {
          setGoalType(data.goals.goalType || 'maintain');
          setCustomCal(data.goals.targetCalories || 2000);
          setCustomPro(data.goals.targetProtein || 140);
          setCustomCarb(data.goals.targetCarbs || 250);
          setCustomFat(data.goals.targetFat || 70);
          setCustomFib(data.goals.targetFiber || 30);
        }
      }

      // Load weight logs
      const ref = collection(db, "users", user.uid, "weightLogs");
      const q = query(ref, orderBy("date", "desc"), limit(5));
      const snap = await getDocs(q);
      const history = [];
      snap.forEach((d) => history.push({ id: d.id, ...d.data() }));
      setWeightHistory(history);

    } catch (e) {
      console.error("Goals load error: ", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoalsAndHistory();
  }, [user.uid]);

  // 2. Mifflin-St Jeor Calculation logic
  useEffect(() => {
    // BMR
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    if (gender === 'Male') bmr += 5;
    else bmr -= 161;

    // TDEE
    const mult = ACTIVITY_LEVELS.find(a => a.level === activity)?.multiplier || 1.2;
    const tdee = Math.round(bmr * mult);

    // Goal Calorie Target offsets
    let recommendedCal = tdee;
    let proPct = 0.30, carbPct = 0.45, fatPct = 0.25; // default maintenance splits

    if (goalType === 'loss') {
      recommendedCal = Math.max(1200, tdee - 500);
      proPct = 0.35; carbPct = 0.40; fatPct = 0.25;
    } else if (goalType === 'gain') {
      recommendedCal = tdee + 300;
      proPct = 0.30; carbPct = 0.50; fatPct = 0.20;
    } else if (goalType === 'muscle') {
      recommendedCal = tdee + 200;
      proPct = 0.40; carbPct = 0.35; fatPct = 0.25;
    }

    // Convert calorie percentage to grams
    const recommendedPro = Math.round((recommendedCal * proPct) / 4);
    const recommendedCarb = Math.round((recommendedCal * carbPct) / 4);
    const recommendedFat = Math.round((recommendedCal * fatPct) / 9);
    const recommendedFib = gender === 'Male' ? 30 : 25;

    setRecommended({
      calories: recommendedCal,
      protein: recommendedPro,
      carbs: recommendedCarb,
      fat: recommendedFat,
      fiber: recommendedFib
    });

  }, [age, gender, height, weight, activity, goalType]);

  const applyRecommendedTargets = () => {
    setCustomCal(recommended.calories);
    setCustomPro(recommended.protein);
    setCustomCarb(recommended.carbs);
    setCustomFat(recommended.fat);
    setCustomFib(recommended.fiber);
    showBannerMessage('Recommended targets loaded below!');
  };

  const showBannerMessage = (txt) => {
    setMessage(txt);
    setTimeout(() => setMessage(''), 4000);
  };

  // Save profile info & goals
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Save user details
      await setDoc(doc(db, "users", user.uid), {
        profile: { age, gender, height, weight, activityLevel: activity },
        goals: {
          goalType,
          targetCalories: customCal,
          targetProtein: customPro,
          targetCarbs: customCarb,
          targetFat: customFat,
          targetFiber: customFib
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Save today's weight log
      await setDoc(doc(db, "users", user.uid, "weightLogs", today), {
        date: today,
        weight: weight,
        loggedAt: serverTimestamp()
      }, { merge: true });

      showBannerMessage('Profile & goals saved successfully!');
      loadGoalsAndHistory();
    } catch (err) {
      console.error("Save profile error: ", err);
      showBannerMessage('Error saving profile settings.');
    }
  };

  // Add a dedicated Weight log entry
  const handleLogWeight = async (e) => {
    e.preventDefault();
    if (!weightValue || isNaN(weightValue)) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      await setDoc(doc(db, "users", user.uid, "weightLogs", today), {
        date: today,
        weight: parseFloat(weightValue),
        loggedAt: serverTimestamp()
      }, { merge: true });
      
      setWeightValue('');
      showBannerMessage('Weight entry logged successfully!');
      loadGoalsAndHistory();
    } catch (err) {
      console.error("Weight save error: ", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Goals & Profile</h1>
        <p className="text-slate-400 text-sm mt-1">Configure your targets and calculate recommended metrics</p>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-xs font-semibold flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>{message}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Recommended Panel (Span 7) */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-7 space-y-6">
          <GlassCard className="space-y-6" delay={0.1}>
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-accent-teal" /> Personal Profile Parameters
            </p>

            {/* Inputs grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Age (Years)</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Height (cm)</label>
                <input
                  type="number"
                  min="80"
                  max="250"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Weight (kg)</label>
                <input
                  type="number"
                  min="30"
                  max="200"
                  value={weight}
                  onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            {/* Gender selectors */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 ml-1">Gender</label>
              <div className="flex bg-white/5 p-1 rounded-xl w-fit gap-1 border border-white/10">
                {['Male', 'Female', 'Other'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`px-6 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                      gender === g 
                        ? 'bg-gradient-to-r from-accent-purple to-accent-teal text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity selector */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-accent-purple" /> Activity Multiplier
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACTIVITY_LEVELS.map((act) => (
                  <div
                    key={act.level}
                    onClick={() => setActivity(act.level)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                      activity === act.level 
                        ? 'bg-white/[0.05] border-accent-purple/40 shadow-md' 
                        : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'
                    }`}
                  >
                    <p className="text-xs font-bold text-white leading-none">{act.label}</p>
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">{act.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Goal selectors */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-accent-teal" /> Target Strategy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GOAL_TYPES.map((goal) => (
                  <div
                    key={goal.type}
                    onClick={() => setGoalType(goal.type)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                      goalType === goal.type 
                        ? 'bg-white/[0.05] border-accent-teal/40 shadow-md' 
                        : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'
                    }`}
                  >
                    <p className="text-xs font-bold text-white leading-none">{goal.label}</p>
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">{goal.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Recommended Targets Result Panel */}
          <GlassCard className="space-y-4 border-accent-teal/10" delay={0.2} hover={false}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Calculator className="w-4 h-4 text-accent-teal" /> Mifflin-St Jeor Recommendations
              </p>
              <button
                type="button"
                onClick={applyRecommendedTargets}
                className="text-xs font-bold text-accent-teal hover:text-accent-teal/80 border border-accent-teal/20 bg-accent-teal/5 px-4 py-1.5 rounded-xl transition-all"
              >
                Apply Recommendations
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center py-2 bg-white/[0.01] border border-white/[0.04] rounded-xl">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Calories</p>
                <p className="text-sm font-extrabold text-white mt-1">{recommended.calories}</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase">kcal</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Protein</p>
                <p className="text-sm font-extrabold text-accent-pink mt-1">{recommended.protein}g</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase">P</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Carbs</p>
                <p className="text-sm font-extrabold text-accent-yellow mt-1">{recommended.carbs}g</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase">C</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Fat</p>
                <p className="text-sm font-extrabold text-accent-green mt-1">{recommended.fat}g</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase">F</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Fiber</p>
                <p className="text-sm font-extrabold text-accent-blue mt-1">{recommended.fiber}g</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase">Fb</p>
              </div>
            </div>
          </GlassCard>

          {/* Custom Targets Card Inputs */}
          <GlassCard className="space-y-4" delay={0.3}>
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Custom Targets (Manual Overrides)</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Calories</label>
                <input
                  type="number"
                  value={customCal}
                  onChange={(e) => setCustomCal(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-purple text-center rounded-lg py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Protein (g)</label>
                <input
                  type="number"
                  value={customPro}
                  onChange={(e) => setCustomPro(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-purple text-center rounded-lg py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Carbs (g)</label>
                <input
                  type="number"
                  value={customCarb}
                  onChange={(e) => setCustomCarb(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-purple text-center rounded-lg py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Fat (g)</label>
                <input
                  type="number"
                  value={customFat}
                  onChange={(e) => setCustomFat(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-purple text-center rounded-lg py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Fiber (g)</label>
                <input
                  type="number"
                  value={customFib}
                  onChange={(e) => setCustomFib(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-purple text-center rounded-lg py-2.5 text-xs text-white outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 mt-4 bg-gradient-to-r from-accent-purple to-accent-teal hover:from-accent-purple/90 hover:to-accent-teal/90 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-accent-purple/20 flex items-center justify-center gap-2 hover:scale-[1.01]"
            >
              <Save className="w-4 h-4" /> Save Profile & Goals
            </button>
          </GlassCard>
        </form>

        {/* Right Column: Weight Logs (Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Add log weight form */}
          <GlassCard className="space-y-4" delay={0.4}>
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-accent-teal" /> Register Weight Entry
            </p>

            <form onSubmit={handleLogWeight} className="flex gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 70.5"
                required
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                className="flex-1 bg-white/[0.03] border border-white/[0.08] focus:border-accent-teal transition-all rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 outline-none"
              />
              <button
                type="submit"
                className="py-3 px-5 bg-accent-teal text-obsidian-950 font-bold rounded-xl text-sm hover:bg-accent-teal/90 transition-colors shadow-lg shadow-accent-teal/20"
              >
                Log kg
              </button>
            </form>
          </GlassCard>

          {/* Weight log history list */}
          <GlassCard className="space-y-4 flex-1" delay={0.5}>
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-accent-purple" /> Logged Weight History
            </p>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {weightHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No weight entries recorded yet.
                </div>
              ) : (
                weightHistory.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3.5 bg-white/[0.01] border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{log.weight} kg</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                        {new Date(log.date || log.id).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
}
