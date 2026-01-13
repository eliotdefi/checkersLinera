# Linera Checkers - Quick Start

Real-time multiplayer checkers on Linera's microchain architecture.

## One-Command Setup

```bash
./start.sh
```

Then open **http://localhost:3000**

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | nightly | `rustup default nightly` |
| Linera CLI | 0.15.7+ | `cargo install linera-service@0.15.7` |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |

## What start.sh Does

1. Starts local Linera network
2. Compiles and deploys smart contract
3. Installs frontend dependencies
4. Launches frontend at port 3000
5. Opens browser automatically

## Alternative: Docker

```bash
docker compose up --build
```

## Run Tests

```bash
cd contracts
cargo test
```

Expected: **75 tests passing**

## Stop Services

```bash
./stop.sh
```

## Project Structure

```
├── contracts/          # Rust smart contracts
│   ├── abi/           # Types, ELO logic
│   └── checkers/      # Game logic
├── frontend/          # Next.js UI
├── start.sh           # One-command setup
└── docker-compose.yml # Docker setup
```

## Features

- Real-time multiplayer via cross-chain messages
- ELO rating system (Bullet/Blitz/Rapid)
- Matchmaking queue
- Tournament brackets
- Practice mode vs AI

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical design
- [RUN_DEMO.md](./RUN_DEMO.md) - Step-by-step demo
- [README.md](./README.md) - Full documentation
