// Types matching the Linera contract types

export enum Piece {
  Empty = "EMPTY",
  Red = "RED",
  Black = "BLACK",
  RedKing = "RED_KING",
  BlackKing = "BLACK_KING",
}

export enum GameStatus {
  Pending = "PENDING",
  Active = "ACTIVE",
  Finished = "FINISHED",
}

export enum GameResult {
  RedWins = "RED_WINS",
  BlackWins = "BLACK_WINS",
  Draw = "DRAW",
  InProgress = "IN_PROGRESS",
}

export enum PlayerType {
  Human = "HUMAN",
  AI = "AI",
}

export enum Turn {
  Red = "RED",
  Black = "BLACK",
}

export interface CheckersMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  capturedRow?: number;
  capturedCol?: number;
  promoted: boolean;
  timestamp: number;
}

export interface Board {
  squares: Piece[];
}

export interface CheckersGame {
  id: string;
  redPlayer?: string;
  blackPlayer?: string;
  redPlayerType: PlayerType;
  blackPlayerType: PlayerType;
  board: Board;
  boardState: string;
  currentTurn: Turn;
  moves: CheckersMove[];
  moveCount: number;
  status: GameStatus;
  result?: GameResult;
  createdAt: number;
  updatedAt: number;
  clock?: Clock;
}

export interface PlayerStats {
  chainId: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  winStreak: number;
  bestStreak: number;
  // Rating fields (ELO system)
  bulletRating: number;
  blitzRating: number;
  rapidRating: number;
  bulletGames: number;
  blitzGames: number;
  rapidGames: number;
}

// Default stats for new players
export const DEFAULT_PLAYER_STATS: PlayerStats = {
  chainId: '',
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  gamesDrawn: 0,
  winStreak: 0,
  bestStreak: 0,
  bulletRating: 1200,
  blitzRating: 1200,
  rapidRating: 1200,
  bulletGames: 0,
  blitzGames: 0,
  rapidGames: 0,
};

// Helper to parse board state string into array
export function parseBoardState(boardState: string): Piece[][] {
  const board: Piece[][] = [];
  const rows = boardState.split("/");

  for (const row of rows) {
    const boardRow: Piece[] = [];
    for (const char of row) {
      switch (char) {
        case "r":
          boardRow.push(Piece.Red);
          break;
        case "b":
          boardRow.push(Piece.Black);
          break;
        case "R":
          boardRow.push(Piece.RedKing);
          break;
        case "B":
          boardRow.push(Piece.BlackKing);
          break;
        default:
          boardRow.push(Piece.Empty);
          break;
      }
    }
    board.push(boardRow);
  }

  return board;
}

// Helper to get piece at position
export function getPiece(boardState: string, row: number, col: number): Piece {
  const board = parseBoardState(boardState);
  if (row >= 0 && row < 8 && col >= 0 && col < 8) {
    return board[row][col];
  }
  return Piece.Empty;
}

// Helper to check if piece belongs to current turn
export function isPieceSelectable(
  piece: Piece,
  turn: Turn,
  playerColor: "red" | "black" | "spectator"
): boolean {
  if (playerColor === "spectator") return false;

  const isRed = piece === Piece.Red || piece === Piece.RedKing;
  const isBlack = piece === Piece.Black || piece === Piece.BlackKing;

  if (turn === Turn.Red && playerColor === "red" && isRed) return true;
  if (turn === Turn.Black && playerColor === "black" && isBlack) return true;

  return false;
}

// Time control enum for Lichess-style time controls
export enum TimeControl {
  Bullet1m = "BULLET_1_0",
  Bullet2m = "BULLET_2_1",
  Blitz3m = "BLITZ_3_0",
  Blitz5m = "BLITZ_5_3",
  Rapid10m = "RAPID_10_0",
}

// Time control category for styling/grouping
export type TimeControlCategory = "bullet" | "blitz" | "rapid";

// Metadata for each time control
export interface TimeControlMetadata {
  label: string;
  minutes: number;
  increment: number;
  category: TimeControlCategory;
}

// Time controls configuration object
export const TIME_CONTROLS: Record<TimeControl, TimeControlMetadata> = {
  [TimeControl.Bullet1m]: {
    label: "1+0",
    minutes: 1,
    increment: 0,
    category: "bullet",
  },
  [TimeControl.Bullet2m]: {
    label: "2+1",
    minutes: 2,
    increment: 1,
    category: "bullet",
  },
  [TimeControl.Blitz3m]: {
    label: "3+0",
    minutes: 3,
    increment: 0,
    category: "blitz",
  },
  [TimeControl.Blitz5m]: {
    label: "5+3",
    minutes: 5,
    increment: 3,
    category: "blitz",
  },
  [TimeControl.Rapid10m]: {
    label: "10+0",
    minutes: 10,
    increment: 0,
    category: "rapid",
  },
};

