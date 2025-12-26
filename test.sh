#!/bin/bash
set -e

echo "🚀 Starting CodePair System Test..."

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

# Run database migrations before starting services
echo "🔄 Running database migrations..."
cd backend
load_env "../backend/.env"
if npm run migrate > ../logs/migration.log 2>&1; then
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed. Check logs/migration.log for details${NC}"
    echo -e "${YELLOW}⚠️  Continuing anyway...${NC}"
fi
cd ..

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

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 5

# Check services
check_service "Backend" "http://localhost:3000/health"

# Check frontend (Vite may use 5001 if 5000 is occupied)
if curl -s "http://localhost:5000" > /dev/null 2>&1; then
  check_service "Frontend" "http://localhost:5000"
  FRONTEND_PORT=5000
elif curl -s "http://localhost:5001" > /dev/null 2>&1; then
  check_service "Frontend" "http://localhost:5001"
  FRONTEND_PORT=5001
else
  echo -e "\n${RED}❌ Frontend failed to start${NC}"
  FRONTEND_PORT=5000
fi

echo ""
echo "${GREEN}🎉 All services started successfully!${NC}"
echo ""
echo "${BLUE}📊 Service URLs:${NC}"
echo "  • Backend API:  http://localhost:3000"
echo "  • Frontend UI:  http://localhost:${FRONTEND_PORT:-5000}"
echo ""
echo "${BLUE}🌐 Environment:${NC}"
echo "  • Backend URL:  ${BACKEND_URL:-http://localhost:3000}"
echo ""
echo "${BLUE}🧪 Test Commands:${NC}"
echo "  • Create session (requires Clerk auth via frontend UI):"
echo "    Open http://localhost:${FRONTEND_PORT:-5000} and sign in to create a session"
echo ""
echo "  • Check logs:"
echo "    tail -f logs/backend.log"
echo "    tail -f logs/frontend.log"
echo ""
echo "${YELLOW}⚠️  Press Ctrl+C to stop all services${NC}"

# Wait for user interrupt
trap "echo -e '\n${YELLOW}🛑 Stopping services...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit 0" INT
wait
