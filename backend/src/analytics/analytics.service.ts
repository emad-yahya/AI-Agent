import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Engine } from 'src/common/types';
import { FirebaseService } from 'src/firebase/firebase.service';

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

    const brandDoc = brandSnap.docs[0];
    const brandId = brandDoc.id;

    const scansSnap = await this.firebase
      .scans(brandId)
      .where('status', '==', 'done')
      .orderBy('createdAt', 'asc')
      .get();

    if (scansSnap.empty) {
      return {
        brand: brandName,
        timeline: [],
        byEngine: {},
        overall: { avgScore: 0, mentionRate: 0, totalScans: 0 },
      };
    }

    const scanData = await Promise.all(
      scansSnap.docs.map(async (scanDoc) => {
        const scanId = scanDoc.id;
        const scan = scanDoc.data();
        const resultsSnap = await this.firebase.results(brandId, scanId).get();
        const results = resultsSnap.docs.map((d) => d.data());
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
      const mentionRate = Math.round((mentioned.length / results.length) * 100);
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

  async getAllBrands() {
    const snap = await this.firebase
      .brands()
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      createdAt: doc.data().createdAt.toDate().toISOString(),
    }));
  }

  private aggregateByEngine(
    scanData: { results: FirebaseFirestore.DocumentData[] }[],
  ) {
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
