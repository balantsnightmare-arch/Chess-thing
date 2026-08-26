import React, { useRef, useState } from "react";
import { processScanImage } from "../lib/cards";
import { Camera, X, Loader2, AlertTriangle, Check, Trash2, RefreshCw } from "lucide-react";

export interface ScannedCard {
  front: string;
  back: string;
}

interface ScanSheetProps {
  onClose: () => void;
  /** Create the deck and its cards. Resolves once they are stored. */
  onCreate: (deckName: string, cards: ScannedCard[]) => Promise<void>;
}

type Stage = "capture" | "reading" | "review";

export default function ScanSheet({ onClose, onCreate }: ScanSheetProps) {
  const [stage, setStage] = useState<Stage>("capture");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [deckName, setDeckName] = useState("");
  const [cards, setCards] = useState<ScannedCard[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Two inputs: one asks the phone for the camera, one for the photo library.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }

    setError("");
    setStage("reading");
    try {
      const image = await processScanImage(file);
      setPreview(image);

      const res = await fetch("/api/scan-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Could not read that photo.");
      }

      setDeckName(data.deckName || "Scanned Notes");
      setCards(Array.isArray(data.cards) ? data.cards : []);
      setStage("review");
    } catch (err: any) {
      console.error("Sheet scan failed:", err);
      setError(err?.message || "Could not read that photo.");
      setStage("capture");
    }
  };

  const updateCard = (index: number, field: keyof ScannedCard, value: string) => {
    setCards((prev) => prev.map((card, i) => (i === index ? { ...card, [field]: value } : card)));
  };

  const removeCard = (index: number) => {
    setCards((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    const usable = cards.filter((card) => card.front.trim() && card.back.trim());
    if (!deckName.trim()) {
      setError("Give the deck a name.");
      return;
    }
    if (usable.length === 0) {
      setError("There are no cards left to create.");
      return;
    }
    setIsCreating(true);
    try {
      await onCreate(deckName.trim(), usable);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl p-4 sm:p-7 max-w-lg w-full shadow-2xl relative max-h-[95dvh] flex flex-col overflow-hidden">
        <button
          onClick={onClose}
          disabled={stage === "reading" || isCreating}
          className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition cursor-pointer z-20 disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="shrink-0 pr-8">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Photo to Deck
          </span>
          <h3 className="font-display font-extrabold text-xl text-slate-900 leading-tight">
            {stage === "review" ? "Check what was found" : "Photograph your notes"}
          </h3>
        </div>

        {error && (
          <div className="mt-3 shrink-0 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2 text-xs text-rose-800 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ---------------- capture ---------------- */}
        {stage === "capture" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-500 leading-relaxed">
              Take a photo of a page of notes. The text on it becomes a new deck of cards, each with
              a front and a back.
            </p>

            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition cursor-pointer flex items-center justify-center gap-2.5 shadow-lg"
            >
              <Camera className="w-5 h-5" />
              <span>Take a Photo</span>
            </button>

            <button
              onClick={() => libraryInputRef.current?.click()}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-3 rounded-2xl border border-slate-200 transition cursor-pointer text-sm"
            >
              Choose an existing picture
            </button>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Fill the frame with the page, keep it flat and well lit. Handwriting works, but neat
              printing reads best.
            </p>

            {/* capture="environment" opens the rear camera on a phone */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                handleFile(file);
              }}
            />
            <input
              type="file"
              ref={libraryInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                handleFile(file);
              }}
            />
          </div>
        )}

        {/* ---------------- reading ---------------- */}
        {stage === "reading" && (
          <div className="mt-6 flex flex-col items-center justify-center gap-4 py-10">
            {preview && (
              <img
                src={preview}
                alt="The page being read"
                className="max-h-40 rounded-xl border border-slate-200 shadow-sm"
              />
            )}
            <Loader2 className="w-8 h-8 text-slate-700 animate-spin" />
            <p className="text-sm font-semibold text-slate-500 animate-pulse">
              Reading the page...
            </p>
          </div>
        )}

        {/* ---------------- review ---------------- */}
        {stage === "review" && (
          <>
            <div className="mt-4 shrink-0 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Deck Name
                </label>
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans"
                />
              </div>
              <p className="text-xs text-slate-500">
                {cards.length} {cards.length === 1 ? "card" : "cards"} found. Edit or remove any that
                came out wrong.
              </p>
            </div>

            <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {cards.map((card, index) => (
                <div
                  key={index}
                  className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 space-y-1.5"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 mt-2 w-4 shrink-0 text-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <textarea
                        rows={2}
                        value={card.front}
                        onChange={(e) => updateCard(index, "front", e.target.value)}
                        placeholder="Front"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-sans"
                      />
                      <textarea
                        rows={2}
                        value={card.back}
                        onChange={(e) => updateCard(index, "back", e.target.value)}
                        placeholder="Back"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-sans"
                      />
                    </div>
                    <button
                      onClick={() => removeCard(index)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer shrink-0 mt-1"
                      title="Remove this card"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 shrink-0 flex gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setStage("capture");
                  setCards([]);
                  setPreview(null);
                  setError("");
                }}
                disabled={isCreating}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-3 px-4 rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retake</span>
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || cards.length === 0}
                className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-bold py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Create Deck</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
