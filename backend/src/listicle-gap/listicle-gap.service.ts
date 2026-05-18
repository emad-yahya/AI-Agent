import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { AIService } from 'src/ai/ai.service';
import { brandVariations } from 'src/ai/parser';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  CompetitorGap,
  ListicleArticle,
  ListicleGapScan,
} from 'src/common/types';
import { SerperService } from 'src/seo/serper.service';
import { CreateListicleGapDto } from './dto';

const RESULTS_PER_QUERY = 10;
const FETCH_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 12000;
const FALLBACK_QUERIES = [
  'best {category}',
  'top {category}',
  '{category} recommendations',
  '{category} reviews',
  'leading {category}',
];

interface SerperOrganicRef {
  url: string;
  title: string;
  query: string;
  position: number;
}

@Injectable()
export class ListicleGapService {
  private readonly logger = new Logger(ListicleGapService.name);

  constructor(
    private firebase: FirebaseService,
    private ai: AIService,
    private serper: SerperService,
  ) {}

  async createScan(dto: CreateListicleGapDto) {
    if (!this.serper.isConfigured()) {
      throw new Error('SERPER_API_KEY not configured');
    }

    const brandRef = await this.getOrCreateBrand(dto.brand, dto.category);
    const brandId = brandRef.id;

    const scanRef = this.firebase.listicleGapScans(brandId).doc();
    const scanId = scanRef.id;

    await scanRef.set({
      brandId,
      brand: dto.brand,
      category: dto.category,
      status: 'running',
      createdAt: this.firebase.now(),
      queries: [],
      competitors: dto.competitors ?? [],
    } as ListicleGapScan);

    this.logger.log(
      `Listicle gap scan created: ${scanId} for "${dto.brand}" (${dto.category})`,
    );

    void this.runInBackground(brandId, scanId, dto);

    return { scanId, brandId };
  }

