import { create } from 'zustand'
import { useWalletStore } from './wallet'
import {
  Tournament,
  TournamentMatch,
  TournamentStatus,
  MatchStatus,
  TimeControl,
} from '@/types/game'

// GraphQL fragment for tournament fields
const TOURNAMENT_FIELDS = `
  id
  name
  creator
  status
  timeControl
  maxPlayers
  registeredPlayers
  matches {
    id
    round
    matchNumber
    player1
    player2
    gameId
    winner
    status
  }
  currentRound
  totalRounds
  winner
  createdAt
  startedAt
  finishedAt
  isPublic
  inviteCode
  scheduledStart
  format
  participants {
    playerId
    score
    opponents
    hasBye
  }
  rounds {
    roundNumber
    matches {
      id
      round
      matchNumber
      player1
      player2
      gameId
      winner
      status
    }
    completed
  }
  numRounds
`

// GraphQL Queries
const GET_PLAYER_TOURNAMENTS = `
  query GetPlayerTournaments($playerId: String!) {
    tournaments(playerId: $playerId) {
      ${TOURNAMENT_FIELDS}
    }
  }
`

const GET_PUBLIC_TOURNAMENTS = `
  query GetPublicTournaments {
    publicTournaments {
      ${TOURNAMENT_FIELDS}
    }
  }
`

const GET_TOURNAMENT = `
  query GetTournament($id: String!) {
    tournament(id: $id) {
      ${TOURNAMENT_FIELDS}
    }
  }
`

const GET_TOURNAMENT_BY_CODE = `
  query GetTournamentByCode($code: String!) {
    tournamentByCode(code: $code) {
      ${TOURNAMENT_FIELDS}
    }
  }
`

// Mutations
const CREATE_TOURNAMENT_MUTATION = `
  mutation CreateTournament($name: String!, $timeControl: TimeControl!, $maxPlayers: Int!, $isPublic: Boolean!, $scheduledStart: Int, $playerId: String!) {
    createTournament(name: $name, timeControl: $timeControl, maxPlayers: $maxPlayers, isPublic: $isPublic, scheduledStart: $scheduledStart, playerId: $playerId)
  }
`

const JOIN_TOURNAMENT_MUTATION = `
  mutation JoinTournament($tournamentId: String!, $playerId: String!) {
    joinTournament(tournamentId: $tournamentId, playerId: $playerId)
  }
`

const JOIN_TOURNAMENT_BY_CODE_MUTATION = `
  mutation JoinTournamentByCode($inviteCode: String!, $playerId: String!) {
    joinTournamentByCode(inviteCode: $inviteCode, playerId: $playerId)
  }
`

const LEAVE_TOURNAMENT_MUTATION = `
  mutation LeaveTournament($tournamentId: String!, $playerId: String!) {
    leaveTournament(tournamentId: $tournamentId, playerId: $playerId)
  }
`

const START_TOURNAMENT_MUTATION = `
  mutation StartTournament($tournamentId: String!, $playerId: String!) {
    startTournament(tournamentId: $tournamentId, playerId: $playerId)
  }
`

const START_TOURNAMENT_MATCH_MUTATION = `
  mutation StartTournamentMatch($tournamentId: String!, $matchId: String!, $playerId: String!) {
    startTournamentMatch(tournamentId: $tournamentId, matchId: $matchId, playerId: $playerId)
  }
`

