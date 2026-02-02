"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Piece, Turn, parseBoardState, isPieceSelectable } from "@/types/game";
import { useGameSounds } from "@/hooks/useGameSounds";

interface CheckersBoardProps {
  boardState: string;
  currentTurn: Turn;
  playerColor: "red" | "black" | "spectator";
  isMyTurn: boolean;
  onMove?: (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    isCapture: boolean
  ) => void;
  disabled?: boolean;
  lastMove?: {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  } | null;
  // Premove props
  premove?: {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  } | null;
  onPremove?: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  onCancelPremove?: () => void;
}

export default function CheckersBoard({
  boardState,
  currentTurn,
  playerColor,
  isMyTurn,
  onMove,
  disabled = false,
  lastMove = null,
  premove = null,
  onPremove,
  onCancelPremove,
}: CheckersBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [validMoves, setValidMoves] = useState<{ row: number; col: number }[]>(
    []
  );
  const [animatingSquare, setAnimatingSquare] = useState<{
    row: number;
    col: number;
    type: 'move' | 'capture' | 'king';
  } | null>(null);
  const [draggedPiece, setDraggedPiece] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [dragValidMoves, setDragValidMoves] = useState<{ row: number; col: number }[]>([]);

  // Premove local state (for selecting premove before queuing)
  const [premoveFrom, setPremoveFrom] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [premoveValidMoves, setPremoveValidMoves] = useState<{ row: number; col: number }[]>([]);

  // Sound effects
  const { playSound } = useGameSounds();

  useEffect(() => {
    setSelectedSquare(null);
    setValidMoves([]);
    setDraggedPiece(null);
    setDragValidMoves([]);
    setPremoveFrom(null);
    setPremoveValidMoves([]);
  }, [boardState, disabled]);
  const board = useMemo(() => {
    return parseBoardState(boardState);
  }, [boardState]);

  // Check if ANY of the current player's pieces has a capture available
  // This is used to enforce the mandatory capture rule
  const hasAnyCaptureAvailable = useCallback((): boolean => {
    const isPlayerRed = playerColor === 'red';

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece === Piece.Empty) continue;

        const isPieceRed = piece === Piece.Red || piece === Piece.RedKing;
        // Skip opponent's pieces
        if (isPlayerRed !== isPieceRed) continue;

        const isKing = piece === Piece.RedKing || piece === Piece.BlackKing;
        const dirs: [number, number][] = isKing
          ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
          : isPieceRed
            ? [[1, -1], [1, 1]]
            : [[-1, -1], [-1, 1]];

        for (const [dr, dc] of dirs) {
          const jumpRow = row + 2 * dr;
          const jumpCol = col + 2 * dc;
          const midRow = row + dr;
          const midCol = col + dc;

          if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
            if (board[jumpRow][jumpCol] === Piece.Empty) {
              const midPiece = board[midRow][midCol];
              const isEnemy = isPieceRed
                ? midPiece === Piece.Black || midPiece === Piece.BlackKing
                : midPiece === Piece.Red || midPiece === Piece.RedKing;
              if (isEnemy) {
                return true; // Found a capture!
              }
            }
          }
        }
      }
    }
    return false;
  }, [board, playerColor]);

  // Get all pieces that have captures available (for forced capture highlighting)
  // Only returns pieces for the current player whose turn it is
  const getPiecesWithCaptures = useMemo((): Set<string> => {
    const piecesWithCaptures = new Set<string>();

    // Only highlight when it's my turn
    if (!isMyTurn || disabled) return piecesWithCaptures;

    const isPlayerRed = playerColor === 'red';

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece === Piece.Empty) continue;

        const isPieceRed = piece === Piece.Red || piece === Piece.RedKing;
        // Skip opponent's pieces
        if (isPlayerRed !== isPieceRed) continue;

        const isKing = piece === Piece.RedKing || piece === Piece.BlackKing;
        const dirs: [number, number][] = isKing
          ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
          : isPieceRed
            ? [[1, -1], [1, 1]]
            : [[-1, -1], [-1, 1]];

        for (const [dr, dc] of dirs) {
          const jumpRow = row + 2 * dr;
          const jumpCol = col + 2 * dc;
          const midRow = row + dr;
          const midCol = col + dc;

          if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
            if (board[jumpRow][jumpCol] === Piece.Empty) {
              const midPiece = board[midRow][midCol];
              const isEnemy = isPieceRed
                ? midPiece === Piece.Black || midPiece === Piece.BlackKing
                : midPiece === Piece.Red || midPiece === Piece.RedKing;
              if (isEnemy) {
                piecesWithCaptures.add(`${row}-${col}`);
                break; // Found at least one capture for this piece
              }
            }
          }
        }
      }
    }
    return piecesWithCaptures;
  }, [board, playerColor, isMyTurn, disabled]);

  // Calculate valid moves for a selected piece
  // Enforces MANDATORY CAPTURE RULE: if any capture is available, only captures are valid
  const calculateValidMoves = useCallback(
    (row: number, col: number, piece: Piece) => {
      const simpleMoves: { row: number; col: number }[] = [];
      const captureMoves: { row: number; col: number }[] = [];
      const isKing = piece === Piece.RedKing || piece === Piece.BlackKing;
      const isRed = piece === Piece.Red || piece === Piece.RedKing;

      // Determine move directions
      const directions: [number, number][] = isKing
        ? [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ]
        : isRed
        ? [
            [1, -1],
            [1, 1],
          ] // Red moves down
        : [
            [-1, -1],
            [-1, 1],
          ]; // Black moves up

      // Check simple moves and captures
      for (const [dr, dc] of directions) {
        // Simple move
        const newRow = row + dr;
        const newCol = col + dc;
        if (
          newRow >= 0 &&
          newRow < 8 &&
          newCol >= 0 &&
          newCol < 8 &&
          board[newRow][newCol] === Piece.Empty
        ) {
          simpleMoves.push({ row: newRow, col: newCol });
        }

        // Capture move
        const jumpRow = row + 2 * dr;
        const jumpCol = col + 2 * dc;
        const midRow = row + dr;
        const midCol = col + dc;
        if (
          jumpRow >= 0 &&
          jumpRow < 8 &&
          jumpCol >= 0 &&
          jumpCol < 8 &&
          board[jumpRow][jumpCol] === Piece.Empty
        ) {
          const midPiece = board[midRow][midCol];
          const isEnemy = isRed
            ? midPiece === Piece.Black || midPiece === Piece.BlackKing
            : midPiece === Piece.Red || midPiece === Piece.RedKing;
          if (isEnemy) {
            captureMoves.push({ row: jumpRow, col: jumpCol });
          }
        }
      }

      // MANDATORY CAPTURE RULE:
      // If this piece has captures, only return captures
      if (captureMoves.length > 0) {
        return captureMoves;
      }

      // If this piece has no captures but other pieces do, return empty (can't move this piece)
      if (hasAnyCaptureAvailable()) {
        return [];
      }

      // No captures anywhere, return all simple moves
      return simpleMoves;
    },
    [board, hasAnyCaptureAvailable]
  );

  // Helper to check if piece belongs to player (for premove)
  const isPieceOwnedByPlayer = useCallback((piece: Piece): boolean => {
    if (piece === Piece.Empty) return false;
    const isPieceRed = piece === Piece.Red || piece === Piece.RedKing;
    return (playerColor === 'red' && isPieceRed) || (playerColor === 'black' && !isPieceRed);
  }, [playerColor]);

  // Calculate valid moves for premove (ignores mandatory capture from opponent's perspective)
  const calculatePremoveValidMoves = useCallback(
    (row: number, col: number, piece: Piece) => {
      const moves: { row: number; col: number }[] = [];
      const isKing = piece === Piece.RedKing || piece === Piece.BlackKing;
      const isRed = piece === Piece.Red || piece === Piece.RedKing;

      const directions: [number, number][] = isKing
        ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : isRed
        ? [[1, -1], [1, 1]]
        : [[-1, -1], [-1, 1]];

      for (const [dr, dc] of directions) {
        // Simple move
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8 && board[newRow][newCol] === Piece.Empty) {
          moves.push({ row: newRow, col: newCol });
        }

        // Capture move
        const jumpRow = row + 2 * dr;
        const jumpCol = col + 2 * dc;
        const midRow = row + dr;
        const midCol = col + dc;
        if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8 && board[jumpRow][jumpCol] === Piece.Empty) {
          const midPiece = board[midRow][midCol];
          const isEnemy = isRed
            ? midPiece === Piece.Black || midPiece === Piece.BlackKing
            : midPiece === Piece.Red || midPiece === Piece.RedKing;
          if (isEnemy) {
            moves.push({ row: jumpRow, col: jumpCol });
          }
        }
      }
      return moves;
    },
    [board]
  );

  // Handle premove click (when it's not player's turn)
  const handlePremoveClick = useCallback(
    (row: number, col: number) => {
      const piece = board[row][col];

      // If clicking on own piece, select it for premove
      if (isPieceOwnedByPlayer(piece)) {
        setPremoveFrom({ row, col });
        setPremoveValidMoves(calculatePremoveValidMoves(row, col, piece));
        playSound('select');
        // Cancel existing premove when selecting new piece
        if (premove && onCancelPremove) {
          onCancelPremove();
        }
        return;
      }

      // If premove piece is selected and clicking valid square, queue premove
      if (premoveFrom) {
        const isValid = premoveValidMoves.some(m => m.row === row && m.col === col);
        if (isValid && onPremove) {
          onPremove(premoveFrom.row, premoveFrom.col, row, col);
          playSound('move');
        }
        setPremoveFrom(null);
        setPremoveValidMoves([]);
        return;
      }

      // If clicking elsewhere with existing premove, cancel it
      if (premove && onCancelPremove) {
        onCancelPremove();
      }
    },
    [board, isPieceOwnedByPlayer, premoveFrom, premoveValidMoves, premove, calculatePremoveValidMoves, onPremove, onCancelPremove, playSound]
  );

  // Handle square click
  const handleSquareClick = useCallback(
    (row: number, col: number) => {
      if (disabled) {
        return;
      }

      // If it's not my turn, handle as premove
      if (!isMyTurn && playerColor !== 'spectator') {
        handlePremoveClick(row, col);
        return;
      }

      const piece = board[row][col];

      // If clicking on own piece, select it
      if (isPieceSelectable(piece, currentTurn, playerColor)) {
        setSelectedSquare({ row, col });
        setValidMoves(calculateValidMoves(row, col, piece));
        playSound('select');
        return;
      }

      // If a piece is selected and clicking on a valid move, make the move
      if (selectedSquare) {
        const isValidMove = validMoves.some(
          (m) => m.row === row && m.col === col
        );
        if (isValidMove && onMove) {
          // Check if this is a capture move (jump of 2 squares)
          const isCapture = Math.abs(row - selectedSquare.row) === 2;

          // Check if this move results in king promotion
          const movingPiece = board[selectedSquare.row][selectedSquare.col];
          const isRedPiece = movingPiece === Piece.Red;
          const isBlackPiece = movingPiece === Piece.Black;
          const isPromotion = (isRedPiece && row === 7) || (isBlackPiece && row === 0);

          // Play appropriate sound with priority: king > capture > move
          if (isPromotion) {
            // Delay king sound slightly to play after move/capture
            setTimeout(() => playSound('king'), 150);
            setAnimatingSquare({ row, col, type: 'king' });
          } else if (isCapture) {
            playSound('capture');
            setAnimatingSquare({ row, col, type: 'capture' });
          } else {
            playSound('move');
            setAnimatingSquare({ row, col, type: 'move' });
          }

          // Play move/capture sound first if promoting
          if (isPromotion && isCapture) {
            playSound('capture');
          } else if (isPromotion) {
            playSound('move');
          }

          // Clear animation after delay
          setTimeout(() => setAnimatingSquare(null), isPromotion ? 600 : 400);

          onMove(selectedSquare.row, selectedSquare.col, row, col, isCapture);
          setSelectedSquare(null);
          setValidMoves([]);
        } else {
          // Deselect if clicking elsewhere
          playSound('invalid');
          setSelectedSquare(null);
          setValidMoves([]);
        }
      }
    },
    [
      board,
      currentTurn,
      playerColor,
      isMyTurn,
      disabled,
      selectedSquare,
      validMoves,
      calculateValidMoves,
      onMove,
      playSound,
      handlePremoveClick,
    ]
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (row: number, col: number, e: React.DragEvent) => {
      if (disabled) return;

      const piece = board[row][col];

      // If it's my turn, use normal drag
      if (isMyTurn) {
        if (!isPieceSelectable(piece, currentTurn, playerColor)) {
          e.preventDefault();
          return;
        }
        setDraggedPiece({ row, col });
        setDragValidMoves(calculateValidMoves(row, col, piece));
        setSelectedSquare(null);
        setValidMoves([]);
        playSound('select');
      } else if (playerColor !== 'spectator') {
        // Not my turn - handle as premove drag
        if (!isPieceOwnedByPlayer(piece)) {
          e.preventDefault();
          return;
        }
        setDraggedPiece({ row, col });
        setDragValidMoves(calculatePremoveValidMoves(row, col, piece));
        setPremoveFrom(null);
        setPremoveValidMoves([]);
        if (premove && onCancelPremove) {
          onCancelPremove();
        }
        playSound('select');
      } else {
        e.preventDefault();
        return;
      }

      // Set drag image
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${row},${col}`);
      }
    },
    [board, currentTurn, playerColor, isMyTurn, disabled, calculateValidMoves, calculatePremoveValidMoves, isPieceOwnedByPlayer, premove, onCancelPremove, playSound]
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (row: number, col: number, e: React.DragEvent) => {
      e.preventDefault();
      if (!draggedPiece) return;

      const isValid = dragValidMoves.some((m) => m.row === row && m.col === col);
      e.dataTransfer.dropEffect = isValid ? 'move' : 'none';
    },
    [draggedPiece, dragValidMoves]
  );

  // Handle drop
  const handleDrop = useCallback(
    (row: number, col: number, e: React.DragEvent) => {
      e.preventDefault();
      if (!draggedPiece) return;

      const isValid = dragValidMoves.some((m) => m.row === row && m.col === col);

      // Handle premove drop (not my turn)
      if (!isMyTurn && playerColor !== 'spectator') {
        if (isValid && onPremove) {
          onPremove(draggedPiece.row, draggedPiece.col, row, col);
          playSound('move');
        }
        setDraggedPiece(null);
        setDragValidMoves([]);
        return;
      }

      // Handle normal drop (my turn)
      if (!onMove) return;

      if (isValid) {
        const isCapture = Math.abs(row - draggedPiece.row) === 2;
        const movingPiece = board[draggedPiece.row][draggedPiece.col];
        const isRedPiece = movingPiece === Piece.Red;
        const isBlackPiece = movingPiece === Piece.Black;
        const isPromotion = (isRedPiece && row === 7) || (isBlackPiece && row === 0);

        if (isPromotion) {
          setTimeout(() => playSound('king'), 150);
          setAnimatingSquare({ row, col, type: 'king' });
        } else if (isCapture) {
          playSound('capture');
          setAnimatingSquare({ row, col, type: 'capture' });
        } else {
          playSound('move');
          setAnimatingSquare({ row, col, type: 'move' });
        }

        if (isPromotion && isCapture) {
          playSound('capture');
        } else if (isPromotion) {
          playSound('move');
        }

        setTimeout(() => setAnimatingSquare(null), isPromotion ? 600 : 400);
        onMove(draggedPiece.row, draggedPiece.col, row, col, isCapture);
      } else {
        playSound('invalid');
      }

      setDraggedPiece(null);
      setDragValidMoves([]);
    },
    [draggedPiece, dragValidMoves, board, onMove, onPremove, playSound, isMyTurn, playerColor]
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedPiece(null);
    setDragValidMoves([]);
  }, []);

  // Render a single square
  const renderSquare = (row: number, col: number) => {
    const piece = board[row][col];
    const isDark = (row + col) % 2 === 1;
    const isSelected =
      selectedSquare?.row === row && selectedSquare?.col === col;
    const isValidMove = validMoves.some((m) => m.row === row && m.col === col);
    const isDragValid = dragValidMoves.some((m) => m.row === row && m.col === col);
    const isSelectable = isPieceSelectable(piece, currentTurn, playerColor);
    const isAnimating = animatingSquare?.row === row && animatingSquare?.col === col;
    const animationType = isAnimating ? animatingSquare.type : null;
    const isDragging = draggedPiece?.row === row && draggedPiece?.col === col;

    // Last move highlighting (lichess/chess.com style)
    const isLastMoveFrom = lastMove?.fromRow === row && lastMove?.fromCol === col;
    const isLastMoveTo = lastMove?.toRow === row && lastMove?.toCol === col;

    // Forced capture highlighting - only highlight pieces that MUST capture
    const isForcedCapturePiece = getPiecesWithCaptures.has(`${row}-${col}`);

    // Premove visual states
    const isPremoveFrom = premove?.fromRow === row && premove?.fromCol === col;
    const isPremoveTo = premove?.toRow === row && premove?.toCol === col;
    const isPremoveSelected = premoveFrom?.row === row && premoveFrom?.col === col;
    const isPremoveValidMove = premoveValidMoves.some((m) => m.row === row && m.col === col);
    const hasPremoveHighlight = isPremoveFrom || isPremoveTo;

    // Allow dragging own pieces when it's not my turn (for premove)
    const canDragNormal = isSelectable && isMyTurn && !disabled;
    const canDragPremove = !isMyTurn && !disabled && playerColor !== 'spectator' && isPieceOwnedByPlayer(piece);
    const canDrag = canDragNormal || canDragPremove;

    // Allow hover/click when not my turn for premove
    const isInteractive = (isSelectable && isMyTurn) || (!isMyTurn && playerColor !== 'spectator' && isPieceOwnedByPlayer(piece));

    // Determine background style for last move highlighting (like lichess yellow tint)
    const getSquareBackground = () => {
      // Last move "from" square - lighter yellow tint
      if (isLastMoveFrom && !isSelected && !isValidMove && !isDragValid && !hasPremoveHighlight) {
        return isDark ? "bg-[#aaa23a]" : "bg-[#cdd26a]";
      }
      // Last move "to" square - slightly more prominent yellow tint
      if (isLastMoveTo && !isSelected && !isValidMove && !isDragValid && !hasPremoveHighlight) {
        return isDark ? "bg-[#aaa23a]" : "bg-[#cdd26a]";
      }
      // Default board colors
      return isDark ? "bg-board-dark" : "bg-board-light";
    };

    return (
      <div
        key={`${row}-${col}`}
        className={`
          relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24
          flex items-center justify-center
          ${getSquareBackground()}
          ${isSelected ? "ring-4 ring-yellow-400 ring-inset" : ""}
          ${isPremoveSelected ? "ring-4 ring-cyan-400 ring-inset" : ""}
          ${isValidMove || isDragValid ? "ring-4 ring-green-400 ring-inset" : ""}
          ${isPremoveValidMove && !isValidMove && !isDragValid ? "ring-4 ring-cyan-400/70 ring-inset" : ""}
          ${hasPremoveHighlight ? "ring-4 ring-blue-400 ring-inset animate-premove-pulse" : ""}
          ${isInteractive && !disabled ? "cursor-pointer hover:brightness-110" : ""}
          transition-all duration-150
        `}
        onClick={() => handleSquareClick(row, col)}
        onDragOver={(e) => handleDragOver(row, col, e)}
        onDrop={(e) => handleDrop(row, col, e)}
      >
        {/* Valid move indicator */}
        {(isValidMove || isDragValid) && piece === Piece.Empty && (
          <div className="absolute w-4 h-4 rounded-full bg-green-500 animate-valid-move" />
        )}

        {/* Premove valid move indicator */}
        {isPremoveValidMove && !isValidMove && !isDragValid && piece === Piece.Empty && (
          <div className="absolute w-4 h-4 rounded-full bg-cyan-400/70 animate-valid-move" />
        )}

        {/* Piece */}
        {piece !== Piece.Empty && (
          <div
            draggable={canDrag}
            onDragStart={(e) => handleDragStart(row, col, e)}
            onDragEnd={handleDragEnd}
            className={`
              w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 rounded-full
              flex items-center justify-center
              shadow-lg transform transition-all duration-150
              ${canDrag ? "cursor-grab active:cursor-grabbing hover:scale-105 hover:ring-2 hover:ring-white/40" : ""}
              ${isSelected || isPremoveSelected ? "animate-piece-select" : ""}
              ${isDragging ? "opacity-50" : ""}
              ${animationType === 'move' ? "animate-piece-move" : ""}
              ${animationType === 'capture' ? "animate-piece-capture" : ""}
              ${animationType === 'king' ? "animate-king-promotion" : ""}
              ${isForcedCapturePiece && !isSelected ? "ring-4 ring-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" : ""}
              ${
                piece === Piece.Red || piece === Piece.RedKing
                  ? "bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-800"
                  : "bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-600"
              }
            `}
          >
            {/* King indicator */}
            {(piece === Piece.RedKing || piece === Piece.BlackKing) && (
              <span className="text-yellow-400 text-xl lg:text-2xl xl:text-3xl font-bold drop-shadow">
                ♔
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Flip board when playing as red (so player's pieces are at bottom)
  const shouldFlip = playerColor === "red";
  const colLabels = shouldFlip
    ? ["h", "g", "f", "e", "d", "c", "b", "a"]
    : ["a", "b", "c", "d", "e", "f", "g", "h"];

  return (
    <div className="flex flex-col items-center">
      {/* Board */}
      <div className="border-4 border-amber-900 rounded shadow-2xl shadow-black/40">
        {/* Column labels */}
        <div className="flex">
          <div className="w-6" />
          {colLabels.map((col) => (
            <div
              key={col}
              className="w-12 sm:w-14 md:w-16 lg:w-20 xl:w-24 text-center text-sm font-medium text-gray-600"
            >
              {col}
            </div>
          ))}
          <div className="w-6" />
        </div>

        {/* Rows */}
        {Array.from({ length: 8 }, (_, displayRow) => {
          const actualRow = shouldFlip ? 7 - displayRow : displayRow;
          const rowLabel = shouldFlip ? displayRow + 1 : 8 - displayRow;
          return (
            <div key={displayRow} className="flex items-center">
              {/* Row label */}
              <div className="w-6 text-center text-sm font-medium text-gray-600">
                {rowLabel}
              </div>

              {/* Squares */}
              {Array.from({ length: 8 }, (_, displayCol) => {
                const actualCol = shouldFlip ? 7 - displayCol : displayCol;
                return renderSquare(actualRow, actualCol);
              })}

              {/* Row label (right side) */}
              <div className="w-6 text-center text-sm font-medium text-gray-600">
                {rowLabel}
              </div>
            </div>
          );
        })}

        {/* Column labels (bottom) */}
        <div className="flex">
          <div className="w-6" />
          {colLabels.map((col) => (
            <div
              key={col}
              className="w-12 sm:w-14 md:w-16 lg:w-20 xl:w-24 text-center text-sm font-medium text-gray-600"
            >
              {col}
            </div>
          ))}
          <div className="w-6" />
        </div>
      </div>

      {/* Player color indicator */}
      <div className="mt-4 text-sm text-gray-600">
        You are playing as:{" "}
        <span
          className={`
          font-bold
          ${playerColor === "red" ? "text-red-600" : ""}
          ${playerColor === "black" ? "text-gray-800" : ""}
          ${playerColor === "spectator" ? "text-blue-600" : ""}
        `}
        >
          {playerColor === "red"
            ? "Red"
            : playerColor === "black"
            ? "Black"
            : "Spectator"}
        </span>
      </div>
    </div>
  );
}
