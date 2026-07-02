import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import {
  Coffee,
  Sun,
  Moon,
  Utensils,
  Trash2,
  Pencil,
  Copy,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  X,
  Check,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Lock,
  AlertTriangle,
  Bookmark,
  BookmarkPlus,
  FolderOpen,
  Sparkles,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Leaf
} from 'lucide-react';

/* ──────────────────────────────────────────────
   Date utilities
   ────────────────────────────────────────────── */
const formatDateKey = (date) => date.toLocaleDateString('en-CA');
const createLocalDate = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/* ──────────────────────────────────────────────
   Meal slot configuration
   ────────────────────────────────────────────── */
const MEAL_SLOTS = [
  { key: 'Breakfast', label: 'Breakfast', icon: Coffee, accent: 'accent-purple', border: 'border-t-purple-500/40', gradient: 'from-purple-500/20 to-purple-500/0' },
  { key: 'Lunch', label: 'Lunch', icon: Sun, accent: 'accent-teal', border: 'border-t-teal-400/40', gradient: 'from-teal-500/20 to-teal-500/0' },
  { key: 'Dinner', label: 'Dinner', icon: Moon, accent: 'accent-pink', border: 'border-t-pink-500/40', gradient: 'from-pink-500/20 to-pink-500/0' },
  { key: 'Snacks', label: 'Snacks', icon: Utensils, accent: 'accent-yellow', border: 'border-t-yellow-500/40', gradient: 'from-yellow-500/20 to-yellow-500/0' }
];

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */
export default function MealTracker({ user }) {
  const todayStr = formatDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;

  // Logged items
  const [loggedItems, setLoggedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Collapsed state per meal slot
  const [collapsed, setCollapsed] = useState({});

  // Edit modal state
  const [editItem, setEditItem] = useState(null);
  const [editServing, setEditServing] = useState(100);
  const [editMealSlot, setEditMealSlot] = useState('Breakfast');

  // Template modals
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateSlot, setSaveTemplateSlot] = useState('Breakfast');

  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // User goals
  const [goals, setGoals] = useState({
    targetCalories: 2000,
    targetProtein: 140,
    targetCarbs: 250,
    targetFat: 70,
    targetFiber: 30
  });

  // Banner
  const [banner, setBanner] = useState('');
  const showBanner = (msg) => {
    setBanner(msg);
    setTimeout(() => setBanner(''), 3500);
  };

  /* ────── Firestore: Load daily items ────── */
  const loadItems = async () => {
    setLoading(true);
    try {
      const ref = collection(db, 'users', user.uid, 'daily_logs', selectedDate, 'items');
      const snap = await getDocs(ref);
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setLoggedItems(items);
    } catch (e) {
      console.error('MealTracker load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadGoals = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
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
      }
    } catch (e) {
      console.error('Goals load error:', e);
    }
  };

  useEffect(() => {
    loadItems();
  }, [user.uid, selectedDate]);

  useEffect(() => {
    loadGoals();
  }, [user.uid]);

  /* ────── Date navigation ────── */
  const changeDateByOffset = (offset) => {
    const d = createLocalDate(selectedDate);
    d.setDate(d.getDate() + offset);
    const newDateStr = formatDateKey(d);
    if (newDateStr > todayStr) return;
    setSelectedDate(newDateStr);
    setEditItem(null);
  };

  const getDisplayDateLabel = () => {
    if (isToday) return 'Today';
    const d = createLocalDate(selectedDate);
    const diff = Math.round((new Date(todayStr) - d) / 86400000);
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /* ────── Group items by meal slot ────── */
  const groupedItems = useMemo(() => {
    const groups = {};
    MEAL_SLOTS.forEach((s) => { groups[s.key] = []; });
    loggedItems.forEach((item) => {
      const slot = item.mealType || 'Snacks';
      if (groups[slot]) groups[slot].push(item);
      else groups['Snacks'].push(item);
    });
    return groups;
  }, [loggedItems]);

  /* ────── Daily totals ────── */
  const dailyTotals = useMemo(() => {
    return loggedItems.reduce(
      (acc, it) => {
        acc.calories += it.calories || 0;
        acc.protein += it.protein || 0;
        acc.carbs += it.carbs || 0;
        acc.fat += it.fat || 0;
        acc.fiber += it.fiber || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
  }, [loggedItems]);

  /* ────── Actions: Delete ────── */
  const handleDelete = async (itemId) => {
    if (!isToday) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'daily_logs', selectedDate, 'items', itemId));
      showBanner('Entry removed successfully.');
      loadItems();
    } catch (e) {
      console.error('Delete error:', e);
      showBanner('Failed to delete entry.');
    }
  };

  /* ────── Actions: Duplicate ────── */
  const handleDuplicate = async (item) => {
    if (!isToday) return;
    try {
      const ref = collection(db, 'users', user.uid, 'daily_logs', selectedDate, 'items');
      await addDoc(ref, {
        foodName: item.foodName,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
        servingGrams: item.servingGrams,
        mealType: item.mealType,
        loggedAt: serverTimestamp()
      });
      showBanner(`Duplicated "${item.foodName}" successfully.`);
      loadItems();
    } catch (e) {
      console.error('Duplicate error:', e);
      showBanner('Failed to duplicate entry.');
    }
  };

  /* ────── Actions: Edit (open modal) ────── */
  const handleOpenEdit = (item) => {
    if (!isToday) return;
    setEditItem(item);
    setEditServing(item.servingGrams || 100);
    setEditMealSlot(item.mealType || 'Breakfast');
  };

  /* ────── Actions: Save edit ────── */
  const getEditCalculated = () => {
    if (!editItem) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    const origServing = editItem.servingGrams || 100;
    const ratio = editServing / origServing;
    return {
      calories: Math.round((editItem.calories || 0) * ratio),
      protein: parseFloat(((editItem.protein || 0) * ratio).toFixed(1)),
      carbs: parseFloat(((editItem.carbs || 0) * ratio).toFixed(1)),
      fat: parseFloat(((editItem.fat || 0) * ratio).toFixed(1)),
      fiber: parseFloat(((editItem.fiber || 0) * ratio).toFixed(1))
    };
  };

  const editCalc = getEditCalculated();

  const handleSaveEdit = async () => {
    if (!editItem || !isToday) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'daily_logs', selectedDate, 'items', editItem.id);
      await updateDoc(docRef, {
        servingGrams: editServing,
        mealType: editMealSlot,
        calories: editCalc.calories,
        protein: editCalc.protein,
        carbs: editCalc.carbs,
        fat: editCalc.fat,
        fiber: editCalc.fiber,
        updatedAt: serverTimestamp()
      });
      setEditItem(null);
      showBanner('Entry updated successfully.');
      loadItems();
    } catch (e) {
      console.error('Edit save error:', e);
      showBanner('Failed to update entry.');
    }
  };

  /* ────── Templates: Save ────── */
  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) return;
    const slotItems = groupedItems[saveTemplateSlot] || [];
    if (slotItems.length === 0) {
      showBanner(`No items in ${saveTemplateSlot} to save as a template.`);
      return;
    }
    try {
      const ref = collection(db, 'users', user.uid, 'mealTemplates');
      await addDoc(ref, {
        name: saveTemplateName.trim(),
        mealSlot: saveTemplateSlot,
        items: slotItems.map((it) => ({
          foodName: it.foodName,
          calories: it.calories,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
          fiber: it.fiber,
          servingGrams: it.servingGrams,
          mealType: it.mealType
        })),
        createdAt: serverTimestamp()
      });
      setShowSaveTemplate(false);
      setSaveTemplateName('');
      showBanner(`Template "${saveTemplateName.trim()}" saved!`);
    } catch (e) {
      console.error('Save template error:', e);
      showBanner('Failed to save template.');
    }
  };

  /* ────── Templates: Load list ────── */
  const handleOpenLoadTemplate = async () => {
    setShowLoadTemplate(true);
    setTemplatesLoading(true);
    try {
      const ref = collection(db, 'users', user.uid, 'mealTemplates');
      const q = query(ref, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setTemplates(list);
    } catch (e) {
      console.error('Load templates error:', e);
    } finally {
      setTemplatesLoading(false);
    }
  };

  /* ────── Templates: Apply template to today ────── */
  const handleApplyTemplate = async (template) => {
    if (!isToday) return;
    try {
      const ref = collection(db, 'users', user.uid, 'daily_logs', selectedDate, 'items');
      const promises = (template.items || []).map((item) =>
        addDoc(ref, {
          foodName: item.foodName,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          servingGrams: item.servingGrams,
          mealType: item.mealType,
          loggedAt: serverTimestamp()
        })
      );
      await Promise.all(promises);
      setShowLoadTemplate(false);
      showBanner(`Template "${template.name}" applied — ${template.items.length} items logged.`);
      loadItems();
    } catch (e) {
      console.error('Apply template error:', e);
      showBanner('Failed to apply template.');
    }
  };

  /* ────── Templates: Delete ────── */
  const handleDeleteTemplate = async (templateId) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'mealTemplates', templateId));
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      showBanner('Template deleted.');
    } catch (e) {
      console.error('Delete template error:', e);
    }
  };

  /* ────── Toggle collapse ────── */
  const toggleCollapse = (slotKey) => {
    setCollapsed((prev) => ({ ...prev, [slotKey]: !prev[slotKey] }));
  };

  /* ────── Macro bar helper ────── */
  const macroBarData = [
    { label: 'Calories', value: dailyTotals.calories, target: goals.targetCalories, unit: 'kcal', color: 'bg-accent-purple', textColor: 'text-accent-purple' },
    { label: 'Protein', value: Math.round(dailyTotals.protein), target: goals.targetProtein, unit: 'g', color: 'bg-accent-pink', textColor: 'text-accent-pink' },
    { label: 'Carbs', value: Math.round(dailyTotals.carbs), target: goals.targetCarbs, unit: 'g', color: 'bg-accent-yellow', textColor: 'text-accent-yellow' },
    { label: 'Fat', value: Math.round(dailyTotals.fat), target: goals.targetFat, unit: 'g', color: 'bg-accent-green', textColor: 'text-accent-green' },
    { label: 'Fiber', value: Math.round(dailyTotals.fiber), target: goals.targetFiber, unit: 'g', color: 'bg-accent-blue', textColor: 'text-accent-blue' }
  ];

  const canNavigateForward = selectedDate < todayStr;

  return (
    <div className="space-y-6">
      {/* ── Page Header + Date Nav ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Meal Tracker
            {!isToday && <Lock className="w-5 h-5 text-amber-500" />}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Organize, manage, and template your daily meals</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {!isToday && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-2 text-xs font-extrabold uppercase text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.08)]">
              <Lock className="h-4 w-4" />
              Read-only history
            </div>
          )}

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => changeDateByOffset(-1)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex min-w-[170px] items-center justify-center gap-2 px-4 py-2 font-semibold text-sm rounded-xl text-white">
              <Calendar className={`w-4 h-4 ${isToday ? 'text-accent-teal' : 'text-amber-400'}`} />
              <span>{getDisplayDateLabel()}</span>
            </div>

            <button
              type="button"
              onClick={() => changeDateByOffset(1)}
              disabled={!canNavigateForward}
              className={`p-2 rounded-xl transition-colors ${
                canNavigateForward ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-white/10 cursor-not-allowed'
              }`}
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Banner notification */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-xs font-semibold flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{banner}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Past date alert */}
      <AnimatePresence>
        {!isToday && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/15 p-4 text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.08)]">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-300" />
              <div className="text-sm">
                <span className="font-bold">Historical log for {getDisplayDateLabel()} is locked.</span>
                <span className="ml-1 text-amber-100/80">Return to Today to edit, delete, or duplicate entries.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Macro Summary Bar ── */}
      <GlassCard className="space-y-4" delay={0.05} hover={false}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <Flame className="w-4 h-4 text-accent-pink" /> Daily Macros Summary
          </p>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{loggedItems.length} items logged</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {macroBarData.map((m, i) => {
            const pct = Math.min(m.target > 0 ? (m.value / m.target) * 100 : 0, 100);
            return (
              <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3 text-center">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{m.label}</p>
                <p className={`text-lg font-black mt-1 leading-none ${m.textColor}`}>
                  {m.value}
                  <span className="text-[10px] text-slate-400 font-bold ml-0.5">{m.unit}</span>
                </p>
                <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 + i * 0.05 }}
                    className={`h-full ${m.color} rounded-full`}
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-semibold mt-1.5">
                  of {m.target} {m.unit}
                </p>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* ── Template Action Buttons ── */}
      {isToday && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setShowSaveTemplate(true); setSaveTemplateSlot('Breakfast'); setSaveTemplateName(''); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-purple/10 border border-accent-purple/20 text-accent-purple text-xs font-bold hover:bg-accent-purple/15 transition-colors"
          >
            <BookmarkPlus className="w-4 h-4" /> Save Meal as Template
          </button>
          <button
            onClick={handleOpenLoadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-xs font-bold hover:bg-accent-teal/15 transition-colors"
          >
            <FolderOpen className="w-4 h-4" /> Load Template
          </button>
        </div>
      )}

      {/* ── Meal Slot Accordion Panels ── */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-xs uppercase tracking-widest animate-pulse">
          Loading meal data...
        </div>
      ) : (
        <div className="space-y-4">
          {MEAL_SLOTS.map((slot, slotIdx) => {
            const SlotIcon = slot.icon;
            const items = groupedItems[slot.key] || [];
            const isOpen = !collapsed[slot.key];
            const slotCal = items.reduce((s, it) => s + (it.calories || 0), 0);
            const slotPro = items.reduce((s, it) => s + (it.protein || 0), 0);

            return (
              <motion.div
                key={slot.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 + slotIdx * 0.06, ease: [0.33, 1, 0.68, 1] }}
              >
                <GlassCard
                  className={`border-t-2 ${slot.border} !p-0 overflow-hidden`}
                  delay={0}
                  hover={false}
                >
                  {/* Slot Header */}
                  <button
                    onClick={() => toggleCollapse(slot.key)}
                    className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-${slot.accent}/10 border border-${slot.accent}/20 flex items-center justify-center text-${slot.accent}`}>
                        <SlotIcon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-white">{slot.label}</p>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                          {items.length} {items.length === 1 ? 'item' : 'items'} · {Math.round(slotCal)} kcal · {Math.round(slotPro)}g protein
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-black text-${slot.accent}`}>{Math.round(slotCal)}</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase mr-2">kcal</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {/* Slot Body */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 space-y-2 border-t border-white/[0.04]">
                          {items.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 text-xs">
                              No {slot.label.toLowerCase()} items logged for this date.
                            </div>
                          ) : (
                            items.map((item) => (
                              <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, x: 15 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -15 }}
                                className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl hover:bg-white/[0.04] transition-colors mt-2"
                              >
                                {/* Item info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{item.foodName}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">
                                    {item.servingGrams}g serving
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <span className="text-[9px] font-bold text-accent-pink bg-pink-500/10 px-1.5 py-0.5 rounded">P {item.protein}g</span>
                                    <span className="text-[9px] font-bold text-accent-yellow bg-yellow-500/10 px-1.5 py-0.5 rounded">C {item.carbs}g</span>
                                    <span className="text-[9px] font-bold text-accent-green bg-emerald-500/10 px-1.5 py-0.5 rounded">F {item.fat}g</span>
                                    <span className="text-[9px] font-bold text-accent-blue bg-blue-500/10 px-1.5 py-0.5 rounded">Fb {item.fiber}g</span>
                                  </div>
                                </div>

                                {/* Calorie badge */}
                                <div className="text-right shrink-0 mr-2">
                                  <p className="text-sm font-extrabold text-slate-100">{item.calories}</p>
                                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">kcal</p>
                                </div>

                                {/* Action buttons */}
                                {isToday && (
                                  <div className="flex flex-col gap-1.5 shrink-0">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}
                                      className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors"
                                      title="Edit entry"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDuplicate(item); }}
                                      className="p-1.5 rounded-lg bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal transition-colors"
                                      title="Duplicate entry"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                      title="Delete entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </motion.div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL: Edit Item
         ═══════════════════════════════════════════ */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {editItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setEditItem(null); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 14 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="bg-[#11131a]/90 backdrop-blur-xl border border-white/[0.07] p-6 rounded-2xl max-w-lg w-full shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4 mb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent-teal">Edit Entry</p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white">{editItem.foodName}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditItem(null)}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Serving size */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 ml-1">Quantity (Grams)</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditServing(Math.max(10, editServing - 50))} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={editServing}
                      min="10"
                      max="2000"
                      onChange={(e) => setEditServing(Math.max(1, parseInt(e.target.value) || 0))}
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-center transition-all rounded-xl py-3 text-lg font-bold text-white outline-none"
                    />
                    <button onClick={() => setEditServing(editServing + 50)} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Meal slot selector */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 ml-1">Meal Slot</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setEditMealSlot(slot)}
                        className={`py-2.5 rounded-xl text-xs font-semibold uppercase transition-all duration-300 ${
                          editMealSlot === slot
                            ? 'bg-gradient-to-r from-accent-purple to-accent-teal text-white shadow-md'
                            : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculated preview */}
                <div className="grid grid-cols-5 gap-2 bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl text-center mb-5">
                  {[
                    { label: 'Cal', val: editCalc.calories, unit: 'kcal' },
                    { label: 'Pro', val: editCalc.protein, unit: 'g' },
                    { label: 'Carb', val: editCalc.carbs, unit: 'g' },
                    { label: 'Fat', val: editCalc.fat, unit: 'g' },
                    { label: 'Fib', val: editCalc.fiber, unit: 'g' }
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{m.label}</p>
                      <p className="text-base font-extrabold text-white mt-1">{m.val}</p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase">{m.unit}</p>
                    </div>
                  ))}
                </div>

                {/* Save */}
                <button
                  onClick={handleSaveEdit}
                  className="w-full py-3.5 bg-gradient-to-r from-accent-purple to-accent-teal hover:from-accent-purple/90 hover:to-accent-teal/90 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-accent-purple/20 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" /> Update Entry
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ═══════════════════════════════════════════
          MODAL: Save Template
         ═══════════════════════════════════════════ */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showSaveTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setShowSaveTemplate(false); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 14 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="bg-[#11131a]/90 backdrop-blur-xl border border-white/[0.07] p-6 rounded-2xl max-w-md w-full shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4 mb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent-purple">Meal Template</p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white">Save Template</h2>
                    <p className="mt-1 text-sm text-slate-400">Save a meal slot's items as a reusable template.</p>
                  </div>
                  <button onClick={() => setShowSaveTemplate(false)} className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 ml-1">Template Name</label>
                    <input
                      type="text"
                      value={saveTemplateName}
                      onChange={(e) => setSaveTemplateName(e.target.value)}
                      placeholder="e.g. My Regular Breakfast"
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 ml-1">Select Meal Slot to Save</label>
                    <div className="grid grid-cols-4 gap-2">
                      {MEAL_SLOTS.map((slot) => (
                        <button
                          key={slot.key}
                          onClick={() => setSaveTemplateSlot(slot.key)}
                          className={`py-2.5 rounded-xl text-xs font-semibold uppercase transition-all ${
                            saveTemplateSlot === slot.key
                              ? 'bg-gradient-to-r from-accent-purple to-accent-teal text-white shadow-md'
                              : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 ml-1">
                      {(groupedItems[saveTemplateSlot] || []).length} items in {saveTemplateSlot}
                    </p>
                  </div>

                  <button
                    onClick={handleSaveTemplate}
                    disabled={!saveTemplateName.trim() || (groupedItems[saveTemplateSlot] || []).length === 0}
                    className="w-full py-3.5 bg-gradient-to-r from-accent-purple to-accent-teal hover:from-accent-purple/90 hover:to-accent-teal/90 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-accent-purple/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Bookmark className="w-5 h-5" /> Save Template
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ═══════════════════════════════════════════
          MODAL: Load Template
         ═══════════════════════════════════════════ */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showLoadTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setShowLoadTemplate(false); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 14 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="bg-[#11131a]/90 backdrop-blur-xl border border-white/[0.07] p-6 rounded-2xl max-w-lg w-full shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] max-h-[85vh] overflow-hidden flex flex-col"
              >
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4 mb-5 shrink-0">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent-teal">Templates</p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white">Load Meal Template</h2>
                    <p className="mt-1 text-sm text-slate-400">Apply a saved template to log items instantly.</p>
                  </div>
                  <button onClick={() => setShowLoadTemplate(false)} className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                  {templatesLoading ? (
                    <div className="py-12 text-center text-slate-500 text-xs animate-pulse">Loading templates...</div>
                  ) : templates.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-3 mx-auto">
                        <Bookmark className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-400">No templates saved yet</p>
                      <p className="text-xs text-slate-500 mt-1">Save a meal slot from the tracker to create a template.</p>
                    </div>
                  ) : (
                    templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{tpl.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">
                              {tpl.mealSlot} · {(tpl.items || []).length} items ·{' '}
                              {(tpl.items || []).reduce((s, it) => s + (it.calories || 0), 0)} kcal total
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                            title="Delete template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {(tpl.items || []).map((it, idx) => (
                            <span key={idx} className="text-[9px] font-bold text-slate-300 bg-white/5 border border-white/[0.06] px-2 py-0.5 rounded-full">
                              {it.foodName}
                            </span>
                          ))}
                        </div>

                        {isToday ? (
                          <button
                            onClick={() => handleApplyTemplate(tpl)}
                            className="w-full py-2.5 bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-xs font-bold rounded-xl hover:bg-accent-teal/15 transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Apply to Today
                          </button>
                        ) : (
                          <div className="w-full py-2.5 bg-white/5 border border-white/10 text-slate-500 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
                            <Lock className="w-4 h-4" /> Switch to today to apply
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
