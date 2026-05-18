# CHANGELOG.md

---

## [2026-05-18] — Session 26: Quick Scan + Full GEO Scan modes

### Goal
Brand identity = category. Whenever anyone searches AI for anything category-related (services, locations, alternatives, reviews) the brand should appear. Quick Scan (5 prompts) for fast spot-check; Full GEO Scan (30 prompts) for wide coverage across services × locations × budgets × personas.

### Backend changes
- `backend/src/ai/ai.service.ts`
  - `ScanInput.mode?: 'quick' | 'full'` (default `quick`)
  - `generateScenarioPrompts(category, count)` — generates 30 scenario-rich prompts distributed 6 per intent bucket × 5 buckets, anchored to DIFFERENT concrete scenarios (neighborhood + budget + sub-type + persona) to maximize variance
  - `parseScenarioArray()` — keeps multiple prompts per intent ID (vs `parsePromptJson` which collapses to 5)
  - `runScan()` branches on mode: full → 30 prompts × 3 engines = 90 calls; quick → unchanged
  - Fallback pads with `SEARCH_PROMPTS` if LLM returns <60% of target
- `backend/src/common/types.ts` — `ScanMode` export + `Scan.mode?` field persisted on Firestore doc
- `backend/src/scans/dto.ts` — `CreateScanDto.mode?` validated `@IsIn(['quick','full'])`
- `backend/src/scans/scan-queue.constants.ts` — `ScanJobData.mode?`
- `backend/src/scans/scan.processor.ts` — forwards `mode` from queue to `runScanInBackground`
- `backend/src/scans/scans.service.ts` — persists `mode` on scan doc, passes to queue + `ai.runScan`

### Frontend changes
- `frontend/src/api/client.ts` — `createScan(brand, category, mode = 'quick')`
- `frontend/src/components/ScanForm.tsx`
  - `Mode` state + 2-tile toggle UI (Quick / Full GEO) with icon + ETA badge + tagline
  - Active tile = ring + gradient bg; disabled while scanning
  - Header ETA badge mirrors selected mode (~1 min · 15 calls / ~6 min · 90 calls)
  - Progress bar reads server-emitted `total` so it works for both modes automatically

### Test plan
- ✅ Backend: 63/63 jest pass (existing tests untouched, default quick path)
- ✅ Backend: `npm run build` clean
- ✅ Frontend: `npm run build` clean

### Pending verification (after deploy)
- Run a Full scan against "Platinum Square" / "dubai real estate broker" → expect 90 results spanning multiple JVC/Marina/Palm scenarios; coverage map shows all 5 buckets lit
- Confirm Gemini free tier holds at 90 calls (throttled by AI_DELAY_MS=8000, concurrency=2)

---

## [2026-05-18] — Session 25: Production deploy — Vercel (frontend) + Railway (backend)

### ✅ Deployed to production
- **Frontend (Vercel):** https://ai-agent-frontend-two-eosin.vercel.app
- **Backend (Railway):** https://backend-production-e169.up.railway.app
- **GitHub:** repo pushed to `emad-yahya/AI-Agent` (commits 645209d → 34c42cf)

### Code changes
- `backend/src/firebase/firebase.service.ts` — يدعم `FIREBASE_SERVICE_ACCOUNT_JSON` env var (للـ prod) مع fallback لـ `serviceAccountKey.json` (local dev). يرمي error واضح لو الاثنين فاضيين.
- `backend/src/main.ts` — strip trailing `/` من `FRONTEND_URL` قبل ما يمرره لـ CORS (متصفحات تطلب exact match)
- `backend/firebase.json` جديد — يربط Firebase CLI بـ `firestore.indexes.json`
- `backend/package-lock.json` جديد — مولّد بـ `--workspaces=false` ليشتغل `npm ci` بالـ Dockerfile لو Railway يبني من `backend/` كـ root
- `backend/.env` — رفع `AI_DELAY_MS` 2000→8000، حذف `GOOGLE_CSE_*` (ميتة، Serper هو الـ active)، توليد `API_KEY` random 64-char hex
- `.gitignore` — تجاهل `.claude/`, `.agents/`, `graphify-out/`, `skills-lock.json`

