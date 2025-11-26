#!/bin/bash
set -e

echo "🚀 Starting AI Interview System Test..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is responding
check_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    echo -n "⏳ Waiting for $service..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "\n${GREEN}✅ $service is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo -e "\n${RED}❌ $service failed to start after ${max_attempts} attempts${NC}"
    return 1
}

# Function to load .env file
load_env() {
    local env_file=$1
    if [ -f "$env_file" ]; then
        echo "${BLUE}📄 Loading environment from $env_file${NC}"
        set -a
        source "$env_file"
        set +a
    else
        echo "${YELLOW}⚠️  Warning: $env_file not found${NC}"
    fi
}

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "npm run dev" || true
pkill -f "node.*index.ts" || true
pkill -f "vite" || true
sleep 3

# Create logs directory
mkdir -p logs

# Start services in background with proper environment variables
echo "🔨 Starting Backend..."
cd backend
load_env "../backend/.env"
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "🎨 Starting Frontend..."
cd frontend
load_env "../frontend/.env"
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "🤖 Starting Worker..."
cd worker
load_env "../worker/.env"
npm run dev > ../logs/worker.log 2>&1 &
WORKER_PID=$!
cd ..

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 5

# Check services
check_service "Backend" "http://localhost:3000/health"
check_service "Frontend" "http://localhost:5001" # Vite might change port
check_service "Worker" "http://localhost:3001/health"

echo ""
echo "${GREEN}🎉 All services started successfully!${NC}"
echo ""
echo "${BLUE}📊 Service URLs:${NC}"
echo "  • Backend API:  http://localhost:3000"
echo "  • Frontend UI:  http://localhost:5001"
echo "  • Worker Proxy: http://localhost:3001"
echo ""
echo "${BLUE}🌐 Environment:${NC}"
echo "  • Worker URL:   ${WORKER_URL:-http://localhost:3001}"
echo "  • Backend URL:  ${BACKEND_URL:-http://localhost:3000}"
echo "  • Allowed Origins: ${ALLOWED_ORIGINS:-*}"
echo ""
echo "${BLUE}🧪 Test Commands:${NC}"
echo "  • Create session:"
echo "    curl -X POST http://localhost:3000/api/generate-session \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"codingPlatformUrl\":\"https://app.coderpad.io/sandbox\"}'"
echo ""
echo "  • Check logs:"
echo "    tail -f logs/backend.log"
echo "    tail -f logs/frontend.log"
echo "    tail -f logs/worker.log"
echo ""
echo "  • Full test:"
echo "    ./test-interview.sh"
echo ""
echo "${YELLOW}⚠️  Press Ctrl+C to stop all services${NC}"

# Wait for user interrupt
trap "echo -e '\n${YELLOW}🛑 Stopping services...${NC}'; kill $BACKEND_PID $FRONTEND_PID $WORKER_PID 2>/dev/null || true; exit 0" INT
wait
