# Linera Checkers

A real-time multiplayer checkers game built on the Linera blockchain, featuring tournaments, matchmaking, and competitive play.

## Features

- **Multiplayer Matchmaking** - Queue-based matchmaking with time controls
- **Tournament System** - Swiss-format tournaments with automatic pairing
- **Real-time Gameplay** - Live game updates on the blockchain
- **Rating System** - Elo-based player ratings and leaderboards
- **Multiple Time Controls** - Blitz, Rapid, and Classical formats

## Live Deployment

**Testnet Conway Deployment:**
- Chain ID: `69d96ded6172de3cd2cdee86e695c8d6568f9c7486cde137f09e63c0e8462813`
- App ID: `c5f0b3ebfb12af660740b883c5261a86e242ccad97891450694a9e4659a938d6`
- Network: Linera Testnet Conway

## Tech Stack

- **Smart Contract**: Rust (Linera SDK)
- **Frontend**: Next.js 14, React, TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS 
- **Blockchain**: Linera Protocol

## Quick Start

### Prerequisites

- Rust 1.75+
- Node.js 18+
- Linera CLI

### Installation

```bash
# Clone repository
git clone https://github.com/eliotdefi/checkersLinera.git
cd checkersLinera

# Build contract
cd contracts
cargo build --release --target wasm32-unknown-unknown

# Install frontend dependencies
cd ../frontend
npm install
```

### Local Development

```bash
# Start local Linera network
linera net up --testing-prng-seed 42

# Publish contract
cd contracts
linera project publish-and-create checkers --json-parameters "null"

# Start GraphQL service
linera service --port 8081

# Start frontend (in new terminal)
cd frontend
npm run dev
```

Access at `http://localhost:3000`

### Quick Testnet Deployment (One Command)

```bash
./testnet.sh
```

This automated script will:
- Initialize testnet wallet (if needed)
- Request a chain from the faucet
- Build and deploy your contract
- Start the GraphQL service
- Configure and launch the frontend

### Manual Testnet Deployment

```bash
# Initialize wallet with testnet
linera wallet init --faucet https://faucet.testnet-conway.linera.net

# Request testnet chain
linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net

# Publish to testnet
linera project publish-and-create checkers --json-parameters "null"

# Start service
linera service --port 8081

# Configure frontend
# Update frontend/.env.local with your chain and app IDs

# Start frontend
cd frontend
npm run dev
```

## Game Features

### Matchmaking
- Queue by time control
- Automatic opponent matching
- Real-time game start notifications

### Tournaments
- Public and private tournaments
- Swiss pairing system
- Scheduled start times
- Automatic round advancement
- Invite code system

### Gameplay
- Standard checkers rules
- Mandatory captures
- King promotion
- Draw offers
- Resignation
- Time controls with increment

## Project Structure

```
checkersLinera/
├── contracts/
│   ├── checkers/          # Main game contract
│   │   └── src/
│   │       ├── contract.rs    # Game logic
│   │       ├── state.rs       # State management
│   │       └── lib.rs         # Entry point
│   └── abi/               # Shared types
│       └── src/lib.rs
└── frontend/
    ├── src/
    │   ├── app/           # Next.js pages
    │   ├── components/    # React components
    │   ├── store/         # State management
    │   └── types/         # TypeScript types
    └── public/            # Static assets
```

## Architecture

### Smart Contract
- **State Management**: On-chain game state with efficient storage
- **Matchmaking Queue**: FIFO queue with time control matching
- **Tournament Engine**: Swiss pairing with bye handling
- **Rating System**: Elo calculation with K-factor

### Frontend
- **Server Components**: Next.js 14 App Router
- **State Management**: Zustand stores for wallet, game, and tournament
- **Real-time Updates**: Polling-based game state synchronization
- **Responsive Design**: Mobile-first Tailwind CSS

## Development

### Contract Development

```bash
cd contracts
cargo test              # Run tests
cargo clippy            # Lint
cargo fmt              # Format
```

### Frontend Development

```bash
cd frontend
npm run dev            # Development server
npm run build          # Production build
npm run lint           # Lint
```

## License

MIT License - see LICENSE file for details

## Author

eliot

## Resources

- [Linera Documentation](https://linera.dev)
- [Linera Protocol](https://github.com/linera-io/linera-protocol)
- [Testnet Faucet](https://faucet.testnet-conway.linera.net)