### Verification (end-to-end)
- ✅ Frontend HTML 200 + bundle يحمّل + `VITE_API_URL` و `VITE_API_KEY` مضمنين
- ✅ Backend 9/9 critical endpoints 200 (scheduler, analytics×4, scans, seo×2, alerts)
- ✅ Auth: 401 بدون key + 401 مع key خاطئ + 200 مع key صحيح
- ✅ CORS: Allow-Origin = frontend exact match + يرفض origin غير موثوق
- ✅ Firestore connected, 10 brands في DB

### Known minor (غير حرج)
- `GET /api/seo/scans` بدون `?brand=` يرجع 500 بدلاً من 400 — legacy endpoint، الـ frontend ما يستعمله بدون brand

---

## [2026-05-18] — Session 24: Dashboard 500 fix (composite-index bypass)

### ✅ Fix: `/api/analytics?brand=...` returned 500 for brands without pre-aggregated summaries
- **مشكلة:** Dashboard للبراند "platinum square" يرجع `Internal server error`. باقي البراندات (Apple, Nike) شغّالة.
- **Root cause:** Slow path في `AnalyticsService.buildFromResults()` كان يستخدم `.where('status','==','done').orderBy('createdAt','asc')` — يتطلب composite index `(status ASC, createdAt ASC)`. الـ index معرّف بـ `backend/firestore.indexes.json` بس ما انتشر على Firestore → `9 FAILED_PRECONDITION: The query requires an index`.
- **الحل:** أزلنا `.where('status','==','done')` من الـ query، نجلب كل scans مرتبة بـ createdAt، ونفلتر `status === 'done'` بالذاكرة. لا يحتاج composite index.
- **Bonus fix:** Division-by-zero guard على `mentionRate` في timeline (لو `results.length === 0`) → كان يرجع NaN → JSON null.
- **الملف:** `backend/src/analytics/analytics.service.ts` `buildFromResults()` (~lines 129-179)
- **الاختبار:** ✅ كل 3 براندات Platinum Square variants ترجع 200 الآن | ✅ jest 63/63 | ✅ tsc backend + frontend = 0 errors

### 📋 Follow-up (اختياري، prod writes — يحتاج موافقة)
- `firebase deploy --only firestore:indexes` لنشر الـ composite index الحقيقي
- Backfill `scanSummaries` للسكانات القديمة → فاست path لكل البراندات

---

## [2026-05-13] — Session 10: Model fix + Retry logic + .env audit

### ✅ Fix: OpenRouter model `openrouter/free` → `google/gemma-4-31b-it:free`
- **مشكلة:** `openrouter/free` يرجع `content: null` → scan يُكمل بـ 0 results (صامت، لا error)
- **مشكلة ثانية:** `meta-llama/llama-3.3-70b-instruct:free` غير موجود في free models الحالية → 429 فوري
- **الحل:** `google/gemma-4-31b-it:free` — مختبر، يرجع content صحيح
- **الملفات:** `backend/.env`, `backend/.env.example`, `backend/src/ai/ai.service.ts`

### ✅ Fix: Retry logic عند 429 في `callOpenrouter()`
- عند 429: ينتظر 30s ثم يعيد المحاولة مرة واحدة
- يمنع فشل الـ call الكامل بسبب rate limit مؤقت
- **الملف:** `backend/src/ai/ai.service.ts:callOpenrouter()`

### ✅ Fix: `AI_DELAY_MS` 2500ms → 8000ms
- يقلل احتمال 429 على free tier بين كل call وآخر
- **الملفات:** `backend/.env`, `backend/.env.example`

