"use client";

import { useEffect, useState } from "react";
import { useTournamentStore } from "@/store/tournament";
import { Tournament, TournamentStatus, MatchStatus, TimeControl, TIME_CONTROLS } from "@/types/game";
import TournamentBracket from "./TournamentBracket";

interface TournamentLobbyProps {
  tournamentId: string;
  playerId: string | null;
  onBack: () => void;
  onGameStart: (gameId: string) => void;
}

export default function TournamentLobby({
  tournamentId,
  playerId,
  onBack,
  onGameStart,
}: TournamentLobbyProps) {
  const {
    selectedTournament,
    isLoading,
    error,
    fetchTournament,
    joinTournament,
    leaveTournament,
    startTournament,
    startMatch,
    forfeitMatch,
    cancelTournament,
  } = useTournamentStore();

  const [copiedCode, setCopiedCode] = useState(false);
  const [lastCheckedGameId, setLastCheckedGameId] = useState<string | null>(null);

  useEffect(() => {
    fetchTournament(tournamentId);
    const interval = setInterval(() => fetchTournament(tournamentId), 3000);
    return () => clearInterval(interval);
  }, [tournamentId, fetchTournament]);

  useEffect(() => {
    if (!selectedTournament || !playerId) return;

    const myActiveMatch = selectedTournament.matches.find(
      (m) =>
        (m.player1 === playerId || m.player2 === playerId) &&
        m.gameId &&
        m.status === MatchStatus.InProgress
    );

    if (myActiveMatch?.gameId && myActiveMatch.gameId !== lastCheckedGameId) {
      setLastCheckedGameId(myActiveMatch.gameId);
      onGameStart(myActiveMatch.gameId);
    }
  }, [selectedTournament, playerId, lastCheckedGameId, onGameStart]);

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatScheduledTime = (timestamp: number) => {
    const date = new Date(timestamp / 1000); // Convert from microseconds
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!selectedTournament && isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "var(--home-bg-primary)",
          color: "var(--home-text-primary)",
        }}
      >
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "var(--home-accent-green)" }} />
          <p style={{ color: "var(--home-text-secondary)" }}>Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (!selectedTournament) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "var(--home-bg-primary)",
          color: "var(--home-text-primary)",
        }}
      >
        <div className="text-center">
          <p className="text-xl mb-4">Tournament not found</p>
          <button
            onClick={onBack}
            className="px-6 py-2 rounded-lg border transition-all hover:bg-white/5"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const tournament = selectedTournament;
  const isCreator = tournament.creator === playerId;
  const isRegistered = playerId ? tournament.registeredPlayers.includes(playerId) : false;
  const canJoin = tournament.status === TournamentStatus.Registration && !isRegistered && tournament.registeredPlayers.length < tournament.maxPlayers;
  const canLeave = tournament.status === TournamentStatus.Registration && isRegistered && !isCreator;
  const minPlayers = Math.max(Math.floor(tournament.maxPlayers / 4), 2);
  const canStart = isCreator && tournament.status === TournamentStatus.Registration && tournament.registeredPlayers.length >= minPlayers;
  const myMatch = playerId
    ? tournament.matches.find(
        (m) =>
          (m.player1 === playerId || m.player2 === playerId) &&
          (m.status === MatchStatus.Ready || m.status === MatchStatus.InProgress)
      )
    : null;

  const handleJoin = async () => {
    await joinTournament(tournamentId);
  };

  const handleLeave = async () => {
    await leaveTournament(tournamentId);
    onBack();
  };

  const handleStart = async () => {
    await startTournament(tournamentId);
  };

  const handleStartMatch = async () => {
    if (!myMatch) return;
    const gameId = await startMatch(tournamentId, myMatch.id);
    if (gameId) {
      onGameStart(gameId);
    }
  };

  const handleForfeit = async () => {
    if (!myMatch) return;
    if (confirm('Are you sure you want to forfeit this match? Your opponent will advance.')) {
      await forfeitMatch(tournamentId, myMatch.id);
    }
  };

  const handleCancel = async () => {
    if (confirm('Are you sure you want to cancel this tournament? All registered players will be notified.')) {
      const success = await cancelTournament(tournamentId);
      if (success) {
        onBack();
      }
    }
  };

  const handleMatchClick = async (match: { id: string; status: MatchStatus; gameId?: string }) => {
    if (match.status === MatchStatus.InProgress && match.gameId) {
      onGameStart(match.gameId);
    } else if (
      match.status === MatchStatus.Ready &&
      playerId &&
      (tournament.matches.find((m) => m.id === match.id)?.player1 === playerId ||
        tournament.matches.find((m) => m.id === match.id)?.player2 === playerId)
    ) {
      const gameId = await startMatch(tournamentId, match.id);
      if (gameId) {
        onGameStart(gameId);
      }
    }
  };

  const getTimeControlLabel = (tc: TimeControl) => {
    return TIME_CONTROLS[tc]?.label || tc;
  };

  const getStatusColor = (status: TournamentStatus) => {
    switch (status) {
      case TournamentStatus.Registration:
        return "var(--home-accent-green)";
      case TournamentStatus.InProgress:
        return "var(--home-accent-yellow)";
      case TournamentStatus.Finished:
        return "var(--home-text-secondary)";
      default:
        return "var(--home-text-secondary)";
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        fontFamily: "var(--font-space)",
        background: "var(--home-bg-primary)",
        color: "var(--home-text-primary)",
      }}
    >
      <div className="home-bg-pattern" />
      <div className="home-orb home-orb-1" />
      <div className="home-orb home-orb-2" />

      {/* Header */}
      <header
        className="relative z-10 px-6 md:px-12 py-4 flex justify-between items-center border-b backdrop-blur-md"
        style={{
          borderColor: "rgba(255,255,255,0.05)",
          background: "rgba(10, 10, 15, 0.8)",
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-all hover:bg-white/5"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1
              className="text-xl md:text-2xl tracking-wider"
              style={{
                fontFamily: "var(--font-bebas)",
                background: "linear-gradient(135deg, #fff 0%, #aaa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {tournament.name}
            </h1>
            <div className="flex items-center gap-2 text-sm flex-wrap" style={{ color: "var(--home-text-secondary)" }}>
              <span
                className="px-2 py-0.5 rounded text-xs"
                style={{
                  background: `${getStatusColor(tournament.status)}20`,
                  color: getStatusColor(tournament.status),
                }}
              >
                {tournament.status === TournamentStatus.Registration ? "Registration" : tournament.status === TournamentStatus.InProgress ? "In Progress" : "Finished"}
              </span>
              {!tournament.isPublic && (
                <span
                  className="px-2 py-0.5 rounded text-xs"
                  style={{
                    background: "rgba(139, 92, 246, 0.2)",
                    color: "#a78bfa",
                  }}
                >
                  Private
                </span>
              )}
              <span>•</span>
              <span>{getTimeControlLabel(tournament.timeControl)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg text-center text-sm" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
            {error}
          </div>
        )}

        {/* Minimum players indicator */}
        {isCreator && tournament.status === TournamentStatus.Registration && tournament.registeredPlayers.length < minPlayers && (
          <div className="mb-4 p-4 rounded-lg border" style={{
            background: "rgba(234, 179, 8, 0.1)",
            borderColor: "#eab308",
            color: "#ffffff"
          }}>
            <div className="flex items-start gap-3">
              <span style={{ color: "#eab308", fontSize: "20px" }}>ℹ️</span>
              <div>
                <p className="font-medium mb-1">Waiting for more players</p>
                <p className="text-sm" style={{ color: "#9ca3af" }}>
                  Need at least {minPlayers} players to start the tournament.
                  Currently: {tournament.registeredPlayers.length}/{tournament.maxPlayers}
                </p>
                <p className="text-sm mt-2" style={{ color: "#9ca3af" }}>
                  Share this tournament with others or wait for players to join from the public list.
                  {!tournament.isPublic && tournament.inviteCode && (
                    <span className="ml-1">Invite code: <strong>{tournament.inviteCode}</strong></span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          {canJoin && (
            <button
              onClick={handleJoin}
              disabled={isLoading}
              className="px-6 py-2 rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, var(--home-accent-green), #059669)",
                color: "#fff",
              }}
            >
              Join Tournament
            </button>
          )}
          {canLeave && (
            <button
              onClick={handleLeave}
              disabled={isLoading}
              className="px-6 py-2 rounded-lg border transition-all hover:bg-red-500/10"
              style={{ borderColor: "#ef4444", color: "#ef4444" }}
            >
              Leave Tournament
            </button>
          )}
          {isCreator && tournament.status === TournamentStatus.Registration && (
            <>
              <button
                onClick={handleStart}
                disabled={isLoading || tournament.registeredPlayers.length < minPlayers}
                className="px-6 py-2 rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: tournament.registeredPlayers.length >= minPlayers
                    ? "linear-gradient(135deg, #fbbf24, #d97706)"
                    : "rgba(255, 255, 255, 0.1)",
                  color: tournament.registeredPlayers.length >= minPlayers ? "#000" : "#9ca3af",
                }}
                title={tournament.registeredPlayers.length < minPlayers
                  ? `Need at least ${minPlayers} players to start (currently ${tournament.registeredPlayers.length})`
                  : "Start the tournament"}
              >
                Start Tournament {tournament.registeredPlayers.length < minPlayers && `(${tournament.registeredPlayers.length}/${minPlayers})`}
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="px-6 py-2 rounded-lg border transition-all hover:bg-red-500/10"
                style={{ borderColor: "#ef4444", color: "#ef4444" }}
              >
                Cancel Tournament
              </button>
            </>
          )}
          {myMatch && myMatch.status === MatchStatus.Ready && (
            <button
              onClick={handleStartMatch}
              disabled={isLoading}
              className="px-6 py-2 rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-50 animate-pulse"
              style={{
                background: "linear-gradient(135deg, var(--home-accent-green), #059669)",
                color: "#fff",
              }}
            >
              Start Your Match
            </button>
          )}
          {myMatch && (myMatch.status === MatchStatus.Ready || myMatch.status === MatchStatus.InProgress) && (
            <button
              onClick={handleForfeit}
              disabled={isLoading}
              className="px-6 py-2 rounded-lg border transition-all hover:bg-red-500/10"
              style={{ borderColor: "#ef4444", color: "#ef4444" }}
            >
              Forfeit Match
            </button>
          )}
          {myMatch && myMatch.status === MatchStatus.InProgress && myMatch.gameId && (
            <button
              onClick={() => onGameStart(myMatch.gameId!)}
              className="px-6 py-2 rounded-lg font-medium transition-all hover:opacity-90 animate-pulse"
              style={{
                background: "linear-gradient(135deg, var(--home-accent-yellow), #d97706)",
                color: "#000",
              }}
            >
              Return to Match
            </button>
          )}
        </div>

        {/* Tournament Info */}
        <div
          className="grid md:grid-cols-2 gap-6 mb-8"
        >
          {/* Players List */}
          <div
            className="p-5 rounded-xl border"
            style={{
              background: "var(--home-bg-card)",
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <h3 className="text-lg font-semibold mb-4">
              Players ({tournament.registeredPlayers.length}/{tournament.maxPlayers})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tournament.registeredPlayers.map((player, index) => (
                <div
                  key={player}
                  className="flex items-center gap-3 p-2 rounded-lg"
                  style={{
                    background: player === playerId ? "rgba(59, 130, 246, 0.1)" : "transparent",
                  }}
                >
                  <span className="text-sm" style={{ color: "var(--home-text-secondary)" }}>
                    {index + 1}.
                  </span>
                  <span className="text-sm truncate flex-1">
                    {player.slice(0, 20)}...
                    {player === tournament.creator && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(234, 179, 8, 0.2)", color: "var(--home-accent-gold)" }}>
                        Host
                      </span>
                    )}
                    {player === playerId && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa" }}>
                        You
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {tournament.registeredPlayers.length === 0 && (
                <p className="text-center py-4" style={{ color: "var(--home-text-secondary)" }}>
                  No players yet
                </p>
              )}
            </div>
          </div>

          {/* Tournament Details */}
          <div
            className="p-5 rounded-xl border"
            style={{
              background: "var(--home-bg-card)",
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <h3 className="text-lg font-semibold mb-4">Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span style={{ color: "var(--home-text-secondary)" }}>Format</span>
                <span>Single Elimination</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--home-text-secondary)" }}>Type</span>
                <span>{tournament.isPublic ? "Public" : "Private"}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--home-text-secondary)" }}>Time Control</span>
                <span>{getTimeControlLabel(tournament.timeControl)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--home-text-secondary)" }}>Rounds</span>
                <span>{tournament.totalRounds}</span>
              </div>
              {tournament.scheduledStart && tournament.status === TournamentStatus.Registration && (
                <div className="flex justify-between">
                  <span style={{ color: "var(--home-text-secondary)" }}>Scheduled Start</span>
                  <span style={{ color: "var(--home-accent-yellow)" }}>{formatScheduledTime(tournament.scheduledStart)}</span>
                </div>
              )}
              {tournament.status === TournamentStatus.InProgress && (
                <div className="flex justify-between">
                  <span style={{ color: "var(--home-text-secondary)" }}>Current Round</span>
                  <span>{tournament.currentRound}/{tournament.totalRounds}</span>
                </div>
              )}
              {tournament.winner && (
                <div className="flex justify-between">
                  <span style={{ color: "var(--home-text-secondary)" }}>Winner</span>
                  <span style={{ color: "var(--home-accent-gold)" }}>{tournament.winner.slice(0, 12)}...</span>
                </div>
              )}
            </div>

            {/* Invite Code for private tournaments */}
            {!tournament.isPublic && tournament.inviteCode && (isCreator || isRegistered) && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                <p className="text-sm mb-2" style={{ color: "var(--home-text-secondary)" }}>
                  Invite Code
                </p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 px-3 py-2 rounded-lg font-mono text-xl tracking-widest text-center"
                    style={{
                      background: "rgba(139, 92, 246, 0.1)",
                      color: "#a78bfa",
                    }}
                  >
                    {tournament.inviteCode}
                  </code>
                  <button
                    onClick={() => copyInviteCode(tournament.inviteCode!)}
                    className="px-3 py-2 rounded-lg text-sm transition-all hover:opacity-80"
                    style={{
                      background: copiedCode ? "var(--home-accent-green)" : "rgba(139, 92, 246, 0.2)",
                      color: copiedCode ? "#fff" : "#a78bfa",
                    }}
                  >
                    {copiedCode ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bracket */}
        {tournament.status !== TournamentStatus.Registration && (
          <div
            className="p-5 rounded-xl border"
            style={{
              background: "var(--home-bg-card)",
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <h3 className="text-lg font-semibold mb-4">Bracket</h3>
            <TournamentBracket
              tournament={tournament}
              currentPlayerId={playerId || undefined}
              onMatchClick={handleMatchClick}
            />
          </div>
        )}
      </main>
    </div>
  );
}
