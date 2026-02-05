#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE} Linera Checkers - Testnet Deploy${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Testnet configuration
FAUCET_URL="https://faucet.testnet-conway.linera.net"

# 0. Kill any existing Linera processes first (to avoid wallet lock)
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
pkill -9 -f "linera service" 2>/dev/null || true
pkill -9 -f "linera net" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# 1. Check if wallet exists (check Linux, macOS, and Windows locations)
WALLET_LINUX="$HOME/.config/linera/wallet.json"
WALLET_MACOS="$HOME/Library/Application Support/linera/wallet.json"
WALLET_WINDOWS="$APPDATA/linera/wallet.json"

if [ -f "$WALLET_LINUX" ] || [ -f "$WALLET_MACOS" ] || [ -f "$WALLET_WINDOWS" ]; then
    echo -e "${GREEN}✓ Wallet already exists${NC}"
else
    echo -e "${YELLOW}Initializing testnet wallet...${NC}"
    linera wallet init --faucet $FAUCET_URL
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to initialize wallet${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Wallet initialized${NC}"
fi

# 2. Check if we have chains, request one if not
CHAIN_COUNT=$(linera wallet show 2>/dev/null | grep "Public Key" | wc -l)
if [ "$CHAIN_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}Requesting testnet chain from faucet...${NC}"
    linera wallet request-chain --faucet $FAUCET_URL
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to request chain${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Chain received from faucet${NC}"
else
    echo -e "${GREEN}✓ Wallet has $CHAIN_COUNT chain(s)${NC}"
fi

# 3. Build contract
echo -e "${YELLOW}Building contract...${NC}"
cd "$SCRIPT_DIR/contracts"
cargo build --release --target wasm32-unknown-unknown
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Contract build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Contract built${NC}"

# 4. Deploy to testnet
echo -e "${YELLOW}Deploying to testnet...${NC}"
cd "$SCRIPT_DIR/contracts/checkers"
DEPLOY_OUTPUT=$(linera project publish-and-create --json-parameters "null" 2>&1)

# Extract App ID and Chain ID
APP_ID=$(echo "$DEPLOY_OUTPUT" | grep -E "^[a-f0-9]{64}$" | tail -1)
CHAIN_ID=$(echo "$DEPLOY_OUTPUT" | grep "Creating application on chain" | awk '{print $NF}')

if [ -z "$APP_ID" ] || [ -z "$CHAIN_ID" ]; then
    echo -e "${RED}✗ Deployment failed${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✓ Contract deployed to testnet${NC}"
echo ""
echo -e "${BLUE}Chain ID:${NC} $CHAIN_ID"
echo -e "${BLUE}App ID:${NC}   $APP_ID"
echo ""

# 5. Final check - kill any lingering services before starting new ones
pkill -9 -f "linera service" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

# 6. Update frontend .env.local for testnet
cat > "$SCRIPT_DIR/frontend/.env.local" << EOF
NEXT_PUBLIC_DEFAULT_CHAIN_ID=$CHAIN_ID
NEXT_PUBLIC_APP_ID=$APP_ID
NEXT_PUBLIC_LINERA_GRAPHQL_URL=http://localhost:8081
EOF
echo -e "${GREEN}✓ Frontend config updated${NC}"

# 7. Start GraphQL service
echo -e "${YELLOW}Starting GraphQL service...${NC}"
cd "$SCRIPT_DIR"
linera service --port 8081 > /tmp/linera_testnet_service.log 2>&1 &
sleep 3
echo -e "${GREEN}✓ GraphQL service running on port 8081${NC}"

# 8. Install frontend dependencies if needed
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install > /tmp/npm_install.log 2>&1
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# 9. Start frontend
echo -e "${YELLOW}Starting frontend...${NC}"
npm run dev > /tmp/frontend_testnet.log 2>&1 &
sleep 5
echo -e "${GREEN}✓ Frontend running on port 3000${NC}"

# 10. Success message
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Testnet Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Frontend:${NC}  http://localhost:3000"
echo -e "${BLUE}GraphQL:${NC}   http://localhost:8081"
echo ""
echo -e "${BLUE}Chain ID:${NC}  $CHAIN_ID"
echo -e "${BLUE}App ID:${NC}    $APP_ID"
echo ""
echo -e "${YELLOW}Network:${NC}   Linera Testnet Conway"
echo ""
echo "Press Ctrl+C to stop services or run: ./stop.sh"
echo ""

# Open browser
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || echo "Open http://localhost:3000 in your browser"

wait