### ✅ Fix: `.env` audit — متغيرات ناقصة أضيفت
- أضيف: `AI_MAX_ENGINES`, `AI_MAX_PROMPTS`, `AI_CONCURRENCY`, `AI_DELAY_MS`, `SCAN_SCHEDULE_ENABLED`, `THROTTLE_TTL_MS`, `THROTTLE_SCAN_LIMIT`, `FRONTEND_URL`, `API_KEY`, `GOOGLE_CSE_*`
- **الملف:** `backend/.env`

**الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run lint` | ✅ `jest` 56/56 | ✅ scan حقيقي يرجع real AI results

---

## [2026-05-13] — Session 9: SEO Module (5.3)

### ✅ Feature: SEO keyword ranking tracking (5.3)

#### Backend
- `SeoResult` + `SeoScan` interfaces → `backend/src/common/types.ts`
- `FirebaseService.seoScans(brandId)` → `brands/{brandId}/seoScans` collection
- `backend/src/seo/seo.service.ts` — `createScan()`, `runScanAsync()`, `checkKeyword()` (Google CSE), `getScan()`, `listScans()`
  - Fire-and-forget: POST returns immediately, keywords checked one-by-one with `SEO_DELAY_MS` gap
  - Position detection: checks result link + title + snippet for brand name (case-insensitive)
  - Graceful degradation: if CSE keys not set → returns `found: false` for all keywords
- `backend/src/seo/seo.controller.ts` — `POST /api/seo/scans`, `GET /api/seo/scans`, `GET /api/seo/scans/:brandId/:scanId`
- `backend/src/seo/seo.module.ts` + registered in `AppModule`
- `backend/src/seo/create-seo-scan.dto.ts` — validates brand (min 2 chars) + keywords (1-10 items)
- `backend/.env.example` — `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID`, `SEO_DELAY_MS=500`
- **الملفات الجديدة:** `seo/seo.service.ts`, `seo/seo.controller.ts`, `seo/seo.module.ts`, `seo/create-seo-scan.dto.ts`
- **الملفات المعدّلة:** `common/types.ts`, `firebase/firebase.service.ts`, `app.module.ts`, `.env.example`

#### Frontend
- `SeoScanForm.tsx` — brand input + keywords textarea (newline or comma-separated, max 10)
- `SeoResultsTable.tsx` — polls `GET /api/seo/scans/:brandId/:scanId` every 2s until done; shows position badge (#1 green, #4-10 orange, not found gray) + URL + page title
- `client.ts` — `SeoResult`, `SeoScan` types + `createSeoScan()`, `getSeoScan()`, `listSeoScans()` API calls
- `App.tsx` — "SEO" tab (Globe icon), `seoScan` state, renders `SeoScanForm` + `SeoResultsTable`
- **الملفات الجديدة:** `components/SeoScanForm.tsx`, `components/SeoResultsTable.tsx`
- **الملفات المعدّلة:** `api/client.ts`, `App.tsx`
- **الاختبار:** ✅ backend `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 56/56 | ✅ frontend `tsc --noEmit`

---

## [2026-05-13] — Session 8: Delta indicator (5.2) + Export CSV/PDF (4.6)

### ✅ Feature: Week-over-week delta indicator (5.2)
- `StatCard.tsx` — optional `delta?: number | null` + `deltaUnit?: string` props
- Positive delta → green TrendingUp arrow + "+X pts vs last scan"
- Negative delta → red TrendingDown arrow + "-X pts vs last scan"
- Zero or null (< 2 scans) → no delta shown
- `Dashboard.tsx` — computes `scoreDelta` + `mentionDelta` from last 2 timeline points; passes to StatCard via IIFE
- **الملفات المعدّلة:** `frontend/src/components/StatCard.tsx`, `frontend/src/pages/Dashboard.tsx`
- **الاختبار:** ✅ frontend `tsc --noEmit`

### ✅ Feature: Export CSV / PDF (4.6)
- `ExportButtons.tsx` — NEW component, two buttons: "Export CSV" + "Export PDF"
  - CSV: pure client-side, `Blob` + `URL.createObjectURL`, downloads `{brand}_ai_visibility_{date}.csv`
  - PDF: `window.open()` with styled HTML page → `window.print()` → browser save-as-PDF
  - Both include: brand, category, all scan results, recommendations
