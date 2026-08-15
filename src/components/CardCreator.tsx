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
  FileImage,
  AlertTriangle,
  Type,
  Plus,
  ArrowUp,
  ArrowDown,
  Shuffle,
  Loader2,
} from "lucide-react";

interface CardCreatorProps {
  deckId: string;
  cardToEdit?: ChessCard;
  onSave: (card: Omit<ChessCard, "id" | "createdAt" | "reviewCount" | "lastReviewedAt" | "mastered">, isEditId?: string) => void;
  onCancel: () => void;
}

export default function CardCreator({ deckId, cardToEdit, onSave, onCancel }: CardCreatorProps) {
  // Prompt items: pictures and phrases. One is drawn at random for the front.
  const [items, setItems] = useState<CardItem[]>(() =>
    cardToEdit ? getCardItems(cardToEdit) : []
  );
  const [phraseInput, setPhraseInput] = useState("");
  const [title, setTitle] = useState(cardToEdit?.title || "");
  // "" means the field is left unset, so a card that does not need it shows nothing.
  const [sideToMove, setSideToMove] = useState<"" | "White" | "Black" | "Unknown">(cardToEdit?.sideToMove ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(cardToEdit?.tacticalThemes || []);
  const [frontText, setFrontText] = useState(cardToEdit?.frontText || "");
  const [backText, setBackText] = useState(cardToEdit?.backText || "");
  const [additionalNotes, setAdditionalNotes] = useState(cardToEdit?.additionalNotes || "");
  const [difficulty, setDifficulty] = useState<"" | "Easy" | "Medium" | "Hard">(cardToEdit?.difficulty ?? "");

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

  const handleMoveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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

      // Auto-populate fields from Gemini AI results
      if (data.title) setTitle(data.title);
      if (data.sideToPlay) {
        // Normalize side
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
      setAnalysisError(err?.message || "AI analysis failed. Please manually fill in the card details below.");
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

    // A phrase still sitting in the input counts: saving should not silently
    // discard something the user has typed just because they did not click Add.
    const pendingPhrase = phraseInput.trim();
    const effectiveItems: CardItem[] = pendingPhrase
      ? [...items, { id: createId("item"), kind: "text", content: pendingPhrase }]
      : items;

    if (effectiveItems.length === 0) {
      setFormError("Add at least one picture or phrase to this card.");
      return;
    }

    setItems(effectiveItems);
    setPhraseInput("");

    const draft = {
      deckId,
      title: title.trim(),
      // Kept in sync with the first image so list thumbnails and AI analysis work.
      imageUrl: firstImage,
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

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start pb-5 border-b border-slate-100">
        <div>
          <h3 className="font-display font-extrabold text-2xl text-slate-900 flex items-center gap-2">
            {cardToEdit ? "Edit Card" : "Create Card"}
          </h3>
          <p className="text-sm text-slate-500 font-sans mt-1">
            {cardToEdit
              ? "Modify the details of this card."
              : "Add one or more pictures and phrases, then write the answer."}
          </p>
        </div>

        <button
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: Prompt items and AI triggering (5/12 span) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Card Prompts *
            </label>
            <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3 flex gap-2.5 items-start">
              <Shuffle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-relaxed font-sans">
                Add as many pictures and phrases as you like. Each time the card is opened, <strong>one is drawn at random</strong> for the front and the rest are revealed on the back.
              </p>
            </div>

            {/* Drag & Drop Upload Zone (accepts several files at once) */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`border-2 border-dashed rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center ${
                items.length > 0 ? "p-4 min-h-[120px]" : "p-6 min-h-[200px]"
              } ${
                isDragActive
                  ? "border-amber-400 bg-amber-50/20"
                  : "border-slate-200 hover:border-amber-400 hover:bg-slate-50"
              }`}
            >
              <div className="bg-slate-50 text-slate-400 p-3 rounded-full mb-2">
                {isProcessingImages ? (
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <p className="font-display font-bold text-sm text-slate-800">
                {isProcessingImages ? "Preparing images..." : "Drag & drop pictures here"}
              </p>
              <p className="text-xs text-slate-400 font-sans mt-1">
                Select several at once — JPEG, PNG or SVG
              </p>
              <span className="mt-3 inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                Browse Files
              </span>
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

            {/* Phrase entry */}
            <div className="flex gap-2 pt-1">
              <div className="relative flex-1">
                <Type className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={phraseInput}
                  placeholder="Add a word or phrase..."
                  onChange={(e) => setPhraseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPhrase();
                    }
                  }}
                  className="w-full pl-9.5 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans"
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

            {/* Item list */}
            {items.length > 0 && (
              <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                <div className="bg-slate-50/80 px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {items.length} {items.length === 1 ? "prompt" : "prompts"} on this card
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans">
                    {imageItems.length} picture{imageItems.length === 1 ? "" : "s"} · {textItems.length} phrase{textItems.length === 1 ? "" : "s"}
                  </span>
                </div>

                {items.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 bg-white">
                    <span className="text-[10px] font-mono font-bold text-slate-400 w-4 shrink-0 text-center">
                      {index + 1}
                    </span>

                    {item.kind === "image" ? (
                      <div className="w-12 h-12 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shrink-0 flex items-center justify-center">
                        <img
                          src={item.content}
                          alt={`Prompt ${index + 1}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-lg shrink-0 flex items-center justify-center">
                        <Type className="w-5 h-5 text-amber-600" />
                      </div>
                    )}

                    <p className="flex-1 min-w-0 text-xs text-slate-700 font-sans truncate">
                      {item.kind === "image" ? (
                        <span className="text-slate-400 italic flex items-center gap-1">
                          <FileImage className="w-3.5 h-3.5" /> Picture
                        </span>
                      ) : (
                        item.content
                      )}
                    </p>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveItem(index, -1)}
                        disabled={index === 0}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveItem(index, 1)}
                        disabled={index === items.length - 1}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Remove prompt"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI trigger Button */}
          {firstImage && (
            <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-start space-x-3">
                <div className="bg-amber-100 text-amber-800 p-2 rounded-xl">
                  <Sparkles className="w-4.5 h-4.5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-800 text-sm">
                    Let AI Analyze Your Position
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans mt-0.5">
                    Gemini will analyze the first picture on this card, detect white vs black pieces, draft a core puzzle question, provide solutions, and annotate positional details automatically!
                  </p>
                </div>
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
                    <span>Analyzing Position...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4.5 h-4.5 text-amber-300" />
                    <span>Analyze with Gemini AI</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Form details (7/12 span) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Card Title (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Photosynthesis, or Spanish: to run"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Side to Play */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Side to Play (optional)
              </label>
              <select
                value={sideToMove}
                onChange={(e) => setSideToMove(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans bg-white"
              >
                <option value="">Not specified</option>
                <option value="White">White to Play</option>
                <option value="Black">Black to Play</option>
                <option value="Unknown">Unknown / Setup</option>
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Difficulty (optional)
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans bg-white"
              >
                <option value="">Not specified</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tags
            </label>
            <div className="border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-amber-400 bg-white">
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
              <input
                type="text"
                placeholder="Type tag and press Enter"
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

          {/* FRONT TEXT: Question/Study prompt */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex justify-between">
              <span>Card Front (Question/Prompt)</span>
              <span className="text-[10px] text-slate-400 uppercase">Shown with the drawn prompt</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. What does this term mean?"
              value={frontText}
              onChange={(e) => setFrontText(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans resize-none"
            />
          </div>

          {/* BACK TEXT: Answer/Solution */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex justify-between">
              <span>Card Back (Answer)</span>
              <span className="text-[10px] text-slate-400 uppercase">Shown with the other prompts</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. The answer, plus any working or explanation."
              value={backText}
              onChange={(e) => setBackText(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans resize-none"
            />
          </div>

          {/* ADDITIONAL NOTES */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Additional Notes (hints & context)
            </label>
            <textarea
              rows={3}
              placeholder="Add hints, mnemonics, or extra context..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans resize-none"
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
              <span>Save Flashcard</span>
            </button>
          </div>

        </div>

      </form>
    </div>
  );
}
