# AI Visibility Tracker

Coaching-grade SaaS for brand visibility in AI search (ChatGPT / Gemini / Perplexity) + Google SERP. Diagnoses gaps, teaches user step-by-step how to fix each one, tracks progress over time.

![Dashboard](./dashboard.png)

---

## What it does

**Diagnosis layer:**
- AI visibility scan — 15 prompts × 3 engines (ChatGPT via OpenAI, Gemini, Perplexity-style via Gemini+Google Search grounding)
- Real-visibility vs Echo-rate split (unbiased prompts vs brand-cued prompts)
- Competitor schema audit (10 signals per site: GPTBot/ClaudeBot access, llms.txt, JSON-LD, FAQ, sitemap, etc)
- Brand presence (Google Knowledge Panel + Wikipedia detection per brand)
- On-page SEO audit + Core Web Vitals (PSI v5)
- Content gap finder per query (SERP + PAA + opportunity score)
- Listicle gap (articles featuring competitors but not you)

**Coaching layer (P0-P2 shipped 2026-05-20):**
- LLM-based onboarding category classification (returns category + audience + geo + business model)
- Priority engine that flags 0% real-visibility as critical, escalates audit gaps vs competitor median
- Per-action Playbook: why-it-matters + copy-paste JSON-LD/robots/llms.txt + verification steps + timeline + common pitfalls + resources
- Citation Building Playbook: Wikipedia notability checker, Wikidata claim template, press release + email pitch templates, directory list
- Content Brief Generator (per query): intent, word-count target, H2 outline, entities to mention, schema suggestions
- PAA → FAQ schema generator (one click writes 40-80 word answers + JSON-LD)
- Progress Dashboard with action-completion checkboxes + week-over-week deltas
- Competitor Benchmark per metric (your vs top vs median)
- Weekly Digest endpoint (markdown summary)
- System Health panel that tests every external API key

**Resilience:**
- Multi-region Gemini key rotation (`GOOGLE_GEMINI_API_KEYS` CSV or `GOOGLE_GEMINI_API_KEY_2..10`) — survives free-tier 429s
- Settings tab tests each key + shows setup steps for missing ones

---

## Tech stack

| Layer    | Technology                       |
| -------- | -------------------------------- |
| Backend  | NestJS + TypeScript              |
| Frontend | React + Vite + Tailwind          |
| Database | Firebase Firestore               |
| AI       | Claude Haiku (Anthropic) via SDK |
| Alt AI   | OpenRouter (free models for dev) |
| Charts   | Recharts                         |

---

## Architecture

```
React (Vite)
    │
    │  REST API
    ▼
NestJS
    ├── ScansModule      POST /api/scans
    ├── AnalyticsModule  GET  /api/analytics
    └── AIService
            ├── runScan()    (orchestrates N prompts × M engines, batched)
            ├── Parser       (mention, position, sentiment, score)
            └── Providers
                    ├── Claude Haiku (Anthropic)
                    └── OpenRouter   (free models)
    │
    ▼
Firestore
    brands/{brandId}
        scans/{scanId}
            results/{resultId}
```

---

## Getting started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled
- An Anthropic API key
- OR an OpenRouter API key (free models available at openrouter.ai)

### 1. Clone and install

```bash
git clone https://github.com/AlaaJanadi/ai-visibility-tracker
cd ai-visibility-tracker

npm install --workspace=backend
npm install --workspace=frontend
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

```env
# === REQUIRED ===
GOOGLE_GEMINI_API_KEY=AIzaSy...      # https://aistudio.google.com/app/apikey  (free 60 req/min per key)
SERPER_API_KEY=...                   # https://serper.dev/api-key (free 2500 queries on signup)

# === HIGHLY RECOMMENDED ===
GOOGLE_PSI_API_KEY=AIzaSy...         # PageSpeed Insights — lifts quota to 25k/day. Without it, Core Web Vitals return null
                                     # Setup: https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com
                                     # → Enable → Credentials → Create API key
OPENAI_API_KEY=sk-...                # https://platform.openai.com/api-keys (~$0.001/scan for gpt-4o-mini)

# === RESILIENCE — extra Gemini keys for 429 rotation ===
# Either CSV form:
GOOGLE_GEMINI_API_KEYS=AIzaSyA...,AIzaSyB...,AIzaSyC...
# Or numbered form:
GOOGLE_GEMINI_API_KEY_2=AIzaSy...
GOOGLE_GEMINI_API_KEY_3=AIzaSy...
# (up to _10)

# === FALLBACK ===
OPENROUTER_API_KEY=...               # https://openrouter.ai/keys — used when Gemini key missing
ANTHROPIC_API_KEY=...                # Optional Claude provider

# === MODEL / SCAN CONFIG ===
AI_PROVIDER=openrouter               # or 'anthropic' (fallback only — Gemini direct preferred)
OPENROUTER_MODEL=google/gemma-4-31b-it:free
ANTHROPIC_MODEL=claude-haiku-4-5
AI_MAX_ENGINES=3                     # 3 = chatgpt-style + gemini-style + perplexity-style
AI_MAX_PROMPTS=5                     # 5 quick prompts (one per intent bucket)
AI_CONCURRENCY=2
AI_DELAY_MS=2000

# === CORS + AUTH ===
FRONTEND_URL=http://localhost:5173   # NO trailing slash
API_KEY=...                          # Optional bearer token middleware (omit for local dev)