- `ScanForm.tsx` — `onScanComplete` callback now passes `brand` and `category` alongside brandId/scanId
- `App.tsx` — `scanMeta` state stores brand + category; renders ExportButtons above ResultTable with brand/category label
- **الملفات الجديدة:** `frontend/src/components/ExportButtons.tsx`
- **الملفات المعدّلة:** `frontend/src/components/ScanForm.tsx`, `frontend/src/App.tsx`
- **الاختبار:** ✅ frontend `tsc --noEmit` | ✅ backend `jest` 56/56

---

## [2026-05-13] — Session 7: Auth (4.7) + Pre-aggregation (4.5)

### ✅ Feature: API key authentication (4.7)
- `backend/src/auth/api-key.middleware.ts` — NestJS middleware, checks `Authorization: Bearer <key>` or `x-api-key` header
- Opt-in: if `API_KEY` env var not set → auth disabled (safe for local dev)
- Applied globally via `AppModule implements NestModule`
- `backend/.env.example` — `API_KEY=` added
- `frontend/src/api/client.ts` — axios interceptor injects `Authorization` header from `VITE_API_KEY`
- `frontend/.env.example` — NEW file: `VITE_API_KEY=`
- **الملفات الجديدة:** `backend/src/auth/api-key.middleware.ts`, `frontend/.env.example`
- **الملفات المعدّلة:** `backend/src/app.module.ts`, `backend/.env.example`, `frontend/src/api/client.ts`

### ✅ Feature: Analytics pre-aggregation (4.5)
- `ScanSummary` interface في `backend/src/common/types.ts` — يخزن per-scan stats + byEngine breakdown
- `FirebaseService.scanSummaries(brandId)` — collection path `brands/{brandId}/scanSummaries`
- `ScansService.buildScanSummary()` — يبني الملخص من rawResults
- `runScanAsync()` — يكتب الملخص في Firestore مباشرة بعد `batch.commit()`
- `AnalyticsService.getBrandAnalytics()` — fast path: يقرأ scanSummaries (O(n)) بدل loading all results (O(n×m))، fallback للـ brands القديمة بدون summaries
- **الأثر:** brands ذات 30 scan → من 120 Firestore reads → 30 reads
- **الملفات المعدّلة:** `backend/src/common/types.ts`, `backend/src/firebase/firebase.service.ts`, `backend/src/scans/scans.service.ts`, `backend/src/analytics/analytics.service.ts`, `backend/src/scans/scans.service.integration.spec.ts`
- **الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 56/56 | ✅ frontend `tsc --noEmit`

---

## [2026-05-13] — Session 7: Recommendations Engine (5.1)

### ✅ Feature: Industry-specific AI visibility recommendations

**الهدف:** بعد كل scan، يولّد النظام خطة عمل مخصصة حسب نوع البزنس (مطعم / وكالة ماركتينغ / حلاق / etc.)

**Backend:**
- `AIService.generateText(prompt)` — public method: single LLM call, 2000 tokens, same provider routing كـ `callLLM`
- `ScansService.buildRecommendationsPrompt()` — prompt مخصص: يضمّن brand name + category + engine-by-engine results + تعليمات صريحة بعدم التعميم
- `ScansService.generateRecommendations()` — يستدعي `generateText`, يستخرج JSON array, يتعامل مع أخطاء LLM بدون crash
- `Promise.race` مع timeout 25s — الـ scan لا يتوقف لو تأخرت التوصيات
- `runScanAsync()` — يولّد التوصيات بعد `batch.commit()` وقبل emit('done')؛ يخزنها في scan document
- `getScanResults()` — يرجع `recommendations[]` من scan document (empty array إذا لم تُولَّد بعد)
- `Recommendation` interface + `Scan.recommendations?` في `backend/src/common/types.ts`

