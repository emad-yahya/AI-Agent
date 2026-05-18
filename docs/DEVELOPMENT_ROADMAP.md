# DEVELOPMENT_ROADMAP.md
_آخر تحديث: 2026-05-13 (Session 13)_

---

## Phase 0 — Critical Fixes ✅ مكتملة

### ✅ 0.1 — Scan failure handling
**تم:** 2026-05-13 | **الملف:** `backend/src/scans/scans.service.ts`
try/catch حول AI call + batch write. الـ scan يُسجَّل `failed` عند الخطأ.

### ⬜ 0.2 — Verify serviceAccountKey.json is gitignored
**الملف:** `.gitignore`
تحقق يدوي مطلوب: تأكد أن `serviceAccountKey.json` مُستبعد من git. لو سُبق commit له يوماً، دوّر الـ credentials من Firebase Console.

### ✅ 0.3 — Fix OpenRouter model name inconsistency
**تم:** 2026-05-13 | **الملف:** `backend/src/ai/ai.service.ts`
Code default يطابق `.env.example`: `meta-llama/llama-3.3-70b-instruct:free`

### ✅ 0.4 — Fix typo in main.ts (floating promise)
**تم:** 2026-05-13 | **الملف:** `backend/src/main.ts`
`bootstrap()` → `void bootstrap()`

### ✅ 0.5 — Fix pre-existing lint errors
**تم:** 2026-05-13 | **الملفات:** `backend/src/analytics/analytics.service.ts`
Firestore `DocumentData` → typed as `Scan`/`ScanResult`/`Brand`

---

## Phase 1 — Restore + Configure Behavior ✅ مكتملة

### ✅ 1.1 — Make throttling configurable via env vars
**تم:** 2026-05-13
`AI_MAX_ENGINES`, `AI_MAX_PROMPTS`, `AI_CONCURRENCY`, `AI_DELAY_MS` في `.env`

### ✅ 1.2 — Update README to match real code
**تم:** 2026-05-13 | حذف `VisibilityOrchestrator`، تصحيح scan count، إضافة env vars.

---

## Phase 2 — Reliability & Safety ✅ مكتملة

### ✅ 2.1 — Rate limiting on POST /api/scans
**تم:** 2026-05-13 | `@nestjs/throttler@6.5.0` — 5 req/min per IP (configurable via env)

### ✅ 2.2 — CORS configurable via env
**تم:** 2026-05-13 | `origin: process.env.FRONTEND_URL ?? 'http://localhost:5173'`

### ✅ 2.3 — Create Firestore composite index
**تم:** 2026-05-13 | `backend/firestore.indexes.json` — deploy via `firebase deploy --only firestore:indexes`

### ✅ 2.4 — Fix parser.ts typo
**تم:** 2026-05-13 | `backend/src/ai/parser.ts:10` — `reponse` → `response`

---

## Phase 3 — Testing

### ✅ 3.1 — Unit tests for parser.ts
**تم:** 2026-05-13 | **الملف:** `backend/src/ai/parser.spec.ts`
35 tests — detectMention، detectPosition، detectSentiment، calcVisibilityScore، parseResponse. moduleNameMapper أضيف لـ jest config.

### ✅ 3.2 — Unit tests for AIService
**تم:** 2026-05-13 | **الملف:** `backend/src/ai/ai.service.spec.ts`
11 tests — mock `callLLM` via `jest.spyOn`، يغطّي `runScan()` + `runWithConcurrency()` + result typing + error handling.

### ✅ 3.3 — Integration tests (ScansService)
**تم:** 2026-05-13 | **الملف:** `backend/src/scans/scans.service.integration.spec.ts`
10 tests — in-memory Firebase mock + AIService spy. يغطّي `createScan`, `getScanResults`, `listScansByBrand`, `compareBrands`.

---

## Phase 5 — Recommendations Engine ✅ مكتملة

### ✅ 5.1 — AI-powered industry-specific recommendations
**تم:** 2026-05-13 (Session 7)
- `AIService.generateText()` — single LLM call with 2000 token budget
- `ScansService.generateRecommendations()` + `buildRecommendationsPrompt()` — industry-aware prompt, 25s timeout
- Recommendations stored on scan document in Firestore after each scan
- `getScanResults()` returns `recommendations[]` alongside results
- **Frontend:** `RecommendationsPanel.tsx` — grouped by priority (high/medium/low), expandable cards, steps + platforms + expected impact
- **الملفات الجديدة:** `frontend/src/components/RecommendationsPanel.tsx`
- **الملفات المعدّلة:** `backend/src/common/types.ts`, `backend/src/ai/ai.service.ts`, `backend/src/scans/scans.service.ts`, `frontend/src/api/client.ts`, `frontend/src/App.tsx`
- **الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 56/56 | ✅ frontend `tsc --noEmit`

