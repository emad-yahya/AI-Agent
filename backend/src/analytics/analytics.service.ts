import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Brand, Engine, Scan, ScanResult, ScanSummary } from 'src/common/types';
import { FirebaseService } from 'src/firebase/firebase.service';

const PROMPT_INTENTS = [
  {
    id: 'recommendation',
    label: 'Best in Category',
    templateId: 'best_in_category',
    keyword: 'best brands',
  },
  {
    id: 'alternatives',
    label: 'Alternatives',
    templateId: 'top_alternatives',
    keyword: 'alternatives',
  },
  {
    id: 'reputation',
    label: 'Brand Reputation',
    templateId: 'brand_reputation',
    keyword: 'good company',
  },
  {
    id: 'buying',
    label: 'Buying Advice',
    templateId: 'buying_advice',
    keyword: 'reliable product',
  },
  {
    id: 'market',
    label: 'Market Leaders',
    templateId: 'market_leaders',
    keyword: 'market leaders',
  },
];

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private firebase: FirebaseService) {}

  async getBrandAnalytics(brandName: string) {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();

    if (brandSnap.empty)
      throw new NotFoundException(
        `Brand "${brandName}" not found. Run a scan first`,
      );

    const brandId = brandSnap.docs[0].id;

    // Fast path: use pre-aggregated scan summaries (O(n) reads vs O(n*m))
    const summariesSnap = await this.firebase
      .scanSummaries(brandId)
      .orderBy('date', 'asc')
      .get();

    if (!summariesSnap.empty) {
      const summaries = summariesSnap.docs.map((d) => d.data() as ScanSummary);
      return this.buildFromSummaries(brandName, summaries);
    }

    // Slow path: fallback for brands scanned before pre-aggregation was added
    return this.buildFromResults(brandName, brandId);
  }

  private buildFromSummaries(brandName: string, summaries: ScanSummary[]) {
    const timeline = summaries.map((s) => ({
      scanId: s.scanId,
      date: s.date.toDate().toISOString(),
      avgScore: s.avgScore,
      mentionRate: s.mentionRate,
      totalCalls: s.total,
      mentioned: s.mentioned,
    }));

    const byEngine = this.aggregateByEngineFromSummaries(summaries);

    const totalMentioned = summaries.reduce((s, r) => s + r.mentioned, 0);
    const totalCalls = summaries.reduce((s, r) => s + r.total, 0);
    const overall = {
      totalScans: summaries.length,
      mentionRate:
        totalCalls > 0 ? Math.round((totalMentioned / totalCalls) * 100) : 0,
      avgScore:
        summaries.length > 0
          ? Math.round(
              summaries.reduce((s, r) => s + r.avgScore, 0) / summaries.length,
            )
          : 0,
    };

    return { brand: brandName, timeline, byEngine, overall };
  }

  private aggregateByEngineFromSummaries(summaries: ScanSummary[]) {
    const engines: Engine[] = [
      'chatgpt-style',
      'gemini-style',
      'perplexity-style',
    ];
    const byEngine: Record<
      string,
      { avgScore: number; mentionRate: number; totalCalls: number }
    > = {};

    for (const engine of engines) {
      const rows = summaries.map((s) => s.byEngine[engine]).filter(Boolean);
      const totalCalls = rows.reduce((s, r) => s + r.totalCalls, 0);
      const totalMentionRate = rows.reduce((s, r) => s + r.mentionRate, 0);
      const totalAvgScore = rows.reduce((s, r) => s + r.avgScore, 0);
      byEngine[engine] = {
        totalCalls,
        mentionRate:
          rows.length > 0 ? Math.round(totalMentionRate / rows.length) : 0,
        avgScore: rows.length > 0 ? Math.round(totalAvgScore / rows.length) : 0,
      };
    }

    return byEngine;
  }

  private async buildFromResults(brandName: string, brandId: string) {
    const scansSnap = await this.firebase
      .scans(brandId)
      .orderBy('createdAt', 'asc')
      .get();

    const doneDocs = scansSnap.docs.filter(
      (d) => (d.data() as Scan).status === 'done',
    );

    if (doneDocs.length === 0) {
      return {
        brand: brandName,
        timeline: [],
        byEngine: {},
        overall: { avgScore: 0, mentionRate: 0, totalScans: 0 },
      };
    }

    const scanData = await Promise.all(
      doneDocs.map(async (scanDoc) => {
        const scanId = scanDoc.id;
        const scan = scanDoc.data() as Scan;
        const resultsSnap = await this.firebase.results(brandId, scanId).get();
        const results = resultsSnap.docs.map((d) => d.data() as ScanResult);
        return { scanId, scan, results };
      }),
    );

    const timeline = scanData.map(({ scanId, scan, results }) => {
      const mentioned = results.filter((r) => !!r.mentioned);
      const avgScore =
        mentioned.length > 0
          ? Math.round(
              mentioned.reduce((sum, r) => sum + r.visibilityScore, 0) /
                mentioned.length,
            )
          : 0;
      const mentionRate =
        results.length > 0
          ? Math.round((mentioned.length / results.length) * 100)
          : 0;
      return {
        scanId,
        date: scan.createdAt.toDate().toISOString(),
        avgScore,
        mentionRate,
        totalCalls: results.length,
        mentioned: mentioned.length,
      };
    });

    const byEngine = this.aggregateByEngine(scanData);

    const allResults = scanData.flatMap((s) => s.results);
    const allMentioned = allResults.filter((r) => !!r.mentioned);
    const overall = {
      totalScans: scanData.length,
      mentionRate:
        allResults.length > 0
          ? Math.round((allMentioned.length / allResults.length) * 100)
          : 0,
      avgScore:
        allMentioned.length > 0
          ? Math.round(
              allMentioned.reduce((sum, r) => sum + r.visibilityScore, 0) /
                allMentioned.length,
            )
          : 0,
    };

    return { brand: brandName, timeline, byEngine, overall };
  }

  async getCompetitorTrends(brandNames: string[]) {
    return Promise.all(
      brandNames.map(async (name) => {
        const brandSnap = await this.firebase
          .brands()
          .where('name', '==', name)
          .limit(1)
          .get();

        if (brandSnap.empty) return { name, timeline: [] };

        const brandId = brandSnap.docs[0].id;
        const summariesSnap = await this.firebase
          .scanSummaries(brandId)
          .orderBy('date', 'asc')
          .limit(20)
          .get();

        const timeline = summariesSnap.docs.map((d) => {
          const s = d.data() as ScanSummary;
          return {
            date: s.date.toDate().toISOString(),
            avgScore: s.avgScore,
            mentionRate: s.mentionRate,
          };
        });

        return { name, timeline };
      }),
    );
  }

  async getPromptCoverage(brandName: string) {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();

    if (brandSnap.empty)
      throw new NotFoundException(
        `Brand "${brandName}" not found. Run a scan first`,
      );

    const brandId = brandSnap.docs[0].id;

    const summarySnap = await this.firebase
      .scanSummaries(brandId)
      .orderBy('date', 'desc')
      .limit(1)
      .get();

    if (summarySnap.empty)
      return { brand: brandName, scanId: null, coverage: [] };

    const latestSummary = summarySnap.docs[0].data() as ScanSummary;
    const scanId = latestSummary.scanId;

    const resultsSnap = await this.firebase.results(brandId, scanId).get();
    const results = resultsSnap.docs.map((d) => d.data() as ScanResult);

    const ENGINES: Engine[] = [
      'chatgpt-style',
      'gemini-style',
      'perplexity-style',
    ];

    const coverage = PROMPT_INTENTS.map((intent) => {
      const byEngine: Record<string, boolean | null> = {};
      for (const engine of ENGINES) {
        // Prefer matching by stored templateId (works with dynamic prompts);
        // fall back to keyword search for legacy scans without templateId.
        const result = results.find(
          (r) =>
            r.engine === engine &&
            (r.templateId === intent.templateId ||
              (!r.templateId &&
                r.prompt.toLowerCase().includes(intent.keyword))),
        );
        byEngine[engine] = result != null ? result.mentioned : null;
      }
      return { intent: intent.id, label: intent.label, byEngine };
    });

    return { brand: brandName, scanId, coverage };
  }

  async getAllBrands() {
    const snap = await this.firebase
      .brands()
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((doc) => {
      const data = doc.data() as Brand & { category?: string };
      return {
        id: doc.id,
        name: data.name,
        category: data.category ?? null,
        createdAt: data.createdAt.toDate().toISOString(),
      };
    });
  }

  private aggregateByEngine(scanData: { results: ScanResult[] }[]) {
    const engines: Engine[] = [
      'chatgpt-style',
      'gemini-style',
      'perplexity-style',
    ];
    const allResults = scanData.flatMap((s) => s.results);
    const byEngine: Record<
      string,
      {
        avgScore: number;
        mentionRate: number;
        totalCalls: number;
      }
    > = {};

    for (const engine of engines) {
      const engineResults = allResults.filter((r) => r.engine === engine);
      const mentioned = engineResults.filter((r) => !!r.mentioned);

      byEngine[engine] = {
        totalCalls: engineResults.length,
        mentionRate:
          engineResults.length > 0
            ? Math.round((mentioned.length / engineResults.length) * 100)
            : 0,
        avgScore:
          mentioned.length > 0
            ? Math.round(
                mentioned.reduce((sum, r) => sum + r.visibilityScore, 0) /
                  mentioned.length,
              )
            : 0,
      };
    }

    return byEngine;
  }
}
