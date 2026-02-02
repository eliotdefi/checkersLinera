import { create } from 'zustand'
import { useWalletStore } from './wallet'
import {
  CheckersGame,
  CheckersGameWithClock,
  CheckersMove,
  GameStatus,
  Turn,
  Piece,
  TimeControl,
  ColorPreference,
  parseBoardState,
  PlayerStats,
  DEFAULT_PLAYER_STATS,
} from '@/types/game'

// GraphQL Queries
const GET_ALL_GAMES = `
  query GetAllGames {
    allGames {
      id
      redPlayer
      blackPlayer
      redPlayerType
      blackPlayerType
      boardState
      currentTurn
      moveCount
      status
      result
      createdAt
      updatedAt
    }
  }
`

const GET_GAME = `
  query GetGame($id: String!) {
    game(id: $id) {
      id
      redPlayer
      blackPlayer
      redPlayerType
      blackPlayerType
      boardState
      currentTurn
      moves {
        fromRow
        fromCol
        toRow
        toCol
        capturedRow
        capturedCol
        promoted
        timestamp
      }
      moveCount
      status
      result
      createdAt
      updatedAt
      clock {
        initialTimeMs
        incrementMs
        redTimeMs
        blackTimeMs
        lastMoveAt
      }
    }
  }
`

const GET_PENDING_GAMES = `
  query GetPendingGames {
    pendingGames {
      id
      redPlayer
      redPlayerType
      boardState
      status
      createdAt
    }
  }
`

const GET_ACTIVE_GAMES = `
  query GetActiveGames {
    activeGames {
      id
      redPlayer
      blackPlayer
      redPlayerType
      blackPlayerType
      boardState
      currentTurn
      moveCount
      status
      createdAt
      updatedAt
    }
  }
`

const GET_PLAYER_GAMES = `
  query GetPlayerGames($chainId: String!) {
    playerGames(chainId: $chainId) {
      id
      redPlayer
      blackPlayer
      redPlayerType
      blackPlayerType
      boardState
      currentTurn
      moveCount
      status
      result
      createdAt
      updatedAt
    }
  }
`

// Player stats query for ratings
const GET_PLAYER_STATS = `
  query GetPlayerStats($chainId: String!) {
    playerStats(chainId: $chainId) {
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
`

// Mutations - all include playerId for Hub Chain pattern
const CREATE_GAME_MUTATION = `
  mutation CreateGame($vsAi: Boolean!, $timeControl: TimeControl, $colorPreference: ColorPreference, $isRated: Boolean, $playerId: String!) {
    createGame(vsAi: $vsAi, timeControl: $timeControl, colorPreference: $colorPreference, isRated: $isRated, playerId: $playerId)
  }
`

const JOIN_GAME_MUTATION = `
  mutation JoinGame($gameId: String!, $playerId: String!) {
    joinGame(gameId: $gameId, playerId: $playerId)
  }
`

const MAKE_MOVE_MUTATION = `
  mutation MakeMove($gameId: String!, $fromRow: Int!, $fromCol: Int!, $toRow: Int!, $toCol: Int!, $playerId: String!) {
    makeMove(gameId: $gameId, fromRow: $fromRow, fromCol: $fromCol, toRow: $toRow, toCol: $toCol, playerId: $playerId)
  }
`

const RESIGN_MUTATION = `
  mutation Resign($gameId: String!, $playerId: String!) {
    resign(gameId: $gameId, playerId: $playerId)
  }
`

const REQUEST_AI_MOVE_MUTATION = `
  mutation RequestAiMove($gameId: String!) {
    requestAiMove(gameId: $gameId)
  }
`

// Queue mutations and queries
const JOIN_QUEUE_MUTATION = `mutation JoinQueue($timeControl: TimeControl!, $playerId: String!) { joinQueue(timeControl: $timeControl, playerId: $playerId) }`
const LEAVE_QUEUE_MUTATION = `mutation LeaveQueue($playerId: String!) { leaveQueue(playerId: $playerId) }`
const GET_QUEUE_STATUS = `query GetQueueStatus { queueStatus { timeControl playerCount } }`

