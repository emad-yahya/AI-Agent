import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  BrandPresenceCheck,
  BrandPresenceReport,
} from 'src/common/types';
import { SerperService } from 'src/seo/serper.service';
import { CreateBrandPresenceDto } from './dto';

interface WikipediaSummary {
  type?: string;
  title?: string;
  extract?: string;
  content_urls?: {
    desktop?: { page?: string };
  };
}

const FETCH_TIMEOUT_MS = 10000;
const PRESENCE_RUBRIC: Array<{ key: string; label: string }> = [
  { key: 'hasKnowledgePanel', label: 'Google Knowledge Panel' },
  { key: 'hasWikipedia', label: 'Wikipedia article' },
];

@Injectable()
export class BrandPresenceService {
  private readonly logger = new Logger(BrandPresenceService.name);

  constructor(
    private firebase: FirebaseService,
    private serper: SerperService,
  ) {}

  async createReport(dto: CreateBrandPresenceDto) {
    const brandRef = await this.getOrCreateBrand(dto.brand);
    const brandId = brandRef.id;
    const reportRef = this.firebase.brandPresenceReports(brandId).doc();
    const reportId = reportRef.id;

    await reportRef.set({
      brandId,
      brand: dto.brand,
      status: 'running',
      createdAt: this.firebase.now(),
    } as BrandPresenceReport);

    this.logger.log(
      `Brand presence ${reportId} started: ${dto.brand} vs ${dto.competitors.length} competitors`,
    );

    void this.runInBackground(brandId, reportId, dto);

    return { reportId, brandId };
  }

  private async runInBackground(
    brandId: string,
    reportId: string,
    dto: CreateBrandPresenceDto,
  ) {
    const ref = this.firebase.brandPresenceReports(brandId).doc(reportId);
    try {
      const allBrands = [dto.brand, ...dto.competitors];
      const checks = await Promise.all(
        allBrands.map((name) => this.checkPresence(name, dto.country)),
      );
      const brandCheck = checks[0];
      const competitorChecks = checks.slice(1);
      const gapSummary = this.buildGapSummary(brandCheck, competitorChecks);

      await ref.update({
        status: 'done',
        completedAt: this.firebase.now(),
        brandCheck,
        competitorChecks,
        gapSummary,
      });

      this.logger.log(
        `Brand presence ${reportId} done. Brand score ${brandCheck.presenceScore}/${PRESENCE_RUBRIC.length}`,
      );
    } catch (err) {
      await ref.update({ status: 'failed' });
      this.logger.error(
        `Brand presence ${reportId} failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Checks two AI-relevant presence signals for a single brand:
   *  - Google Knowledge Panel (via Serper response.knowledgeGraph)
   *  - Wikipedia article (via Wikipedia REST API summary endpoint)
   * Both are strong training-data + retrieval signals for AI engines.
   * Gemini in particular relies heavily on Knowledge Graph; ChatGPT
   * training corpus includes Wikipedia heavily.
   */
  async checkPresence(
    name: string,
    country?: string,
  ): Promise<BrandPresenceCheck> {
    const [serperRes, wikiRes] = await Promise.all([
      this.serper.search(name, { country: country ?? 'us', num: 5 }),
      this.fetchWikipedia(name),
    ]);

    const kg = serperRes?.knowledgeGraph;
    const hasKnowledgePanel = Boolean(kg && (kg.title || kg.description));

    const hasWikipedia =
      wikiRes !== null && wikiRes.type !== 'disambiguation';

    const presenceScore =
      (hasKnowledgePanel ? 1 : 0) + (hasWikipedia ? 1 : 0);

    const signals = PRESENCE_RUBRIC.map((r) => ({
      ...r,
      passed:
        r.key === 'hasKnowledgePanel' ? hasKnowledgePanel : hasWikipedia,
    }));

    return {
      name,
      hasKnowledgePanel,
      knowledgePanelTitle: kg?.title,
      knowledgePanelDescription: kg?.description,
      hasWikipedia,
      wikipediaUrl: wikiRes?.content_urls?.desktop?.page,
      wikipediaExtract: wikiRes?.extract,
      presenceScore,
      signals,
    };
  }

  /**
   * Wikipedia REST API summary. Returns 200 with article data if page exists,
   * 404 if not. Handles disambiguation pages (type === 'disambiguation') —
   * those are NOT real brand pages.
   */
  private async fetchWikipedia(name: string): Promise<WikipediaSummary | null> {
    // Wikipedia titles use underscores + URL-encoded characters
    const title = encodeURIComponent(name.trim().replace(/\s+/g, '_'));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          // Wikipedia requires a descriptive User-Agent per their policy
          'User-Agent': 'AIVisibilityTracker/1.0 (https://aivisibility.local)',
          Accept: 'application/json',
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as WikipediaSummary;
      return data;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildGapSummary(
    brand: BrandPresenceCheck,
    competitors: BrandPresenceCheck[],
  ): BrandPresenceReport['gapSummary'] {
    return PRESENCE_RUBRIC.map(({ key, label }) => {
      const yourStatus =
        key === 'hasKnowledgePanel'
          ? brand.hasKnowledgePanel
          : brand.hasWikipedia;
      const competitorsWithIt = competitors.filter((c) =>
        key === 'hasKnowledgePanel' ? c.hasKnowledgePanel : c.hasWikipedia,
      ).length;
      return {
        key,
        label,
        yourStatus,
        competitorsWithIt,
        totalCompetitors: competitors.length,
      };
    });
  }

  async getReport(brandId: string, reportId: string): Promise<BrandPresenceReport> {
    const doc = await this.firebase
      .brandPresenceReports(brandId)
      .doc(reportId)
      .get();
    if (!doc.exists) {
      throw new NotFoundException(`Brand presence ${reportId} not found`);
    }
    return { id: doc.id, ...(doc.data() as BrandPresenceReport) };
  }

  async listReports(brandName: string): Promise<BrandPresenceReport[]> {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();
    if (brandSnap.empty) return [];
    const brandId = brandSnap.docs[0].id;
    const snap = await this.firebase
      .brandPresenceReports(brandId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as BrandPresenceReport) }),
    );
  }

  private async getOrCreateBrand(brandName: string) {
    const snap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].ref;
    return this.firebase.brands().add({
      name: brandName,
      createdAt: this.firebase.now(),
    });
  }
}
