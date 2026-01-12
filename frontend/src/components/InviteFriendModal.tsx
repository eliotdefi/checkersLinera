"use client";

import { useState } from "react";
import { useGameStore } from "@/store/game";
import {
  TimeControl,
  TIME_CONTROLS,
  ColorPreference,
  TimeControlCategory,
} from "@/types/game";

interface InviteFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGameCreated?: (gameId: string) => void;
}

type ModalState = "setup" | "waiting";

const getCategoryStyles = (
  category: TimeControlCategory,
  isSelected: boolean
): string => {
  const baseStyles = isSelected
    ? "ring-2 ring-offset-2 ring-offset-[#132a2e] scale-105"
    : "hover:scale-105 hover:brightness-110";

  switch (category) {
    case "bullet":
      return `bg-gradient-to-br from-red-500 to-red-700 text-white ${baseStyles} ${isSelected ? "ring-red-400" : ""}`;
    case "blitz":
      return `bg-gradient-to-br from-amber-400 to-amber-600 text-gray-900 ${baseStyles} ${isSelected ? "ring-amber-300" : ""}`;
    case "rapid":
      return `bg-gradient-to-br from-green-500 to-green-700 text-white ${baseStyles} ${isSelected ? "ring-green-400" : ""}`;
    default:
      return `bg-gradient-to-br from-gray-500 to-gray-700 text-white ${baseStyles}`;
  }
};

const getCategoryLabel = (category: TimeControlCategory): string => {
  switch (category) {
    case "bullet":
      return "Bullet";
    case "blitz":
      return "Blitz";
    case "rapid":
      return "Rapid";
    default:
      return "";
  }
};

