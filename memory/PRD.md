# Nuro · Living Learning Ecosystem — PRD

## Original Problem Statement
User uploaded `HACKATHON_Ide Pertama Guwe.docx` describing a "Living Learning Ecosystem" — an AI-powered, personalized learning platform paired with a contextual browser extension. The user requested: dashboard + Chrome extension, all 4 AI features (curriculum, RAG chat, adaptive quiz, focus nudge), Claude Sonnet 4.5 via Emergent Universal LLM Key, Google + email/password auth. A Videmy-inspired UI design reference (clean white, yellow accent, dark pill buttons) was provided in iteration 2.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor). `/app/backend/server.py` exposes all `/api/*` routes.
- **Frontend**: React 19 + React Router + Tailwind. `/app/frontend/src/` with pages, components, hooks.
- **LLM**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `emergentintegrations` library + `EMERGENT_LLM_KEY`.
- **RAG**: Simple in-process TF-style keyword retrieval over MongoDB-stored chunks; top-k passed in Claude system prompt.
- **Auth**: DB-backed `session_token` (Bearer). Two flows produce same token: email/password (bcrypt) and Emergent Google OAuth (session_id exchange).
- **Chrome Extension**: Manifest V3 in `/app/chrome-extension/` — vanilla JS popup + service worker for focus events.

## User Personas
- Self-directed students (middle school → undergrad) preparing for exams from their own materials.
- Hackathon demo audience evaluating end-to-end depth.

## Core Requirements
- Multi-subject workspace with materials ingestion (PDF/text)
- AI study chat grounded in user's materials (streaming SSE)
- AI curriculum generator (goal + weeks + hours → weekly plan + topic seeds)
- Adaptive quiz generator with mastery tracking
- Mastery map visualization (per-topic proficiency 0-100)
- Dashboard with stats + 14-day study heatmap + streak
- Chrome extension: active subject picker + focus toggle + mini RAG chat
- Clean, modern Videmy-inspired design (white + yellow accent + dark CTA)

## What's Implemented (2026-01)
- ✅ Email/password auth (register, login, /me, logout) + Emergent Google OAuth session exchange
- ✅ Subjects full CRUD with cascade delete
- ✅ Materials: text paste + file upload (PDF via pypdf, txt/md), chunking, indexing
- ✅ Streaming RAG chat with source citations (SSE: `sources`, `session`, `delta`, `done`)
- ✅ Chat history persistence per subject/session
- ✅ Curriculum generator (Claude → strict JSON plan, seeds mastery topics)
- ✅ Adaptive quiz generator (picks weakest topic, 4-option MCQ, no answer leak)
- ✅ Quiz answer + mastery update (proficiency computed from correct/attempts)
- ✅ Dashboard summary endpoint (subjects, quizzes, accuracy, streak, heatmap, overall mastery)
- ✅ Focus events endpoint + stats (for extension)
- ✅ Frontend: Landing, Login, Register, AuthCallback, Dashboard, Subjects list, Subject detail (5 tabs), Extension preview
- ✅ Chrome extension (Manifest V3): popup, background service worker, focus tab tracking, icons
- ✅ Videmy-style redesign: Bricolage Grotesque + Plus Jakarta Sans, yellow #E4F222 accent, dark pill buttons, clean white surfaces, soft blue gradient hero

## Known Issues / Backlog
- P1 — Frontend Playwright e2e test not yet run (only landing + login + dashboard smoke-tested manually)
- P2 — `requests.get` in `/auth/google/session` is blocking (should be `httpx.AsyncClient`)
- P2 — `server.py` is one large file; could be split into routers
- P2 — Quiz `correct_index` is not bounds-checked
- P3 — No vector store (keyword retrieval only) — fine for hackathon

## Next Tasks
- Run testing agent on the redesigned frontend (e2e: register → create subject → upload material → chat → curriculum → quiz → mastery)
- Add password reset flow
- Add streak gamification badges
- Consider replacing keyword retrieval with sentence-transformers embeddings for better RAG

## Tech Stack
React 19, React Router 7, Tailwind 3, lucide-react, sonner (toasts), framer-motion (available), axios, FastAPI 0.110, Motor (MongoDB async), pypdf, emergentintegrations, bcrypt, PyJWT.

## Key Files
- `/app/backend/server.py` — all API endpoints
- `/app/frontend/src/index.css` — design tokens (CSS vars, btn classes, card, icon-square, etc.)
- `/app/frontend/src/lib/auth.jsx` — AuthProvider
- `/app/frontend/src/pages/*` — page components
- `/app/chrome-extension/` — Chrome MV3 extension source
