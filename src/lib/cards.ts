import { CardItem, ChessCard } from "../types";

/** Firestore rejects documents over 1 MiB; leave headroom for metadata. */
export const MAX_CARD_BYTES = 900 * 1024;
/** Longest edge kept when re-encoding an uploaded picture. */
export const MAX_IMAGE_DIMENSION = 900;
/** Images already smaller than this are stored untouched. */
const SKIP_RECOMPRESS_BYTES = 120 * 1024;

/** Wrap a plain string as a text item so it can reuse the prompt renderers. */
export function makeTextItem(content: string, id = "synthetic"): CardItem {
  return { id, kind: "text", content };
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
}

type CardLike = Pick<ChessCard, "imageUrl" | "items">;

/**
 * The card's prompt items. Cards created before multi-item support only carry
 * `imageUrl`, so those are migrated to a single image item on read.
 */
export function getCardItems(card: CardLike): CardItem[] {
  const items = (card.items ?? []).filter(
    (item) => item && typeof item.content === "string" && item.content.trim() !== ""
  );
  if (items.length > 0) return items;
  if (card.imageUrl) {
    return [{ id: "legacy-image", kind: "image", content: card.imageUrl }];
  }
  return [];
}

/** First image on the card, used for list thumbnails and AI analysis. */
export function getPrimaryImage(card: CardLike): string {
  const firstImage = getCardItems(card).find((item) => item.kind === "image");
  return firstImage ? firstImage.content : "";
}

/**
 * What to show as the card's heading. Titles are optional, so fall back to the
 * card's first phrase and finally to a neutral placeholder, rather than
 * rendering an empty heading.
 */
export function getCardTitle(
  card: CardLike & { title?: string; frontText?: string; backText?: string },
  swapped = false
): string {
  // When the deck is swapped the answer is the front, so the heading has to
  // follow it. Otherwise the list and the preview header would spoil the very
  // thing the card is now asking you to recall.
  if (swapped) {
    const answer = (card.backText ?? "").trim();
    if (answer) return answer.length > 60 ? `${answer.slice(0, 57)}...` : answer;
  }
  // Cards no longer carry a separate title: the front of the card is the
  // title. An explicit title is still honoured so cards written before this
  // keep the heading they were given.
  const title = (card.title ?? "").trim();
  if (title) return title;
  const front = (card.frontText ?? "").trim();
  if (front) return front.length > 60 ? `${front.slice(0, 57)}...` : front;
  const firstText = getPrimaryText(card).trim();
  if (firstText) return firstText.length > 60 ? `${firstText.slice(0, 57)}...` : firstText;
  return "Untitled card";
}

/** First phrase on the card, used as a thumbnail stand-in for text-only cards. */
export function getPrimaryText(card: CardLike): string {
  const firstText = getCardItems(card).find((item) => item.kind === "text");
  return firstText ? firstText.content : "";
}

/**
 * Random index into a list of `length` items, avoiding `exclude` when there is
 * more than one option so re-rolling always lands somewhere new.
 */
export function pickRandomIndex(length: number, exclude?: number): number {
  if (length <= 0) return 0;
  if (length === 1) return 0;
  let next = Math.floor(Math.random() * length);
  if (exclude !== undefined && exclude >= 0 && exclude < length) {
    // Draw from the remaining slots, then shift past the excluded one.
    next = Math.floor(Math.random() * (length - 1));
    if (next >= exclude) next += 1;
  }
  return next;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function downscaleDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const longestEdge = Math.max(img.width, img.height);
      const scale = longestEdge > 0 ? Math.min(1, MAX_IMAGE_DIMENSION / longestEdge) : 1;
      if (scale === 1 && dataUrl.length <= SKIP_RECOMPRESS_BYTES) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      // Flatten onto white so transparent PNGs don't turn black once encoded as JPEG.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const encoded = canvas.toDataURL("image/jpeg", 0.85);
      resolve(encoded.length < dataUrl.length ? encoded : dataUrl);
    };
    img.onerror = () => reject(new Error("That image file could not be decoded."));
    img.src = dataUrl;
  });
}

/**
 * Read an uploaded picture into a data URL, shrinking it so a card packed with
 * several images still fits inside a Firestore document.
 */
export async function processImageFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  // SVGs are already tiny and rasterising them would throw away the vectors.
  if (file.type === "image/svg+xml") return dataUrl;
  try {
    return await downscaleDataUrl(dataUrl);
  } catch {
    return dataUrl;
  }
}

/** Rough byte size of a card once serialised, for the storage-limit guard. */
export function estimateCardBytes(card: unknown): number {
  const serialised = JSON.stringify(card) ?? "";
  if (typeof Blob !== "undefined") return new Blob([serialised]).size;
  return serialised.length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
