# Linera Checkers - Architecture

## Overview

Linera Checkers demonstrates the **Hub Chain Pattern** for multiplayer games on Linera's microchain architecture.

## Chain Topology

```
                    ┌─────────────────────────────────────┐
                    │           HUB CHAIN                 │
                    │  ┌─────────────────────────────┐    │
                    │  │      CheckersState          │    │
                    │  │  ├─ games: MapView          │    │
                    │  │  ├─ player_stats: MapView   │    │
                    │  │  ├─ queue: RegisterView     │    │
                    │  │  └─ tournaments: MapView    │    │
                    │  └─────────────────────────────┘    │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
     ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
     │  Player A   │      │  Player B   │      │  Player C   │
     │   Chain     │      │   Chain     │      │   Chain     │
     └─────────────┘      └─────────────┘      └─────────────┘
```

## Message Flow: Game Creation

```
┌──────────┐                    ┌──────────┐
│ Player A │                    │   Hub    │
└────┬─────┘                    └────┬─────┘
     │                               │
     │  Operation::CreateGame        │
     │──────────────────────────────>│
     │                               │
     │                               │ Store game in MapView
     │                               │ Status: Pending
     │                               │
     │  OperationResult::GameCreated │
     │<──────────────────────────────│
     │                               │
```

## Message Flow: Game Join

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│ Player A │                    │   Hub    │                    │ Player B │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                               │
     │                               │  Operation::JoinGame          │
     │                               │<──────────────────────────────│
     │                               │                               │
     │                               │ Update game                   │
     │                               │ Status: Active                │
     │                               │                               │
     │  Message::GameStarted         │  Message::GameStarted         │
     │<──────────────────────────────│──────────────────────────────>│
     │  .with_tracking()             │  .with_tracking()             │
```

## Message Flow: Move Made

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│ Player A │                    │   Hub    │                    │ Player B │
│  (Red)   │                    │          │                    │ (Black)  │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                               │
     │  Operation::MakeMove          │                               │
     │  (2,1) -> (3,2)               │                               │
     │──────────────────────────────>│                               │
     │                               │                               │
     │                               │ 1. Validate move              │
     │                               │ 2. Update board               │
     │                               │ 3. Check captures             │
     │                               │ 4. Check promotion            │
     │                               │ 5. Update clock               │
     │                               │ 6. Switch turn                │
     │                               │                               │
     │  OperationResult::MoveMade    │  Message::MoveMade            │
     │<──────────────────────────────│──────────────────────────────>│
     │                               │  .with_tracking()             │
```

## State Structure

### CheckersState (state.rs)

```rust
pub struct CheckersState {
    pub games: MapView<String, CheckersGame>,
    pub player_stats: MapView<String, PlayerStats>,
    pub queue: RegisterView<Vec<QueueEntry>>,
    pub tournaments: MapView<String, Tournament>,
    pub invite_codes: MapView<String, String>,
    pub next_game_id: RegisterView<u64>,
    pub next_tournament_id: RegisterView<u64>,
}
```

### CheckersGame

```rust
pub struct CheckersGame {
    pub id: String,
    pub red_player: Option<String>,
    pub black_player: Option<String>,
    pub board_state: String,        // FEN-like notation
    pub current_turn: Turn,
    pub status: GameStatus,
    pub clock: Option<Clock>,
    pub moves: Vec<CheckersMove>,
    pub tournament_id: Option<String>,
}
```

## Board Representation

8x8 board using FEN-like string notation:

```
" r r r r/r r r r / r r r r/        /        /b b b b / b b b b/b b b b "
```

- `r` = Red piece
- `b` = Black piece
- `R` = Red king
- `B` = Black king
- ` ` = Empty square
- `/` = Row separator

## Move Validation

```
validate_and_execute_move()
    │
    ├─ is_valid_square(from, to)?
    │
    ├─ get_piece(from) matches current_turn?
    │
    ├─ destination empty?
    │
    ├─ diagonal movement?
    │
    ├─ Simple move (distance = 1)?
    │   ├─ Direction valid for piece type?
    │   └─ No captures available? (must capture if possible)
    │
    └─ Capture move (distance = 2)?
        ├─ Enemy piece in middle?
        ├─ Direction valid?
        ├─ Remove captured piece
        └─ Check for chain jumps
```

## ELO Rating System

```
K-factor:
  - New player (< 30 games): K = 32
  - Experienced (≥ 30 games): K = 16

Expected score:
  E = 1 / (1 + 10^((opponent_rating - my_rating) / 400))

Rating change:
  ΔR = K × (actual_score - expected_score)

Rating bounds: [100, 3000]
```

Separate ratings maintained for:
- Bullet (1+0, 2+1)
- Blitz (3+0, 5+3)
- Rapid (10+0)

## Clock Implementation

```rust
pub struct Clock {
    pub initial_time_ms: u64,
    pub increment_ms: u64,
    pub red_time_ms: u64,
    pub black_time_ms: u64,
    pub last_move_at: u64,
    pub active_player: Option<Turn>,
}
```

Time deduction on move:
```
new_time = old_time - elapsed + increment
```

## Tournament Bracket

Single-elimination with seeding:

```
Round 1          Round 2          Final
────────         ────────         ─────
Seed 1 ─┐
        ├─ Winner ─┐
Seed 8 ─┘         │
                  ├─ Winner ─── Champion
Seed 4 ─┐         │
        ├─ Winner ─┘
Seed 5 ─┘
```

Bye handling: Players with no opponent auto-advance.

## Cross-Chain Messaging

All messages use `.with_tracking()` for guaranteed delivery:

```rust
self.runtime
    .prepare_message(Message::MoveMade { ... })
    .with_tracking()
    .send_to(opponent_chain_id);
```

## Frontend Polling

React frontend polls hub chain every 2 seconds:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    refetchGame();
  }, 2000);
  return () => clearInterval(interval);
}, []);
```

## Security Model

| Check | Location | Description |
|-------|----------|-------------|
| Turn validation | Contract | Only current player can move |
| Move validation | Contract | Full checkers rules enforced |
| Time validation | Contract | Clock checked before each move |
| Rating integrity | Contract | ELO calculated on-chain |

## File Structure

```
contracts/
├── abi/src/lib.rs          # Types, ELO, board utilities
│                           # 75 unit tests
└── checkers/src/
    ├── contract.rs         # Operations, message handlers
    │                       # Move validation, AI logic
    ├── service.rs          # GraphQL queries
    └── state.rs            # Linera views, persistence

frontend/src/
├── app/page.tsx            # Main game UI
├── components/
│   ├── CheckersBoard.tsx   # Game board rendering
│   ├── Timer.tsx           # Clock display
│   └── GameControls.tsx    # Move/resign/draw buttons
├── store/game.ts           # Zustand state + GraphQL
└── types/game.ts           # TypeScript types
```
