#!/bin/bash
set -e

echo "=========================================="
echo "  Linera Checkers - Starting Services"
echo "=========================================="

# Start Linera local network
echo "Starting Linera local network..."
linera net up --testing-prng-seed 37 --extra-wallets 2 &
LINERA_PID=$!

# Wait for network to be ready
sleep 10

# Deploy contracts (if not already deployed)
if [ -z "$APP_ID" ]; then
    echo "Deploying contracts..."
    cd /app/contracts

    # Find and deploy the WASM files
    APP_ID=$(linera project publish-and-create 2>&1 | grep "Application" | awk '{print $2}')
    export APP_ID
    echo "Application deployed: $APP_ID"
fi

# Start GraphQL service
echo "Starting GraphQL service..."
linera service --port 8080 &
GRAPHQL_PID=$!

# Wait for GraphQL to be ready
sleep 5

# Start frontend
echo "Starting frontend..."
cd /app/frontend
npm start &
FRONTEND_PID=$!

echo "=========================================="
echo "  Services Started Successfully!"
echo "=========================================="
echo "  GraphQL: http://localhost:8080"
echo "  Frontend: http://localhost:3000"
echo "  App ID: $APP_ID"
echo "=========================================="

# Keep container running
wait $LINERA_PID $GRAPHQL_PID $FRONTEND_PID
