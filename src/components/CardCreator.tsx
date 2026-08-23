import React, { useState, useRef } from "react";
import { CardItem, ChessCard } from "../types";
import {
  createId,
  estimateCardBytes,
  formatBytes,
  getCardItems,
  processImageFile,
  MAX_CARD_BYTES,
} from "../lib/cards";
import {
  Upload,
  Sparkles,
  Save,
  X,
  RefreshCw,
  AlertTriangle,
  Type,
  Plus,
  ArrowUp,
  ArrowDown,
  Shuffle,
  Loader2,
  ImagePlus,
} from "lucide-react";

interface CardCreatorProps {
  deckId: string;
  cardToEdit?: ChessCard;
  onSave: (card: Omit<ChessCard, "id" | "createdAt" | "reviewCount" | "lastReviewedAt" | "mastered">, isEditId?: string) => void;
  onCancel: () => void;
}

export default function CardCreator({ deckId, cardToEdit, onSave, onCancel }: CardCreatorProps) {
  // Front and back are the card. Everything below them is optional extra.
  const [frontText, setFrontText] = useState(cardToEdit?.frontText || "");
  const [backText, setBackText] = useState(cardToEdit?.backText || "");
  const [title, setTitle] = useState(cardToEdit?.title || "");

  // Optional prompt items: pictures and phrases. One is drawn at random and
  // shown alongside the front; the rest are revealed on the back.
  const [items, setItems] = useState<CardItem[]>(() =>
    cardToEdit ? getCardItems(cardToEdit) : []
  );
  const [phraseInput, setPhraseInput] = useState("");

  // "" means the field is left unset, so a card that does not need it shows nothing.
  const [sideToMove, setSideToMove] = useState<"" | "White" | "Black" | "Unknown">(cardToEdit?.sideToMove ?? "");
  const [difficulty, setDifficulty] = useState<"" | "Easy" | "Medium" | "Hard">(cardToEdit?.difficulty ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(cardToEdit?.tacticalThemes || []);
  const [additionalNotes, setAdditionalNotes] = useState(cardToEdit?.additionalNotes || "");

  // AI loading state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [formError, setFormError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageItems = items.filter((item) => item.kind === "image");
  const textItems = items.filter((item) => item.kind === "text");
  const firstImage = imageItems.length > 0 ? imageItems[0].content : "";

  // Convert dropped/selected files into (downscaled) image items
  const handleFiles = async (files: FileList | File[]) => {
    const picked = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (picked.length === 0) {
      setFormError("Please select a valid image file.");
      return;
    }

    setIsProcessingImages(true);
    setFormError("");
    try {
      const processed = await Promise.all(
        picked.map(async (file) => ({
          id: createId("item"),
          kind: "image" as const,
          content: await processImageFile(file),
        }))
      );
      setItems((prev) => [...prev, ...processed]);
    } catch (err) {
      console.error("Image processing failed:", err);
      setFormError("One of those images could not be read. Please try a different file.");
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleAddPhrase = () => {
    const phrase = phraseInput.trim();
    if (!phrase) return;
    setItems((prev) => [...prev, { id: createId("item"), kind: "text", content: phrase }]);
    setPhraseInput("");
    setFormError("");
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  /**
   * Phrases and pictures are listed separately, so moving an item swaps it with
   * its nearest neighbour of the same kind rather than whatever happens to sit
   * next to it in the combined list.
   */
  const handleMoveItem = (itemId: string, direction: -1 | 1) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === itemId);
      if (index === -1) return prev;
      const kind = prev[index].kind;
      let target = -1;
      for (let i = index + direction; i >= 0 && i < prev.length; i += direction) {
        if (prev[i].kind === kind) {
          target = i;
          break;
        }
      }
      if (target === -1) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const isFirstOfKind = (item: CardItem) =>
    items.filter((i) => i.kind === item.kind)[0]?.id === item.id;
  const isLastOfKind = (item: CardItem) => {
    const sameKind = items.filter((i) => i.kind === item.kind);
    return sameKind[sameKind.length - 1]?.id === item.id;
  };

  // Run Gemini AI Analysis on the card's first picture
  const handleAiAnalysis = async () => {
    if (!firstImage) return;
    setIsAnalyzing(true);
    setAnalysisError("");

    try {
      const res = await fetch("/api/analyze-position", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: firstImage }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || "Failed to analyze image. Ensure your server is active.");
      }

      const data = await res.json();

      if (data.title) setTitle(data.title);
      if (data.sideToPlay) {
        const side = data.sideToPlay;
        if (side === "White" || side === "Black" || side === "Unknown") {
          setSideToMove(side);
        }
      }
      if (data.tacticalThemes && Array.isArray(data.tacticalThemes)) {
        setTags(data.tacticalThemes);
      }
      if (data.suggestedFront) setFrontText(data.suggestedFront);
      if (data.suggestedBack) setBackText(data.suggestedBack);
      if (data.additionalNotes) setAdditionalNotes(data.additionalNotes);
    } catch (err: any) {
      console.error("Gemini AI Analysis failed:", err);
      setAnalysisError(err?.message || "AI analysis failed. Please fill in the card details yourself.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Tag Manager
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const cleanTag = tagInput.trim().replace(/,/g, "");
      if (cleanTag && !tags.includes(cleanTag)) {
        setTags([...tags, cleanTag]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!frontText.trim()) {
      setFormError("Please fill in the card front.");
      return;
    }
    if (!backText.trim()) {
      setFormError("Please fill in the card back.");
      return;
    }

    // A phrase still sitting in the input counts: saving should not silently
    // discard something the user has typed just because they did not click Add.
    const pendingPhrase = phraseInput.trim();
    const effectiveItems: CardItem[] = pendingPhrase
      ? [...items, { id: createId("item"), kind: "text", content: pendingPhrase }]
      : items;

    setItems(effectiveItems);
    setPhraseInput("");

    const draft = {
      deckId,
      title: title.trim(),
      // Kept in sync with the first image so list thumbnails and AI analysis work.
      imageUrl: imageItems.length > 0 ? imageItems[0].content : "",
      items: effectiveItems,
      sideToMove: sideToMove || undefined,
      tacticalThemes: tags,
      frontText: frontText.trim(),
      backText: backText.trim(),
      additionalNotes: additionalNotes.trim(),
      difficulty: difficulty || undefined,
    };

    const size = estimateCardBytes(draft);
    if (size > MAX_CARD_BYTES) {
      setFormError(
        `This card is ${formatBytes(size)}, over the ${formatBytes(MAX_CARD_BYTES)} limit for a single card. Remove a picture and try again.`
      );
      return;
    }

    onSave(draft, cardToEdit?.id);
  };

  const fieldClass =
    "w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans";
  const labelClass = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5";

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-xl max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start pb-5 border-b border-slate-100">
        <div>
          <h3 className="font-display font-extrabold text-2xl text-slate-900">
            {cardToEdit ? "Edit Card" : "Create Card"}
          </h3>
          <p className="text-sm text-slate-500 font-sans mt-1">
            Write the front and the back. Everything else is optional.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ---------- 1. CARD FRONT ---------- */}
        <div>
          <label className={`${labelClass} flex justify-between`}>
            <span>Card Front *</span>
            <span className="text-[10px] text-slate-400 uppercase">The question</span>
          </label>
          <textarea
            rows={3}
            placeholder="e.g. What does this term mean?"
            value={frontText}
            onChange={(e) => setFrontText(e.target.value)}
            className={`${fieldClass} resize-none`}
          />
        </div>

        {/* ---------- 2. CARD BACK ---------- */}
        <div>
          <label className={`${labelClass} flex justify-between`}>
            <span>Card Back *</span>
            <span className="text-[10px] text-slate-400 uppercase">The answer</span>
          </label>
          <textarea
            rows={3}
            placeholder="e.g. The answer, plus any working or explanation."
            value={backText}
            onChange={(e) => setBackText(e.target.value)}
            className={`${fieldClass} resize-none`}
          />
        </div>

        {/* Everything past here can be left alone */}
        <div className="flex items-center gap-3 pt-2">
          <span className="h-px flex-1 bg-slate-100" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Optional
          </span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        {/* ---------- 3. CARD TITLE ---------- */}
        <div>
          <label className={labelClass}>Card Title</label>
          <input
            type="text"
            placeholder="e.g. Photosynthesis, or Spanish: to run"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClass}
          />
        </div>

        {/* ---------- 4. ADD WORD OR PHRASE ---------- */}
        <div>
          <label className={labelClass}>Add a Word or Phrase</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Type className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={phraseInput}
                placeholder="Type a word or phrase..."
                onChange={(e) => setPhraseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPhrase();
                  }
                }}
                className={`${fieldClass} pl-9.5`}
              />
            </div>
            <button
              type="button"
              onClick={handleAddPhrase}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {textItems.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {textItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 bg-white">
                  <div className="w-8 h-8 bg-amber-50 border border-amber-100 rounded-lg shrink-0 flex items-center justify-center">
                    <Type className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="flex-1 min-w-0 text-xs text-slate-700 font-sans truncate">
                    {item.content}
                  </p>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveItem(item.id, -1)}
                      disabled={isFirstOfKind(item)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveItem(item.id, 1)}
                      disabled={isLastOfKind(item)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------- 5. ADD ANY IMAGES ---------- */}
        <div>
          <label className={labelClass}>Add Any Images</label>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`border-2 border-dashed rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center p-4 ${
              isDragActive
                ? "border-amber-400 bg-amber-50/20"
                : "border-slate-200 hover:border-amber-400 hover:bg-slate-50"
            }`}
          >
            <div className="bg-slate-50 text-slate-400 p-2.5 rounded-full mb-2">
              {isProcessingImages ? (
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
              ) : (
                <ImagePlus className="w-5 h-5 text-slate-500" />
              )}
            </div>
            <p className="font-display font-bold text-sm text-slate-800">
              {isProcessingImages ? "Preparing images..." : "Tap to add pictures"}
            </p>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Or drag them here. Several at once is fine.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                // Reset so re-picking the same file still fires a change event.
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>

          {imageItems.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {imageItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2 p-2 bg-white">
                  <div className="w-10 h-10 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shrink-0 flex items-center justify-center">
                    <img
                      src={item.content}
                      alt={`Picture ${index + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="flex-1 min-w-0 text-xs text-slate-400 italic font-sans">
                    Picture {index + 1}
                  </p>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveItem(item.id, -1)}
                      disabled={isFirstOfKind(item)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveItem(item.id, 1)}
                      disabled={isLastOfKind(item)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-2 bg-amber-50/70 border border-amber-100 rounded-xl p-2.5 flex gap-2 items-start">
              <Shuffle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-relaxed font-sans">
                One of these {items.length} is drawn at random each time the card is opened; the rest
                appear on the back.
              </p>
            </div>
          )}

          {/* AI helper, only useful once there is a picture to look at */}
          {firstImage && (
            <div className="mt-3 bg-slate-50/70 border border-slate-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-start space-x-3">
                <div className="bg-amber-100 text-amber-800 p-2 rounded-xl shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  Let Gemini look at your first picture and draft the front, back and notes for you.
                </p>
              </div>

              {analysisError && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start space-x-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAiAnalysis}
                disabled={isAnalyzing}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white text-xs sm:text-sm font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center space-x-2 shadow-md cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Draft with AI</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ---------- 6 & 7. SIDE TO PLAY / DIFFICULTY ---------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Side to Play</label>
            <select
              value={sideToMove}
              onChange={(e) => setSideToMove(e.target.value as any)}
              className={`${fieldClass} bg-white`}
            >
              <option value="">Not specified</option>
              <option value="White">White to Play</option>
              <option value="Black">Black to Play</option>
              <option value="Unknown">Unknown / Setup</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className={`${fieldClass} bg-white`}
            >
              <option value="">Not specified</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        {/* ---------- Tags ---------- */}
        <div>
          <label className={labelClass}>Tags</label>
          <div className="border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-amber-400 bg-white">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-slate-100 text-slate-700 text-xs font-medium px-2 py-0.5 rounded-md flex items-center space-x-1"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-slate-400 hover:text-red-500 font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Type a tag and press Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-full border-none focus:ring-0 text-sm p-1 outline-none font-sans"
            />
          </div>
          <span className="text-[10px] text-slate-400 font-sans mt-1 block">
            Examples: Vocabulary, Formulas, Chapter 3, Weak Spots
          </span>
        </div>

        {/* ---------- Notes ---------- */}
        <div>
          <label className={labelClass}>Additional Notes</label>
          <textarea
            rows={3}
            placeholder="Add hints, mnemonics, or extra context..."
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            className={`${fieldClass} resize-none`}
          />
        </div>

        {formError && (
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2 text-xs text-rose-800 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-3 px-4 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isProcessingImages}
            className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-slate-900/10 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>Save Card</span>
          </button>
        </div>
      </form>
    </div>
  );
}
