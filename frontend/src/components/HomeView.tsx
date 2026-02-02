"use client";

import { useMemo } from "react";
import {
  CheckersGame,
  GameStatus,
  Turn,
  TimeControl,
  PlayerStats,
} from "@/types/game";

interface HomeViewProps {
  // Wallet state
  playerId: string | null;
  ready: boolean;

  // Games data
  games: CheckersGame[];
  myActiveGames: CheckersGame[];
  myStats: PlayerStats | null;

  // Handlers
  onTimeControlSelect: (tc: TimeControl) => void;
  onSelectGame: (gameId: string) => void;

  // Invite modal trigger
  setShowInviteModal: (show: boolean) => void;

  // Tournaments
  onTournaments?: () => void;
}

// Time control card configuration
const TIME_CONTROL_CONFIG: Record<TimeControl, { display: string; type: string; duration: string; category: "bullet" | "blitz" | "rapid" }> = {
  [TimeControl.Bullet1m]: { display: "1+0", type: "Bullet", duration: "1 min", category: "bullet" },
  [TimeControl.Bullet2m]: { display: "2+1", type: "Bullet", duration: "2 min +1s", category: "bullet" },
  [TimeControl.Blitz3m]: { display: "3+0", type: "Blitz", duration: "3 min", category: "blitz" },
  [TimeControl.Blitz5m]: { display: "5+3", type: "Blitz", duration: "5 min +3s", category: "blitz" },
  [TimeControl.Rapid10m]: { display: "10+0", type: "Rapid", duration: "10 min", category: "rapid" },
};

