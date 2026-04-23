# AI Visibility Tracker — Frontend Documentation

## What Is This?

This is the **frontend** for the AI Visibility Tracker — a React web app that lets you:

1. **Run scans** — Enter a brand name and category, then see how AI chatbots talk about that brand.
2. **View results** — A table showing every AI response: which engine, what prompt, was the brand mentioned, position, sentiment, and a visibility score.
3. **Analyze trends** — A dashboard with charts that show how your brand's AI visibility changes over time and across different AI engines.

It talks to the backend API (NestJS server on `localhost:3000`) to create scans and fetch analytics data.

---

## Tech Stack

| Technology         | What It Does                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **React 19**       | The UI library — builds the interface using components                                                 |
| **TypeScript**     | JavaScript with types — catches errors before runtime                                                  |
| **Vite**           | The dev server & build tool — extremely fast hot-reload during development                             |
| **Tailwind CSS 4** | Utility-first CSS framework — style elements with class names like `bg-blue-600 text-white rounded-lg` |
| **Recharts**       | Charting library for React — draws the line chart and bar chart                                        |
| **Lucide React**   | Icon library — provides clean, consistent SVG icons (`Eye`, `Radar`, `Check`, `TrendingUp`, etc.)      |
| **Axios**          | HTTP client for making API calls to the backend                                                        |

---

## Project Structure Explained

```
frontend/
├── index.html              # The single HTML page (React mounts into <div id="root">)
├── vite.config.ts           # Vite configuration (just enables the React plugin)
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.js        # PostCSS configuration (connects Tailwind)
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── .env                     # Environment variables (VITE_API_URL)
├── public/                  # Static assets served as-is
└── src/
    ├── main.tsx             # Entry point — mounts <App /> into the DOM
    ├── App.tsx              # Root component — layout, tabs, and page routing
    ├── index.css            # Global CSS (just imports Tailwind)
    ├── api/
    │   └── client.ts        # API client — all HTTP calls + TypeScript types
    ├── hooks/
    │   └── useAsync.ts      # Custom hook for loading/error state management
    ├── components/
    │   ├── ScanForm.tsx     # Form to input brand + category and trigger a scan
    │   ├── ResultsTable.tsx # Table displaying individual scan results
    │   ├── StatCard.tsx     # Small card showing a single metric (score, rate, etc.)
    │   ├── VisibilityChart.tsx  # Line chart: visibility score over time
    │   └── EngineBreakdown.tsx  # Bar chart: score breakdown by AI engine
    └── pages/
        └── Dashboard.tsx    # Dashboard page — brand selector + analytics
```

---

## How React Works (Quick Primer)

React builds UIs from **components** — small, reusable pieces that each render a chunk of HTML.

```tsx
// A simple component
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>;
}

// Using it
<Greeting name="Alice" />; // renders: <h1>Hello, Alice!</h1>
```

Key concepts used in this project:

- **`useState`**: Stores data that can change (e.g., the current tab, form inputs).

  ```tsx
  const [brand, setBrand] = useState(""); // brand starts as ''
  setBrand("Nike"); // now brand is 'Nike', component re-renders
  ```

- **`useEffect`**: Runs code when the component mounts or when dependencies change.

  ```tsx
  useEffect(() => {
    api.getBrands().then((b) => setBrands(b)); // runs once when component first appears
  }, []); // empty array = run only once
  ```

- **Props**: Data passed from a parent component to a child.
  ```tsx
  <StatCard label="Total scans" value={42} color="blue" />
  // StatCard receives { label, value, color } as its props
  ```

---

## File-by-File Walkthrough

### `main.tsx` — Entry Point

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

This finds the `<div id="root">` in `index.html` and renders the entire React app inside it. `StrictMode` is a development helper that warns about potential problems.

---

### `App.tsx` — Root Component

This is the top-level component that controls everything you see.

It imports three Lucide icons:

- `Eye` — displayed next to the app title in the header.
- `ScanSearch` — shown inside the "New scan" tab button.
- `LayoutDashboard` — shown inside the "Dashboard" tab button.

#### What It Renders

```
┌─────────────────────────────────────────┐
│  👁 AI Visibility Tracker               │
│                  [🔍 New scan] [📊 Dashboard]│ ← tab buttons with icons
├─────────────────────────────────────────┤
│                                         │
│  If tab = 'scan':                       │
│    → ScanForm                           │
│    → ResultTable (after scan completes) │
│                                         │
│  If tab = 'dashboard':                  │
│    → Dashboard page                     │
│                                         │
└─────────────────────────────────────────┘
```

#### How Tab Switching Works

```tsx
const [tab, setTab] = useState<Tab>("scan"); // starts on 'scan' tab
```

When you click "Dashboard", `setTab('dashboard')` is called, React re-renders, and the dashboard content appears instead of the scan form.

