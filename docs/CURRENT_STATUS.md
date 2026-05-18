# CURRENT_STATUS.md
_آخر تحديث: 2026-05-18 (Session 27)_

**🟢 LIVE في prod**
- Frontend: https://ai-agent-frontend-two-eosin.vercel.app (Vercel)
- Backend: https://backend-production-e169.up.railway.app (Railway)
- GitHub: emad-yahya/AI-Agent (main)

---

### [2026-05-18] Session 27 — Citation Extractor (GEO Tier 1 #1)

**ليه:** السستم كان يقيس visibility فقط. علشان البراند **يرتب** أعلى لازم نعرف وين AI engines يقرأوا. Gemini grounding metadata يرجع URLs بكل response — قاعدة لكل GEO improvements.

**التطبيق:**
- `callGemini` يرجع `{ text, citations[] }` بدل string. `extractGeminiCitations` يسحب URIs من `groundingMetadata.groundingChunks`. citations فقط للـ Perplexity-style (الـ search-grounded).
- `ScanResult.citations[]` يتخزن على Firestore.
- `CitationsPanel` UI: top domains by frequency، coverage % (كم page منهم ذكرت اسم البراند)، تحذير لو 0 sources.

**جاي:** Listicle Gap Finder (#2) + Schema/llms.txt Audit (#3).

---

### [2026-05-18] Session 26 — Quick Scan + Full GEO Scan

**الهدف الكبير (GEO product vision):**
- البراند = الكاتغوري نفسها. أي شخص يسرش على AI عن أي شي له علاقة بالكاتغوري (خدمة معينة، موقع، badget، بديل، مراجعة) لازم اسم البراند يطلع.
- علشان نقيس هذا، الـ scan ما يكفي يكون 5 أسئلة عامة. لازم يغطي scenarios حقيقية متعددة (services × locations × budgets × personas).

**التطبيق:**
- **Quick Scan (default):** 5 prompts × 3 engines = 15 calls (~1 min). spot-check سريع.
- **Full GEO Scan:** 30 prompts × 3 engines = 90 calls (~6 min). 6 prompts per intent bucket × 5 buckets، كل prompt مربوط بسيناريو ملموس مختلف (حي + ميزانية + نوع + persona).
- Toggle بالـ ScanForm UI، الـ progress bar يعرف total تلقائياً.
- `Scan.mode` بيتخزن على Firestore لكل scan (للـ analytics المستقبلية).

**جاهز للتعليق على Railway/Vercel بمجرد push.**

---

### [2026-05-18] Session 25 — Production Deploy

**النشر:**
- Frontend → Vercel (Vite + React 19)
- Backend → Railway (NestJS 12 + Firestore)
- Auto-deploy من GitHub `main` لكلا الـ services

**التغييرات للـ prod readiness:**
1. `FirebaseService.loadCredential()` — يقرأ `FIREBASE_SERVICE_ACCOUNT_JSON` env var (مطلوب لـ Railway لأنه ما يدعم رفع ملفات) مع fallback لملف محلي
2. CORS in `main.ts` يطبّق `.replace(/\/+$/, '')` على `FRONTEND_URL` (browsers تطلب exact match — trailing slash يكسر كل شي)
3. `backend/package-lock.json` مولّد منفصلاً ليشتغل `npm ci` بالـ Dockerfile (workspace lockfile بالـ root ما يكفي)

**التحقق:**
- 9/9 critical endpoints 200 (analytics, scans, seo, alerts, scheduler)
- CORS strict pass، Auth 401 بدون key
- Firestore connected، 10 brands

**معلوم minor:** `GET /api/seo/scans` بدون `?brand=` يرجع 500 (legacy، frontend ما يستعمله).

---

### [2026-05-18] Session 24 — Dashboard 500 Fix

**المشكلة:** `/api/analytics?brand=platinum%20square` يرجع 500. براندات أخرى شغّالة.

**Root cause:** Slow path في `AnalyticsService.buildFromResults()` يستخدم `where('status','==','done').orderBy('createdAt','asc')` — يتطلب composite index `(status, createdAt)`. Index معرّف بـ `backend/firestore.indexes.json` بس ما انتشر → Firestore يرجع `FAILED_PRECONDITION`.

**الفيكس:** في `backend/src/analytics/analytics.service.ts`:
- Query بـ `orderBy('createdAt','asc')` فقط (single-field، ما يحتاج composite index)
- Filter `status === 'done'` بالذاكرة
- Division-by-zero guard على `mentionRate`

**التيست:** ✅ 3 براندات Platinum Square variants ترجع 200 | ✅ jest 63/63 | ✅ tsc = 0 errors

**Follow-up اختياري (يحتاج موافقة لأنها prod writes):**
1. `firebase deploy --only firestore:indexes` — ينشر الـ index الحقيقي ويرجع الـ query الأصلي أسرع
2. Backfill `scanSummaries` للسكانات القديمة → fast path للكل

---

## حالة المشروع الآن

**قابل للتشغيل:** نعم — يمكن تشغيل backend و frontend محلياً بعد إعداد `.env` و `serviceAccountKey.json`
**حالة البناء:** ✅ `tsc --noEmit` — صفر أخطاء | `npm run build` — ناجح | `npm run lint` — صفر أخطاء

---

## ما تم إنجازه (مرتب من الأحدث)

### [2026-05-16] Session 23 — Bug Fixes + End-User Guide UI

**الهدف:** بعد التيست الشامل، إصلاح 3 bugs لقيناهن + إضافة شروحات بسيطة لكل section بالفرونت ليفهم اليوزر العادي.

#### Bug Fixes
1. **Playbook كان يلتقط أماكن/عبارات عامة:** "Palm Jumeirah", "Downtown Dubai", "Market Knowledge" → كانت تطلع كمنافسين.
   - **Fix:** أضفنا `NON_COMPANY_PHRASES` set + filter للـ "In ..." pattern + تعليمات صارمة بالـ LLM prompt ليتجاهل locations/concepts.
   - **بعد الفيكس:** Knight Frank, Jones Lang LaSalle, Emaar Properties, Espace Real Estate — كلهم شركات حقيقية ✓

2. **Coverage Map كان كلو dashes:** Dynamic prompts تستخدم نص مختلف عن الـ keywords الثابتة.
   - **Fix:** أضفنا `templateId` على ScanResult + `AIService.REQUIRED_PROMPT_IDS` يفرض IDs canonical على dynamic prompts. Coverage يطابق بـ `templateId === intent.templateId` مع fallback للسكانات القديمة.
   - **بعد الفيكس:** Coverage Map يظهر Y/N حقيقية لكل cell ✓

3. **Serper كان يفشل بدون retry:** SEO scans كانت تفشل mid-way إذا 429 أو timeout.
   - **Fix:** أضفنا retry logic مع backoff (5s للـ 429، 2s للـ 5xx، retry على abort) — حتى 2 محاولات.

#### End-User Guide UI (شروحات بسيطة لكل section)
- **`Hint.tsx`** جديد — مكوّنين قابلين لإعادة الاستخدام:
  - `<Hint text="..." />` — أيقونة (?) مع tooltip hover للـ metric labels
  - `<SectionIntro>` — شريط أزرق فاتح يشرح كل section بلغة بسيطة
- **شروحات مضافة بـ:**
  - ResultsTable: SectionIntro + tooltips على كل من Total/Mentioned/Mention rate/Avg score
  - TopicsPanel: شرح إنها معظمها منافسين
  - PromptCoverageMap: شرح معنى ✓ ✗ —
  - RecommendationsPanel: شرح اللي high/medium/low + click to expand
  - ActionPlan: شرح 30-day roadmap
  - AlertSettings: شرح threshold + email/webhook
  - SeoSiteResults: SectionIntro + tooltips على Keywords/Ranked/Avg position/Target market
  - ScheduledScansPanel: شرح ليش تفعّل auto-scans
  - SeoCompareView: شرح keyword overlap
  - Dashboard page: SectionIntro للتاب كلو
  - App.tsx: SectionIntro فوق كل تاب (Scan/Compare/SEO)

#### Quality
- ✅ tsc backend + frontend — 0 errors
- ✅ jest 63/63 passed
- ✅ Re-test playbook + coverage — يعطوا بيانات صحيحة

---

### [2026-05-16] Session 22 — Competitor Playbook (Reverse-Engineer AI Visibility)

**الهدف:** المستخدم يريد يفهم **ليش** الـ AI engine يذكر منافسيه بأول النتائج وكيف يقلّدهم ليسبقهم.

#### الكود
- **types:** `CompetitorPlaybookEntry { competitor, mentionFrequency, whyNotable, strategy, howToReplicate, quickWins[] }` في `common/types.ts`
- **`ScansService.generateCompetitorPlaybook()`** جديد:
  1. يستخرج top 5 competitors من `topics` فيلد عبر كل scan results
  2. يحسب frequency لكل منافس
  3. يبني prompt لـ Gemini فيه context كامل: قائمة منافسين + sample AI response
  4. AI يجاوب JSON منظّم: لكل منافس → whyNotable + strategy + howToReplicate + quickWins[]
  5. graceful fallback لو فشل أو لا يوجد منافسين
- **دمج بـ `runScanInBackground`:** يُولّد بالـ parallel مع recommendations (`Promise.all`) — صفر زيادة بوقت السكان
- **timeout protection:** `Promise.race` مع 25s
- **`getScanResults`** يرجع `competitorPlaybook` ضمن الـ payload
- **Frontend types** + `ScanResponse.competitorPlaybook[]`

#### Frontend
- **`CompetitorPlaybook.tsx`** جديد — collapsible accordion:
  - Numbered competitor entries (gradient red/orange badge)
  - 3 sections per entry: Why AI knows them / Their strategy / How to replicate
  - Quick wins box (amber, با ⚡ icon) — actionable items للأسبوع الحالي
  - Auto-expand لأول competitor
- **App.tsx:** يظهر بعد ImpactPredictor، قبل ActionPlan

#### Example Output (متوقع للـ Platinum Square)
لكل منافس (Coldwell Banker, Keller Williams, Berkshire Hathaway, propertyfinder.ae) يطلع:
- ليش معروف للـ AI (شبكة عالمية / Wikipedia / paid PR / إلخ)
- استراتيجيتو (content authority / SEO / partnerships)
- كيف Platinum Square يقلّد (30-90 يوم خطة)
- 3 quick wins للأسبوع

#### Quality
- ✅ tsc backend + frontend — 0 errors
- ✅ jest 63/63 passed
- ✅ eslint backend — 0 errors

---

### [2026-05-15] Session 21 — 6-Feature Sprint (Priority Backlog Complete)

نفّذت 6 فيتشرات بالأولوية في جلسة واحدة:

#### #1 Mention Detection محسّن (fuzzy match)
- `backend/src/ai/parser.ts` — أُضيفت `brandVariations()` تولد 4-6 variants لكل brand:
  - Strip corporate suffix: "Apple Inc." → "Apple"
  - Strip "The" prefix
  - Hyphen ↔ space ↔ glued: "Coca-Cola" / "Coca Cola" / "CocaCola"
  - & ↔ "and" + spaced/unspaced
- `matchesAny()` يستخدم regex with ASCII-letter lookarounds (مو `\b`) — "Apple" ما يطابق "Pineapple" بعد الآن
- `detectMention`, `detectPosition`, `detectSentiment` كلها تستخدم النظام الجديد
- 7 unit tests جديدة → **63/63 passed**

#### #2 UI Toggle للـ Scheduled Scans
- `backend/src/scheduler/scheduler.service.ts` أُعيد كتابتها:
  - Firestore-stored config (`config/scheduler` doc) — runtime toggle بدون restart
  - methods: `enable(cron)`, `disable()`, `runNow()`, `getStatus()` — مع تحقق من صحة cron
  - يطلع next-run + last-run + result من telemetry
- Endpoints جديدة: `GET /api/scheduler/status`, `POST /api/scheduler/enable|disable|run-now`
- Frontend: `ScheduledScansPanel` بالـ Dashboard — 4 presets (every 6h, daily 9am, daily midnight, weekly) + custom cron input + Run Now + Disable

#### #3 Position Trend Charts للـ SEO
- `frontend/src/components/SeoTrendChart.tsx` جديد — Recharts dual-axis:
  - Y-left: avg position (reversed scale، 1 فوق، 10 تحت)
  - Y-right: coverage % (ranked/total)
  - reference line عند position 3 (أعلى الصفحة الأولى)
  - delta vs first scan (↑ improved / ↓ dropped / → stable)
- يظهر تلقائياً لما يوجد ≥ 2 completed scans للموقع

#### #4 Anomaly Detection للـ SEO
- `seo.service.ts` — `detectAnomalies()` يقارن السكان الحالي مع السابق:
  - **position_drop / position_gain** (Δ ≥ 1.5)
  - **coverage_drop / coverage_gain** (Δ ≥ 15%)
  - **keyword_lost / keyword_gained** (top-10 status change)
- severity: high / medium / info
- `SeoSiteScan.anomalies?: SeoAnomaly[]` يُحفظ على scan doc
- Frontend: `AnomalyBanner` في `SeoSiteResults` — لون أحمر/أصفر/أخضر حسب الشدة

#### #5 Multi-Site SEO Compare
- Backend: `seoService.compareSites([siteIds])` + `GET /api/seo/compare?siteIds=...`
- يرجع:
  - per-site latest scan summary
  - keyword overlap matrix (مرتب: keywords ranked عبر أكثر sites أولاً)
- Frontend: `SeoCompareView` — checkbox picker (2-4 sites) + side-by-side stat cards + overlap table (color-coded positions)
- زر toggle بأعلى تبويب SEO

#### #6 Export PDF/CSV للـ SEO
- `SeoExportButtons.tsx` جديد:
  - **CSV:** Keyword, Position, Title, URL, Top 3 Competitors, SERP Features
  - **PDF (jsPDF):** Header + Stats + Anomalies + Keyword rankings table + Top competitors
- يظهر فوق `SeoSiteResults` عند status=done

#### Quality
- ✅ `tsc --noEmit` backend + frontend — صفر errors
- ✅ `jest` **63/63 passed** (7 جديدة لـ fuzzy match)
- ✅ `eslint` backend — 0 errors (2 warnings فقط)

---

### [2026-05-15] Session 20 — Dynamic Category-Aware Prompts

**الهدف:** كل scan تتولّد لو 5 أسئلة طبيعية مخصصة لمجال البراند بدل templates عامة جامدة.

#### الكود
- **`AIService.generateCategoryPrompts(category)`** جديد:
  - يستخدم `generateText()` (`gemini-2.5-flash-lite`) ليولّد 5 prompts ديناميكية
  - LLM prompt يفرض:
    - 5 أسئلة بلهجة محادثة طبيعية
    - 2 منها تحوي `{brand}` placeholder
    - 3 منها لا تذكر البراند (pure category)
    - تغطية 5 intents (best/alternatives/reputation/buying/market)
  - JSON parser صارم — يرفض output ناقص ويرجع للـ static fallback
- **In-memory cache** — `Map<categoryKey, PromptTemplate[]>` يحفظ النتيجة، scan ثاني على نفس category يعيد استخدامها (يوفّر LLM call)
- **Graceful fallback** — أي فشل بالتوليد (network, JSON malformed, missing count) → يرجع لـ static `SEARCH_PROMPTS`
- **`runScan()`** الآن `await this.generateCategoryPrompts(category)` قبل البدء

#### النتائج الفعلية (3 categories تيست)

| Category | Sample Generated Prompt |
|---|---|
| `real estate broker dubai` | "Top-rated real estate brokers in Dubai right now for **luxury apartments**?" |
| `real estate broker dubai` | "Market leaders in Dubai for **off-plan investments**?" |
| `saas crm software` | "Best all-around SaaS CRM software for **small businesses with a tight budget**?" |
| `saas crm software` | "Common pitfalls to avoid when choosing a CRM?" |

**كل سؤال يستخدم لغة المجال الحقيقية** — مو templates نمطية.

#### Quality
- ✅ `tsc --noEmit` backend — صفر errors
- ✅ `jest` 56/56 passed (ai.service.spec محدّث ليmock الـ generator)
- ✅ Graceful degradation — لو Gemini فشل، السكان يكمّل بـ static prompts

#### Pending للجلسة القادمة
- Position trend charts (multi-scan SEO)
- Email/Auth/Billing عند الإطلاق التجاري
- Paid APIs (DataForSEO, Perplexity)

---

### [2026-05-15] Session 19 — End-to-End Testing + Crawler Polish + Prompts v2

**الهدف:** التيست الفعلي + سد الفجوات اللي ظهرت + تحسين جودة النتائج.

#### Tests Run (Manual via Backend API)

**AI Scan stability (temp=0):**
- Apple/technology — Scan 1: 12/15 calls (3 Gemini 429), avgScore=81
- Apple/technology — Scan 2: 15/15 (retry logic recovered all), avgScore=**81** (متطابق!)
- ✅ تأكيد: temp=0 + pinned model = نفس avgScore بين السكانين

**SEO Semrush-style:**
- Apple.com (US) — 20 keywords، 16/20 ranked #1، 37s
  - Top competitors: youtube.com, support.apple.com, bestbuy.com
- platinumsquare.ae (UAE) — أول مرة فشل (سبب: السايت يرد على www فقط)
  - **Fix:** أضفنا `buildUrlCandidates()` في crawler — يجرّب bare → www → https/http variants
  - بعد الـ fix: 25 keywords، 3 ranked، 47s
  - Top competitors: propertyfinder.ae, bayut.com, propsearch.ae (منافسين Dubai حقيقيين)

#### Crawler Improvements
1. **Multi-page crawl** — يكتشف internal links لـ /about, /services, /contact, /projects, /portfolio ويسحب keywords منها كمان. للسايت تبع المستخدم اكتشف /about-us و /contact-us.
2. **www fallback** — `buildUrlCandidates()` يجرّب 4 variants (bare/www × http/https) قبل ما يستسلم
3. **CTA / navigation filter** — قائمة 50+ phrase (`contact us`, `register interest`, `latest blog`, `view all`, إلخ) تتشال من keywords. النتيجة: keywords أنظف وأكثر صلة بالـ SEO.

#### AI Prompts v2 (أقوى — لسا عامة)
- prompts الـ 5 أُعيدت كتابتها لـ:
  - تطلب أسماء محددة (`"List the top 5 brands or companies"`, `"Name names"`)
  - تطلب تفسير (`"explain why each one stands out"`)
  - أسلوب محادثة طبيعي (`"I'm researching..."`, `"I need to choose..."`)
- النتيجة على Apple: avgScore تحسّن من **81 → 88** + topics extraction نظف:
  - Amazon Web Services (5x), Google Cloud, App Store, Meta Platforms, Microsoft Azure

#### Frontend Progress UI
- `SeoSiteResults` صار يعرض **3 stages واضحة** خلال السكان:
  1. Crawling website + extracting keywords
  2. Checking Google rankings (with progress bar + count)
  3. Detecting competitors + SERP features
- بدل loading spinner واحد، الآن المستخدم يشوف وين السكان وكم بقي

#### Quality
- ✅ `tsc --noEmit` backend + frontend — صفر errors
- ✅ `jest` 56/56 passed
- ✅ `eslint` backend — صفر errors

#### Pending (نفس Session 18)
- Real Perplexity API ($)
- DataForSEO for keyword volume ($)
- Auth + Stripe Billing (Phase 10)
- Scheduled scans (env flag)

---

### [2026-05-15] Session 18 — Semrush-Style SEO Tab (Stage 1)

**الهدف:** تحويل تبويب SEO من keyword scan بسيط إلى تجربة Semrush — المستخدم يدخل URL + بلد، النظام يعمل كل شي تلقائياً.

#### Backend
- **`crawler.service.ts`** (جديد) — يحمّل الصفحة الرئيسية بـ cheerio، يستخرج title/meta/H1/H2، ويبني keyword candidates عبر n-grams + frequency dedup. ~20 keyword لكل موقع.
- **`serper.service.ts`** (جديد) — wrapper نظيف لـ Serper.dev: يدعم country (`gl`) + language (`hl`)، استخراج SERP features (featured snippet، PAA، knowledge panel، إلخ)، وdomain matching للبراند.
- **`seo.service.ts`** (موسّع) — أُضيفت طبقة Sites الجديدة بجانب الـ scan القديم:
  - `createSite()` — يخزّن domain + country في Firestore (`seoSites` top-level collection)
  - `runSiteScan()` — fire-and-forget: crawl → extract keywords → loop on Serper مع country → record position + competitors + SERP features → snapshot في `seoSites/{id}/scans/{scanId}`
  - aggregates: avgPosition، rankedCount، competitorMap (top 10 domains)
- **DTOs** — `CreateSeoSiteDto` (validation: brand + domain + ISO-2 country)
- **`firebase.service.ts`** — أُضيف `seoSites()` و `seoSiteScans(siteId)` helpers
- **`seo.controller.ts`** — endpoints جديدة:
  - `POST /api/seo/sites` — أضف موقع جديد
  - `GET /api/seo/sites?brand=X` — قائمة المواقع
  - `GET /api/seo/sites/:siteId` — تفاصيل موقع
  - `POST /api/seo/sites/:siteId/scan` — شغّل scan جديد
  - `GET /api/seo/sites/:siteId/scans` — تاريخ السكانات
  - `GET /api/seo/sites/:siteId/scans/:scanId` — تفاصيل scan معيّن
- **Backward compatible** — endpoints الـ legacy (`/seo/scans`) لسا تشتغل
- **types.ts** — `SeoSite`، `SeoSiteScan`، `SeoCompetitor`، `SerpFeature` enum (9 features)

#### Frontend
- **`SeoSiteForm.tsx`** (جديد) — input brand + domain + country selector (15 دولة شائعة)
- **`SeoSiteDashboard.tsx`** (جديد) — قائمة المواقع المتتبَّعة + زر Run scan لكل موقع
- **`SeoSiteHistory.tsx`** (جديد) — تاريخ السكانات لموقع، مع status badges (done/failed/running)
- **`SeoSiteResults.tsx`** (جديد) — عرض كامل لـ snapshot:
  - 4 stat cards: keywords tracked، ranked in top 10، avg position، target country
  - **Top SERP competitors** — Domains اللي تظهر مع البراند (auto-detected)
  - جدول keywords: keyword | your position | your page | top 3 competitors | SERP features
- **App.tsx** — تبويب SEO أُعيد بناؤه ليستخدم النظام الجديد

#### Dependencies
- `cheerio@1.2.0` — HTML parsing

#### Quality
- ✅ `tsc --noEmit` backend + frontend — صفر errors
- ✅ `jest` 56/56 passed
- ✅ `eslint --fix` backend — صفر errors
- ⚠️ Frontend lint — 5 errors قديمة (مو من Session 18، في `AlertSettings`, `PromptCoverageMap`, `useAsync` — موجودة من قبل)

#### المعلّق (يحتاج دفع لاحقاً)
- **Real keyword search volume** — يحتاج DataForSEO أو Google Ads API (~$10/شهر)
- **Backlinks analysis** — يحتاج Ahrefs/Semrush API ($$$)
- **Traffic estimates** — يحتاج SimilarWeb API
- **Multi-page crawl** — حالياً homepage فقط؛ يمكن توسيعها لاحقاً
- **Scheduled site re-scans** — تتبع تلقائي يومي/أسبوعي
- **Position trend charts** — مع زيادة السكانات نضيف Recharts line chart

---

### [2026-05-14] Session 17 — Production-Ready Tweaks (Free Tier)

**الهدف:** المستخدم بدو يستعمل النظام لشركته الخاصة كأول عميل، ثم يبيع كـ B2B SaaS لاحقاً. النظام **يبقى عام** عبر كل المجالات — مو مخصص لقطاع معين. لا يدفع حالياً، يريد كل ما يمكن من تحسينات مجانية.

#### Determinism: temperature=0 + pinned OpenAI version
- **المشكلة:** كل سكان نتائج مختلفة قليلاً (LLMs non-deterministic بالـ default)
- **الحل:**
  - OpenAI: `temperature: 0` + pinned `gpt-4o-mini-2024-07-18` (مو alias متغير)
  - Gemini (scan + recommendations): `generationConfig: { temperature: 0 }`
- **الأثر:** نفس الـ prompt → (تقريباً) نفس الجواب → سكانات أكثر استقرار
- **ملاحظة:** `perplexity-style` مع Search Grounding يبقى متذبذب لأن نتائج البحث الويب تتغير
- **الملف المعدّل:** `backend/src/ai/ai.service.ts`

#### المعلّق للجلسات القادمة (لما المستخدم يجاهز للدفع ~$20-30)
1. **Google AI billing** → يلغي 429 rate limits (أولوية 1)
2. **Real Perplexity API** ($5 credit ابتدائي) → استبدال Gemini+Search بـ Perplexity الحقيقي
3. **OpenRouter $10** → اختياري للـ backup
4. **Scheduled scans** → معدلات متعددة لتقليل الـ noise (الكود موجود، بس تفعيل env)
5. **زيادة عدد الـ prompts** من 5 إلى 10 (تظل عامة، مو خاصة بمجال)

### [2026-05-14] Session 17 — Gemini Model Fix + Recommendations → Gemini

#### Determinism: temperature=0 + pinned OpenAI version
- **المشكلة:** كل سكان نتائج مختلفة قليلاً (LLMs non-deterministic بالـ default)
- **الحل:** 
  - OpenAI: `temperature: 0` + pinned `gpt-4o-mini-2024-07-18` (مو alias متغير)
  - Gemini (scan + recommendations): `generationConfig: { temperature: 0 }`
- **الأثر:** نفس الـ prompt → (تقريباً) نفس الجواب → سكانات أكثر استقرار
- **ملاحظة:** Perplexity-style مع Search Grounding يبقى متذبذب لأن نتائج البحث تتغير
- **الملف المعدّل:** `backend/src/ai/ai.service.ts`

#### Fix: gemini-1.5-flash → gemini-2.5-flash + retry logic + split models
- **المشكلة 1:** Google حذفت `gemini-1.5-flash` من v1beta API → 404
- **المشكلة 2:** `gemini-2.0-flash` على مشروع المستخدم free tier quota=0
- **المشكلة 3:** `gemini-2.5-flash` free tier = 5 req/min — السكان يولد ~10 Gemini calls فيكسر الحد
- **التشخيص:** ListModels API + اختبار يدوي → `gemini-2.5-flash` و `gemini-2.5-flash-lite` متاحين
- **الحل النهائي:**
  - **Scan engines** (gemini-style + perplexity-style) → `gemini-2.5-flash` + **retry logic** (يقرأ retry delay من error response ويرجع المحاولة مرتين)
  - **Recommendations + Content Generator** (`generateText`) → `gemini-2.5-flash-lite` — quota منفصلة، ما تتأثر بالسكان
- **الملف المعدّل:** `backend/src/ai/ai.service.ts`

#### Fix: Recommendations + Content Generator → Gemini (بدل OpenRouter)
- **المشكلة:** OpenRouter free tier يحتاج رصيد ($10) لفتح daily quota — بدون رصيد الـ limit صفر → 429 على recommendations
- **الحل:** `generateText()` يستخدم Gemini 2.5 Flash أولاً (مجاني، مفتاحه موجود) — OpenRouter يبقى fallback
- **التحسين:** أسرع + مجاني + لا يحتاج OpenRouter credits للـ recommendations والـ content generator
- **الملف المعدّل:** `backend/src/ai/ai.service.ts`

#### حالة الفيتشر بعد Session 17
| الفيتشر | الحالة | ملاحظة |
|---|---|---|
| AI Scan (chatgpt-style) | ✅ حقيقي | OpenAI GPT-4o-mini |
| AI Scan (gemini-style) | ✅ حقيقي | Gemini 2.5 Flash |
| AI Scan (perplexity-style) | ✅ حقيقي* | Gemini 2.5 Flash + Search Grounding |
| SEO Scan | ✅ حقيقي | Serper.dev — نتائج Google |
| Recommendations | ✅ حقيقي | Gemini 2.5 Flash (مجاني) |
| Content Generator | ✅ حقيقي | Gemini 2.5 Flash (مجاني) |
| Email Alerts/Reports | ⏸️ | يحتاج EMAIL_HOST/USER/PASS |
| Scheduled Auto-scans | ⏸️ | SCAN_SCHEDULE_ENABLED=false |

*perplexity-style: يشتغل نظرياً مع `gemini-2.0-flash` + Search Grounding — يحتاج تأكيد بسكان جديد

---

### [2026-05-14] Session 16 — System Audit + SEO Migration (Serper.dev)

#### Full System Audit
- فحص شامل لكل modules: backend + frontend + tests + types
- النتيجة: ✅ كل الكود سليم — صفر simulation، صفر hardcoded responses
- **مشكلة مكتشفة:** `perplexity-style` engine (Gemini + Google Search Grounding) يفشل على Google AI free tier — الميزة تحتاج billing مفعّل
- **تأثير:** من 15 call في السكان الكامل، تنجح 2-5 فقط (13 تفشل بصمت عبر `PromiseSettledResult`)
- **التحقق:** نتائج SEO scan صحيحة 100% — "not found" للبراندات الصغيرة هو الجواب الحقيقي

#### SEO Module Migration: Google CSE → Serper.dev
- **السبب:** Google أوقفت "Search the entire web" في Programmable Search Engine نهائياً — CSE free tier محدودة بسايتات معينة فقط
- **الحل:** استبدال Google CSE API بـ **Serper.dev** — يرجع نتائج Google حقيقية عبر `POST https://google.serper.dev/search`
- **Free tier:** 2,500 query مجاناً، بعدها $1 لكل 1,000
- **env var:** استُبدل `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_ID` بـ `SERPER_API_KEY`
- **الملفات المعدّلة:** `backend/src/seo/seo.service.ts` (method `checkKeyword`)، `backend/.env.example`
- **الاختبار:** ✅ `tsc --noEmit` — صفر أخطاء | ✅ `jest` 56/56 | ✅ SEO scan فعلي يبحث بـ Google الحقيقي

#### حالة الفيتشر بعد Session 16
| الفيتشر | الحالة | ملاحظة |
|---|---|---|
| AI Scan (chatgpt-style) | ✅ حقيقي | OpenAI GPT-4o-mini |
| AI Scan (gemini-style) | ✅ حقيقي | Gemini 1.5 Flash |
| AI Scan (perplexity-style) | ⚠️ يفشل | Google Search Grounding = paid feature |
| SEO Scan | ✅ حقيقي | Serper.dev — نتائج Google |
| Recommendations | ✅ حقيقي | OpenRouter Gemma |
| Content Generator | ✅ حقيقي | OpenRouter Gemma |
| Dashboard/Analytics | ✅ | من Firestore |
| Compare Brands | ✅ | Live AI scans |
| Email Alerts/Reports | ⏸️ | يحتاج EMAIL_HOST/USER/PASS |
| Scheduled Auto-scans | ⏸️ | SCAN_SCHEDULE_ENABLED=false |

#### المشكلة الرئيسية التالية
`perplexity-style` engine يفشل → 5/15 calls ضائعة في كل scan. الحلول:
1. **تفعيل Google AI billing** (مدفوع) → يعيّد Google Search Grounding
2. **إلغاء perplexity-style** وتشغيل chatgpt + gemini فقط (AI_MAX_ENGINES=2)
3. **استبدال perplexity-style بـ OpenRouter مع web search model** (مجاني)

---

### [2026-05-14] Session 15 — Phase 6: Real AI Engines

#### Phase 6 — Real Engine Routing (chatgpt-style → OpenAI, gemini/perplexity → Gemini)
- **قبل:** model واحد (Gemma عبر OpenRouter) يمثّل الثلاثة engines بـ system prompts فقط — simulation
- **بعد:** كل engine يستدعي API حقيقي مختلف:
  - `chatgpt-style` → **OpenAI GPT-4o-mini** مباشرة (لا OpenRouter)
  - `gemini-style` → **Google Gemini 1.5 Flash** مباشرة
  - `perplexity-style` → **Google Gemini 1.5 Flash + Search Grounding** (يبحث Google الحقيقي قبل يجاوب — نفس فكرة Perplexity)
- Fallback: لو الـ key مفقود → يرجع لـ OpenRouter تلقائيًا (graceful degradation)
- `generateText()` (recommendations + content) تبقى على OpenRouter لتوفير credits
- المفاتيح المطلوبة: `OPENAI_API_KEY` + `GOOGLE_GEMINI_API_KEY` في `.env`
- Scan settings بعد Phase 6: `AI_MAX_ENGINES=3`, `AI_MAX_PROMPTS=5`, `AI_CONCURRENCY=2`, `AI_DELAY_MS=2000`
- **الحزم المضافة:** `@google/generative-ai`
- **الملفات المعدّلة:** `backend/src/ai/ai.service.ts`, `backend/src/ai/ai.service.spec.ts`, `backend/.env.example`
- **الاختبار:** ✅ `tsc --noEmit` — صفر أخطاء | ✅ `jest` 56/56

### [2026-05-14] Session 14 — Phase 12: Action Machine

#### Phase 12.2 — Content Generator (real LLM output)
- `ContentGenerator.tsx` — collapsible panel بعد ActionPlan
- `POST /api/scans/content` — endpoint حقيقي يستخدم `AIService.generateText()`
- 4 platforms: **Google My Business** (≤750 chars) | **LinkedIn Post** | **Blog Outline (Markdown)** | **X/Twitter** (3 alternatives ≤280 chars)
- Prompt يشمل: brand + category + topic + scan context (mentionRate + avgScore من scan الفعلي)
- Output: textarea read-only + Copy button + character counter (red warning إذا تجاوز الـ limit)
- كل generate = real LLM call — لا templates لا mock
- **الملفات الجديدة:** `backend/src/scans/generate-content.dto.ts`, `frontend/src/components/ContentGenerator.tsx`
- **الملفات المعدّلة:** `backend/src/scans/scans.service.ts`, `backend/src/scans/scans.controller.ts`, `frontend/src/api/client.ts`, `frontend/src/App.tsx`
- **الاختبار:** ✅ `tsc --noEmit` (backend + frontend) | ✅ `jest` 56/56

#### Phase 12.3 — Impact Predictor (real data, no heuristics)
- `ImpactPredictor.tsx` — component جديد يظهر قبل ActionPlan بعد كل scan
- **Effective Reach Score** = `sum(ALL visibilityScores) / total` — الرقم الحقيقي لتأثير العلامة عبر كل prompts (مش فقط المذكورة)
- **Week 1 target** = إصلاح الـ engines ذات 0% mention rate → 50% mention rate @ score=40 (أدنى قيمة حقيقية من formula: mentioned + no position + neutral sentiment)
- **Score ceiling** = إذا كل نتائج non-mentioned وصلت لـ `stats.avgScore` الحالي (جودة الذكر الحالية)
- Per-engine breakdown: mention rate bar + potential gain per engine (مشتق من scan results الفعلية)
- "Why two scores?" explanation: Quality Score (mentioned-only) vs Effective Reach Score (all prompts)
- كل أرقام مشتقة رياضياً من بيانات الـ scan — لا heuristics لا simulations
- **الملفات الجديدة:** `frontend/src/components/ImpactPredictor.tsx`
- **الملفات المعدّلة:** `frontend/src/App.tsx`
- **الاختبار:** ✅ `tsc --noEmit` (frontend) — صفر أخطاء | ✅ `jest` 56/56

#### Phase 12.1 — 30-Day Action Roadmap
- `ActionPlan.tsx` — component جديد يحوّل الـ recommendations إلى roadmap بصري 3 أعمدة
- **Week 1** (red) = high priority recs — "Quick wins"
- **Week 2–3** (yellow) = medium priority recs — "Build momentum"
- **Week 4+** (green) = low priority recs — "Long-term growth"
- كل عمود: header مع effort estimate (حساب تلقائي من "1 hour"/"half day"/"1 day"/"1 week") + cards مع steps + platforms + expectedImpact
- يظهر تلقائياً بعد كل scan، تحت `RecommendationsPanel`
- Zero new API calls — يستخدم `recommendations[]` الموجودة من scan result
- **الملفات الجديدة:** `frontend/src/components/ActionPlan.tsx`
- **الملفات المعدّلة:** `frontend/src/App.tsx`
- **الاختبار:** ✅ `tsc --noEmit` (frontend) — صفر أخطاء | ✅ `jest` 56/56

---

### [2026-05-13] Session 13 — Phase 9: BullMQ + Docker Compose

#### Phase 9.1 — BullMQ Job Queue (Redis)
- `REDIS_URL` env var — اختياري. إذا ضُبط: BullMQ. إذا لا: fire-and-forget (سلوك سابق محفوظ)
- `scan-queue.constants.ts` — ثوابت `SCAN_QUEUE`, `SCAN_JOB`, `ScanJobData`
- `scan.processor.ts` — `@Processor(SCAN_QUEUE)` يستقبل jobs ويشغّل `ScansService.runScanInBackground()`
- `ScansService` — `@Optional() @InjectQueue` بدل fire-and-forget عند وجود Redis
- `ScansModule` + `AppModule` — تسجيل BullMQ مشروط (`process.env.REDIS_URL`)
- **الملفات الجديدة:** `backend/src/scans/scan-queue.constants.ts`, `backend/src/scans/scan.processor.ts`
- **الملفات المعدّلة:** `backend/src/scans/scans.service.ts`, `backend/src/scans/scans.module.ts`, `backend/src/app.module.ts`

#### Phase 9.2 — Docker Compose Update
- `docker-compose.yml` — أضاف Redis 7-alpine مع persistent volume + networking صحيح
- Backend يأخذ `REDIS_URL=redis://redis:6379` تلقائياً في Docker
- `.env.example` — أضاف `REDIS_URL` (مع شرح) + email vars (كانت مفقودة من example)

#### Checks Session 13
- **الاختبار:** ✅ `tsc --noEmit` (backend + frontend) | ✅ `npm run lint` | ✅ `jest` 56/56

---

### [2026-05-13] Session 12 — 3 Features تمييزية جديدة

#### Scheduled PDF Reports
- `reports.service.ts` — cron جديد: كل اثنين 9am (weekly) + أول كل شهر 9am (monthly)
- يمشي على كل brands، يبعث HTML email مع: avg score + delta + mention rate + trend table
- `AlertSettings` interface موسّع: `reportFrequency` + `reportEmail` في backend + frontend
- `AlertSettingsDto`: `@IsIn(['weekly', 'monthly', 'disabled'])` validation
- UI: 3 أزرار (Off/Weekly/Monthly) + حقل email — في `AlertSettings.tsx`
- **الملفات الجديدة:** `backend/src/alerts/reports.service.ts`
- **الملفات المعدّلة:** `backend/src/alerts/alerts.service.ts`, `backend/src/alerts/alert-settings.dto.ts`, `backend/src/alerts/alerts.module.ts`, `frontend/src/components/AlertSettings.tsx`, `frontend/src/api/client.ts`

#### Share of Voice (SOV) Chart
- `SovChart.tsx` — donut pie chart (recharts) + table: Brand | Mentions | SOV %
- يظهر تلقائياً في Compare tab بعد تشغيل comparison
- حسابي client-side من `compareResult` — zero backend call
- **الملفات الجديدة:** `frontend/src/components/SovChart.tsx`
- **الملفات المعدّلة:** `frontend/src/App.tsx`

#### Prompt Coverage Map
- `GET /api/analytics/coverage?brand=X` — يقرأ latest scan results → يصنّف 5 intents × 3 engines
- Grid: ✅ mentioned | ❌ not mentioned | — no data — مع counter badge "X/15 covered"
- يظهر في Scan tab بعد كل scan تلقائياً
- **الملفات الجديدة:** `frontend/src/components/PromptCoverageMap.tsx`
- **الملفات المعدّلة:** `backend/src/analytics/analytics.service.ts`, `backend/src/analytics/analytics.controller.ts`

#### Checks Session 12
- **الاختبار:** ✅ `tsc --noEmit` (backend + frontend) | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 56/56

---

## ما تم إنجازه (مرتب من الأحدث) — سابق

### [2026-05-13] Session 11 — Phase 7 + 8 + 9 Features

#### Phase 7 — Intelligence Layer
- **7.2 Anomaly Detection:** Z-score على آخر 10 scans → `anomaly/anomalyDelta` مخزّنة على scan doc — badge تحذير في ScanHistory
- **7.1 Topic Intelligence:** `extractTopics()` في parser → يستخرج capitalized phrases من AI responses → `TopicsPanel.tsx` يعرض tag cloud
- **7.3 Competitor Trends:** `GET /api/analytics/competitors?brands=A,B,C` → `CompetitorTrendChart.tsx` (Recharts multi-line) في Compare tab
- **الملفات الجديدة:** `frontend/src/components/TopicsPanel.tsx`, `frontend/src/components/CompetitorTrend.tsx`
- **الملفات المعدّلة:** `backend/src/ai/parser.ts`, `backend/src/common/types.ts`, `backend/src/scans/scans.service.ts`, `backend/src/analytics/analytics.service.ts`, `backend/src/analytics/analytics.controller.ts`, `frontend/src/api/client.ts`, `frontend/src/components/ScanHistory.tsx`, `frontend/src/App.tsx`

#### Phase 8 — Client Deliverables
- **8.2 + 8.3 Email Alerts + Webhooks:** `AlertsModule` جديد — `POST /api/alerts/settings/:brandId` + `POST /api/alerts/test/:brandId` — تنبيه email + webhook POST عند score < threshold — Nodemailer opt-in (يُعطَّل إذا EMAIL_HOST غير مضبوط) — `AlertSettings.tsx` UI بعد كل scan
- **8.1 Branded PDF:** استُبدل print window بـ jsPDF حقيقي — PDF كامل مع stats + results + recommendations
- **الملفات الجديدة:** `backend/src/alerts/` (4 ملفات), `frontend/src/components/AlertSettings.tsx`
- **الملفات المعدّلة:** `backend/src/app.module.ts`, `backend/src/scans/scans.module.ts`, `backend/src/scans/scans.service.ts`, `backend/src/firebase/firebase.service.ts`, `frontend/src/components/ExportButtons.tsx`

#### Phase 9 — Infrastructure
- **9.2 Docker Compose:** `docker-compose.yml` + `backend/Dockerfile` + `frontend/Dockerfile` + `frontend/nginx.conf` — one command: `docker compose up`

#### Checks
- **الاختبار:** ✅ `tsc --noEmit` (backend + frontend) | ✅ `npm run build` (backend + frontend) | ✅ `npm run lint` | ✅ `jest` 56/56

## ما تم إنجازه (مرتب من الأحدث) — السابق

### [2026-05-13] Session 10 — Model fix + Retry logic + .env audit

#### تصحيح الـ Model
- اكتشاف أن `openrouter/free` يرجع `undefined` content — سبب 0 results في كل scan
- اكتشاف أن `meta-llama/llama-3.3-70b-instruct:free` غير موجود في قائمة free models الحالية
- تثبيت على `google/gemma-4-31b-it:free` — مختبر، يعمل، يرجع content صحيح
- **الملفات المعدّلة:** `backend/.env`, `backend/.env.example`, `backend/src/ai/ai.service.ts` (code default)

#### Retry Logic للـ 429 Rate Limits
- `callOpenrouter()` يعيد المحاولة مرة واحدة بعد 30s عند 429
- يتجنب فشل الـ scan الكامل بسبب rate limit مؤقت
- **الملفات المعدّلة:** `backend/src/ai/ai.service.ts`

#### AI_DELAY_MS
- رُفع من 2500ms إلى 8000ms في `.env` و `.env.example` — يقلل احتمال 429 على free tier

#### .env Audit
- أضيفت جميع المتغيرات الناقصة لـ `backend/.env` بقيم افتراضية آمنة
- **الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run lint` | ✅ `jest` 56/56 | ✅ scan حقيقي يرجع results

### [2026-05-13] Session 9 — SEO Module (5.3)
- `SeoResult` + `SeoScan` types in `common/types.ts`
- `FirebaseService.seoScans(brandId)` → `brands/{brandId}/seoScans`
- `SeoService`: fire-and-forget keyword scan via Google Custom Search API, per-keyword position detection
- `SeoController`: `POST/GET /api/seo/scans` + `GET /api/seo/scans/:brandId/:scanId`
- `SeoModule` + registered in `AppModule`; `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID`, `SEO_DELAY_MS` in `.env.example`
- `SeoScanForm.tsx` + `SeoResultsTable.tsx` (polls every 2s, position badges)
- "SEO" tab in `App.tsx`
- **الاختبار:** ✅ backend `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 56/56 | ✅ frontend `tsc --noEmit`

### [2026-05-13] Session 8 — Delta indicator (5.2) + Export CSV/PDF (4.6)

#### Delta indicator (5.2)
- `StatCard` accepts `delta?: number | null` + `deltaUnit?: string` — shows "+X pts vs last scan" (green) or "-X pts" (red)
- `Dashboard.tsx` computes score + mention deltas from last 2 timeline entries via IIFE
- **الملفات المعدّلة:** `frontend/src/components/StatCard.tsx`, `frontend/src/pages/Dashboard.tsx`
- **الاختبار:** ✅ frontend `tsc --noEmit`

#### Export CSV/PDF (4.6)
- `ExportButtons.tsx` — "Export CSV" (Blob download) + "Export PDF" (print window)
- `ScanForm.tsx` — callback now includes brand + category
- `App.tsx` — `scanMeta` state; ExportButtons rendered above ResultTable
- **الملفات الجديدة:** `frontend/src/components/ExportButtons.tsx`
- **الملفات المعدّلة:** `frontend/src/components/ScanForm.tsx`, `frontend/src/App.tsx`
- **الاختبار:** ✅ frontend `tsc --noEmit` | ✅ backend `jest` 56/56

### [2026-05-13] Session 7 — Auth (4.7) + Pre-aggregation (4.5)

#### Auth (4.7)
- `ApiKeyMiddleware` — global NestJS middleware, opt-in: disabled if `API_KEY` not set
- Supports `Authorization: Bearer <key>` or `x-api-key` header
- Frontend axios interceptor injects key from `VITE_API_KEY`
- **الملفات الجديدة:** `backend/src/auth/api-key.middleware.ts`, `frontend/.env.example`
- **الملفات المعدّلة:** `backend/src/app.module.ts`, `backend/.env.example`, `frontend/src/api/client.ts`

#### Pre-aggregation (4.5)
- `ScanSummary` Firestore doc كتابة بعد كل scan → `brands/{brandId}/scanSummaries/{scanId}`
- Analytics fast path: O(n) reads بدل O(n×m). Fallback لـ brands قديمة
- **الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 56/56 | ✅ frontend `tsc --noEmit`

### [2026-05-13] Session 7 — Recommendations Engine (5.1)
- `AIService.generateText()` — single LLM call, 2000 tokens, public method
- `ScansService.generateRecommendations()` + `buildRecommendationsPrompt()` — industry-aware prompt with explicit no-generic-advice instructions
- 25s `Promise.race` timeout — scan never hangs waiting for recommendations
- Recommendations stored on scan doc in Firestore, returned by `getScanResults()`
- **الملفات الجديدة:** `frontend/src/components/RecommendationsPanel.tsx`
- **الملفات المعدّلة:** `backend/src/common/types.ts`, `ai.service.ts`, `scans.service.ts`, `frontend/src/api/client.ts`, `frontend/src/App.tsx`
- **الاختبار:** ✅ `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 56/56 | ✅ frontend `tsc --noEmit`

### [2026-05-13] Session 6 — Competitor Comparison (4.4) + Unit tests parser.ts (3.1)

#### Feature 4.4 — Competitor comparison
- `POST /api/scans/compare` — endpoint جديد، يأخذ `{ brands: string[2-4], category }` ويرجع مقارنة جانبية
- `ScansService.compareBrands()` + `buildBrandComparison()` — runs `runScan()` لكل brand بالـ parallel
- `CompareDto` — validation: 2-4 brands، كل واحد >= 2 chars
- **Frontend:** `CompareForm.tsx` (dynamic brand inputs)، `ComparisonTable.tsx` (جدول مقارنة: score/mention rate/sentiment by engine)
- `App.tsx` — tab جديد "Compare" مع `ComparisonTable`
- **الملفات الجديدة:** `backend/src/scans/compare.dto.ts`، `frontend/src/components/CompareForm.tsx`، `frontend/src/components/ComparisonTable.tsx`
- **الملفات المعدّلة:** `scans.service.ts`، `scans.controller.ts`، `frontend/src/api/client.ts`، `frontend/src/App.tsx`
- **الاختبار:** ✅ backend `tsc --noEmit` | ✅ `npm run build` | ✅ `npm run lint` | ✅ `jest` 35/35 | ✅ frontend `tsc --noEmit`

### [2026-05-13] Session 6 — Integration tests ScansService (3.3)
- 10 integration tests — يختبر `createScan`, `getScanResults`, `listScansByBrand`, `compareBrands`
- Firebase مُحاكى بـ in-memory mock (لا emulator مطلوب — لا `firebase.json` في المشروع)
- `AIService.callLLM` مُحاكى، كل services مُوصّلة عبر NestJS TestingModule
- **الملفات الجديدة:** `backend/src/scans/scans.service.integration.spec.ts`
- **الاختبار:** ✅ `jest scans.service.integration` — 10/10 | ✅ `jest` كل الـ tests 56/56 | ✅ `npm run lint`

### [2026-05-13] Session 6 — Unit tests for AIService (3.2)
- 11 unit tests — 11 passed, 0 failed
- يغطّي: `runScan()`, `runWithConcurrency()` (via runScan), result typing
- Mock strategy: `jest.spyOn` على `callLLM` private method، dummy API keys في mockConfig
- **الملفات الجديدة:** `backend/src/ai/ai.service.spec.ts`
- **الاختبار:** ✅ `jest ai.service.spec` — 11/11 | ✅ `tsc --noEmit` | ✅ `npm run lint`

### [2026-05-13] Session 6 — Unit tests for parser.ts (3.1)
- 35 unit tests — 35 passed, 0 failed
- يغطّي: `detectMention`, `detectPosition`, `detectSentiment`, `calcVisibilityScore`, `parseResponse` (integration)
- أضفنا `moduleNameMapper` في `package.json` jest config لحل `src/` path alias
- **الملفات الجديدة:** `backend/src/ai/parser.spec.ts`
- **الملفات المعدّلة:** `backend/package.json` (jest.moduleNameMapper)
- **الاختبار:** ✅ `jest parser.spec` — 35/35 | ✅ `tsc --noEmit` | ✅ `npm run lint`

### [2026-05-13] Session 5 — Real-time Scan Progress via SSE (4.1)
- `POST /api/scans` returns `{scanId, brandId}` immediately — scan runs in background
- `GET /api/scans/stream/:scanId` — SSE endpoint, streams progress + done/error events
- `ScanForm.tsx` rewritten — real progress bar: "Scanning 2/4 calls..."
- **الملفات الجديدة:** `backend/src/scans/scan-events.service.ts`
- **الملفات المعدّلة:** `scans.service.ts`, `scans.controller.ts`, `scans.module.ts`, `ai.service.ts`, `ScanForm.tsx`, `api/client.ts`

### [2026-05-13] Session 4 — Scan History Feature (4.3)
- `GET /api/scans?brand=X` — endpoint جديد يرجع list of scans sorted desc
- `ScanHistory.tsx` — component في Dashboard: expandable rows، lazy load، scan result cache
- **الملفات الجديدة:** `frontend/src/components/ScanHistory.tsx`
- **الملفات المعدّلة:** `backend/src/scans/scans.service.ts`, `scans.controller.ts`, `frontend/src/api/client.ts`, `frontend/src/pages/Dashboard.tsx`

### [2026-05-13] Session 3 — Reliability + Safety fixes

#### Fix 3 — .gitignore: حماية serviceAccountKey.json
- أضفنا `serviceAccountKey.json` و `backend/serviceAccountKey.json` لـ `.gitignore`
- الملف لم يُسبق commit له — credentials آمنة
- **الملفات:** `.gitignore`

#### Fix 4 — Rate limiting على POST /api/scans
- `@nestjs/throttler@6.5.0` مثبّت
- 5 requests/min per IP بالافتراضي (قابل للضبط عبر `THROTTLE_TTL_MS` و `THROTTLE_SCAN_LIMIT`)
- `ThrottlerModule.forRootAsync()` في `AppModule` — reads config from ConfigService
- `@UseGuards(ThrottlerGuard)` على `POST /scans`
- **الملفات:** `backend/src/app.module.ts`, `backend/src/scans/scans.controller.ts`, `backend/.env.example`

#### Fix 5 — CORS من env var
- `main.ts`: `origin: process.env.FRONTEND_URL ?? 'http://localhost:5173'`
- `FRONTEND_URL` أضيفت لـ `.env.example`
- **الملفات:** `backend/src/main.ts`, `backend/.env.example`

#### Fix 6 — Firestore composite index
- أنشأنا `backend/firestore.indexes.json` بالـ index المطلوب لـ `.where('status').orderBy('createdAt')`
- **الملفات الجديدة:** `backend/firestore.indexes.json`

#### Fix 7 — Typo في parser.ts
- `detectMention(reponse, ...)` → `detectMention(response, ...)`
- **الملفات:** `backend/src/ai/parser.ts:10`

#### Fix 8 — README تحديث
- حذف `VisibilityOrchestrator` من architecture diagram — استُبدل بـ `AIService.runScan()`
- تصحيح "15 parallel prompts" → "up to 15 prompts (configurable)"
- إضافة جميع env vars الجديدة لـ Getting Started
- تحديث شرح "How a scan works" ليعكس الـ configurable values
- **الملفات:** `README.md`

---

### [2026-05-13] Session 2 — Fixes + Auto Scheduling
- Fix 1: Scan failure handling (try/catch → `failed` status)
- Fix 2: Configurable throttling + model name fix
- Dev 1: Auto scheduling (cron, opt-in)
- Lint cleanup: 15 pre-existing errors + floating promise

### [2026-05-13] Session 1 — Documentation baseline
- إنشاء: `docs/PROJECT_AUDIT.md`, `docs/ARCHITECTURE_MAP.md`, `docs/WORKFLOW_ANALYSIS.md`, `docs/CODE_EXPLANATION.md`, `docs/RISKS_AND_GAPS.md`, `docs/DEVELOPMENT_ROADMAP.md`

---

## نقاط التكوين المهمة للتشغيل

```env
# backend/.env (انسخ من .env.example)
OPENROUTER_API_KEY=your_key   ← مطلوب

AI_PROVIDER=openrouter

# عدد الاستدعاءات (افتراضي 2×2=4، max 3×5=15)
AI_MAX_ENGINES=2
AI_MAX_PROMPTS=2
AI_CONCURRENCY=1
AI_DELAY_MS=2500

# CORS — غيّرها عند النشر
FRONTEND_URL=http://localhost:5173

# Rate limiting
THROTTLE_TTL_MS=60000
THROTTLE_SCAN_LIMIT=5

# الجدولة التلقائية
SCAN_SCHEDULE_ENABLED=false
SCAN_CRON_SCHEDULE=0 0 * * *
```

`serviceAccountKey.json` مطلوب في `backend/` (Firebase credentials).

---

## الـ Workflows التي تعمل الآن

| Workflow | الحالة |
|---|---|
| POST /api/scans → scan كامل → Firestore | ✅ يعمل + fail-safe + rate limited |
| GET /api/scans/:brandId/:scanId | ✅ يعمل |
| GET /api/analytics/brands | ✅ يعمل |
| GET /api/analytics?brand=X | ✅ يعمل |
| Frontend: ScanForm → ResultsTable | ✅ يعمل |
| Frontend: Dashboard → charts | ✅ يعمل |
| Scheduled auto-scan (cron) | ✅ جاهز — معطّل بالافتراضي |
| GET /api/scans/stream/:scanId (SSE progress) | ✅ يعمل |
| GET /api/scans?brand=X (scan history list) | ✅ يعمل |
| Dashboard: Scan History expandable table | ✅ يعمل |
| Unit tests — parser.ts (35 tests) | ✅ يعمل |
| POST /api/scans/compare (competitor comparison) | ✅ يعمل |
| Frontend: Compare tab + ComparisonTable | ✅ يعمل |
| Unit tests — AIService (11 tests) | ✅ يعمل |
| Integration tests — ScansService (10 tests) | ✅ يعمل |

---

## حالة الـ Roadmap الكاملة

✅ Phase 0, 1, 2, 3 (3.1, 3.2, 3.3), 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3 — مكتملة

**Roadmap الأساسي كامل.** المشروع جاهز للإطلاق.

---

## الـ Phases القادمة (مخطط لها — لم تبدأ بعد)

| Phase | الاسم | الحالة |
|---|---|---|
| **7** | Intelligence Layer (Topic Intel + Anomaly + Competitor Trends) | ✅ مكتملة |
| **8** | Client Deliverables (PDF + Email Alerts + Webhooks) | ✅ مكتملة |
| **9.2** | Docker Compose | ✅ مكتملة |
| **9.1** | BullMQ Job Queue (Redis) | ⬜ اختياري |
| **6** | Core Scan Upgrade (Real OpenAI + Perplexity engines) | ⬜ يحتاج API keys ($5-10) |
| **10** | Monetization — Firebase Auth + Stripe Billing | ⬜ آخر شي |

**الترتيب المنصوح:** 7 → 8 → 9 → 6 → 10

**ملاحظة Phase 10:** Auth + Billing تُبنى فوق product ناضج — لا تُبدأ قبل إكمال كل الـ phases.
تفاصيل كاملة في `docs/DEVELOPMENT_ROADMAP.md`.
