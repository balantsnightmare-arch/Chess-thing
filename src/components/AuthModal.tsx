import React, { useEffect, useState } from "react";
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, Loader2, X, Sparkles, CloudUpload } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: (email: string, password: string, displayName: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  /** Sign in through the Google popup. Omitted if the provider is unused. */
  onGoogleSignIn?: () => Promise<void>;
  /** Prefilled address when converting an existing device-only account. */
  initialEmail?: string;
  initialDisplayName?: string;
  /** Open straight on the Register tab. */
  startOnRegister?: boolean;
  /** Explain that this sign-up is specifically to move off a device-only account. */
  cloudUpgradeNotice?: boolean;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSignUp,
  onSignIn,
  onGoogleSignIn,
  initialEmail = "",
  initialDisplayName = "",
  startOnRegister = false,
  cloudUpgradeNotice = false,
}: AuthModalProps) {
  const [isSignUpTab, setIsSignUpTab] = useState(startOnRegister);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Re-apply the incoming defaults each time the dialog is opened, since the
  // component keeps its state between openings.
  useEffect(() => {
    if (!isOpen) return;
    setIsSignUpTab(startOnRegister);
    setEmail(initialEmail);
    setDisplayName(initialDisplayName);
    setPassword("");
    setErrorMessage(null);
  }, [isOpen, startOnRegister, initialEmail, initialDisplayName]);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    if (!onGoogleSignIn) return;
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      await onGoogleSignIn();
      onClose();
    } catch (err: any) {
      console.error("Google sign-in failed:", err);
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        // The user backed out on purpose; nothing to report.
      } else if (err.code === "auth/unauthorized-domain") {
        setErrorMessage(
          "This domain is not authorised for Google sign-in. Add it under Authentication -> Settings -> Authorized domains in the Firebase console."
        );
      } else if (err.code === "auth/popup-blocked") {
        setErrorMessage("Your browser blocked the sign-in popup. Allow popups for this site and try again.");
      } else {
        setErrorMessage(err.message || "Google sign-in failed. Please try again.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

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
          {cloudUpgradeNotice && (
            <div className="flex gap-2.5 items-start bg-sky-50 border border-sky-200 text-sky-950 p-3.5 rounded-2xl text-xs leading-relaxed">
              <CloudUpload className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <p>
                Registering here creates a <strong>real cloud account</strong>. Your existing decks are kept on this
                device and you will be offered to copy them up once you are signed in.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="flex gap-2.5 items-start bg-rose-50 border border-rose-100 text-rose-900 p-3.5 rounded-2xl text-xs font-semibold leading-relaxed animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          {onGoogleSignIn && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isLoading || isGoogleLoading}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-2xl text-sm transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.1 36.5 44 31 44 24c0-1.3-.1-2.6-.4-3.9z" />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 py-0.5">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">or use email</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            </>
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
