# CODE_EXPLANATION.md

## backend/src/main.ts

**Bootstrap function — runs once at startup.**

```typescript
app.enableCors({ origin: 'http://localhost:5173' })
```
CORS hardcoded to Vite dev server. Production deployments will need this changed.

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
```
`whitelist: true` strips any extra fields from request bodies not defined in the DTO. Protects against unknown field injection.

```typescript
app.setGlobalPrefix('api')
```
All routes start with `/api/`. ScanController's `@Controller('scans')` becomes `/api/scans`.

---

## backend/src/common/types.ts

Shared type definitions used by both backend layers and referenced by the frontend API client (separately re-declared there).

```typescript
type ScanStatus = 'pending' | 'running' | 'done' | 'failed'
```
`'pending'` is defined but never used — scans go directly to `'running'` when created.
`'failed'` is defined but never set — error handling in ScansService is missing.

```typescript
interface ScanResult {
  position: number | null   // null when brand mentioned but not in a list
}
```
`null` and `0` are different: `null` = mentioned but no list position; `0` is never a valid position (positions start at 1).

---

## backend/src/firebase/firebase.service.ts

```typescript
onModuleInit() {
  if (!admin.apps.length) {    // guard against double-initialization
    admin.initializeApp({
      credential: admin.credential.cert(
        path.join(process.cwd(), 'serviceAccountKey.json')
      ),
    });
  }
  this.db = admin.firestore();
}
```
`process.cwd()` resolves to the directory where `nest start` is run — expected to be the `backend/` folder. If run from project root, path breaks.

Collection accessor pattern:
```typescript
brands() → CollectionReference
scans(brandId) → brands().doc(brandId).collection('scans')
results(brandId, scanId) → scans(brandId).doc(scanId).collection('results')
```
All three return Firestore query builders, not data — actual `.get()` happens in the calling service.

---

## backend/src/ai/prompts.ts

### ENGINE_PERSONAS

Three system prompts that make one LLM pretend to be different AI engines:
```typescript
'chatgpt-style':    "You are ChatGPT..." (conversational, direct)
'gemini-style':     "You are Gemini..." (balanced, research-focused)
'perplexity-style': "You are Perplexity..." (concise, data/review-based)
```
These personas influence how the LLM structures its response — list-heavy responses from Perplexity-style vs. prose-heavy from ChatGPT-style. This affects detectPosition().

### SEARCH_PROMPTS — 5 templates

| ID | Template |
|---|---|
| `best_in_category` | "What are the best brands in the {category} industry right now?" |
| `top_alternatives` | "What are the top alternatives to {brand}...?" |
| `brand_reputation` | "Is {brand} a good company?..." |
| `buying_advice` | "I am looking for a reliable product in the {category} space..." |
| `market_leaders` | "Who are the market leaders in {category} and why?" |

Note: Only `best_in_category` and `top_alternatives` are currently used (throttling: `slice(0,2)`).

### buildPrompt(template, brand, category)

Simple string replace: `{brand}` and `{category}` placeholders replaced with actual values. No escaping — if a user passes a brand name with `{category}` in it, it would be double-substituted.

---

## backend/src/ai/ai.service.ts

### Constructor

```typescript
this.claude = new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY') })
this.openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.get('OPENROUTER_API_KEY'),
})
```
Both clients initialized at startup regardless of which provider is active. If `ANTHROPIC_API_KEY` is empty, the Anthropic client still initializes — it will just fail on first use.

### callLLM(systemPrompt, userMessage)

Provider router — single decision point. Adding a new provider is a one-line change here + a new private method.

```typescript
callClaude: claude.messages.create({ model, max_tokens: 400, system, messages })
callOpenrouter: openrouter.chat.completions.create({ model, max_tokens: 400, messages })
```
Both cap at 400 tokens. Longer brand lists in AI responses will be cut off, which can distort position detection.

### runSingle(template, engine, brand, category)

```typescript
const prompt = buildPrompt(template, brand, category)
const systemPrompt = ENGINE_PERSONAS[engine]
const response = await this.callLLM(systemPrompt, prompt)
const parsed = parseResponse(response, brand)
return { engine, template, prompt, response, parsed }
```
Raw response AND parsed result both returned. `ScansService` stores both (`response` text + all parsed fields).

### runWithConcurrency(tasks, concurrency, delayMs)

```typescript
for (let i = 0; i < tasks.length; i += concurrency) {
  const batch = tasks.slice(i, i + concurrency)
  const batchResults = await Promise.allSettled(batch.map(t => t()))
  results.push(...batchResults)
  if (i + concurrency < tasks.length) await sleep(delayMs)
}
```
Tasks are `() => Promise<T>` — lazy evaluation. `Promise.allSettled` means one failed call doesn't cancel others in the same batch. Failed tasks are logged as warnings and excluded from results.

### runScan() — Current vs Documented Behavior

**DOCUMENTED (README says):** 5 templates × 3 engines = 15 calls, concurrency=3, delay=300ms
**ACTUAL CODE:**
```typescript
const engines = allEngines.slice(0, 2)          // 2 engines only
const promptTemplates = SEARCH_PROMPTS.slice(0, 2) // 2 templates only
// → 4 total tasks
const settled = await this.runWithConcurrency(tasks, 1, 2500) // 1 at a time, 2.5s delay
```
Comments in Arabic explain: "We reduced engines to only two" / "We reduced prompts to only first 2" / "1 request at a time + 2.5s between each batch". This was done to stay within free-tier API rate limits.

---

## backend/src/ai/parser.ts

### detectMention(response, brand) → boolean

```typescript
return response.toLowerCase().includes(brand.toLowerCase())
```
Case-insensitive substring match. Simple and correct. **Note:** parameter is named `reponse` (typo — missing 's') on line 10.

### detectPosition(response, brand) → number | null

Scans line by line, returns on first line containing the brand:

```typescript
const numbered = line.match(/^(\d+)[.)]/)  // matches "1. " or "1) "
if (numbered) return parseInt(numbered[1])