#### How a Scan Flows

1. User fills in the `ScanForm` → clicks "Run scan".
2. `ScanForm` calls the backend `POST /api/scans` → gets back `{ brandId, scanId }`.
3. `ScanForm` calls `onScanComplete(brandId, scanId)` — a callback prop.
4. `App.handleScanComplete` runs → calls `GET /api/scans/:brandId/:scanId` to fetch full results.
5. Results are stored in `scanResult` state → `ResultTable` renders them.

---

### `api/client.ts` — API Client

This file handles **all communication with the backend**.

#### HTTP Setup

```typescript
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
  headers: { "Content-Type": "application/json" },
});
```

Creates an Axios instance configured to talk to the backend. The base URL comes from the `VITE_API_URL` environment variable, defaulting to `http://localhost:3000/api`.

#### TypeScript Types

The file defines all the shapes of data that come back from the API:

| Type                | What It Represents                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `ScanResult`        | One individual AI query result (engine, prompt, response, mentioned, position, sentiment, score) |
| `ScanResponse`      | Full scan: the scan metadata + all results + summary stats                                       |
| `TimelinePoint`     | One data point on the timeline chart (date, avgScore, mentionRate)                               |
| `AnalyticsResponse` | Full analytics for a brand: timeline, per-engine breakdown, overall stats                        |
| `Brand`             | A tracked brand (id, name, createdAt)                                                            |

#### API Functions

| Function                          | HTTP Call                         | Purpose                           |
| --------------------------------- | --------------------------------- | --------------------------------- |
| `api.createScan(brand, category)` | `POST /api/scans`                 | Start a new visibility scan       |
| `api.getScan(brandId, scanId)`    | `GET /api/scans/:brandId/:scanId` | Fetch results of a completed scan |
| `api.getAnalytics(brand)`         | `GET /api/analytics?brand=...`    | Get analytics for a brand         |
| `api.getBrands()`                 | `GET /api/analytics/brands`       | List all tracked brands           |

---

### `hooks/useAsync.ts` — Async State Hook

A custom React hook that manages the three states of any async operation:

```
loading: true   →  API call in progress
data: {...}     →  API call succeeded, here's the data
error: "..."    →  API call failed, here's the error message
```

#### How You Use It

```tsx
const { data, loading, error, run } = useAsync<ScanResponse>();

// Trigger an API call:
const result = await run(api.getScan(brandId, scanId));

// In your JSX:
{
  loading && <p>Loading...</p>;
}
{
  error && <p className="text-red-500">{error}</p>;
}
{
  data && <ResultTable results={data.results} />;
}
```

#### What `run()` Does

1. Sets `loading: true`, clears any previous data/error.
2. Awaits the promise you pass in.
3. On success: sets `data` to the result, `loading: false`.
4. On failure: extracts the error message (from Axios error response or generic error), sets `error`, `loading: false`.
5. Returns the data (or `null` if it failed) — so you can also use the return value directly.

This eliminates the need to write `try/catch` + `useState` boilerplate in every component.

---

### `components/ScanForm.tsx` — The Scan Form

A form with two text inputs and a submit button.

