"use client";

import { CheckersGame, GameStatus, Turn, PlayerType } from "@/types/game";

interface GameListProps {
  games: CheckersGame[];
  currentChainId: string | null;
  onSelectGame: (gameId: string) => void;
  onJoinGame?: (gameId: string) => void;
  selectedGameId?: string | null;
}

export default function GameList({
  games,
  currentChainId,
  onSelectGame,
  onJoinGame,
  selectedGameId,
}: GameListProps) {
  if (games.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No games available. Create one to start playing!
      </div>
    );
  }

  const formatChainId = (chainId: string | undefined) => {
    if (!chainId) return "Waiting...";
    if (chainId === "AI") return "AI";
    return `${chainId.slice(0, 6)}...${chainId.slice(-4)}`;
  };

  const getStatusBadge = (game: CheckersGame) => {
    switch (game.status) {
      case GameStatus.Pending:
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
            Waiting
          </span>
        );
      case GameStatus.Active:
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
            Active
          </span>
        );
      case GameStatus.Finished:
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
            Finished
          </span>
        );
      default:
        return null;
    }
  };

  const isMyGame = (game: CheckersGame) => {
    return (
      game.redPlayer === currentChainId || game.blackPlayer === currentChainId
    );
  };

  const canJoin = (game: CheckersGame) => {
    return (
      game.status === GameStatus.Pending &&
      game.redPlayer !== currentChainId &&
      !game.blackPlayer
    );
  };

  return (
    <div className="space-y-3">
      {games.map((game) => (
        <div
          key={game.id}
          className={`
            p-4 rounded-lg border-2 cursor-pointer transition-all
            ${
              selectedGameId === game.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }
            ${isMyGame(game) ? "ring-2 ring-blue-200" : ""}
          `}
          onClick={() => onSelectGame(game.id)}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold text-gray-800">
                Game #{game.id.replace("game_", "")}
                {isMyGame(game) && (
                  <span className="ml-2 text-xs text-blue-600">(Your Game)</span>
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                <span
                  className={
                    game.redPlayer === currentChainId ? "font-bold" : ""
                  }
                >
                  Red: {formatChainId(game.redPlayer)}
                </span>
                {game.redPlayerType === PlayerType.AI && (
                  <span className="ml-1 text-purple-600">(AI)</span>
                )}
                <span className="mx-2">vs</span>
                <span
                  className={
                    game.blackPlayer === currentChainId ? "font-bold" : ""
                  }
                >
                  Black: {formatChainId(game.blackPlayer)}
                </span>
                {game.blackPlayerType === PlayerType.AI && (
                  <span className="ml-1 text-purple-600">(AI)</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
              {getStatusBadge(game)}
              {game.status === GameStatus.Active && (
                <span className="text-xs text-gray-500">
                  Turn: {game.currentTurn === Turn.Red ? "Red" : "Black"}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-gray-500">
              Moves: {game.moveCount}
            </span>

            {canJoin(game) && onJoinGame && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJoinGame(game.id);
                }}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Join Game
              </button>
            )}

            {game.result && (
              <span
                className={`text-sm font-medium ${
                  game.result === "RED_WINS"
                    ? "text-red-600"
                    : game.result === "BLACK_WINS"
                    ? "text-gray-800"
                    : "text-blue-600"
                }`}
              >
                {game.result === "RED_WINS"
                  ? "Red Wins!"
                  : game.result === "BLACK_WINS"
                  ? "Black Wins!"
                  : "Draw"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
