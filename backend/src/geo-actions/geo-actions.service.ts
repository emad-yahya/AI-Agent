import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  CompetitorAuditScan,
  CompetitorGap,
  GeoAction,
  GeoActionPriority,
  GeoActionsReport,
  ListicleGapScan,
  Scan,
  ScanResult,
  SiteAudit,
} from 'src/common/types';

interface CitationFreq {
  domain: string;
  count: number;
  brandPresent: boolean;
}

@Injectable()
export class GeoActionsService {
  private readonly logger = new Logger(GeoActionsService.name);

  constructor(private firebase: FirebaseService) {}

  async generate(brandName: string): Promise<GeoActionsReport> {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();
    if (brandSnap.empty) {
      throw new NotFoundException(`Brand "${brandName}" not found`);
    }
    const brandDoc = brandSnap.docs[0];
    const brandId = brandDoc.id;

    const [aiScan, listicleScan, auditScan] = await Promise.all([
      this.latestAiScan(brandId),
      this.latestListicleGap(brandId),
      this.latestCompetitorAudit(brandId),
    ]);

    const actions: GeoAction[] = [];
    if (auditScan) actions.push(...this.synthesizeFromAudit(auditScan));
    if (listicleScan) actions.push(...this.synthesizeFromListicle(listicleScan));
    if (aiScan) actions.push(...this.synthesizeFromAiScan(aiScan, brandName));

    const sorted = actions.sort((a, b) => b.score - a.score);

    const byPriority: Record<GeoActionPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const byCategory: Record<string, number> = {};
    for (const a of sorted) {
      byPriority[a.priority] += 1;
      byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
    }

    return {
      brand: brandName,
      generatedAt: new Date().toISOString(),
      actions: sorted,
      sources: {
        hasAiScan: !!aiScan,
        hasListicleGap: !!listicleScan,
        hasCompetitorAudit: !!auditScan,
        aiScanId: aiScan?.scanId,
        listicleGapScanId: listicleScan?.id,
        competitorAuditScanId: auditScan?.id,
      },
      summary: {
        total: sorted.length,
        byPriority,
        byCategory: byCategory as GeoActionsReport['summary']['byCategory'],
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Aggregators — pull the most recent finished scan of each type for a brand.
  // ─────────────────────────────────────────────────────────────────────────

  private async latestAiScan(
    brandId: string,
  ): Promise<{
    scanId: string;
    results: ScanResult[];
    mentionRate: number;
    citations: CitationFreq[];
    perEngine: Record<string, { mentionRate: number; total: number }>;
  } | null> {
    const snap = await this.firebase
      .scans(brandId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data() as Scan;
      if (data.status !== 'done') continue;
      const scanId = doc.id;
      const resultsSnap = await this.firebase.results(brandId, scanId).get();
      const results = resultsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ScanResult,
      );
      if (results.length === 0) continue;

      const mentioned = results.filter((r) => r.mentioned).length;
      const mentionRate = Math.round((mentioned / results.length) * 100);

      const perEngine: Record<string, { mentionRate: number; total: number }> = {};
      for (const engine of new Set(results.map((r) => r.engine))) {
        const er = results.filter((r) => r.engine === engine);
        const em = er.filter((r) => r.mentioned).length;
        perEngine[engine] = {
          mentionRate: Math.round((em / er.length) * 100),
          total: er.length,
        };
      }

      const citations = this.aggregateCitations(results);

      return { scanId, results, mentionRate, citations, perEngine };
    }
    return null;
  }

  private aggregateCitations(results: ScanResult[]): CitationFreq[] {
    const map = new Map<string, { count: number; brandPresent: boolean }>();
    for (const r of results) {
      for (const url of r.citations ?? []) {
        const domain = this.safeDomain(url);
        const entry = map.get(domain) ?? { count: 0, brandPresent: false };
        entry.count += 1;
        if (r.mentioned) entry.brandPresent = true;
        map.set(domain, entry);
      }
    }
    return [...map.entries()]
      .map(([domain, v]) => ({ domain, ...v }))
      .sort((a, b) => b.count - a.count);
  }

  private safeDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url.slice(0, 60);
    }
  }

