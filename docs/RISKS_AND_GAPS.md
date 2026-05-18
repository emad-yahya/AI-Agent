# RISKS_AND_GAPS.md
_آخر تحديث: 2026-05-13 (Session 7)_

---

## HIGH Severity

### ~~1. Scan Never Marked 'failed' on Error~~ ✅ تم إصلاحه 2026-05-13
**الملف:** `backend/src/scans/scans.service.ts`
**الحل:** try/catch يُحدّث scan status إلى `'failed'` عند أي خطأ.

---

## MEDIUM Severity

### 2. serviceAccountKey.json Security
**الملف:** `backend/src/firebase/firebase.service.ts:14`
**الحالة:** ⚠️ لم يُتحقق منه بعد
Firebase admin credentials يجب ألا تُودع في git. تحقق يدوي مطلوب:
- تأكد أن `serviceAccountKey.json` في `.gitignore`
- لو سُبق commit له، دوّر الـ credentials من Firebase Console → Service Accounts

### ~~3. No Rate Limiting on POST /api/scans~~ ✅ تم إصلاحه 2026-05-13
`@nestjs/throttler@6.5.0` — 5 req/min per IP، configurable via `THROTTLE_TTL_MS` + `THROTTLE_SCAN_LIMIT`

### ~~4. CORS Hardcoded to localhost~~ ✅ تم إصلاحه 2026-05-13
`origin: process.env.FRONTEND_URL ?? 'http://localhost:5173'`

### ~~5. Missing Firestore Composite Index~~ ✅ تم إصلاحه 2026-05-13
`backend/firestore.indexes.json` — deploy via `firebase deploy --only firestore:indexes`

### 6. N+1-style Analytics Read
**الملف:** `backend/src/analytics/analytics.service.ts:41`
**الحالة:** ℹ️ مقبول للمرحلة الحالية
`getBrandAnalytics()` تطلق N Firestore reads (واحد لكل scan). مع 100 scan = 101 reads per request.
**الحل المؤجّل:** Pre-aggregate stats في `brands/{id}` بعد كل scan (Phase 4.5)

---

## LOW Severity

### ~~7. Typo in parser.ts Parameter Name~~ ✅ تم إصلاحه 2026-05-13
`detectMention(reponse, ...)` → `detectMention(response, ...)`

### 8. Race Condition in Brand Creation
**الملف:** `backend/src/scans/scans.service.ts:109`
**الحالة:** ℹ️ خطر منخفض
`getOrCreateBrand()` check-then-create غير atomic. طلبين متزامنان لنفس brand جديد ينشئان نسختين.
**ملاحظة:** الآن `getOrCreateBrand()` يُحدّث `category` على الـ ref الموجود — الـ race condition يبقى على الإنشاء فقط.

### 9. Hardcoded Engine List in aggregateByEngine()
**الملف:** `backend/src/analytics/analytics.service.ts:109`
**الحالة:** ℹ️ لم يُعالج
`const engines: Engine[] = [...]` — hardcoded. إضافة engine جديد تتطلب تعديل هذه القائمة يدوياً.

### 10. buildPrompt() No Input Sanitization
**الملف:** `backend/src/ai/prompts.ts:55`
**الحالة:** ℹ️ خطر منخفض جداً
Brand name يحتوي على `{category}` → double substitution. Edge case.

### 11. useAsync useEffect Dependency Warning (Frontend)
**الملف:** `frontend/src/pages/Dashboard.tsx:24`
**الحالة:** ℹ️ harmless
`run` غير موجود في deps array. `useCallback([])` يجعله stable لكن lint يحذّر.

### 12. ScanStatus 'pending' Never Used
**الملف:** `backend/src/common/types.ts:3`
**الحالة:** ℹ️ dead code
Scans تُنشأ مباشرة بـ `'running'`. `'pending'` لم يُستخدم بعد.

### 13. max_tokens: 400 May Truncate Responses
**الملف:** `backend/src/ai/ai.service.ts:63,79`
**الحالة:** ℹ️ مقبول
ردود طويلة تُقطع. يؤثر على `detectPosition()` لو كانت العلامة في موضع متأخر.

---

## Architecture Risks

### 14. Synchronous Scan Endpoint (Blocking HTTP)
**الحالة:** ℹ️ مقبول للمرحلة الحالية
`POST /api/scans` يبلغ ~10-15 ثانية. HTTP connection مفتوح طوال المدة.
**الحل المؤجّل:** Queue-based processing (Phase 4 لاحقاً)

### 15. No Pagination
**الحالة:** ℹ️ مقبول للمرحلة الحالية
جميع endpoints تُرجع كل البيانات. ستبطأ مع كثرة البيانات.

### 16. No Error Boundaries in Frontend
**الملف:** `frontend/src/`
**الحالة:** ℹ️ مقبول للمرحلة الحالية
خطأ في `VisibilityChart` يُسقط Dashboard كله بصمت.

---

## ما تم إصلاحه ✅

| # | المشكلة | تاريخ الإصلاح |
|---|---|---|
| ~~1~~ | Scan never marked 'failed' | 2026-05-13 |
| ~~lint~~ | 15 pre-existing lint errors | 2026-05-13 |
| ~~model~~ | OpenRouter model name inconsistency | 2026-05-13 |
| ~~floating~~ | main.ts floating promise | 2026-05-13 |
| ~~throttling~~ | Hardcoded throttling values | 2026-05-13 |
| ~~3~~ | No rate limiting on POST /api/scans | 2026-05-13 |
| ~~4~~ | CORS hardcoded to localhost | 2026-05-13 |
| ~~5~~ | Missing Firestore composite index | 2026-05-13 |
| ~~7~~ | Typo `reponse` in parser.ts | 2026-05-13 |
| ~~gitignore~~ | serviceAccountKey.json not gitignored | 2026-05-13 |
| ~~readme~~ | VisibilityOrchestrator naming drift in README | 2026-05-13 |

---

## VisibilityOrchestrator Naming Drift — Status

**الحالة:** ℹ️ موثّق — لم يُحلّ بعد  
`VisibilityOrchestrator` في README غير موجود كـ class في الكود. `AIService.runScan()` هو الـ orchestrator.
**الإجراء المطلوب:** تحديث README — انظر `DEVELOPMENT_ROADMAP.md` Phase 1.2