export default function InviteFriendModal({
  isOpen,
  onClose,
  onGameCreated,
}: InviteFriendModalProps) {
  const [state, setState] = useState<ModalState>("setup");
  const [timeControl, setTimeControl] = useState<TimeControl>(
    TimeControl.Blitz5m
  );
  const [colorPref, setColorPref] = useState<ColorPreference>(
    ColorPreference.Random
  );
  const [isRated, setIsRated] = useState(true);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { createGame } = useGameStore();

  const handleCreate = async () => {
    setIsCreating(true);
    const newGameId = await createGame(false, timeControl, colorPref, isRated);
    setIsCreating(false);

    if (newGameId) {
      setGameId(newGameId);
      // Simple invite link - everyone uses the same hub chain
      setInviteLink(`${window.location.origin}?join=${newGameId}`);
      setState("waiting");
      onGameCreated?.(newGameId);
    }
  };

  const copyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setState("setup");
    setInviteLink(null);
    setGameId(null);
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  const timeControls = Object.entries(TIME_CONTROLS) as [
    TimeControl,
    (typeof TIME_CONTROLS)[TimeControl]
  ][];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div
        className="relative bg-gradient-to-br from-[#1a3a3f] to-[#132a2e] rounded-3xl p-8 w-full max-w-lg border border-white/10 shadow-2xl animate-modalSlideIn overflow-hidden"
        style={{
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(94, 234, 212, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
        }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-50" />

        {state === "setup" ? (
          <>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#f0fdfa] tracking-tight">
                Invite a Friend
              </h2>
              <button
                onClick={handleClose}
                disabled={isCreating}
                className="w-9 h-9 rounded-xl bg-[#224a50] border border-white/10 text-slate-500 flex items-center justify-center transition-all duration-200 hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 hover:rotate-90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close modal"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Time Control Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">
                Time Control
              </label>
              <div className="grid grid-cols-5 gap-2">
                {timeControls.map(([tc, metadata]) => (
                  <button
                    key={tc}
                    type="button"
                    onClick={() => setTimeControl(tc)}
                    className={`
                      relative p-3 rounded-xl transition-all duration-200
                      transform active:scale-95
                      shadow-lg
                      ${getCategoryStyles(metadata.category, timeControl === tc)}
                    `}
                  >
                    <div className="text-lg font-bold font-mono">{metadata.label}</div>
                    <div className="text-xs opacity-80">
                      {getCategoryLabel(metadata.category)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">
                You play as
              </label>
              <div className="flex gap-3 justify-center">
                {/* Red */}
                <button
                  type="button"
                  onClick={() => setColorPref(ColorPreference.Red)}
                  className={`
                    flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 w-28
                    ${
                      colorPref === ColorPreference.Red
                        ? "border-red-500 bg-red-500/10 ring-2 ring-red-500/30"
                        : "border-white/10 bg-[#224a50] hover:border-white/20 hover:bg-[#2a5a60]"
                    }
                  `}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mb-2 shadow-lg">
                    <span className="text-white text-xl">♔</span>
                  </div>
                  <span className="text-sm font-semibold text-[#f0fdfa]">Red</span>
                  <span className="text-xs text-slate-500">First move</span>
                </button>

                {/* Random */}
                <button
                  type="button"
                  onClick={() => setColorPref(ColorPreference.Random)}
                  className={`
                    flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 w-28
                    ${
                      colorPref === ColorPreference.Random
                        ? "border-teal-400 bg-teal-500/10 ring-2 ring-teal-500/30"
                        : "border-white/10 bg-[#224a50] hover:border-white/20 hover:bg-[#2a5a60]"
                    }
                  `}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-red-600 via-purple-500 to-gray-700 flex items-center justify-center mb-2 shadow-lg">
                    <span className="text-white text-xl font-bold">?</span>
                  </div>
                  <span className="text-sm font-semibold text-[#f0fdfa]">Random</span>
                  <span className="text-xs text-slate-500">Surprise me</span>
                </button>

                {/* Black */}
                <button
                  type="button"
                  onClick={() => setColorPref(ColorPreference.Black)}
                  className={`
                    flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 w-28
                    ${
                      colorPref === ColorPreference.Black
                        ? "border-slate-400 bg-slate-500/10 ring-2 ring-slate-500/30"
                        : "border-white/10 bg-[#224a50] hover:border-white/20 hover:bg-[#2a5a60]"
                    }
                  `}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center mb-2 shadow-lg">
                    <span className="text-white text-xl">♔</span>
                  </div>
                  <span className="text-sm font-semibold text-[#f0fdfa]">Black</span>
                  <span className="text-xs text-slate-500">Second move</span>
                </button>
              </div>
            </div>

            {/* Casual/Rated Toggle */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">
                Game Mode
              </label>
              <div className="flex gap-2 bg-[#0d1b1e] p-1.5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setIsRated(false)}
                  className={`
                    flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200
                    ${
                      !isRated
                        ? "bg-[#224a50] text-[#f0fdfa] shadow-lg"
                        : "text-slate-500 hover:text-slate-400"
                    }
                  `}
                >
                  Casual
                </button>
                <button
                  type="button"
                  onClick={() => setIsRated(true)}
                  className={`
                    flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200
                    ${
                      isRated
                        ? "bg-[#224a50] text-[#f0fdfa] shadow-lg"
                        : "text-slate-500 hover:text-slate-400"
                    }
                  `}
                >
                  Rated
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isRated
                  ? "This game will affect your ELO rating"
                  : "This game will not affect your ELO rating"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClose}
                disabled={isCreating}
                className="px-5 py-2.5 text-slate-500 hover:text-slate-400 hover:bg-white/5 rounded-xl transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="px-6 py-2.5 bg-gradient-to-br from-teal-400 to-teal-500 hover:from-teal-300 hover:to-teal-400 text-[#0d1b1e] rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-teal-500/25 hover:-translate-y-0.5"
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
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
                  "Create Invite Link"
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold text-[#f0fdfa] tracking-tight">
                Share this link
              </h2>
              <button
                onClick={handleClose}
                className="w-9 h-9 rounded-xl bg-[#224a50] border border-white/10 text-slate-500 flex items-center justify-center transition-all duration-200 hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 hover:rotate-90"
                aria-label="Close modal"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-slate-400 mb-6">
              Send this link to your friend to start playing
            </p>

            {/* Invite Link */}
            <div className="flex items-center gap-2 p-3 bg-[#0d1b1e] rounded-xl border border-white/10 mb-4">
              <input
                type="text"
                readOnly
                value={inviteLink || ""}
                className="flex-1 bg-transparent text-sm text-[#f0fdfa] font-mono outline-none"
              />
              <button
                onClick={copyLink}
                className={`
                  px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                  ${
                    copied
                      ? "bg-green-500 text-white"
                      : "bg-gradient-to-br from-teal-400 to-teal-500 hover:from-teal-300 hover:to-teal-400 text-[#0d1b1e]"
                  }
                `}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Game Info */}
            <div className="bg-[#0d1b1e] rounded-xl p-4 mb-6 border border-white/10">
              <div className="text-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Time Control</span>
                  <span className="font-semibold text-[#f0fdfa]">
                    {TIME_CONTROLS[timeControl].label}{" "}
                    <span className="text-slate-400">
                      ({getCategoryLabel(TIME_CONTROLS[timeControl].category)})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Your Color</span>
                  <span
                    className={`font-semibold ${
                      colorPref === ColorPreference.Red
                        ? "text-red-500"
                        : colorPref === ColorPreference.Black
                          ? "text-slate-300"
                          : "text-teal-400"
                    }`}
                  >
                    {colorPref === ColorPreference.Random
                      ? "Random"
                      : colorPref === ColorPreference.Red
                        ? "Red"
                        : "Black"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Game Mode</span>
                  <span className="font-semibold text-[#f0fdfa]">
                    {isRated ? "Rated" : "Casual"}
                  </span>
                </div>
              </div>
            </div>

            {/* Waiting Status */}
            <div className="flex items-center justify-center gap-3 py-4 mb-4 rounded-xl bg-teal-500/10 border border-teal-500/20">
              <div className="relative">
                <div className="w-3 h-3 bg-teal-400 rounded-full animate-ping absolute"></div>
                <div className="w-3 h-3 bg-teal-400 rounded-full"></div>
              </div>
              <span className="text-teal-400 font-medium">Waiting for opponent to join...</span>
            </div>

            {/* Actions */}
            <div className="flex justify-center">
              <button
                onClick={handleClose}
                className="px-6 py-2.5 text-slate-500 hover:text-slate-400 hover:bg-white/5 rounded-xl transition-all duration-200 font-medium"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
