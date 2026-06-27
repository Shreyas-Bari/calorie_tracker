import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import FoodSearch from './pages/FoodSearch';
import Goals from './pages/Goals';
import Analytics from './pages/Analytics';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currUser) => {
      setUser(currUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute w-[300px] h-[300px] rounded-full bg-accent-purple/10 blur-[100px] -top-20 animate-pulse" />
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-teal flex items-center justify-center shadow-lg shadow-accent-purple/20 animate-pulse mb-4">
          <svg className="w-8 h-8 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="0"></circle>
          </svg>
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest animate-pulse">Loading NutriTrack...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/" /> : <SignUp />} />

        <Route
          path="/*"
          element={
            user ? (
              <div className="min-h-screen bg-obsidian-900 text-slate-100 flex relative">
                {/* Background ambient orbs */}
                <div className="bg-orb bg-accent-purple/10 w-[500px] h-[500px] top-[-10%] right-[-10%] animate-float-1" />
                <div className="bg-orb bg-accent-teal/10 w-[400px] h-[400px] bottom-[-10%] left-[-10%] animate-float-2" />
                <div className="bg-orb bg-accent-pink/5 w-[300px] h-[300px] top-[40%] left-[30%] animate-pulse" />

                <Sidebar user={user} />
                
                <main className="flex-1 ml-[260px] p-8 min-h-screen relative z-10">
                  <Routes>
                    <Route path="/" element={<Dashboard user={user} />} />
                    <Route path="/search" element={<FoodSearch user={user} />} />
                    <Route path="/goals" element={<Goals user={user} />} />
                    <Route path="/analytics" element={<Analytics user={user} />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </main>
              </div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
