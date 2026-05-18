# WORKFLOW_ANALYSIS.md

## User Workflows

### Workflow A — Run a New Scan

1. User opens `http://localhost:5173`
2. App.tsx renders with `tab = 'scan'` by default
3. ScanForm rendered — two text inputs (brand, category)
4. User types brand (e.g. "Samsung") and category (e.g. "home tv")
5. Clicks "Run scan" — button shows spinning Loader2 + "Scanning (~20s)"
6. `api.createScan(brand, category)` fires `POST /api/scans { brand, category }`
7. Backend processes (see AI Scan Workflow below) — ~5–20s
8. Backend responds `{ scanId, brandId, resultCount: 4 }` (currently 4, not 15)
9. App.handleScanComplete fires `GET /api/scans/:brandId/:scanId`
10. ResultsTable renders: 4 stat boxes + detail table of all results
11. User can run another scan or switch to Dashboard tab

### Workflow B — View Dashboard Analytics

1. User clicks "Dashboard" tab
2. Dashboard component mounts
3. `useEffect` fires: `api.getBrands()` → `GET /api/analytics/brands`
4. If brands exist: first brand auto-selected, second `useEffect` fires: `api.getAnalytics(brandName)` → `GET /api/analytics?brand=Samsung`
5. Skeleton loading placeholders shown while loading
6. On data: 3 StatCards + VisibilityChart + EngineBreakdown rendered
7. User selects different brand in dropdown → analytics reload automatically

---

## AI Scan Workflow

**Entry:** `POST /api/scans { brand: "Samsung", category: "home tv" }`

```
ScanController.create(dto)
    │
    ▼
NestJS ValidationPipe validates CreateScanDto
    brand: string, minLength 2 ✓
    category: string, minLength 2 ✓
    │
    ▼
ScansService.createScan(dto)
    │
    ├─ getOrCreateBrand("Samsung")
    │       Firestore: brands.where('name', '==', 'Samsung').limit(1).get()
    │       → found? return existing ref
    │       → not found? brands.add({ name, createdAt })
    │
    ├─ firebase.scans(brandId).add({ brandId, status: 'running', createdAt })
    │       → returns scanRef with scanId
    │
    ├─ AIService.runScan({ brand: 'Samsung', category: 'home tv' })
    │       │
    │       ├─ engines = ['chatgpt-style', 'gemini-style']  ← slice(0,2) (THROTTLED)
    │       ├─ promptTemplates = [best_in_category, top_alternatives]  ← slice(0,2) (THROTTLED)
    │       │
    │       ├─ Build 4 tasks (2 templates × 2 engines):
    │       │       task[0]: best_in_category + chatgpt-style
    │       │       task[1]: best_in_category + gemini-style
    │       │       task[2]: top_alternatives + chatgpt-style
    │       │       task[3]: top_alternatives + gemini-style
    │       │
    │       └─ runWithConcurrency(tasks, concurrency=1, delay=2500ms)
    │               Batch 1: task[0]  → wait 2500ms
    │               Batch 2: task[1]  → wait 2500ms
    │               Batch 3: task[2]  → wait 2500ms
    │               Batch 4: task[3]
    │               Total: ~4 sequential calls with 2500ms gaps ≈ 10–15s
    │
    │       Each task runs runSingle(template, engine, brand, category):
    │               buildPrompt(template, brand, category)
    │                   → "What are the best brands in the home tv industry right now?"
    │               systemPrompt = ENGINE_PERSONAS['chatgpt-style']
    │                   → "You are ChatGPT, a helpful AI assistant..."
    │               callLLM(systemPrompt, prompt)
    │                   → if AI_PROVIDER='openrouter': callOpenrouter()
    │                   → if AI_PROVIDER='anthropic': callClaude()
    │               parseResponse(llmResponse, brand)
    │                   → detectMention(response, 'Samsung') → boolean
    │                   → detectPosition(response, 'Samsung') → number|null
    │                   → detectSentiment(response, 'Samsung') → Sentiment
    │                   → calcVisibilityScore(mentioned, position, sentiment) → 0-100
    │               return RawResult { engine, template, prompt, response, parsed }
    │
    ├─ Firestore batch write (all 4 results atomically):
    │       For each RawResult:
    │           results(brandId, scanId).doc() → batch.set({ all fields })
    │       batch.commit()
    │
    ├─ scanRef.update({ status: 'done', completedAt: now() })
    │
    └─ return { scanId, brandId, resultCount: 4 }
```

---

## Visibility Scoring Workflow

### calcVisibilityScore(mentioned, position, sentiment) → 0–100

```
Step 1 — Mention gate:
    mentioned = false → score = 0 (STOP)

Step 2 — Position base score:
    position === 1    → 100
    position === 2    → 80
    position === 3    → 65
    position >= 4     → 50
    position === null → 40   (mentioned but not in a list)

Step 3 — Sentiment bonus:
    sentiment = 'positive' → +10
    sentiment = 'negative' → -10
    sentiment = 'neutral'  → +0

Step 4 — Clamp:
    Math.min(100, Math.max(0, baseScore + sentimentBonus))
```

