import React, { useState } from "react";
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, Loader2, X, Sparkles } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: (email: string, password: string, displayName: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
}

export default function AuthModal({ isOpen, onClose, onSignUp, onSignIn }: AuthModalProps) {
  const [isSignUpTab, setIsSignUpTab] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic Validation
    if (!email || !password) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (isSignUpTab && !displayName) {
      setErrorMessage("Please enter a display name.");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUpTab) {
        await onSignUp(email, password, displayName);
      } else {
        await onSignIn(email, password);
      }
      // Reset form and close
      setEmail("");
      setPassword("");
      setDisplayName("");
      onClose();
    } catch (err: any) {
      console.error("Authentication action failed:", err);
      // Map Firebase errors to user-friendly messages
      let msg = err.message || "An unexpected error occurred.";
      if (err.code) {
        if (err.code === "auth/invalid-email") msg = "Invalid email format.";
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          msg = "Incorrect email or password.";
        }
        if (err.code === "auth/email-already-in-use") {
          msg = "An account with this email already exists.";
        }
        if (err.code === "auth/weak-password") {
          msg = "Password is too weak. Please use a stronger password.";
        }
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white/95 border border-slate-200/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col relative transition-all duration-300 transform scale-100 max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex flex-col items-center">
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg shadow-slate-900/10 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-amber-100 animate-pulse"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="font-display font-black text-xl text-slate-900 tracking-tight">
            {isSignUpTab ? "Create Your Chess Account" : "Welcome Back"}
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {isSignUpTab ? "Join now to sync your tactical training cards" : "Sign in to access your saved chess decks"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-3">
          <button
            onClick={() => {
              setIsSignUpTab(false);
              setErrorMessage(null);
            }}
            className={`flex-1 text-center py-2.5 font-bold text-sm border-b-2 transition duration-200 cursor-pointer ${
              !isSignUpTab
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setIsSignUpTab(true);
              setErrorMessage(null);
            }}
            className={`flex-1 text-center py-2.5 font-bold text-sm border-b-2 transition duration-200 cursor-pointer ${
              isSignUpTab
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="flex gap-2.5 items-start bg-rose-50 border border-rose-100 text-rose-900 p-3.5 rounded-2xl text-xs font-semibold leading-relaxed animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          {isSignUpTab && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Garry Kasparov"
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-3 pl-11 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-slate-950/10 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{isSignUpTab ? "Create Account" : "Sign In"}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
