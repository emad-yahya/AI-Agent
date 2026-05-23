// Demo-only analytics fixtures. Returned when req.user.role === 'demo' so the
// public View Demo link shows a realistic Platinum Square (Dubai brokerage)
// history without exposing the owner's real brand data and without hitting any
// LLM. Numbers picked to tell a clean "grew from 32 → 71 over 14 days" story.

const ENGINES = ['chatgpt-style', 'gemini-style', 'perplexity-style'] as const;

const DEMO_BRAND = {
  id: 'demo-platinum-square',
  name: 'Platinum Square',
  category: 'Dubai real estate broker',
};

// Anchor the timeline to "now minus 14 days" so the chart always looks fresh
// regardless of when the visitor clicks View Demo.
function buildTimeline() {
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const points: Array<{
    scanId: string;
    date: string;
    avgScore: number;
    mentionRate: number;
    totalCalls: number;
    mentioned: number;
  }> = [];

  // Hand-tuned growth curve: starts weak (32), dips on day 4 (real audits do
  // this), then climbs steadily to 71 by day 14. Mention rate follows the
  // same shape but stays a few points behind score.
  const scores =       [32, 35, 38, 34, 41, 46, 50, 54, 58, 61, 64, 66, 69, 71];
  const mentionRates = [40, 43, 47, 42, 50, 55, 60, 63, 67, 70, 73, 75, 78, 80];

  for (let i = 0; i < scores.length; i++) {
    const date = new Date(today.getTime() - (scores.length - 1 - i) * 86400000);
    const totalCalls = 30; // 10 prompts × 3 engines
    const mentioned = Math.round((mentionRates[i] / 100) * totalCalls);
    points.push({
      scanId: `demo-scan-${i + 1}`,
      date: date.toISOString(),
      avgScore: scores[i],
      mentionRate: mentionRates[i],
      totalCalls,
      mentioned,
    });
  }
  return points;
}

export function getDemoBrandsList() {
  return [
    {
      id: DEMO_BRAND.id,
      name: DEMO_BRAND.name,
      category: DEMO_BRAND.category,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
  ];
}

export function getDemoAnalytics(brandName: string) {
  // Always return Platinum Square — demo dropdown only ever has one option.
  const name = brandName || DEMO_BRAND.name;
  const timeline = buildTimeline();
  const totalMentioned = timeline.reduce((s, t) => s + t.mentioned, 0);
  const totalCalls = timeline.reduce((s, t) => s + t.totalCalls, 0);

  // Engine breakdown — Gemini favours us most, then Perplexity, then ChatGPT.
  // Reflects what a typical Dubai brokerage actually sees on a fresh audit.
  const byEngine: Record<
    string,
    { avgScore: number; mentionRate: number; totalCalls: number }
  > = {
    'gemini-style': { avgScore: 74, mentionRate: 83, totalCalls: 140 },
    'perplexity-style': { avgScore: 68, mentionRate: 76, totalCalls: 140 },
    'chatgpt-style': { avgScore: 61, mentionRate: 69, totalCalls: 140 },
  };

  return {
    brand: name,
    timeline,
    byEngine,
    overall: {
      totalScans: timeline.length,
      mentionRate: Math.round((totalMentioned / totalCalls) * 100),
      avgScore: Math.round(
        timeline.reduce((s, t) => s + t.avgScore, 0) / timeline.length,
      ),
    },
  };
}

export function getDemoCompetitorTrends(_brands: string[]) {
  // Side-by-side trend lines for Compare tab. Three Dubai brokerages on the
  // same time axis as getDemoAnalytics so visitors can see Platinum Square
  // pulling ahead of Driven Properties and Allsopp & Allsopp.
  // Shape MUST match CompetitorTrend in frontend/src/api/client.ts:
  //   { name: string, timeline: { date, avgScore, mentionRate }[] }
  const days = 14;
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const dates = Array.from({ length: days }, (_, i) =>
    new Date(today.getTime() - (days - 1 - i) * 86400000).toISOString(),
  );

  const series = (scores: number[], rates: number[]) =>
    dates.map((date, i) => ({ date, avgScore: scores[i], mentionRate: rates[i] }));

  return [
    {
      name: 'Platinum Square',
      timeline: series(
        [32, 35, 38, 34, 41, 46, 50, 54, 58, 61, 64, 66, 69, 71],
        [40, 43, 47, 42, 50, 55, 60, 63, 67, 70, 73, 75, 78, 80],
      ),
    },
    {
      name: 'Driven Properties',
      timeline: series(
        [55, 56, 57, 55, 58, 59, 60, 60, 61, 62, 62, 63, 63, 64],
        [62, 63, 64, 62, 65, 66, 67, 67, 68, 69, 69, 70, 70, 71],
      ),
    },
    {
      name: 'Allsopp & Allsopp',
      timeline: series(
        [48, 49, 50, 50, 51, 51, 52, 53, 53, 54, 54, 55, 55, 56],
        [56, 57, 58, 58, 59, 59, 60, 61, 61, 62, 62, 63, 63, 64],
      ),
    },
  ];
}

export function getDemoPromptCoverage(brandName: string) {
  // Per-intent coverage matrix. Tells the demo viewer where Platinum Square
  // is strong (Best in Category, Brand Reputation) and where there's headroom
  // (Buying Advice, Alternatives) — gives the audit a concrete narrative.
  return {
    brand: brandName || DEMO_BRAND.name,
    coverage: [
      { intent: 'Best in Category', mentioned: 9, total: 10, percent: 90 },
      { intent: 'Brand Reputation', mentioned: 8, total: 10, percent: 80 },
      { intent: 'Market Leaders',   mentioned: 7, total: 10, percent: 70 },
      { intent: 'Alternatives',     mentioned: 5, total: 10, percent: 50 },
      { intent: 'Buying Advice',    mentioned: 4, total: 10, percent: 40 },
    ],
  };
}

export const DEMO_BRAND_NAME = DEMO_BRAND.name;
