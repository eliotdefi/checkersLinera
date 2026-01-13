# Linera Checkers

A real-time multiplayer checkers game built on Linera's microchain architecture. 

## Features
 
- **Real-Time Multiplayer**: Instant move synchronization via cross-chain messaging
- **ELO Rating System**: Separate ratings for Bullet, Blitz, and Rapid time controls
- **Matchmaking Queue**: Find opponents by time control preference
- **Tournament System**: Create and run Swiss-system tournaments
- **Chess Clocks**: Multiple time control options (1+0, 2+1, 3+0, 5+3, 10+0)
- **Practice Mode**: Play against AI to improve your skills

## Quick Start

### Prerequisites

- Rust 1.75+ with `wasm32-unknown-unknown` target
- Linera CLI 0.15.7+
- Node.js 20+

### Option 1: Local Setup (Recommended)

```bash
# Clone repository
git clone <repo-url>
cd checkersLinera

# Run startup script
./start.sh
```

Open http://localhost:3000

### Option 2: Docker

```bash
docker compose up
```

Open http://localhost:3000

## Architecture

This application demonstrates Linera's **Hub Chain** pattern:

- **Hub Chain**: Manages all game state, player statistics, and matchmaking
- **User Chains**: Each player has their own chain for personal data
- **Cross-Chain Messages**: Real-time game synchronization with `.with_tracking()`

```
             HUB CHAIN
         (Games + Stats)
                │
        ────────┼────────
        │       │       │
    Player  Player  Player
    Chain   Chain   Chain
```

## Tech Stack

**Backend (Linera)**
- Rust with WebAssembly compilation
- Linera SDK 0.15.7
- async-graphql for API layer

**Frontend**
- Next.js 14 with App Router
- TypeScript + TailwindCSS
- React Query for state management

## Project Structure

```
checkers/
├── contracts/
│   ├── abi/src/lib.rs          # Type definitions, ELO logic
│   └── checkers/src/
│       ├── contract.rs          # Game logic, operations
│       ├── service.rs           # GraphQL queries
│       └── state.rs             # State management
│
└── frontend/src/
    ├── app/page.tsx             # Main game UI
    ├── components/              # React components
    ├── store/game.ts            # State + GraphQL mutations
    └── types/game.ts            # TypeScript types
```

## Key Implementation Details

### State Management (contracts/checkers/src/state.rs)

- `MapView<GameId, CheckersGame>`: All active games
- `MapView<ChainId, PlayerStats>`: Player statistics & ELO
- `RegisterView<Vec<QueueEntry>>`: Matchmaking queue

### Operations (contracts/abi/src/lib.rs)

- `CreateGame`: Initialize new game with optional time control
- `JoinGame`: Join pending game or matchmaking
- `MakeMove`: Validate and execute moves with clock updates
- `Resign/ClaimTimeWin`: End game operations

### Cross-Chain Messages

Messages use `.with_tracking()` for guaranteed delivery:

```rust
destination
    .with_tracking()
    .send_message(Message::MoveMade { ... });
```

### ELO Rating System

Separate ratings per time control category (Bullet/Blitz/Rapid) with dynamic K-factor based on games played:

- < 30 games: K=32 (volatile, rapid adjustment)
- 30+ games: K=16 (stable, gradual change)

## Game Flow

1. **Player A**: CreateGame → Hub creates game
2. **Player B**: JoinGame → Hub matches players
3. **Hub**: Sends GameStarted message to both chains
4. **Player A**: MakeMove → Hub validates → sends MoveMade to Player B
5. **Frontend**: Polls every 2s for updates

## Testing

```bash
# Contract tests
cd contracts
cargo test

# Frontend (local)
cd frontend
npm run dev
```

### Multi-Player Testing

```bash
# Terminal 1: Player 1
linera service --port 8081

# Terminal 2: Player 2
linera service --port 8082 --with-wallet 1

# Open two browser tabs pointing to different ports
```

## Performance

- Move latency: ~200-500ms (local), ~1-3s (network)
- Polling interval: 2 seconds
- Concurrent games: Unlimited (microchain parallelism)

## Security

- Turn validation: Contract enforces player turns
- Move validation: Full checkers rules enforced on-chain
- Timeout handling: Auto-resignation on time expiry
- Rating integrity: ELO calculated in contract, not frontend

## License

MIT

## Links

- [Linera Documentation](https://linera.dev)
- [Linera SDK](https://github.com/linera-io/linera-protocol)

---

Built for the Linera Buildathon 2025