// Helper to convert GraphQL response to frontend types
function convertTournament(data: Record<string, unknown>): Tournament {
  return {
    id: data.id as string,
    name: data.name as string,
    creator: data.creator as string,
    status: data.status as TournamentStatus,
    timeControl: data.timeControl as TimeControl,
    maxPlayers: data.maxPlayers as number,
    registeredPlayers: data.registeredPlayers as string[],
    matches: (data.matches as Record<string, unknown>[])?.map(m => ({
      id: m.id as string,
      round: m.round as number,
      matchNumber: m.matchNumber as number,
      player1: m.player1 as string | undefined,
      player2: m.player2 as string | undefined,
      gameId: m.gameId as string | undefined,
      winner: m.winner as string | undefined,
      status: m.status as MatchStatus,
    })) || [],
    currentRound: data.currentRound as number,
    totalRounds: data.totalRounds as number,
    winner: data.winner as string | undefined,
    createdAt: data.createdAt as number,
    startedAt: data.startedAt as number | undefined,
    finishedAt: data.finishedAt as number | undefined,
    // New fields
    isPublic: data.isPublic as boolean ?? true,
    inviteCode: data.inviteCode as string | undefined,
    scheduledStart: data.scheduledStart as number | undefined,
    // Swiss tournament fields
    format: data.format as any ?? 'SWISS',
    participants: (data.participants as Record<string, unknown>[])?.map(p => ({
      playerId: p.playerId as string,
      score: p.score as number,
      opponents: p.opponents as string[],
      hasBye: p.hasBye as boolean,
    })) || [],
    rounds: (data.rounds as Record<string, unknown>[])?.map(r => ({
      roundNumber: r.roundNumber as number,
      matches: (r.matches as Record<string, unknown>[])?.map(m => ({
        id: m.id as string,
        round: m.round as number,
        matchNumber: m.matchNumber as number,
        player1: m.player1 as string | undefined,
        player2: m.player2 as string | undefined,
        gameId: m.gameId as string | undefined,
        winner: m.winner as string | undefined,
        status: m.status as any,
      })) || [],
      completed: r.completed as boolean,
    })) || [],
    numRounds: data.numRounds as number ?? 0,
  }
}

