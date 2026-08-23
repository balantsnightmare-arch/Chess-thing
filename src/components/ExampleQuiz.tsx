import React, { useCallback, useMemo, useState } from "react";
import { ChessCard, ChessDeck } from "../types";
import { getCardExamples, getCardTitle, shuffled } from "../lib/cards";
import { X, CheckCircle, XCircle, Award, RefreshCw, ListPlus, ArrowRight } from "lucide-react";

interface ExampleQuizProps {
  deck: ChessDeck;
  cards: ChessCard[];
  onClose: () => void;
}

interface PoolEntry {
  example: string;
  cardId: string;
}

/** How many cards to offer as answers, including the right one. */
const MAX_OPTIONS = 6;

export default function ExampleQuiz({ deck, cards, onClose }: ExampleQuizProps) {
  // Every example in the deck, tagged with the card it came from.
  const pool = useMemo<PoolEntry[]>(
    () =>
      cards.flatMap((card) =>
        getCardExamples(card).map((example) => ({ example, cardId: card.id }))
      ),
    [cards]
  );

  // Shuffled once per run, then walked in order, so nothing repeats.
  const poolSignature = useMemo(
    () => pool.map((entry) => `${entry.cardId}:${entry.example}`).join("|"),
    [pool]
  );
  const [order, setOrder] = useState<PoolEntry[]>(() => shuffled(pool));
  const [index, setIndex] = useState(0);
  const [chosenCardId, setChosenCardId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const restart = useCallback(() => {
    setOrder(shuffled(pool));
    setIndex(0);
    setChosenCardId(null);
    setCorrectCount(0);
    setWrongCount(0);
    setIsFinished(false);
  }, [pool]);

  // A card being added or edited mid-run rebuilds the run rather than leaving
  // the walk pointing at examples that no longer exist.
  const [lastSignature, setLastSignature] = useState(poolSignature);
  if (lastSignature !== poolSignature) {
    setLastSignature(poolSignature);
    restart();
  }

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const current = order[index];

  // Answer choices: the right card plus a sample of the deck's other cards.
  const options = useMemo(() => {
    if (!current) return [];
    const others = cards.filter((card) => card.id !== current.cardId);
    const picked = shuffled(others).slice(0, Math.max(0, MAX_OPTIONS - 1));
    const correct = cardsById.get(current.cardId);
    return shuffled(correct ? [correct, ...picked] : picked);
  }, [current, cards, cardsById]);

  if (pool.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-slate-200">
        <ListPlus className="w-14 h-14 text-slate-300 mb-4" />
        <h3 className="font-display font-extrabold text-xl text-slate-800">No examples yet</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
          Add examples to a card and they will show up here. You are given one example at a time and
          name the card it belongs to.
        </p>
        <button
          onClick={onClose}
          className="mt-6 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 px-6 rounded-xl transition cursor-pointer"
        >
          Back to Deck
        </button>
      </div>
    );
  }

  const answered = chosenCardId !== null;

  const handleChoose = (cardId: string) => {
    if (answered || !current) return;
    setChosenCardId(cardId);
    if (cardId === current.cardId) setCorrectCount((n) => n + 1);
    else setWrongCount((n) => n + 1);
  };

  const handleNext = () => {
    setChosenCardId(null);
    if (index < order.length - 1) setIndex(index + 1);
    else setIsFinished(true);
  };

  const total = order.length;
  const graded = Math.max(1, correctCount + wrongCount);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-5 sm:px-6 py-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Studying Examples
          </span>
          <h3 className="font-display font-extrabold text-lg text-slate-800 line-clamp-1">
            {deck.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition cursor-pointer shrink-0"
          title="Exit"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!isFinished ? (
        <div className="space-y-5">
          {/* Progress */}
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="bg-slate-900 text-white text-xs font-mono font-semibold px-2.5 py-1 rounded-lg">
              Example {index + 1} / {total}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-emerald-600 font-bold">{correctCount} right</span>
              <span className="text-slate-400">•</span>
              <span className="text-rose-500 font-bold">{wrongCount} wrong</span>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>

          {/* The example */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
              Example
            </span>
            <p className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 leading-snug whitespace-pre-line break-words">
              {current?.example}
            </p>
          </div>

          {/* Which card did it come from? */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-700">
              Which card is this an example of?
            </p>

            <div className="grid grid-cols-1 gap-2">
              {options.map((card) => {
                const isCorrect = current && card.id === current.cardId;
                const isChosen = chosenCardId === card.id;
                let tone = "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800";
                if (answered && isCorrect) {
                  tone = "bg-emerald-50 border-emerald-300 text-emerald-900";
                } else if (answered && isChosen) {
                  tone = "bg-rose-50 border-rose-300 text-rose-900";
                } else if (answered) {
                  tone = "bg-slate-50 border-slate-200 text-slate-400";
                }
                return (
                  <button
                    key={card.id}
                    onClick={() => handleChoose(card.id)}
                    disabled={answered}
                    className={`text-left text-sm sm:text-base font-semibold py-3 px-4 rounded-xl border transition flex items-center justify-between gap-3 ${tone} ${
                      answered ? "cursor-default" : "cursor-pointer"
                    }`}
                  >
                    <span className="min-w-0 break-words">{getCardTitle(card)}</span>
                    {answered && isCorrect && (
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                    {answered && isChosen && !isCorrect && (
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {answered && (
              <button
                onClick={handleNext}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{index < total - 1 ? "Next Example" : "See Results"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Summary */
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-emerald-500" />
          <div className="bg-emerald-50 text-emerald-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto shadow-inner">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="font-display font-extrabold text-3xl text-slate-900">All examples done</h3>
          <p className="text-sm text-slate-500 font-sans">
            You worked through every example in this deck.
          </p>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <div className="text-center border-r border-slate-200/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">
                Right
              </span>
              <span className="text-2xl font-extrabold text-emerald-600 font-mono">
                {correctCount}
              </span>
              <span className="text-xs text-slate-400 font-medium block">
                ({Math.round((correctCount / graded) * 100)}%)
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">
                Wrong
              </span>
              <span className="text-2xl font-extrabold text-rose-500 font-mono">{wrongCount}</span>
              <span className="text-xs text-slate-400 font-medium block">
                ({Math.round((wrongCount / graded) * 100)}%)
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={restart}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-3 px-5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Go Again</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold py-3 rounded-xl border border-slate-200/60 transition cursor-pointer"
            >
              Back to Deck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