**Frontend:**
- `Recommendation` interface في `frontend/src/api/client.ts`
- `ScanResponse.recommendations: Recommendation[]` — مضافة للـ type
- `RecommendationsPanel.tsx` — component جديد: grouped by priority (high/medium/low)، expandable cards، steps list، platforms badges، expected impact، effort badge
- `App.tsx` — يعرض `<RecommendationsPanel>` تحت `<ResultTable>` بعد كل scan

**الملفات الجديدة:** `frontend/src/components/RecommendationsPanel.tsx`
**الملفات المعدّلة:**
- `backend/src/common/types.ts` — Recommendation interface + Scan.recommendations
- `backend/src/ai/ai.service.ts` — generateText() public method
- `backend/src/scans/scans.service.ts` — generateRecommendations + buildRecommendationsPrompt + runScanAsync + getScanResults
- `frontend/src/api/client.ts` — Recommendation type + ScanResponse.recommendations
- `frontend/src/App.tsx` — RecommendationsPanel import + render

**الاختبار:** ✅ backend `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 56/56 | ✅ frontend `tsc --noEmit`

---

## [2026-05-13] — Session 6: Competitor Comparison (4.4)

### ✅ Feature: Competitor comparison (POST /api/scans/compare)

**Backend:**
- `backend/src/scans/compare.dto.ts` — `CompareDto`: `brands: string[2-4]` + `category`
- `ScansService.compareBrands()` — parallel `Promise.all` لكل brand، يرجع per-brand stats + byEngine breakdown
- `ScansService.buildBrandComparison()` — private helper: يحسب avgScore، mentionRate، sentiment per engine
- `ScanController` — `@Post('compare')` + `@UseGuards(ThrottlerGuard)`
- No Firestore storage — live comparison

**Frontend:**
- `CompareForm.tsx` — dynamic brand inputs (2-4)، إضافة/حذف brands، category، loading state
- `ComparisonTable.tsx` — جدول مقارنة: brands كـ columns، overall stats + per-engine breakdown، winner badge
- `App.tsx` — tab "Compare" جديد، `compareResult` state

**الاختبار:** ✅ backend `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 35/35 | ✅ frontend `tsc --noEmit`

---

## [2026-05-13] — Session 6: Integration tests ScansService (3.3)

### ✅ Testing: ScansService integration tests — 10 tests

**Approach:** NestJS `TestingModule` مع `FirebaseService` in-memory mock + `AIService.callLLM` spy. لا Firebase emulator مطلوب (المشروع ليس فيه `firebase.json`).

**التغطية:**
- `createScan` — 3 tests: returns `{scanId, brandId}`، يستدعي `firebase.brands()`، يستدعي `firebase.scans()`
- `getScanResults` — 3 tests: returns scan+results+stats، stats حسابات صحيحة، NotFoundException للـ scan غير الموجود
- `listScansByBrand` — 2 tests: correct shape، NotFoundException للـ brand غير الموجود
- `compareBrands` — 2 tests: returns per-brand results، كل result فيه stats+byEngine

**الملفات الجديدة:** `backend/src/scans/scans.service.integration.spec.ts`

**الاختبار:** ✅ `jest` — 56/56 (3 suites) | ✅ `tsc --noEmit` | ✅ `npm run lint`

---

## [2026-05-13] — Session 6: Unit tests for AIService (3.2)

### ✅ Testing: Unit tests for AIService — 11 tests

**Mock strategy:** `jest.spyOn` على `callLLM` private method — بدون أي real API call. Dummy API keys في `mockConfig` لتجاوز constructor validation في OpenAI SDK.

**التغطية:**
- `runScan` — 6 tests: returns RawResult[]، required fields، parse correctness، callLLM call count، onProgress callback، skip failed calls، all fail → empty []
- `runWithConcurrency` (via runScan) — 2 tests: respects MAX_ENGINES، result count
- result typing — 2 tests: valid engine value، score 0-100

