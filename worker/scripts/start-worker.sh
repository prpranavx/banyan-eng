#!/bin/bash
set -euo pipefail

echo "[worker] Installing Playwright system dependencies..."
npx playwright install-deps chromium

echo "[worker] Ensuring Playwright browsers are installed..."
npx playwright install chromium

echo "[worker] Starting worker server..."
node dist/index.js

