# AI-Powered Live Coding Interview Tool

A full-stack MVP for conducting AI-assisted technical interviews with real-time code monitoring.

## Architecture

This project consists of three independent components:

- **Frontend** (`/frontend`): React + Vite + Clerk authentication dashboard
- **Backend** (`/backend`): Express API server with OpenAI integration
- **Worker** (`/worker`): Playwright automation for code editor monitoring

## Prerequisites

- Node.js 20+
- npm or yarn
- OpenAI API key
- Clerk account (for authentication)

## Setup

### 1. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_BACKEND_URL=http://localhost:3000
```

Run the frontend:
```bash
npm run dev
```

Frontend runs on http://localhost:5000

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:
```
OPENAI_API_KEY=your_openai_api_key
CLERK_SECRET_KEY=your_clerk_secret_key
PORT=3000
```

Run the backend:
```bash
npm run dev
```

Backend runs on http://localhost:3000

### 3. Worker Setup

```bash
cd worker
npm install # automatically installs Playwright browsers
```

Create `worker/.env`:
```
BACKEND_URL=http://localhost:3000
WORKER_URL=http://localhost:3001
ALLOWED_ORIGINS=*
WORKER_HEADLESS=false
PLAYWRIGHT_BYPASS_CSP=true
```

Run the worker:
```bash
npm run dev
```

> For CoderPad/HackerRank (HTTPS origins), deploy the worker behind HTTPS (Railway, Render, Fly, etc.). Set `WORKER_URL` to that public HTTPS URL, tighten `ALLOWED_ORIGINS` (comma-separated list), and set `WORKER_HEADLESS=true` so Playwright can run in container environments.

## Features

### Interviewer Dashboard
- Create new interview sessions
- Generate shareable candidate links
- View active and past interviews
- Clerk authentication for security

### Candidate Interview Page
- Clean chat interface
- Real-time AI interviewer responses
- No authentication required for candidates
- Session-based tracking

### Backend API
- `POST /api/generate-session` - Create new interview session
- `POST /api/send-message` - Send message and get AI response
- `POST /api/evaluate` - Generate performance evaluation
- `GET /api/sessions/:sessionId` - Get session details

### Worker (Automation)
- Launches browser automation
- Injects floating chat box into coding platforms
- Captures code snapshots every 2 seconds
- Syncs with backend AI responses

## Deployment

Each component can be deployed independently:

### Frontend
```bash
cd frontend
npm run build
# Deploy dist/ folder to your hosting service
```

### Backend
```bash
cd backend
npm run build
npm start
# Deploy to Node.js hosting (Replit, Railway, Render, etc.)
```

### Worker
```bash
cd worker
npm run build
npm start
# Deploy to Node.js hosting with Playwright support
```

## Environment Variables

### Frontend
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key for authentication
- `VITE_BACKEND_URL` - Backend API URL

### Backend
- `OPENAI_API_KEY` - OpenAI API key for AI responses
- `CLERK_SECRET_KEY` - Clerk secret key for JWT verification
- `PORT` - Server port (default: 3000)

### Worker
- `BACKEND_URL` - Backend API URL for syncing
- `WORKER_URL` - Public HTTPS origin that hosts `/proxy/:sessionId`
- `ALLOWED_ORIGINS` - Comma-separated list of allowed browser origins (default `*`)
- `WORKER_HEADLESS` - `true` in hosted environments (set `false` for local interactive debugging)
- `WORKER_CHROMIUM_ARGS` - Optional comma-separated list of extra Chromium launch flags
- `PLAYWRIGHT_BYPASS_CSP` - Enable CSP bypass (set to "true")

## Railway deployment tips

1. Create two services (backend + worker) in the same Railway project.
2. For the worker service:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Start command: `npm start`
   - `npm install` automatically runs the Playwright installer (with Linux deps when available).
   - Env vars: `BACKEND_URL=https://<backend>.railway.app`, `WORKER_URL=https://<worker>.railway.app`, `WORKER_HEADLESS=true`, `ALLOWED_ORIGINS=https://app.coderpad.io`.
3. For the backend service:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Start command: `npm start`
   - Env vars: `OPENAI_API_KEY`, `CLERK_SECRET_KEY`, `PORT=3000`, `WORKER_URL=https://<worker>.railway.app`.
4. Frontend:
   - Deploy on Vercel with `VITE_BACKEND_URL` pointing to the Railway backend and `VITE_CLERK_PUBLISHABLE_KEY` configured.

## Technology Stack

- **Frontend**: React 18, Vite, Clerk, TailwindCSS, TypeScript
- **Backend**: Express, OpenAI API, Clerk SDK, TypeScript
- **Worker**: Playwright, TypeScript
- **Authentication**: Clerk
- **AI**: OpenAI GPT-4

## Development Notes

- Frontend uses Vite for fast development
- Backend uses tsx for TypeScript development
- Worker uses Playwright for browser automation
- All components use ES modules
- TypeScript throughout for type safety

## License

MIT
