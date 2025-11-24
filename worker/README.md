# AI Interview Worker - Proxy Server

This worker implements a proxy server that intercepts candidate requests, fetches coding platform pages (CoderPad, HackerRank, etc.), injects AI chat overlay, and serves the modified HTML.

## How It Works

1. **Interviewer creates session** with coding platform URL
2. **Backend generates proxy URL**: `http://worker-host:3001/proxy/{sessionId}`
3. **Candidate clicks proxy URL** → Worker intercepts request
4. **Worker fetches original platform** using Playwright (handles JS rendering)
5. **Worker injects AI chat script** into HTML
6. **Worker serves modified HTML** → Candidate sees platform + AI chat overlay

## Setup

### Environment Variables

Create a `.env` file in the worker directory:

```bash
# Worker Proxy Server Configuration
WORKER_PORT=3001

# Public URL of worker (for generating candidate links)
# In production, set this to your deployed worker URL
WORKER_URL=http://localhost:3001

# Backend API URL (for chat API calls)
BACKEND_URL=http://localhost:3000

# Playwright browser settings
WORKER_HEADLESS=true
```

### Installation

```bash
npm install
npx playwright install chromium
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Architecture

- **proxy-server.ts**: Express server with `/proxy/:sessionId` endpoint
- **proxy-handler.ts**: Fetches pages using Playwright and injects chat script
- **inject-chat.ts**: Generates chat UI injection script
- **session-store.ts**: Caches session data from backend

## Deployment

### Railway / Fly.io / Render

1. Set `WORKER_URL` to your production domain
2. Set `BACKEND_URL` to your backend API URL
3. Ensure Playwright browsers are installed (usually handled automatically)
4. Deploy worker on port 3001 (or configure via `WORKER_PORT`)

### Scaling

- Each interview = 1 Playwright page instance
- Shared browser instance across requests (reused)
- ~$0.001-0.005 per interview at scale
- Auto-scales with concurrent requests

## Testing

1. Start backend: `cd ../backend && npm run dev`
2. Start worker: `npm run dev`
3. Create session via dashboard with CoderPad URL
4. Open proxy URL in browser
5. Verify AI chat overlay appears

## Troubleshooting

- **Chat doesn't appear**: Check browser console for errors, verify CORS settings
- **Page doesn't load**: Check Playwright installation, verify original URL is accessible
- **CORS errors**: Ensure backend allows requests from worker origin

