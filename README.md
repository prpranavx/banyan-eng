# AI-Powered Live Coding Interview Tool

A full-stack MVP for conducting AI-assisted technical interviews with real-time code monitoring.

## Architecture

This project consists of two independent components:

- **Frontend** (`/frontend`): React + Vite + Clerk authentication dashboard
- **Backend** (`/backend`): Express API server with OpenAI integration

## Prerequisites

- Node.js 20+
- npm or yarn
- PostgreSQL database (use Railway Postgres or local PostgreSQL)
- OpenAI API key
- Clerk account (for authentication)

## Setup

### 1. Frontend Setup

```bash
cd frontend
npm install
```

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Update `frontend/.env` with your values:
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_BACKEND_URL=http://localhost:3000
```

**Note**: The `VITE_` prefix is required for Vite to expose these variables to the frontend.

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

#### Database Setup

1. Set up PostgreSQL database (see [backend/DATABASE_SETUP.md](backend/DATABASE_SETUP.md) for Railway Postgres setup)
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Update `backend/.env` with your values:
   ```
   DATABASE_URL=postgresql://user:password@host:port/database
   OPENAI_API_KEY=your_openai_api_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   PORT=3000
   FRONTEND_URL=http://localhost:5000
   ```

#### Run Database Migration

Before starting the backend, run the database migration:

```bash
cd backend
npm run migrate
```

This creates all required database tables. The migration is idempotent (safe to run multiple times).

#### Start Backend

```bash
npm run dev
```

Backend runs on http://localhost:3000

**Note**: The backend will:
- Validate all required environment variables on startup
- Test database connection before starting
- Exit with clear error messages if configuration is missing

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

## Environment Variables

### Frontend

See `frontend/.env.example` for reference.

**Required**:
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key for authentication (get from https://dashboard.clerk.com)
- `VITE_BACKEND_URL` - Backend API URL (defaults to http://localhost:3000)

**Note**: All frontend environment variables must be prefixed with `VITE_` to be accessible in the browser.

### Backend

See `backend/.env.example` for reference.

**Required**:
- `DATABASE_URL` - PostgreSQL connection string (get from Railway Postgres or use local PostgreSQL)
- `OPENAI_API_KEY` - OpenAI API key for AI responses (get from https://platform.openai.com/api-keys)
- `CLERK_SECRET_KEY` - Clerk secret key for JWT verification (get from https://dashboard.clerk.com)

**Optional**:
- `PORT` - Server port (default: 3000)
- `FRONTEND_URL` - Frontend URL for generating candidate links (defaults to http://localhost:5000)

**Startup Validation**:
The backend validates all required environment variables on startup and exits with clear error messages if any are missing.

## Database Migration

Before running the backend for the first time, you must run the database migration:

```bash
cd backend
npm run migrate
```

This creates all required tables:
- `companies` - Company records linked to Clerk users
- `interviews` - Interview sessions with job details
- `submissions` - Candidate code submissions
- `chat_messages` - Conversation history
- `ai_analysis` - AI evaluation results

The migration is idempotent and safe to run multiple times.

## Railway deployment tips

1. Create a backend service in Railway.
2. Add PostgreSQL database service in Railway (see [backend/DATABASE_SETUP.md](backend/DATABASE_SETUP.md))
3. For the backend service:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Start command: `npm start`
   - Run migration: `npm run migrate` (one-time setup)
   - Env vars: `DATABASE_URL` (from Railway Postgres), `OPENAI_API_KEY`, `CLERK_SECRET_KEY`, `PORT=3000`, `FRONTEND_URL` (your frontend URL)
4. Frontend:
   - Deploy on Vercel with `VITE_BACKEND_URL` pointing to the Railway backend and `VITE_CLERK_PUBLISHABLE_KEY` configured.

## Technology Stack

- **Frontend**: React 18, Vite, Clerk, TailwindCSS, TypeScript, Monaco Editor, React Hot Toast
- **Backend**: Express, OpenAI API, Clerk SDK, PostgreSQL, TypeScript
- **Database**: PostgreSQL (via Railway or local)
- **Authentication**: Clerk
- **AI**: OpenAI GPT-4
- **Code Execution**: Modal.com

## Development Notes

- Frontend uses Vite for fast development
- Backend uses tsx for TypeScript development
- All components use ES modules
- TypeScript throughout for type safety

## License

MIT