  private async latestListicleGap(
    brandId: string,
  ): Promise<ListicleGapScan | null> {
    const snap = await this.firebase
      .listicleGapScans(brandId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data() as ListicleGapScan;
      if (data.status === 'done') {
        return { id: doc.id, ...data };
      }
    }
    return null;
  }

  private async latestCompetitorAudit(
    brandId: string,
  ): Promise<CompetitorAuditScan | null> {
    const snap = await this.firebase
      .competitorAuditScans(brandId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data() as CompetitorAuditScan;
      if (data.status === 'done') {
        return { id: doc.id, ...data };
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Synthesizers — deterministic. Each surfaces actions backed by REAL data
  // (no LLM invention). Priority and score derived from observed gap size.
  // ─────────────────────────────────────────────────────────────────────────

  private synthesizeFromAudit(scan: CompetitorAuditScan): GeoAction[] {
    const actions: GeoAction[] = [];
    const brandAudit = scan.brandAudit;
    const competitors = scan.competitorAudits ?? [];
    if (!scan.gapSummary || competitors.length === 0) return actions;

    for (const row of scan.gapSummary) {
      if (row.yourStatus) continue; // already have it
      if (row.competitorsWithIt === 0) continue; // no competitor has it either — not a gap

      const ratio = row.competitorsWithIt / row.totalCompetitors;
      const priority: GeoActionPriority =
        ratio >= 0.75 ? 'critical' : ratio >= 0.5 ? 'high' : 'medium';
      const score = Math.round(ratio * 100) + (priority === 'critical' ? 20 : 0);

      const competitorsWithSignal = competitors
        .filter((c) =>
          c.signals.find((s) => s.key === row.key && s.passed),
        )
        .map((c) => c.domain);

      actions.push({
        id: `audit-${row.key}`,
        category: this.signalCategory(row.key),
        priority,
        title: this.signalActionTitle(row.key, row.label),
        description: `${competitorsWithSignal.length}/${row.totalCompetitors} competitors have this signal on their site, you don't. AI engines look for this signal when deciding which brands to surface.`,
        steps: this.signalSteps(row.key, brandAudit?.domain),
        effort: this.signalEffort(row.key),
        expectedImpact: this.signalImpact(row.key),
        evidence: {
          type: 'competitor-audit',
          scanId: scan.id,
          scanType: 'competitor-audit',
          detail: `Signal: ${row.label}. Competitors with it: ${competitorsWithSignal.join(', ')}`,
          values: {
            competitorsWithIt: row.competitorsWithIt,
            totalCompetitors: row.totalCompetitors,
          },
        },
        score,
      });
    }
    return actions;
  }

  private synthesizeFromListicle(scan: ListicleGapScan): GeoAction[] {
    const actions: GeoAction[] = [];
    const gaps = scan.competitorGaps ?? [];

    const topGaps = gaps.filter((g) => g.gapArticles >= 2).slice(0, 3);

    for (const gap of topGaps) {
      if (gap.sampleArticles.length === 0) continue;
      const priority: GeoActionPriority =
        gap.gapArticles >= 5 ? 'high' : 'medium';
      const score = Math.min(100, gap.gapArticles * 8 + (priority === 'high' ? 20 : 0));

      const sampleDomains = gap.sampleArticles.map((a) => a.domain);
      const uniqueDomains = [...new Set(sampleDomains)];

      actions.push({
        id: `listicle-${gap.competitor.toLowerCase().replace(/\s+/g, '-')}`,
        category: 'listicle',
        priority,
        title: `Pitch to articles that feature ${gap.competitor}`,
        description: `${gap.gapArticles} articles mention ${gap.competitor} but not you. These are direct PR/guest-post/listicle-inclusion targets — editors already cover your category, you just need to be on their radar.`,
        steps: [
          `Open the ${gap.sampleArticles.length} sample article URLs (see Evidence below)`,
          `Identify the author/editor of each article (byline or contact page)`,
          `Draft a short personalized pitch: introduce your brand + one concrete data point or quote you can contribute`,
          `For directory-style sites, submit a listing or business profile if available`,
          uniqueDomains.length > 1
            ? `Prioritize: ${uniqueDomains.slice(0, 3).join(', ')}`
            : `Focus first on: ${uniqueDomains[0]}`,
        ],
        effort: '1d',
        expectedImpact: `Each new article mention adds a citation source AI engines can use to surface your brand for "${gap.competitor}"-style queries.`,
        evidence: {
          type: 'listicle-gap',
          scanId: scan.id,
          scanType: 'listicle-gap',
          detail: `Sample articles where ${gap.competitor} is mentioned and you are not`,
          urls: gap.sampleArticles.map((a) => a.url),
          values: {
            competitor: gap.competitor,
            gapArticles: gap.gapArticles,
            totalArticles: gap.totalArticles,
          },
        },
        score,
      });
    }
    return actions;
  }

  private synthesizeFromAiScan(
    aiScan: {
      scanId: string;
      results: ScanResult[];
      mentionRate: number;
      citations: CitationFreq[];
      perEngine: Record<string, { mentionRate: number; total: number }>;
    },
    brandName: string,
  ): GeoAction[] {
    const actions: GeoAction[] = [];

    // Citation-source action — top cited domains where brand not present
    const topCitedMissing = aiScan.citations
      .filter((c) => !c.brandPresent && c.count >= 2)
      .slice(0, 3);
    if (topCitedMissing.length > 0) {
      const totalCited = aiScan.citations.length;
      const brandPresentCount = aiScan.citations.filter((c) => c.brandPresent).length;
      const coveragePct =
        totalCited > 0 ? Math.round((brandPresentCount / totalCited) * 100) : 0;
      const priority: GeoActionPriority = coveragePct < 20 ? 'high' : 'medium';
      const score = (100 - coveragePct) + 20;
      actions.push({
        id: 'citation-coverage',
        category: 'citation',
        priority,
        title: `Get featured on top AI-cited domains (${brandPresentCount}/${totalCited} coverage)`,
        description: `AI engines (Perplexity-style) cite ${totalCited} unique domains when answering queries in your category. You appear on only ${brandPresentCount} (${coveragePct}%). Priority: get visible on the most-cited domains.`,
        steps: [
          `Top 3 domains AI cites that don't mention you: ${topCitedMissing
            .map((c) => `${c.domain} (cited ${c.count}×)`)
            .join(', ')}`,
          `Visit each domain — identify whether it's a directory (submit listing), a publisher (pitch article), or a forum (build presence)`,
          `For directories: create a business profile with full description, photos, schema.org markup linking to your site`,
          `For publishers: find the relevant section editor, pitch a topic with your unique angle`,
          `Re-run scan after 30 days to measure if coverage improved`,
        ],
        effort: '1d',
        expectedImpact:
          'Each top-cited domain you appear on directly increases the probability AI engines name your brand in answers.',
        evidence: {
          type: 'citation',
          scanId: aiScan.scanId,
          scanType: 'ai-scan',
          detail: `AI-cited domains where ${brandName} is absent`,
          urls: topCitedMissing.map((c) => `https://${c.domain}`),
          values: {
            totalCitedDomains: totalCited,
            brandPresentOnCited: brandPresentCount,
            coveragePercent: coveragePct,
          },
        },
        score,
      });
    }

    // Per-engine weakness — engine where mention rate < 30%
    for (const [engine, stats] of Object.entries(aiScan.perEngine)) {
      if (stats.mentionRate >= 30) continue;
      const priority: GeoActionPriority =
        stats.mentionRate < 10 ? 'high' : 'medium';
      const score = (50 - stats.mentionRate) + 20;
      actions.push({
        id: `engine-${engine}`,
        category: 'engine-weakness',
        priority,
        title: `Improve presence on ${engine.replace('-style', '')} engine (${stats.mentionRate}% mention rate)`,
        description: `${engine} mentions your brand in only ${stats.mentionRate}% of category queries. This engine pulls from different signal sources than the others — fixing schema and citation gaps will lift this most.`,
        steps:
          engine === 'perplexity-style'
            ? [
                'Perplexity grounds answers in fresh web search — focus on getting featured in recent listicles + news mentions',
                'Add Article/NewsArticle JSON-LD schema to any published content',
                'Build presence on category-relevant publishers from the Citation Coverage action',
              ]
            : engine === 'gemini-style'
              ? [
                  'Gemini relies heavily on structured data — verify Organization + LocalBusiness JSON-LD schemas',
                  'Ensure Google Knowledge Panel exists (verify via Google Business Profile)',
                  'Add FAQ schema with answers to the 5 most-asked category questions',
                ]
              : [
                  'ChatGPT relies on training data + browsing — both benefit from broad citation footprint',
                  'Get listed on Wikipedia-quality sources (industry directories, news mentions, podcast appearances)',
                  'Maintain consistent NAP (Name/Address/Phone) across all directory listings',
                ],
        effort: 'half-day',
        expectedImpact: `Raising ${engine} mention rate above 30% gives 3 engines × balanced coverage instead of relying on one.`,
        evidence: {
          type: 'ai-scan',
          scanId: aiScan.scanId,
          scanType: 'ai-scan',
          detail: `${engine} engine weakness`,
          values: {
            engine,
            mentionRate: stats.mentionRate,
            queryCount: stats.total,
          },
        },
        score,
      });
    }

    return actions;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Per-signal copy. These map audit signal keys to specific, actionable steps.
  // ─────────────────────────────────────────────────────────────────────────

  private signalCategory(key: string): GeoAction['category'] {
    if (key === 'allowsGPTBot' || key === 'allowsAnthropic') return 'crawler-access';
    if (key === 'hasLlmsTxt' || key === 'hasSitemap') return 'crawler-access';
    return 'schema';
  }

  private signalActionTitle(key: string, label: string): string {
    if (key === 'allowsGPTBot') return 'Allow GPTBot in robots.txt (currently blocked)';
    if (key === 'allowsAnthropic') return 'Allow ClaudeBot in robots.txt (currently blocked)';
    if (key === 'hasLlmsTxt') return 'Publish /llms.txt to guide AI crawlers';
    return `Add ${label}`;
  }

  private signalSteps(key: string, domain?: string): string[] {
    const site = domain ? `https://${domain}` : 'your site';
    switch (key) {
      case 'orgOrLocalBiz':
        return [
          'Identify business type: Organization (general) or LocalBusiness/RealEstateAgent/Restaurant (location-based)',
          'Generate JSON-LD using Schema.org docs or Merkle Schema Markup Generator',
          'Include: name, url, logo, address, telephone, sameAs (social profiles)',
          `Add <script type="application/ld+json">{...}</script> in the <head> of ${site}`,
          'Validate at https://validator.schema.org/',
        ];
      case 'hasFAQ':
        return [
          'Identify the 5 most-asked questions about your business/category',
          'Write a concise answer (40-80 words) for each',
          'Generate FAQPage JSON-LD wrapping mainEntity[] of Question/Answer pairs',
          `Embed in a visible FAQ section on ${site} (Google requires the content be user-visible)`,
          'Validate with Google Rich Results Test',
        ];
      case 'hasReview':
        return [
          'Collect customer reviews from Google Business Profile / Trustpilot / industry directory',
          'Add AggregateRating JSON-LD to your homepage (ratingValue + reviewCount + bestRating)',
          'Add individual Review schema with author + reviewBody for 3-5 testimonials displayed on the site',
        ];
      case 'hasBreadcrumb':
        return [
          'Add BreadcrumbList JSON-LD to every multi-level page (e.g. Home > Category > Page)',
          'Include itemListElement[] with position, name, item (URL) for each crumb',
          'Display a matching visible breadcrumb UI to satisfy Google\'s rich result requirement',
        ];
      case 'hasArticle':
        return [
          'Start a /blog or /insights section if none exists',
          'Add Article or BlogPosting JSON-LD to each post (headline, datePublished, author, image)',
          'Publish weekly content covering category questions AI engines are asked',
        ];
      case 'hasLlmsTxt':
        return [
          'Create a /llms.txt file at the root of your site (plain text, similar to robots.txt)',
          'Include: site name, summary, key product/service URLs, contact info — formatted in human-readable markdown',
          'See spec: https://llmstxt.org',
          `Upload to ${site}/llms.txt and verify it returns 200`,
        ];
      case 'allowsGPTBot':
        return [
          'Open your /robots.txt file',
          'Add (or remove the block on): User-agent: GPTBot\\nAllow: /',
          'Same for: ChatGPT-User',
          'Without this, OpenAI cannot crawl your site for ChatGPT answers',
        ];
      case 'allowsAnthropic':
        return [
          'Open your /robots.txt file',
          'Add: User-agent: ClaudeBot\\nAllow: /',
          'Add: User-agent: anthropic-ai\\nAllow: /',
          'Without this, Anthropic cannot index your site for Claude answers',
        ];
      case 'hasSitemap':
        return [
          'Generate sitemap.xml listing every public URL with lastmod + priority',
          `Upload to ${site}/sitemap.xml`,
          'Submit URL in Google Search Console + Bing Webmaster Tools',
          'Reference it in robots.txt: Sitemap: https://yourdomain/sitemap.xml',
        ];
      case 'hasMetaAndOg':
        return [
          'Add <meta name="description" content="..."> (150-160 chars summarising the page)',
          'Add Open Graph: og:title, og:description, og:image, og:url',
          'Add Twitter Card tags: twitter:card="summary_large_image", twitter:title, twitter:description',
          'Validate with https://opengraph.dev or LinkedIn Post Inspector',
        ];
      default:
        return ['Apply this missing signal to your site (see competitor examples in the audit).'];
    }
  }

  private signalEffort(key: string): GeoAction['effort'] {
    if (key === 'allowsGPTBot' || key === 'allowsAnthropic') return '15m';
    if (key === 'hasLlmsTxt' || key === 'hasMetaAndOg' || key === 'hasSitemap') return '1h';
    if (key === 'hasArticle') return 'ongoing';
    return 'half-day';
  }

  private signalImpact(key: string): string {
    switch (key) {
      case 'allowsGPTBot':
        return 'ChatGPT can now crawl and learn about your brand — unblocks the largest AI search audience.';
      case 'allowsAnthropic':
        return 'Claude can now index your content — unblocks Anthropic-powered search.';
      case 'hasLlmsTxt':
        return 'Gives AI crawlers a guided summary of your site, increasing the chance they pull the right content into answers.';
      case 'orgOrLocalBiz':
        return 'Establishes your brand identity to Google\'s Knowledge Graph and downstream AI training.';
      case 'hasFAQ':
        return 'AI engines often quote FAQ answers directly when responding to category questions.';
      case 'hasReview':
        return 'Star ratings + review count are heavily weighted signals when AI ranks recommendations.';
      case 'hasArticle':
        return 'Each indexed article becomes a new entry point for AI engines to discover your brand.';
      default:
        return 'Closes a competitive gap on a signal AI engines look at when ranking brands.';
    }
  }

  // Helper to avoid unused-var warning when types reference SiteAudit only structurally
  private _siteAuditMarker(_x?: SiteAudit, _y?: CompetitorGap): void {}
}
