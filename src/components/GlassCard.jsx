import React from 'react';
import { motion } from 'framer-motion';

export default function GlassCard({ children, className = "", hover = true, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.33, 1, 0.68, 1] }}
      whileHover={hover ? { y: -4, transition: { type: "spring", stiffness: 300, damping: 15 } } : {}}
      className={`relative overflow-hidden bg-obsidian-950/40 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 shadow-glass ${className}`}
    >
      {/* Background soft subtle inner gradient reflection */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      {children}
    </motion.div>
  );
}
