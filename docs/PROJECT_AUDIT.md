# PROJECT_AUDIT.md

## What the Project Is

**AI Visibility Tracker** — a full-stack web app that answers: *"When someone asks an AI chatbot about my industry, does my brand get mentioned?"*

A user submits a brand name and category. The backend fires prompts at a real LLM (Claude Haiku or any OpenRouter model) using 3 simulated AI engine personas, parses each response for brand mention, position, and sentiment, calculates a visibility score (0–100), and stores everything in Firestore. The frontend displays per-scan results and historical analytics.

**Purpose:** Portfolio project demonstrating NestJS, React, Firestore, and AI orchestration patterns.

---

## Current Status

| Area | Status | Notes |
|---|---|---|
| Backend API | Working | 4 endpoints, validated DTOs, NestJS modules |
| AI scan execution | Working but throttled | Deliberately reduced to 2 engines × 2 prompts (not 15 as documented) |
| Firebase integration | Working | Firestore subcollection hierarchy implemented |
| Parser | Working | Mention, position, sentiment, score all functional |
| Frontend scan flow | Working | ScanForm → ResultsTable |
| Frontend dashboard | Working | Brand selector, StatCards, VisibilityChart, EngineBreakdown |
| Tests | Skeleton only | `test/app.e2e-spec.ts` exists, no real test coverage |
| Auth / security | Not implemented | No API key auth, no rate limiting |
| Error recovery | Incomplete | Scan status never set to `'failed'` on error |
| Webhook/integrations | Mentioned in git log | Not found in source code |

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Backend framework | NestJS | ^11.0.1 |
| Language | TypeScript | ^5.7.3 |
| Database | Firebase Firestore (firebase-admin) | ^13.7.0 |
| AI provider A | Anthropic Claude (claude-haiku-4-5) | ^0.81.0 |
| AI provider B | OpenRouter (via openai SDK) | ^6.33.0 |
| Frontend framework | React | 19 |
| Frontend build | Vite | latest |
| Frontend styling | Tailwind CSS | 4 |
| Charts | Recharts | latest |
| Icons | Lucide React | latest |
| HTTP client | Axios | latest |
| Validation | class-validator | ^0.15.1 |

---

## Architecture Summary

```
Browser (React/Vite :5173)
    │
    │  REST/JSON
    ▼
NestJS (:3000)
    │
    ├── POST /api/scans
    │       ScansController → ScansService → AIService → parser.ts
    │                                     └→ FirebaseService (write)
    │
    ├── GET  /api/scans/:brandId/:scanId
    │       ScansController → ScansService → FirebaseService (read)
    │
    ├── GET  /api/analytics/brands
    │       AnalyticsController → AnalyticsService → FirebaseService (read)
    │
    └── GET  /api/analytics?brand=X
            AnalyticsController → AnalyticsService → FirebaseService (read)
    │
    ▼
Firebase Firestore
    brands/{brandId}/
        scans/{scanId}/
            results/{resultId}/
```

---

## Main Risks

| Risk | Severity | Detail |
|---|---|---|
| Scan never marked `failed` | HIGH | If `ai.runScan()` throws, scan stays `running` forever in Firestore |
| CORS hardcoded | MEDIUM | `origin: 'http://localhost:5173'` — production deploy breaks |
| No rate limiting | MEDIUM | Anyone can spam POST /api/scans, burning AI API credits |
| `serviceAccountKey.json` security | MEDIUM | Firebase credentials file must NOT be committed; `.gitignore` must cover it |
| Missing Firestore composite index | MEDIUM | `getBrandAnalytics` uses `.where().orderBy()` — requires composite index or Firestore throws |
| Throttling mismatch with docs | LOW | Code runs 2×2=4 calls; README says 5×3=15 — misleads developers |
| Typo in parser.ts | LOW | `reponse` param name on line 10 |
| Typo in PROJECT_DOCS.md | LOW | Says `'pinding'` instead of `'pending'` |

---

## What Is Complete

- NestJS module structure (AppModule, AIModule, ScansModule, AnalyticsModule, FirebaseModule)
- All 4 API endpoints with validation
- Full Firestore subcollection hierarchy (brands → scans → results)
- AI provider abstraction: one `callLLM()` routes to Claude or OpenRouter
- Lazy promise evaluation + `runWithConcurrency` batch limiter
- Parser: detectMention, detectPosition, detectSentiment, calcVisibilityScore, parseResponse
- React frontend: tab routing, ScanForm, ResultsTable, Dashboard, all charts
- `useAsync` hook for loading/error state
- Typed API client (`api/client.ts`)
- Skeleton loading state on Dashboard
- Both PROJECT_DOCS.md files (detailed documentation for backend and frontend)

---

## What Is Missing

- Scan failure handling (set status to `'failed'` in catch block)
- Rate limiting on POST /api/scans
- Auth (API key or session)
- CORS configurable via env var
- Real test coverage (unit + e2e)
- Firestore composite index definition (firebase.json / firestore.indexes.json)
- Webhook/integration code (referenced in git history but not in source)
- Production deployment config (no Dockerfile, no cloud run config)
- No pagination on results or analytics (will break on large datasets)
- No input sanitization for brand/category beyond MinLength(2)