**الاختبار:** ✅ `jest ai.service.spec` — 11/11 | ✅ `tsc --noEmit` | ✅ `npm run lint`

---

## [2026-05-13] — Session 6: Unit tests for parser.ts (3.1)

### ✅ Testing: Unit tests for parser.ts — 35 tests

**التغييرات:**
- `package.json` — إضافة `moduleNameMapper: { "^src/(.*)$": "<rootDir>/$1" }` في jest config لحل `src/` path alias
- `backend/src/ai/parser.spec.ts` — **ملف جديد**: 35 test يغطّي كل functions

**التغطية:**
- `detectMention` — 4 tests (exact case، case insensitive، absent، empty)
- `detectPosition` — 8 tests (numbered list pos1/2، bullet list pos1/2، prose، absent، case، paren marker)
- `detectSentiment` — 7 tests (positive، negative، neutral، brand absent، tie، cross-sentence، case)
- `calcVisibilityScore` — 11 tests (not mentioned، pos1/2/3/4+/null × sentiment، cap/floor)
- `parseResponse` — 3 integration tests (full parse، not mentioned، prose)

**الاختبار:** ✅ `jest parser.spec` — 35/35 | ✅ `tsc --noEmit` | ✅ `npm run lint`

---

## [2026-05-13] — Session 5: Real-time Scan Progress (4.1)

### ✅ Feature: Real-time scan progress via SSE

**التصميم:**
- `POST /api/scans` يرجع `{ scanId, brandId }` فوراً — الـ scan يشتغل في الـ background
- `GET /api/scans/stream/:scanId` — SSE endpoint يبث progress events
- Frontend يفتح EventSource، يعرض progress bar حقيقي: "Scanning 2/4 calls..."

**Backend:**
- `scan-events.service.ts` — in-memory event system (Map of listeners per scanId)
- `ScansService.createScan()` → fire-and-forget pattern، يرجع `{scanId, brandId}` فوراً
- `ScansService.runScanAsync()` — private method ينفذ الـ scan ويبث events
- `AIService.runScan(onProgress?)` + `runWithConcurrency(onProgress?)` — callback بعد كل batch
- `ScanController.stream()` — `@Sse('stream/:scanId')` يرجع `Observable<MessageEvent>`

**Frontend:**
- `ScanForm.tsx` — rewrite كامل: phase state (idle/creating/scanning/loading)، EventSource، progress bar مرئي
- `api/client.ts` — `ScanProgressEvent` type + `BASE_URL` export

**الملفات الجديدة:** `backend/src/scans/scan-events.service.ts`  
**الملفات المعدّلة:**
- `backend/src/scans/scans.service.ts` — fire-and-forget + runScanAsync
- `backend/src/scans/scans.controller.ts` — @Sse endpoint + ScanEventsService inject
- `backend/src/scans/scans.module.ts` — ScanEventsService provider
- `backend/src/ai/ai.service.ts` — onProgress callback
- `backend/src/scheduler/scheduler.service.ts` — log message fix (resultCount removed)
- `frontend/src/components/ScanForm.tsx` — full rewrite with EventSource + progress bar
- `frontend/src/api/client.ts` — ScanProgressEvent, BASE_URL, updated CreateScanResponse

**الاختبار:** ✅ backend `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ frontend `tsc --noEmit`

---

## [2026-05-13] — Session 4: Scan History Feature (4.3)

### ✅ Feature: Scan History
**الهدف:** عرض كل الـ scans السابقة لكل brand في الـ Dashboard مع إمكانية عرض نتائجها  

**Backend:**
- `ScansService.listScansByBrand(brandName)` — يبحث عن brand بالاسم، يرجع list من scans مرتبة desc
- `GET /api/scans?brand=X` — endpoint جديد في `ScanController`

**Frontend:**
- `ScanHistoryItem` type في `api/client.ts`
- `api.listScans(brand)` في `api/client.ts`
- `ScanHistory.tsx` — component جديد: جدول scans، قابل للتوسع، يحمّل النتائج عند الضغط (lazy fetch + cache)
- `Dashboard.tsx` — إضافة `<ScanHistory brand={selectedBrand} />` تحت الـ charts

**الملفات الجديدة:** `frontend/src/components/ScanHistory.tsx`  
**الملفات المعدّلة:**
- `backend/src/scans/scans.service.ts`
- `backend/src/scans/scans.controller.ts`
- `frontend/src/api/client.ts`
- `frontend/src/pages/Dashboard.tsx`

**الاختبار:** ✅ backend `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ frontend `tsc --noEmit`

