"use client";

import { useState } from "react";

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (vsAI: boolean) => void;
  isLoading?: boolean;
}

export default function CreateGameModal({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}: CreateGameModalProps) {
  const [vsAI, setVsAI] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Create New Game
        </h2>

        {/* Game Mode Selection */}
        <div className="space-y-4 mb-6">
          <label className="block text-sm font-medium text-gray-700">
            Select Game Mode
          </label>

          <div className="grid grid-cols-2 gap-4">
            {/* PvP Option */}
            <button
              type="button"
              onClick={() => setVsAI(false)}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${
                  !vsAI
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <div className="text-3xl mb-2">👥</div>
              <div className="font-semibold text-gray-800">Player vs Player</div>
              <div className="text-xs text-gray-500 mt-1">
                Challenge another player
              </div>
            </button>

            {/* vs AI Option */}
            <button
              type="button"
              onClick={() => setVsAI(true)}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${
                  vsAI
                    ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                    : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <div className="text-3xl mb-2">🤖</div>
              <div className="font-semibold text-gray-800">Player vs AI</div>
              <div className="text-xs text-gray-500 mt-1">
                Practice against AI
              </div>
            </button>
          </div>
        </div>

        {/* Game Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-600">
            <div className="flex items-center mb-2">
              <span className="w-24 font-medium">You play as:</span>
              <span className="text-red-600 font-semibold">Red (First Move)</span>
            </div>
            <div className="flex items-center">
              <span className="w-24 font-medium">Opponent:</span>
              <span className={vsAI ? "text-purple-600" : "text-gray-800"}>
                {vsAI ? "AI" : "Waiting for player..."}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(vsAI)}
            disabled={isLoading}
            className={`
              px-6 py-2 rounded-lg font-medium transition-colors
              ${
                vsAI
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </span>
            ) : (
              "Create Game"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
