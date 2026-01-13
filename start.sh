#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${YELLOW}Starting Linera Checkers...${NC}"

# 1. Kill existing processes
echo "Cleaning up old processes..."
pkill -9 -f linera 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2

# 2. Start Linera network
echo "Starting Linera network..."
cd "$SCRIPT_DIR/contracts"
linera net up --testing-prng-seed 37 > /tmp/linera_net.log 2>&1 &

# Wait for network (with timeout)
READY=false
for i in {1..30}; do
    if grep -q "READY" /tmp/linera_net.log 2>/dev/null; then
        READY=true
        echo -e "${GREEN}✓ Network ready${NC}"
        break
    fi
    sleep 1
done

if [ "$READY" = false ]; then
    echo -e "${RED}✗ Network failed to start. Check /tmp/linera_net.log${NC}"
    exit 1
fi

# 3. Extract and source environment variables
eval $(grep "export LINERA_WALLET" /tmp/linera_net.log)
eval $(grep "export LINERA_KEYSTORE" /tmp/linera_net.log)
eval $(grep "export LINERA_STORAGE" /tmp/linera_net.log)

# 4. Deploy contract
echo "Deploying contract..."
cd "$SCRIPT_DIR/contracts/checkers"
DEPLOY_OUTPUT=$(linera project publish-and-create 2>&1)
APP_ID=$(echo "$DEPLOY_OUTPUT" | grep -E "^[a-f0-9]{64}$" | tail -1)
CHAIN_ID=$(echo "$DEPLOY_OUTPUT" | grep "Creating application on chain" | awk '{print $NF}')

if [ -z "$APP_ID" ] || [ -z "$CHAIN_ID" ]; then
    echo -e "${RED}✗ Contract deployment failed${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✓ Contract deployed${NC}"

# 5. Update .env.local
cat > "$SCRIPT_DIR/frontend/.env.local" << EOF
NEXT_PUBLIC_DEFAULT_CHAIN_ID=$CHAIN_ID
NEXT_PUBLIC_APP_ID=$APP_ID
NEXT_PUBLIC_LINERA_GRAPHQL_URL=http://localhost:8081
EOF
echo -e "${GREEN}✓ Config updated${NC}"

# 6. Start Linera service
echo "Starting Linera service..."
linera service --port 8081 > /tmp/linera_service.log 2>&1 &
sleep 3
echo -e "${GREEN}✓ Linera service on port 8081${NC}"

# 7. Start frontend
echo "Starting frontend..."
cd "$SCRIPT_DIR/frontend"
echo "Installing frontend dependencies..."
npm install > /tmp/npm_install.log 2>&1
echo -e "${GREEN}✓ Dependencies installed${NC}"
npm run dev > /tmp/frontend.log 2>&1 &
sleep 5
echo -e "${GREEN}✓ Frontend on port 3000${NC}"

# 8. Open browser
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Linera Checkers is ready!${NC}"
echo -e "${GREEN}  http://localhost:3000${NC}"
echo -e "${GREEN}========================================${NC}"
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || echo "Open http://localhost:3000 in your browser"

echo ""
echo "Press Ctrl+C to stop all services"
echo "Or run: ./stop.sh"
wait
