import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  ContentGapItem,
  ContentGapReport,
  PaaResult,
} from 'src/common/types';
import { SerperService } from 'src/seo/serper.service';
import { CreateContentGapDto, PaaDto } from './dto';

const SERPER_DELAY_MS = parseInt(process.env.SERPER_DELAY_MS ?? '500', 10);
const TOP_N = 10;

@Injectable()
export class ContentGapService {
  private readonly logger = new Logger(ContentGapService.name);

  constructor(
    private firebase: FirebaseService,
    private serper: SerperService,
  ) {}

  async createScan(dto: CreateContentGapDto) {
    const brandRef = await this.getOrCreateBrand(dto.brand);
    const brandId = brandRef.id;
    const ref = this.firebase.contentGapScans(brandId).doc();
    const reportId = ref.id;
    const domain = this.normalizeDomain(dto.domain);

    await ref.set({
      brandId,
      brand: dto.brand,
      domain,
      status: 'running',
      createdAt: this.firebase.now(),
      queries: dto.queries,
    } as ContentGapReport);

    this.logger.log(
      `Content gap ${reportId} started for ${dto.brand} (${domain}) — ${dto.queries.length} queries`,
    );
    void this.run(brandId, reportId, dto, domain);
    return { reportId, brandId };
  }

  private async run(
    brandId: string,
    reportId: string,
    dto: CreateContentGapDto,
    domain: string,
  ) {
    const ref = this.firebase.contentGapScans(brandId).doc(reportId);
    try {
      const country = dto.country ?? 'us';
      const competitors = (dto.competitorDomains ?? []).map((d) =>
        this.normalizeDomain(d),
      );
      const items: ContentGapItem[] = [];

      for (const query of dto.queries) {
        const item = await this.analyseQuery(query, domain, competitors, country);
        items.push(item);
        await this.sleep(SERPER_DELAY_MS);
      }

      const gapCount = items.filter((i) => !i.brandHasPage).length;
      const summary: NonNullable<ContentGapReport['summary']> = {
        totalQueries: items.length,
        brandHasPageCount: items.length - gapCount,
        gapCount,
        avgOpportunity: items.length
          ? Math.round(
              items.reduce((s, i) => s + i.opportunityScore, 0) / items.length,
            )
          : 0,
      };

      await ref.update({
        status: 'done',
        completedAt: this.firebase.now(),
        items,
        summary,
      });
      this.logger.log(
        `Content gap ${reportId} done. ${gapCount}/${items.length} gaps`,
      );
    } catch (err) {
      await ref.update({ status: 'failed' });
      this.logger.error(
        `Content gap ${reportId} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async analyseQuery(
    query: string,
    domain: string,
    competitorDomains: string[],
    country: string,
  ): Promise<ContentGapItem> {
    const res = await this.serper.search(query, { country, num: TOP_N });
    const organic = res?.organic ?? [];

    const brand = this.serper.findBrandPosition(organic, domain);
    const brandHasPage = brand.position !== null;

    const competitorsRanking: ContentGapItem['competitorsRanking'] = [];
    for (let i = 0; i < organic.length; i++) {
      const item = organic[i];
      const itemDomain = this.serper.extractDomain(item.link);
      if (competitorDomains.length > 0) {
        if (!competitorDomains.some((c) => itemDomain === c || itemDomain.endsWith(`.${c}`)))
          continue;
      }
      if (itemDomain === domain || itemDomain.endsWith(`.${domain}`)) continue;
      competitorsRanking.push({
        domain: itemDomain,
        url: item.link,
        position: i + 1,
        title: item.title,
      });
    }

    const paa = (res?.peopleAlsoAsk ?? []).map((p) => p.question).slice(0, 6);

    // Difficulty heuristic: more SERP features + more strong competitor domains = harder
    const features = res ? this.serper.extractSerpFeatures(res).length : 0;
    const difficulty = this.scoreDifficulty(features, competitorsRanking.length);

    // Opportunity score: higher when (a) brand has no page, (b) competitors rank, (c) PAA present
    let opportunity = 0;
    if (!brandHasPage) opportunity += 50;
    opportunity += Math.min(30, competitorsRanking.length * 5);
    if (paa.length > 0) opportunity += 10;
    if (difficulty === 'easy') opportunity += 10;
    if (difficulty === 'hard') opportunity -= 15;
    opportunity = Math.max(0, Math.min(100, opportunity));

    return {
      query,
      brandHasPage,
      brandUrl: brand.item?.link,
      brandPosition: brand.position,
      competitorsRanking: competitorsRanking.slice(0, 5),
      paa,
      difficulty,
      opportunityScore: opportunity,
    };
  }

  private scoreDifficulty(
    features: number,
    competitorCount: number,
  ): ContentGapItem['difficulty'] {
    if (features >= 4 && competitorCount >= 4) return 'hard';
    if (features <= 1 && competitorCount <= 2) return 'easy';
    return 'medium';
  }

  async getReport(brandId: string, reportId: string): Promise<ContentGapReport> {
    const doc = await this.firebase
      .contentGapScans(brandId)
      .doc(reportId)
      .get();
    if (!doc.exists) {
      throw new NotFoundException(`Content gap ${reportId} not found`);
    }
    return { id: doc.id, ...(doc.data() as ContentGapReport) };
  }

  async listReports(brandName: string): Promise<ContentGapReport[]> {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();
    if (brandSnap.empty) return [];
    const brandId = brandSnap.docs[0].id;
    const snap = await this.firebase
      .contentGapScans(brandId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as ContentGapReport) }),
    );
  }

  async fetchPaa(dto: PaaDto): Promise<PaaResult[]> {
    const country = dto.country ?? 'us';
    const out: PaaResult[] = [];
    for (const seed of dto.seeds) {
      const res = await this.serper.search(seed, { country, num: 10 });
      out.push({
        seed,
        questions: (res?.peopleAlsoAsk ?? []).map((p) => p.question),
        relatedSearches: (res?.relatedSearches ?? []).map((r) => r.query),
      });
      await this.sleep(SERPER_DELAY_MS);
    }
    return out;
  }

  private normalizeDomain(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
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
