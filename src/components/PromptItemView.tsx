import React from "react";
import { CardItem } from "../types";
import { FileImage, Type } from "lucide-react";

/**
 * Renders one prompt item (a picture or a phrase). Used for the randomly drawn
 * item on the front of a card and for the leftover items listed on the back.
 */
export function PromptItemView({
  item,
  alt,
  compact = false,
}: {
  item: CardItem;
  alt: string;
  compact?: boolean;
}) {
  if (item.kind === "image") {
    return (
      <div
        className={`bg-slate-900 rounded-2xl shadow-md border border-slate-800 w-full aspect-square flex items-center justify-center overflow-hidden ${
          compact ? "p-1.5" : "p-2.5"
        }`}
      >
        <img
          src={item.content}
          alt={alt}
          className="w-full h-full object-contain rounded-lg"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={`bg-gradient-to-br from-amber-50 to-white border border-amber-200/70 rounded-2xl w-full aspect-square flex items-center justify-center text-center overflow-hidden ${
        compact ? "p-3" : "p-5"
      }`}
    >
      <p
        className={`font-display font-extrabold text-slate-900 leading-tight break-words whitespace-pre-line overflow-y-auto max-h-full no-scrollbar ${
          compact ? "text-sm" : "text-xl sm:text-2xl"
        }`}
      >
        {item.content}
      </p>
    </div>
  );
}

/** Compact row used in the "other prompts" list on the back of a card. */
export function PromptItemRow({
  item,
  index,
  dark = false,
}: {
  item: CardItem;
  index: number;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl p-2 border ${
        dark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200"
      }`}
    >
      <span
        className={`text-[10px] font-mono font-bold w-4 shrink-0 text-center ${
          dark ? "text-slate-500" : "text-slate-400"
        }`}
      >
        {index}
      </span>

      {item.kind === "image" ? (
        <>
          <div className="w-11 h-11 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shrink-0 flex items-center justify-center">
            <img
              src={item.content}
              alt={`Prompt ${index}`}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <span
            className={`text-[11px] italic flex items-center gap-1 ${
              dark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            <FileImage className="w-3.5 h-3.5" /> Picture
          </span>
        </>
      ) : (
        <>
          <div
            className={`w-11 h-11 rounded-lg shrink-0 flex items-center justify-center border ${
              dark ? "bg-amber-400/10 border-amber-400/20" : "bg-amber-50 border-amber-100"
            }`}
          >
            <Type className={`w-4 h-4 ${dark ? "text-amber-400" : "text-amber-600"}`} />
          </div>
          <p
            className={`flex-1 min-w-0 text-xs sm:text-sm font-semibold font-sans break-words ${
              dark ? "text-slate-100" : "text-slate-800"
            }`}
          >
            {item.content}
          </p>
        </>
      )}
    </div>
  );
}
