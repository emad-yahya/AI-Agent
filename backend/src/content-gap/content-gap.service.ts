import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  ContentGapItem,
  ContentGapReport,
  PaaResult,
} from 'src/common/types';
import { SerperService } from 'src/seo/serper.service';
import { AIService } from 'src/ai/ai.service';
import { ContentBriefDto, CreateContentGapDto, PaaDto } from './dto';

const SERPER_DELAY_MS = parseInt(process.env.SERPER_DELAY_MS ?? '500', 10);
const TOP_N = 10;

@Injectable()
export class ContentGapService {
  private readonly logger = new Logger(ContentGapService.name);

  constructor(
    private firebase: FirebaseService,
    private serper: SerperService,
    private ai: AIService,
  ) {}

  /**
   * Generates a complete content brief for a target query. Combines real SERP
   * data (top 10 + PAA + related searches) with LLM synthesis to produce an
   * outline, target word count, entities to mention, and on-page SEO hints
   * that the user can hand to a writer.
   */
  async generateBrief(dto: ContentBriefDto): Promise<{
    query: string;
    intent: string;
    intentReason: string;
    targetWordCount: number;
    title: string;
    metaDescription: string;
    h2Outline: Array<{ heading: string; bullets: string[] }>;
    entitiesToMention: string[];
    paaQuestions: string[];
    relatedSearches: string[];
    topCompetitors: Array<{ title: string; url: string; snippet: string }>;
    schemaSuggestions: string[];
    internalLinkSuggestions: string[];
    callToAction: string;
  }> {
    const country = dto.country ?? 'us';

    let serp: Awaited<ReturnType<typeof this.serper.search>> | null = null;
    let topResults: Array<{ title: string; url: string; snippet: string }> = [];
    let paaQuestions: string[] = [];
    let relatedSearches: string[] = [];

    if (this.serper.isConfigured()) {
      try {
        serp = await this.serper.search(dto.query, { country, num: 10 });
        const organic = serp?.organic ?? [];
        topResults = organic.slice(0, 10).map((o) => ({
          title: String(o.title ?? '').slice(0, 200),
          url: String(o.link ?? ''),
          snippet: String(o.snippet ?? '').slice(0, 300),
        }));
        const paa = (serp?.peopleAlsoAsk ?? []) as Array<{ question?: string }>;
        paaQuestions = paa
          .map((p) => String(p.question ?? ''))
          .filter((q) => q.length > 5)
          .slice(0, 8);
        const related = (serp?.relatedSearches ?? []) as Array<{ query?: string }>;
        relatedSearches = related
          .map((r) => String(r.query ?? ''))
          .filter((q) => q.length > 2)
          .slice(0, 8);
      } catch (err) {
        this.logger.warn(`Brief SERP fetch failed: ${(err as Error).message}`);
      }
    }

    const serpDigest = topResults
      .map((r, i) => `${i + 1}. ${r.title} (${r.url}) — ${r.snippet}`)
      .join('\n');
    const paaList = paaQuestions.map((q) => `- ${q}`).join('\n');
    const relList = relatedSearches.map((r) => `- ${r}`).join('\n');

    const prompt = `You are an SEO + content strategist building a publish-ready content brief.

Target query: "${dto.query}"
Brand commissioning the article: "${dto.brand}"
Brand's category: "${dto.category ?? 'unknown'}"
Country: ${country}

Top 10 SERP results for this query:
${serpDigest || '(SERP data unavailable — infer from query)'}

People Also Ask:
${paaList || '(none)'}

Related searches:
${relList || '(none)'}

Produce a publish-ready brief as VALID JSON only (no markdown, no commentary). The writer must be able to execute from your JSON alone. Match this exact shape:

{
  "intent": "informational | commercial | transactional | navigational",
  "intentReason": "one sentence explaining why",
  "targetWordCount": <integer 800-2500 based on top-10 SERP article depth>,
  "title": "<55-60 char title with the target query verbatim, no clickbait>",
  "metaDescription": "<145-160 char meta with the query + CTA>",
  "h2Outline": [
    { "heading": "<H2 1>", "bullets": ["<H3 or supporting point>", "<H3 or supporting point>"] },
    { "heading": "<H2 2>", "bullets": ["..."] }
    // 5-8 H2 sections total, mirror the structure SERP winners use
  ],
  "entitiesToMention": ["<entity 1>", "<entity 2>"],  // 8-15 concrete entities (places, brands, products, certifications) that signal topical depth to AI engines
  "paaQuestions": <copy the PAA list above verbatim, max 8>,
  "relatedSearches": <copy the related searches above verbatim, max 8>,
  "topCompetitors": <copy the top 5 SERP results above with title/url/snippet>,
  "schemaSuggestions": ["Article", "FAQPage if PAA included", "..."],
  "internalLinkSuggestions": ["<topic 1 to link to internally>", "<topic 2>"],
  "callToAction": "<one-line CTA matching intent: lead-magnet for informational, demo/quote for commercial>"
}

Hard rules:
- Word count must reflect top-10 SERP depth (if winners average 2000 words, target 2200+)
- H2 outline must cover every PAA question (each PAA = its own subsection or H3 bullet)
- entitiesToMention must be concrete proper nouns + technical terms — not generic phrases
- Never invent SERP results or PAA questions; only use what is provided above`;

    const raw = await this.ai.generateText(prompt);
    const parsed = this.parseBriefJson(raw);

    return {
      query: dto.query,
      intent: parsed.intent || 'informational',
      intentReason: parsed.intentReason || '',
      targetWordCount: parsed.targetWordCount || 1500,
      title: parsed.title || dto.query,
      metaDescription: parsed.metaDescription || '',
      h2Outline: parsed.h2Outline || [],
      entitiesToMention: parsed.entitiesToMention || [],
      paaQuestions: parsed.paaQuestions ?? paaQuestions,
      relatedSearches: parsed.relatedSearches ?? relatedSearches,
      topCompetitors: parsed.topCompetitors ?? topResults.slice(0, 5),
      schemaSuggestions: parsed.schemaSuggestions || ['Article'],
      internalLinkSuggestions: parsed.internalLinkSuggestions || [],
      callToAction: parsed.callToAction || '',
    };
  }

  private parseBriefJson(raw: string): {
    intent?: string;
    intentReason?: string;
    targetWordCount?: number;
    title?: string;
    metaDescription?: string;
    h2Outline?: Array<{ heading: string; bullets: string[] }>;
    entitiesToMention?: string[];
    paaQuestions?: string[];
    relatedSearches?: string[];
    topCompetitors?: Array<{ title: string; url: string; snippet: string }>;
    schemaSuggestions?: string[];
    internalLinkSuggestions?: string[];
    callToAction?: string;
  } {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return {};
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return {};
    }
  }

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

    const item: ContentGapItem = {
      query,
      brandHasPage,
      brandPosition: brand.position,
      competitorsRanking: competitorsRanking.slice(0, 5),
      paa,
      difficulty,
      opportunityScore: opportunity,
    };
    // Firestore rejects undefined — only set brandUrl when present
    if (brand.item?.link) item.brandUrl = brand.item.link;
    return item;
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
