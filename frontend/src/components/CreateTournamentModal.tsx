"use client";

import { useState } from "react";
import { TimeControl, TIME_CONTROLS } from "@/types/game";
import { useTournamentStore } from "@/store/tournament";

interface CreateTournamentModalProps {
  onClose: () => void;
  onCreated: (tournamentId: string, inviteCode?: string) => void;
}

const MAX_PLAYERS_OPTIONS = [4, 8, 16, 32];

export default function CreateTournamentModal({
  onClose,
  onCreated,
}: CreateTournamentModalProps) {
  const [name, setName] = useState("");
  const [timeControl, setTimeControl] = useState<TimeControl>(TimeControl.Blitz5m);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [isPublic, setIsPublic] = useState(true);
  const [useSchedule, setUseSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [createdTournamentId, setCreatedTournamentId] = useState<string | null>(null);

  const { createTournament, fetchTournament, selectedTournament } = useTournamentStore();

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Tournament name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    let scheduledStart: number | undefined;
    if (useSchedule && scheduledDate && scheduledTime) {
      const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      scheduledStart = dateTime.getTime() * 1000;
    }

    if (isPublic) {
      onClose();
    }
    const tournamentId = await createTournament(
      name.trim(),
      timeControl,
      maxPlayers,
      isPublic,
      scheduledStart
    );

    if (tournamentId) {
      setCreatedTournamentId(tournamentId);
      // For private tournaments, fetch the invite code and show it
      if (!isPublic) {
        // Fetch the tournament to get the invite code
        await fetchTournament(tournamentId);
        const store = useTournamentStore.getState();
        const tournament = store.selectedTournament;
        if (tournament?.inviteCode) {
          setCreatedInviteCode(tournament.inviteCode);
          setIsCreating(false);
        } else {
          // Retry once if not available
          await new Promise(resolve => setTimeout(resolve, 1000));
          await fetchTournament(tournamentId);
          const retryStore = useTournamentStore.getState();
          const retryTournament = retryStore.selectedTournament;
          if (retryTournament?.inviteCode) {
            setCreatedInviteCode(retryTournament.inviteCode);
            setIsCreating(false);
          } else {
            // If still not available, close modal anyway
            setIsCreating(false);
            onClose();
          }
        }
      } else {
        // Public tournament - already closed modal, just call callback
        onCreated(tournamentId);
      }
    } else {
      // Only show error if we haven't closed the modal yet (private tournaments)
      if (!isPublic) {
        setError("Failed to create tournament");
        setIsCreating(false);
      }
      // For public tournaments, modal is already closed, error will show in main UI
    }
  };

  const copyInviteCode = () => {
    if (createdInviteCode) {
      navigator.clipboard.writeText(createdInviteCode);
    }
  };

  // Show invite code success screen for private tournaments
  if (createdInviteCode && createdTournamentId) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0, 0, 0, 0.8)" }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-md p-6 rounded-2xl border animate-fadeInUp"
          style={{
            background: "var(--home-bg-card)",
            borderColor: "rgba(255, 255, 255, 0.1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="text-4xl mb-4">&#127942;</div>
            <h2
              className="text-2xl mb-2 tracking-wide"
              style={{ fontFamily: "var(--font-bebas)" }}
            >
              TOURNAMENT CREATED!
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--home-text-secondary)" }}>
              Share this invite code with players:
            </p>

            {/* Invite Code Display */}
            <div
              className="p-4 rounded-xl mb-6 border"
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                borderColor: "var(--home-accent-green)",
              }}
            >
              <div
                className="text-4xl font-mono tracking-widest mb-2"
                style={{ color: "var(--home-accent-green)" }}
              >
                {createdInviteCode}
              </div>
              <button
                onClick={copyInviteCode}
                className="text-sm px-4 py-2 rounded-lg transition-all hover:opacity-80"
                style={{
                  background: "var(--home-accent-green)",
                  color: "#fff",
                }}
              >
                Copy Code
              </button>
            </div>

            <button
              onClick={() => onCreated(createdTournamentId, createdInviteCode)}
              className="w-full py-3 rounded-lg font-medium transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--home-accent-green), #059669)",
                color: "#fff",
              }}
            >
              Go to Tournament
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.8)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-6 rounded-2xl border animate-fadeInUp max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--home-bg-card)",
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-2xl mb-6 text-center tracking-wide"
          style={{ fontFamily: "var(--font-bebas)" }}
        >
          CREATE TOURNAMENT
        </h2>

        {/* Tournament Name */}
        <div className="mb-6">
          <label className="block text-sm mb-2" style={{ color: "var(--home-text-secondary)" }}>
            Tournament Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Tournament"
            maxLength={50}
            className="w-full px-4 py-3 rounded-lg border bg-transparent outline-none transition-all focus:border-white/30"
            style={{
              borderColor: "rgba(255, 255, 255, 0.1)",
              color: "var(--home-text-primary)",
            }}
          />
        </div>

        {/* Privacy Toggle */}
        <div className="mb-6">
          <label className="block text-sm mb-2" style={{ color: "var(--home-text-secondary)" }}>
            Tournament Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsPublic(true)}
              className="p-3 rounded-lg border transition-all"
              style={{
                background: isPublic ? "var(--home-accent-green)" : "transparent",
                borderColor: isPublic ? "var(--home-accent-green)" : "rgba(255,255,255,0.1)",
                color: isPublic ? "#fff" : "var(--home-text-secondary)",
              }}
            >
              <div className="font-semibold">Public</div>
              <div className="text-xs opacity-70">Anyone can join</div>
            </button>
            <button
              onClick={() => setIsPublic(false)}
              className="p-3 rounded-lg border transition-all"
              style={{
                background: !isPublic ? "var(--home-accent-purple)" : "transparent",
                borderColor: !isPublic ? "var(--home-accent-purple)" : "rgba(255,255,255,0.1)",
                color: !isPublic ? "#fff" : "var(--home-text-secondary)",
              }}
            >
              <div className="font-semibold">Private</div>
              <div className="text-xs opacity-70">Invite code only</div>
            </button>
          </div>
        </div>

        {/* Time Control */}
        <div className="mb-6">
          <label className="block text-sm mb-2" style={{ color: "var(--home-text-secondary)" }}>
            Time Control
          </label>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(TIME_CONTROLS).map(([tc, meta]) => (
              <button
                key={tc}
                onClick={() => setTimeControl(tc as TimeControl)}
                className="p-2 rounded-lg border text-sm transition-all"
                style={{
                  background: timeControl === tc ? "var(--home-accent-green)" : "transparent",
                  borderColor: timeControl === tc ? "var(--home-accent-green)" : "rgba(255,255,255,0.1)",
                  color: timeControl === tc ? "#fff" : "var(--home-text-secondary)",
                }}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max Players */}
        <div className="mb-6">
          <label className="block text-sm mb-2" style={{ color: "var(--home-text-secondary)" }}>
            Max Players
          </label>
          <div className="grid grid-cols-4 gap-2">
            {MAX_PLAYERS_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => setMaxPlayers(count)}
                className="p-3 rounded-lg border transition-all"
                style={{
                  background: maxPlayers === count ? "var(--home-accent-green)" : "transparent",
                  borderColor: maxPlayers === count ? "var(--home-accent-green)" : "rgba(255,255,255,0.1)",
                  color: maxPlayers === count ? "#fff" : "var(--home-text-secondary)",
                }}
              >
                <div className="font-semibold">{count}</div>
                <div className="text-xs opacity-70">{Math.log2(count)} rounds</div>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Toggle */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useSchedule}
              onChange={(e) => setUseSchedule(e.target.checked)}
              className="w-5 h-5 rounded border-2 accent-green-500"
              style={{ borderColor: "rgba(255, 255, 255, 0.2)" }}
            />
            <span style={{ color: "var(--home-text-secondary)" }}>
              Schedule start time (optional)
            </span>
          </label>
        </div>

        {/* Schedule Picker */}
        {useSchedule && (
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--home-text-secondary)" }}>
                Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none text-sm"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  color: "var(--home-text-primary)",
                }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--home-text-secondary)" }}>
                Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none text-sm"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  color: "var(--home-text-primary)",
                }}
              />
            </div>
          </div>
        )}

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
            onClick={handleCreate}
            disabled={isCreating}
            className="flex-1 py-3 rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, var(--home-accent-green), #059669)",
              color: "#fff",
            }}
          >
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
