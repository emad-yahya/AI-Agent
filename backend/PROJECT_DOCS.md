# AI Visibility Tracker — Backend Documentation

## What Is This Project?

The **AI Visibility Tracker** is a backend application that answers one question:

> **"When someone asks an AI chatbot (like ChatGPT, Gemini, or Perplexity) about products in my industry, does my brand get mentioned?"**

Imagine you own a brand called "AcmeCoffee." You want to know: if a user asks ChatGPT *"What are the best coffee brands?"*, does ChatGPT mention AcmeCoffee? Is it listed first, second, or not at all? Does the AI say nice things about it, or negative things?

This backend automates that entire process. It:
1. **Sends questions to AI models** pretending to be different AI engines (ChatGPT, Gemini, Perplexity).
2. **Reads the AI's response** and figures out whether your brand was mentioned.
3. **Calculates a visibility score** (0–100) based on if you were mentioned, what position, and the sentiment.
4. **Stores everything in a database** (Firebase Firestore).
5. **Provides analytics** so you can track your brand's AI visibility over time.

---

## Tech Stack

| Technology | What It Does |
|---|---|
| **NestJS** | The web framework (like Express, but with more structure). Handles routes, dependency injection, and modules. |
| **TypeScript** | The programming language — JavaScript with types. |
| **Firebase Firestore** | The NoSQL database where brands, scans, and results are stored. |
| **Anthropic SDK** | Used to call Claude (an AI model) for generating responses. |
| **OpenAI SDK (via OpenRouter)** | Used to call other AI models through OpenRouter (a proxy that gives access to many AI models). |
| **class-validator** | Validates incoming HTTP request data (e.g., making sure `brand` is not empty). |

---

## Project Structure Explained

```
backend/
├── src/
│   ├── main.ts              # App entry point — starts the server
│   ├── app.module.ts         # Root module — wires everything together
│   ├── common/
│   │   └── types.ts          # Shared TypeScript interfaces (data shapes)
│   ├── firebase/
│   │   ├── firebase.module.ts  # Registers Firebase as a global module
│   │   └── firebase.service.ts # Connects to Firestore + helper methods
│   ├── ai/
│   │   ├── ai.module.ts      # Registers the AI service
│   │   ├── ai.service.ts     # Talks to AI models (Claude / OpenRouter)
│   │   ├── prompts.ts        # The questions we ask the AI + engine personas
│   │   └── parser.ts         # Analyzes AI responses (mention, position, sentiment)
│   ├── scans/
│   │   ├── scans.module.ts   # Wires the scan feature together
│   │   ├── scans.controller.ts # HTTP endpoints for creating/getting scans
│   │   ├── scans.service.ts  # Business logic for running a full scan
│   │   └── dto.ts            # Data Transfer Object — validates request body
│   └── analytics/
│       ├── analytics.module.ts    # Wires the analytics feature together
│       ├── analytics.controller.ts # HTTP endpoints for analytics
│       └── analytics.service.ts   # Aggregates scan data into analytics
```

---

## How NestJS Works (Quick Primer)

NestJS organizes code into **Modules**, **Controllers**, and **Services**:

- **Module** (`@Module`): A container that groups related code. Think of it as a folder with rules about what's inside and what's shared.
- **Controller** (`@Controller`): Handles HTTP requests. When someone sends `POST /api/scans`, a controller method runs.
- **Service** (`@Injectable`): Contains business logic. Controllers call services to do the actual work.

NestJS uses **Dependency Injection** — instead of manually creating objects, you just declare what you need in a constructor, and NestJS gives it to you:

```typescript
// You don't do: const ai = new AIService()
// Instead, NestJS injects it:
constructor(private ai: AIService) {}
```

---

## File-by-File Walkthrough

### `main.ts` — The Entry Point

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

What this does:
- Creates the NestJS application using `AppModule` as the root.
- **`enableCors`**: Allows the frontend (running on `localhost:5173`, a Vite dev server) to talk to this backend.
- **`ValidationPipe`**: Automatically validates incoming request bodies. If someone sends `{ brand: "" }`, it rejects the request. The `whitelist: true` option strips any extra fields that aren't defined in the DTO.
- **`setGlobalPrefix('api')`**: All routes start with `/api/`. So `POST /scans` becomes `POST /api/scans`.
- **Listens on port 3000** (or whatever `PORT` env var is set to).

---

### `app.module.ts` — The Root Module

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    AIModule,
    ScansModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
