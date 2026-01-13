# Linera Checkers - Demo Guide

Step-by-step instructions to test all features.

## Setup

```bash
git clone https://github.com/eliotdefi/checkersLinera.git
cd checkersLinera
./start.sh
```

Wait for "Linera Checkers is ready!" message, then open http://localhost:3000

## Demo 1: Play vs AI

1. Click **"Play vs Computer"**
2. Select time control (e.g., 5+3 Blitz)
3. Choose your color
4. Play moves by clicking pieces
5. Observe:
   - Valid moves highlighted
   - Captures enforced (must jump if available)
   - Promotion to king at back row
   - Timer counting down

## Demo 2: Create a Game

1. Click **"Create Game"**
2. Configure:
   - Time control
   - Color preference
   - Rated/Unrated
3. Share the Game ID with opponent
4. Wait for opponent to join

## Demo 3: Matchmaking Queue

1. Click **"Quick Match"**
2. Select time control
3. Wait for opponent (simulated in single-browser by opening second tab)
4. Game starts automatically when matched

## Demo 4: Tournament

1. Click **"Tournaments"**
2. Click **"Create Tournament"**
3. Set:
   - Name
   - Time control
   - Max players (4/8/16/32)
   - Public or Private (generates invite code)
4. Share invite code for private tournaments
5. Start when players join

## Demo 5: Run Contract Tests

```bash
cd contracts
cargo test
```

Output shows 75 passing tests covering:
- Board manipulation
- Move validation
- ELO calculations
- Clock/timer logic
- Game state management
- Message serialization

## Demo 6: Two-Player Testing

Terminal 1:
```bash
./start.sh
```

Terminal 2 (optional second wallet):
```bash
linera service --port 8082 --with-wallet 1
```

Open two browser tabs to play against yourself.

## Key Features to Verify

| Feature | How to Test |
|---------|-------------|
| Move validation | Try invalid moves (blocked) |
| Mandatory captures | Must jump when available |
| King promotion | Move piece to back row |
| Timer | Watch clock count down |
| Resign | Click resign button |
| Draw offer | Click draw button |
| ELO update | Check stats after game |

## GraphQL API

Access at: http://localhost:8081

Query games:
```graphql
query {
  games {
    id
    redPlayer
    blackPlayer
    status
    currentTurn
  }
}
```

Query player stats:
```graphql
query {
  playerStats(chainId: "YOUR_CHAIN_ID") {
    gamesPlayed
    bulletRating
    blitzRating
  }
}
```

## Troubleshooting

**Port already in use:**
```bash
./stop.sh
./start.sh
```

**Contract deployment fails:**
Check `/tmp/linera_net.log` for errors.

**Frontend not loading:**
Check `/tmp/frontend.log` for errors.