export default function HomeView({
  playerId,
  ready,
  games,
  myActiveGames,
  myStats,
  onTimeControlSelect,
  onSelectGame,
  setShowInviteModal,
  onTournaments,
}: HomeViewProps) {
  // Compute stats
  const activeGamesCount = useMemo(() => {
    return games.filter((g) => g.status === GameStatus.Active).length;
  }, [games]);

  const myRating = useMemo(() => {
    if (!myStats) return 1500;
    // Use blitz rating as default display
    return myStats.blitzRating || 1500;
  }, [myStats]);

  // Mock queue counts (would come from backend in production)
  const queueCounts: Record<TimeControl, number> = {
    [TimeControl.Bullet1m]: 3,
    [TimeControl.Bullet2m]: 5,
    [TimeControl.Blitz3m]: 12,
    [TimeControl.Blitz5m]: 8,
    [TimeControl.Rapid10m]: 4,
  };

  // Helper to get opponent info
  const getOpponentId = (game: CheckersGame) => {
    const isRedPlayer = game.redPlayer === playerId;
    const opponentId = isRedPlayer ? game.blackPlayer : game.redPlayer;
    if (!opponentId || opponentId === "AI") return "AI";
    return opponentId.slice(0, 12) + "...";
  };

  // Helper to check if it's user's turn
  const isMyTurn = (game: CheckersGame) => {
    const isRedPlayer = game.redPlayer === playerId;
    if (isRedPlayer && game.currentTurn === Turn.Red) return true;
    if (!isRedPlayer && game.currentTurn === Turn.Black) return true;
    return false;
  };

  // Helper to get player color
  const getMyColor = (game: CheckersGame) => {
    return game.redPlayer === playerId ? "Red" : "Black";
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
      {/* Background elements */}
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
          {/* Animated Logo */}
          <div
            className="w-12 h-12 grid grid-cols-4 grid-rows-4 gap-0.5 animate-logoFloat"
            style={{ transform: "rotate(-10deg)" }}
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className="rounded-sm"
                style={{
                  background:
                    i === 5 || i === 10
                      ? "var(--home-accent-red)"
                      : i % 2 === 0
                      ? "var(--home-wood-light)"
                      : "var(--home-wood-dark)",
                  boxShadow:
                    i === 5 || i === 10
                      ? "0 0 10px var(--home-glow-red)"
                      : "none",
                }}
              />
            ))}
          </div>
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
            LINERA CHECKERS
          </h1>
        </div>

        {/* User Badge */}
        {ready && playerId && (
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-full border transition-all hover:shadow-lg"
            style={{
              background: "var(--home-bg-card)",
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full animate-statusPulse"
              style={{ background: "var(--home-accent-green)" }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--home-text-secondary)" }}
            >
              {playerId.slice(0, 15)}...
            </span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Hero */}
        <div className="text-center mb-10 animate-fadeInUp">
          <h2
            className="text-4xl md:text-6xl tracking-wide mb-2"
            style={{ fontFamily: "var(--font-bebas)" }}
          >
            READY TO PLAY?
          </h2>
          <p style={{ color: "var(--home-text-secondary)" }}>
            Select a time control and find an opponent
          </p>
        </div>

        {/* Stats Bar */}
        <div
          className="grid grid-cols-3 gap-4 mb-8 animate-fadeInUp"
          style={{ animationDelay: "0.1s" }}
        >
          {[
            { value: "32", label: "Players Online" },
            { value: activeGamesCount.toString(), label: "Active Games" },
            { value: myRating.toLocaleString(), label: "Your Rating" },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 md:p-6 text-center border"
              style={{
                background: "var(--home-bg-card)",
                borderColor: "rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="text-3xl md:text-4xl"
                style={{
                  fontFamily: "var(--font-bebas)",
                  background:
                    "linear-gradient(135deg, var(--home-accent-gold), var(--home-accent-red))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {stat.value}
              </div>
              <div
                className="text-xs uppercase tracking-widest mt-1"
                style={{ color: "var(--home-text-secondary)" }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Time Control Selection */}
        <div
          className="rounded-3xl p-6 md:p-8 mb-6 border backdrop-blur-md animate-fadeInUp"
          style={{
            background: "var(--home-bg-card)",
            borderColor: "rgba(255,255,255,0.05)",
            animationDelay: "0.2s",
          }}
        >
          <h3
            className="text-xl tracking-wider mb-6 flex items-center gap-3"
            style={{ fontFamily: "var(--font-bebas)" }}
          >
            <span
              className="w-1 h-6 rounded"
              style={{
                background:
                  "linear-gradient(180deg, var(--home-accent-red), var(--home-accent-gold))",
              }}
            />
            SELECT TIME CONTROL
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
            {Object.entries(TIME_CONTROL_CONFIG).map(([tc, config]) => {
              const timeControl = tc as TimeControl;
              const categoryColors = {
                bullet: {
                  accent: "var(--home-accent-red)",
                  glow: "rgba(255, 68, 68, 0.2)",
                },
                blitz: {
                  accent: "var(--home-accent-gold)",
                  glow: "rgba(255, 215, 0, 0.2)",
                },
                rapid: {
                  accent: "var(--home-accent-green)",
                  glow: "rgba(0, 255, 136, 0.2)",
                },
              };
              const colors = categoryColors[config.category];

              return (
                <button
                  key={tc}
                  onClick={() => onTimeControlSelect(timeControl)}
                  className="relative rounded-2xl p-4 md:p-5 text-center cursor-pointer transition-all duration-300 border-2 border-transparent hover:-translate-y-2 group"
                  style={{ background: "var(--home-bg-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 20px 40px ${colors.glow}`;
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  {/* Top accent bar */}
                  <span
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: colors.accent }}
                  />

                  {/* Queue count badge */}
                  <span
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center animate-homeBounce"
                    style={{ background: "var(--home-accent-red)" }}
                  >
                    {queueCounts[timeControl]}
                  </span>

                  <div
                    className="text-3xl md:text-4xl tracking-wide mb-1"
                    style={{
                      fontFamily: "var(--font-bebas)",
                      color: colors.accent,
                    }}
                  >
                    {config.display}
                  </div>
                  <div
                    className="text-xs uppercase tracking-widest mb-1"
                    style={{ color: "var(--home-text-secondary)" }}
                  >
                    {config.type}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    {config.duration}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div
            className="flex justify-center gap-6 md:gap-8 pt-4 border-t"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            {[
              { label: "Bullet", color: "var(--home-accent-red)" },
              { label: "Blitz", color: "var(--home-accent-gold)" },
              { label: "Rapid", color: "var(--home-accent-green)" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--home-text-secondary)" }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: item.color }}
                />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 my-8 md:my-10 flex-wrap">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-3 px-8 py-4 rounded-full font-bold text-white transition-all hover:scale-105 relative overflow-hidden"
            style={{
              fontFamily: "var(--font-space)",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                "0 20px 40px rgba(99, 102, 241, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span className="text-xl">👥</span>
            Invite a Friend
          </button>
          {onTournaments && (
            <button
              onClick={onTournaments}
              className="flex items-center gap-3 px-8 py-4 rounded-full font-bold text-white transition-all hover:scale-105 relative overflow-hidden"
              style={{
                fontFamily: "var(--font-space)",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 20px 40px rgba(245, 158, 11, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <span className="text-xl">🏆</span>
              Tournaments
            </button>
          )}
        </div>

        {/* Active Games */}
        <div
          className="rounded-3xl p-6 md:p-8 border backdrop-blur-md animate-fadeInUp"
          style={{
            background: "var(--home-bg-card)",
            borderColor: "rgba(255,255,255,0.05)",
            animationDelay: "0.3s",
          }}
        >
          <h3
            className="text-xl tracking-wider mb-6 flex items-center gap-3"
            style={{ fontFamily: "var(--font-bebas)" }}
          >
            <span
              className="w-1 h-6 rounded"
              style={{
                background:
                  "linear-gradient(180deg, var(--home-accent-red), var(--home-accent-gold))",
              }}
            />
            YOUR ACTIVE GAMES
          </h3>

          {myActiveGames.length === 0 ? (
            <div
              className="text-center py-12"
              style={{ color: "var(--home-text-secondary)" }}
            >
              <div className="text-5xl mb-4 opacity-30">🎮</div>
              <p>No active games. Start a new game above!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myActiveGames.map((game) => {
                const myTurn = isMyTurn(game);
                const myColor = getMyColor(game);
                const opponent = getOpponentId(game);

                return (
                  <button
                    key={game.id}
                    onClick={() => onSelectGame(game.id)}
                    className="flex items-center justify-between p-4 md:p-5 rounded-2xl transition-all cursor-pointer border border-transparent hover:translate-x-2 group text-left w-full"
                    style={{ background: "var(--home-bg-secondary)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "var(--home-accent-gold)";
                      e.currentTarget.style.boxShadow =
                        "0 10px 30px rgba(255, 215, 0, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "transparent";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{
                          background:
                            myColor === "Red"
                              ? "linear-gradient(135deg, var(--home-accent-red), #ff6666)"
                              : "linear-gradient(135deg, #333, #666)",
                        }}
                      >
                        {myColor === "Red" ? "🔴" : "⚫"}
                      </div>
                      <div>
                        <h4 className="font-medium">vs {opponent}</h4>
                        <p
                          className="text-sm"
                          style={{ color: "var(--home-text-secondary)" }}
                        >
                          Move {game.moveCount} • Playing as {myColor}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide"
                        style={{
                          background: myTurn
                            ? "rgba(0, 255, 136, 0.1)"
                            : "rgba(255, 215, 0, 0.1)",
                          color: myTurn
                            ? "var(--home-accent-green)"
                            : "var(--home-accent-gold)",
                          animation: !myTurn
                            ? "statusPulse 2s ease-in-out infinite"
                            : "none",
                        }}
                      >
                        {myTurn ? "Your Turn" : "Waiting"}
                      </span>
                      <span
                        className="text-xl opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                        style={{ color: "var(--home-accent-gold)" }}
                      >
                        →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
