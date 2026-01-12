"use client";

import { useState } from "react";
import { useTournamentStore } from "@/store/tournament";

interface JoinByCodeModalProps {
  onClose: () => void;
  onJoined: (tournamentId: string, tournamentName: string) => void;
}

export default function JoinByCodeModal({
  onClose,
  onJoined,
}: JoinByCodeModalProps) {
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { joinTournamentByCode } = useTournamentStore();

  const handleSubmit = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length !== 6) {
      setError("Please enter a 6-character code");
      return;
    }

    setIsJoining(true);
    setError(null);

    const result = await joinTournamentByCode(trimmedCode);

    if (result) {
      onJoined(result.tournamentId, result.tournamentName);
    } else {
      setError("Invalid code or tournament not available");
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.8)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-6 rounded-2xl border animate-fadeInUp"
        style={{
          background: "var(--home-bg-card)",
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-2xl mb-2 text-center tracking-wide"
          style={{ fontFamily: "var(--font-bebas)" }}
        >
          JOIN PRIVATE TOURNAMENT
        </h2>
        <p className="text-sm text-center mb-6" style={{ color: "var(--home-text-secondary)" }}>
          Enter the 6-character invite code
        </p>

        {/* Code Input */}
        <div className="mb-6">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            onKeyPress={handleKeyPress}
            placeholder="ABC123"
            maxLength={6}
            className="w-full px-4 py-4 rounded-xl border bg-transparent outline-none transition-all focus:border-white/30 text-center text-2xl font-mono tracking-widest"
            style={{
              borderColor: "rgba(255, 255, 255, 0.2)",
              color: "var(--home-text-primary)",
            }}
            autoFocus
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg text-center text-sm" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-all hover:bg-white/5"
            style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isJoining || code.length !== 6}
            className="flex-1 py-3 rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, var(--home-accent-purple), #7c3aed)",
              color: "#fff",
            }}
          >
            {isJoining ? "Joining..." : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}
