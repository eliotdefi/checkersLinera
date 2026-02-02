"use client";

import { DrawOfferState } from "@/types/game";

interface GameControlsProps {
  drawOfferState: DrawOfferState;
  isMyTurn: boolean;
  isGameActive: boolean;
  onResign: () => void;
  onOfferDraw: () => void;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
  onLeaveGame: () => void;
  isLoading?: boolean;
}

export default function GameControls({
  drawOfferState,
  isMyTurn,
  isGameActive,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
  onLeaveGame,
  isLoading = false,
}: GameControlsProps) {
  // Don't show game controls if game is not active
  if (!isGameActive) {
    return (
      <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600 text-center mb-2">
          Game has ended
        </div>
        <button
          onClick={onLeaveGame}
          disabled={isLoading}
          className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Leave Game
        </button>
      </div>
    );
  }

  // Render draw offer controls based on state
  const renderDrawControls = () => {
    switch (drawOfferState) {
      case DrawOfferState.OfferedByOpponent:
        return (
          <div className="space-y-2">
            <div className="text-sm text-center text-amber-600 font-medium bg-amber-50 py-2 px-3 rounded-lg">
              Opponent offers a draw
            </div>
            <div className="flex gap-2">
              <button
                onClick={onAcceptDraw}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept Draw
              </button>
              <button
                onClick={onDeclineDraw}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Decline
              </button>
            </div>
          </div>
        );

      case DrawOfferState.OfferedByMe:
        return (
          <div className="text-sm text-center text-blue-600 font-medium bg-blue-50 py-2 px-3 rounded-lg">
            Draw offer sent - waiting for response...
          </div>
        );

      case DrawOfferState.None:
      default:
        return (
          <button
            onClick={onOfferDraw}
            disabled={isLoading || !isMyTurn}
            className={`
              w-full py-2 px-4 rounded-lg transition-colors font-medium
              ${
                isMyTurn
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title={!isMyTurn ? "You can only offer a draw on your turn" : ""}
          >
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              Offer Draw
            </span>
          </button>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-600 text-center font-medium mb-1">
        Game Controls
      </div>

      {/* Draw offer section */}
      {renderDrawControls()}

      {/* Resign button */}
      <button
        onClick={onResign}
        disabled={isLoading}
        className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center justify-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
            />
          </svg>
          Resign
        </span>
      </button>

      {/* Leave game button */}
      <button
        onClick={onLeaveGame}
        disabled={isLoading}
        className="w-full py-2 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center justify-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Leave Game
        </span>
      </button>

      {/* Turn indicator */}
      <div
        className={`
          text-center py-2 px-3 rounded-lg text-sm font-medium
          ${isMyTurn ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}
        `}
      >
        {isMyTurn ? "Your turn" : "Opponent's turn"}
      </div>
    </div>
  );
}