type TournamentStore = {
  // State
  tournaments: Tournament[]
  publicTournaments: Tournament[]
  selectedTournament: Tournament | null
  isLoading: boolean
  error: string | null

  // Fetch actions
  fetchTournaments: () => Promise<void>
  fetchPublicTournaments: () => Promise<void>
  fetchTournament: (id: string) => Promise<void>
  fetchTournamentByCode: (code: string) => Promise<Tournament | null>

  // Tournament selection
  selectTournament: (id: string | null) => void

  // Tournament actions
  createTournament: (name: string, timeControl: TimeControl, maxPlayers: number, isPublic: boolean, scheduledStart?: number) => Promise<string | null>
  joinTournament: (id: string) => Promise<boolean>
  joinTournamentByCode: (code: string) => Promise<{ tournamentId: string; tournamentName: string } | null>
  leaveTournament: (id: string) => Promise<boolean>
  startTournament: (id: string) => Promise<boolean>
  startMatch: (tournamentId: string, matchId: string) => Promise<string | null>
  forfeitMatch: (tournamentId: string, matchId: string) => Promise<boolean>
  cancelTournament: (tournamentId: string) => Promise<boolean>

  // Helpers
  clearError: () => void
  isCreator: (tournament: Tournament) => boolean
  isRegistered: (tournament: Tournament) => boolean
  getMyMatch: (tournament: Tournament) => TournamentMatch | null
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  // Initial state
  tournaments: [],
  publicTournaments: [],
  selectedTournament: null,
  isLoading: false,
  error: null,

  // Fetch player's tournaments (ones they're in or created)
  fetchTournaments: async () => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ tournaments: [], isLoading: false })
      return
    }

    set({ isLoading: true, error: null })

    try {
      const data = await requestAsync<{ tournaments: Record<string, unknown>[] }>({
        query: GET_PLAYER_TOURNAMENTS,
        variables: { playerId },
      })
      const tournaments = (data.tournaments || []).map(convertTournament)
      set({ tournaments, isLoading: false })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch tournaments'
      set({ error: message, isLoading: false })
    }
  },

  // Fetch public tournaments only
  fetchPublicTournaments: async () => {
    const { requestAsync } = useWalletStore.getState()
    set({ isLoading: true, error: null })

    try {
      const data = await requestAsync<{ publicTournaments: Record<string, unknown>[] }>({
        query: GET_PUBLIC_TOURNAMENTS,
      })
      const publicTournaments = (data.publicTournaments || []).map(convertTournament)
      set({ publicTournaments, isLoading: false })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch public tournaments'
      set({ error: message, isLoading: false })
    }
  },

  // Fetch single tournament
  fetchTournament: async (id: string) => {
    const { requestAsync } = useWalletStore.getState()
    set({ isLoading: true, error: null })

    try {
      const data = await requestAsync<{ tournament: Record<string, unknown> }>({
        query: GET_TOURNAMENT,
        variables: { id },
      })
      if (data.tournament) {
        const tournament = convertTournament(data.tournament)
        set({
          selectedTournament: tournament,
          isLoading: false,
        })
      } else {
        set({ error: 'Tournament not found', isLoading: false })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch tournament'
      set({ error: message, isLoading: false })
    }
  },

  // Fetch tournament by invite code
  fetchTournamentByCode: async (code: string) => {
    const { requestAsync } = useWalletStore.getState()
    set({ isLoading: true, error: null })

    try {
      const data = await requestAsync<{ tournamentByCode: Record<string, unknown> | null }>({
        query: GET_TOURNAMENT_BY_CODE,
        variables: { code: code.toUpperCase() },
      })
      if (data.tournamentByCode) {
        const tournament = convertTournament(data.tournamentByCode)
        set({ isLoading: false })
        return tournament
      } else {
        set({ error: 'Invalid invite code', isLoading: false })
        return null
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to find tournament'
      set({ error: message, isLoading: false })
      return null
    }
  },

  // Select a tournament
  selectTournament: (id: string | null) => {
    if (!id) {
      set({ selectedTournament: null })
      return
    }
    const tournament = get().tournaments.find(t => t.id === id) || null
    set({ selectedTournament: tournament })
    if (id && !tournament) {
      get().fetchTournament(id)
    }
  },

  // Create a new tournament
  createTournament: async (name: string, timeControl: TimeControl, maxPlayers: number, isPublic: boolean, scheduledStart?: number) => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'No player ID available', isLoading: false })
      return null
    }

    set({ isLoading: true, error: null })

    try {
      // Use inline mutation for Linera compatibility (enums must not be quoted)
      // Escape the name and playerId to handle special characters
      const escapedName = name.replace(/"/g, '\\"')
      const escapedPlayerId = playerId.replace(/"/g, '\\"')
      let mutationQuery = `mutation { createTournament(name: "${escapedName}", timeControl: ${timeControl}, maxPlayers: ${maxPlayers}, isPublic: ${isPublic}, playerId: "${escapedPlayerId}"`

      if (scheduledStart) {
        mutationQuery += `, scheduledStart: ${scheduledStart}`
      }

      mutationQuery += ') }'

      const data = await requestAsync<{ createTournament: string }>({
        query: mutationQuery,
      })
      set({ isLoading: false })
      // Refresh tournaments list
      await Promise.all([
        get().fetchTournaments(),
        get().fetchPublicTournaments()
      ])
      return data.createTournament || null
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create tournament'
      set({ error: message, isLoading: false })
      return null
    }
  },

  // Join a public tournament
  joinTournament: async (id: string) => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'No player ID available', isLoading: false })
      return false
    }

    set({ isLoading: true, error: null })

    try {
      await requestAsync<{ joinTournament: string }>({
        query: JOIN_TOURNAMENT_MUTATION,
        variables: { tournamentId: id, playerId },
      })
      set({ isLoading: false })
      // Refresh tournament
      await Promise.all([
        get().fetchTournament(id),
        get().fetchTournaments(),
        get().fetchPublicTournaments()
      ])
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to join tournament'
      set({ error: message, isLoading: false })
      return false
    }
  },

  // Join a private tournament by invite code
  joinTournamentByCode: async (code: string) => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'No player ID available', isLoading: false })
      return null
    }

    set({ isLoading: true, error: null })

    try {
      const data = await requestAsync<{ joinTournamentByCode: string }>({
        query: JOIN_TOURNAMENT_BY_CODE_MUTATION,
        variables: { inviteCode: code.toUpperCase(), playerId },
      })
      set({ isLoading: false })
      // Refresh tournaments
      await get().fetchTournaments()
      // Parse the response - it should contain tournament_id and tournament_name
      // For now, extract from the result string or use a simpler approach
      if (data.joinTournamentByCode) {
        // The response is just the tournament_id for now
        const tournamentId = data.joinTournamentByCode
        const tournament = await get().fetchTournamentByCode(code)
        return {
          tournamentId,
          tournamentName: tournament?.name || 'Tournament'
        }
      }
      return null
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to join tournament'
      set({ error: message, isLoading: false })
      return null
    }
  },

  // Leave a tournament
  leaveTournament: async (id: string) => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'No player ID available', isLoading: false })
      return false
    }

    set({ isLoading: true, error: null })

    try {
      await requestAsync<{ leaveTournament: string }>({
        query: LEAVE_TOURNAMENT_MUTATION,
        variables: { tournamentId: id, playerId },
      })
      set({ isLoading: false })
      await get().fetchTournaments()
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to leave tournament'
      set({ error: message, isLoading: false })
      return false
    }
  },

  // Start a tournament
  startTournament: async (id: string) => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'No player ID available', isLoading: false })
      return false
    }

    set({ isLoading: true, error: null })

    try {
      await requestAsync<{ startTournament: string }>({
        query: START_TOURNAMENT_MUTATION,
        variables: { tournamentId: id, playerId },
      })
      set({ isLoading: false })
      get().fetchTournament(id)
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start tournament'
      set({ error: message, isLoading: false })
      return false
    }
  },

  // Start a match in a tournament
  startMatch: async (tournamentId: string, matchId: string) => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'No player ID available', isLoading: false })
      return null
    }

    set({ isLoading: true, error: null })

    try {
      const data = await requestAsync<{ startTournamentMatch: string }>({
        query: START_TOURNAMENT_MATCH_MUTATION,
        variables: { tournamentId, matchId, playerId },
      })
      set({ isLoading: false })
      get().fetchTournament(tournamentId)
      // Return the game ID for navigation
      return data.startTournamentMatch || null
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start match'
      set({ error: message, isLoading: false })
      return null
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Check if current player is the creator
  isCreator: (tournament: Tournament) => {
    const { playerId } = useWalletStore.getState()
    return tournament.creator === playerId
  },

  // Check if current player is registered
  isRegistered: (tournament: Tournament) => {
    const { playerId } = useWalletStore.getState()
    return playerId ? tournament.registeredPlayers.includes(playerId) : false
  },

  // Get current player's active match
  getMyMatch: (tournament: Tournament) => {
    const { playerId } = useWalletStore.getState()
    if (!playerId) return null

    return tournament.matches.find(m =>
      (m.player1 === playerId || m.player2 === playerId) &&
      (m.status === MatchStatus.Ready || m.status === MatchStatus.InProgress)
    ) || null
  },

  // Forfeit a tournament match
  forfeitMatch: async (tournamentId: string, matchId: string) => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'No player ID available', isLoading: false })
      return false
    }

    set({ isLoading: true, error: null })

    try {
      const escapedTournamentId = tournamentId.replace(/"/g, '\\"')
      const escapedMatchId = matchId.replace(/"/g, '\\"')
      const escapedPlayerId = playerId.replace(/"/g, '\\"')
      const mutationQuery = `mutation { forfeitTournamentMatch(tournamentId: "${escapedTournamentId}", matchId: "${escapedMatchId}", playerId: "${escapedPlayerId}") }`

      await requestAsync({
        query: mutationQuery,
      })
      set({ isLoading: false })
      await get().fetchTournament(tournamentId)
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to forfeit match'
      set({ error: message, isLoading: false })
      return false
    }
  },

  // Cancel tournament (creator only)
  cancelTournament: async (tournamentId: string) => {
    const { requestAsync, playerId } = useWalletStore.getState()

    if (!playerId) {
      set({ error: 'No player ID available', isLoading: false })
      return false
    }

    set({ isLoading: true, error: null })

    try {
      const escapedTournamentId = tournamentId.replace(/"/g, '\\"')
      const escapedPlayerId = playerId.replace(/"/g, '\\"')
      const mutationQuery = `mutation { cancelTournament(tournamentId: "${escapedTournamentId}", playerId: "${escapedPlayerId}") }`

      await requestAsync({
        query: mutationQuery,
      })
      set({ isLoading: false })
      await get().fetchTournaments()
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to cancel tournament'
      set({ error: message, isLoading: false })
      return false
    }
  },
}))