const bulletLines = lines.filter(l => /^[-*•]/.test(l.trim()))
const bulletIndex = bulletLines.findIndex(l => l.toLowerCase().includes(brandLower))
if (bulletIndex !== -1) return bulletIndex + 1
```

**Logic quirk:** If the brand appears in a bullet list AND is also mentioned elsewhere before the bullet, position returns null (the `for` loop hits the non-bullet line first and the bullet check doesn't match). Only the first matching line is examined.

### detectSentiment(response, brand) → Sentiment

```typescript
const sentences = response
  .split(/[.!?]/)
  .filter(s => s.toLowerCase().includes(brandLower))
  .join(' ')
  .toLowerCase()
```
Concatenates only brand-containing sentences, then counts positive/negative word hits across the whole concatenated string. Works well for simple responses; may misattribute sentiment if multiple brands appear in the same sentence.

### calcVisibilityScore(mentioned, position, sentiment) → number

The scoring formula. See WORKFLOW_ANALYSIS.md for full table.

### parseResponse(response, brand) → ParsedResult

Orchestrates all four functions:
```typescript
const mentioned = detectMention(response, brand)
const position = mentioned ? detectPosition(response, brand) : null
const sentiment = mentioned ? detectSentiment(response, brand) : 'neutral'
const visibilityScore = calcVisibilityScore(mentioned, position, sentiment)
return { mentioned, position, sentiment, visibilityScore }
```
If not mentioned, position and sentiment skip computation and default to `null` / `'neutral'`.

---

## backend/src/scans/scans.service.ts

### createScan() — Key Decision Points

```typescript
const batch = this.firebase.getDb().batch()
for (const raw of rawResults) {
  const resultRef = this.firebase.results(brandId, scanId).doc()
  batch.set(resultRef, { ...fields })
}
await batch.commit()
```
Atomic write — all results committed together or none. Firestore batch has a 500-document limit (not a concern at current 4 results/scan, but relevant if scaling to 15+).

```typescript
await scanRef.update({ status: 'done', completedAt: this.firebase.now() })
```
No `try/catch` around AI calls or batch write. If either throws, scan stays `'running'` forever.

### getOrCreateBrand() — Race Condition

```typescript
const snapshot = await brands().where('name', '==', brandName).limit(1).get()
if (!snapshot.empty) return snapshot.docs[0].ref
return firebase.brands().add({ name: brandName, createdAt: now() })
```
Non-atomic check-then-create. Two simultaneous scans for a new brand can create duplicate brand documents. Low risk in current single-user usage.

---

## backend/src/analytics/analytics.service.ts

### getBrandAnalytics() — N+1 Pattern

```typescript
const scanData = await Promise.all(
  scansSnap.docs.map(async (scanDoc) => {
    const resultsSnap = await this.firebase.results(brandId, scanId).get()
    return { scanId, scan, results }
  })
)
```
`Promise.all` fires all result fetches concurrently (not sequentially), so it's actually "1 + 1 parallel-N" not classic N+1 sequential. Still O(N) Firestore reads where N = scan count.

### aggregateByEngine() — Private Method

```typescript
const engines: Engine[] = ['chatgpt-style', 'gemini-style', 'perplexity-style']
```
Hardcoded engine list. If a new engine is added to the Engine type, this array must also be updated.

---

## frontend/src/hooks/useAsync.ts

```typescript
export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: false, error: null })

  const run = useCallback(async (promise: Promise<T>) => {
    setState({ data: null, loading: true, error: null })  // clears previous data
    try {
      const data = await promise
      setState({ data, loading: false, error: null })
      return data
    } catch (error: any) {
      const message = error?.response?.data?.message ?? error?.message ?? 'Something went wrong'
      setState({ data: null, loading: false, error: message })
      return null
    }
  }, [])

  return { ...state, run }
}
```

**Important:** `setState({ data: null, loading: true ... })` clears previous data on every `run()` call. Dashboard will briefly show nothing when switching brands while new data loads. This is intentional — it prevents stale data flash — but means no "keep old data while loading" behavior.

`run` is wrapped in `useCallback` with empty deps — it's a stable function reference, safe to put in useEffect dependency arrays.

Error extraction: prioritizes Axios nested error format `error.response.data.message` over generic `error.message`.

---

## frontend/src/api/client.ts

```typescript
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
})
```
Falls back to localhost if env var missing. Works for development without `.env` file.

No interceptors, no auth headers, no retry logic. Bare minimum for a portfolio project.

**Type duplication note:** TypeScript interfaces in this file (`ScanResult`, `ScanResponse`, etc.) duplicate the backend types from `common/types.ts`. They are kept separate because Vite doesn't import NestJS backend code. Any changes to backend types must be manually reflected here.

---

## frontend/src/App.tsx

Tab routing without React Router — simple `useState<Tab>`:
```typescript
const [tab, setTab] = useState<Tab>('scan')
// Tab = 'scan' | 'dashboard'
```
No URL state. Refreshing the page always returns to 'scan' tab. Not a concern for a portfolio app.

**Scan result flow:**
```typescript
const handleScanComplete = async (brandId: string, scanId: string) => {
  const result = await run(api.getScan(brandId, scanId))
  if (result) setScanResult(result)
}
```
ScanForm calls `onScanComplete(brandId, scanId)` after POST succeeds. App then GETs the full results. Two-step by design — POST returns only IDs, GET returns the full data.

---

## frontend/src/pages/Dashboard.tsx

```typescript
useEffect(() => {
  api.getBrands().then(b => {
    setBrands(b)
    if (b.length > 0) setSelectedBrand(b[0].name)
  })
}, [])