---

## [2026-05-13] — Session 3: Reliability + Safety

### ✅ Fix 3 — .gitignore: serviceAccountKey.json
**المشكلة:** Firebase credentials غير محمية من git  
**الحل:** أضفنا `serviceAccountKey.json` و `backend/serviceAccountKey.json` لـ `.gitignore`  
**الملفات:** `.gitignore`  
**الاختبار:** ✅ `git log --all -- serviceAccountKey.json` — لا commits

---

### ✅ Fix 4 — Rate limiting على POST /api/scans
**المشكلة:** أي شخص يقدر يشغّل مئات الـ scans ويحرق رصيد الـ API  
**الحل:** `@nestjs/throttler@6.5.0` — 5 requests/min per IP (configurable)  
**الملفات المعدّلة:**
- `backend/src/app.module.ts` — `ThrottlerModule.forRootAsync()` مع ConfigService
- `backend/src/scans/scans.controller.ts` — `@UseGuards(ThrottlerGuard)` على `@Post()`
- `backend/.env.example` — `THROTTLE_TTL_MS`, `THROTTLE_SCAN_LIMIT`

**الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint`

---

### ✅ Fix 5 — CORS من env var
**المشكلة:** `origin: 'http://localhost:5173'` hardcoded — production deployments تفشل  
**الحل:** `origin: process.env.FRONTEND_URL ?? 'http://localhost:5173'`  
**الملفات:** `backend/src/main.ts`, `backend/.env.example`

---

### ✅ Fix 6 — Firestore composite index
**المشكلة:** `.where('status', '==', 'done').orderBy('createdAt', 'asc')` بدون index — Firestore ترمي error  
**الحل:** `backend/firestore.indexes.json` مع الـ index المطلوب  
**الملفات الجديدة:** `backend/firestore.indexes.json`  
**ملاحظة:** يجب deploy الـ index عبر `firebase deploy --only firestore:indexes`

---

### ✅ Fix 7 — Typo في parser.ts
**المشكلة:** `detectMention(reponse: string, ...)` — `reponse` بدل `response`  
**الحل:** تصحيح اسم الـ parameter  
**الملفات:** `backend/src/ai/parser.ts:10`

---

### ✅ Fix 8 — README تحديث
**المشكلة:** README يذكر `VisibilityOrchestrator` (لا يوجد) و "15 parallel prompts" (غير دقيق)  
**الحل:** تحديث architecture diagram + شرح scan workflow + إضافة env vars الجديدة  
**الملفات:** `README.md`

**الاختبار الشامل:** ✅ `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint`

---

## [2026-05-13] — Session 2: Fixes + Auto Scheduling

### ✅ Fix 1 — Scan failure handling
**المشكلة:** الـ scan يبقى `running` إلى الأبد لو فشل الذكاء الاصطناعي أو Firestore  
**الحل:** try/catch في `createScan()` — يُحدّث status إلى `'failed'` عند الخطأ ويُعيد رمي الـ exception  
**الملفات المعدّلة:**
- `backend/src/scans/scans.service.ts` — إضافة try/catch حول AI call + batch.commit()

**الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint`

---

