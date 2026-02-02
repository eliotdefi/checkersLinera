"use client";

import { useState, useEffect } from "react";
import { TimeControl, TIME_CONTROLS } from "@/types/game";

interface QueueWaitingProps {
  isOpen: boolean;
  timeControl: TimeControl;
  onCancel: () => void;
}

export default function QueueWaiting({
  isOpen,
  timeControl,
  onCancel,
}: QueueWaitingProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Reset and start timer when modal opens
  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const metadata = TIME_CONTROLS[timeControl];

  // Format elapsed time as mm:ss
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get accent color based on category
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

  // Get gradient background based on category
  const getCategoryGradient = (category: string): string => {
    switch (category) {
      case "bullet":
        return "bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30";
      case "blitz":
        return "bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30";
      case "rapid":
        return "bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30";
      default:
        return "bg-gradient-to-br from-teal-500/20 to-teal-600/10 border-teal-500/30";
    }
  };

  // Get glow color for the spinner
  const getGlowColor = (category: string): string => {
    switch (category) {
      case "bullet":
        return "rgba(239, 68, 68, 0.4)";
      case "blitz":
        return "rgba(251, 191, 36, 0.4)";
      case "rapid":
        return "rgba(34, 197, 94, 0.4)";
      default:
        return "rgba(94, 234, 212, 0.4)";
    }
  };

  // Get border color for spinner
  const getSpinnerBorderColor = (category: string): string => {
    switch (category) {
      case "bullet":
        return "border-t-red-500";
      case "blitz":
        return "border-t-amber-400";
      case "rapid":
        return "border-t-green-500";
      default:
        return "border-t-teal-400";
    }
  };

  // Get dot color
  const getDotColor = (category: string): string => {
    switch (category) {
      case "bullet":
        return "bg-red-500";
      case "blitz":
        return "bg-amber-400";
      case "rapid":
        return "bg-green-500";
      default:
        return "bg-teal-400";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div
        className="relative bg-gradient-to-br from-[#1a3a3f] to-[#132a2e] rounded-3xl p-8 w-full max-w-sm border border-white/10 shadow-2xl animate-modalSlideIn overflow-hidden text-center"
        style={{
          boxShadow: `0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px ${getGlowColor(metadata.category)}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`
        }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-50" />

        {/* Animated searching indicator */}
        <div className="mb-6">
          <div className="relative w-24 h-24 mx-auto">
            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-full opacity-30 animate-pulse"
              style={{ boxShadow: `0 0 30px ${getGlowColor(metadata.category)}` }}
            />

            {/* Outer spinning ring */}
            <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
            <div className={`absolute inset-0 border-4 border-transparent ${getSpinnerBorderColor(metadata.category)} rounded-full animate-spin`}></div>

            {/* Inner icon container */}
            <div className="absolute inset-2 bg-[#0d1b1e] rounded-full flex items-center justify-center">
              <svg
                className={`w-10 h-10 ${getAccentColor(metadata.category)}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Finding opponent text */}
        <h2 className="text-2xl font-bold text-[#f0fdfa] mb-2 tracking-tight">
          Finding opponent...
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          Searching for a player with matching time control
        </p>

        {/* Time control display */}
        <div
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 mb-6 border ${getCategoryGradient(metadata.category)}`}
        >
          <span className={`text-2xl font-bold font-mono ${getAccentColor(metadata.category)}`}>
            {metadata.label}
          </span>
          <span className="text-slate-400 text-sm capitalize">
            ({metadata.category})
          </span>
        </div>

        {/* Elapsed time */}
        <div className="mb-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Time in queue</div>
          <div
            className={`text-4xl font-mono font-bold ${getAccentColor(metadata.category)}`}
            style={{ textShadow: `0 0 20px ${getGlowColor(metadata.category)}` }}
          >
            {formatElapsedTime(elapsedSeconds)}
          </div>
        </div>

        {/* Animated dots */}
        <div className="flex justify-center gap-2 mb-8">
          <span
            className={`w-2.5 h-2.5 ${getDotColor(metadata.category)} rounded-full animate-bounce`}
            style={{ animationDelay: "0ms" }}
          ></span>
          <span
            className={`w-2.5 h-2.5 ${getDotColor(metadata.category)} rounded-full animate-bounce`}
            style={{ animationDelay: "150ms" }}
          ></span>
          <span
            className={`w-2.5 h-2.5 ${getDotColor(metadata.category)} rounded-full animate-bounce`}
            style={{ animationDelay: "300ms" }}
          ></span>
        </div>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="w-full py-3.5 px-4 bg-[#224a50] hover:bg-[#2a5a60] border border-white/10 hover:border-red-500/50 text-[#f0fdfa] hover:text-red-400 rounded-xl transition-all duration-200 font-semibold group"
        >
          <span className="flex items-center justify-center gap-2">
            <svg
              className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90"
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
            Cancel Search
          </span>
        </button>

        {/* Queue tips */}
        <p className="text-xs text-slate-500 mt-5 flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Games are matched by time control preference
        </p>
      </div>
    </div>
  );
}
