import { ChessCard, ChessDeck, LocalUser } from "../types";
import { createDemoCards, createDemoDeck } from "./demoData";

const DB_NAME = "chess-flashcards-db";
// v3 added ownerId, so guest data and each device account are kept apart.
const DB_VERSION = 3;

/** Owner id used for data created while nobody is signed in. */
export const GUEST_OWNER = "guest";

/** Stored records carry an owner alongside the domain fields. */
type Owned<T> = T & { ownerId: string };

/** Drop the storage-only owner field before handing records to the app. */
function stripOwner<T>(record: Owned<T>): T {
  const { ownerId: _ownerId, ...rest } = record as Owned<T> & Record<string, unknown>;
  return rest as T;
}

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB failed to open");
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;

      if (!db.objectStoreNames.contains("decks")) {
        const deckStore = db.createObjectStore("decks", { keyPath: "id" });
        deckStore.createIndex("ownerId", "ownerId", { unique: false });
      }
      if (!db.objectStoreNames.contains("cards")) {
        const cardStore = db.createObjectStore("cards", { keyPath: "id" });
        cardStore.createIndex("deckId", "deckId", { unique: false });
        cardStore.createIndex("ownerId", "ownerId", { unique: false });
      }
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "email" });
      }

      // Upgrading an existing database: add the index and treat everything that
      // was already here as guest-owned, since that is where it was visible.
      if (event.oldVersion > 0 && event.oldVersion < 3 && tx) {
        for (const storeName of ["decks", "cards"]) {
          const store = tx.objectStore(storeName);
          if (!store.indexNames.contains("ownerId")) {
            store.createIndex("ownerId", "ownerId", { unique: false });
          }
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            const value = cursor.value;
            if (!value.ownerId) {
              value.ownerId = GUEST_OWNER;
              cursor.update(value);
            }
            cursor.continue();
          };
        }
      }
    };
  });
}

// Re-exported so existing importers keep working after the move to demoData.ts
export { generateChessBoardSvg } from "./demoData";

/*
 * Demo seeding is remembered per storage scope so the sample deck is only ever
 * created once. Without this flag, deleting every deck instantly resurrected
 * the demo data on the very next read.
 */
const SEED_FLAG_PREFIX = "chess_demo_seeded_v1:";

export function hasSeededDemoData(scope: string): boolean {
  try {
    return localStorage.getItem(SEED_FLAG_PREFIX + scope) === "true";
  } catch {
    return false;
  }
}

export function markDemoDataSeeded(scope: string): void {
  try {
    localStorage.setItem(SEED_FLAG_PREFIX + scope, "true");
  } catch {
    /* Storage unavailable (private mode); seeding simply repeats next visit. */
  }
}

