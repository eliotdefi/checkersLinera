"use client";

import { TimeControl, TIME_CONTROLS } from "@/types/game";

interface TimeControlModalProps {
  isOpen: boolean;
  selectedTimeControl: TimeControl;
  isLoading: boolean;
  onClose: () => void;
  onPlayAI: () => void;
  onPlayPlayer: () => void;
}

export default function TimeControlModal({
  isOpen,
  selectedTimeControl,
  isLoading,
  onClose,
  onPlayAI,
  onPlayPlayer,
}: TimeControlModalProps) {
  if (!isOpen) return null;

  const metadata = TIME_CONTROLS[selectedTimeControl];

  // Get gradient background based on category
  const getCardGradient = (category: string): string => {
    switch (category) {
      case "bullet":
        return "bg-gradient-to-br from-[#3d1515] to-[#1a0808] border-red-500/30";
      case "blitz":
        return "bg-gradient-to-br from-[#3d2e0a] to-[#1a1400] border-amber-500/30";
      case "rapid":
        return "bg-gradient-to-br from-[#0a3d1a] to-[#001a08] border-green-500/30";
      default:
        return "bg-gradient-to-br from-[#1a3a3f] to-[#132a2e] border-teal-500/30";
    }
  };

  // Get text color based on category
  const getAccentColor = (category: string): string => {
    switch (category) {
      case "bullet":
        return "text-red-500";
      case "blitz":
        return "text-amber-400";
      case "rapid":
        return "text-green-500";
      default:
        return "text-teal-400";
    }
  };

  // Get glow shadow based on category
  const getGlowStyle = (category: string): React.CSSProperties => {
    switch (category) {
      case "bullet":
        return { textShadow: "0 0 30px rgba(239, 68, 68, 0.5)" };
      case "blitz":
        return { textShadow: "0 0 30px rgba(251, 191, 36, 0.5)" };
      case "rapid":
        return { textShadow: "0 0 30px rgba(34, 197, 94, 0.5)" };
      default:
        return { textShadow: "0 0 30px rgba(94, 234, 212, 0.5)" };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div
        className="relative bg-gradient-to-br from-[#1a3a3f] to-[#132a2e] rounded-3xl p-8 w-full max-w-[420px] border border-white/10 shadow-2xl animate-modalSlideIn overflow-hidden"
        style={{
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(94, 234, 212, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
        }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-50" />

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#f0fdfa] tracking-tight">Start Game</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-9 h-9 rounded-xl bg-[#224a50] border border-white/10 text-slate-500 flex items-center justify-center transition-all duration-200 hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 hover:rotate-90 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <svg
              className="w-[18px] h-[18px]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Time Control Card */}
        <div
          className={`relative rounded-2xl p-6 mb-6 text-center border overflow-hidden ${getCardGradient(metadata.category)}`}
        >
          {/* Pulse effect background */}
          <div
            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-pulse opacity-50"
            style={{
              background: metadata.category === "bullet"
                ? "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.15) 0%, transparent 60%)"
                : metadata.category === "blitz"
                ? "radial-gradient(ellipse at center, rgba(251, 191, 36, 0.15) 0%, transparent 60%)"
                : "radial-gradient(ellipse at center, rgba(34, 197, 94, 0.15) 0%, transparent 60%)"
            }}
          />

          <div className="relative">
            <div className="text-xs uppercase tracking-[2px] text-slate-400 mb-2">
              Time Control
            </div>
            <div
              className={`text-5xl font-bold font-mono leading-none mb-1 ${getAccentColor(metadata.category)}`}
              style={getGlowStyle(metadata.category)}
            >
              {metadata.label}
            </div>
            <div className="text-sm text-slate-500">
              <span className={`font-semibold capitalize ${getAccentColor(metadata.category)}`}>
                {metadata.category}
              </span>
              {" • "}
              {metadata.minutes} Min
              {metadata.increment > 0 && ` + ${metadata.increment}s`}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 mb-5">
          {/* Play vs Player - Primary */}
          <button
            onClick={onPlayPlayer}
            disabled={isLoading}
            className="relative w-full flex items-center justify-center gap-3 p-4 rounded-[14px] font-semibold transition-all duration-300 overflow-hidden bg-gradient-to-br from-teal-400 to-teal-500 text-[#0d1b1e] hover:-translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{
              boxShadow: isLoading ? "none" : "0 4px 15px rgba(94, 234, 212, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
            }}
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <svg
                  className="w-[22px] h-[22px] transition-transform duration-300 group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span>Play vs Player</span>
              </>
            )}
          </button>

          {/* Play vs AI - Secondary */}
          <button
            onClick={onPlayAI}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-[14px] font-semibold transition-all duration-300 bg-[#224a50] text-[#f0fdfa] border border-white/10 hover:bg-[#1a3a3f] hover:border-teal-400 hover:-translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{
              boxShadow: isLoading ? "none" : "none"
            }}
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <svg
                  className="w-[22px] h-[22px] transition-all duration-300 hover:text-teal-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span>Play vs AI</span>
              </>
            )}
          </button>
        </div>

        {/* Cancel Link */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="w-full text-center text-slate-500 text-sm py-2 transition-colors duration-200 hover:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="flex items-center gap-2">
      <svg
        className="animate-spin h-5 w-5 text-current"
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
      <span>Please wait...</span>
    </div>
  );
}
