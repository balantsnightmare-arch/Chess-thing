/** A single piece of prompt content on a card: either a phrase or a picture. */
export type CardItemKind = "text" | "image";

export interface CardItem {
  id: string;
  kind: CardItemKind;
  /** Phrase text for "text" items, or an image data URL for "image" items. */
  content: string;
}

export interface ChessCard {
  id: string;
  deckId: string;
  title: string;
  /** Primary image, kept in sync with the first image item (thumbnails + AI analysis). */
  imageUrl: string;
  /**
   * Pool of prompt items. One is picked at random for the front of the card,
   * the rest are revealed on the back. Optional so cards saved before
   * multi-item support still load (see getCardItems in lib/cards.ts).
   */
  items?: CardItem[];
  /** Optional. Unset means the card does not use this field. */
  sideToMove?: "White" | "Black" | "Unknown";
  tacticalThemes: string[];
  frontText: string; // Prompt / Question
  backText: string;  // Answer / Solution
  additionalNotes: string;
  createdAt: number;
  reviewCount: number;
  /** Optional. Unset means the card does not use this field. */
  difficulty?: "Easy" | "Medium" | "Hard";
  lastReviewedAt: number | null;
  mastered: boolean;
}

export interface ChessDeck {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export interface LocalUser {
  uid: string;
  email: string;
  /** SHA-256 digest of the password (legacy records may hold plain text). */
  passwordHash: string;
  displayName: string;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isLocal?: boolean;
}
