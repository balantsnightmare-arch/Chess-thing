import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  writeBatch
} from "firebase/firestore";
import { ChessCard, ChessDeck } from "../types";
import { createDemoCards, createDemoDeck } from "./demoData";

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

// Keep the session across app restarts so a phone stays signed in.
// (This is the browser default, but it is stated explicitly because the whole
// account-sync model depends on it.)
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Could not set auth persistence:", err);
});

// Initialize Firestore with custom Database ID.
// A persistent local cache lets the app keep working on a phone with patchy
// signal: reads are served from cache and writes are queued until reconnect.
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-chessflashcards-ca8f0395-c891-4fed-80a7-33c605882906";

function createDb() {
  try {
    return initializeFirestore(
      app,
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
      dbId
    );
  } catch (err) {
    // Private browsing / unsupported storage: fall back to memory-only.
    console.warn("Firestore offline persistence unavailable, using memory cache:", err);
    return getFirestore(app, dbId);
  }
}

export const db = createDb();

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

/**
 * Firestore rejects documents containing `undefined`, which optional fields
 * such as `items` produce on cards created before multi-item support.
 */
function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) clean[key] = val;
  }
  return clean as T;
}

// Save/Update a card in Firestore
export async function saveCardToFirestore(card: ChessCard, userId: string): Promise<void> {
  const cardRef = doc(db, "cards", card.id);
  await setDoc(cardRef, stripUndefined({
    ...card,
    userId
  }));
}

// Delete a card in Firestore
export async function deleteCardFromFirestore(cardId: string): Promise<void> {
  const cardRef = doc(db, "cards", cardId);
  await deleteDoc(cardRef);
}

/*
 * Per-account settings live in users/{uid}. Storing them here rather than in
 * localStorage keeps them tied to the account, so signing in on a second
 * device does not re-seed demo data the user already dealt with elsewhere.
 */
interface AccountFlags {
  demoSeeded?: boolean;
}

export async function getAccountFlags(userId: string): Promise<AccountFlags> {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    return snap.exists() ? (snap.data() as AccountFlags) : {};
  } catch (err) {
    console.warn("Could not read account settings:", err);
    return {};
  }
}

export async function setAccountFlags(userId: string, flags: AccountFlags): Promise<void> {
  try {
    // userId is required by the Firestore security rules.
    await setDoc(doc(db, "users", userId), { userId, ...flags }, { merge: true });
  } catch (err) {
    console.warn("Could not save account settings:", err);
  }
}

/**
 * Copy decks and cards created on this device (guest or offline-only mode)
 * into the signed-in account. Documents keep their ids, so running this twice
 * overwrites rather than duplicating.
 */
export async function uploadDataToAccount(
  decks: ChessDeck[],
  cards: ChessCard[],
  userId: string
): Promise<{ decks: number; cards: number }> {
  for (const deck of decks) {
    await saveDeckToFirestore(deck, userId);
  }
  for (const card of cards) {
    await saveCardToFirestore(card, userId);
  }
  return { decks: decks.length, cards: cards.length };
}

// Seed Firestore Demo Data.
// Document ids are scoped to the user: a fixed id such as "default-tactics-fs"
// is a single global document, so every new account used to overwrite the
// previous account's demo deck and cards.
export async function seedFirestoreDemoData(userId: string): Promise<void> {
  const suffix = `-fs-${userId}`;
  const defaultDeck = createDemoDeck(suffix);
  await saveDeckToFirestore(defaultDeck, userId);

  const demoCards = createDemoCards(defaultDeck.id, suffix);
  for (const card of demoCards) {
    await saveCardToFirestore(card, userId);
  }
}
