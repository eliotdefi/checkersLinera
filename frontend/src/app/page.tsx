"use client";

import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWalletStore } from "@/store/wallet";
import { useGameStore } from "@/store/game";
import { useGameSounds } from "@/hooks/useGameSounds";
import WalletConnect from "@/components/WalletConnect";
import CheckersBoard from "@/components/CheckersBoard";
import TimeControlGrid from "@/components/TimeControlGrid";
import TimeControlModal from "@/components/TimeControlModal";
import Timer from "@/components/Timer";
import FloatingToolbar from "@/components/FloatingToolbar";
import MoveHistory from "@/components/MoveHistory";
import QueueWaiting from "@/components/QueueWaiting";
import InviteFriendModal from "@/components/InviteFriendModal";
import HomeView from "@/components/HomeView";
import TournamentList from "@/components/TournamentList";
import TournamentLobby from "@/components/TournamentLobby";
import CreateTournamentModal from "@/components/CreateTournamentModal";
import {
  GameStatus,
  Turn,
  PlayerType,
  TimeControl,
  DrawOfferState,
  TIME_CONTROLS,
  getPlayerRating,
  getPlayerGamesInCategory,
} from "@/types/game";
import RatingBadge from "@/components/RatingBadge";

// Default board state for display when no game is selected
const DEFAULT_BOARD_STATE = " r r r r/r r r r/ r r r r/        /        / b b b b/b b b b/ b b b b";

// View type for the Lichess-style navigation
type ViewType = "home" | "game" | "queue" | "tournaments" | "tournament";

