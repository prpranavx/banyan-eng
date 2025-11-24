# AI-Powered Live Coding Interview Tool

## Overview
Full-stack MVP for conducting AI-assisted technical interviews with real-time code monitoring.

## Project Structure
- **Frontend** (`/frontend`): React + Vite + Clerk authentication dashboard for interviewers
- **Backend** (`/backend`): Express API server with OpenAI integration
- **Worker** (`/worker`): Playwright automation for code editor monitoring

## Recent Changes (Nov 24, 2025)
- Created complete full-stack architecture with TypeScript throughout
- Set up React frontend with Clerk authentication and TailwindCSS
- Implemented Express backend with OpenAI GPT-4o-mini integration
- Built Playwright worker for browser automation
- All three components are independently deployable

## Technology Stack
- Frontend: React 18, Vite, Clerk, TailwindCSS, TypeScript
- Backend: Express, OpenAI API, TypeScript
- Worker: Playwright, TypeScript
- All using ES modules

## Deployment Architecture
This Replit is for development only. Production deployment:
- Frontend → Vercel (with VITE_CLERK_PUBLISHABLE_KEY, VITE_BACKEND_URL)
- Backend → Render (with OPENAI_API_KEY, CLERK_SECRET_KEY, PORT)
- Worker → Render (with BACKEND_URL, PLAYWRIGHT_BYPASS_CSP)

## Key Features
1. Interviewer dashboard with session management
2. Candidate interview page (no auth required)
3. AI-powered interview assistant using OpenAI
4. Real-time code monitoring via Playwright
5. Performance evaluation endpoint

## User Preferences
- Production secrets go into deployment platforms (Vercel/Render), not Replit
- Keep codebase minimal and deployable
- Use TypeScript everywhere
- Modern ES modules
