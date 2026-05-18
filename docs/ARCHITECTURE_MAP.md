# ARCHITECTURE_MAP.md

## Module Map

```
AppModule (backend/src/app.module.ts)
    ├── ConfigModule          (global, loads .env via ConfigService)
    ├── FirebaseModule        (@Global — available everywhere without re-import)
    │       └── FirebaseService
    ├── AIModule
    │       └── AIService     (exports AIService for ScansModule)
    ├── ScansModule
    │       ├── ScanController
    │       └── ScansService  (imports AIModule)
    └── AnalyticsModule
            ├── AnalyticsController
            └── AnalyticsService
```

**Key dependency injection rule:** FirebaseModule is `@Global()` — any module can inject FirebaseService without explicitly importing FirebaseModule. AIModule exports AIService so ScansModule can import it.

---

## File Map

### Backend

| File | Responsibility |
|---|---|
| `backend/src/main.ts` | App bootstrap: CORS, ValidationPipe, global prefix `/api`, port 3000 |
| `backend/src/app.module.ts` | Root module wiring all feature modules + ConfigModule |
| `backend/src/common/types.ts` | Shared TypeScript types: ScanStatus, Sentiment, Engine, Brand, Scan, ScanResult |
| `backend/src/firebase/firebase.module.ts` | @Global module registering FirebaseService |
| `backend/src/firebase/firebase.service.ts` | Firestore init + collection accessor helpers |
| `backend/src/ai/ai.module.ts` | Module registering and exporting AIService |
| `backend/src/ai/ai.service.ts` | LLM calls (Claude/OpenRouter), orchestration, concurrency batching |
| `backend/src/ai/parser.ts` | Pure functions: detectMention, detectPosition, detectSentiment, calcVisibilityScore, parseResponse |
| `backend/src/ai/prompts.ts` | ENGINE_PERSONAS, SEARCH_PROMPTS, buildPrompt() |
| `backend/src/scans/dto.ts` | CreateScanDto with class-validator decorators |
| `backend/src/scans/scans.controller.ts` | POST /scans, GET /scans/:brandId/:scanId |
| `backend/src/scans/scans.service.ts` | createScan(), getScanResults(), getOrCreateBrand() |
| `backend/src/scans/scans.module.ts` | Module wiring ScanController + ScansService, imports AIModule |
| `backend/src/analytics/analytics.controller.ts` | GET /analytics/brands, GET /analytics?brand= |
| `backend/src/analytics/analytics.service.ts` | getBrandAnalytics(), getAllBrands(), aggregateByEngine() |
| `backend/src/analytics/analytics.module.ts` | Module wiring AnalyticsController + AnalyticsService |

### Frontend

| File | Responsibility |
|---|---|
| `frontend/src/main.tsx` | ReactDOM.createRoot, mounts App into #root |
| `frontend/src/App.tsx` | Root component: header, tab routing (scan/dashboard), scan result state |
| `frontend/src/api/client.ts` | All HTTP calls + TypeScript interfaces for API responses |
| `frontend/src/hooks/useAsync.ts` | Generic async state hook: loading/data/error + run() |
| `frontend/src/components/ScanForm.tsx` | Brand+category form, triggers scan, calls onScanComplete |
| `frontend/src/components/ResultsTable.tsx` | Scan result stats row + detail table |
| `frontend/src/components/StatCard.tsx` | Metric display card (label, value, color, icon) |
| `frontend/src/components/VisibilityChart.tsx` | Recharts LineChart: avgScore + mentionRate over time |
| `frontend/src/components/EngineBreakdown.tsx` | Recharts BarChart: score per engine + stats grid |
| `frontend/src/pages/Dashboard.tsx` | Brand selector, loads analytics, composes StatCards + charts |

---

## Service Responsibilities

### FirebaseService (`firebase.service.ts`)
- Initialize Firebase Admin SDK once (OnModuleInit, guards against double-init with `admin.apps.length`)
- Expose typed collection accessors: `brands()`, `scans(brandId)`, `results(brandId, scanId)`
- Expose `getDb()` for raw batch operations
- Expose `now()` for consistent Firestore timestamps
- **Does NOT contain business logic** — only DB access layer

