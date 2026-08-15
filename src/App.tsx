import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChessCard, ChessDeck, AuthUser, LocalUser } from "./types";
import {
  getDecks,
  getCards,
  saveDeck,
  deleteDeck,
  saveCard,
  deleteCard,
  saveLocalUser,
  getLocalUser,
  ensureLocalDemoData,
  hashPassword,
  verifyPassword,
  claimDeviceData,
  markDemoDataSeeded,
  GUEST_OWNER
} from "./lib/db";
import {
  auth,
  signUpWithEmailAndPassword,
  signInWithEmailAndPasswordHelper,
  logoutUser,
  getDecksFromFirestore,
  getCardsFromFirestore,
  saveDeckToFirestore,
  saveCardToFirestore,
  deleteDeckFromFirestore,
  deleteCardFromFirestore,
  seedFirestoreDemoData,
  getAccountFlags,
  setAccountFlags,
  uploadDataToAccount
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "./components/Navbar";
import DeckManager from "./components/DeckManager";
import CardList from "./components/CardList";
import CardCreator from "./components/CardCreator";
import StudySession from "./components/StudySession";
import AuthModal from "./components/AuthModal";
import { createId } from "./lib/cards";
import { Loader2, Sparkles, AlertTriangle, CloudUpload, Check } from "lucide-react";

const LOCAL_USER_KEY = "chess_local_user";

/**
 * Which slice of on-device storage a session owns. Guest work and each device
 * account are kept apart, so one cannot read or overwrite the other.
 */
function localOwnerFor(user: AuthUser | null): string {
  return user?.isLocal ? user.uid : GUEST_OWNER;
}

/** A local sandbox session takes priority over any lingering Firebase session. */
function readLocalSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed || typeof parsed.uid !== "string") throw new Error("Malformed session");
    return parsed;
  } catch {
    // Corrupt entry would otherwise throw during boot and blank the whole app.
    try {
      localStorage.removeItem(LOCAL_USER_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [decks, setDecks] = useState<ChessDeck[]>([]);
  const [cards, setCards] = useState<ChessCard[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"decks" | "deck-view" | "creator" | "study">("decks");
  const [editingCard, setEditingCard] = useState<ChessCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Decks/cards sitting in this device's local storage that are not yet in the
  // signed-in account. Surfaced as a one-click "copy into my account" offer.
  const [pendingLocalData, setPendingLocalData] = useState<
    { mode: "upload" | "claim"; decks: ChessDeck[]; cards: ChessCard[] } | null
  >(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState<string | null>(null);

  // Load Decks and Cards (either from Firestore or IndexedDB based on User state)
  const loadData = useCallback(async (currentUser: AuthUser | null) => {
    try {
      if (currentUser && !currentUser.isLocal) {
        // Load from Firestore
        let dbDecks = await getDecksFromFirestore(currentUser.uid);
        let dbCards = await getCardsFromFirestore(currentUser.uid);

        // Whatever exists on this device but not yet in the account.
        let localDecks: ChessDeck[] = [];
        let localCards: ChessCard[] = [];
        try {
          localDecks = await getDecks(GUEST_OWNER);
          localCards = await getCards(GUEST_OWNER);
        } catch (err) {
          console.warn("Could not inspect device data:", err);
        }

        // The "already seeded" marker lives on the account, not the device, so
        // signing in on a second phone never re-creates the sample deck.
        const flags = await getAccountFlags(currentUser.uid);
        if (dbDecks.length === 0 && !flags.demoSeeded) {
          // Skip the sample deck when this device already has decks waiting to
          // be copied up, otherwise the account ends up with two copies of it.
          if (localDecks.length === 0) {
            await seedFirestoreDemoData(currentUser.uid);
            dbDecks = await getDecksFromFirestore(currentUser.uid);
            dbCards = await getCardsFromFirestore(currentUser.uid);
          }
        }
        if (!flags.demoSeeded) {
          await setAccountFlags(currentUser.uid, { demoSeeded: true });
        }

        setDecks(dbDecks);
        setCards(dbCards);

        // Anything created before signing in is stranded on this device.
        // Offer to lift it into the account rather than silently ignoring it.
        const cloudDeckIds = new Set(dbDecks.map((d) => d.id));
        const unsynced = localDecks.filter((d) => !cloudDeckIds.has(d.id));
        if (unsynced.length > 0) {
          const unsyncedIds = new Set(unsynced.map((d) => d.id));
          setPendingLocalData({
            mode: "upload",
            decks: unsynced,
            cards: localCards.filter((c) => unsyncedIds.has(c.deckId)),
          });
        } else {
          setPendingLocalData(null);
        }
      } else {
        // Load from local IndexedDB, scoped to this session's owner
        const ownerId = localOwnerFor(currentUser);

        // A device account can adopt work done earlier in guest mode.
        const guestDecks = currentUser?.isLocal ? await getDecks(GUEST_OWNER) : [];
        if (guestDecks.length > 0) {
          // Don't also seed a sample deck for an account that is about to
          // adopt one, or the same deck shows up twice.
          markDemoDataSeeded(`local:${ownerId}`);
        }

        await ensureLocalDemoData(ownerId);
        const dbDecks = await getDecks(ownerId);
        const dbCards = await getCards(ownerId);
        setDecks(dbDecks);
        setCards(dbCards);

        if (guestDecks.length > 0) {
          setPendingLocalData({
            mode: "claim",
            decks: guestDecks,
            cards: await getCards(GUEST_OWNER),
          });
        } else {
          setPendingLocalData(null);
        }
      }
    } catch (err) {
      console.error("Data retrieval failed:", err);
      setErrorMessage("Could not load your decks. Check your connection and refresh the page.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Monitor auth state changes
  useEffect(() => {
    const savedLocalUser = readLocalSession();
    if (savedLocalUser) {
      setUser(savedLocalUser);
      setIsLoading(true);
      loadData(savedLocalUser);
    }

    // The listener is always registered. Previously an early return skipped it
    // whenever a local session existed, so signing in with a real account after
    // that never updated the UI.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // An active local sandbox session wins over Firebase auth state.
      if (readLocalSession()) return;

      if (currentUser) {
        const mappedUser: AuthUser = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
        };
        setUser(mappedUser);
        setIsLoading(true);
        loadData(mappedUser);
      } else {
        setUser(null);
        setIsLoading(true);
        loadData(null);
      }
    });
    return () => unsubscribe();
  }, [loadData]);

  // Auth Action Handlers
  const handleSignUp = async (email: string, password: string, displayName: string) => {
    try {
      setIsLoading(true);
      await signUpWithEmailAndPassword(email, password, displayName);
    } catch (err: any) {
      console.warn("Firebase sign up failed, trying local fallback:", err);
      // Check if it's a domain restriction, operation-not-allowed, or offline
      if (
        err.code === "auth/operation-not-allowed" ||
        err.code === "auth/network-request-failed" ||
        err.message?.includes("fetch")
      ) {
        const localUid = "local-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        const newLocalUser: LocalUser = {
          uid: localUid,
          email,
          passwordHash: await hashPassword(password),
          displayName
        };
        await saveLocalUser(newLocalUser);

        const sessionUser: AuthUser = {
          uid: localUid,
          email,
          displayName,
          photoURL: null,
          isLocal: true
        };
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(sessionUser));
        setUser(sessionUser);
        loadData(sessionUser);
      } else {
        // Nothing else will clear the spinner on this path.
        setIsLoading(false);
        throw err;
      }
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    const lockoutKey = `login_lockout_${email}`;
    const attemptsKey = `login_attempts_${email}`;

    const lockoutUntilStr = localStorage.getItem(lockoutKey);
    if (lockoutUntilStr) {
      const lockoutUntil = parseInt(lockoutUntilStr, 10);
      if (lockoutUntil > Date.now()) {
        const remainingSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
        throw new Error(`Too many failed attempts. Account is locked. Please try again in ${remainingSeconds} seconds.`);
      } else {
        localStorage.removeItem(lockoutKey);
      }
    }

    try {
      setIsLoading(true);
      await signInWithEmailAndPasswordHelper(email, password);
      // Success! Clear attempt counters
      localStorage.removeItem(attemptsKey);
      localStorage.removeItem(lockoutKey);
    } catch (err: any) {
      console.warn("Firebase sign in failed, trying local fallback:", err);

      // If it failed because of Firebase rate limiting
      if (err.code === "auth/too-many-requests") {
        setIsLoading(false);
        throw new Error("Too many failed attempts. Firebase has locked this account. Please try again later.");
      }

      if (
        err.code === "auth/operation-not-allowed" ||
        err.code === "auth/network-request-failed" ||
        err.code === "auth/invalid-credential" ||
        err.message?.includes("fetch")
      ) {
        // Check if there is a matching local user in IndexedDB
        const localUser = await getLocalUser(email);
        if (localUser && (await verifyPassword(password, localUser.passwordHash))) {
          // Upgrade any legacy plain-text record to a digest.
          if (localUser.passwordHash === password) {
            await saveLocalUser({ ...localUser, passwordHash: await hashPassword(password) });
          }

          const sessionUser: AuthUser = {
            uid: localUser.uid,
            email: localUser.email,
            displayName: localUser.displayName,
            photoURL: null,
            isLocal: true
          };
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(sessionUser));
          setUser(sessionUser);
          loadData(sessionUser);

          // Success! Clear attempt counters
          localStorage.removeItem(attemptsKey);
          localStorage.removeItem(lockoutKey);
          return;
        }
      }

      // If we reach here, BOTH Firebase and Local fallback failed.
      // The spinner has to come down before the error is surfaced.
      setIsLoading(false);

      // Increment attempt counter.
      const currentAttempts = parseInt(localStorage.getItem(attemptsKey) || "0", 10) + 1;
      if (currentAttempts >= 5) {
        const lockTime = Date.now() + 30 * 1000; // 30 seconds lock out
        localStorage.setItem(lockoutKey, lockTime.toString());
        localStorage.setItem(attemptsKey, "0");
        throw new Error("Too many failed attempts. Account is locked for 30 seconds.");
      } else {
        localStorage.setItem(attemptsKey, currentAttempts.toString());
        // Translate error code for AuthModal
        if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          throw new Error("auth/wrong-password");
        }
        throw err;
      }
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      localStorage.removeItem(LOCAL_USER_KEY);
      setActiveView("decks");
      setSelectedDeckId(null);
      // These belong to the session that is ending.
      setMigrationDone(null);
      setPendingLocalData(null);
      setErrorMessage(null);
      if (user?.isLocal) {
        setUser(null);
        loadData(null);
      } else {
        await logoutUser();
      }
    } catch (err) {
      console.error("Logout failed:", err);
      setIsLoading(false);
    }
  };

  /** Every write path shares this wrapper so failures surface instead of
   *  becoming unhandled promise rejections. */
  const runWrite = async (action: () => Promise<void>, failureMessage: string): Promise<boolean> => {
    try {
      setErrorMessage(null);
      await action();
      return true;
    } catch (err) {
      console.error(failureMessage, err);
      setErrorMessage(failureMessage);
      return false;
    }
  };

  /**
   * Bring device-only work into the signed-in account. For a cloud account the
   * decks are uploaded to Firestore (the device copy stays put as a backup);
   * for a device account the guest decks are handed over to it outright.
   */
  const handleMigrateLocalData = async () => {
    if (!user || !pendingLocalData) return;
    setIsMigrating(true);
    const ok = await runWrite(async () => {
      const moved =
        pendingLocalData.mode === "upload"
          ? await uploadDataToAccount(pendingLocalData.decks, pendingLocalData.cards, user.uid)
          : await claimDeviceData(GUEST_OWNER, user.uid);
      const destination = pendingLocalData.mode === "upload" ? "your account" : "this account";
      setMigrationDone(
        `${moved.decks} ${moved.decks === 1 ? "deck" : "decks"} and ${moved.cards} ${moved.cards === 1 ? "card" : "cards"} are now saved to ${destination}.`
      );
    }, "Could not move your device data into this account. Please try again.");
    setIsMigrating(false);
    if (ok) {
      setPendingLocalData(null);
      await loadData(user);
    }
  };

  // Handlers for Decks
  const handleSelectDeck = (deckId: string) => {
    setSelectedDeckId(deckId);
    setActiveView("deck-view");
  };

  const handleCreateDeck = async (name: string, description: string) => {
    const newDeck: ChessDeck = {
      id: createId("deck"),
      name,
      description,
      createdAt: Date.now(),
    };

    await runWrite(async () => {
      if (user && !user.isLocal) {
        await saveDeckToFirestore(newDeck, user.uid);
      } else {
        await saveDeck(newDeck, localOwnerFor(user));
      }
    }, "Could not create that deck. Please try again.");

    await loadData(user); // Reload stats and lists
  };

  const handleDeleteDeck = async (deckId: string) => {
    await runWrite(async () => {
      if (user && !user.isLocal) {
        await deleteDeckFromFirestore(deckId, user.uid);
      } else {
        await deleteDeck(deckId);
      }
    }, "Could not delete that deck. Please try again.");

    if (selectedDeckId === deckId) {
      setSelectedDeckId(null);
      setActiveView("decks");
    }
    await loadData(user);
  };

  // Handlers for Cards
  const handleSaveCard = async (
    cardDraft: Omit<ChessCard, "id" | "createdAt" | "reviewCount" | "lastReviewedAt" | "mastered">,
    isEditId?: string
  ) => {
    const existing = isEditId ? cards.find((c) => c.id === isEditId) : undefined;
    const cardToSave: ChessCard = existing
      ? { ...existing, ...cardDraft }
      : {
          ...cardDraft,
          id: createId("card"),
          createdAt: Date.now(),
          reviewCount: 0,
          lastReviewedAt: null,
          mastered: false,
        };

    const saved = await runWrite(async () => {
      if (user && !user.isLocal) {
        await saveCardToFirestore(cardToSave, user.uid);
      } else {
        await saveCard(cardToSave, localOwnerFor(user));
      }
    }, "Could not save that card. Large pictures may exceed the storage limit — try removing one.");

    await loadData(user);
    if (saved) {
      setEditingCard(null);
      setActiveView("deck-view"); // Return to the deck's list view
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    await runWrite(async () => {
      if (user && !user.isLocal) {
        await deleteCardFromFirestore(cardId);
      } else {
        await deleteCard(cardId);
      }
    }, "Could not delete that card. Please try again.");
    await loadData(user);
  };

  const handleUpdateCardProgress = async (cardId: string, mastered: boolean) => {
    const cardToUpdate = cards.find((c) => c.id === cardId);
    if (!cardToUpdate) return;

    const updatedCard: ChessCard = {
      ...cardToUpdate,
      mastered,
      reviewCount: cardToUpdate.reviewCount + 1,
      lastReviewedAt: Date.now(),
    };
    await runWrite(async () => {
      if (user && !user.isLocal) {
        await saveCardToFirestore(updatedCard, user.uid);
      } else {
        await saveCard(updatedCard, localOwnerFor(user));
      }
    }, "Could not record that review. Your progress may not be saved.");
    await loadData(user);
  };

  const handleToggleMastered = async (cardId: string) => {
    const cardToUpdate = cards.find((c) => c.id === cardId);
    if (!cardToUpdate) return;

    const updatedCard: ChessCard = {
      ...cardToUpdate,
      mastered: !cardToUpdate.mastered,
    };
    await runWrite(async () => {
      if (user && !user.isLocal) {
        await saveCardToFirestore(updatedCard, user.uid);
      } else {
        await saveCard(updatedCard, localOwnerFor(user));
      }
    }, "Could not update that card. Please try again.");
    await loadData(user);
  };

  // Import JSON Backup handler
  const handleImportData = async (jsonData: string) => {
    try {
      const parsed = JSON.parse(jsonData);
      const importedDecks: ChessDeck[] = parsed.decks || [];
      const importedCards: ChessCard[] = parsed.cards || [];

      // Save each imported deck and card to DB
      for (const deck of importedDecks) {
        if (user && !user.isLocal) {
          await saveDeckToFirestore(deck, user.uid);
        } else {
          await saveDeck(deck, localOwnerFor(user));
        }
      }
      for (const card of importedCards) {
        if (user && !user.isLocal) {
          await saveCardToFirestore(card, user.uid);
        } else {
          await saveCard(card, localOwnerFor(user));
        }
      }

      await loadData(user);
    } catch (err) {
      console.error("Backup import failed:", err);
      setErrorMessage("Failed to import that backup. Ensure the JSON format is correct.");
    }
  };

  // Navigation Helpers
  const selectedDeck = decks.find((d) => d.id === selectedDeckId);
  // Memoised so StudySession does not see a brand new array on every render.
  const deckCards = useMemo(
    () => cards.filter((c) => c.deckId === selectedDeckId),
    [cards, selectedDeckId]
  );
  const masteredCount = cards.filter((c) => c.mastered).length;

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans flex flex-col antialiased">
      <Navbar
        totalDecks={decks.length}
        totalCards={cards.length}
        masteredCount={masteredCount}
        user={user}
        onLogin={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
            <Loader2 className="w-10 h-10 text-slate-700 animate-spin" />
            <p className="text-sm font-semibold text-slate-500 font-sans animate-pulse">
              Initialising database &amp; loading chess flashcards...
            </p>
          </div>
        ) : (
          <div className="animate-fade-in transition-all">

            {/* Write / load failure banner */}
            {errorMessage && (
              <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 flex items-start justify-between gap-3 text-sm shadow-sm">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="font-medium leading-relaxed">{errorMessage}</p>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400 hover:text-rose-700 font-semibold px-2 py-0.5 rounded transition cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Offer to lift device-only data into the signed-in account */}
            {user && pendingLocalData && (
              <div className="mb-6 bg-sky-50 border border-sky-200 text-sky-950 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="bg-sky-500 text-white p-2 rounded-xl shrink-0">
                    <CloudUpload className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-display font-extrabold text-sm">
                      Decks found on this device
                    </h4>
                    <p className="text-xs text-sky-900/80 mt-0.5 leading-relaxed">
                      {pendingLocalData.decks.length} {pendingLocalData.decks.length === 1 ? "deck" : "decks"} and{" "}
                      {pendingLocalData.cards.length} {pendingLocalData.cards.length === 1 ? "card" : "cards"} were
                      created before you signed in.{" "}
                      {pendingLocalData.mode === "upload"
                        ? "They are stored only on this device. Copy them into your account to reach them from your phone and anywhere else."
                        : "Move them into this account so they stay with you when you sign in again."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setPendingLocalData(null)}
                    className="text-sky-700 hover:text-sky-900 text-xs font-semibold px-3 py-2.5 rounded-xl hover:bg-sky-100/70 transition cursor-pointer"
                  >
                    Not now
                  </button>
                  <button
                    onClick={handleMigrateLocalData}
                    disabled={isMigrating}
                    className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 disabled:cursor-not-allowed"
                  >
                    {isMigrating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Copying...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-3.5 h-3.5" />
                        <span>{pendingLocalData.mode === "upload" ? "Copy to my account" : "Move to this account"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Migration confirmation */}
            {migrationDone && (
              <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-start justify-between gap-3 text-sm shadow-sm">
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="font-medium leading-relaxed">{migrationDone}</p>
                </div>
                <button
                  onClick={() => setMigrationDone(null)}
                  className="text-emerald-500 hover:text-emerald-800 font-semibold px-2 py-0.5 rounded transition cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Sync Alert Banner */}
            {!user ? (
              <div className="mb-6 bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl shadow-slate-950/15">
                <div className="flex gap-3">
                  <div className="bg-amber-400 text-slate-950 p-2 rounded-xl mt-0.5 sm:mt-0 shrink-0">
                    <Sparkles className="w-4 h-4 text-slate-950" />
                  </div>
                  <div>
                    <h4 className="font-display font-extrabold text-sm text-slate-100">Guest Mode (Offline Only)</h4>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Your chess flashcards are stored locally on this device. Sign in or register a free account to enable cloud sync, preserve your mastery progress, and access your decks from anywhere.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl transition shrink-0 cursor-pointer w-full sm:w-auto text-center"
                >
                  Sign In / Register
                </button>
              </div>
            ) : user.isLocal ? (
              <div className="mb-6 bg-amber-50/60 border border-amber-100/85 text-amber-900 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <p className="font-medium text-slate-600">
                    <strong className="text-amber-900">This account is on this device only.</strong> Signed in as{" "}
                    <strong className="text-slate-800">{user.displayName || user.email}</strong>. Cloud sign-in is
                    unavailable, so these decks will <strong className="text-amber-900">not</strong> appear on your phone
                    or any other device. Enable Email/Password sign-in in the Firebase console to turn on account sync.
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-slate-600 font-semibold px-2 py-1 hover:bg-slate-100/50 rounded transition cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="mb-6 bg-emerald-50/60 border border-emerald-100/85 text-emerald-900 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <p className="font-medium text-slate-600">
                    Cloud Sync Active: Signed in as <strong className="text-slate-800">{user.email}</strong>. Decks and cards are fully synchronised with your account.
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-slate-600 font-semibold px-2 py-1 hover:bg-slate-100/50 rounded transition cursor-pointer"
                >
                  Logout
                </button>
              </div>
            )}

            {activeView === "decks" && (
              <DeckManager
                decks={decks}
                cards={cards}
                onSelectDeck={handleSelectDeck}
                onCreateDeck={handleCreateDeck}
                onDeleteDeck={handleDeleteDeck}
                onImportData={handleImportData}
              />
            )}

            {activeView === "deck-view" && selectedDeck && (
              <CardList
                deck={selectedDeck}
                cards={deckCards}
                onBack={() => setActiveView("decks")}
                onAddCard={() => {
                  setEditingCard(null);
                  setActiveView("creator");
                }}
                onStudy={() => setActiveView("study")}
                onDeleteCard={handleDeleteCard}
                onToggleMastered={handleToggleMastered}
                onEditCard={(card) => {
                  setEditingCard(card);
                  setActiveView("creator");
                }}
              />
            )}

            {activeView === "creator" && selectedDeckId && (
              <CardCreator
                deckId={selectedDeckId}
                cardToEdit={editingCard || undefined}
                onSave={handleSaveCard}
                onCancel={() => {
                  setEditingCard(null);
                  setActiveView("deck-view");
                }}
              />
            )}

            {activeView === "study" && selectedDeck && (
              <StudySession
                deck={selectedDeck}
                cards={deckCards}
                onClose={() => setActiveView("deck-view")}
                onUpdateCardProgress={handleUpdateCardProgress}
              />
            )}
          </div>
        )}
      </main>

      {/* Humble craft line */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-400 font-sans">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="flex items-center gap-1">
            <span>Crafted in AI Studio</span>
            <span>•</span>
            <span className="text-slate-500 font-medium">Chess Study Deck Manager</span>
          </p>
          <p className="text-[11px] text-slate-400">
            Powered by Gemini Multimodal Analysis &amp; Google Cloud Firestore Sync
          </p>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSignUp={handleSignUp}
        onSignIn={handleSignIn}
      />
    </div>
  );
}