**Example:** Brand mentioned at position 2, positive sentiment → 80 + 10 = **90**
**Example:** Brand mentioned (no list), negative sentiment → 40 - 10 = **30**
**Example:** Brand not mentioned → **0**

### detectPosition() Logic

Scans response line by line:
1. First tries numbered list pattern: `/^(\d+)[.)]/` — matches "1. Brand" or "1) Brand"
2. If not numbered, tries bullet list: filters lines starting with `-`, `*`, `•`, finds brand index

**Bug risk:** Position detection runs on the first line that contains the brand, but the numbered regex and bullet logic check different things without unified priority. If the response has both a numbered mention and a bullet mention, only the numbered one fires.

### detectSentiment() Logic

1. Splits response on sentence boundaries `[.!?]`
2. Filters to only sentences containing the brand
3. Counts positive word matches and negative word matches in those sentences
4. Majority wins; tie or no words → neutral

**Note:** Lexicon-based, not LLM-based. Fast and free, but brittle on complex phrasing.

---

## Dashboard Workflow

```
Dashboard mounts
    │
    ├─ useEffect([])
    │       api.getBrands() → GET /api/analytics/brands
    │       → setBrands(results)
    │       → setSelectedBrand(results[0].name)   ← auto-select first
    │
    ├─ useEffect([selectedBrand])
    │       if (!selectedBrand) return
    │       run(api.getAnalytics(selectedBrand)) → GET /api/analytics?brand=Samsung
    │
    └─ Render:
            loading → skeleton placeholders (animate-pulse gray boxes)
            error   → red error text
            data    → StatCard×3 + VisibilityChart + EngineBreakdown
            no brands → "No brands tracked yet. Run a scan first."
```

---

## Firebase / Data Workflow

### Write path (scan creation):
```
ScansService.createScan()
    → brands.where(name).get()        [read — brand lookup]
    → brands.add() or reuse ref       [write or skip]
    → scans(brandId).add()            [write — scan doc, status: running]
    → AIService.runScan()             [external AI calls]
    → db.batch() → batch.set(×N)     [atomic write — all N results]
    → batch.commit()
    → scanRef.update(status: done)    [write — finalize scan]
```

### Read path (analytics):
```
AnalyticsService.getBrandAnalytics(brandName)
    → brands.where(name).limit(1).get()              [brand lookup]
    → scans(brandId).where(status, done).orderBy(createdAt, asc).get()  [all done scans]
    → Promise.all(scans.map → results(brandId, scanId).get())            [all results for each scan]
    → Build: timeline, byEngine, overall
```

**Performance note:** `getBrandAnalytics` makes `1 + N` Firestore reads where N = number of completed scans. With many scans, this is an N+1 problem.

---

## Analytics Workflow

### getBrandAnalytics output shape:

```typescript
{
  brand: "Samsung",
  timeline: [
    { scanId, date: ISO, avgScore, mentionRate, totalCalls, mentioned }
    // one entry per completed scan, ordered chronologically
  ],
  byEngine: {
    'chatgpt-style':    { avgScore, mentionRate, totalCalls },
    'gemini-style':     { avgScore, mentionRate, totalCalls },
    'perplexity-style': { avgScore, mentionRate, totalCalls },
  },
  overall: { totalScans, mentionRate, avgScore }
}
```

**avgScore calculation:** Only counts mentioned results (mentioned = true). If nothing mentioned, avgScore = 0.
**mentionRate calculation:** `(mentioned.length / results.length) * 100`, rounded.

---

## End-to-End Flow: User Action to Output

```
User submits ScanForm
    ↓
POST /api/scans (Axios, frontend)
    ↓
NestJS ValidationPipe (brand, category validated)
    ↓
ScansService.createScan()
    ↓
Firestore: brand upsert
    ↓
Firestore: scan doc created (status: running)
    ↓
AIService.runScan()
    ↓
For each task (4 total currently):
    buildPrompt() + ENGINE_PERSONAS → prompt + system prompt
    callLLM() → Anthropic or OpenRouter HTTP call → LLM text response
    parseResponse() → { mentioned, position, sentiment, visibilityScore }
    ↓
Firestore: batch write all results (atomic)
    ↓
Firestore: scan status updated to 'done'
    ↓
{ scanId, brandId, resultCount } → HTTP response to frontend
    ↓
Frontend: App.handleScanComplete fires
    ↓
GET /api/scans/:brandId/:scanId
    ↓
ScansService.getScanResults()
    ↓
Firestore: scan doc + all results fetched
    ↓
Stats computed (mentionRate, avgScore)
    ↓
{ scan, results, stats } → HTTP response to frontend
    ↓
ResultsTable renders: 4 stat boxes + detail rows
```
