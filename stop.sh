#!/bin/bash

GREEN='\033[0;32m'
NC='\033[0m'

echo "Stopping Linera Checkers..."

pkill -9 -f linera 2>/dev/null
pkill -f "next dev" 2>/dev/null

sleep 1

echo -e "${GREEN}✓ All services stopped${NC}"
