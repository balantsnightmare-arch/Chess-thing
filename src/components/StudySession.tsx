import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChessCard, ChessDeck } from "../types";
import { getCardItems, getCardTitle, makeTextItem, pickRandomIndex } from "../lib/cards";
import { PromptItemRow, PromptItemView } from "./PromptItemView";
import {
  X,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Award,
  Lightbulb,
  Tag,
  RefreshCw,
  Zap,
  Play,
  Shuffle,
  Layers
} from "lucide-react";

interface StudySessionProps {
  deck: ChessDeck;
  cards: ChessCard[];
  onClose: () => void;
  onUpdateCardProgress: (cardId: string, mastered: boolean) => void;
  /** Study the deck back-to-front: the answer becomes the prompt. */
  isSwapped: boolean;
}

export default function StudySession({
  deck,
  cards,
  onClose,
  onUpdateCardProgress,
  isSwapped,
}: StudySessionProps) {
  // The session is stored as an ordered list of card ids, not card objects.
  // Grading a card reloads the deck from storage, which used to hand this
  // component a brand new `cards` array and reset the run back to card 1.
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Which prompt is currently drawn for the card on screen.
  const [promptIndex, setPromptIndex] = useState(0);

  // Track stats for current study run
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [incorrectCardIds, setIncorrectCardIds] = useState<string[]>([]);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  // Only the membership of the deck restarts a run; edits to a card's mastery
  // or review count leave the session untouched.
  const deckMembership = useMemo(() => cards.map((card) => card.id).join("|"), [cards]);

  const resetRun = useCallback((ids: string[]) => {
    setSessionIds(ids);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsFinished(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setIncorrectCardIds([]);
  }, []);

  useEffect(() => {
    resetRun(deckMembership ? deckMembership.split("|") : []);
  }, [deck.id, deckMembership, resetRun]);

  const sessionCards = useMemo(
    () =>
      sessionIds
        .map((id) => cardsById.get(id))
        .filter((card): card is ChessCard => card !== undefined),
    [sessionIds, cardsById]
  );

  const currentCard = sessionCards[currentIndex];
  const promptItems = useMemo(
    () => (currentCard ? getCardItems(currentCard) : []),
    [currentCard]
  );

  // Draw a fresh random prompt whenever a different card comes up.
  useEffect(() => {
    if (!currentCard) return;
    setPromptIndex(pickRandomIndex(getCardItems(currentCard).length));
  }, [currentCard?.id]);

  const safePromptIndex = promptItems.length > 0 ? Math.min(promptIndex, promptItems.length - 1) : 0;
  const drawnItem = promptItems[safePromptIndex];
  const otherItems = promptItems.filter((_, idx) => idx !== safePromptIndex);

  /*
   * Swapped decks show the answer first; every prompt and the question move to
   * the back, so the card is recalled in reverse.
   */
  const frontItem = isSwapped
    ? currentCard && currentCard.backText.trim()
      ? makeTextItem(currentCard.backText, "swapped-answer")
      : undefined
    : drawnItem;
  const backItems = isSwapped ? promptItems : otherItems;
  const backLabel = isSwapped ? "The prompt" : "Rest of this card";
  const backMainText = isSwapped ? currentCard?.frontText ?? "" : currentCard?.backText ?? "";
  const backMainLabel = isSwapped ? "Question" : "Answer";

  const handleShufflePrompt = () => {
    setPromptIndex((prev) => pickRandomIndex(promptItems.length, prev));
  };

  const handleNext = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < sessionCards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsFinished(true);
      }
    }, 150);
  }, [currentIndex, sessionCards.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex === 0) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(currentIndex - 1), 150);
  }, [currentIndex]);

  const handleGrade = useCallback(
    (gotIt: boolean) => {
      if (!currentCard) return;

      // Record grading
      if (gotIt) {
        setCorrectCount((prev) => prev + 1);
      } else {
        setIncorrectCount((prev) => prev + 1);
        setIncorrectCardIds((prev) => [...prev, currentCard.id]);
      }

      // Call upstream trigger to persist card's mastery state
      onUpdateCardProgress(currentCard.id, gotIt);

      // Proceed to next card automatically with brief delay to let them see the flip reset
      handleNext();
    },
    [currentCard, handleNext, onUpdateCardProgress]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.code === "Digit1" || e.code === "Numpad1") {
        e.preventDefault();
        handleGrade(false);
      } else if (e.code === "Digit2" || e.code === "Numpad2") {
        e.preventDefault();
        handleGrade(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFinished, handleNext, handlePrev, handleGrade]);

  if (sessionCards.length === 0 || !currentCard) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-slate-200">
        <HelpCircle className="w-16 h-16 text-slate-300 mb-4 animate-bounce" />
        <h3 className="font-display font-extrabold text-xl text-slate-800">No cards in this deck</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-sm">
          You need to add at least one card to this deck to start studying it.
        </p>
        <button
          onClick={onClose}
          className="mt-6 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 px-6 rounded-xl transition cursor-pointer"
        >
          Go Back and Create Cards
        </button>
      </div>
    );
  }

  const handleRestartAll = () => {
    resetRun(cards.map((card) => card.id));
  };

  const handleRestartIncorrect = () => {
    resetRun(cards.filter((c) => incorrectCardIds.includes(c.id)).map((card) => card.id));
  };

  const gradedTotal = Math.max(1, correctCount + incorrectCount);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Session Header */}
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Studying Deck
          </span>
          <h3 className="font-display font-extrabold text-lg text-slate-800 line-clamp-1">
            {deck.name}
          </h3>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition cursor-pointer"
          title="Exit Study Mode"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!isFinished ? (
        <div className="space-y-6">
          {/* Progress Bar & Instructions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center space-x-3">
              <span className="bg-slate-900 text-white text-xs font-mono font-semibold px-2.5 py-1 rounded-lg">
                Card {currentIndex + 1} / {sessionCards.length}
              </span>
              <span className="text-xs text-slate-500 font-sans hidden sm:inline">
                • Press <strong>Space</strong> to Flip, <strong>← / →</strong> to Navigate, <strong>1 / 2</strong> to Grade
              </span>
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
              <span className="text-emerald-600 font-bold">{correctCount} mastered</span>
              <span>•</span>
              <span className="text-red-500 font-bold">{incorrectCount} review again</span>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / sessionCards.length) * 100}%` }}
            />
          </div>

          {/* Interactive Card Stage */}
          <div className="perspective-1000 w-full min-h-[460px] sm:min-h-[500px] relative">
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className={`w-full h-full min-h-[460px] sm:min-h-[500px] transition-transform duration-500 preserve-3d cursor-pointer rounded-3xl ${
                isFlipped ? "rotate-y-180" : ""
              }`}
            >
              {/* CARD FRONT */}
              <div className="absolute inset-0 w-full h-full bg-white border-2 border-slate-200 rounded-3xl p-6 flex flex-col justify-between backface-hidden shadow-lg hover:shadow-xl hover:border-slate-300 transition-all">
                {/* Front Header */}
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    {/* Dynamic side indicator tag */}
                    {currentCard.sideToMove === "White" ? (
                      <span className="bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-white border border-slate-400 rounded-full inline-block" />
                        White to Play
                      </span>
                    ) : currentCard.sideToMove === "Black" ? (
                      <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-black border border-slate-600 rounded-full inline-block" />
                        Black to Play
                      </span>
                    ) : currentCard.sideToMove === "Unknown" ? (
                      <span className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-lg">
                        Setup Position
                      </span>
                    ) : null}

                    {currentCard.difficulty && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        currentCard.difficulty === "Easy" ? "bg-emerald-50 text-emerald-700" :
                        currentCard.difficulty === "Medium" ? "bg-amber-50 text-amber-700" :
                        "bg-rose-50 text-rose-700"
                      }`}>
                        {currentCard.difficulty}
                      </span>
                    )}
                  </div>

                  <div className="text-slate-400 flex items-center space-x-1 text-xs">
                    <RotateCw className="w-4 h-4 animate-spin-slow text-amber-500" />
                    <span>Click card to reveal the other side</span>
                  </div>
                </div>

                {/* Front Body (Grid layout for the drawn prompt & question text) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto items-center">
                  {/* Randomly drawn prompt: a picture or a phrase */}
                  <div className="w-full flex flex-col items-center gap-2">
                    <div className="w-full max-w-[280px] sm:max-w-[320px]">
                      {frontItem ? (
                        <PromptItemView item={frontItem} alt={getCardTitle(currentCard)} />
                      ) : (
                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl aspect-square flex items-center justify-center text-xs text-slate-400 text-center p-4">
                          {isSwapped ? "This card has no answer to show." : "This card has no prompts yet."}
                        </div>
                      )}
                    </div>

                    {!isSwapped && promptItems.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          Prompt {safePromptIndex + 1} of {promptItems.length}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShufflePrompt();
                          }}
                          className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 px-2 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1"
                          title="Draw a different prompt"
                        >
                          <Shuffle className="w-3 h-3" /> Shuffle
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Question Prompt */}
                  <div className="space-y-4">
                    <h4 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 leading-tight">
                      {getCardTitle(currentCard)}
                    </h4>

                    <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 shadow-inner">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isSwapped ? "Recall the prompt" : "Question / Study Prompt"}
                      </div>
                      <p className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-line font-sans">
                        {isSwapped
                          ? "What was on the front of this card?"
                          : currentCard.frontText || "What is the answer?"}
                      </p>
                    </div>

                    {currentCard.tacticalThemes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {currentCard.tacticalThemes.map((tag, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-100 text-slate-600 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-1"
                          >
                            <Tag className="w-3 h-3 text-slate-400" /> {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Front Footer */}
                <div className="text-center text-xs font-medium text-slate-400 border-t border-slate-50 pt-3">
                  Click to Flip
                </div>
              </div>

              {/* CARD BACK */}
              <div className="absolute inset-0 w-full h-full bg-slate-950 border-2 border-amber-400/30 rounded-3xl p-6 flex flex-col justify-between backface-hidden shadow-2xl rotate-y-180 overflow-hidden">
                {/* Back Decoration lines */}
                <div className="absolute -right-16 -top-16 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

                {/* Back Header */}
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/80 relative z-10">
                  <div className="flex items-center space-x-2 text-amber-400">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {isSwapped ? "The prompt" : "Answer"}
                    </span>
                  </div>

                  <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-mono font-medium">
                    Card Back
                  </span>
                </div>

                {/* Back Body (Scrollable solution, remaining prompts & notes) */}
                <div className="my-auto space-y-4 max-h-[300px] sm:max-h-[340px] overflow-y-auto pr-1 no-scrollbar relative z-10">
                  {/* The prompts that were not drawn for the front */}
                  {backItems.length > 0 && (
                    <div className="bg-slate-900/60 border border-slate-800/70 rounded-2xl p-4">
                      <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        {backLabel} ({backItems.length})
                      </h5>
                      <div className="space-y-2">
                        {backItems.map((item, idx) => (
                          <PromptItemRow key={item.id} item={item} index={idx + 1} dark />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Answer, or the question when the sides are swapped */}
                  {backMainText && (
                    <div className="bg-amber-400/5 border border-amber-400/15 rounded-2xl p-4">
                      <h5 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> {backMainLabel}
                      </h5>
                      <p className="text-slate-100 font-semibold text-sm sm:text-base leading-relaxed whitespace-pre-line font-sans">
                        {backMainText}
                      </p>
                    </div>
                  )}

                  {/* Additional Notes */}
                  {currentCard.additionalNotes && (
                    <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4">
                      <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Notes
                      </h5>
                      <p className="text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-sans">
                        {currentCard.additionalNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Back Footer */}
                <div className="text-center text-xs font-medium text-slate-500 border-t border-slate-900/60 pt-3 relative z-10">
                  Click to Flip back
                </div>
              </div>
            </div>
          </div>

          {/* Navigation and Grading Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            {/* Nav Arrows */}
            <div className="flex justify-center space-x-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-40 rounded-xl transition disabled:cursor-not-allowed cursor-pointer"
                title="Previous card (←)"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
              </button>

              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center space-x-2 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>Flip Card (Space)</span>
              </button>

              <button
                onClick={handleNext}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition cursor-pointer"
                title="Next card (→)"
              >
                <ArrowRight className="w-5 h-5 text-slate-700" />
              </button>
            </div>

            {/* Grading buttons */}
            <div className="flex flex-1 justify-center sm:justify-end gap-3">
              <button
                onClick={() => handleGrade(false)}
                className="flex-1 sm:flex-none max-w-[200px] bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/60 font-semibold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Need Review (1)</span>
              </button>

              <button
                onClick={() => handleGrade(true)}
                className="flex-1 sm:flex-none max-w-[200px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 font-semibold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Got It! (2)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* FINISHED SUMMARY SCREEN */
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-6 shadow-xl relative overflow-hidden">
          {/* Confetti element */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-emerald-500" />

          <div className="max-w-md mx-auto space-y-4 pt-4">
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto shadow-inner">
              <Award className="w-8 h-8" />
            </div>

            <h3 className="font-display font-extrabold text-3xl text-slate-900 leading-tight">
              Session Completed!
            </h3>

            <p className="text-sm text-slate-500 font-sans">
Excellent job reviewing your cards. Testing your recall is the most reliable way to commit things to memory.
            </p>

            {/* Run Stats */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl my-6">
              <div className="text-center border-r border-slate-200/60">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">
                  Mastered
                </span>
                <span className="text-2xl font-extrabold text-emerald-600 font-mono">
                  {correctCount}
                </span>
                <span className="text-xs text-slate-400 font-medium block">
                  ({Math.round((correctCount / gradedTotal) * 100)}%)
                </span>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">
                  Still Learning
                </span>
                <span className="text-2xl font-extrabold text-red-500 font-mono">
                  {incorrectCount}
                </span>
                <span className="text-xs text-slate-400 font-medium block">
                  ({Math.round((incorrectCount / gradedTotal) * 100)}%)
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleRestartAll}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-3 px-5 rounded-xl transition flex items-center justify-center space-x-2 shadow-md shadow-slate-950/5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Study All Cards Again</span>
              </button>

              {incorrectCount > 0 && (
                <button
                  onClick={handleRestartIncorrect}
                  className="flex-1 bg-amber-400 hover:bg-amber-500 text-slate-950 text-sm font-semibold py-3 px-5 rounded-xl transition flex items-center justify-center space-x-2 shadow-md shadow-amber-400/5 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>Review Still Learning ({incorrectCount})</span>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold py-2.5 rounded-xl border border-slate-200/60 transition mt-2 cursor-pointer"
            >
              Back to Deck Manager
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
