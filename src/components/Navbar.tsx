import React from "react";
import { BookOpen, Trophy, Award, LogIn, LogOut, Sparkles } from "lucide-react";
import { AuthUser } from "../types";

interface NavbarProps {
  totalDecks: number;
  totalCards: number;
  masteredCount: number;
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Navbar({ 
  totalDecks, 
  totalCards, 
  masteredCount,
  user,
  onLogin,
  onLogout
}: NavbarProps) {
  const masteryRate = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  return (
    <header className="border-b border-slate-200 bg-white/85 backdrop-blur-md sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg shadow-slate-900/10 flex items-center justify-center">
            {/* Elegant simplified chess rook and bishop fusion icon */}
            <svg
              className="w-5 h-5 text-amber-100"
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
          <div>
            <h1 id="app-title" className="font-display font-bold text-lg sm:text-xl text-slate-900 tracking-tight flex items-center gap-1.5">
              Study Cards <span className="text-[10px] sm:text-xs bg-amber-100 text-amber-800 font-sans font-medium px-2 py-0.5 rounded-full">Cloud</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 font-sans">Build and review your own flashcards</p>
          </div>
        </div>

        {/* Right Container: Stats & Auth */}
        <div className="flex items-center space-x-4 sm:space-x-6">
          {/* Stats Summary (Hidden on tiny screens) */}
          <div className="hidden md:flex items-center space-x-3 sm:space-x-4 text-sm">
            <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 font-medium text-xs sm:text-sm">
                Decks: <strong className="text-slate-900 font-bold">{totalDecks}</strong>
              </span>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-slate-600 font-medium text-xs sm:text-sm">
                Cards: <strong className="text-slate-900 font-bold">{totalCards}</strong>
              </span>
            </div>

            <div className="flex items-center space-x-2 bg-emerald-50/70 border border-emerald-100 px-2.5 py-1.5 rounded-lg">
              <div className="flex items-center space-x-1 text-emerald-700">
                <Award className="w-3.5 h-3.5" />
                <span className="font-semibold text-[10px] uppercase tracking-wider hidden lg:inline">Mastered</span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-emerald-800 font-sans">
                <span className="font-bold">{masteredCount}</span>
                <span className="text-emerald-400">/</span>
                <span className="text-emerald-600">{totalCards}</span>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-1 rounded text-[9px] ml-0.5">
                  {masteryRate}%
                </span>
              </div>
            </div>
          </div>

          {/* User Authentication Panel */}
          <div className="flex items-center pl-3 sm:pl-4 border-l border-slate-200">
            {user ? (
              <div className="flex items-center space-x-2.5">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || "User"} 
                    className="w-8 h-8 rounded-full border border-slate-300 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-100 flex items-center justify-center font-bold text-sm">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : "U")}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 line-clamp-1 leading-tight">{user.displayName || "Signed in"}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-1">{user.email}</p>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="flex items-center space-x-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 px-3.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer shadow-sm border border-transparent"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Register</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