export async function seedDemoData(db: IDBDatabase, ownerId: string): Promise<void> {
  const defaultDeck = createDemoDeck(ownerId === GUEST_OWNER ? "" : `-${ownerId}`);
  const demoCards = createDemoCards(defaultDeck.id, ownerId === GUEST_OWNER ? "" : `-${ownerId}`);

  const transaction = db.transaction(["decks", "cards"], "readwrite");
  const deckStore = transaction.objectStore("decks");
  const cardStore = transaction.objectStore("cards");

  await new Promise<void>((resolve, reject) => {
    const req = deckStore.put({ ...defaultDeck, ownerId });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  for (const card of demoCards) {
    await new Promise<void>((resolve, reject) => {
      const req = cardStore.put({ ...card, ownerId });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

/** Seed the sample deck on first launch only, per owner. */
export async function ensureLocalDemoData(ownerId: string): Promise<void> {
  const scope = `local:${ownerId}`;
  if (hasSeededDemoData(scope)) return;
  const db = await initDB();
  const existing = await getDecks(ownerId);
  if (existing.length === 0) {
    await seedDemoData(db, ownerId);
  }
  markDemoDataSeeded(scope);
}

// Database query functions
export async function getDecks(ownerId: string): Promise<ChessDeck[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("decks", "readonly");
    const index = transaction.objectStore("decks").index("ownerId");
    const request = index.getAll(IDBKeyRange.only(ownerId));

    request.onsuccess = () => resolve((request.result as Owned<ChessDeck>[]).map(stripOwner));
    request.onerror = () => reject(request.error);
  });
}

export async function saveDeck(deck: ChessDeck, ownerId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("decks", "readwrite");
    const store = transaction.objectStore("decks");
    const request = store.put({ ...deck, ownerId });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDeck(deckId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["decks", "cards"], "readwrite");

    // Delete the deck
    const deckStore = transaction.objectStore("decks");
    deckStore.delete(deckId);

    // Delete all cards belonging to the deck
    const cardStore = transaction.objectStore("cards");
    const index = cardStore.index("deckId");
    const request = index.openCursor(IDBKeyRange.only(deckId));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getCards(ownerId: string, deckId?: string): Promise<ChessCard[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("cards", "readonly");
    const store = transaction.objectStore("cards");
    // Always read through the owner index, then narrow by deck, so one
    // account can never see another's cards.
    const request = store.index("ownerId").getAll(IDBKeyRange.only(ownerId));

    request.onsuccess = () => {
      let results = (request.result as Owned<ChessCard>[]).map(stripOwner);
      if (deckId) results = results.filter((card) => card.deckId === deckId);
      // Sort by creation time to ensure consistent ordering
      resolve(results.sort((a, b) => a.createdAt - b.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveCard(card: ChessCard, ownerId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("cards", "readwrite");
    const store = transaction.objectStore("cards");
    const request = store.put({ ...card, ownerId });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCard(cardId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("cards", "readwrite");
    const store = transaction.objectStore("cards");
    const request = store.delete(cardId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCard(cardId: string): Promise<ChessCard | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("cards", "readonly");
    const store = transaction.objectStore("cards");
    const request = store.get(cardId);

    request.onsuccess = () =>
      resolve(request.result ? stripOwner(request.result as Owned<ChessCard>) : null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Hand every deck and card owned by `fromOwner` over to `toOwner`. Used when
 * someone who has been working as a guest registers a device account: the work
 * moves with them instead of disappearing behind the new partition.
 */
export async function claimDeviceData(
  fromOwner: string,
  toOwner: string
): Promise<{ decks: number; cards: number }> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["decks", "cards"], "readwrite");
    let decks = 0;
    let cards = 0;

    const reassign = (storeName: "decks" | "cards", onDone: () => void) => {
      const store = transaction.objectStore(storeName);
      const request = store.index("ownerId").openCursor(IDBKeyRange.only(fromOwner));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          onDone();
          return;
        }
        cursor.update({ ...cursor.value, ownerId: toOwner });
        if (storeName === "decks") decks += 1;
        else cards += 1;
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    };

    reassign("decks", () => reassign("cards", () => resolve({ decks, cards })));
    transaction.onerror = () => reject(transaction.error);
  });
}

// Local User helpers for offline/fallback account storage

/**
 * Passwords for the offline sandbox account are stored as a SHA-256 digest
 * rather than plain text. Digests are prefixed so older plain-text records can
 * still be recognised and upgraded on the next successful sign-in.
 */
const HASH_PREFIX = "sha256:";

export async function hashPassword(password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    // Secure context unavailable; fall back to storing the raw value.
    return password;
  }
  const bytes = new TextEncoder().encode(password);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return HASH_PREFIX + hex;
}

/** True when `password` matches a stored digest (or a legacy plain-text value). */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (!stored.startsWith(HASH_PREFIX)) return stored === password;
  return (await hashPassword(password)) === stored;
}

export async function saveLocalUser(user: LocalUser): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("users", "readwrite");
    const store = transaction.objectStore("users");
    const request = store.put(user);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalUser(email: string): Promise<LocalUser | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("users", "readonly");
    const store = transaction.objectStore("users");
    const request = store.get(email);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
