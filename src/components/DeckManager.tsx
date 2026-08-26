import React, { useState } from "react";
import { ChessDeck, ChessCard } from "../types";
import ScanSheet, { ScannedCard } from "./ScanSheet";
import { 
  FolderPlus, 
  Trash2, 
  BookOpen, 
  Search, 
  Download, 
  Upload, 
  Layers,
  ChevronRight,
  Sparkles,
  Camera
} from "lucide-react";

interface DeckManagerProps {
  decks: ChessDeck[];
  cards: ChessCard[];
  onSelectDeck: (deckId: string) => void;
  onCreateDeck: (name: string, description: string) => void;
  onDeleteDeck: (deckId: string) => void;
  onImportData: (jsonData: string) => void;
  onCreateDeckFromScan: (deckName: string, cards: ScannedCard[]) => Promise<void>;
}

export default function DeckManager({
  decks,
  cards,
  onSelectDeck,
  onCreateDeck,
  onDeleteDeck,
  onImportData,
  onCreateDeckFromScan,
}: DeckManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDesc, setNewDeckDesc] = useState("");
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);

  const filteredDecks = decks.filter(
    (deck) =>
      deck.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCardCount = (deckId: string) => {
    return cards.filter((card) => card.deckId === deckId).length;
  };

  const getMasteredCount = (deckId: string) => {
    return cards.filter((card) => card.deckId === deckId && card.mastered).length;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    onCreateDeck(newDeckName, newDeckDesc);
    setNewDeckName("");
    setNewDeckDesc("");
    setShowCreateModal(false);
  };

  // Export full backup of Decks and Cards as a JSON file
  const handleExport = () => {
    const dataStr = JSON.stringify({ decks, cards }, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `flashcards-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  // Import JSON backup
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still fires a change event.
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        // Basic validation
        const parsed = JSON.parse(content);
        if (!parsed.decks || !parsed.cards) {
          setImportError("Invalid backup file. Must contain 'decks' and 'cards' arrays.");
          return;
        }
        
        onImportData(content);
        setImportSuccess(true);
        setImportError("");
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (err) {
        setImportError("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 transform translate-x-12 -translate-y-12 opacity-5 pointer-events-none">
          {/* Subtle chess board pattern in background */}
          <div className="grid grid-cols-4 w-96 h-96 border border-white">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={`w-24 h-24 ${i % 2 === 0 ? "bg-white" : ""}`} />
            ))}
          </div>
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <span className="bg-amber-400 text-slate-900 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
            <Sparkles className="w-3 h-3 animate-spin-slow" /> Powered by Gemini AI
          </span>
          <h2 className="font-display font-extrabold text-2xl sm:text-4xl text-slate-50 mt-3 tracking-tight leading-tight">
            Level up your memory.
          </h2>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed font-sans">
            Add pictures and phrases, write notes, and build interactive Quizlet-style cards. Double your learning speed with 3D flip cards and topic tracking.
          </p>
          
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-amber-400 hover:bg-amber-500 text-slate-950 px-5 py-2 rounded-xl text-sm font-semibold transition flex items-center space-x-2 shadow-lg shadow-amber-400/10 cursor-pointer"
            >
              <FolderPlus className="w-4.5 h-4.5" />
              <span>Create New Deck</span>
            </button>
            
            <button
              onClick={() => setIsScanOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center space-x-2 cursor-pointer"
              title="Photograph a page of notes and turn it into a deck"
            >
              <Camera className="w-4 h-4" />
              <span>Scan a Sheet</span>
            </button>

            <button
              onClick={handleExport}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center space-x-2 cursor-pointer"
              title="Export all data as backup JSON"
            >
              <Download className="w-4 h-4" />
              <span>Export Decks</span>
            </button>

            <label className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center space-x-2 cursor-pointer relative">
              <Upload className="w-4 h-4" />
              <span>Import Decks</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>

          {importError && (
            <p className="text-red-300 text-xs mt-3 bg-red-950/40 border border-red-900/50 px-3 py-1.5 rounded-lg w-max">
              {importError}
            </p>
          )}
          {importSuccess && (
            <p className="text-emerald-300 text-xs mt-3 bg-emerald-950/40 border border-emerald-900/50 px-3 py-1.5 rounded-lg w-max">
              ✓ Decks and cards imported successfully!
            </p>
          )}
        </div>
      </div>

      {/* Main Grid Header / Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="font-display font-extrabold text-2xl text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-slate-600" /> Study Decks
          </h3>
          <p className="text-sm text-slate-500 font-sans mt-1">Select a deck or create one to start studying cards</p>
        </div>

        <div className="relative max-w-sm w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search decks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full rounded-xl border border-slate-200 bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm font-sans"
          />
        </div>
      </div>

      {/* Decks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDecks.map((deck) => {
          const cardCount = getCardCount(deck.id);
          const masteredCount = getMasteredCount(deck.id);
          const progress = cardCount > 0 ? Math.round((masteredCount / cardCount) * 100) : 0;

          return (
            <div
              key={deck.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-xl hover:border-slate-300 transition-all flex flex-col justify-between group relative"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="bg-slate-100 group-hover:bg-amber-100 text-slate-700 group-hover:text-amber-800 p-3 rounded-xl transition duration-300">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  
                  {/* Delete button only if it's not the last/default deck, or always allowed */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete "${deck.name}"? This will permanently delete all ${cardCount} cards in this deck!`)) {
                        onDeleteDeck(deck.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Delete deck"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="font-display font-bold text-lg text-slate-900 mt-4 group-hover:text-amber-900 transition-colors">
                  {deck.name}
                </h4>
                <p className="text-slate-500 text-xs sm:text-sm font-sans mt-2 line-clamp-2 leading-relaxed">
                  {deck.description || "No description provided."}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>{cardCount} {cardCount === 1 ? "card" : "cards"}</span>
                  <span className="text-slate-900">{masteredCount} Mastered ({progress}%)</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-5">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <button
                  onClick={() => onSelectDeck(deck.id)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center space-x-1.5 shadow-md shadow-slate-950/5 group cursor-pointer"
                >
                  <span>Open Deck</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Create Deck Card */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="border-2 border-dashed border-slate-200 hover:border-amber-400 hover:bg-amber-50/10 rounded-2xl p-6 transition duration-300 flex flex-col items-center justify-center text-center space-y-3 cursor-pointer group h-full min-h-[220px]"
        >
          <div className="bg-slate-50 group-hover:bg-amber-50 text-slate-400 group-hover:text-amber-600 p-4 rounded-full transition duration-300">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div>
            <span className="font-display font-bold text-slate-800 group-hover:text-amber-800 block">
              Add New Deck
            </span>
            <span className="text-xs text-slate-400 font-sans mt-1">
              Organize cards by subject, level, or theme
            </span>
          </div>
        </button>
      </div>

      {/* Empty Search State */}
      {filteredDecks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="font-display font-bold text-slate-800">No decks found</h4>
          <p className="text-sm text-slate-400 mt-1">Try tweaking your search query or create a new deck.</p>
        </div>
      )}

      {isScanOpen && (
        <ScanSheet
          onClose={() => setIsScanOpen(false)}
          onCreate={async (name, cards) => {
            await onCreateDeckFromScan(name, cards);
            setIsScanOpen(false);
          }}
        />
      )}

      {/* Create Deck Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <h3 className="font-display font-extrabold text-xl text-slate-900">
              Create Study Deck
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-1">
              Group related cards together to focus your learning.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Deck Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spanish Vocabulary, Biology Terms"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  placeholder="What is the learning goal for this study deck?"
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-sans resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  Create Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