function HomeContent() {
  // Router and search params for invite links
  const searchParams = useSearchParams();
  const router = useRouter();
  const joinGameId = searchParams.get("join");

  // Zustand wallet store
  const {
    chainId,
    playerId,
    ready,
    notification,
    init: initWallet,
    incrementNotification,
  } = useWalletStore();

  // Zustand game store
  const {
    games,
    selectedGame,
    selectedGameId,
    isLoading,
    isMoving,
    error: gameError,
    fetchGames,
    fetchGame,
    selectGame,
    createGame: createGameAction,
    joinGame: joinGameAction,
    makeMove: makeMoveAction,
    resign: resignAction,
    requestAiMove: requestAiMoveAction,
    claimTimeWin,
    joinQueue: joinQueueAction,
    leaveQueue: leaveQueueAction,
    myStats,
    opponentStats,
    lastRatingChange,
    fetchMyStats,
    fetchOpponentStats,
    setLastRatingChange,
    clearStats,
  } = useGameStore();

  // View state for Lichess-style UI
  const [view, setView] = useState<ViewType>("home");
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl | null>(null);
  const [showTimeControlModal, setShowTimeControlModal] = useState(false);

  // Queue state
  const [isInQueue, setIsInQueue] = useState(false);
  const [queueTimeControl, setQueueTimeControl] = useState<TimeControl | null>(null);

  // Timer state (simulated - would come from game store in production)
  const [redTimeMs, setRedTimeMs] = useState(300000); // 5 minutes default
  const [blackTimeMs, setBlackTimeMs] = useState(300000);

  // Draw offer state (simulated - would come from game store in production)
  const [drawOfferState, setDrawOfferState] = useState<DrawOfferState>(DrawOfferState.None);

  const [isCreating, setIsCreating] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Invite friend modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Tournament state
  const [showCreateTournamentModal, setShowCreateTournamentModal] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [currentGameTournamentId, setCurrentGameTournamentId] = useState<string | null>(null);

  // Ref to prevent duplicate AI move requests
  const aiMoveInProgress = useRef(false);

  // Ref to prevent duplicate time win claims
  const timeWinClaimInProgress = useRef(false);

  // Ref to store queue polling interval
  const queuePollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sound effects
  const { playSound, toggleSound, isSoundEnabled } = useGameSounds();

  // Last move tracking for board highlight
  const [lastMove, setLastMove] = useState<{
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  } | null>(null);

  // Premove state
  const [premove, setPremove] = useState<{
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  } | null>(null);

  // Initialize wallet on mount (auto-connect via Hub Chain pattern)
  useEffect(() => {
    initWallet();
  }, [initWallet]);

  // Handle invite link URL parameter - auto-join when ?join= is present (Hub Chain pattern)
  useEffect(() => {
    async function handleAutoJoin() {
      if (!joinGameId || !playerId || !ready || isJoiningInvite) return;

      setIsJoiningInvite(true);
      setInviteError(null);

      try {
        // First fetch the game to check its status
        await fetchGame(joinGameId);
        const { selectedGame: game } = useGameStore.getState();

        if (!game) {
          setInviteError("Game not found");
          setIsJoiningInvite(false);
          return;
        }

        // Check if we're already in this game (using playerId)
        const isAlreadyInGame =
          game.redPlayer === playerId || game.blackPlayer === playerId;

        if (isAlreadyInGame) {
          // We're already in this game - just select it and go to game view
          selectGame(joinGameId);
          setView("game");
          router.replace("/");
          setIsJoiningInvite(false);
          return;
        }

        if (game.status !== GameStatus.Pending) {
          setInviteError("Game is no longer available to join");
          setIsJoiningInvite(false);
          return;
        }

        // Join the game
        const success = await joinGameAction(joinGameId);

        if (success) {
          selectGame(joinGameId);
          setView("game");
          router.replace("/");
        } else {
          setInviteError("Failed to join game");
        }
      } catch (err) {
        console.error("[Page] Error joining game:", err);
        setInviteError("Error joining game");
      } finally {
        setIsJoiningInvite(false);
      }
    }

    handleAutoJoin();
  }, [joinGameId, playerId, ready, isJoiningInvite, fetchGame, joinGameAction, selectGame, router]);

  // Fetch games when wallet is ready (notification-driven)
  useEffect(() => {
    if (ready) {
      fetchGames();
    }
  }, [ready, notification, fetchGames]);

  // Poll for updates during active games AND pending games (waiting for opponent)
  useEffect(() => {
    // Poll for both Active games (for move updates) and Pending games (waiting for opponent to join)
    if (!ready || !selectedGame || selectedGame.status === GameStatus.Finished) {
      return;
    }

    const currentGameId = selectedGameId;

    // Use faster polling for pending games (opponent might join any moment)
    const pollInterval = selectedGame.status === GameStatus.Pending ? 1500 : 2000;

    const interval = setInterval(() => {
      if (currentGameId && currentGameId === useGameStore.getState().selectedGameId) {
        fetchGame(currentGameId);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [ready, selectedGame?.status, selectedGame?.id, selectedGameId, fetchGame]);

  // Reset AI move flag when game changes
  useEffect(() => {
    aiMoveInProgress.current = false;
  }, [selectedGameId]);

  // Auto-switch to game view when selectedGame becomes active
  useEffect(() => {
    if (selectedGame && selectedGame.status === GameStatus.Active && view !== "game") {
      setView("game");
      setIsInQueue(false);
    }
  }, [selectedGame, selectedGame?.status, view]);

  // Close invite modal when opponent joins (game becomes active)
  useEffect(() => {
    if (showInviteModal && selectedGame?.status === GameStatus.Active) {
      setShowInviteModal(false);
    }
  }, [showInviteModal, selectedGame?.status]);

  // Initialize timer based on selected time control
  useEffect(() => {
    if (selectedGame && selectedTimeControl) {
      const metadata = TIME_CONTROLS[selectedTimeControl];
      const initialTimeMs = metadata.minutes * 60 * 1000;
      setRedTimeMs(initialTimeMs);
      setBlackTimeMs(initialTimeMs);
    }
  }, [selectedGame?.id, selectedTimeControl]);

  // Sync timer from backend game clock when game data is fetched
  useEffect(() => {
    // Only sync if we have a game with clock data
    if (!selectedGame) return;

    const clock = selectedGame.clock;
    if (!clock) return;

    // Only sync if values are valid
    if (typeof clock.redTimeMs === 'number' && clock.redTimeMs >= 0) {
      setRedTimeMs(clock.redTimeMs);
    }
    if (typeof clock.blackTimeMs === 'number' && clock.blackTimeMs >= 0) {
      setBlackTimeMs(clock.blackTimeMs);
    }

    console.log('[Page] Timer synced from backend:', {
      red: clock.redTimeMs,
      black: clock.blackTimeMs
    });
  }, [selectedGame?.id, selectedGame?.moveCount]); // Sync on game change or after each move

  // Sync lastMove from game's move history (to show opponent's last move)
  useEffect(() => {
    if (!selectedGame || !selectedGame.moves || selectedGame.moves.length === 0) {
      setLastMove(null);
      return;
    }

    // Get the most recent move from the game's history
    const latestMove = selectedGame.moves[selectedGame.moves.length - 1];
    if (latestMove) {
      setLastMove({
        fromRow: latestMove.fromRow,
        fromCol: latestMove.fromCol,
        toRow: latestMove.toRow,
        toCol: latestMove.toCol,
      });
    }
  }, [selectedGame?.id, selectedGame?.moveCount, selectedGame?.moves?.length]);

  // Timer countdown effect
  useEffect(() => {
    if (!selectedGame || selectedGame.status !== GameStatus.Active) {
      return;
    }

    const interval = setInterval(() => {
      if (selectedGame.currentTurn === Turn.Red) {
        setRedTimeMs((prev) => Math.max(0, prev - 100));
      } else {
        setBlackTimeMs((prev) => Math.max(0, prev - 100));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [selectedGame?.status, selectedGame?.currentTurn]);

  // Compute derived state
  const isConnected = ready && !!chainId;

  // Player color based on playerId (Hub Chain pattern)
  const playerColor = useMemo(() => {
    if (!selectedGame || !playerId) return "spectator";

    if (selectedGame.redPlayer === playerId) return "red";
    if (selectedGame.blackPlayer === playerId) return "black";

    return "spectator";
  }, [selectedGame, playerId]) as "red" | "black" | "spectator";

  // Is it my turn based on playerId (Hub Chain pattern)
  const isMyTurn = useMemo(() => {
    if (!selectedGame || !playerId) return false;

    let color: "red" | "black" | "spectator" = "spectator";
    if (selectedGame.redPlayer === playerId) color = "red";
    else if (selectedGame.blackPlayer === playerId) color = "black";

    if (color === "spectator") return false;
    if (color === "red" && selectedGame.currentTurn === Turn.Red) return true;
    if (color === "black" && selectedGame.currentTurn === Turn.Black) return true;

    return false;
  }, [selectedGame, playerId]);

  const isVsAI = selectedGame?.blackPlayerType === PlayerType.AI;
  const isAITurn = isVsAI && selectedGame?.currentTurn === Turn.Black && selectedGame?.status === GameStatus.Active;

  // Track previous turn state for sound effects
  const prevIsMyTurn = useRef(isMyTurn);
  const prevGameStatus = useRef(selectedGame?.status);

  // Show notification helper
  const showNotification = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      setNotificationMessage({ type, message });
      setTimeout(() => setNotificationMessage(null), 3000);
    },
    []
  );

  // Play sound when it becomes my turn (only for human vs human games)
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current && selectedGame?.status === GameStatus.Active && !isVsAI) {
      playSound('yourTurn');
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, selectedGame?.status, playSound, isVsAI]);

  // Play sound and show notification when game ends
  useEffect(() => {
    if (
      selectedGame?.status === GameStatus.Finished &&
      prevGameStatus.current === GameStatus.Active
    ) {
      const didIWin =
        (playerColor === 'red' && selectedGame.result === 'RED_WINS') ||
        (playerColor === 'black' && selectedGame.result === 'BLACK_WINS');
      const didILose =
        (playerColor === 'red' && selectedGame.result === 'BLACK_WINS') ||
        (playerColor === 'black' && selectedGame.result === 'RED_WINS');
      const isDraw = selectedGame.result === 'DRAW';

      if (didIWin) {
        playSound('win');
        showNotification('success', 'You won the game!');
      } else if (didILose) {
        playSound('lose');
        showNotification('error', 'You lost the game!');
      } else if (isDraw) {
        showNotification('info', 'Game ended in a draw!');
      }
    }
    prevGameStatus.current = selectedGame?.status;
  }, [selectedGame?.status, selectedGame?.result, playerColor, playSound, showNotification]);

  // Clear premove when game ends or changes
  useEffect(() => {
    if (!selectedGame || selectedGame.status !== GameStatus.Active) {
      setPremove(null);
    }
  }, [selectedGame?.id, selectedGame?.status]);

  // Fetch player stats when game is selected
  useEffect(() => {
    if (selectedGame && playerId) {
      fetchMyStats();
      const opponentId = playerColor === 'red'
        ? selectedGame.blackPlayer
        : selectedGame.redPlayer;
      if (opponentId) {
        fetchOpponentStats(opponentId);
      }
    }
    return () => {
      clearStats();
    };
  }, [selectedGame?.id, playerColor, playerId]);

  // Refetch stats when game finishes to show updated rating
  useEffect(() => {
    if (selectedGame?.status === GameStatus.Finished && playerId) {
      // Small delay to ensure backend has processed the result
      const timer = setTimeout(() => {
        fetchMyStats();
        const opponentId = playerColor === 'red'
          ? selectedGame.blackPlayer
          : selectedGame.redPlayer;
        if (opponentId && opponentId !== 'AI') {
          fetchOpponentStats(opponentId);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [selectedGame?.status, playerId, playerColor, selectedGame?.blackPlayer, selectedGame?.redPlayer, fetchMyStats, fetchOpponentStats]);

  // Calculate if current player has timed out (for UI blocking)
  const myTimeExpired = useMemo(() => {
    if (!selectedTimeControl) return false; // Only for timed games
    if (playerColor === 'spectator') return false;
    const myTime = playerColor === 'red' ? redTimeMs : blackTimeMs;
    return myTime <= 0;
  }, [selectedTimeControl, playerColor, redTimeMs, blackTimeMs]);

  // Safety reset for isMoving
  useEffect(() => {
    if (isMyTurn && isMoving) {
      console.log("[Page] Safety reset: clearing isMoving since it is user turn");
      useGameStore.setState({ isMoving: false });
    }
  }, [isMyTurn, isMoving]);

  // Auto-handle timeout: resign if my time expires, claim win if opponent's time expires
  useEffect(() => {
    // Only for active timed games
    if (!selectedGame || selectedGame.status !== GameStatus.Active) return;
    if (!selectedTimeControl) return; // Only for timed games
    if (playerColor === 'spectator') return;

    // Check if OPPONENT's time expired (not our own)
    const opponentExpired = playerColor === 'red' ? blackTimeMs <= 0 : redTimeMs <= 0;
    const myTimeExpiredLocal = playerColor === 'red' ? redTimeMs <= 0 : blackTimeMs <= 0;

    // If my time expired, auto-resign (I lose on time)
    if (myTimeExpiredLocal && !opponentExpired && !timeWinClaimInProgress.current) {
      timeWinClaimInProgress.current = true;
      console.log('[Page] My time expired, auto-resigning');
      showNotification('error', 'Time expired - you lost on time!');
      resignAction()
        .then(async (success) => {
          if (success) {
            // Refetch game and stats to ensure UI updates
            await fetchGame(selectedGame.id);
            await fetchMyStats();
          }
        })
        .finally(() => {
          setTimeout(() => {
            timeWinClaimInProgress.current = false;
          }, 2000);
        });
      return;
    }

    // If opponent's time expired, claim the win
    if (opponentExpired && !timeWinClaimInProgress.current) {
      timeWinClaimInProgress.current = true;
      console.log('[Page] Opponent time expired, claiming time win');
      claimTimeWin(selectedGame.id)
        .then(async (success) => {
          if (success) {
            showNotification('success', 'Opponent ran out of time - you win!');
            // Refetch game and stats to ensure UI updates
            await fetchGame(selectedGame.id);
            await fetchMyStats();
          }
        })
        .finally(() => {
          // Reset after a delay to prevent immediate re-trigger
          setTimeout(() => {
            timeWinClaimInProgress.current = false;
          }, 2000);
        });
    }
  }, [redTimeMs, blackTimeMs, selectedGame?.id, selectedGame?.status, selectedTimeControl, playerColor, resignAction, claimTimeWin, showNotification, fetchGame, fetchMyStats]);

  // Execute premove when it becomes my turn
  const prevIsMyTurnForPremove = useRef(false);
  const premoveRef = useRef(premove);
  premoveRef.current = premove;

  useEffect(() => {
    // Detect turn change from opponent to me
    const currentPremove = premoveRef.current;
    if (isMyTurn && !prevIsMyTurnForPremove.current && currentPremove && selectedGame?.status === GameStatus.Active) {
      console.log("[Page] Executing premove:", currentPremove);

      // Execute the premove after a short delay to ensure board state is updated
      setTimeout(() => {
        if (premoveRef.current) {
          const pm = premoveRef.current;
          setPremove(null);
          // Call the move action directly
          makeMoveAction(
            { fromRow: pm.fromRow, fromCol: pm.fromCol, toRow: pm.toRow, toCol: pm.toCol },
            { fromRow: pm.fromRow, fromCol: pm.fromCol, toRow: pm.toRow, toCol: pm.toCol }
          ).then((success) => {
            if (success) {
              setLastMove({ fromRow: pm.fromRow, fromCol: pm.fromCol, toRow: pm.toRow, toCol: pm.toCol });
              showNotification("success", "Premove executed!");
            } else {
              showNotification("error", "Premove was invalid");
            }
          });
        }
      }, 100);
    }
    prevIsMyTurnForPremove.current = isMyTurn;
  }, [isMyTurn, selectedGame?.status, makeMoveAction, showNotification]);

  // Handle premove callback
  const handlePremove = useCallback(
    (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      console.log("[Page] Premove queued:", { fromRow, fromCol, toRow, toCol });
      setPremove({ fromRow, fromCol, toRow, toCol });
      showNotification("info", "Premove queued");
    },
    [showNotification]
  );

  // Handle cancel premove callback
  const handleCancelPremove = useCallback(() => {
    if (premove) {
      console.log("[Page] Premove cancelled");
      setPremove(null);
      showNotification("info", "Premove cancelled");
    }
  }, [premove, showNotification]);

  // Handle time control selection
  const handleTimeControlSelect = useCallback((timeControl: TimeControl) => {
    setSelectedTimeControl(timeControl);
    setShowTimeControlModal(true);
  }, []);

  // Handle play vs AI
  const handlePlayVsAI = useCallback(async () => {
    if (!ready || !selectedTimeControl) {
      showNotification("error", "Please connect your wallet first");
      return;
    }

    setIsCreating(true);
    try {
      showNotification("info", "Creating AI game...");
      const gameId = await createGameAction(true, selectedTimeControl, undefined, true);
      if (gameId) {
        showNotification("success", "Game created successfully!");
        setShowTimeControlModal(false);
        await fetchGame(gameId);  // Ensure game is loaded before selecting
        selectGame(gameId);
        setView("game");
      } else {
        showNotification("error", gameError || "Failed to create game");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create game";
      showNotification("error", errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [ready, selectedTimeControl, createGameAction, selectGame, gameError, showNotification]);

  // Handle play vs player (join queue)
  const handlePlayVsPlayer = useCallback(async () => {
    if (!ready || !selectedTimeControl) {
      showNotification("error", "Please connect your wallet first");
      return;
    }

    setShowTimeControlModal(false);
    setQueueTimeControl(selectedTimeControl);
    setIsInQueue(true);
    setView("queue");

    try {
      showNotification("info", "Searching for opponent...");
      const gameId = await joinQueueAction(selectedTimeControl);

      if (gameId) {
        // Match found immediately!
        showNotification("success", "Match found!");
        selectGame(gameId);
        setIsInQueue(false);
        setView("game");
      } else {
        // Waiting in queue - start polling for match
        showNotification("info", "Waiting for opponent...");

        // Clear any existing polling interval
        if (queuePollIntervalRef.current) {
          clearInterval(queuePollIntervalRef.current);
        }

        const queueJoinTime = Date.now();
        queuePollIntervalRef.current = setInterval(async () => {
          try {
            await fetchGames();
            const { games: currentGames } = useGameStore.getState();

            const recentGames = currentGames.filter(g => {
              const gameCreatedTime = g.createdAt / 1000;
              return gameCreatedTime >= queueJoinTime - 5000;
            });

            const myGame = recentGames.find(g =>
              g.status === GameStatus.Active &&
              (g.redPlayer === playerId || g.blackPlayer === playerId)
            );

            if (myGame) {
              if (queuePollIntervalRef.current) {
                clearInterval(queuePollIntervalRef.current);
                queuePollIntervalRef.current = null;
              }

              showNotification("success", "Match found!");
              selectGame(myGame.id);
              setIsInQueue(false);
              setView("game");
            }
          } catch (error) {
            console.error("Error polling for match:", error);
          }
        }, 1000); // Poll every second
      }
    } catch (error) {
      console.error("Failed to join queue:", error);
      showNotification("error", "Failed to join queue");
      setIsInQueue(false);
      setView("home");
    }
  }, [ready, selectedTimeControl, joinQueueAction, selectGame, showNotification, playerId, fetchGames]);

  // Handle leaving queue
  const handleLeaveQueue = useCallback(async () => {
    // Clear polling interval
    if (queuePollIntervalRef.current) {
      clearInterval(queuePollIntervalRef.current);
      queuePollIntervalRef.current = null;
    }

    try {
      await leaveQueueAction();
      setIsInQueue(false);
      setQueueTimeControl(null);
      setView("home");
      showNotification("info", "Left matchmaking queue");
    } catch (error) {
      console.error("Failed to leave queue:", error);
      setIsInQueue(false);
      setView("home");
    }
  }, [leaveQueueAction, showNotification]);

  // Handle going back to home
  const handleBackToHome = useCallback(() => {
    selectGame(null);
    setView("home");
    setDrawOfferState(DrawOfferState.None);
    setCurrentGameTournamentId(null);
  }, [selectGame]);

  // Handle making a move
  const handleMove = useCallback(
    async (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      if (!ready || !selectedGameId) {
        showNotification("error", "Cannot make move");
        return;
      }

      try {
        const success = await makeMoveAction(
          { fromRow, fromCol, toRow, toCol },
          { fromRow, fromCol, toRow, toCol }
        );

        if (success) {
          showNotification("success", "Move made!");
          setLastMove({ fromRow, fromCol, toRow, toCol });

          // If playing against AI, trigger AI move after a delay
          if (isVsAI && !aiMoveInProgress.current) {
            aiMoveInProgress.current = true;
            setTimeout(async () => {
              try {
                showNotification("info", "AI is thinking...");
                const aiSuccess = await requestAiMoveAction();
                if (aiSuccess) {
                  playSound('move');
                  showNotification("success", "AI has moved!");
                }
              } catch (e) {
                console.error("AI move failed:", e);
              } finally {
                aiMoveInProgress.current = false;
              }
            }, 1000);
          }
        } else {
          showNotification("error", gameError || "Invalid move");
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Invalid move";
        showNotification("error", errorMessage);
      }
    },
    [ready, selectedGameId, makeMoveAction, gameError, showNotification, isVsAI, requestAiMoveAction, playSound]
  );

  // Handle resign
  const handleResign = useCallback(async () => {
    if (!ready || !selectedGameId) return;
    try {
      showNotification("info", "Resigning...");
      await resignAction();
      showNotification("success", "Resigned from game");
      incrementNotification();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Failed to resign";
      showNotification("error", errorMessage);
    }
  }, [ready, selectedGameId, resignAction, incrementNotification, showNotification]);

  // Handle draw offer
  const handleOfferDraw = useCallback(() => {
    setDrawOfferState(DrawOfferState.OfferedByMe);
    showNotification("info", "Draw offer sent");
  }, [showNotification]);

  const handleAcceptDraw = useCallback(() => {
    setDrawOfferState(DrawOfferState.None);
    showNotification("success", "Draw accepted");
    // In production, this would call a backend action
  }, [showNotification]);

  const handleDeclineDraw = useCallback(() => {
    setDrawOfferState(DrawOfferState.None);
    showNotification("info", "Draw declined");
  }, [showNotification]);

  // Handle leaving game
  const handleLeaveGame = useCallback(() => {
    handleBackToHome();
  }, [handleBackToHome]);

  // Auto-request AI move when it's AI's turn
  useEffect(() => {
    if (isAITurn && !aiMoveInProgress.current) {
      const timer = setTimeout(() => {
        if (!aiMoveInProgress.current) {
          aiMoveInProgress.current = true;
          showNotification("info", "AI is thinking...");
          requestAiMoveAction()
            .then((success) => {
              if (success) {
                playSound('move');
                showNotification("success", "AI has moved!");
              }
            })
            .catch((e) => {
              console.error("AI move failed:", e);
            })
            .finally(() => {
              aiMoveInProgress.current = false;
            });
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, requestAiMoveAction, showNotification, playSound]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (queuePollIntervalRef.current) {
        clearInterval(queuePollIntervalRef.current);
      }
    };
  }, []);

  // Filter games for display (using playerId for Hub Chain pattern)
  const myActiveGames = games.filter(
    (g) =>
      g.status === GameStatus.Active &&
      (g.redPlayer === playerId || g.blackPlayer === playerId)
  );

  // Mock queue counts (in production, this would come from the backend)
  const queueCounts: Record<string, number> = {
    [TimeControl.Bullet1m]: 3,
    [TimeControl.Bullet2m]: 5,
    [TimeControl.Blitz3m]: 12,
    [TimeControl.Blitz5m]: 8,
    [TimeControl.Rapid10m]: 4,
  };

  // Determine opponent and player timer positions based on player color
  const isRedPlayer = playerColor === "red";
  const opponentTimeMs = isRedPlayer ? blackTimeMs : redTimeMs;
  const myTimeMs = isRedPlayer ? redTimeMs : blackTimeMs;
  const opponentName = isRedPlayer
    ? selectedGame?.blackPlayer?.slice(0, 8) + "..." || "Opponent"
    : selectedGame?.redPlayer?.slice(0, 8) + "..." || "Opponent";
  const myName = isRedPlayer
    ? selectedGame?.redPlayer?.slice(0, 8) + "..." || "You"
    : selectedGame?.blackPlayer?.slice(0, 8) + "..." || "You";
  const isOpponentTurn = isRedPlayer
    ? selectedGame?.currentTurn === Turn.Black
    : selectedGame?.currentTurn === Turn.Red;

  // Calculate captured pieces from board state
  const capturedPieces = useMemo(() => {
    if (!selectedGame?.boardState) return { red: 0, black: 0 };
    const pieces = selectedGame.boardState.replace(/[^rbRB]/g, '');
    const redPieces = (pieces.match(/r/gi) || []).length;
    const blackPieces = (pieces.match(/b/gi) || []).length;
    return {
      red: 12 - redPieces,     // Pieces red has lost (black captured)
      black: 12 - blackPieces  // Pieces black has lost (red captured)
    };
  }, [selectedGame?.boardState]);

  // My captured count (pieces I captured from opponent)
  const myCapturedCount = isRedPlayer ? capturedPieces.black : capturedPieces.red;
  const opponentCapturedCount = isRedPlayer ? capturedPieces.red : capturedPieces.black;

  // Fullscreen toggle
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Notification */}
      {notificationMessage && (
        <div
          className={`
            fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in
            ${notificationMessage.type === "success" ? "bg-green-500 text-white" : ""}
            ${notificationMessage.type === "error" ? "bg-red-500 text-white" : ""}
            ${notificationMessage.type === "info" ? "bg-blue-500 text-white" : ""}
          `}
        >
          {notificationMessage.message}
        </div>
      )}

      {/* Main Content */}
      {!isConnected ? (
        // Splash screen for disconnected state
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-linera-light">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-linera-navy mb-2 font-[var(--font-epilogue)]">
              Linera Checkers
            </h1>
            <div className="w-16 h-1 bg-gradient-to-r from-linera-red to-linera-accent mx-auto mb-6"></div>
            <p className="text-xl text-gray-600 mb-8">
              Real-time multiplayer checkers on Linera blockchain
            </p>
            <div className="flex justify-center mb-12">
              <WalletConnect />
            </div>

            {/* Demo Board */}
            <div className="opacity-50 max-w-md mx-auto">
              <CheckersBoard
                boardState={DEFAULT_BOARD_STATE}
                currentTurn={Turn.Red}
                playerColor="spectator"
                isMyTurn={false}
                disabled={true}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Home View */}
          {view === "home" && (
            <HomeView
              playerId={playerId}
              ready={ready}
              games={games}
              myActiveGames={myActiveGames}
              myStats={myStats}
              onTimeControlSelect={handleTimeControlSelect}
              onSelectGame={(id) => {
                selectGame(id);
                setView("game");
              }}
              setShowInviteModal={setShowInviteModal}
              onTournaments={() => setView("tournaments")}
            />
          )}

          {/* Queue View */}
          {view === "queue" && queueTimeControl && (
            <QueueWaiting
              isOpen={true}
              timeControl={queueTimeControl}
              onCancel={handleLeaveQueue}
            />
          )}

          {/* Tournament List View */}
          {view === "tournaments" && (
            <TournamentList
              playerId={playerId}
              onSelectTournament={(id) => {
                setSelectedTournamentId(id);
                setView("tournament");
              }}
              onCreateTournament={() => setShowCreateTournamentModal(true)}
              onBack={() => setView("home")}
            />
          )}

          {/* Tournament Lobby View */}
          {view === "tournament" && selectedTournamentId && (
            <TournamentLobby
              tournamentId={selectedTournamentId}
              playerId={playerId}
              onBack={() => {
                setSelectedTournamentId(null);
                setView("tournaments");
              }}
              onGameStart={(gameId) => {
                selectGame(gameId);
                setCurrentGameTournamentId(selectedTournamentId);
                setView("game");
              }}
            />
          )}

          {/* Create Tournament Modal */}
          {showCreateTournamentModal && (
            <CreateTournamentModal
              onClose={() => setShowCreateTournamentModal(false)}
              onCreated={(tournamentId) => {
                setShowCreateTournamentModal(false);
                setSelectedTournamentId(tournamentId);
                setView("tournament");
              }}
            />
          )}

          {/* Game View */}
          {view === "game" && selectedGame && (
            <div className="min-h-screen flex flex-col bg-linera-navy">
              {/* Slim Header */}
              <header className="bg-linera-navy border-b border-linera-gray/20 px-4 py-2">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                  {/* Back button */}
                  <button
                    onClick={() => {
                      if (currentGameTournamentId) {
                        selectGame(null);
                        setCurrentGameTournamentId(null);
                        setView("tournament");
                      } else {
                        handleBackToHome();
                      }
                    }}
                    className="flex items-center gap-2 text-white hover:text-linera-accent transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="text-sm font-medium">
                      {currentGameTournamentId ? "Back to Tournament" : "Back"}
                    </span>
                  </button>

                  {/* Game info - centered */}
                  <div className="flex items-center gap-2">
                    {currentGameTournamentId && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded border border-yellow-500/30 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z"/>
                        </svg>
                        Tournament
                      </span>
                    )}
                    <span className="text-sm text-white font-[var(--font-epilogue)]">
                      Game #{selectedGame.id.replace("game_", "")}
                    </span>
                    {isVsAI ? (
                      <span className="text-sm text-white">vs AI</span>
                    ) : (
                      <span className="text-sm text-linera-gray">vs Player</span>
                    )}
                  </div>

                  {/* Right side placeholder for balance */}
                  <div className="w-16" />
                </div>
              </header>

              {/* Game finished banner */}
              {selectedGame.status === GameStatus.Finished && (() => {
                const didIWin =
                  (playerColor === 'red' && selectedGame.result === 'RED_WINS') ||
                  (playerColor === 'black' && selectedGame.result === 'BLACK_WINS');
                const didILose =
                  (playerColor === 'red' && selectedGame.result === 'BLACK_WINS') ||
                  (playerColor === 'black' && selectedGame.result === 'RED_WINS');
                const isDraw = selectedGame.result === 'DRAW';

                return (
                  <div className={`py-4 text-center font-bold text-lg ${
                    didIWin ? 'bg-green-500 text-white' :
                    didILose ? 'bg-red-500 text-white' :
                    'bg-yellow-500 text-gray-900'
                  }`}>
                    <div className="text-2xl mb-1">
                      {didIWin && "Victory! You Won!"}
                      {didILose && "Defeat! You Lost!"}
                      {isDraw && "Game Drawn!"}
                      {playerColor === 'spectator' && (
                        <>
                          {selectedGame.result === "RED_WINS" && "Red Wins!"}
                          {selectedGame.result === "BLACK_WINS" && "Black Wins!"}
                        </>
                      )}
                    </div>
                    <div className="text-sm opacity-90 mb-2">
                      {selectedGame.result === "RED_WINS" && "Red player wins the game"}
                      {selectedGame.result === "BLACK_WINS" && "Black player wins the game"}
                      {isDraw && "The game ended in a draw"}
                    </div>
                    <div className="flex gap-3 justify-center">
                      {currentGameTournamentId && (
                        <button
                          onClick={() => {
                            selectGame(null);
                            setCurrentGameTournamentId(null);
                            setView("tournament");
                          }}
                          className="px-6 py-2 rounded font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Return to Tournament
                        </button>
                      )}
                      <button
                        onClick={handleBackToHome}
                        className={`px-4 py-2 rounded font-semibold transition-colors ${
                          didIWin ? 'bg-green-700 hover:bg-green-800 text-white' :
                          didILose ? 'bg-red-700 hover:bg-red-800 text-white' :
                          'bg-gray-900 hover:bg-gray-800 text-white'
                        }`}
                      >
                        Back to Home
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Main game area - 3 column layout */}
              <div className="flex-1 flex items-stretch justify-center p-4 gap-4 lg:gap-6">
                {/* Left Sidebar - Opponent Timer */}
                <div className="hidden lg:flex flex-col items-center justify-center w-32">
                  <div className={`
                    bg-linera-navy-light rounded-lg p-4 w-full
                    ${isOpponentTurn && selectedGame.status === GameStatus.Active ? "ring-2 ring-linera-accent" : ""}
                  `}>
                    <div className="text-xs text-linera-gray text-center mb-1">
                      <div className="flex items-center justify-center gap-1.5">
                        <span>{isVsAI ? "AI" : opponentName}</span>
                        {opponentStats && selectedTimeControl && (
                          <RatingBadge
                            rating={getPlayerRating(opponentStats, selectedTimeControl)}
                            gamesPlayed={getPlayerGamesInCategory(opponentStats, selectedTimeControl)}
                            size="sm"
                          />
                        )}
                      </div>
                    </div>
                    <div className={`
                      text-2xl font-bold font-[var(--font-hanken)] text-center tracking-wider
                      ${opponentTimeMs <= 10000 ? "text-red-500" : opponentTimeMs <= 30000 ? "text-orange-500" : "text-white"}
                    `}>
                      {Math.floor(opponentTimeMs / 60000).toString().padStart(2, "0")}:
                      {Math.floor((opponentTimeMs % 60000) / 1000).toString().padStart(2, "0")}
                    </div>
                    {/* Captured pieces */}
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      <div className={`w-4 h-4 rounded-full ${isRedPlayer ? "bg-gray-700" : "bg-red-600"}`} />
                      <span className="text-sm text-linera-gray">{opponentCapturedCount}</span>
                    </div>
                  </div>
                </div>

                {/* Center - Board */}
                <div className="flex flex-col items-center justify-center">
                  {/* Mobile: Opponent Timer */}
                  <div className="lg:hidden w-full mb-3">
                    <div className={`
                      bg-linera-navy-light rounded-lg p-3 flex items-center justify-between
                      ${isOpponentTurn && selectedGame.status === GameStatus.Active ? "ring-2 ring-linera-accent" : ""}
                    `}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-sm text-white">{isVsAI ? "AI" : opponentName}</span>
                          {opponentStats && selectedTimeControl && (
                            <RatingBadge
                              rating={getPlayerRating(opponentStats, selectedTimeControl)}
                              gamesPlayed={getPlayerGamesInCategory(opponentStats, selectedTimeControl)}
                              size="sm"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className={`w-3 h-3 rounded-full ${isRedPlayer ? "bg-gray-700" : "bg-red-600"}`} />
                          <span className="text-xs text-linera-gray">{opponentCapturedCount}</span>
                        </div>
                        <span className={`
                          text-xl font-bold font-[var(--font-hanken)]
                          ${opponentTimeMs <= 10000 ? "text-red-500" : opponentTimeMs <= 30000 ? "text-orange-500" : "text-white"}
                        `}>
                          {Math.floor(opponentTimeMs / 60000).toString().padStart(2, "0")}:
                          {Math.floor((opponentTimeMs % 60000) / 1000).toString().padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeout warning */}
                  {myTimeExpired && selectedGame.status === GameStatus.Active && (
                    <div className="bg-red-600 text-white px-4 py-2 rounded-lg text-center text-sm mb-3">
                      Time&apos;s up! Waiting for game to end...
                    </div>
                  )}

                  {/* Board - larger size */}
                  <div className="bg-linera-navy-light p-1 rounded-lg shadow-2xl shadow-black/50">
                    <CheckersBoard
                      key={`${selectedGame.id}-${selectedGame.moveCount}-${selectedGame.boardState}`}
                      boardState={selectedGame.boardState}
                      currentTurn={selectedGame.currentTurn as Turn}
                      playerColor={playerColor}
                      isMyTurn={isMyTurn}
                      onMove={handleMove}
                      disabled={selectedGame.status !== GameStatus.Active || isMoving || myTimeExpired}
                      lastMove={lastMove}
                      premove={premove}
                      onPremove={handlePremove}
                      onCancelPremove={handleCancelPremove}
                    />
                  </div>

                  {/* Mobile: My Timer */}
                  <div className="lg:hidden w-full mt-3">
                    <div className={`
                      bg-linera-navy-light rounded-lg p-3 flex items-center justify-between
                      ${isMyTurn && selectedGame.status === GameStatus.Active ? "ring-2 ring-linera-accent" : ""}
                    `}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-sm text-white">{myName}</span>
                          <span className="text-xs text-linera-accent bg-linera-accent/20 px-1.5 py-0.5 rounded">You</span>
                          {myStats && selectedTimeControl && (
                            <RatingBadge
                              rating={getPlayerRating(myStats, selectedTimeControl)}
                              gamesPlayed={getPlayerGamesInCategory(myStats, selectedTimeControl)}
                              size="sm"
                              showChange={!!lastRatingChange}
                              ratingChange={lastRatingChange ?? undefined}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className={`w-3 h-3 rounded-full ${isRedPlayer ? "bg-red-600" : "bg-gray-700"}`} />
                          <span className="text-xs text-linera-gray">{myCapturedCount}</span>
                        </div>
                        <span className={`
                          text-xl font-bold font-[var(--font-hanken)]
                          ${myTimeMs <= 10000 ? "text-red-500" : myTimeMs <= 30000 ? "text-orange-500" : "text-white"}
                        `}>
                          {Math.floor(myTimeMs / 60000).toString().padStart(2, "0")}:
                          {Math.floor((myTimeMs % 60000) / 1000).toString().padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Turn indicator - bottom */}
                  <div className="mt-4 text-center">
                    <span className={`
                      text-sm font-medium px-4 py-2 rounded-lg
                      ${selectedGame.currentTurn === Turn.Red ? "bg-red-600/20 text-red-400" : "bg-gray-600/20 text-gray-300"}
                    `}>
                      {selectedGame.currentTurn === Turn.Red ? "Red's" : "Black's"} Turn
                      {isMyTurn && selectedGame.status === GameStatus.Active && (
                        <span className="text-linera-accent ml-1">(Your Turn!)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Right Sidebar - Your Timer + Controls */}
                <div className="hidden lg:flex flex-col items-center justify-center w-32 gap-4">
                  {/* Your Timer */}
                  <div className={`
                    bg-linera-navy-light rounded-lg p-4 w-full
                    ${isMyTurn && selectedGame.status === GameStatus.Active ? "ring-2 ring-linera-accent" : ""}
                  `}>
                    <div className="text-xs text-linera-gray text-center mb-1">
                      <div className="flex items-center justify-center gap-1.5">
                        <span>YOU</span>
                        {myStats && selectedTimeControl && (
                          <RatingBadge
                            rating={getPlayerRating(myStats, selectedTimeControl)}
                            gamesPlayed={getPlayerGamesInCategory(myStats, selectedTimeControl)}
                            size="sm"
                            showChange={!!lastRatingChange}
                            ratingChange={lastRatingChange ?? undefined}
                          />
                        )}
                      </div>
                    </div>
                    <div className={`
                      text-2xl font-bold font-[var(--font-hanken)] text-center tracking-wider
                      ${myTimeMs <= 10000 ? "text-red-500" : myTimeMs <= 30000 ? "text-orange-500" : "text-white"}
                    `}>
                      {Math.floor(myTimeMs / 60000).toString().padStart(2, "0")}:
                      {Math.floor((myTimeMs % 60000) / 1000).toString().padStart(2, "0")}
                    </div>
                    {/* Captured pieces */}
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      <div className={`w-4 h-4 rounded-full ${isRedPlayer ? "bg-red-600" : "bg-gray-700"}`} />
                      <span className="text-sm text-linera-gray">{myCapturedCount}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="bg-linera-navy-light rounded-lg p-3 w-full">
                    <div className="flex flex-col gap-2">
                      {/* Draw offer received */}
                      {drawOfferState === DrawOfferState.OfferedByOpponent && (
                        <div className="text-xs text-amber-400 text-center mb-2">Draw offered!</div>
                      )}

                      {/* Accept/Decline draw buttons */}
                      {drawOfferState === DrawOfferState.OfferedByOpponent ? (
                        <div className="flex gap-2">
                          <button
                            onClick={handleAcceptDraw}
                            disabled={isLoading || isMoving}
                            className="flex-1 p-2 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                            title="Accept Draw"
                          >
                            <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={handleDeclineDraw}
                            disabled={isLoading || isMoving}
                            className="flex-1 p-2 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
                            title="Decline Draw"
                          >
                            <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Resign */}
                          <button
                            onClick={handleResign}
                            disabled={selectedGame.status !== GameStatus.Active || isLoading || isMoving}
                            className="w-full p-2 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs"
                            title="Resign"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                            </svg>
                            Resign
                          </button>

                          {/* Offer Draw */}
                          <button
                            onClick={handleOfferDraw}
                            disabled={selectedGame.status !== GameStatus.Active || isLoading || isMoving || drawOfferState === DrawOfferState.OfferedByMe}
                            className={`
                              w-full p-2 rounded transition-colors flex items-center justify-center gap-2 text-xs
                              ${drawOfferState === DrawOfferState.OfferedByMe
                                ? "bg-linera-accent/20 text-linera-accent cursor-not-allowed"
                                : "bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              }
                            `}
                            title={drawOfferState === DrawOfferState.OfferedByMe ? "Draw offer pending..." : "Offer Draw"}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            {drawOfferState === DrawOfferState.OfferedByMe ? "Pending..." : "Draw"}
                          </button>
                        </>
                      )}

                      <div className="border-t border-linera-gray/20 my-1" />

                      {/* Sound toggle */}
                      <button
                        onClick={toggleSound}
                        className="w-full p-2 rounded bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center gap-2 text-xs"
                        title={isSoundEnabled ? "Mute" : "Unmute"}
                      >
                        {isSoundEnabled ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                          </svg>
                        )}
                        Sound
                      </button>

                      {/* Leave game */}
                      <button
                        onClick={handleLeaveGame}
                        disabled={isLoading || isMoving}
                        className="w-full p-2 rounded bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                        title="Leave Game"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Leave
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile: Floating controls */}
              <div className="lg:hidden">
                <FloatingToolbar
                  drawOfferState={drawOfferState}
                  isGameActive={selectedGame.status === GameStatus.Active}
                  onResign={handleResign}
                  onOfferDraw={handleOfferDraw}
                  onAcceptDraw={handleAcceptDraw}
                  onDeclineDraw={handleDeclineDraw}
                  onLeaveGame={handleLeaveGame}
                  onToggleSound={toggleSound}
                  onToggleFullscreen={handleToggleFullscreen}
                  isSoundEnabled={isSoundEnabled}
                  isLoading={isLoading || isMoving}
                />
              </div>

              {/* Move History Panel - Desktop only (xl+) */}
              <MoveHistory moves={selectedGame.moves || []} />
            </div>
          )}

          {/* Fallback for game view without selected game */}
          {view === "game" && !selectedGame && (
            <div className="min-h-screen flex items-center justify-center bg-linera-navy">
              <div className="text-center">
                <p className="text-gray-400 mb-4">No game selected</p>
                <button
                  onClick={handleBackToHome}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Home
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Time Control Modal */}
      {selectedTimeControl && (
        <TimeControlModal
          isOpen={showTimeControlModal}
          selectedTimeControl={selectedTimeControl}
          isLoading={isCreating}
          onClose={() => setShowTimeControlModal(false)}
          onPlayAI={handlePlayVsAI}
          onPlayPlayer={handlePlayVsPlayer}
        />
      )}

      {/* Invite Friend Modal */}
      <InviteFriendModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onGameCreated={(gameId) => {
          // Optionally select the game and stay on waiting screen
          selectGame(gameId);
        }}
      />

      {/* Invite link joining overlay */}
      {joinGameId && isJoiningInvite && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-800 font-medium">Joining game...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we connect you to the game</p>
          </div>
        </div>
      )}

      {/* Invite link error overlay */}
      {inviteError && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 font-medium mb-2">{inviteError}</p>
            <button
              onClick={() => {
                setInviteError(null);
                router.replace("/");
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-linera-light">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
