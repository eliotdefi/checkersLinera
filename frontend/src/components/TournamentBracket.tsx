"use client";

import { useMemo } from "react";
import { Tournament, TournamentMatch, MatchStatus } from "@/types/game";

interface TournamentBracketProps {
  tournament: Tournament;
  currentPlayerId?: string;
  onMatchClick?: (match: TournamentMatch) => void;
}

function shortenId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...`;
}

function MatchCard({
  match,
  isCurrentPlayer,
  onClick,
}: {
  match: TournamentMatch;
  isCurrentPlayer: boolean;
  onClick?: () => void;
}) {
  const getStatusColor = () => {
    switch (match.status) {
      case MatchStatus.Ready:
        return "var(--home-accent-green)";
      case MatchStatus.InProgress:
        return "var(--home-accent-yellow)";
      case MatchStatus.Finished:
        return "rgba(255,255,255,0.2)";
      case MatchStatus.Bye:
        return "rgba(255,255,255,0.1)";
      default:
        return "rgba(255,255,255,0.1)";
    }
  };

  const isClickable = match.status === MatchStatus.Ready || match.status === MatchStatus.InProgress;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`
        rounded-lg border-2 transition-all
        ${isCurrentPlayer ? "ring-2 ring-blue-400" : ""}
        ${isClickable ? "cursor-pointer hover:bg-white/5" : ""}
      `}
      style={{
        background: "var(--home-bg-card)",
        borderColor: getStatusColor(),
        minWidth: "160px",
      }}
    >
      {/* Player 1 */}
      <div
        className={`
          px-3 py-2 flex justify-between items-center border-b
          ${match.winner === match.player1 ? "bg-green-900/30" : ""}
        `}
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        <span className="text-sm truncate" style={{ color: match.player1 ? "var(--home-text-primary)" : "var(--home-text-secondary)" }}>
          {match.player1 ? shortenId(match.player1) : "TBD"}
        </span>
        {match.winner === match.player1 && (
          <span style={{ color: "var(--home-accent-green)" }}>✓</span>
        )}
      </div>

      {/* Player 2 */}
      <div
        className={`
          px-3 py-2 flex justify-between items-center
          ${match.winner === match.player2 ? "bg-green-900/30" : ""}
        `}
      >
        <span className="text-sm truncate" style={{ color: match.player2 ? "var(--home-text-primary)" : "var(--home-text-secondary)" }}>
          {match.player2 ? shortenId(match.player2) : "TBD"}
        </span>
        {match.winner === match.player2 && (
          <span style={{ color: "var(--home-accent-green)" }}>✓</span>
        )}
      </div>

      {/* Status badge */}
      {match.status === MatchStatus.InProgress && (
        <div
          className="px-3 py-1 text-xs text-center"
          style={{
            background: "rgba(234, 179, 8, 0.2)",
            color: "var(--home-accent-yellow)",
          }}
        >
          LIVE
        </div>
      )}
      {match.status === MatchStatus.Ready && (
        <div
          className="px-3 py-1 text-xs text-center"
          style={{
            background: "rgba(16, 185, 129, 0.2)",
            color: "var(--home-accent-green)",
          }}
        >
          READY
        </div>
      )}
      {match.status === MatchStatus.Bye && (
        <div
          className="px-3 py-1 text-xs text-center"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: "var(--home-text-secondary)",
          }}
        >
          BYE
        </div>
      )}
    </div>
  );
}

export default function TournamentBracket({
  tournament,
  currentPlayerId,
  onMatchClick,
}: TournamentBracketProps) {
  // Group matches by round
  const matchesByRound = useMemo(() => {
    const grouped: Map<number, TournamentMatch[]> = new Map();
    for (let r = 1; r <= tournament.totalRounds; r++) {
      grouped.set(
        r,
        tournament.matches
          .filter((m) => m.round === r)
          .sort((a, b) => a.matchNumber - b.matchNumber)
      );
    }
    return grouped;
  }, [tournament]);

  const getRoundName = (round: number) => {
    if (round === tournament.totalRounds) return "Finals";
    if (round === tournament.totalRounds - 1) return "Semifinals";
    if (round === tournament.totalRounds - 2) return "Quarterfinals";
    return `Round ${round}`;
  };

  if (tournament.matches.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: "var(--home-text-secondary)" }}>
        Bracket will be generated when tournament starts
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="flex gap-8 min-w-fit"
        style={{ padding: "1rem" }}
      >
        {/* Render each round as a column */}
        {Array.from({ length: tournament.totalRounds }, (_, i) => i + 1).map((round) => (
          <div key={round} className="flex flex-col">
            {/* Round header */}
            <div
              className="text-center text-sm font-semibold mb-4 px-4"
              style={{ color: "var(--home-text-secondary)" }}
            >
              {getRoundName(round)}
            </div>

            {/* Matches in this round */}
            <div
              className="flex flex-col justify-around flex-1"
              style={{ gap: `${Math.pow(2, round - 1) * 16}px` }}
            >
              {matchesByRound.get(round)?.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isCurrentPlayer={
                    match.player1 === currentPlayerId ||
                    match.player2 === currentPlayerId
                  }
                  onClick={() => onMatchClick?.(match)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Winner column */}
        {tournament.winner && (
          <div className="flex flex-col">
            <div
              className="text-center text-sm font-semibold mb-4 px-4"
              style={{ color: "var(--home-accent-gold)" }}
            >
              Champion
            </div>
            <div
              className="flex items-center justify-center flex-1 px-4 py-3 rounded-lg border-2"
              style={{
                background: "linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(217, 119, 6, 0.2))",
                borderColor: "var(--home-accent-gold)",
              }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--home-accent-gold)" }}>
                {shortenId(tournament.winner)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