### ✅ 5.2 — Delta indicator in Dashboard stat cards
**تم:** 2026-05-13 (Session 8)
- `StatCard.tsx` — `delta?: number | null` + `deltaUnit?: string` props
- Green TrendingUp / red TrendingDown — "+X pts vs last scan"
- Dashboard computes score + mention deltas from last 2 timeline points
- **الملفات المعدّلة:** `frontend/src/components/StatCard.tsx`, `frontend/src/pages/Dashboard.tsx`
- **الاختبار:** ✅ frontend `tsc --noEmit`

### ✅ 5.3 — SEO Module (Google keyword ranking tracking)
**تم:** 2026-05-13 (Session 9)
- Google Custom Search API integration — position detection per keyword (top 10 results)
- `POST /api/seo/scans` → fire-and-forget | `GET /api/seo/scans/:brandId/:scanId` → poll until done
- Frontend: `SeoScanForm.tsx` + `SeoResultsTable.tsx` (2s polling, position badges)
- "SEO" tab in App. `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_ID` + `SEO_DELAY_MS` in `.env`
- Graceful degradation: no CSE keys → all results `found: false` (no crash)

---

## Phase 4 — New Features (الخطوة القادمة المقترحة)

### ✅ 4.1 — Real-time scan progress (SSE)
**تم:** 2026-05-13
- `GET /api/scans/stream/:scanId` — SSE endpoint
- `ScanForm.tsx` — progress bar حقيقي: "Scanning 2/4 calls..."
- Fire-and-forget pattern: POST returns immediately, scan runs in background

### ⬜ 4.2 — Rate limiting (⬆ تم نقله لـ Phase 2)

### ✅ 4.3 — Scan history في الواجهة
**تم:** 2026-05-13
- `GET /api/scans?brand=X` — endpoint جديد
- `ScanHistory.tsx` — expandable table في Dashboard
- Lazy load results per scan + in-memory cache

### ✅ 4.4 — Competitor comparison
**تم:** 2026-05-13
- `POST /api/scans/compare` — يأخذ `brands[]` (2-4) + category، يرجع مقارنة جانبية
- `CompareForm.tsx` + `ComparisonTable.tsx` + tab جديد في `App.tsx`

### ✅ 4.5 — Analytics pre-aggregation
**تم:** 2026-05-13 (Session 7)
`ScanSummary` docs في `brands/{id}/scanSummaries/{scanId}`. Analytics fast path: O(n) reads بدل O(n×m). Backward-compatible fallback.

### ✅ 4.6 — Export (CSV/PDF)
**تم:** 2026-05-13 (Session 8)
- `ExportButtons.tsx` — CSV (Blob download) + PDF (print window with styled HTML)
- ScanForm callback passes brand + category; App stores scanMeta

### ✅ 4.7 — Auth (API key)
**تم:** 2026-05-13 (Session 7)
`ApiKeyMiddleware` global — opt-in عبر `API_KEY` env var. Supports `Authorization: Bearer` + `x-api-key`. Frontend axios interceptor.

### ⬜ 4.8 — Auto Scheduling ✅ تم
**تم:** 2026-05-13

---

## Phase 12 — Action Machine (Session 14)

### ✅ 12.1 — 30-Day Action Roadmap
**تم:** 2026-05-14 | **الملفات:** `frontend/src/components/ActionPlan.tsx`, `frontend/src/App.tsx`
- Component يحوّل الـ recommendations إلى timeline بصري: Week 1 / Week 2–3 / Week 4+
- Bucketing: high priority → Week 1, medium → Week 2–3, low → Week 4+
- Effort estimate per week: يحسب تلقائياً من حقل `effort` في كل recommendation
- يظهر بعد كل scan تلقائياً — zero backend changes — zero extra API calls

### ✅ 12.2 — Content Generator (real LLM output)
**تم:** 2026-05-14 | **الملفات:** `backend/src/scans/generate-content.dto.ts`, `backend/src/scans/scans.service.ts`, `backend/src/scans/scans.controller.ts`, `frontend/src/components/ContentGenerator.tsx`, `frontend/src/api/client.ts`, `frontend/src/App.tsx`
- `POST /api/scans/content` — real endpoint, `AIService.generateText()`, platform-specific prompts
- 4 platforms: GMB (≤750 chars) | LinkedIn | Blog (Markdown outline) | Twitter (3 variants)
- Prompt informed by real scan context (mentionRate + avgScore)
- Copy button + char counter in frontend, collapsible panel