```
┌──────────────────────────────┐
│  Run a new scan              │
│                              │
│  Brand name                  │
│  ┌────────────────────────┐  │
│  │ e.g. Bosch             │  │
│  └────────────────────────┘  │
│                              │
│  Category                    │
│  ┌────────────────────────┐  │
│  │ e.g. home appliances   │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │      Run scan          │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

#### Behavior

- The **button is disabled** when loading, or when either input is empty.
- While scanning, the button shows a **Lucide `Loader2` icon** (spinning animation) and "Scanning (~20s)" text.
- In its default state, the button shows a **Lucide `Radar` icon** next to "Run scan".
- On success, it calls `onScanComplete(brandId, scanId)` so the parent (`App`) can fetch full results.
- On error, a red error message appears below the button.

---

### `components/ResultsTable.tsx` — Scan Results Table

Shows the results of a single scan in two parts:

#### 1. Summary Stats Row (top)

```
┌──────────┬──────────┬──────────────┬───────────┐
│ Total    │ Mentioned│ Mention rate │ Avg score │
│ calls    │          │              │           │
│   15     │   10     │    67%       │    75     │
└──────────┴──────────┴──────────────┴───────────┘
```

#### 2. Detailed Table (below)

| Engine     | Prompt                         | Mentioned | Position | Sentiment | Score |
| ---------- | ------------------------------ | --------- | -------- | --------- | ----- |
| ChatGPT    | What are the best brands in... | ✓         | 2        | positive  | 90    |
| Gemini     | Who are the market leaders...  | –         | –        | neutral   | 0     |
| Perplexity | Is Nike a good company...      | ✓         | 1        | positive  | 100   |

Each engine name is displayed as a colored pill badge (e.g., "ChatGPT" in blue). The "Mentioned" column uses Lucide `Check` (green) and `Minus` (gray) icons instead of plain text characters. Sentiment is shown as a colored rounded label: green for positive, gray for neutral, red for negative.

---

### `components/StatCard.tsx` — Metric Card

A small, reusable card that displays a single number with a label. Supports an optional Lucide icon displayed in the top-right corner with a tinted background.

```
┌───────────────────┐
│ TOTAL SCANS  [📊] │  ← label + optional icon
│ 4                 │  ← value (large, colored)
│ completed scans   │  ← sub-text (small, gray)
└───────────────────┘
```

Props:

- `label`: The header text
- `value`: The number or string to display
- `sub`: Optional description below the value
- `color`: `'blue'`, `'green'`, or `'purple'` — changes the color of the value and icon background
- `icon`: Optional Lucide icon component (e.g., `Activity`, `Target`, `Percent`)

On the Dashboard page, the three StatCards use these icons:

- **Total scans** → `Activity` icon (blue)
- **Avg visibility score** → `Target` icon (green)
- **Mention rate** → `Percent` icon (purple)

---

### `components/VisibilityChart.tsx` — Line Chart

A **Recharts line chart** showing two metrics over time. The section header displays a `TrendingUp` icon.

- **Blue line**: Average visibility score (0–100)
- **Green line**: Mention rate percentage (0–100%)

```
100 ┤
 80 ┤         ●───────●
 60 ┤    ●───/         \──●
 40 ┤   /
 20 ┤──●
  0 ┤
    └──────────────────────
      Jan   Feb   Mar   Apr
```

Each point on the X-axis represents one scan, labeled with its date/time (formatted as "01 Mar 26, 14:30").

A dashed horizontal **reference line at 50** helps visually gauge if the brand is above or below average.

If no scan data exists yet, it shows a placeholder message: "No scan data yet. Run a scan to see the chart."

---

### `components/EngineBreakdown.tsx` — Bar Chart

A **Recharts bar chart** comparing visibility scores across the three AI engines. The section header displays a `BarChart3` icon.

```
100 ┤
 80 ┤  ██
 60 ┤  ██     ██
 40 ┤  ██     ██     ██
 20 ┤  ██     ██     ██
  0 ┤──██─────██─────██──
    ChatGPT  Gemini  Perplexity
```

Each engine has its own brand color:

- **ChatGPT**: Green (#10a37f)
- **Gemini**: Blue (#4285f4)
- **Perplexity**: Purple (#6366f1)

Below the chart, there's a **stats grid** showing each engine's score and mention rate in a colored card:

```
┌────────────┬────────────┬────────────┐
│    70      │    55      │    80      │
│  ChatGPT   │  Gemini    │ Perplexity │
│ 60% ment.  │ 40% ment.  │ 80% ment.  │
└────────────┴────────────┴────────────┘
```

---

### `pages/Dashboard.tsx` — Dashboard Page

The analytics page that brings all the visual components together.

#### What It Does on Load

1. Fetches all tracked brands via `api.getBrands()`.
2. Auto-selects the first brand.
3. Fetches analytics for that brand via `api.getAnalytics(brandName)`.

#### Brand Selector

A dropdown (`<select>`) at the top right lets you switch between brands. When you pick a different brand, analytics reload automatically (driven by a `useEffect` that watches `selectedBrand`).

#### Layout

```
┌─────────────────────────────────────────────────┐
│ 📊 Dashboard                 [Brand selector ▾] │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │Total  [⚡]│ │Score [◎] │ │ Rate   [%]  │    │
│  │scans: 4  │ │   68     │ │    60%       │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  Visibility over time (line chart)      │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  Score by engine (bar chart)            │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Loading State

While data is loading, the dashboard shows **skeleton placeholders** (pulsing gray rectangles that mimic the layout), giving users a smooth visual experience instead of a blank screen.

#### Edge Cases Handled

- **No brands at all**: Shows "No brands tracked yet. Run a scan first."
- **API error**: Shows the error message in red.
- **Loading**: Shows animated skeleton placeholders.

---

## How the App Works End-to-End

### Running a Scan

```
1. User opens the app → sees the "New scan" tab
2. Types brand: "Nike", category: "sneakers"
3. Clicks "Run scan"
4. ScanForm calls POST /api/scans { brand: "Nike", category: "sneakers" }
   → Button shows spinner + "Scanning (~20s)"
   → Backend runs 15 AI calls (5 prompts × 3 engines)
5. Backend responds: { scanId: "abc", brandId: "xyz", resultCount: 15 }
6. App.handleScanComplete calls GET /api/scans/xyz/abc
   → Fetches all 15 results with parsed analysis
7. ResultTable renders:
   → 4 stat boxes (total, mentioned, mention rate, avg score)
   → 15 rows showing each AI call's details
```

