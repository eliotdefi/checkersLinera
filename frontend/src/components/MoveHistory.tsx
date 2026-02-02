"use client";

import { useState } from "react";
import { CheckersMove } from "@/types/game";

interface MoveHistoryProps {
  moves: CheckersMove[];
  onMoveClick?: (moveIndex: number) => void;
}

// Convert row/col to checkers notation (a1-h8)
function toNotation(row: number, col: number): string {
  const file = String.fromCharCode(97 + col); // a-h
  const rank = 8 - row; // 1-8 (row 0 = rank 8)
  return `${file}${rank}`;
}

// Format a move for display
function formatMove(move: CheckersMove): string {
  const from = toNotation(move.fromRow, move.fromCol);
  const to = toNotation(move.toRow, move.toCol);

  let notation = `${from}-${to}`;

  // Add capture indicator
  if (move.capturedRow !== undefined && move.capturedCol !== undefined) {
    notation = `${from}x${to}`;
  }

  // Add promotion indicator
  if (move.promoted) {
    notation += "K";
  }

  return notation;
}

// Chevron icons
const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default function MoveHistory({ moves, onMoveClick }: MoveHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group moves into pairs (red, black)
  const movePairs: { moveNum: number; red?: CheckersMove; black?: CheckersMove }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      moveNum: Math.floor(i / 2) + 1,
      red: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="hidden xl:flex fixed right-4 top-1/2 -translate-y-1/2 items-center z-40">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          p-2 bg-linera-navy-light/90 backdrop-blur-sm
          transition-all duration-200 z-10
          hover:bg-linera-navy-light text-white
          ${isExpanded ? "rounded-l-lg" : "rounded-lg"}
        `}
        title={isExpanded ? "Hide moves" : "Show moves"}
      >
        {isExpanded ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </button>

      {/* Move list panel */}
      <div
        className={`
          bg-linera-navy-light/95 backdrop-blur-sm rounded-r-lg
          overflow-hidden transition-all duration-200
          ${isExpanded ? "w-44 opacity-100" : "w-0 opacity-0"}
        `}
      >
        <div className="p-3 w-44">
          <h4 className="text-sm font-medium text-white mb-2 font-[var(--font-epilogue)]">
            Moves
          </h4>

          {moves.length === 0 ? (
            <p className="text-xs text-linera-gray">No moves yet</p>
          ) : (
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                {movePairs.map((pair) => (
                  <div
                    key={pair.moveNum}
                    className="flex items-center text-xs font-mono"
                  >
                    {/* Move number */}
                    <span className="w-6 text-linera-gray shrink-0">
                      {pair.moveNum}.
                    </span>

                    {/* Red's move */}
                    <button
                      className={`
                        flex-1 px-1 py-0.5 text-left rounded
                        ${pair.red ? "text-red-400 hover:bg-white/10" : "text-gray-600"}
                      `}
                      onClick={() => pair.red && onMoveClick?.(pair.moveNum * 2 - 2)}
                      disabled={!pair.red}
                    >
                      {pair.red ? formatMove(pair.red) : "..."}
                    </button>

                    {/* Black's move */}
                    <button
                      className={`
                        flex-1 px-1 py-0.5 text-left rounded
                        ${pair.black ? "text-gray-300 hover:bg-white/10" : "text-gray-600"}
                      `}
                      onClick={() => pair.black && onMoveClick?.(pair.moveNum * 2 - 1)}
                      disabled={!pair.black}
                    >
                      {pair.black ? formatMove(pair.black) : ""}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