```

This imports all feature modules. `ConfigModule.forRoot({ isGlobal: true })` loads environment variables from `.env` and makes them available everywhere via `ConfigService`.

---

### `common/types.ts` — Shared Data Types

This file defines the **shape of data** used throughout the app:

```typescript
type ScanStatus = 'pinding' | 'running' | 'done' | 'failed';
type Sentiment = 'positive' | 'neutral' | 'negative';
type Engine = 'chatgpt-style' | 'gemini-style' | 'perplexity-style';
```

- **`ScanStatus`**: Tracks where a scan is in its lifecycle.
- **`Sentiment`**: Whether the AI said positive, negative, or neutral things about your brand.
- **`Engine`**: The three simulated AI engines we test against.

**Interfaces:**
- **`Brand`**: A brand being tracked (e.g., `{ name: "Nike" }`).
- **`Scan`**: One scan session — a batch of AI queries for a brand.
- **`ScanResult`**: One individual AI response with its analysis (was the brand mentioned? what position? what sentiment? what's the score?).

---

### `firebase/firebase.service.ts` — Database Connection

```typescript
@Injectable()
export class FirebaseService implements OnModuleInit {
  private db: Firestore;

  onModuleInit() {
    admin.initializeApp({
      credential: admin.credential.cert(
        path.join(process.cwd(), 'serviceAccountKey.json'),
      ),
    });
    this.db = admin.firestore();
  }
```

- **`OnModuleInit`**: A NestJS lifecycle hook. The `onModuleInit()` method runs automatically when the app starts.
- It initializes Firebase using a **service account key** (a JSON file with credentials).
- It sets up Firestore (Firebase's NoSQL database).

**Helper methods:**
| Method | Returns |
|---|---|
| `brands()` | The `brands` collection |
| `scans(brandId)` | The `scans` sub-collection under a specific brand |
| `results(brandId, scanId)` | The `results` sub-collection under a specific scan |
| `now()` | A Firestore timestamp for the current time |
| `getDb()` | The raw Firestore database instance |

**Database structure in Firestore:**
```
brands/                          ← top-level collection
  └── {brandId}/                 ← one document per brand
       ├── name: "Nike"
       ├── createdAt: Timestamp
       └── scans/                ← sub-collection
            └── {scanId}/        ← one document per scan
                 ├── status: "done"
                 ├── createdAt: Timestamp
                 └── results/    ← sub-collection
                      └── {resultId}/
                           ├── engine: "chatgpt-style"
                           ├── prompt: "What are the best..."
                           ├── response: "Here are the top..."
                           ├── mentioned: true
                           ├── position: 2
                           ├── sentiment: "positive"
                           └── visibilityScore: 90
```

The `FirebaseModule` is marked `@Global()`, meaning any module in the app can use `FirebaseService` without explicitly importing `FirebaseModule`.

---

### `ai/prompts.ts` — What We Ask The AI

This file has two key pieces:

#### 1. Engine Personas
Each AI engine gets a **system prompt** that makes the LLM role-play as that engine:

```typescript
const ENGINE_PERSONAS = {
  'chatgpt-style': 'You are ChatGPT, a helpful AI assistant made by OpenAI...',
  'gemini-style': 'You are Gemini, an AI assistant made by Google...',
  'perplexity-style': 'You are Perplexity AI, a search-focused AI assistant...',
};
```

Why? Different AI engines might mention different brands. By simulating multiple engines, you get a broader picture.

#### 2. Prompt Templates
Five predefined questions that simulate real user queries:

| Template ID | Example Prompt |
|---|---|
| `best_in_category` | "What are the best brands in the **coffee** industry right now?" |
| `top_alternatives` | "What are the top alternatives to **AcmeCoffee** that I should consider?" |
| `brand_reputation` | "Is **AcmeCoffee** a good company? What do people think about them?" |
| `buying_advice` | "I am looking for a reliable product in the **coffee** space. What would you recommend?" |
| `market_leaders` | "Who are the market leaders in **coffee** and why?" |

The `{brand}` and `{category}` placeholders are replaced with the real brand and category at runtime via the `buildPrompt()` function.

---

### `ai/parser.ts` — Analyzing AI Responses

After the AI responds, we need to extract insights. This file has four functions:

#### `detectMention(response, brand) → boolean`
Simple check: does the response text contain the brand name? (case-insensitive)

```typescript
// "Nike is a great brand" + brand="Nike" → true
// "Adidas leads the market" + brand="Nike" → false
```

#### `detectPosition(response, brand) → number | null`
If the brand is mentioned in a **numbered list** (like "1. Nike, 2. Adidas"), it extracts the position number. It also handles **bullet lists** (`-`, `*`, `•`).

```
"1. Nike        → position = 1
 2. Adidas      → position = 2
 3. Puma"       → position = 3
```

Returns `null` if the brand isn't in a list format.

#### `detectSentiment(response, brand) → Sentiment`
Finds sentences that mention the brand, then counts positive vs. negative words:

- **Positive words**: excellent, great, best, top, leading, reliable, trusted, etc.
- **Negative words**: poor, bad, worst, unreliable, avoid, problems, etc.

If more positive words → `"positive"`. More negative → `"negative"`. Equal or none → `"neutral"`.

#### `caclVisibilityScore(mentioned, position, sentiment) → number`
Calculates a final score from 0 to 100:

| Condition | Score |
|---|---|
| Not mentioned at all | **0** |
| Mentioned, position #1 | **100** |
| Mentioned, position #2 | **80** |
| Mentioned, position #3 | **65** |
| Mentioned, position #4+ | **50** |
| Mentioned, no list position | **40** |

Then a sentiment bonus is applied:
- Positive sentiment: **+10**
- Negative sentiment: **-10**
- Neutral: **+0**

The final score is clamped between 0 and 100.

#### `parseResponse(response, brand) → ParsedResult`
Ties it all together — calls all four functions and returns one object:

```typescript
{
  mentioned: true,
  position: 2,
  sentiment: 'positive',
  visibilityScore: 90   // 80 (position 2) + 10 (positive) = 90
}
```

---

### `ai/ai.service.ts` — Calling AI Models

This is the service that actually talks to AI models.

#### Constructor Setup
```typescript
constructor(private config: ConfigService) {
  this.claude = new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY') });
  this.openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.get('OPENROUTER_API_KEY'),
  });
  this.provider = config.get('AI_PROVIDER', 'openrouter'); // default: openrouter
}
```

It supports **two providers**:
- **Anthropic (Claude)** — directly via the Anthropic SDK.
- **OpenRouter** — via the OpenAI SDK pointed at OpenRouter's URL (OpenRouter is compatible with OpenAI's API format).

Which one is used depends on the `AI_PROVIDER` environment variable.

#### `runScan(input) → RawResult[]`
This is the main method. Given a brand name and category, it:

1. Creates a task for **every combination** of prompt template × engine.
   - 5 templates × 3 engines = **15 AI calls** per scan.
2. Runs them **3 at a time** (concurrency limit) with a 300ms delay between batches.
   - This prevents rate limiting from the AI provider.
3. Collects all successful results (failed calls are logged but skipped).

```
runScan({ brand: "Nike", category: "sneakers" })
  → 15 AI calls
  → each response is parsed (mention, position, sentiment, score)
  → returns array of RawResult objects
