import { create } from 'zustand'

// Environment variables
const LINERA_GRAPHQL_URL =
  process.env.NEXT_PUBLIC_LINERA_GRAPHQL_URL || 'http://localhost:8080'
const APP_ID = process.env.NEXT_PUBLIC_APP_ID || ''
const DEFAULT_CHAIN_ID = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || ''

type GraphQLRequest = {
  query: string
  variables?: Record<string, unknown>
}

type WalletStore = {
  // State
  chainId: string | null
  playerId: string | null
  graphqlUrl: string
  ready: boolean
  notification: number
  isConnecting: boolean
  error: string | null

  // Actions
  init: () => void
  connect: (chainId: string, port?: string) => void
  disconnect: () => void
  quickConnect: () => boolean
  incrementNotification: () => void
  clearError: () => void

  // GraphQL helper
  requestAsync: <T>(req: GraphQLRequest) => Promise<T>

  // Computed
  getGraphQLEndpoint: () => string
  getDisplayChainId: () => string | null
  getDisplayPlayerId: () => string | null
}

// Generate or retrieve player ID (unique per browser)
function getPlayerId(): string {
  if (typeof window === 'undefined') return ''

  let playerId = localStorage.getItem('linera_player_id')
  if (!playerId) {
    // Generate new UUID-like player ID
    playerId = 'player_' + crypto.randomUUID().slice(0, 8)
    localStorage.setItem('linera_player_id', playerId)
  }
  return playerId
}

// Storage helpers
function getStoredChainId(): string | null {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem('linera_chain_id')
  // Always prefer default chain ID to avoid stale chain issues
  if (stored && stored !== DEFAULT_CHAIN_ID && DEFAULT_CHAIN_ID) {
    localStorage.removeItem('linera_chain_id')
    return DEFAULT_CHAIN_ID
  }

  return stored || DEFAULT_CHAIN_ID || null
}

function setStoredChainId(chainId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('linera_chain_id', chainId)
}

function clearStoredChainId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('linera_chain_id')
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  // Initial state
  chainId: null,
  playerId: null,
  graphqlUrl: LINERA_GRAPHQL_URL,
  ready: false,
  notification: 0,
  isConnecting: false,
  error: null,

  // Initialize wallet from environment/storage (auto-connect)
  init: () => {
    const defaultChain = DEFAULT_CHAIN_ID
    const storedPort = typeof window !== 'undefined' ? localStorage.getItem('linera_port') : null
    const playerId = getPlayerId()


    // Build graphqlUrl from stored port if available
    const graphqlUrl = storedPort ? `http://localhost:${storedPort}` : LINERA_GRAPHQL_URL

    // Auto-connect using environment chain ID (Hub Chain pattern)
    if (defaultChain) {
      setStoredChainId(defaultChain)
      set({
        chainId: defaultChain,
        playerId,
        graphqlUrl,
        ready: true,
        error: null
      })
    } else {
      set({
        chainId: null,
        playerId,
        graphqlUrl,
        ready: false,
        error: 'No chain ID available. Check environment configuration.'
      })
    }
  },

  // Connect to a specific chain
  connect: (chainId: string, port?: string) => {
    set({ isConnecting: true, error: null })
    try {
      setStoredChainId(chainId)

      // Build graphqlUrl from port if provided
      let graphqlUrl = get().graphqlUrl
      if (port) {
        graphqlUrl = `http://localhost:${port}`
        if (typeof window !== 'undefined') {
          localStorage.setItem('linera_port', port)
        }
      }

      set({
        chainId,
        graphqlUrl,
        ready: true,
        isConnecting: false
      })
    } catch (e) {
      set({
        isConnecting: false,
        error: 'Failed to connect'
      })
    }
  },

  // Disconnect wallet
  disconnect: () => {
    clearStoredChainId()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('linera_port')
    }
    set({
      chainId: null,
      graphqlUrl: LINERA_GRAPHQL_URL,
      ready: false,
      error: null
    })
  },

  // Quick connect using default chain ID
  quickConnect: () => {
    if (DEFAULT_CHAIN_ID) {
      get().connect(DEFAULT_CHAIN_ID)
      return true
    }
    set({ error: 'No default chain ID configured' })
    return false
  },

  // Increment notification counter (triggers re-fetches)
  incrementNotification: () => {
    set((state) => ({ notification: state.notification + 1 }))
  },

  // Clear error state
  clearError: () => {
    set({ error: null })
  },

  // Get GraphQL endpoint for current chain
  getGraphQLEndpoint: () => {
    const { chainId, graphqlUrl } = get()
    const chain = chainId || DEFAULT_CHAIN_ID

    if (!chain || !APP_ID) {
      return graphqlUrl
    }
    return `${graphqlUrl}/chains/${chain}/applications/${APP_ID}`
  },

  // Get abbreviated chain ID for display
  getDisplayChainId: () => {
    const { chainId } = get()
    if (!chainId) return null
    return `${chainId.slice(0, 8)}...${chainId.slice(-6)}`
  },

  // Get player ID for display
  getDisplayPlayerId: () => {
    const { playerId } = get()
    return playerId
  },

  // Execute GraphQL request
  requestAsync: async <T>(req: GraphQLRequest): Promise<T> => {
    const { chainId, ready, getGraphQLEndpoint } = get()

    if (!ready || !chainId) {
      throw new Error('Wallet not connected')
    }

    const endpoint = getGraphQLEndpoint()

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          query: req.query,
          variables: req.variables,
        }),
      })

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 500) {
          // Chain ID might be invalid (network restarted)
          console.error('[WalletStore] Server error - chain ID may be invalid')
          set({ error: 'Server error - chain ID may be invalid. Try reconnecting.' })
          throw new Error('Chain ID may be invalid. Try disconnecting and reconnecting.')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      // Handle Linera's quirky response format
      // Sometimes returns data in "error" field as stringified JSON
      if (result.error && typeof result.error === 'string') {
        try {
          const parsed = JSON.parse(result.error)
          if (parsed.data) {
            return parsed.data as T
          }
        } catch {
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
      console.warn('[WalletStore] Empty response from Linera')
      return {} as T
    } catch (error: unknown) {
      // Network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        set({ error: 'Network error - is Linera service running?' })
        throw new Error('Network error - is Linera service running?')
      }
      throw error
    }
  },
}))

// Export helper hooks for common patterns
export function useChainId() {
  return useWalletStore((state) => state.chainId)
}

export function useWalletReady() {
  return useWalletStore((state) => state.ready)
}

export function useNotification() {
  return useWalletStore((state) => state.notification)
}
