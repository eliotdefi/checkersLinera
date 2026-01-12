/**
 * Simplified GraphQL client for Linera Checkers
 * Uses native fetch API - no external dependencies required
 */

// Environment variables with defaults for local development
const LINERA_GRAPHQL_URL =
  process.env.NEXT_PUBLIC_LINERA_GRAPHQL_URL || 'http://localhost:8080'
const APP_ID = process.env.NEXT_PUBLIC_APP_ID || ''
const DEFAULT_CHAIN_ID = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || ''

// DEBUG: Log environment variables on load (client-side only)
if (typeof window !== 'undefined') {
  console.log('[GraphQL] ENV VARS LOADED:')
  console.log('[GraphQL] LINERA_GRAPHQL_URL:', LINERA_GRAPHQL_URL)
  console.log('[GraphQL] APP_ID:', APP_ID ? APP_ID.slice(0, 20) + '...' : 'not set')
  console.log('[GraphQL] DEFAULT_CHAIN_ID:', DEFAULT_CHAIN_ID ? DEFAULT_CHAIN_ID.slice(0, 20) + '...' : 'not set')
}

// ============================================================================
// Chain ID Management
// ============================================================================

/**
 * Get the GraphQL endpoint for a specific chain
 */
export function getGraphQLEndpoint(chainId?: string): string {
  const chain = chainId || getStoredChainId() || DEFAULT_CHAIN_ID
  if (!chain || !APP_ID) {
    return LINERA_GRAPHQL_URL
  }
  return `${LINERA_GRAPHQL_URL}/chains/${chain}/applications/${APP_ID}`
}

/**
 * Get default chain ID from environment
 */
export function getDefaultChainId(): string {
  return DEFAULT_CHAIN_ID
}

/**
 * Get stored chain ID from localStorage
 * Always prefers DEFAULT_CHAIN_ID to prevent stale chain issues
 */
export function getStoredChainId(): string | null {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem('linera_chain_id')

  // Always prefer default chain ID to avoid stale chain issues (network restarts)
  if (stored && stored !== DEFAULT_CHAIN_ID && DEFAULT_CHAIN_ID) {
    console.warn('[GraphQL] Clearing stale chain ID:', stored.slice(0, 20) + '...')
    localStorage.removeItem('linera_chain_id')
    return DEFAULT_CHAIN_ID
  }

  return stored || DEFAULT_CHAIN_ID || null
}

/**
 * Store chain ID in localStorage
 */
export function setStoredChainId(chainId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('linera_chain_id', chainId)
}

/**
 * Clear stored chain ID
 */
export function clearStoredChainId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('linera_chain_id')
}

// ============================================================================
// GraphQL Request Function
// ============================================================================

export interface GraphQLError {
  message: string
  locations?: Array<{ line: number; column: number }>
  path?: string[]
}

export interface GraphQLResponse<T> {
  data?: T
  errors?: GraphQLError[]
  error?: string | string[]
}

/**
 * Execute a GraphQL request against Linera
 * Handles Linera's quirky response formats automatically
 */
export async function lineraRequest<T>(
  chainId: string | undefined,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const endpoint = getGraphQLEndpoint(chainId)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })

    // Handle HTTP errors
    if (!response.ok) {
      if (response.status === 500) {
        // Chain ID might be invalid (network restarted)
        console.error('[GraphQL] Server error - chain ID may be invalid:', chainId?.slice(0, 20))

        // Clear stale chain if needed
        const stored = getStoredChainId()
        const defaultChain = getDefaultChainId()
        if (stored && defaultChain && stored.toLowerCase() !== defaultChain.toLowerCase()) {
          console.warn('[GraphQL] Clearing stale chain ID due to 500 error')
          clearStoredChainId()
        }

        throw new Error('Chain ID may be invalid. Try disconnecting and reconnecting.')
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result: GraphQLResponse<T> = await response.json()

    // Handle Linera's quirky response format
    // Sometimes returns data in "error" field as stringified JSON
    if (result.error && typeof result.error === 'string') {
      try {
        const parsed = JSON.parse(result.error)
        if (parsed.data) {
          return parsed.data as T
        }
      } catch {
        // Not parseable, throw original error
        throw new Error(result.error)
      }
    }

    // Handle error array format
    if (result.error && Array.isArray(result.error)) {
      throw new Error(result.error[0] || 'GraphQL Error')
    }

    // Standard GraphQL response
    if (result.data) {
      return result.data as T
    }

    // Handle GraphQL errors array
    if (result.errors && Array.isArray(result.errors)) {
      throw new Error(result.errors[0]?.message || 'GraphQL Error')
    }

    // Empty response - return empty object
    console.warn('[GraphQL] Empty response from Linera, returning default')
    return {} as T
  } catch (error) {
    // Network errors or JSON parse errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error - is Linera service running?')
    }
    throw error
  }
}

