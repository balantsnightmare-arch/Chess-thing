export interface ChessCard {
  id: string;
  deckId: string;
  title: string;
  imageUrl: string; // Base64 data of the uploaded image
  sideToMove: "White" | "Black" | "Unknown";
  tacticalThemes: string[];
  frontText: string; // Prompt / Question
  backText: string;  // Answer / Solution
  additionalNotes: string;
  createdAt: number;
  reviewCount: number;
  difficulty: "Easy" | "Medium" | "Hard";
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