```

#### `runWithConcurrency(tasks, concurrency, delayMs)`
A utility that runs async tasks in batches. Instead of firing all 15 calls at once (which could hit rate limits), it runs them in groups of `concurrency` (3) with a `delayMs` (300ms) pause between groups.

---

### `scans/dto.ts` — Request Validation

```typescript
export class CreateScanDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  brand: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  category: string;
}
```

This is a **Data Transfer Object**. When someone sends a `POST /api/scans` request, NestJS uses `class-validator` decorators to check:
- `brand` must be a non-empty string, at least 2 characters.
- `category` must be a non-empty string, at least 2 characters.

If validation fails, NestJS automatically returns a `400 Bad Request` with error details.

---

### `scans/scans.controller.ts` — HTTP Endpoints

```typescript
@Controller('scans')
export class ScanController {
  @Post()              // POST /api/scans
  create(@Body() dto: CreateScanDto) { ... }

  @Get(':brandId/:scanId')   // GET /api/scans/:brandId/:scanId
  getResults(@Param('brandId') brandId, @Param('scanId') scanId) { ... }
}
```

Two endpoints:

| Method | URL | What It Does |
|---|---|---|
| `POST` | `/api/scans` | Creates a new scan. Body: `{ "brand": "Nike", "category": "sneakers" }` |
| `GET` | `/api/scans/:brandId/:scanId` | Gets the results of a specific scan |

---

### `scans/scans.service.ts` — Scan Business Logic

#### `createScan(dto)`
The full scan workflow:

1. **Find or create the brand** in Firestore.
   - If "Nike" already exists in the `brands` collection, reuse it.
   - If not, create a new brand document.
2. **Create a scan document** with status `"running"`.
3. **Run the AI scan** — calls `AIService.runScan()` which makes 15 AI calls.
4. **Save all results** in a Firestore batch write (all at once, atomically).
5. **Update the scan status** to `"done"`.
6. **Return** `{ scanId, brandId, resultCount }`.

#### `getScanResults(brandId, scanId)`
Retrieves results for a completed scan and computes summary stats:

```typescript
{
  scan: { id, status, createdAt, ... },
  results: [ ...all individual results... ],
  status: {
    total: 15,        // total AI calls made
    mentioned: 10,    // how many mentioned the brand
    mentionRate: 67,   // percentage (67%)
    avgScore: 75,     // average visibility score of mentioned results
  }
}
```

---

### `analytics/analytics.controller.ts` — Analytics Endpoints

```typescript
@Controller('analytics')
export class AnalyticsController {
  @Get('brands')        // GET /api/analytics/brands
  getAllBrands() { ... }