### ✅ 12.3 — Impact Predictor (real data)
**تم:** 2026-05-14 | **الملفات:** `frontend/src/components/ImpactPredictor.tsx`, `frontend/src/App.tsx`
- Effective Reach Score = `sum(ALL visibilityScores) / total` — يشمل الـ non-mentions كـ 0
- Week 1 target: silent engines → 50% mention rate @ score=40 (minimum من formula الفعلية)
- Ceiling: all non-mentioned → current mention quality (`stats.avgScore`)
- Per-engine bars + potential gain — كل رقم مشتق من scan data — zero heuristics

---

## Phase 11 — Differentiating Features ✅ مكتملة (Session 12)

### ✅ 11.1 — Scheduled PDF Reports (Email)
**تم:** 2026-05-13 | **الملفات:** `backend/src/alerts/reports.service.ts` + `alert-settings.dto.ts` + `alerts.service.ts` + `alerts.module.ts` + `frontend/src/components/AlertSettings.tsx`
- Cron: weekly (Mon 9am) + monthly (1st 9am)
- HTML email: score + delta + mention rate + trend table
- UI: Off / Weekly / Monthly + report email input

### ✅ 11.2 — Share of Voice (SOV) Chart
**تم:** 2026-05-13 | **الملفات:** `frontend/src/components/SovChart.tsx`
- Donut pie chart + table — auto-computed from compareResult (no extra backend call)
- يظهر في Compare tab بعد comparison

### ✅ 11.3 — Prompt Coverage Map
**تم:** 2026-05-13 | **الملفات:** `frontend/src/components/PromptCoverageMap.tsx` + `backend/src/analytics/analytics.service.ts` + `analytics.controller.ts`
- `GET /api/analytics/coverage?brand=X`
- Grid: 5 intents × 3 engines — ✅/❌/— per cell + counter badge

---

## الأولوية الموصى بها الآن

✅ **Roadmap الأساسي + Phase 11 كاملة**

---

## Phase 6 — Core Scan Upgrade ⬜ (يحتاج API keys خارجية)

> **تنبيه:** هذه الـ phase تحتاج API keys مدفوعة. OpenAI ($5 minimum) + Perplexity ($5 minimum).
> يمكن تأجيلها وتنفيذ Phase 7, 8, 9 أولاً بدون أي تكلفة إضافية.

### ⬜ 6.1 — Real AI Engines (OpenAI GPT-4o-mini + Perplexity sonar)
**السبب:** الآن المشروع يبعث prompts لـ OpenRouter يحاكي engines — مش test حقيقي.
Perplexity search-grounded = يعطي نتائج من web في real-time.
- إضافة `OpenAIProvider` + `PerplexityProvider` في `ai.service.ts`
- كل engine يعطي score مستقل حقيقي
- المتغيرات: `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` في `.env`
- **التكلفة التقديرية:** ~$0.001 لكل scan (رخيصة جداً بعد أول $5)

### ⬜ 6.2 — Language / Market Variants
**السبب:** brands في Dubai تحتاج visibility بالعربي والإنجليزي — نتائج مختلفة.
- نفس الـ scan يُشغَّل بـ `language: 'ar' | 'en' | 'fr'`
- Prompts مترجمة per language في `prompts.ts`
- Frontend: language selector في ScanForm

---

## Phase 7 — Intelligence Layer ✅ مكتملة

### ✅ 7.1 — Topic Intelligence (Citation Tracker simplified)
**السبب:** أهم سؤال عند العميل: "ليش AI يذكرني؟ أو ليش ما يذكرني؟"
- Perplexity يرجع sources/URLs مع كل إجابة — نستخرجها ونحلّلها
- Firestore: `brands/{id}/citations/{date}` — source URL + frequency
- Frontend: Citations tab — "Top 5 sources AI uses when mentioning your brand"
- **يحتاج 6.1 أولاً** (Perplexity required)

### ✅ 7.2 — Trend Anomaly Detection
**السبب:** عميل ما يشيك dashboard كل يوم — يحتاج يُنبَّه تلقائياً.
- خوارزمية Z-score على آخر 10 scans
- إذا score انخفض 20+ نقطة → flag + سبب محتمل
- Stored في Firestore كـ `anomaly: true` على الـ scan doc
- Frontend: أيقونة تحذير في ScanHistory عند anomaly

