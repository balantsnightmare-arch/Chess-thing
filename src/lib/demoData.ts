import { ChessCard, ChessDeck } from "../types";

// SVG helper to generate a nice chess board image for demo seeding
export function generateChessBoardSvg(theme: "tactics" | "mate" | "endgame"): string {
  const isDark = (r: number, c: number) => (r + c) % 2 === 1;
  const boardSize = 400;
  const cellSize = boardSize / 8;

  let pieces: { r: number; c: number; text: string; color: string }[] = [];

  if (theme === "tactics") {
    // Smothered Mate theme setup
    pieces = [
      { r: 0, c: 7, text: "♔", color: "white" }, // h8
      { r: 0, c: 6, text: "♖", color: "white" }, // g8
      { r: 1, c: 7, text: "♙", color: "white" }, // h7
      { r: 1, c: 6, text: "♙", color: "white" }, // g7
      { r: 1, c: 5, text: "♘", color: "black" }, // f7 (White Knight delivering mate)
      { r: 4, c: 4, text: "♚", color: "black" }, // e4
    ];
  } else if (theme === "mate") {
    // Back-rank mate setup
    pieces = [
      { r: 0, c: 3, text: "♚", color: "black" }, // d8
      { r: 0, c: 2, text: "♖", color: "white" }, // c8 (Delivering mate)
      { r: 1, c: 1, text: "♙", color: "black" }, // b7
      { r: 1, c: 2, text: "♙", color: "black" }, // c7
      { r: 1, c: 3, text: "♙", color: "black" }, // d7
      { r: 7, c: 7, text: "♔", color: "white" }, // h1
    ];
  } else {
    // King and Pawn endgame
    pieces = [
      { r: 3, c: 4, text: "♚", color: "black" }, // e5
      { r: 4, c: 4, text: "♔", color: "white" }, // e4
      { r: 3, c: 5, text: "♙", color: "white" }, // f5
    ];
  }

  let squaresSvg = "";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const fill = isDark(r, c) ? "#B58863" : "#F0D9B5";
      squaresSvg += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fill}" />`;
    }
  }

  // Draw some simple coordinates labels
  let coordsSvg = "";
  for (let i = 0; i < 8; i++) {
    // files a-h
    coordsSvg += `<text x="${i * cellSize + cellSize / 2}" y="${boardSize - 4}" font-size="10" font-family="sans-serif" fill="#4B5563" text-anchor="middle">${String.fromCharCode(97 + i)}</text>`;
    // ranks 1-8
    coordsSvg += `<text x="4" y="${i * cellSize + cellSize / 2 + 3}" font-size="10" font-family="sans-serif" fill="#4B5563">${8 - i}</text>`;
  }

  let piecesSvg = "";
  pieces.forEach((p) => {
    const x = p.c * cellSize + cellSize / 2;
    const y = p.r * cellSize + cellSize / 2 + 14; // adjust baseline
    const shadowColor = p.color === "white" ? "#000000" : "#ffffff";
    const pieceColor = p.color === "white" ? "#ffffff" : "#111827";
    piecesSvg += `
      <text x="${x}" y="${y}" font-size="38" font-family="sans-serif" text-anchor="middle" fill="${pieceColor}" stroke="${shadowColor}" stroke-width="1.5">
        ${p.text}
      </text>
    `;
  });

  const fullSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boardSize} ${boardSize}" width="100%" height="100%">
      <rect width="${boardSize}" height="${boardSize}" fill="#2D3748" rx="8" />
      <g transform="translate(10, 10) scale(0.95)">
        ${squaresSvg}
        ${coordsSvg}
        ${piecesSvg}
      </g>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(fullSvg)}`;
}

/**
 * Demo deck + cards used to seed a fresh install. `suffix` keeps the generated
 * ids unique per storage backend and per user, so two Firestore accounts never
 * end up writing over the same documents.
 */
export function createDemoDeck(suffix: string): ChessDeck {
  return {
    id: `default-tactics${suffix}`,
    name: "Mastering Tactical Themes",
    description: "A collection of essential chess puzzles, checkmates, and tactical motifs.",
    createdAt: Date.now(),
  };
}

export function createDemoCards(deckId: string, suffix: string): ChessCard[] {
  return [
    {
      id: `demo-card-1${suffix}`,
      deckId,
      title: "The Philidor Smothered Mate",
      imageUrl: generateChessBoardSvg("tactics"),
      items: [
        { id: `demo-1-item-1${suffix}`, kind: "image", content: generateChessBoardSvg("tactics") },
      ],
      sideToMove: "White",
      tacticalThemes: ["Smothered Mate", "Knight", "Double Check"],
      frontText:
        "Look closely at the congested black king on h8. How does White deliver checkmate in 1 move?",
      backText:
        "1. Nf7# (Knight to f7 checkmate)\n\nThe black king is completely surrounded ('smothered') by its own defenders (the rook on g8 and pawns on g7/h7). The knight jumps over to deliver a fatal checkmate. This is the classic Philidor mate mechanism!",
      additionalNotes:
        "Always watch out for smothered mates when the enemy king is trapped in the corner. If the Rook was on f8, we would need a queen sacrifice first to force the rook onto g8.",
      createdAt: Date.now() - 5000,
      reviewCount: 0,
      difficulty: "Medium",
      lastReviewedAt: null,
      mastered: false,
    },
    {
      id: `demo-card-2${suffix}`,
      deckId,
      title: "The Classic Back-Rank Weakness",
      imageUrl: generateChessBoardSvg("mate"),
      items: [
        { id: `demo-2-item-1${suffix}`, kind: "image", content: generateChessBoardSvg("mate") },
      ],
      sideToMove: "White",
      tacticalThemes: ["Back-Rank Mate", "Rook", "King Safety"],
      frontText:
        "Black's king is tucked behind its pawns on the back rank. How can White exploit this setup immediately?",
      backText:
        "1. Rc8# (Rook to c8 checkmate)\n\nBecause the black pawns on b7, c7, and d7 block the king from moving up to the 7th rank, the king has no escape square. White's rook delivers checkmate along the open 8th rank.",
      additionalNotes:
        "Back-rank weakness is the most common tactical blunder for beginners and intermediate players alike. Always make 'luft' (air) for your king by moving a pawn (like g3/h3 or g6/h6) before entering complex endgames.",
      createdAt: Date.now() - 4000,
      reviewCount: 0,
      difficulty: "Easy",
      lastReviewedAt: null,
      mastered: false,
    },
    {
      id: `demo-card-3${suffix}`,
      deckId,
      title: "King & Pawn Endgame: Opposing Kings",
      imageUrl: generateChessBoardSvg("endgame"),
      items: [
        { id: `demo-3-item-1${suffix}`, kind: "image", content: generateChessBoardSvg("endgame") },
      ],
      sideToMove: "White",
      tacticalThemes: ["Opposition", "Endgame", "Pawn Promotion"],
      frontText:
        "White to move. Should White play 1. Kd5 or does Black have defensive resources? How does 'Opposition' decide this game?",
      backText:
        "1. Kd5!\n\nBy playing Kd5, White takes direct 'Opposition' against the black king. Since Black must move their king, they will have to step aside (e.g. to d6 or f6), allowing White's king to advance and shepherd the f5 pawn safely to promotion.",
      additionalNotes:
        "Opposition means having kings on the same file, rank, or diagonal with an odd number of squares between them. The player who does NOT have to move holds the opposition and can break through.",
      createdAt: Date.now() - 3000,
      reviewCount: 0,
      difficulty: "Hard",
      lastReviewedAt: null,
      mastered: false,
    },
    {
      // Shows off multi-item cards: one prompt is drawn at random, the rest wait on the back.
      id: `demo-card-4${suffix}`,
      deckId,
      title: "Tactical Motif Drill (Mixed Prompts)",
      imageUrl: generateChessBoardSvg("tactics"),
      items: [
        { id: `demo-4-item-1${suffix}`, kind: "text", content: "Fork" },
        { id: `demo-4-item-2${suffix}`, kind: "text", content: "Pin" },
        { id: `demo-4-item-3${suffix}`, kind: "text", content: "Skewer" },
        { id: `demo-4-item-4${suffix}`, kind: "text", content: "Discovered Attack" },
        { id: `demo-4-item-5${suffix}`, kind: "image", content: generateChessBoardSvg("tactics") },
      ],
      sideToMove: "Unknown",
      tacticalThemes: ["Vocabulary", "Pattern Recognition"],
      frontText: "Define the motif shown, then name a position where it decides the game.",
      backText:
        "Fork: one piece attacks two targets at once.\nPin: a piece cannot move without exposing a more valuable one behind it.\nSkewer: the reverse of a pin, the valuable piece is in front and must move.\nDiscovered Attack: moving one piece unmasks an attack from the piece behind it.",
      additionalNotes:
        "This card carries several prompts at once. Every time you open it a different one is drawn for the front, and the remaining prompts are listed on the back so you can self-check the whole family of motifs.",
      createdAt: Date.now() - 2000,
      reviewCount: 0,
      difficulty: "Easy",
      lastReviewedAt: null,
      mastered: false,
    },
  ];
}