// Draw offer state enum
export enum DrawOfferState {
  None = "NONE",
  OfferedByMe = "OFFERED_BY_ME",
  OfferedByOpponent = "OFFERED_BY_OPPONENT",
}

// Color preference for game creation (invite a friend)
export enum ColorPreference {
  Red = "RED",
  Black = "BLACK",
  Random = "RANDOM",
}

// Clock interface for game timing (matches backend)
export interface Clock {
  initialTimeMs: number;
  incrementMs: number;
  redTimeMs: number;
  blackTimeMs: number;
  lastMoveAt: number;
}

// Queue entry for matchmaking
export interface QueueEntry {
  chainId: string;
  timeControl: TimeControl;
  joinedAt: number;
}

// Extended CheckersGame interface with clock and draw offer fields
export interface CheckersGameWithClock extends CheckersGame {
  clock?: Clock;
  drawOffer?: DrawOfferState;
  timeControl?: TimeControl;
  isRated?: boolean;
  colorPreference?: ColorPreference;
}

// ==================== RATING SYSTEM ====================

export enum RatingTier {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
  Expert = 'expert',
  Master = 'master',
}

export function getRatingTier(rating: number): RatingTier {
  if (rating < 1000) return RatingTier.Beginner;
  if (rating < 1400) return RatingTier.Intermediate;
  if (rating < 1800) return RatingTier.Advanced;
  if (rating < 2200) return RatingTier.Expert;
  return RatingTier.Master;
}

export function getTimeControlRatingCategory(timeControl: TimeControl): 'bullet' | 'blitz' | 'rapid' {
  switch (timeControl) {
    case TimeControl.Bullet1m:
    case TimeControl.Bullet2m:
      return 'bullet';
    case TimeControl.Blitz3m:
    case TimeControl.Blitz5m:
      return 'blitz';
    case TimeControl.Rapid10m:
    default:
      return 'rapid';
  }
}

export function getPlayerRating(stats: PlayerStats | null, timeControl: TimeControl | null): number {
  if (!stats) return 1200;
  if (!timeControl) return stats.blitzRating || 1200;
  const category = getTimeControlRatingCategory(timeControl);
  switch (category) {
    case 'bullet': return stats.bulletRating || 1200;
    case 'blitz': return stats.blitzRating || 1200;
    case 'rapid': return stats.rapidRating || 1200;
  }
}

export function getPlayerGamesInCategory(stats: PlayerStats | null, timeControl: TimeControl | null): number {
  if (!stats) return 0;
  if (!timeControl) return stats.blitzGames || 0;
  const category = getTimeControlRatingCategory(timeControl);
  switch (category) {
    case 'bullet': return stats.bulletGames || 0;
    case 'blitz': return stats.blitzGames || 0;
    case 'rapid': return stats.rapidGames || 0;
  }
}

// ==================== TOURNAMENT TYPES ====================

export enum TournamentStatus {
  Registration = "REGISTRATION",
  InProgress = "IN_PROGRESS",
  Finished = "FINISHED",
  Cancelled = "CANCELLED",
}

export enum MatchStatus {
  Pending = "PENDING",
  Ready = "READY",
  InProgress = "IN_PROGRESS",
  Finished = "FINISHED",
  Bye = "BYE",
}

export enum TournamentFormat {
  Swiss = "SWISS",
  SingleElimination = "SINGLE_ELIMINATION",
}

export interface SwissParticipant {
  playerId: string;
  score: number;
  opponents: string[];
  hasBye: boolean;
}

export interface TournamentRound {
  roundNumber: number;
  matches: TournamentMatch[];
  completed: boolean;
}

export interface TournamentMatch {
  id: string;
  round: number;
  matchNumber: number;
  player1?: string;
  player2?: string;
  gameId?: string;
  winner?: string;
  status: MatchStatus;
}

export interface Tournament {
  id: string;
  name: string;
  creator: string;
  status: TournamentStatus;
  timeControl: TimeControl;
  maxPlayers: number;
  registeredPlayers: string[];
  matches: TournamentMatch[];
  currentRound: number;
  totalRounds: number;
  winner?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  // Privacy & access control
  isPublic: boolean;
  inviteCode?: string;
  // Optional scheduled start time (Unix timestamp in microseconds)
  scheduledStart?: number;
  // Swiss tournament fields
  format: TournamentFormat;
  participants: SwissParticipant[];
  rounds: TournamentRound[];
  numRounds: number;
}