  @Get()                // GET /api/analytics?brand=Nike
  getBrandAnalytics(@Query('brand') brand: string) { ... }
}
```

| Method | URL | What It Does |
|---|---|---|
| `GET` | `/api/analytics/brands` | Lists all tracked brands |
| `GET` | `/api/analytics?brand=Nike` | Gets full analytics for a specific brand |

---

### `analytics/analytics.service.ts` — Analytics Logic

#### `getAllBrands()`
Returns all brands from Firestore, sorted by creation date (newest first).

#### `getBrandAnalytics(brandName)`
This is the big analytics method. It:

1. Finds the brand by name.
2. Loads **all completed scans** for that brand (ordered by date).
3. For each scan, loads all its results.
4. Builds three types of analytics:

**Timeline** — How visibility changes over time:
```typescript
timeline: [
  { scanId, date: "2026-03-01T...", avgScore: 60, mentionRate: 53, ... },
  { scanId, date: "2026-03-15T...", avgScore: 72, mentionRate: 67, ... },
]
```

**By Engine** — Performance per AI engine:
```typescript
byEngine: {
  "chatgpt-style":    { avgScore: 70, mentionRate: 60, totalCalls: 20 },
  "gemini-style":     { avgScore: 55, mentionRate: 40, totalCalls: 20 },
  "perplexity-style": { avgScore: 80, mentionRate: 80, totalCalls: 20 },
}
```

**Overall** — Aggregate stats across all scans:
```typescript
overall: { totalScans: 4, mentionRate: 60, avgScore: 68 }
```

---

## API Endpoints Summary

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| `POST` | `/api/scans` | `{ "brand": "Nike", "category": "sneakers" }` | Run a new visibility scan |
| `GET` | `/api/scans/:brandId/:scanId` | URL params | Get results of a specific scan |
| `GET` | `/api/analytics/brands` | — | List all tracked brands |
| `GET` | `/api/analytics?brand=Nike` | Query param | Get analytics for a brand |

---

## How a Scan Works End-to-End

Here is the full flow when you call `POST /api/scans` with `{ "brand": "Nike", "category": "sneakers" }`:

```
1. Request hits ScanController.create()
2. NestJS validates the body using CreateScanDto (brand & category must be non-empty strings)
3. ScansService.createScan() runs:
   a. Look up "Nike" in Firestore → found? reuse it. Not found? create new brand doc.
   b. Create a new scan document (status: "running")
   c. AIService.runScan() kicks off:
      - 5 prompt templates × 3 engines = 15 AI calls
      - Each call: send the prompt to the AI model, get a response
      - Each response is parsed: mentioned? position? sentiment? score?
      - Runs 3 calls at a time with 300ms delay between batches
   d. Save all 15 parsed results to Firestore (batch write)
   e. Update scan status to "done"
4. Return { scanId, brandId, resultCount: 15 }
```

---

## Environment Variables

These go in the `.env` file in the backend root:

| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | No | `"openrouter"` (default) or `"anthropic"` |
| `ANTHROPIC_API_KEY` | If using anthropic | API key for Claude |
| `ANTHROPIC_MODEL` | No | Model name (default: `claude-haiku-4-5`) |
| `OPENROUTER_API_KEY` | If using openrouter | API key for OpenRouter |
| `OPENROUTER_MODEL` | No | Model name (default: `nvidia/nemotron-3-super-120b-a12b:free`) |
| `PORT` | No | Server port (default: `3000`) |

---

## How to Run

```bash
# Install dependencies
npm install

# Start in development mode (auto-restarts on file changes)
npm run start:dev

# Build for production
npm run build

# Start production build
npm run start:prod
```

Make sure you have:
1. A `serviceAccountKey.json` file in the backend root (Firebase credentials).
2. A `.env` file with at least one AI provider API key.

---

## Key Concepts Glossary

| Term | Meaning |
|---|---|
| **Brand** | A company/product being tracked for AI visibility (e.g., "Nike") |
| **Scan** | One batch run that queries multiple AI engines with multiple prompts |
| **Scan Result** | One individual AI query result — one prompt sent to one engine |
| **Engine** | A simulated AI chatbot personality (ChatGPT-style, Gemini-style, Perplexity-style) |
| **Visibility Score** | A 0–100 number indicating how prominently a brand appears in AI responses |
| **Mention Rate** | Percentage of AI responses that mentioned the brand |
| **Sentiment** | Whether the AI spoke positively, negatively, or neutrally about the brand |
| **Position** | Where the brand appeared in a list (1st, 2nd, 3rd, etc.) |
| **DTO** | Data Transfer Object — a class that defines and validates the shape of incoming request data |
| **Firestore** | Google's NoSQL cloud database, part of Firebase |
| **OpenRouter** | A proxy service that gives access to many AI models via one API |