  private async runInBackground(
    brandId: string,
    scanId: string,
    dto: CreateListicleGapDto,
  ) {
    const scanRef = this.firebase.listicleGapScans(brandId).doc(scanId);
    try {
      const queries = await this.generateSearchQueries(dto.category);
      this.logger.log(`Generated ${queries.length} queries for "${dto.category}"`);

      await scanRef.update({ queries });

      const organicResults = await this.collectOrganicResults(
        queries,
        dto.country,
      );
      this.logger.log(
        `Collected ${organicResults.length} unique URLs across ${queries.length} queries`,
      );

      const articles = await this.scrapeAndAnalyze(
        organicResults,
        dto.brand,
        dto.competitors ?? [],
      );

      const competitorGaps = this.buildCompetitorGaps(articles);
      const brandMentionedCount = articles.filter((a) => a.mentionsBrand).length;
      const brandCoveragePercent =
        articles.length > 0
          ? Math.round((brandMentionedCount / articles.length) * 100)
          : 0;

      await scanRef.update({
        status: 'done',
        completedAt: this.firebase.now(),
        articles,
        competitorGaps,
        totalArticles: articles.length,
        brandMentionedCount,
        brandCoveragePercent,
      });

      this.logger.log(
        `Listicle gap scan ${scanId} done. ${articles.length} articles analyzed, brand coverage ${brandCoveragePercent}%`,
      );
    } catch (err) {
      await scanRef.update({ status: 'failed' });
      this.logger.error(
        `Listicle gap scan ${scanId} failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Asks Gemini for 5 realistic shopper-style search queries for the category.
   * These are the queries we expect real users to type into Google when looking
   * for the kind of business the brand represents. We then scrape the top results
   * to see which competitor articles dominate those queries.
   */
  async generateSearchQueries(category: string): Promise<string[]> {
    const trimmed = category.trim();
    if (!trimmed) return [];

    const prompt = `You are designing Google searches a real customer would type when looking for a "${category}".

Return 5 specific, conversational search queries that would surface listicles / "best of" articles where competing brands are typically named. Mix formats:
- comparison ("best X", "top X")
- buying-intent ("X recommendations", "X reviews 2024")
- location/segment-specific (if the category implies one)

Avoid super broad ("X") or super niche queries. Aim for what someone shopping for this would actually type.

Return ONLY a JSON array of 5 strings — no markdown, no commentary.
Example for "dubai real estate broker":
["best dubai real estate brokers","top property agents dubai 2024","luxury dubai real estate agency recommendations","off-plan property advisor dubai reviews","leading real estate companies in dubai"]`;

    try {
      const raw = await this.ai.generateText(prompt);
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start === -1 || end === -1) return this.fallbackQueries(trimmed);
      const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
      if (!Array.isArray(parsed)) return this.fallbackQueries(trimmed);
      const queries = parsed
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter((s) => s.length >= 3 && s.length <= 120)
        .slice(0, 5);
      return queries.length > 0 ? queries : this.fallbackQueries(trimmed);
    } catch (err) {
      this.logger.warn(
        `Query generation failed for "${category}": ${(err as Error).message} — using fallback`,
      );
      return this.fallbackQueries(trimmed);
    }
  }

  private fallbackQueries(category: string): string[] {
    return FALLBACK_QUERIES.map((q) => q.replace('{category}', category));
  }

  private async collectOrganicResults(
    queries: string[],
    country?: string,
  ): Promise<SerperOrganicRef[]> {
    const all: SerperOrganicRef[] = [];
    for (const query of queries) {
      const res = await this.serper.search(query, {
        country: country ?? 'us',
        num: RESULTS_PER_QUERY,
      });
      const organic = res?.organic ?? [];
      organic.forEach((item, idx) => {
        if (!item.link) return;
        all.push({
          url: item.link,
          title: item.title ?? '',
          query,
          position: idx + 1,
        });
      });
    }
    // Dedupe by URL — keep first occurrence (highest-ranked query)
    const seen = new Set<string>();
    return all.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  private async scrapeAndAnalyze(
    refs: SerperOrganicRef[],
    brand: string,
    knownCompetitors: string[],
  ): Promise<ListicleArticle[]> {
    const brandVars = brandVariations(brand).map((v) => v.toLowerCase());
    const competitorVars = knownCompetitors
      .filter((c) => c && c.toLowerCase() !== brand.toLowerCase())
      .map((c) => ({ name: c, vars: brandVariations(c).map((v) => v.toLowerCase()) }));

    const out: ListicleArticle[] = [];

    for (let i = 0; i < refs.length; i += FETCH_CONCURRENCY) {
      const batch = refs.slice(i, i + FETCH_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((ref) => this.fetchAndAnalyzeOne(ref, brandVars, competitorVars)),
      );
      for (const result of settled) {
        if (result.status === 'fulfilled' && result.value) {
          out.push(result.value);
        }
      }
    }

    return out;
  }

  private async fetchAndAnalyzeOne(
    ref: SerperOrganicRef,
    brandVars: string[],
    competitorVars: Array<{ name: string; vars: string[] }>,
  ): Promise<ListicleArticle | null> {
    try {
      const text = await this.fetchArticleText(ref.url);
      if (!text) return null;
      const lower = text.toLowerCase();

      const mentionsBrand = brandVars.some((v) =>
        this.containsTokenSafe(lower, v),
      );

      const competitorsFound = competitorVars
        .filter(({ vars }) => vars.some((v) => this.containsTokenSafe(lower, v)))
        .map(({ name }) => name);

      return {
        url: ref.url,
        domain: this.serper.extractDomain(ref.url),
        title: ref.title,
        query: ref.query,
        position: ref.position,
        mentionsBrand,
        competitorsFound,
      };
    } catch (err) {
      this.logger.debug(`Skip ${ref.url}: ${(err as Error).message}`);
      return null;
    }
  }

  // Safer than includes() — requires non-alphanumeric boundaries so "Apple"
  // does not match "Pineapple". Mirrors parser.matchesAny pattern but works
  // on already-lowercased haystacks for speed.
  private containsTokenSafe(haystackLower: string, needleLower: string): boolean {
    if (needleLower.length < 2) return false;
    const escaped = needleLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9])${escaped}(?=[^a-z0-9]|$)`, 'i');
    return re.test(haystackLower);
  }

  private async fetchArticleText(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; AIVisibilityBot/1.0; +https://aivisibility.local)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      if (!res.ok) return '';
      const ctype = res.headers.get('content-type') ?? '';
      if (!ctype.includes('text/html')) return '';
      const html = await res.text();
      const $ = cheerio.load(html);
      $('script,style,noscript,svg,iframe,nav,footer,header').remove();
      // Cap at 30k chars to bound memory while still covering body+listicle items
      return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 30000);
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildCompetitorGaps(articles: ListicleArticle[]): CompetitorGap[] {
    const map = new Map<
      string,
      { total: number; brandAlso: number; samples: ListicleArticle[] }
    >();

    for (const article of articles) {
      for (const competitor of article.competitorsFound) {
        const entry = map.get(competitor) ?? {
          total: 0,
          brandAlso: 0,
          samples: [],
        };
        entry.total += 1;
        if (article.mentionsBrand) entry.brandAlso += 1;
        if (!article.mentionsBrand && entry.samples.length < 5) {
          entry.samples.push(article);
        }
        map.set(competitor, entry);
      }
    }

    return [...map.entries()]
      .map(([competitor, e]) => ({
        competitor,
        totalArticles: e.total,
        brandAlsoMentioned: e.brandAlso,
        gapArticles: e.total - e.brandAlso,
        sampleArticles: e.samples.map((a) => ({
          url: a.url,
          domain: a.domain,
          title: a.title,
        })),
      }))
      .sort((a, b) => b.gapArticles - a.gapArticles);
  }

  async getScan(brandId: string, scanId: string): Promise<ListicleGapScan> {
    const doc = await this.firebase.listicleGapScans(brandId).doc(scanId).get();
    if (!doc.exists) {
      throw new NotFoundException(`Listicle gap scan ${scanId} not found`);
    }
    return { id: doc.id, ...(doc.data() as ListicleGapScan) };
  }

  async listScans(brandName: string): Promise<ListicleGapScan[]> {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();
    if (brandSnap.empty) return [];
    const brandId = brandSnap.docs[0].id;
    const snap = await this.firebase
      .listicleGapScans(brandId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as ListicleGapScan) }),
    );
  }

  private async getOrCreateBrand(brandName: string, category: string) {
    const snap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();
    if (!snap.empty) {
      const ref = snap.docs[0].ref;
      await ref.update({ category });
      return ref;
    }
    return this.firebase.brands().add({
      name: brandName,
      category,
      createdAt: this.firebase.now(),
    });
  }
}
