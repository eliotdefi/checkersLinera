"use client";

import { useMemo } from "react";

interface TimerProps {
  timeMs: number;
  isActive: boolean;
  playerName: string;
  isMyTimer: boolean;
  capturedCount?: number;
  pieceColor?: "red" | "black";
  variant?: "horizontal" | "vertical";
}

export default function Timer({
  timeMs,
  isActive,
  playerName,
  isMyTimer,
  capturedCount = 0,
  pieceColor = "red",
  variant = "horizontal",
}: TimerProps) {
  // Format time as mm:ss
  const formattedTime = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, [timeMs]);

  // Time thresholds
  const isLowTime = timeMs < 30000 && timeMs > 10000;
  const isVeryLowTime = timeMs <= 10000 && timeMs > 0;
  const isOutOfTime = timeMs <= 0;

  // Get time color based on state
  const getTimeColor = () => {
    if (isOutOfTime) return "text-red-500";
    if (isVeryLowTime) return "text-red-500";
    if (isLowTime) return "text-orange-500";
    if (isActive) return "text-white";
    return "text-linera-gray";
  };

  // Vertical layout for side placement
  if (variant === "vertical") {
    return (
      <div
        className={`
          flex flex-col items-center justify-center p-3 rounded-lg min-w-[100px]
          transition-all duration-200
          ${isActive ? "bg-linera-navy-light ring-2 ring-linera-accent" : "bg-linera-navy-light/50"}
          ${isMyTimer ? "ring-2 ring-linera-accent" : ""}
        `}
      >
        {/* Player name */}
        <div className="text-xs text-linera-gray truncate max-w-full mb-1">
          {playerName}
        </div>

        {/* You badge */}
        {isMyTimer && (
          <span className="text-[10px] text-linera-accent bg-linera-accent/20 px-1.5 py-0.5 rounded mb-2">
            You
          </span>
        )}

        {/* Time display */}
        <div
          className={`
            text-2xl lg:text-3xl font-[var(--font-hanken)] font-bold tracking-wider
            ${getTimeColor()}
          `}
        >
          {formattedTime}
        </div>

        {/* Captured pieces display */}
        {capturedCount > 0 && (
          <div className="flex items-center gap-1 mt-3">
            <div className="flex -space-x-1">
              {Array.from({ length: Math.min(capturedCount, 4) }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border border-black/20 ${
                    pieceColor === "red"
                      ? "bg-gradient-to-br from-red-500 to-red-700"
                      : "bg-gradient-to-br from-gray-600 to-gray-800"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-linera-gray">+{capturedCount}</span>
          </div>
        )}

        {/* Status indicators */}
        {isOutOfTime && (
          <div className="text-[10px] text-red-400 mt-1">Time's up!</div>
        )}
      </div>
    );
  }

  // Horizontal layout (default - for mobile)
  return (
    <div
      className={`
        rounded-lg p-3 transition-all duration-200
        ${isActive ? "bg-linera-navy-light ring-2 ring-linera-accent" : "bg-linera-navy-light/50"}
        ${isMyTimer ? "ring-2 ring-linera-accent" : ""}
      `}
    >
      <div className="flex items-center justify-between">
        {/* Left: Player info */}
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-white">
            {playerName}
          </div>
          {isMyTimer && (
            <span className="text-xs text-linera-accent bg-linera-accent/20 px-1.5 py-0.5 rounded">
              You
            </span>
          )}
        </div>

        {/* Right: Time + captured */}
        <div className="flex items-center gap-3">
          {/* Captured pieces */}
          {capturedCount > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                {Array.from({ length: Math.min(capturedCount, 3) }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full border border-black/20 ${
                      pieceColor === "red"
                        ? "bg-gradient-to-br from-red-500 to-red-700"
                        : "bg-gradient-to-br from-gray-600 to-gray-800"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-linera-gray">+{capturedCount}</span>
            </div>
          )}

          {/* Time display */}
          <div
            className={`
              text-2xl lg:text-3xl font-[var(--font-hanken)] font-bold tracking-wider
              ${getTimeColor()}
            `}
          >
            {formattedTime}
          </div>
        </div>
      </div>

      {/* Status indicators */}
      {isOutOfTime && (
        <div className="text-xs text-red-400 mt-1">Time's up!</div>
      )}
    </div>
  );
}