useEffect(() => {
  if (!selectedBrand) return
  run(api.getAnalytics(selectedBrand))
}, [selectedBrand])
```
Two `useEffect`s chained: first sets brands, which triggers the second via `selectedBrand` state. The second fires whenever `selectedBrand` changes (brand dropdown).

**ESLint warning:** `run` is not in the deps array of the second `useEffect`. This is technically a React lint violation but harmless since `run` from `useCallback([])` is stable.

---

## frontend/src/components/VisibilityChart.tsx

```typescript
<ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="4 4" />
```
Dashed line at y=50 acts as a visual "above average" threshold. No calculation behind it — purely cosmetic.

```typescript
itemSorter={(item) => item.dataKey === 'mentionRate' ? 0 : 1}
```
Forces mentionRate to appear first in tooltip, above avgScore. Order matters for readability when both values are close.

---

## frontend/src/components/EngineBreakdown.tsx

```typescript
style={{ backgroundColor: `${entry.color}10` }}
```
`#10a37f10` — appending `10` to a 6-digit hex color gives it 10/255 ≈ 4% opacity as background. Browser-specific hex transparency shorthand — works in all modern browsers.

The stats grid below the chart duplicates mentionRate data from the chart tooltips, but in a persistent, always-visible format. More useful on mobile where tooltips require hover/tap.
