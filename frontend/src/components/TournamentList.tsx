"use client";

import { useEffect, useState } from "react";
import { useTournamentStore } from "@/store/tournament";
import { Tournament, TournamentStatus, TimeControl, TIME_CONTROLS } from "@/types/game";
import JoinByCodeModal from "./JoinByCodeModal";

interface TournamentListProps {
  playerId: string | null;
  onSelectTournament: (id: string) => void;
  onCreateTournament: () => void;
  onBack: () => void;
}

type TabType = "public" | "mine";

export default function TournamentList({
  playerId,
  onSelectTournament,
  onCreateTournament,
  onBack,
}: TournamentListProps) {
  const {
    tournaments,
    publicTournaments,
    isLoading,
    error,
    fetchTournaments,
    fetchPublicTournaments
  } = useTournamentStore();

  const [activeTab, setActiveTab] = useState<TabType>("public");
  const [showJoinByCode, setShowJoinByCode] = useState(false);

  useEffect(() => {
    fetchTournaments();
    fetchPublicTournaments();
    const interval = setInterval(() => {
      fetchTournaments();
      fetchPublicTournaments();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTournaments, fetchPublicTournaments]);

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

  const getStatusLabel = (status: TournamentStatus) => {
    switch (status) {
      case TournamentStatus.Registration:
        return "Open";
      case TournamentStatus.InProgress:
        return "Live";
      case TournamentStatus.Finished:
        return "Finished";
      default:
        return status;
    }
  };

  const getTimeControlLabel = (tc: TimeControl) => {
    return TIME_CONTROLS[tc]?.label || tc;
  };

  const isRegistered = (tournament: Tournament) => {
    return playerId ? tournament.registeredPlayers.includes(playerId) : false;
  };

  const formatScheduledTime = (timestamp: number) => {
    const date = new Date(timestamp / 1000); // Convert from microseconds to milliseconds
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get my tournaments (ones I'm registered in or created)
  const myTournaments = tournaments.filter(
    (t) => playerId && (t.registeredPlayers.includes(playerId) || t.creator === playerId)
  );

  // Get display tournaments based on active tab
  const displayTournaments = activeTab === "public" ? publicTournaments : myTournaments;

  const handleJoinedByCode = (tournamentId: string, tournamentName: string) => {
    setShowJoinByCode(false);
    onSelectTournament(tournamentId);
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
          <h1
            className="text-2xl md:text-4xl tracking-wider"
            style={{
              fontFamily: "var(--font-bebas)",
              background: "linear-gradient(135deg, #fff 0%, #aaa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            TOURNAMENTS
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowJoinByCode(true)}
            className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 border"
            style={{
              borderColor: "var(--home-accent-purple)",
              color: "var(--home-accent-purple)",
            }}
          >
            Join by Code
          </button>
          <button
            onClick={onCreateTournament}
            className="px-6 py-2 rounded-lg font-medium transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, var(--home-accent-green), #059669)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(16, 185, 129, 0.3)",
            }}
          >
            Create
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("public")}
            className="px-5 py-2 rounded-lg font-medium transition-all"
            style={{
              background: activeTab === "public" ? "var(--home-accent-green)" : "transparent",
              color: activeTab === "public" ? "#fff" : "var(--home-text-secondary)",
              border: activeTab === "public" ? "none" : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Public Tournaments
          </button>
          <button
            onClick={() => setActiveTab("mine")}
            className="px-5 py-2 rounded-lg font-medium transition-all"
            style={{
              background: activeTab === "mine" ? "var(--home-accent-purple)" : "transparent",
              color: activeTab === "mine" ? "#fff" : "var(--home-text-secondary)",
              border: activeTab === "mine" ? "none" : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            My Tournaments
            {myTournaments.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.2)" }}>
                {myTournaments.length}
              </span>
            )}
          </button>
        </div>

        {isLoading && displayTournaments.length === 0 && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "var(--home-accent-green)" }} />
            <p style={{ color: "var(--home-text-secondary)" }}>Loading tournaments...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!isLoading && displayTournaments.length === 0 && (
          <div className="text-center py-12">
            {activeTab === "public" ? (
              <>
                <p className="text-xl mb-4" style={{ color: "var(--home-text-secondary)" }}>No public tournaments</p>
                <p style={{ color: "var(--home-text-secondary)" }}>Be the first to create one!</p>
              </>
            ) : (
              <>
                <p className="text-xl mb-4" style={{ color: "var(--home-text-secondary)" }}>No tournaments joined</p>
                <p style={{ color: "var(--home-text-secondary)" }}>Join a public tournament or enter an invite code</p>
              </>
            )}
          </div>
        )}

        {/* Tournament Grid */}
        <div className="grid gap-4">
          {displayTournaments.map((tournament) => (
            <div
              key={tournament.id}
              onClick={() => onSelectTournament(tournament.id)}
              className="p-5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] hover:border-white/20"
              style={{
                background: "var(--home-bg-card)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{tournament.name}</h3>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        background: `${getStatusColor(tournament.status)}20`,
                        color: getStatusColor(tournament.status),
                      }}
                    >
                      {getStatusLabel(tournament.status)}
                    </span>
                    {!tournament.isPublic && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: "rgba(139, 92, 246, 0.2)",
                          color: "#a78bfa",
                        }}
                      >
                        Private
                      </span>
                    )}
                    {isRegistered(tournament) && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: "rgba(59, 130, 246, 0.2)",
                          color: "#60a5fa",
                        }}
                      >
                        Joined
                      </span>
                    )}
                    {tournament.creator === playerId && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: "rgba(251, 191, 36, 0.2)",
                          color: "#fbbf24",
                        }}
                      >
                        Creator
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: "var(--home-text-secondary)" }}>
                    <span>{getTimeControlLabel(tournament.timeControl)}</span>
                    <span>•</span>
                    <span>{tournament.registeredPlayers.length}/{tournament.maxPlayers} players</span>
                    <span>•</span>
                    <span>{tournament.totalRounds} rounds</span>
                    {tournament.scheduledStart && tournament.status === TournamentStatus.Registration && (
                      <>
                        <span>•</span>
                        <span style={{ color: "var(--home-accent-yellow)" }}>
                          Starts: {formatScheduledTime(tournament.scheduledStart)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  {tournament.status === TournamentStatus.InProgress && (
                    <div className="text-sm" style={{ color: "var(--home-text-secondary)" }}>
                      Round {tournament.currentRound}/{tournament.totalRounds}
                    </div>
                  )}
                  {tournament.status === TournamentStatus.Finished && tournament.winner && (
                    <div className="text-sm" style={{ color: "var(--home-accent-gold)" }}>
                      Winner: {tournament.winner.slice(0, 12)}...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Join by Code Modal */}
      {showJoinByCode && (
        <JoinByCodeModal
          onClose={() => setShowJoinByCode(false)}
          onJoined={handleJoinedByCode}
        />
      )}
    </div>
  );
}
