import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { Mail, Lock, LogIn, Chrome, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-obsidian-900 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-accent-purple/10 blur-[100px] -top-20 -left-20 animate-pulse" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-accent-teal/10 blur-[100px] -bottom-20 -right-20 animate-pulse" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
        className="w-full max-w-md bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8 rounded-3xl shadow-glass z-10 relative"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-teal flex items-center justify-center shadow-lg shadow-accent-purple/20 mb-3">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2C6.5 6 4 10.5 4 14a8 8 0 0 0 16 0c0-3.5-2.5-8-8-12Z"/>
              <path d="M12 22c-2.2 0-4-1.8-4-4 0-2 1.5-4.5 4-7 2.5 2.5 4 5 4 7 0 2.2-1.8 4-4 4Z" opacity="0.6"/>
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Welcome Back</h2>
          <p className="text-sm text-slate-400 mt-1">Log in to track your daily progress</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all duration-300 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all duration-300 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-6 bg-gradient-to-r from-accent-purple to-accent-teal hover:from-accent-purple/90 hover:to-accent-teal/90 text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-md shadow-accent-purple/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Logging In...' : 'Log In'}
          </button>
        </form>

        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.06]" /></div>
          <span className="relative z-10 px-3 bg-obsidian-950/80 text-[10px] text-slate-500 font-bold uppercase tracking-widest">or</span>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-white font-semibold rounded-xl text-sm transition-all duration-300 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99]"
        >
          <Chrome className="w-4 h-4 text-accent-teal" />
          Continue with Google
        </button>

        <p className="text-center text-xs text-slate-400 mt-8">
          Don't have an account?{' '}
          <Link to="/signup" className="text-accent-teal hover:text-accent-teal/80 font-bold underline">
            Sign Up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
