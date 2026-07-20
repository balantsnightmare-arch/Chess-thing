import React, { useState, useEffect } from "react";
import { ChessCard, ChessDeck, AuthUser, LocalUser } from "./types";
import { 
  getDecks, 
  getCards, 
  saveDeck, 
  deleteDeck, 
  saveCard, 
  deleteCard, 
  initDB,
  saveLocalUser,
  getLocalUser
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
  seedFirestoreDemoData
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "./components/Navbar";
import DeckManager from "./components/DeckManager";
import CardList from "./components/CardList";
import CardCreator from "./components/CardCreator";
import StudySession from "./components/StudySession";
import AuthModal from "./components/AuthModal";
import { Loader2, Sparkles, Layers } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [decks, setDecks] = useState<ChessDeck[]>([]);
  const [cards, setCards] = useState<ChessCard[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"decks" | "deck-view" | "creator" | "study">("decks");
  const [editingCard, setEditingCard] = useState<ChessCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load Decks and Cards (either from Firestore or IndexedDB based on User state)
  const loadData = async (currentUser: AuthUser | null = user) => {
    try {
      if (currentUser && !currentUser.isLocal) {
        // Load from Firestore
        let dbDecks = await getDecksFromFirestore(currentUser.uid);
        let dbCards = await getCardsFromFirestore(currentUser.uid);
        
        // If user has no decks in firestore, seed the default demo data
        if (dbDecks.length === 0) {
          await seedFirestoreDemoData(currentUser.uid);
          dbDecks = await getDecksFromFirestore(currentUser.uid);
          dbCards = await getCardsFromFirestore(currentUser.uid);
        }
        
        setDecks(dbDecks);
        setCards(dbCards);
      } else {
        // Load from local IndexedDB
        const dbDecks = await getDecks();
        const dbCards = await getCards();
        setDecks(dbDecks);
        setCards(dbCards);
      }
    } catch (err) {
      console.error("Data retrieval failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Monitor auth state changes
  useEffect(() => {
    // Check if there is a local user session stored in localStorage first
    const savedLocalUser = localStorage.getItem("chess_local_user");
    if (savedLocalUser) {
      const parsed = JSON.parse(savedLocalUser) as AuthUser;
      setUser(parsed);
      setIsLoading(true);
      loadData(parsed);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
  }, []);

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
          passwordHash: password,
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
        localStorage.setItem("chess_local_user", JSON.stringify(sessionUser));
        setUser(sessionUser);
        loadData(sessionUser);
      } else {
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
        if (localUser && localUser.passwordHash === password) {
          const sessionUser: AuthUser = {
            uid: localUser.uid,
            email: localUser.email,
            displayName: localUser.displayName,
            photoURL: null,
            isLocal: true
          };
          localStorage.setItem("chess_local_user", JSON.stringify(sessionUser));
          setUser(sessionUser);
          loadData(sessionUser);
          
          // Success! Clear attempt counters
          localStorage.removeItem(attemptsKey);
          localStorage.removeItem(lockoutKey);
          return;
        }
      }

      // If we reach here, BOTH Firebase and Local fallback failed.
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
      localStorage.removeItem("chess_local_user");
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

  // Handlers for Decks
  const handleSelectDeck = (deckId: string) => {
    setSelectedDeckId(deckId);
    setActiveView("deck-view");
  };

  const handleCreateDeck = async (name: string, description: string) => {
    const newDeck: ChessDeck = {
      id: "deck-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      name,
      description,
      createdAt: Date.now(),
    };

    if (user && !user.isLocal) {
      await saveDeckToFirestore(newDeck, user.uid);
    } else {
      await saveDeck(newDeck);
    }
    await loadData(); // Reload stats and lists
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (user && !user.isLocal) {
      await deleteDeckFromFirestore(deckId, user.uid);
    } else {
      await deleteDeck(deckId);
    }
    if (selectedDeckId === deckId) {
      setSelectedDeckId(null);
      setActiveView("decks");
    }
    await loadData();
  };

  // Handlers for Cards
  const handleSaveCard = async (
    cardDraft: Omit<ChessCard, "id" | "createdAt" | "reviewCount" | "lastReviewedAt" | "mastered">,
    isEditId?: string
  ) => {
    if (isEditId) {
      const existing = cards.find((c) => c.id === isEditId);
      if (existing) {
        const updatedCard: ChessCard = {
          ...existing,
          ...cardDraft,
        };
        if (user && !user.isLocal) {
          await saveCardToFirestore(updatedCard, user.uid);
        } else {
          await saveCard(updatedCard);
        }
      }
    } else {
      const newCard: ChessCard = {
        ...cardDraft,
        id: "card-" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
        createdAt: Date.now(),
        reviewCount: 0,
        lastReviewedAt: null,
        mastered: false,
      };
      if (user && !user.isLocal) {
        await saveCardToFirestore(newCard, user.uid);
      } else {
        await saveCard(newCard);
      }
    }

    await loadData();
    setEditingCard(null);
    setActiveView("deck-view"); // Return to the deck's list view
  };

  const handleDeleteCard = async (cardId: string) => {
    if (user && !user.isLocal) {
      await deleteCardFromFirestore(cardId);
    } else {
      await deleteCard(cardId);
    }
    await loadData();
  };

  const handleUpdateCardProgress = async (cardId: string, mastered: boolean) => {
    const cardToUpdate = cards.find((c) => c.id === cardId);
    if (cardToUpdate) {
      const updatedCard: ChessCard = {
        ...cardToUpdate,
        mastered,
        reviewCount: cardToUpdate.reviewCount + 1,
        lastReviewedAt: Date.now(),
      };
      if (user && !user.isLocal) {
        await saveCardToFirestore(updatedCard, user.uid);
      } else {
        await saveCard(updatedCard);
      }
      await loadData();
    }
  };

  const handleToggleMastered = async (cardId: string) => {
    const cardToUpdate = cards.find((c) => c.id === cardId);
    if (cardToUpdate) {
      const updatedCard: ChessCard = {
        ...cardToUpdate,
        mastered: !cardToUpdate.mastered,
      };
      if (user && !user.isLocal) {
        await saveCardToFirestore(updatedCard, user.uid);
      } else {
        await saveCard(updatedCard);
      }
      await loadData();
    }
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
          await saveDeck(deck);
        }
      }
      for (const card of importedCards) {
        if (user && !user.isLocal) {
          await saveCardToFirestore(card, user.uid);
        } else {
          await saveCard(card);
        }
      }

      await loadData();
    } catch (err) {
      console.error("Backup import failed:", err);
      alert("Failed to parse and save backup data. Ensure the JSON format is correct.");
    }
  };

  // Navigation Helpers
  const selectedDeck = decks.find((d) => d.id === selectedDeckId);
  const deckCards = cards.filter((c) => c.deckId === selectedDeckId);
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
              Initialising database & loading chess flashcards...
            </p>
          </div>
        ) : (
          <div className="animate-fade-in transition-all">
            
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
                    Local Account Active (Sandbox Mode): Signed in as <strong className="text-slate-800">{user.displayName || user.email}</strong>. Decks and cards are saved on this browser.
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
            Powered by Gemini 3.5 Multimodal Analysis & Google Cloud Firestore Sync
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
