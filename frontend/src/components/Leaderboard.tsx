"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "@/store/wallet";
import { PlayerStats, RatingTier, getRatingTier, TimeControlCategory, TimeControl } from "@/types/game";
import RatingBadge from "./RatingBadge";

interface LeaderboardProps {
  currentChainId?: string | null;
}

const GET_LEADERBOARD = `
  query GetLeaderboard($limit: Int!) {
    leaderboard(limit: $limit) {
      chainId
      gamesPlayed
      gamesWon
      gamesLost
      gamesDrawn
      winStreak
      bestStreak
      bulletRating
      blitzRating
      rapidRating
      bulletGames
      blitzGames
      rapidGames
    }
  }
`;

export default function Leaderboard({ currentChainId }: LeaderboardProps) {
  const { requestAsync, ready } = useWalletStore();
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;

    const fetchLeaderboard = async () => {
      try {
        const data = await requestAsync<{ leaderboard: PlayerStats[] }>({
          query: GET_LEADERBOARD,
          variables: { limit: 10 },
        });
        setLeaderboard(data?.leaderboard || []);
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e);
        setLeaderboard([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [ready, requestAsync]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4">
          <h3 className="text-xl font-bold text-white flex items-center">
            <span className="mr-2">🏆</span>
            Leaderboard
          </h3>
        </div>
        <div className="animate-pulse p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4">
          <h3 className="text-xl font-bold text-white flex items-center">
            <span className="mr-2">🏆</span>
            Leaderboard
          </h3>
        </div>
        <div className="text-center text-gray-500 py-8">
          No players on leaderboard yet
        </div>
      </div>
    );
  }

  const formatChainId = (chainId: string) => {
    if (!chainId) return "Unknown";
    return `${chainId.slice(0, 6)}...${chainId.slice(-4)}`;
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <span className="text-2xl">🥇</span>;
      case 2:
        return <span className="text-2xl">🥈</span>;
      case 3:
        return <span className="text-2xl">🥉</span>;
      default:
        return (
          <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-sm font-medium text-gray-600">
            {rank}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <span className="mr-2">🏆</span>
          Leaderboard
        </h3>
      </div>

      <div className="divide-y divide-gray-100">
        {[...leaderboard]
          .sort((a, b) => {
            const ratingDiff = (b.blitzRating || 1200) - (a.blitzRating || 1200);
            if (ratingDiff !== 0) return ratingDiff;
            return b.gamesWon - a.gamesWon;
          })
          .map((player, index) => {
          const isCurrentPlayer = player.chainId === currentChainId;
          const winRate =
            player.gamesPlayed > 0
              ? Math.round((player.gamesWon / player.gamesPlayed) * 100)
              : 0;

          return (
            <div
              key={player.chainId}
              className={`
                p-4 flex items-center space-x-4
                ${isCurrentPlayer ? "bg-blue-50 border-l-4 border-blue-500" : ""}
                hover:bg-gray-50 transition-colors
              `}
            >
              {/* Rank */}
              <div className="flex-shrink-0">{getRankBadge(index + 1)}</div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <span className="font-mono text-sm text-gray-800 truncate">
                    {formatChainId(player.chainId)}
                  </span>
                  {isCurrentPlayer && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                      You
                    </span>
                  )}
                  <div className="ml-2">
                    <RatingBadge
                      rating={player.blitzRating || 1200}
                      gamesPlayed={player.blitzGames || 0}
                      size="sm"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {player.gamesPlayed} games played
                </div>
              </div>

              {/* Stats */}
              <div className="flex-shrink-0 text-right">
                <div className="text-lg font-bold text-green-600">
                  {player.gamesWon}
                  <span className="text-xs text-gray-400 font-normal ml-1">
                    wins
                  </span>
                </div>
                <div className="text-xs text-gray-500">{winRate}% win rate</div>
              </div>

              {/* Win Streak */}
              {player.winStreak > 0 && (
                <div className="flex-shrink-0">
                  <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs rounded-full">
                    🔥 {player.winStreak}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