### ✅ Fix 2 — Configurable throttling + model name consistency
**المشكلة:** عدد المحركات والأسئلة hardcoded بـ `slice(0,2)` — لا يمكن تغييرها بدون تعديل الكود. اسم الـ model المتضارب بين الكود وملف `.env.example`  
**الحل:** 4 متغيرات بيئية جديدة: `AI_MAX_ENGINES`, `AI_MAX_PROMPTS`, `AI_CONCURRENCY`, `AI_DELAY_MS`. إصلاح default من `nvidia/nemotron...` إلى `meta-llama/llama-3.3-70b-instruct:free`  
**الملفات المعدّلة:**
- `backend/src/ai/ai.service.ts` — قراءة المتغيرات من ConfigService بدلاً من قيم hardcoded
- `backend/.env.example` — إضافة المتغيرات الأربعة + متغيرات الـ scheduler

**الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint`

---

### ✅ Dev 1 — Auto Scheduling (Cron)
**الهدف:** تشغيل scan تلقائي لكل العلامات المحفوظة حسب جدول زمني (cron)  
**التصميم:**
- معطّل بالافتراضي (`SCAN_SCHEDULE_ENABLED=false`) — opt-in
- يقرأ كل brands من Firestore التي لها `category` محفوظة
- ينفّذ scans بشكل تسلسلي (sequential) لتجنّب rate limit
- يسجّل النجاح والفشل لكل brand منفصلاً

**تغيير في البيانات:** `Brand` document يخزّن الآن `category` (يُحدَّث في كل scan جديد)  
**الملفات الجديدة:**
- `backend/src/scheduler/scheduler.service.ts` — خدمة الجدولة
- `backend/src/scheduler/scheduler.module.ts` — NestJS module

**الملفات المعدّلة:**
- `backend/src/app.module.ts` — إضافة `ScheduleModule.forRoot()` + `SchedulerModule`
- `backend/src/scans/scans.module.ts` — إضافة `exports: [ScansService]`
- `backend/src/scans/scans.service.ts` — `getOrCreateBrand()` تقبل وتخزّن `category`
- `backend/src/common/types.ts` — إضافة `category?: string` لـ `Brand` interface

**الحزم المثبّتة:** `@nestjs/schedule@6.1.3`

**الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint`

---

### ✅ Lint cleanup — pre-existing errors
**المشكلة:** 15 خطأ lint موجودة قبل هذه الجلسة في `analytics.service.ts` و `main.ts`  
**الحل:**
- `analytics.service.ts`: typing صريح لبيانات Firestore (`as Scan`, `as ScanResult`, `as Brand`)، تحديث signature `aggregateByEngine()` ليستخدم `ScanResult[]` بدل `FirebaseFirestore.DocumentData[]`
- `main.ts`: `bootstrap()` → `void bootstrap()` لإصلاح floating promise warning

**الملفات المعدّلة:**
- `backend/src/analytics/analytics.service.ts`
- `backend/src/main.ts`

**الاختبار:** ✅ `npm run lint` — صفر أخطاء، صفر تحذيرات

---

## [2026-05-13] — Session 1: Documentation baseline

### ✅ Knowledge graph (graphify)
- تحليل 41 ملف TypeScript/React
- 125 node، 127 edge، 29 community
- الملفات: `graphify-out/graph.json`, `graphify-out/graph.html`, `graphify-out/GRAPH_REPORT.md`

### ✅ Documentation baseline
الملفات المُنشأة في `docs/`:
- `PROJECT_AUDIT.md` — ما هو المشروع، الحالة، Stack، المخاطر
- `ARCHITECTURE_MAP.md` — خريطة الـ modules، مسؤوليات الـ services، Firestore schema
- `WORKFLOW_ANALYSIS.md` — جميع الـ workflows من البداية للنهاية
- `CODE_EXPLANATION.md` — شرح كل ملف وكل function مهمة
- `RISKS_AND_GAPS.md` — 18 مشكلة مصنّفة بالأولوية
- `DEVELOPMENT_ROADMAP.md` — خطة التطوير بالمراحل

**الاكتشاف الرئيسي:** `VisibilityOrchestrator` المذكور في README غير موجود كـ class في الكود — `AIService.runScan()` هو الـ orchestrator الفعلي.