// Draw mutations
const OFFER_DRAW_MUTATION = `mutation OfferDraw($gameId: String!) { offerDraw(gameId: $gameId) }`
const ACCEPT_DRAW_MUTATION = `mutation AcceptDraw($gameId: String!) { acceptDraw(gameId: $gameId) }`
const DECLINE_DRAW_MUTATION = `mutation DeclineDraw($gameId: String!) { declineDraw(gameId: $gameId) }`

// Time win mutation
const CLAIM_TIME_WIN_MUTATION = `mutation ClaimTimeWin($gameId: String!) { claimTimeWin(gameId: $gameId) }`

// Types for optimistic updates
type MoveInfo = {
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
}

type GameStore = {
  // State
  games: CheckersGame[]
  selectedGame: CheckersGame | null
  selectedGameId: string | null
  isLoading: boolean
  isMoving: boolean
  error: string | null

  // Player stats for rating display
  myStats: PlayerStats | null
  opponentStats: PlayerStats | null
  lastRatingChange: number | null

  // Queue state
  inQueue: boolean
  queueTimeControl: TimeControl | null
  queueJoinedAt: number | null
  queueCounts: Record<TimeControl, number>

  // Timer state
  localRedTimeMs: number
  localBlackTimeMs: number
  timerIntervalId: NodeJS.Timeout | null

  // Previous state for rollback
  previousState: {
    games: CheckersGame[]
    selectedGame: CheckersGame | null
  } | null

  // Fetch actions
  fetchGames: () => Promise<void>
  fetchGame: (id: string) => Promise<void>
  fetchPendingGames: () => Promise<void>
  fetchActiveGames: () => Promise<void>
  fetchPlayerGames: () => Promise<void>

  // Stats actions (for ratings)
  fetchMyStats: () => Promise<void>
  fetchOpponentStats: (chainId: string) => Promise<void>
  setLastRatingChange: (change: number | null) => void
  clearStats: () => void

  // Game selection
  selectGame: (id: string | null) => void

  // Game actions
  createGame: (vsAi: boolean, timeControl?: TimeControl, colorPreference?: ColorPreference, isRated?: boolean) => Promise<string | null>
  joinGame: (gameId: string) => Promise<boolean>
  makeMove: (from: MoveInfo, to: MoveInfo) => Promise<boolean>
  resign: () => Promise<boolean>
  requestAiMove: () => Promise<boolean>

  // Queue actions
  joinQueue: (timeControl: TimeControl) => Promise<string | null>
  leaveQueue: () => Promise<boolean>
  fetchQueueStatus: () => Promise<void>

  // Draw actions
  offerDraw: (gameId: string) => Promise<boolean>
  acceptDraw: (gameId: string) => Promise<boolean>
  declineDraw: (gameId: string) => Promise<boolean>

  // Time win action
  claimTimeWin: (gameId: string) => Promise<boolean>

  // Timer actions
  startLocalTimer: () => void
  stopLocalTimer: () => void
  syncTimerFromGame: (game: CheckersGameWithClock) => void

  // Optimistic updates
  localMakeMove: (from: MoveInfo, to: MoveInfo) => void
  rollbackMove: () => void

  // Helpers
  clearError: () => void
  getPlayerColor: () => 'red' | 'black' | 'spectator'
  isMyTurn: () => boolean
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  games: [],
  selectedGame: null,
  selectedGameId: null,
  isLoading: false,
  isMoving: false,
  error: null,

  // Player stats (for ratings)
  myStats: null,
  opponentStats: null,
  lastRatingChange: null,

  // Queue state
  inQueue: false,
  queueTimeControl: null,
  queueJoinedAt: null,
  queueCounts: {
    [TimeControl.Bullet1m]: 0,
    [TimeControl.Bullet2m]: 0,
    [TimeControl.Blitz3m]: 0,
    [TimeControl.Blitz5m]: 0,
    [TimeControl.Rapid10m]: 0,
  },

  // Timer state
  localRedTimeMs: 0,
  localBlackTimeMs: 0,
  timerIntervalId: null,

  previousState: null,

  // Fetch all games
  fetchGames: async () => {
    const { requestAsync } = useWalletStore.getState()

    set({ isLoading: true, error: null })

    try {
      const data = await requestAsync<{ allGames: CheckersGame[] }>({
        query: GET_ALL_GAMES,
      })

      const games = data?.allGames || []
      set({ games, isLoading: false })

      // Update selected game if it exists - but only if the new data is fresher
      const { selectedGameId, selectedGame: currentSelectedGame } = get()
      if (selectedGameId) {
        const updated = games.find((g) => g.id === selectedGameId)
        if (updated) {
          // Only update if new data has higher or equal moveCount (prevent stale overwrite)
          if (!currentSelectedGame || updated.moveCount >= currentSelectedGame.moveCount) {
            set({ selectedGame: updated })
          } else {
          }
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to fetch games'
      set({ error, isLoading: false })
      console.error('[GameStore] fetchGames error:', error)
    }
  },

  // Fetch a single game by ID
  fetchGame: async (id: string) => {
    const { requestAsync } = useWalletStore.getState()

    set({ isLoading: true, error: null })

    try {
      const data = await requestAsync<{ game: CheckersGame }>({
        query: GET_GAME,
        variables: { id },
      })

      if (data?.game) {
        // Debug: Log actual game data from backend
          id: data.game.id,
          status: data.game.status,
          statusType: typeof data.game.status,
          currentTurn: data.game.currentTurn,
          turnType: typeof data.game.currentTurn,
          moveCount: data.game.moveCount,
          boardStateLength: data.game.boardState?.length,
        })

        // Atomic update: update selectedGame AND games array in one set() call
        set((state) => ({
          selectedGame: data.game,
          selectedGameId: id,
          isLoading: false,
          games: state.games.map((g) =>
            g.id === id ? data.game : g
          ),
        }))
      } else {
        set({
          error: 'Game not found',
          isLoading: false,
        })
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to fetch game'
      set({ error, isLoading: false })
      console.error('[GameStore] fetchGame error:', error)
    }
  },

  // Fetch pending games only
  fetchPendingGames: async () => {
    const { requestAsync } = useWalletStore.getState()

    try {
      const data = await requestAsync<{ pendingGames: CheckersGame[] }>({
        query: GET_PENDING_GAMES,
      })

      const pending = data?.pendingGames || []

      // Merge with existing games
      set((state) => {
        const nonPending = state.games.filter((g) => g.status !== GameStatus.Pending)
        return { games: [...nonPending, ...pending] }
      })
    } catch (e) {
      console.error('[GameStore] fetchPendingGames error:', e)
    }
  },

  // Fetch active games only
  fetchActiveGames: async () => {
    const { requestAsync } = useWalletStore.getState()

    try {
      const data = await requestAsync<{ activeGames: CheckersGame[] }>({
        query: GET_ACTIVE_GAMES,
      })

      const active = data?.activeGames || []

      // Merge with existing games
      set((state) => {
        const nonActive = state.games.filter((g) => g.status !== GameStatus.Active)
        return { games: [...nonActive, ...active] }
      })
    } catch (e) {
      console.error('[GameStore] fetchActiveGames error:', e)
    }
  },

  // Fetch games for current player
  fetchPlayerGames: async () => {
    const { requestAsync, chainId } = useWalletStore.getState()

    if (!chainId) return

    try {
      const data = await requestAsync<{ playerGames: CheckersGame[] }>({
        query: GET_PLAYER_GAMES,
        variables: { chainId },
      })

      const playerGames = data?.playerGames || []
      set({ games: playerGames })
    } catch (e) {
      console.error('[GameStore] fetchPlayerGames error:', e)
    }
  },

  // ==================== STATS ACTIONS (for ratings) ====================

  fetchMyStats: async () => {
    const { requestAsync, playerId } = useWalletStore.getState()
    if (!playerId) {
      return
    }
    try {
      const data = await requestAsync<{ playerStats: PlayerStats | null }>({
        query: GET_PLAYER_STATS,
        variables: { chainId: playerId },
      })
      if (data?.playerStats) {
        set({ myStats: data.playerStats })
      } else {
        set({ myStats: { ...DEFAULT_PLAYER_STATS, chainId: playerId } })
      }
    } catch (e) {
      console.error('[GameStore] fetchMyStats error:', e)
      const { playerId: currentPlayerId } = useWalletStore.getState()
      if (currentPlayerId) {
        set({ myStats: { ...DEFAULT_PLAYER_STATS, chainId: currentPlayerId } })
      }
    }
  },

  fetchOpponentStats: async (opponentChainId: string) => {
    if (!opponentChainId || opponentChainId === 'AI') {
      set({
        opponentStats: {
          ...DEFAULT_PLAYER_STATS,
          chainId: 'AI',
          bulletRating: 1500,
          blitzRating: 1500,
          rapidRating: 1500,
        }
      })
      return
    }
    const { requestAsync } = useWalletStore.getState()
    try {
      const data = await requestAsync<{ playerStats: PlayerStats | null }>({
        query: GET_PLAYER_STATS,
        variables: { chainId: opponentChainId },
      })
      if (data?.playerStats) {
        set({ opponentStats: data.playerStats })
      } else {
        set({ opponentStats: { ...DEFAULT_PLAYER_STATS, chainId: opponentChainId } })
      }
    } catch (e) {
      console.error('[GameStore] fetchOpponentStats error:', e)
      set({ opponentStats: { ...DEFAULT_PLAYER_STATS, chainId: opponentChainId } })
    }
  },

  setLastRatingChange: (change: number | null) => {
    set({ lastRatingChange: change })
  },

  clearStats: () => {
    set({ myStats: null, opponentStats: null, lastRatingChange: null })
  },

  // Select a game (Fix 2: reset state when switching games)
  selectGame: (id: string | null) => {
    if (!id) {
      set({ selectedGame: null, selectedGameId: null, isMoving: false, isLoading: false, error: null })
      return
    }

    const { games } = get()
    const game = games.find((g) => g.id === id)

    set({
      selectedGame: game || null,
      selectedGameId: id,
      isMoving: false,      // Reset move lock
      isLoading: false,     // Reset loading state
      error: null,          // Clear any errors
    })

    // Fetch full game details if game not found in local array or lacks details
    if (!game || !game.moves) {
      get().fetchGame(id)
    }
  },

  // Create a new game
  createGame: async (
    vsAi: boolean,
    timeControl?: TimeControl,
    colorPreference?: ColorPreference,
    isRated?: boolean
  ) => {
    const { requestAsync, incrementNotification, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'Player ID not available', isLoading: false })
      return null
    }

    set({ isLoading: true, error: null })

    try {
      // Build mutation with inline values including playerId
      let mutationQuery = `mutation { createGame(vsAi: ${vsAi}, playerId: "${playerId}"`

      if (timeControl) {
        mutationQuery += `, timeControl: ${timeControl}`
      }
      if (colorPreference !== undefined) {
        mutationQuery += `, colorPreference: ${colorPreference}`
      }
      if (isRated !== undefined) {
        mutationQuery += `, isRated: ${isRated}`
      }

      mutationQuery += ') }'

      // Linera mutations return transaction hash, not the operation result
      // So we always use the fallback method: create game, then fetch to find it
      const result = await requestAsync<{ createGame: string }>({
        query: mutationQuery,
      })

      // Debug: log actual response (will be transaction hash)

      // Trigger refetch and wait for blockchain to process
      incrementNotification()

      // Wait a bit for blockchain to process the transaction
      await new Promise(resolve => setTimeout(resolve, 500))

      // Fetch updated games list
      await get().fetchGames()

      set({ isLoading: false })

      // Find newest game created by us (using playerId)
      // Include both Pending (PvP) and Active (AI) games since AI games start Active
      const { games } = get()
      const { playerId: currentPlayerId } = useWalletStore.getState()

      const newest = games
        .filter(g =>
          (g.status === GameStatus.Pending || g.status === GameStatus.Active) &&
          (g.redPlayer === currentPlayerId ||
           g.blackPlayer === currentPlayerId)
        )
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]

      return newest?.id || null
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to create game'
      set({ error, isLoading: false })
      return null
    }
  },

  // Join an existing game
  joinGame: async (gameId: string) => {
    const { requestAsync, incrementNotification, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'Player ID not available', isLoading: false })
      return false
    }

    set({ isLoading: true, error: null })

    try {
      // Use inline mutation for Linera compatibility
      await requestAsync({
        query: `mutation { joinGame(gameId: "${gameId}", playerId: "${playerId}") }`,
      })

      // Trigger refetch
      incrementNotification()
      await get().fetchGame(gameId)

      set({ isLoading: false })
      return true
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to join game'
      set({ error, isLoading: false })
      return false
    }
  },

  // Make a move (no optimistic update to avoid format conflicts)
  makeMove: async (from: MoveInfo, _to: MoveInfo) => {
    const { selectedGame, selectedGameId } = get()
    const { requestAsync, incrementNotification, playerId } = useWalletStore.getState()

    if (!selectedGame || !selectedGameId) {
      set({ error: 'No game selected' })
      return false
    }

    if (!playerId) {
      set({ error: 'Player ID not available' })
      return false
    }

    // Prevent double moves
    if (get().isMoving) {
      return false
    }

    set({ isMoving: true, error: null })

    try {

      // Use inline mutation for Linera compatibility
      await requestAsync({
        query: `mutation { makeMove(gameId: "${selectedGameId}", fromRow: ${from.fromRow}, fromCol: ${from.fromCol}, toRow: ${from.toRow}, toCol: ${from.toCol}, playerId: "${playerId}") }`,
      })


      // Increment notification to trigger refetch in other components
      incrementNotification()

      // Wait for blockchain to process (increased from 300ms to 800ms)
      await new Promise(resolve => setTimeout(resolve, 800))

      // Fetch updated game state - retry up to 3 times (Fix 5: protect from game switches)
      let fetchSuccess = false
      const oldMoveCount = selectedGame.moveCount
      console.log('[GameStore] Starting retry loop, oldMoveCount:', oldMoveCount)

      for (let i = 0; i < 3; i++) {
        // Check if game changed during async operation
        if (get().selectedGameId !== selectedGameId) {
          break
        }

        await get().fetchGame(selectedGameId)
        const updatedGame = get().selectedGame

        if (updatedGame?.id !== selectedGameId) {
          break
        }

        if (updatedGame && updatedGame.moveCount > oldMoveCount) {
          fetchSuccess = true
          break
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }

      set({ isMoving: false })

      return true
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to make move'
      console.error('[GameStore] Move failed:', error)
      set({ error, isMoving: false })
      return false
    }
  },

  // Resign from current game
  resign: async () => {
    const { selectedGameId } = get()
    const { requestAsync, incrementNotification, playerId } = useWalletStore.getState()

    if (!selectedGameId) {
      set({ error: 'No game selected' })
      return false
    }

    if (!playerId) {
      set({ error: 'Player ID not available' })
      return false
    }

    set({ isLoading: true, error: null })

    try {
      // Use inline mutation for Linera compatibility
      await requestAsync({
        query: `mutation { resign(gameId: "${selectedGameId}", playerId: "${playerId}") }`,
      })

      incrementNotification()
      await get().fetchGame(selectedGameId)

      set({ isLoading: false })
      return true
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to resign'
      set({ error, isLoading: false })
      return false
    }
  },

  // Request AI move
  requestAiMove: async () => {
    const { selectedGameId } = get()
    const { requestAsync, incrementNotification } = useWalletStore.getState()

    if (!selectedGameId) {
      set({ error: 'No game selected' })
      return false
    }

    set({ isMoving: true, error: null })

    try {
      await requestAsync({
        query: REQUEST_AI_MOVE_MUTATION,
        variables: { gameId: selectedGameId },
      })

      incrementNotification()
      await get().fetchGame(selectedGameId)

      set({ isMoving: false })
      return true
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to request AI move'
      set({ error, isMoving: false })
      return false
    }
  },

  // Join matchmaking queue
  joinQueue: async (timeControl: TimeControl) => {
    const { requestAsync, incrementNotification, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'Player ID not available', isLoading: false })
      return null
    }

    set({ isLoading: true, error: null })

    try {
      const result = await requestAsync<{ joinQueue: string | null }>({
        query: JOIN_QUEUE_MUTATION,
        variables: { timeControl, playerId },
      })

      // If a game ID is returned, a match was found immediately
      if (result?.joinQueue) {
        set({
          isLoading: false,
          inQueue: false,
          queueTimeControl: null,
          queueJoinedAt: null,
        })
        incrementNotification()
        await get().fetchGame(result.joinQueue)
        return result.joinQueue
      }

      // Otherwise, we're waiting in queue
      set({
        isLoading: false,
        inQueue: true,
        queueTimeControl: timeControl,
        queueJoinedAt: Date.now(),
      })
      return null
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to join queue'
      set({ error, isLoading: false })
      return null
    }
  },

  // Leave matchmaking queue
  leaveQueue: async () => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'Player ID not available' })
      return false
    }

    try {
      await requestAsync({
        query: LEAVE_QUEUE_MUTATION,
        variables: { playerId },
      })

      set({
        inQueue: false,
        queueTimeControl: null,
        queueJoinedAt: null,
      })
      return true
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to leave queue'
      set({ error })
      return false
    }
  },

  // Fetch queue status for all time controls
  fetchQueueStatus: async () => {
    const { requestAsync } = useWalletStore.getState()

    try {
      const result = await requestAsync<{
        queueStatus: Array<{ timeControl: TimeControl; playerCount: number }>
      }>({
        query: GET_QUEUE_STATUS,
      })

      if (result?.queueStatus) {
        const queueCounts = { ...get().queueCounts }
        for (const status of result.queueStatus) {
          queueCounts[status.timeControl] = status.playerCount
        }
        set({ queueCounts })
      }
    } catch (e) {
      console.error('[GameStore] fetchQueueStatus error:', e)
    }
  },

  // Offer a draw to opponent
  offerDraw: async (gameId: string) => {
    const { requestAsync, incrementNotification } = useWalletStore.getState()

    try {
      await requestAsync({
        query: OFFER_DRAW_MUTATION,
        variables: { gameId },
      })

      incrementNotification()
      await get().fetchGame(gameId)
      return true
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to offer draw'
      set({ error })
      return false
    }
  },

  // Accept a draw offer
  acceptDraw: async (gameId: string) => {
    const { requestAsync, incrementNotification } = useWalletStore.getState()

    try {
      await requestAsync({
        query: ACCEPT_DRAW_MUTATION,
        variables: { gameId },
      })

      incrementNotification()
      await get().fetchGame(gameId)
      return true
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to accept draw'
      set({ error })
      return false
    }
  },

  // Decline a draw offer
  declineDraw: async (gameId: string) => {
    const { requestAsync, incrementNotification } = useWalletStore.getState()

    try {
      await requestAsync({
        query: DECLINE_DRAW_MUTATION,
        variables: { gameId },
      })

      incrementNotification()
      await get().fetchGame(gameId)
      return true
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to decline draw'
      set({ error })
      return false
    }
  },

  // Claim time win when opponent's clock expires
  claimTimeWin: async (gameId: string) => {
    const { requestAsync, incrementNotification } = useWalletStore.getState()

    try {
      await requestAsync({
        query: CLAIM_TIME_WIN_MUTATION,
        variables: { gameId },
      })

      incrementNotification()
      await get().fetchGame(gameId)
      return true
    } catch (e) {
      console.error('[GameStore] claimTimeWin error:', e)
      return false
    }
  },

  // Start local timer countdown (100ms interval)
  startLocalTimer: () => {
    const { timerIntervalId, selectedGame } = get()

    // Clear existing timer if any
    if (timerIntervalId) {
      clearInterval(timerIntervalId)
    }

    if (!selectedGame || selectedGame.status !== GameStatus.Active) {
      return
    }

    const intervalId = setInterval(() => {
      const { selectedGame: currentGame, localRedTimeMs, localBlackTimeMs } = get()

      if (!currentGame || currentGame.status !== GameStatus.Active) {
        get().stopLocalTimer()
        return
      }

      // Decrement the active player's time
      if (currentGame.currentTurn === Turn.Red) {
        const newTime = Math.max(0, localRedTimeMs - 100)
        set({ localRedTimeMs: newTime })
      } else {
        const newTime = Math.max(0, localBlackTimeMs - 100)
        set({ localBlackTimeMs: newTime })
      }
    }, 100)

    set({ timerIntervalId: intervalId })
  },

  // Stop local timer
  stopLocalTimer: () => {
    const { timerIntervalId } = get()

    if (timerIntervalId) {
      clearInterval(timerIntervalId)
      set({ timerIntervalId: null })
    }
  },

  // Sync local timer from backend game state
  syncTimerFromGame: (game: CheckersGameWithClock) => {
    if (game.clock) {
      set({
        localRedTimeMs: game.clock.redTimeMs,
        localBlackTimeMs: game.clock.blackTimeMs,
      })
    }
  },

  // Optimistic local move update
  localMakeMove: (from: MoveInfo, _to: MoveInfo) => {
    const { selectedGame, games } = get()

    if (!selectedGame) return

    // Save previous state for rollback
    set({
      previousState: {
        games: [...games],
        selectedGame: { ...selectedGame },
      },
    })

    // Parse current board state
    const board = parseBoardState(selectedGame.boardState)
    const piece = board[from.fromRow][from.fromCol]

    // Clear source square
    board[from.fromRow][from.fromCol] = Piece.Empty

    // Check for capture (if jumping over a piece)
    const rowDiff = Math.abs(from.toRow - from.fromRow)
    if (rowDiff === 2) {
      const capturedRow = Math.floor((from.fromRow + from.toRow) / 2)
      const capturedCol = Math.floor((from.fromCol + from.toCol) / 2)
      board[capturedRow][capturedCol] = Piece.Empty
    }

    // Set destination square (check for promotion)
    let newPiece = piece
    if (piece === Piece.Red && from.toRow === 7) {
      newPiece = Piece.RedKing
    } else if (piece === Piece.Black && from.toRow === 0) {
      newPiece = Piece.BlackKing
    }
    board[from.toRow][from.toCol] = newPiece

    // Convert board back to string
    const newBoardState = boardToString(board)

    // Toggle turn
    const newTurn = selectedGame.currentTurn === Turn.Red ? Turn.Black : Turn.Red

    // Create updated game
    const updatedGame: CheckersGame = {
      ...selectedGame,
      boardState: newBoardState,
      currentTurn: newTurn,
      moveCount: selectedGame.moveCount + 1,
    }

    // Update state
    set({
      selectedGame: updatedGame,
      games: games.map((g) => (g.id === selectedGame.id ? updatedGame : g)),
    })
  },

  // Rollback to previous state
  rollbackMove: () => {
    const { previousState } = get()

    if (previousState) {
      set({
        games: previousState.games,
        selectedGame: previousState.selectedGame,
        previousState: null,
      })
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null })
  },

  // Get player's color in current game (uses playerId for Hub Chain pattern)
  getPlayerColor: () => {
    const { selectedGame } = get()
    const { playerId } = useWalletStore.getState()

    if (!selectedGame || !playerId) return 'spectator'

    // Compare using playerId (stored in redPlayer/blackPlayer fields)
    if (selectedGame.redPlayer === playerId) return 'red'
    if (selectedGame.blackPlayer === playerId) return 'black'

    return 'spectator'
  },

  // Check if it's the current player's turn
  isMyTurn: () => {
    const { selectedGame, getPlayerColor } = get()

    if (!selectedGame) return false

    const color = getPlayerColor()
    if (color === 'spectator') return false

    if (color === 'red' && selectedGame.currentTurn === Turn.Red) return true
    if (color === 'black' && selectedGame.currentTurn === Turn.Black) return true

    return false
  },
}))

// Helper function to convert 2D board back to string
function boardToString(board: Piece[][]): string {
  return board
    .map((row) =>
      row
        .map((piece) => {
          switch (piece) {
            case Piece.Red:
              return 'r'
            case Piece.Black:
              return 'b'
            case Piece.RedKing:
              return 'R'
            case Piece.BlackKing:
              return 'B'
            default:
              return '.'
          }
        })
        .join('')
    )
    .join('/')
}

// Export helper hooks
export function useGames() {
  return useGameStore((state) => state.games)
}

export function useSelectedGame() {
  return useGameStore((state) => state.selectedGame)
}

export function useGameLoading() {
  return useGameStore((state) => state.isLoading)
}

export function useGameError() {
  return useGameStore((state) => state.error)
}
