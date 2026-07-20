import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  getDoc,
  writeBatch
} from "firebase/firestore";
import { ChessCard, ChessDeck } from "../types";
import { generateChessBoardSvg } from "./db";

// Support custom configuration via env variables or fallback to defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBJbcxSDehuZnVkM7PDYardG3sozgfQkP4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0015469598.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0015469598",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0015469598.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "729534646918",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:729534646918:web:f72bd293909d61d28d9f07"
};

// Initialize App
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with custom Database ID
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-chessflashcards-ca8f0395-c891-4fed-80a7-33c605882906";
export const db = getFirestore(app, dbId);

// Auth Handlers
export async function signUpWithEmailAndPassword(email: string, password: string, displayName: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (result.user) {
      await updateProfile(result.user, { displayName });
    }
    return result.user;
  } catch (error) {
    console.error("Firebase Sign-Up failed:", error);
    throw error;
  }
}

export async function signInWithEmailAndPasswordHelper(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Firebase Sign-In failed:", error);
    throw error;
  }
}

export async function signInWithGoogle() {
  googleProvider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In failed:", error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
    throw error;
  }
}

// Firestore Operations

// Get all decks for the logged-in user
export async function getDecksFromFirestore(userId: string): Promise<ChessDeck[]> {
  const decksRef = collection(db, "decks");
  const q = query(decksRef, where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  const decks: ChessDeck[] = [];
  querySnapshot.forEach((docSnap) => {
    decks.push(docSnap.data() as ChessDeck);
  });
  return decks;
}

// Save/Update a deck in Firestore
export async function saveDeckToFirestore(deck: ChessDeck, userId: string): Promise<void> {
  const deckRef = doc(db, "decks", deck.id);
  await setDoc(deckRef, {
    ...deck,
    userId
  });
}

// Delete a deck and all its associated cards in Firestore
export async function deleteDeckFromFirestore(deckId: string, userId: string): Promise<void> {
  // Delete the deck document
  const deckRef = doc(db, "decks", deckId);
  await deleteDoc(deckRef);

  // Query and delete all cards associated with the deck
  const cardsRef = collection(db, "cards");
  const q = query(cardsRef, where("deckId", "==", deckId), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  querySnapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();
}

// Get all cards for the logged-in user, optionally filtered by deckId
export async function getCardsFromFirestore(userId: string, deckId?: string): Promise<ChessCard[]> {
  const cardsRef = collection(db, "cards");
  let q = query(cardsRef, where("userId", "==", userId));
  if (deckId) {
    q = query(cardsRef, where("userId", "==", userId), where("deckId", "==", deckId));
  }
  const querySnapshot = await getDocs(q);
  const cards: ChessCard[] = [];
  querySnapshot.forEach((docSnap) => {
    cards.push(docSnap.data() as ChessCard);
  });
  // Sort by creation time to ensure consistent ordering
  return cards.sort((a, b) => a.createdAt - b.createdAt);
}

// Save/Update a card in Firestore
export async function saveCardToFirestore(card: ChessCard, userId: string): Promise<void> {
  const cardRef = doc(db, "cards", card.id);
  await setDoc(cardRef, {
    ...card,
    userId
  });
}

// Delete a card in Firestore
export async function deleteCardFromFirestore(cardId: string): Promise<void> {
  const cardRef = doc(db, "cards", cardId);
  await deleteDoc(cardRef);
}

// Seed Firestore Demo Data
export async function seedFirestoreDemoData(userId: string): Promise<void> {
  const defaultDeck: ChessDeck = {
    id: "default-tactics-fs",
    name: "Mastering Tactical Themes",
    description: "A collection of essential chess puzzles, checkmates, and tactical motifs.",
    createdAt: Date.now(),
  };

  await saveDeckToFirestore(defaultDeck, userId);

  const demoCards: ChessCard[] = [
    {
      id: "demo-card-1-fs",
      deckId: "default-tactics-fs",
      title: "The Philidor Smothered Mate",
      imageUrl: generateChessBoardSvg("tactics"),
      sideToMove: "White",
      tacticalThemes: ["Smothered Mate", "Knight", "Double Check"],
      frontText: "Look closely at the congested black king on h8. How does White deliver checkmate in 1 move?",
      backText: "1. Nf7# (Knight to f7 checkmate)\n\nThe black king is completely surrounded ('smothered') by its own defenders (the rook on g8 and pawns on g7/h7). The knight jumps over to deliver a fatal checkmate. This is the classic Philidor mate mechanism!",
      additionalNotes: "Always watch out for smothered mates when the enemy king is trapped in the corner. If the Rook was on f8, we would need a queen sacrifice first to force the rook onto g8.",
      createdAt: Date.now() - 5000,
      reviewCount: 0,
      difficulty: "Medium",
      lastReviewedAt: null,
      mastered: false,
    },
    {
      id: "demo-card-2-fs",
      deckId: "default-tactics-fs",
      title: "The Classic Back-Rank Weakness",
      imageUrl: generateChessBoardSvg("mate"),
      sideToMove: "White",
      tacticalThemes: ["Back-Rank Mate", "Rook", "King Safety"],
      frontText: "Black's king is tucked behind its pawns on the back rank. How can White exploit this setup immediately?",
      backText: "1. Rc8# (Rook to c8 checkmate)\n\nBecause the black pawns on b7, c7, and d7 block the king from moving up to the 7th rank, the king has no escape square. White's rook delivers checkmate along the open 8th rank.",
      additionalNotes: "Back-rank weakness is the most common tactical blunder for beginners and intermediate players alike. Always make 'luft' (air) for your king by moving a pawn (like g3/h3 or g6/h6) before entering complex endgames.",
      createdAt: Date.now() - 4000,
      reviewCount: 0,
      difficulty: "Easy",
      lastReviewedAt: null,
      mastered: false,
    },
    {
      id: "demo-card-3-fs",
      deckId: "default-tactics-fs",
      title: "King & Pawn Endgame: Opposing Kings",
      imageUrl: generateChessBoardSvg("endgame"),
      sideToMove: "White",
      tacticalThemes: ["Opposition", "Endgame", "Pawn Promotion"],
      frontText: "White to move. Should White play 1. Kd5 or does Black have defensive resources? How does 'Opposition' decide this game?",
      backText: "1. Kd5!\n\nBy playing Kd5, White takes direct 'Opposition' against the black king. Since Black must move their king, they will have to step aside (e.g. to d6 or f6), allowing White's king to advance and shepherd the f5 pawn safely to promotion.",
      additionalNotes: "Opposition means having kings on the same file, rank, or diagonal with an odd number of squares between them. The player who does NOT have to move holds the opposition and can break through.",
      createdAt: Date.now() - 3000,
      reviewCount: 0,
      difficulty: "Hard",
      lastReviewedAt: null,
      mastered: false,
    },
  ];

  for (const card of demoCards) {
    await saveCardToFirestore(card, userId);
  }
}

