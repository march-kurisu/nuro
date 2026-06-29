# Nuro · Living Learning Ecosystem — PRD

## Original Problem Statement
User uploaded `HACKATHON_Ide Pertama Guwe.docx` describing a "Living Learning Ecosystem" — an AI-powered, personalized learning platform paired with a Chrome extension. User chose: dashboard + extension, all 4 AI features, Claude Sonnet 4.5 via Emergent Universal Key, Google + email/password auth, Videmy-inspired UI (white/yellow). Iteration 3 feedback: fix markdown in chat, calendar view for curriculum, force structured learning order, fix extension download.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor). `/app/backend/server.py`
- **Frontend**: React 19 + React Router + Tailwind. `/app/frontend/src/`
- **LLM**: Claude Sonnet 4.5 via `emergentintegrations` + `EMERGENT_LLM_KEY`
- **RAG**: Keyword TF retrieval over chunked materials, top-k passed in Claude system prompt
- **Auth**: DB session_token (Bearer). Email/pass (bcrypt) + Emergent Google OAuth
- **Chrome Extension**: MV3 in `/app/chrome-extension/`, downloadable as .zip via `/api/extension/download`

## Core Requirements
- Multi-subject workspace + materials ingestion (PDF/text)
- AI study chat grounded in materials, streaming SSE, **markdown rendered**
- AI curriculum on a **full calendar** (date-aware tasks with time slots + AI-suggested schedule)
- Adaptive quiz generator with mastery tracking
- **Structured learning path**: diagnostic survey → ordered modules (foundation → intermediate → advanced) with **forced progression** (70% to unlock next)
- Dashboard with stats + heatmap + streak
- Chrome extension with focus mode + mini RAG chat
- Clean Videmy-inspired design

## What's Implemented (current state, 2026-01)

### Iteration 1 (Backend + Frontend baseline)
- Email/password + Emergent Google OAuth
- Subjects CRUD with cascade
- Materials: text paste + PDF upload + chunking
- Streaming RAG chat (SSE with sources)
- Curriculum generator
- Adaptive quiz + mastery
- Dashboard summary + heatmap
- Focus events for extension
- Chrome extension (popup + service worker)

### Iteration 2 (Videmy UI redesign)
- Bricolage Grotesque + Plus Jakarta Sans
- Yellow (#E4F222) accent, white surfaces, dark pill CTAs
- All pages rebuilt: Landing, Auth, Dashboard, Subjects, Subject Detail, Extension preview
- Fixed register bug (`_id` not JSON serializable)

### Iteration 4 (Polish: buffering, in-app modals, visualize, longer module quizzes, more colors)
- **Quiz buffering** — Both free Quiz and Module Quiz panels now show animated skeleton (Loader2 spinner + pulsing option placeholders) while waiting for Claude to generate the next question
- **In-app modals replace browser popups** — New `/components/Modal.jsx` with `Modal`, `ConfirmModal`, `CopyableModal`. All `confirm()`, `alert()`, `prompt()` calls replaced:
  - SubjectsPage delete → ConfirmModal with danger style
  - MaterialsTab delete → ConfirmModal
  - PathTab restart → ConfirmModal
  - ExtensionPreviewPage copy → toast on success, CopyableModal fallback when clipboard API blocked
- **AI image generation in chat** (Gemini Nano Banana via `gemini-3.1-flash-image-preview`):
  - New `POST /api/visualize` endpoint accepts `{prompt, subject}` returns `{image_b64, mime_type, caption}`
  - Each assistant message now has a "Visualize" button (only shown for AI replies)
  - Click → loader appears in the button → returned image renders inline in the bubble with caption
  - Tested: Newton's Laws → produced a labeled diagram with car illustration showing unbalanced force vectors
- **Longer module check questions** — TARGET_Q increased 3 → 6, added `deep=true` flag to quiz generator that produces scenario-based 2-3 sentence questions with complete-statement options and 2-3 sentence explanations. Module quiz panel now shows progress bar (0/6) and inline buffering skeleton between questions.
- **More subject colors** — 12 options now: yellow, mint, peach, sky, rose, violet, teal, lemon, blush, ocean, lavender, sand

### Iteration 3 (Structure + Calendar + Markdown + Extension download)
- **Chat markdown**: `react-markdown` + `remark-gfm` renders headings, bold, italic, lists, code, blockquotes (no more `***` showing)
- **Structured Learning Path** (PRIMARY tab):
  - Onboarding survey modal (3 steps: goal → current level → weak areas)
  - Claude generates 5-9 ordered modules (foundation → intermediate → advanced)
  - First module unlocked; others locked
  - Inline quiz panel per module (3 questions, 70% to pass)
  - Pass → next module auto-unlocks
  - Other tabs (Chat, Calendar, Free Quiz, Mastery) DISABLED until survey complete
  - "Restart survey" option
- **Calendar view** (Curriculum tab renamed → "Calendar"):
  - Start date + weeks + hours/week + daily time + day-of-week selector
  - Target deadline input
  - **AI Suggest** button: Claude picks start_date, days, time based on goal+deadline
  - Month grid calendar showing dated tasks with time stamps
  - Click event to toggle done (strike-through)
  - "Today & upcoming" panel below
  - Previous/Next month navigation
- **Chrome extension download** (`GET /api/extension/download` → .zip):
  - Extension preview page now has "Download .zip" + "Copy token" + "Copy backend URL" buttons
  - User-friendly install instructions
- New backend endpoints:
  - `POST /api/subjects/{id}/onboard` (survey → modules)
  - `GET /api/subjects/{id}/modules`
  - `POST /api/modules/{id}/complete` (score → unlock next if ≥70)
  - `POST /api/subjects/{id}/curriculum/suggest` (AI schedule suggest)
  - `POST /api/subjects/{id}/curriculum/event` (toggle done)
  - `GET /api/extension/download` (zip)

## Known Issues / Backlog
- P2 — `requests.get` in `/auth/google/session` blocks event loop (use httpx.AsyncClient)
- P2 — `server.py` is large (~1100 lines); could split into routers
- P3 — No vector embeddings (keyword retrieval only)
- P3 — Module quiz panel runs free-form quizzes (not strictly tied to module objectives — though `topic_hint` passes module title)

## Next Tasks
- Run testing agent on the full new flow (onboarding → modules → calendar → markdown chat → extension download)
- Add module-specific learning resources view (show relevant material chunks per module)
- Optional: gamification badges, cross-subject combined calendar

## Tech Stack
React 19, React Router 7, Tailwind 3, lucide-react, sonner, react-markdown 9, remark-gfm 4, axios, FastAPI 0.110, Motor, pypdf, emergentintegrations, bcrypt, PyJWT.

## Key Files
- `/app/backend/server.py` — all API endpoints
- `/app/frontend/src/index.css` + `styles/prose.css` — design tokens + chat markdown styles
- `/app/frontend/src/lib/auth.jsx`
- `/app/frontend/src/pages/SubjectDetailPage.jsx` — tab orchestrator with lock-gate
- `/app/frontend/src/pages/subject/PathTab.jsx` — Learning Path with module unlock
- `/app/frontend/src/pages/subject/OnboardingModal.jsx` — diagnostic survey
- `/app/frontend/src/pages/subject/CurriculumTab.jsx` — calendar view
- `/app/frontend/src/pages/subject/ChatTab.jsx` — markdown chat
- `/app/frontend/src/pages/ExtensionPreviewPage.jsx` — extension download buttons
- `/app/chrome-extension/` — Chrome MV3 extension source