// ============================================================================
// GraphQL Queries
// ============================================================================

export const GET_ALL_GAMES = `
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

export const GET_GAME = `
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
    }
  }
`

export const GET_PENDING_GAMES = `
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

export const GET_ACTIVE_GAMES = `
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

export const GET_PLAYER_GAMES = `
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

export const GET_PLAYER_STATS = `
  query GetPlayerStats($chainId: String!) {
    playerStats(chainId: $chainId) {
      chainId
      gamesPlayed
      gamesWon
      gamesLost
      gamesDrawn
      winStreak
      bestStreak
    }
  }
`

export const GET_LEADERBOARD = `
  query GetLeaderboard($limit: Int) {
    leaderboard(limit: $limit) {
      chainId
      gamesPlayed
      gamesWon
      gamesLost
      gamesDrawn
      winStreak
      bestStreak
    }
  }
`

export const GET_CHAIN_ID = `
  query GetChainId {
    chainId
  }
`

// ============================================================================
// GraphQL Mutations
// ============================================================================

export const CREATE_GAME_MUTATION = `
  mutation CreateGame($vsAi: Boolean!) {
    createGame(vsAi: $vsAi)
  }
`

export const JOIN_GAME_MUTATION = `
  mutation JoinGame($gameId: String!) {
    joinGame(gameId: $gameId)
  }
`

export const MAKE_MOVE_MUTATION = `
  mutation MakeMove($gameId: String!, $fromRow: Int!, $fromCol: Int!, $toRow: Int!, $toCol: Int!) {
    makeMove(gameId: $gameId, fromRow: $fromRow, fromCol: $fromCol, toRow: $toRow, toCol: $toCol)
  }
`

export const RESIGN_MUTATION = `
  mutation Resign($gameId: String!) {
    resign(gameId: $gameId)
  }
`

export const REQUEST_AI_MOVE_MUTATION = `
  mutation RequestAiMove($gameId: String!) {
    requestAiMove(gameId: $gameId)
  }
`

// ============================================================================
// Helper Functions (for direct API usage without stores)
// ============================================================================

/**
 * Parse Linera response and extract data
 */
export function parseLineraResponse<T>(response: GraphQLResponse<T>): T | null {
  if (response?.errors) {
    console.error('[GraphQL] errors:', response.errors)
    return null
  }
  return (response?.data || response) as T
}

/**
 * Create a new game
 */
export async function createGame(chainId: string, vsAi: boolean): Promise<string> {
  const result = await lineraRequest<string | { createGame: boolean }>(
    chainId,
    CREATE_GAME_MUTATION,
    { vsAi }
  )
  if (typeof result === 'string') return 'success'
  return result?.createGame ? 'success' : 'failed'
}

/**
 * Join an existing game
 */
export async function joinGame(chainId: string, gameId: string): Promise<string> {
  const result = await lineraRequest<string | { joinGame: boolean }>(
    chainId,
    JOIN_GAME_MUTATION,
    { gameId }
  )
  if (typeof result === 'string') return 'success'
  return result?.joinGame ? 'success' : 'failed'
}

/**
 * Make a move in a game
 */
export async function makeMove(
  chainId: string,
  gameId: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): Promise<string> {
  const result = await lineraRequest<string | { makeMove: boolean }>(
    chainId,
    MAKE_MOVE_MUTATION,
    { gameId, fromRow, fromCol, toRow, toCol }
  )
  if (typeof result === 'string') return 'success'
  return result?.makeMove ? 'success' : 'failed'
}

/**
 * Resign from a game
 */
export async function resign(chainId: string, gameId: string): Promise<string> {
  const result = await lineraRequest<string | { resign: boolean }>(
    chainId,
    RESIGN_MUTATION,
    { gameId }
  )
  if (typeof result === 'string') return 'success'
  return result?.resign ? 'success' : 'failed'
}

/**
 * Request AI to make a move
 */
export async function requestAiMove(chainId: string, gameId: string): Promise<string> {
  const result = await lineraRequest<string | { requestAiMove: boolean }>(
    chainId,
    REQUEST_AI_MOVE_MUTATION,
    { gameId }
  )
  if (typeof result === 'string') return 'success'
  return result?.requestAiMove ? 'success' : 'failed'
}