### ✅ 7.3 — Competitor Intelligence Dashboard
**السبب:** enhance الـ compare الموجود من one-time إلى tracked over time.
- كل scheduled scan يشمل competitors تلقائياً
- Dashboard: "This week — You +3, Competitor A +12, Competitor B -8"
- Leaderboard per category مع trend arrows

---

## Phase 8 — Client Deliverables ✅ مكتملة

### ✅ 8.1 — Branded PDF Report (Professional)
**السبب:** العميل يحتاج يعرض النتائج لـ management — print window مش كافي.
- `react-pdf` أو `puppeteer` — PDF فعلي مش print
- Logo + brand colors قابلة للتخصيص
- Executive summary: score، trend chart، top recommendations
- يُولَّد من `GET /api/scans/:brandId/:scanId/report`

### ✅ 8.2 — Brand Alerts (Email)
**السبب:** عميل يحدد threshold → يوصله email تلقائي لما score ينخفض.
- `ALERT_SCORE_THRESHOLD` per brand في Firestore
- Nodemailer/SendGrid — email عند trigger
- Alert: "Your brand score dropped from 65 → 38 — action needed"
- Settings UI: threshold input per brand

### ✅ 8.3 — Slack / Teams / Webhook Integration
**السبب:** teams تتابع AI visibility ضمن workflow الموجود عندهم.
- `WEBHOOK_URL` per brand في Firestore settings
- POST JSON payload عند: scan complete + score drop + anomaly
- Weekly digest اختياري: summary of week's scans
- Frontend: Settings tab — webhook URL input + test button

---

## Phase 9 — Infrastructure ✅ مكتملة (Session 13)

### ✅ 9.1 — BullMQ Job Queue (Redis)
**تم:** 2026-05-13 | **الملفات:** `backend/src/scans/scan-queue.constants.ts`, `backend/src/scans/scan.processor.ts`, `backend/src/scans/scans.service.ts`, `backend/src/scans/scans.module.ts`, `backend/src/app.module.ts`
- BullMQ + Redis اختياري: إذا `REDIS_URL` مضبوط → queue jobs. إذا لا → fire-and-forget (backward compat)
- `ScanProcessor` يستقبل jobs ويشغّل `runScanInBackground()` — scan لا يضيع عند backend restart
- `@Optional() @InjectQueue` في `ScansService` — NestJS يدير lifecycle تلقائياً

### ✅ 9.2 — Docker Compose
**تم:** 2026-05-13 | **الملفات:** `docker-compose.yml`, `backend/.env.example`
- Redis 7-alpine مضاف مع persistent volume + health dependency
- Backend يأخذ `REDIS_URL=redis://redis:6379` تلقائياً في Docker
- One command: `docker compose up`

---

## Phase 10 — Monetization ⬜ (آخر شي)

> **لماذا آخر شي؟** Auth + Billing تُغلّف كل شي — تُبنى فوق product ناضج مكتمل.

### ⬜ 10.1 — Firebase Auth + Multi-tenant
**السبب:** بدون login ما في SaaS — كل brands مرئية لكل زائر.
- Firebase Auth: Google + Email/Password
- كل Brand مربوطة بـ `userId`
- Firestore Security Rules: user يشوف brands تبعه بس
- Frontend: Login/Signup pages + auth guards على كل routes
- Backend: verify Firebase ID token middleware (يحل محل API key)

### ⬜ 10.2 — Stripe Billing + Plans
**السبب:** المنتج يحتاج revenue model واضح.
```
Free:    5 scans/month — 1 brand — no alerts
Pro:     $29/mo — unlimited scans — 5 brands — alerts + PDF
Agency:  $99/mo — unlimited brands — white-label — priority queue
```
- Stripe Checkout + webhooks
- `subscription_status` في Firestore per user
- Feature gates: Pro check قبل generate recommendations/alerts
- Billing portal: عميل يدير subscription بنفسه

---

## ملخص الـ Phases القادمة

| Phase | الاسم | يحتاج تكلفة؟ | الأولوية |
|---|---|---|---|
| 6 | Core Scan Upgrade (Real Engines) | ✅ OpenAI + Perplexity $5-10 | بعد Phase 7, 8 |
| 7 | Intelligence Layer | ❌ لا | عالية |
| 8 | Client Deliverables (PDF + Alerts + Webhooks) | ❌ لا | عالية |
| 9 | Infrastructure (BullMQ + Docker) | ❌ لا | متوسطة |
| 10 | Monetization (Auth + Billing) | ❌ لا* | آخر شي |

*Stripe: مجاني للتطوير، 2.9% + $0.30 فقط على transactions حقيقية

**الترتيب المنصوح:** 7 → 8 → 9 → 6 → 10