### AIService (`ai.service.ts`)
- Initialize two LLM clients: Anthropic SDK and OpenAI SDK (pointed at OpenRouter)
- `callClaude()` — private, Anthropic messages API, max_tokens 400
- `callOpenrouter()` — private, OpenAI chat completions API, max_tokens 400
- `callLLM()` — routes to one of the above based on `AI_PROVIDER` env var
- `runSingle()` — builds prompt from template+engine, calls LLM, calls parseResponse()
- `runWithConcurrency()` — batch runner: groups tasks, awaits each batch, delays between batches
- `runScan()` — **main entry point**: builds all task combinations, runs them via runWithConcurrency, returns RawResult[]
- **NOTE:** Current code throttles to 2 engines × 2 prompts = 4 calls (not 15 as documented), concurrency=1, delay=2500ms

### ScansService (`scans.service.ts`)
- `getOrCreateBrand()` — Firestore upsert for brand by name
- `createScan()` — orchestrates full scan: brand upsert → scan doc create → ai.runScan() → batch write results → update scan status
- `getScanResults()` — fetches scan + results from Firestore, computes summary stats
- **Owns scan lifecycle** but does NOT handle failures (no try/catch, no 'failed' status)

### AnalyticsService (`analytics.service.ts`)
- `getAllBrands()` — list all brands ordered by createdAt desc
- `getBrandAnalytics()` — loads all completed scans + their results, builds timeline + byEngine + overall
- `aggregateByEngine()` — private: groups results by engine, computes avgScore and mentionRate per engine

### parseResponse() (`parser.ts`)
- Pure function, no side effects, no injected dependencies
- Composes: detectMention → detectPosition → detectSentiment → calcVisibilityScore → ParsedResult
- **See WORKFLOW_ANALYSIS.md for scoring table**

---

## Dependency Graph Summary

```
ScanController
    └── ScansService
            ├── AIService
            │       └── (Anthropic SDK / OpenRouter)
            │       └── parseResponse() [parser.ts]
            │               └── detectMention, detectPosition, detectSentiment, calcVisibilityScore
            └── FirebaseService

AnalyticsController
    └── AnalyticsService
            └── FirebaseService
```

**No circular dependencies.** Firebase is globally available. AI is scoped to AIModule/ScansModule.

---

## God Nodes Explanation

From graphify analysis (by edge count):

| Node | Edges | Why Central |
|---|---|---|
| `AIService` | 8 | Called by ScansService, uses parser, prompts, both LLM providers, config |
| `parseResponse()` | 7 | Called by runSingle(), composes 4 sub-functions, returns ParsedResult |
| `FirebaseService` | 7 | Used by ScansService, AnalyticsService, exposes 5 collection methods |
| `Dashboard Page Component` | 6 | Composes StatCard×3, VisibilityChart, EngineBreakdown, calls api×2 |
| `AnalyticsService` | 5 | Reads Firebase across brands/scans/results, builds 3 analytics shapes |

---

## Important Connections

- **AIService → parseResponse**: Every LLM response is immediately parsed by parser.ts inside `runSingle()`. No raw response is stored — only the parsed result alongside the raw response text.
- **ScansService → Firestore batch**: All results written atomically via `getDb().batch()`. If batch fails, scan stays 'running' forever.
- **FirebaseModule @Global**: Means AnalyticsModule gets FirebaseService injected without declaring it as an import — important when adding new modules.
- **useAsync → all API calls**: Both App.tsx and Dashboard.tsx use the same `useAsync` hook. The hook clears previous data on each new `run()` call — Dashboard will flash empty when switching brands.
- **ConfigService → AIService**: All env vars (provider, model names, API keys) accessed only through NestJS ConfigService — never process.env directly in AIService.

---

## Firestore Data Model

```
brands/                              collection
  └── {brandId}                      document
        name: string
        createdAt: Timestamp
        scans/                       subcollection
          └── {scanId}               document
                brandId: string
                status: 'pending'|'running'|'done'|'failed'
                createdAt: Timestamp
                completedAt?: Timestamp
                results/             subcollection
                  └── {resultId}     document
                        scanId: string
                        engine: 'chatgpt-style'|'gemini-style'|'perplexity-style'
                        prompt: string
                        response: string
                        mentioned: boolean
                        position: number | null
                        sentiment: 'positive'|'neutral'|'negative'
                        visibilityScore: number
                        createdAt: Timestamp
```

**Note:** Brand lookup by name uses `where('name', '==', brandName)` — no unique index enforced in Firestore. Two identical brand names created concurrently would produce duplicates.
