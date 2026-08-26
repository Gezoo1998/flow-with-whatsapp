"use client";

import { useState } from "react";
import { store } from "@/lib/store";
import { GraduationCap, Lock, ArrowLeftRight, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AuthScreen() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleKeyPress = (num: string) => {
    setError("");
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      
      // Auto submit on 4 digits
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setError("");
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setError("");
    setPin("");
  };

  const submitPin = async (enteredPin: string) => {
    try {
      const apiRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await apiRes.json();
      if (apiRes.ok && data.success) {
        store.setAuthUser(data.user.role, data.user.id, data.user.name);
        setSuccess(data.message);
      } else {
        setError(data.message || "رمز الدخول غير صحيح");
        setPin("");
      }
    } catch (err) {
      setError("تعذر الاتصال بخادم التوثيق. يرجى التحقق من اتصال الشبكة وإعادة المحاولة.");
      setPin("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden text-white" id="auth_container">
      {/* Background radial soft light blur */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-700/60 shadow-2xl flex flex-col items-center relative z-10" id="login_card">
        {/* Upper Logo Indicator */}
        <motion.div 
          className="w-16 h-16 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-500/25 relative"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="w-8 h-8 text-white animate-pulse"
          >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" strokeDasharray="3 2" />
            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor" className="text-white/80" />
            <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2.5" />
          </svg>
        </motion.div>

        <h1 className="text-2xl font-black text-center mb-1 text-slate-100 uppercase tracking-wide font-mono" id="login_title">
          Center<span className="text-blue-500">Flow</span>
        </h1>
        <p className="text-slate-400 text-xs mb-6 text-center font-cairo">منصة الإدارة السحابية المتكاملة للمراكز التعليمية</p>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-3 mb-6" dir="ltr" id="pin_dots_row">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                pin.length > idx
                  ? "bg-blue-500 border-blue-500 scale-110 shadow-md shadow-blue-500/50"
                  : "bg-slate-700 border-slate-600"
              }`}
            />
          ))}
        </div>

        {/* Error or Success Toast */}
        <div className="h-8 mb-2 flex items-center justify-center text-center w-full">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                key="error"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-xs flex items-center gap-1 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20"
                id="error_msg"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-green-400 text-xs flex items-center gap-1 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20"
                id="success_msg"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Touch Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full mb-6" dir="ltr" id="keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="h-12 text-lg font-bold bg-slate-700/50 hover:bg-slate-700 text-slate-100 rounded-xl transition active:scale-95 flex items-center justify-center border border-slate-700/30 touch-target"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-12 text-sm font-semibold bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded-xl transition active:scale-95 flex items-center justify-center border border-red-900/10 touch-target"
          >
            مسح
          </button>
          <button
            onClick={() => handleKeyPress("0")}
            className="h-12 text-lg font-bold bg-slate-700/50 hover:bg-slate-700 text-slate-100 rounded-xl transition active:scale-95 flex items-center justify-center border border-slate-700/30 touch-target"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-12 text-sm font-bold bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-xl transition active:scale-95 flex items-center justify-center border border-slate-700/30 touch-target"
          >
            ⌫
          </button>
        </div>

        {/* Secured for production */}
      </div>
    </div>
  );
}
