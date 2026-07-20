import React, { useState, useRef } from "react";
import { ChessCard } from "../types";
import { 
  Upload, 
  Sparkles, 
  Save, 
  X, 
  HelpCircle, 
  Tag, 
  Eye, 
  RefreshCw,
  Lightbulb,
  FileImage,
  AlertTriangle
} from "lucide-react";

interface CardCreatorProps {
  deckId: string;
  cardToEdit?: ChessCard;
  onSave: (card: Omit<ChessCard, "id" | "createdAt" | "reviewCount" | "lastReviewedAt" | "mastered">, isEditId?: string) => void;
  onCancel: () => void;
}

export default function CardCreator({ deckId, cardToEdit, onSave, onCancel }: CardCreatorProps) {
  const [image, setImage] = useState<string | null>(cardToEdit?.imageUrl || null);
  const [title, setTitle] = useState(cardToEdit?.title || "");
  const [sideToMove, setSideToMove] = useState<"White" | "Black" | "Unknown">(cardToEdit?.sideToMove || "White");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(cardToEdit?.tacticalThemes || []);
  const [frontText, setFrontText] = useState(cardToEdit?.frontText || "");
  const [backText, setBackText] = useState(cardToEdit?.backText || "");
  const [additionalNotes, setAdditionalNotes] = useState(cardToEdit?.additionalNotes || "");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">(cardToEdit?.difficulty || "Medium");

  // AI loading state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert File to base64
  const handleFileChange = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
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
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Run Gemini AI Analysis
  const handleAiAnalysis = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setAnalysisError("");

    try {
      const res = await fetch("/api/analyze-position", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image }),
      });

      if (!res.ok) {
        throw new Error("Failed to analyze image. Ensure your server is active.");
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
      setAnalysisError("AI analysis failed. Please manually fill in the card details below.");
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
    if (!image) {
      alert("Please upload an image of the chess position.");
      return;
    }
    if (!title.trim() || !frontText.trim() || !backText.trim()) {
      alert("Please fill out Title, Question/Front, and Solution/Back text.");
      return;
    }

    onSave({
      deckId,
      title: title.trim(),
      imageUrl: image,
      sideToMove,
      tacticalThemes: tags,
      frontText: frontText.trim(),
      backText: backText.trim(),
      additionalNotes: additionalNotes.trim(),
      difficulty,
    }, cardToEdit?.id);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start pb-5 border-b border-slate-100">
        <div>
          <h3 className="font-display font-extrabold text-2xl text-slate-900 flex items-center gap-2">
            {cardToEdit ? "Edit Chess Flashcard" : "Create Chess Flashcard"}
          </h3>
          <p className="text-sm text-slate-500 font-sans mt-1">
            {cardToEdit 
              ? "Modify details of your chess study card." 
              : "Upload an image of your chess position to start studying it."}
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
        
        {/* LEFT COLUMN: Upload and AI triggering (5/12 span) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Chess Board Image *
            </label>
            
            {/* Drag & Drop Upload Zone */}
            {!image ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[260px] ${
                  isDragActive
                    ? "border-amber-400 bg-amber-50/20"
                    : "border-slate-200 hover:border-amber-400 hover:bg-slate-50"
                }`}
              >
                <div className="bg-slate-50 text-slate-400 p-4 rounded-full mb-3">
                  <Upload className="w-6 h-6 text-slate-500" />
                </div>
                <p className="font-display font-bold text-sm text-slate-800">
                  Drag & drop image here
                </p>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Supports JPEG, PNG, or SVGs up to 10MB
                </p>
                <span className="mt-4 inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                  Browse Files
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file);
                  }}
                  className="hidden"
                />
              </div>
            ) : (
              /* Image Preview with Reset option */
              <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50 flex flex-col items-center relative group">
                <div className="w-full h-64 flex items-center justify-center overflow-hidden rounded-xl bg-slate-900 border border-slate-800 relative">
                  <img
                    src={image}
                    alt="Chess position board preview"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                  
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="absolute top-3 right-3 bg-red-600/90 hover:bg-red-700 text-white p-2 rounded-xl shadow-md transition"
                    title="Remove Image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-xs text-slate-400 font-sans mt-2 flex items-center gap-1">
                  <FileImage className="w-3.5 h-3.5" /> Position picture uploaded
                </p>
              </div>
            )}
          </div>

          {/* AI trigger Button */}
          {image && (
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
                    Gemini will analyze your board image, detect white vs black pieces, draft a core puzzle question, provide solutions, and annotate positional details automatically!
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
              Flashcard Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Back-Rank Weakness, Philidor Smothered Mate"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Side to Play */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Side to Play
              </label>
              <select
                value={sideToMove}
                onChange={(e) => setSideToMove(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans bg-white"
              >
                <option value="White">White to Play</option>
                <option value="Black">Black to Play</option>
                <option value="Unknown">Unknown / Setup</option>
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans bg-white"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Tactical Themes / Tag input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tactical Themes (Tags)
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
              Examples: Pin, Fork, Double Check, Skewer, Deflection, Endgame
            </span>
          </div>

          {/* FRONT TEXT: Question/Study prompt */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex justify-between">
              <span>Card Front (Question/Prompt) *</span>
              <span className="text-[10px] text-slate-400 uppercase">Visible on front side</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Find the winning knight sacrifice. What are White's threats?"
              value={frontText}
              onChange={(e) => setFrontText(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans resize-none"
            />
          </div>

          {/* BACK TEXT: Answer/Solution */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex justify-between">
              <span>Card Back (Solution/Answer) *</span>
              <span className="text-[10px] text-slate-400 uppercase">Visible on back side</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. 1. Nxf7+! Rxf7 2. Qxe8+ winning back-rank material checkmate."
              value={backText}
              onChange={(e) => setBackText(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans resize-none"
            />
          </div>

          {/* ADDITIONAL NOTES */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Additional Notes (Coaching tips & annotations)
            </label>
            <textarea
              rows={3}
              placeholder="Add strategic guidelines, chess history, or mental safety rules for study cards..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans resize-none"
            />
          </div>

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
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-slate-900/10 cursor-pointer"
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