# === RATE LIMITING ===
THROTTLE_TTL_MS=60000
THROTTLE_SCAN_LIMIT=5
```

**Check that every key works:** open `/settings` in the frontend → click "Re-check". The System Health panel pings each provider and shows ✅/❌ with exact setup steps for any missing key.

Add your Firebase service account key:

- Go to Firebase Console → Project Settings → Service Accounts
- Click "Generate new private key"
- Save the file as `backend/serviceAccountKey.json`

### 3. Configure the frontend

```bash
cp frontend/.env.example frontend/.env
```

`frontend/.env` contains:

```env
VITE_API_URL=http://localhost:3000/api
```

### 4. Run

```bash
# terminal 1 — backend
cd backend && npm run start:dev

# terminal 2 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173

---

## How a scan works

1. User submits a brand name and category
2. Backend creates a scan document in Firestore with status `running`
3. `AIService.runScan()` builds N tasks (AI_MAX_PROMPTS × AI_MAX_ENGINES, default 2×2=4)
4. Tasks fire in controlled batches (AI_CONCURRENCY) with AI_DELAY_MS gaps between batches
5. Each response is parsed: mention detection, position extraction, sentiment analysis
6. A visibility score (0–100) is calculated based on position + sentiment
7. All results are batch-written to Firestore atomically
8. Scan status updates to `done`
9. Frontend fetches results and displays them

---

## Key engineering decisions

**Lazy promise evaluation** — tasks are wrapped in `() => promise` functions so the concurrency limiter controls exactly when each HTTP request fires. Firing all 15 at once exceeded the API's concurrent connection limit.

**Firestore batch writes** — all 15 results are committed in a single batch operation rather than 15 sequential writes. Atomic and ~15x faster.

**Provider abstraction** — a single `callLLM()` method routes to either Anthropic or OpenRouter based on an env variable. Adding a new provider is a one-file change.

**Lexicon-based sentiment** — sentiment is detected using a word list rather than a second LLM call. Fast, deterministic, and free.

---

## Project structure

```
ai-visibility-tracker/
├── backend/src/
│   ├── ai/                 — Gemini/OpenAI/OpenRouter/Anthropic orchestrator + multi-key pool rotation
│   ├── scans/              — POST /api/scans (AI visibility scan, 3 engines)
│   ├── analytics/          — GET /api/analytics
│   ├── seo/                — Crawler + Serper + SeoSiteScan flow
│   ├── competitor-audit/   — 10-signal schema audit per brand + 6 competitors
│   ├── brand-presence/     — Knowledge Panel + Wikipedia detection
│   ├── listicle-gap/       — "best X in Y" gap detector
│   ├── on-page-seo/        — Title/meta/H1/schema/alt audit + PSI v5
│   ├── content-gap/        — POST /api/content-gap/scan + brief + paa
│   ├── generators/         — Schema generators (FAQ, Org, Article, Review, llms.txt, robots, FAQ-from-PAA)
│   ├── geo-actions/        — Action synthesis + progress + benchmark + digest + completion tracking
│   ├── onboarding/         — POST /api/onboarding/analyze + start
│   ├── system-health/      — GET /api/system/health/integrations
│   ├── alerts/             — Threshold-triggered alerts
│   └── scheduler/          — Cron-driven AI scans
└── frontend/src/
    ├── api/client.ts       — Typed axios client (all endpoints)
    └── components/
        ├── ScanForm, ResultsTable, RecommendationsPanel
        ├── OnboardingWizard, GeneratorModal, GeneratorToolbar
        ├── BrandPresencePanel, GeoActionsPanel (with playbook UI + completion checkboxes)
        ├── OnPageSeoPanel, ContentGapPanel (with brief + PAA-FAQ modals)
        ├── ProgressPanel (deltas + weekly-digest modal)
        ├── BenchmarkPanel (you vs top vs median)
        └── SystemHealthPanel (env keys verification)
```

---

## New API routes (post P0-P2 ship)

```
GET    /api/system/health/integrations    — test each provider key
GET    /api/geo-actions                   — full action report with playbooks
GET    /api/geo-actions/progress          — 8-snapshot timeline + deltas
GET    /api/geo-actions/benchmark         — per-metric you vs top vs median
GET    /api/geo-actions/digest            — markdown weekly summary
GET    /api/geo-actions/completions       — per-action completion state
POST   /api/geo-actions/completion        — toggle action complete
POST   /api/content-gap/brief             — SERP+PAA → full content brief
POST   /api/generators/schema/faq-from-paa — LLM writes FAQ answers + JSON-LD
```

---

## Demo mode

Public, credential-less demo entry. Designed to let prospects experience the
whole product without consuming Gemini / Serper credits or mutating the real
database.

**Entry:** "View Demo" button on the login screen → calls `POST /api/auth/demo-login`
→ JWT for the seeded demo account.

**Seeded by:** `UsersService.seedDemoAccount()` runs on every backend boot.
Configure with env vars:
- `DEMO_EMAIL` (default: `demo@aivisibilitytracker.com`)
- `DEMO_PASSWORD` (default: `demo-public-2026`)

**What a demo user can do:**
- Browse Dashboard + Compare tabs and view existing Platinum Square scan data
- Open any generator (FAQ / Org / Article / Review / llms.txt / robots.txt) —
  receives pre-built fixtures from `backend/src/generators/demo-fixtures.ts`,
  zero LLM cost, instant response
- See the demo banner at top with a WhatsApp CTA for a live audit

**What a demo user cannot do (returns 403):**
- Trigger new scans (AI, SEO, on-page, content-gap, brand-presence, competitor-audit)
- Run onboarding wizard
- Manage users / change settings / modify alerts
- Modify any Firestore state

Enforcement:
- `DemoWriteBlockMiddleware` (global) — blocks every non-GET request from
  role=demo with an allowlist for `/generators/*` and `/auth/demo-login`
- Frontend hides Settings + New Scan tabs for demo users
- Backend has a `DemoBlockGuard` for explicit per-route use if needed in future
