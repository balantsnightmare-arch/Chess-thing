import React, { useEffect, useMemo, useState } from "react";
import { ChessCard, ChessDeck } from "../types";
import { getCardItems, getCardTitle, getPrimaryImage, getPrimaryText, makeTextItem, pickRandomIndex } from "../lib/cards";
import { PromptItemRow, PromptItemView } from "./PromptItemView";
import {
  Plus,
  Search,
  Trash2,
  BookOpen,
  ArrowLeft,
  Tag,
  CheckCircle,
  X,
  Edit,
  GraduationCap,
  Layers,
  Shuffle,
  Type,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight
} from "lucide-react";

interface CardListProps {
  deck: ChessDeck;
  cards: ChessCard[];
  onBack: () => void;
  onAddCard: () => void;
  onStudy: () => void;
  onDeleteCard: (cardId: string) => void;
  onToggleMastered: (cardId: string) => void;
  onEditCard: (card: ChessCard) => void;
  /** Study the deck back-to-front: the answer becomes the prompt. */
  isSwapped: boolean;
  onToggleSwap: () => void;
}

export default function CardList({
  deck,
  cards,
  onBack,
  onAddCard,
  onStudy,
  onDeleteCard,
  onToggleMastered,
  onEditCard,
  isSwapped,
  onToggleSwap,
}: CardListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMastered, setFilterMastered] = useState<"All" | "Mastered" | "Review">("All");

  // Selected Card for popup preview
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [isPreviewFlipped, setIsPreviewFlipped] = useState(false);
  // Which prompt was drawn for the front of the previewed card.
  const [previewPromptIndex, setPreviewPromptIndex] = useState(0);

  // Read the card straight from props so toggling mastery inside the modal
  // cannot leave the preview showing a stale copy.
  const previewCard = previewCardId ? cards.find((c) => c.id === previewCardId) ?? null : null;

  const previewItems = useMemo(
    () => (previewCard ? getCardItems(previewCard) : []),
    [previewCard]
  );
  const safePreviewIndex =
    previewItems.length > 0 ? Math.min(previewPromptIndex, previewItems.length - 1) : 0;
  const drawnItem = previewItems[safePreviewIndex];
  const otherItems = previewItems.filter((_, idx) => idx !== safePreviewIndex);

  /*
   * Normal: front is one drawn prompt + the question; back is the remaining
   * prompts + the answer.
   * Swapped: front is the answer, and every prompt plus the question moves to
   * the back, so you recall the prompt from the answer instead.
   */
  const frontItem = isSwapped
    ? previewCard && previewCard.backText.trim()
      ? makeTextItem(previewCard.backText, "swapped-answer")
      : undefined
    : drawnItem;
  const backItems = isSwapped ? previewItems : otherItems;
  const backLabel = isSwapped ? "The prompt" : "Rest of this card";
  const backMainText = isSwapped ? previewCard?.frontText ?? "" : previewCard?.backText ?? "";
  const backMainLabel = isSwapped ? "Question" : "Answer";

  const handleOpenPreview = (card: ChessCard) => {
    setPreviewCardId(card.id);
    setIsPreviewFlipped(false);
    // Draw a random prompt each time the card is opened.
    setPreviewPromptIndex(pickRandomIndex(getCardItems(card).length));
  };

  const handleClosePreview = () => {
    setPreviewCardId(null);
    setIsPreviewFlipped(false);
  };

  const handleShufflePrompt = () => {
    setPreviewPromptIndex((prev) => pickRandomIndex(previewItems.length, prev));
  };

  const filteredCards = cards.filter((card) => {
    const needle = searchQuery.toLowerCase();
    const haystacks = [
      getCardTitle(card),
      card.frontText,
      card.backText,
      ...getCardItems(card)
        .filter((item) => item.kind === "text")
        .map((item) => item.content),
      ...card.tacticalThemes,
    ];
    const matchesSearch = haystacks.some((value) => (value ?? "").toLowerCase().includes(needle));

    const matchesFilter =
      filterMastered === "All" ||
      (filterMastered === "Mastered" && card.mastered) ||
      (filterMastered === "Review" && !card.mastered);

    return matchesSearch && matchesFilter;
  });

  const masteredCount = cards.filter((c) => c.mastered).length;

  // Step through the deck without closing the preview.
  const previewIndex = previewCardId
    ? filteredCards.findIndex((c) => c.id === previewCardId)
    : -1;

  const goToOffset = (offset: number) => {
    const next = filteredCards[previewIndex + offset];
    if (!next) return;
    setPreviewCardId(next.id);
    setIsPreviewFlipped(false);
    // Each card gets its own fresh draw.
    setPreviewPromptIndex(pickRandomIndex(getCardItems(next).length));
  };

  // Arrow keys move between cards, Escape closes, while the preview is open.
  const filteredIds = filteredCards.map((c) => c.id).join("|");
  useEffect(() => {
    if (!previewCardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToOffset(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToOffset(-1);
      } else if (e.key === "Escape") {
        handleClosePreview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewCardId, filteredIds]);

  return (
    <div className="space-y-6">
      {/* Deck Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <button
            onClick={onBack}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 transition flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Decks
          </button>

          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
            {deck.name}
          </h2>

          <p className="text-slate-500 text-sm max-w-xl leading-relaxed font-sans">
            {deck.description || "Study the cards you have added to this deck."}
          </p>

          <div className="flex items-center space-x-3 text-xs text-slate-400 font-medium pt-1.5">
            <span>Total Cards: <strong>{cards.length}</strong></span>
            <span>•</span>
            <span className="text-emerald-600">Mastered: <strong>{masteredCount}</strong></span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onAddCard}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold py-2.5 px-4 rounded-xl transition flex items-center space-x-1.5 border border-slate-200/60 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Card</span>
          </button>

          <button
            onClick={onToggleSwap}
            className={`text-xs sm:text-sm font-semibold py-2.5 px-4 rounded-xl transition flex items-center space-x-1.5 border cursor-pointer ${
              isSwapped
                ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200/60"
            }`}
            title={
              isSwapped
                ? "Currently showing answers first. Click to go back to normal."
                : "Show the answer first and recall the prompt instead"
            }
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>{isSwapped ? "Sides Swapped" : "Swap Sides"}</span>
          </button>

          <button
            onClick={onStudy}
            disabled={cards.length === 0}
            className="bg-amber-400 hover:bg-amber-500 disabled:bg-slate-100 text-slate-950 disabled:text-slate-400 text-xs sm:text-sm font-bold py-2.5 px-6 rounded-xl transition flex items-center space-x-2 shadow-lg shadow-amber-400/10 cursor-pointer disabled:cursor-not-allowed"
          >
            <GraduationCap className="w-4.5 h-4.5" />
            <span>Study Cards</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center space-x-2 bg-slate-100/80 p-1 rounded-xl w-full md:w-auto">
          {(["All", "Mastered", "Review"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMastered(mode)}
              className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                filterMastered === mode
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {mode === "All" ? "All Cards" : mode === "Mastered" ? "Mastered" : "Review Required"}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search cards in deck..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9.5 pr-4 py-2 w-full rounded-xl border border-slate-200 bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-xs sm:text-sm font-sans"
          />
        </div>
      </div>

      {/* Cards List Grid */}
      {filteredCards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCards.map((card) => {
            const itemCount = getCardItems(card).length;
            const thumbnail = getPrimaryImage(card);
            const thumbnailText = getPrimaryText(card);

            return (
              <div
                key={card.id}
                onClick={() => handleOpenPreview(card)}
                className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 flex gap-4 hover:shadow-lg transition duration-200 cursor-pointer relative group"
              >
                {/* Card Mini-Thumbnail */}
                <div className="relative shrink-0">
                  {thumbnail ? (
                    <div className="w-20 h-20 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                      <img
                        src={thumbnail}
                        alt={getCardTitle(card)}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    /* Text-only card: show the first phrase instead of an empty frame */
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-50 to-white rounded-xl overflow-hidden border border-amber-200/70 flex flex-col items-center justify-center text-center p-1.5 gap-1">
                      <Type className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-[9px] font-bold text-slate-700 leading-tight line-clamp-3 break-words">
                        {thumbnailText}
                      </span>
                    </div>
                  )}

                  {itemCount > 1 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 bg-slate-900 text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-700 flex items-center gap-0.5 shadow-sm"
                      title={`${itemCount} prompts — one is drawn at random`}
                    >
                      <Layers className="w-2.5 h-2.5" /> {itemCount}
                    </span>
                  )}
                </div>

                {/* Card Details */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 truncate group-hover:text-amber-800 transition-colors">
                      {getCardTitle(card)}
                    </h4>

                    {/* Mastered / Need Review Status Checkmark (Interactive Toggle) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMastered(card.id);
                      }}
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                        card.mastered
                          ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                      }`}
                      title={card.mastered ? "Click to move to Review" : "Click to mark as Mastered"}
                    >
                      <CheckCircle className={`w-3 h-3 ${card.mastered ? "text-emerald-600 fill-emerald-600" : "text-rose-400"}`} />
                      <span>{card.mastered ? "Mastered" : "Review"}</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {card.frontText || thumbnailText || "Open this card to draw a prompt."}
                  </p>

                  <div className="flex flex-wrap gap-1.5 items-center">
                    {/* Side to Move Badge */}
                    {card.sideToMove === "White" ? (
                      <span className="bg-slate-100 border border-slate-200 text-slate-800 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-white border border-slate-400 rounded-full inline-block" /> White
                      </span>
                    ) : card.sideToMove === "Black" ? (
                      <span className="bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-black border border-slate-600 rounded-full inline-block" /> Black
                      </span>
                    ) : null}

                    {/* Difficulty Tag (only when the card sets one) */}
                    {card.difficulty && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        card.difficulty === "Easy" ? "bg-emerald-50 text-emerald-700" :
                        card.difficulty === "Medium" ? "bg-amber-50 text-amber-700" :
                        "bg-rose-50 text-rose-700"
                      }`}>
                        {card.difficulty}
                      </span>
                    )}

                    {/* Preview Themes tags */}
                    {card.tacticalThemes.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[10px] text-slate-400 font-sans flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5 text-slate-300" /> {tag}
                      </span>
                    ))}
                    {card.tacticalThemes.length > 2 && (
                      <span className="text-[9px] text-slate-400">+{card.tacticalThemes.length - 2} more</span>
                    )}
                  </div>
                </div>

                {/* Action rail (delete button absolute to prevent clicking background preview) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete the card "${getCardTitle(card)}"?`)) {
                      onDeleteCard(card.id);
                    }
                  }}
                  className="absolute right-3.5 bottom-3 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"
                  title="Delete Card"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty Deck State */
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-pulse" />
          <h4 className="font-display font-extrabold text-lg text-slate-800">No cards in this deck view</h4>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            Create your first card using pictures, phrases, or both.
          </p>
          <button
            onClick={onAddCard}
            className="mt-6 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold py-2.5 px-6 rounded-xl transition cursor-pointer"
          >
            Create First Card
          </button>
        </div>
      )}

      {/* Card Preview Modal Popup */}
      {previewCard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative max-h-[95vh] overflow-y-auto no-scrollbar flex flex-col justify-between">

            {/* Modal Close Button */}
            <button
              onClick={handleClosePreview}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full transition cursor-pointer z-20"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-4">
              {/* Header */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Interactive Flashcard Preview
                </span>
                <h3 className="font-display font-extrabold text-xl text-slate-900 leading-tight pr-8">
                  {getCardTitle(previewCard)}
                </h3>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {previewCard.difficulty && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      previewCard.difficulty === "Easy" ? "bg-emerald-50 text-emerald-700" :
                      previewCard.difficulty === "Medium" ? "bg-amber-50 text-amber-700" :
                      "bg-rose-50 text-rose-700"
                    }`}>
                      {previewCard.difficulty} Difficulty
                    </span>
                  )}

                  {previewCard.sideToMove === "White" ? (
                    <span className="bg-slate-100 border border-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white border border-slate-400 rounded-full inline-block" /> White to Play
                    </span>
                  ) : previewCard.sideToMove === "Black" ? (
                    <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-black border border-slate-600 rounded-full inline-block" /> Black to Play
                    </span>
                  ) : null}

                  {!isSwapped && previewItems.length > 1 && (
                    <span className="bg-amber-50 border border-amber-200/70 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <Layers className="w-2.5 h-2.5" /> Prompt {safePreviewIndex + 1} of {previewItems.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Interactive Flippable Card Container */}
              <div className="perspective-1000 w-full min-h-[380px] relative">
                <div
                  onClick={() => setIsPreviewFlipped(!isPreviewFlipped)}
                  className={`w-full h-full min-h-[380px] transition-transform duration-500 preserve-3d cursor-pointer rounded-2xl ${
                    isPreviewFlipped ? "rotate-y-180" : ""
                  }`}
                >
                  {/* CARD FRONT */}
                  <div className="absolute inset-0 w-full h-full bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between backface-hidden shadow-md hover:shadow-lg hover:border-slate-300 transition-all">
                    {/* Front Header */}
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-400 pb-2 border-b border-slate-100">
                      <span>{isSwapped ? "FRONT SIDE (Answer)" : "FRONT SIDE (Question)"}</span>
                      <span className="text-amber-500 font-bold">Click to Flip</span>
                    </div>

                    {/* Front Body (randomly drawn prompt & question) */}
                    <div className="my-auto space-y-3">
                      <div className="max-w-[200px] mx-auto w-full">
                        {frontItem ? (
                          <PromptItemView item={frontItem} alt={getCardTitle(previewCard)} compact />
                        ) : (
                          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl aspect-square flex items-center justify-center text-[11px] text-slate-400 text-center p-4">
                            {isSwapped ? "This card has no answer to show." : "This card has no prompts yet."}
                          </div>
                        )}
                      </div>

                      {!isSwapped && previewItems.length > 1 && (
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShufflePrompt();
                            }}
                            className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                            title="Draw a different prompt"
                          >
                            <Shuffle className="w-3 h-3" /> Shuffle prompt
                          </button>
                        </div>
                      )}

                      {/* Prompt / Question (moves to the back when swapped) */}
                      {!isSwapped && previewCard.frontText && (
                        <div className="text-center bg-slate-50 border border-slate-100/80 rounded-xl p-3">
                          <p className="text-slate-800 text-xs sm:text-sm font-medium font-sans whitespace-pre-line leading-relaxed">
                            {previewCard.frontText}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Front Footer */}
                    <div className="text-center text-[10px] text-slate-400 border-t border-slate-50 pt-2 font-mono">
                      {isSwapped ? "▲ Answer first • Flip for the prompt" : "▲ Drawn at random • Flip to see the rest"}
                    </div>
                  </div>

                  {/* CARD BACK */}
                  <div className="absolute inset-0 w-full h-full bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between backface-hidden shadow-xl rotate-y-180 overflow-hidden">
                    {/* Back Header */}
                    <div className="flex justify-between items-center text-xs font-semibold text-amber-400 pb-2 border-b border-slate-800">
                      <span>{isSwapped ? "BACK SIDE (Prompt)" : "BACK SIDE (Answer)"}</span>
                      <span className="text-amber-500 font-bold">Click to Flip</span>
                    </div>

                    {/* Back Body (remaining prompts, solution & coaching notes) */}
                    <div className="my-auto space-y-3 overflow-y-auto max-h-[220px] no-scrollbar pr-1">
                      {/* Everything that was not drawn for the front */}
                      {backItems.length > 0 && (
                        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-amber-400" /> {backLabel} ({backItems.length})
                          </span>
                          <div className="space-y-1.5">
                            {backItems.map((item, idx) => (
                              <PromptItemRow key={item.id} item={item} index={idx + 1} dark />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Answer, or the question when the sides are swapped */}
                      {backMainText && (
                        <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl p-3">
                          <span className="text-[9px] text-amber-400 font-bold uppercase tracking-widest block mb-1">
                            {backMainLabel}
                          </span>
                          <p className="text-slate-100 text-xs sm:text-sm font-semibold font-sans whitespace-pre-line leading-relaxed">
                            {backMainText}
                          </p>
                        </div>
                      )}

                      {/* Strategic Coach notes */}
                      {previewCard.additionalNotes && (
                        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                            Notes
                          </span>
                          <p className="text-slate-300 text-[11px] font-sans whitespace-pre-line leading-relaxed">
                            {previewCard.additionalNotes}
                          </p>
                        </div>
                      )}

                      {/* Themes tags */}
                      {previewCard.tacticalThemes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {previewCard.tacticalThemes.map((tag) => (
                            <span
                              key={tag}
                              className="bg-slate-900 text-slate-400 text-[9px] font-medium px-2 py-0.5 rounded border border-slate-800"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Back Footer */}
                    <div className="text-center text-[10px] text-slate-500 border-t border-slate-900 pt-2 font-mono">
                      ▼ Solution view • Flip to return
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                {/* Move through the deck without closing */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToOffset(-1)}
                    disabled={previewIndex <= 0}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs sm:text-sm font-bold py-2.5 rounded-xl border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1"
                    title="Previous card (left arrow)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev</span>
                  </button>

                  <span className="text-[11px] font-mono font-semibold text-slate-400 px-2 shrink-0">
                    {previewIndex + 1} / {filteredCards.length}
                  </span>

                  <button
                    onClick={() => goToOffset(1)}
                    disabled={previewIndex < 0 || previewIndex >= filteredCards.length - 1}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs sm:text-sm font-bold py-2.5 rounded-xl border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1"
                    title="Next card (right arrow)"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Large Close Preview Button */}
                <button
                  onClick={handleClosePreview}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-base font-extrabold py-3.5 rounded-2xl transition cursor-pointer text-center shadow-lg"
                >
                  Close Preview
                </button>

                {/* Smaller, Secondary Actions */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => onToggleMastered(previewCard.id)}
                    className={`text-[10px] sm:text-xs font-bold py-2 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-1.5 border ${
                      previewCard.mastered
                        ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    <CheckCircle className={`w-4 h-4 ${previewCard.mastered ? "text-emerald-600 fill-emerald-100" : "text-slate-400"}`} />
                    <span>{previewCard.mastered ? "Mastered" : "Mark Master"}</span>
                  </button>

                  <button
                    onClick={() => {
                      const card = previewCard;
                      handleClosePreview();
                      onEditCard(card);
                    }}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] sm:text-xs font-bold py-2 rounded-xl transition cursor-pointer border border-amber-200/40 flex flex-col items-center justify-center gap-1.5"
                  >
                    <Edit className="w-4 h-4 text-amber-600" />
                    <span>Edit Card</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete the card "${getCardTitle(previewCard)}"?`)) {
                        onDeleteCard(previewCard.id);
                        handleClosePreview();
                      }
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] sm:text-xs font-semibold py-2 rounded-xl transition cursor-pointer border border-rose-100 flex flex-col items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Delete Card</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