### Viewing the Dashboard

```
1. User clicks "Dashboard" tab
2. Dashboard component mounts:
   → Calls GET /api/analytics/brands → gets list of brands
   → Auto-selects first brand
   → Calls GET /api/analytics?brand=Nike → gets full analytics
3. Dashboard renders:
   → 3 StatCards (total scans, avg score, mention rate)
   → VisibilityChart (line chart over time)
   → EngineBreakdown (bar chart per engine + stats grid)
4. User switches brand in dropdown
   → New GET /api/analytics?brand=Adidas call fires
   → Dashboard re-renders with new data
```

---

## Environment Variables

Create a `.env` file in the frontend root:

```env
VITE_API_URL=http://localhost:3000/api
```

| Variable       | Required | Description                                            |
| -------------- | -------- | ------------------------------------------------------ |
| `VITE_API_URL` | No       | Backend API URL (default: `http://localhost:3000/api`) |

> **Note**: Vite requires environment variables to start with `VITE_` to be accessible in the browser.

---

## How to Run

```bash
# Install dependencies
npm install

# Start development server (hot-reload)
npm run dev
# → App runs at http://localhost:5173

# Build for production
npm run build

# Preview production build locally
npm run preview
```

Make sure the backend is running on port 3000 (or update `VITE_API_URL` accordingly).

---

## Component Dependency Tree

```
App
├── ScanForm          (uses: useAsync, api.createScan)
├── ResultTable       (uses: ScanResult type)
└── Dashboard
    ├── StatCard      (pure display component)
    ├── VisibilityChart  (uses: Recharts, TimelinePoint type)
    └── EngineBreakdown  (uses: Recharts)
```

All API calls go through `api/client.ts`. All async state is managed by `useAsync`. Components are purely visual — they receive data through props and render it.

---

## Key Concepts Glossary

| Term                         | Meaning                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Component**                | A reusable piece of UI (a function that returns JSX)                                                                             |
| **Props**                    | Data passed from a parent component to a child component                                                                         |
| **State (`useState`)**       | Data stored inside a component that triggers re-renders when changed                                                             |
| **Effect (`useEffect`)**     | Code that runs after render — used for API calls, subscriptions, etc.                                                            |
| **Custom Hook (`useAsync`)** | A reusable function that encapsulates stateful logic                                                                             |
| **JSX/TSX**                  | HTML-like syntax inside JavaScript/TypeScript that React transforms into real DOM elements                                       |
| **Vite**                     | A build tool that serves your app during development and bundles it for production                                               |
| **Tailwind CSS**             | A CSS framework where you style elements using utility classes directly in the HTML                                              |
| **Recharts**                 | A React charting library built on D3 — provides `<LineChart>`, `<BarChart>`, etc.                                                |
| **Axios**                    | An HTTP client library for making API requests from the browser                                                                  |
| **DTO**                      | Data Transfer Object — on the frontend, these are TypeScript interfaces defining API data shapes                                 |
| **Lucide React**             | An icon library providing clean SVG icons as React components. Import what you need: `import { Eye, Check } from 'lucide-react'` |
| **Skeleton loading**         | Placeholder UI (gray pulsing boxes) shown while real data loads                                                                  |

---

## Lucide React Icons Reference

All icons are imported from `lucide-react` and used as React components with `className` for sizing and color.

| Icon              | Where It's Used                  | Purpose                                      |
| ----------------- | -------------------------------- | -------------------------------------------- |
| `Eye`             | App.tsx — header                 | App logo/identity next to the title          |
| `ScanSearch`      | App.tsx — tab bar                | "New scan" tab icon                          |
| `LayoutDashboard` | App.tsx — tab bar, Dashboard.tsx | "Dashboard" tab icon and page heading        |
| `Radar`           | ScanForm.tsx — button            | Default state of the "Run scan" button       |
| `Loader2`         | ScanForm.tsx — button            | Spinning animation while scan is in progress |
| `Check`           | ResultsTable.tsx — table         | Green checkmark when brand is mentioned      |
| `Minus`           | ResultsTable.tsx — table         | Gray dash when brand is not mentioned        |
| `TrendingUp`      | VisibilityChart.tsx — header     | Section icon for the line chart              |
| `BarChart3`       | EngineBreakdown.tsx — header     | Section icon for the bar chart               |
| `Activity`        | Dashboard.tsx → StatCard         | Icon for "Total scans" card                  |
| `Target`          | Dashboard.tsx → StatCard         | Icon for "Avg visibility score" card         |
| `Percent`         | Dashboard.tsx → StatCard         | Icon for "Mention rate" card                 |
