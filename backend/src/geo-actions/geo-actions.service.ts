import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  BrandPresenceReport,
  CompetitorAuditScan,
  CompetitorGap,
  GeoAction,
  GeoActionPlaybook,
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

  // Echo buckets — prompts that explicitly name the brand. Mentions in these
  // are not real visibility; they just prove the LLM can talk about the brand
  // when given the cue.
  private static readonly ECHO_TEMPLATE_IDS = new Set([
    'top_alternatives',
    'brand_reputation',
  ]);

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

    const [aiScan, listicleScan, auditScan, presenceReport] = await Promise.all([
      this.latestAiScan(brandId),
      this.latestListicleGap(brandId),
      this.latestCompetitorAudit(brandId),
      this.latestBrandPresence(brandId),
    ]);

    const actions: GeoAction[] = [];
    if (auditScan) actions.push(...this.synthesizeFromAudit(auditScan));
    if (listicleScan) actions.push(...this.synthesizeFromListicle(listicleScan));
    if (aiScan) actions.push(...this.synthesizeFromAiScan(aiScan, brandName));
    if (presenceReport) actions.push(...this.synthesizeFromPresence(presenceReport));

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
        hasBrandPresence: !!presenceReport,
        aiScanId: aiScan?.scanId,
        listicleGapScanId: listicleScan?.id,
        competitorAuditScanId: auditScan?.id,
        brandPresenceReportId: presenceReport?.id,
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
    realMentionRate: number;
    echoMentionRate: number;
    realTotal: number;
    echoTotal: number;
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

      // Real vs echo split — same convention as scans.service.ts
      const realResults = results.filter(
        (r) => !GeoActionsService.ECHO_TEMPLATE_IDS.has(r.templateId ?? ''),
      );
      const echoResults = results.filter((r) =>
        GeoActionsService.ECHO_TEMPLATE_IDS.has(r.templateId ?? ''),
      );
      const realMentionRate =
        realResults.length > 0
          ? Math.round(
              (realResults.filter((r) => r.mentioned).length / realResults.length) * 100,
            )
          : 0;
      const echoMentionRate =
        echoResults.length > 0
          ? Math.round(
              (echoResults.filter((r) => r.mentioned).length / echoResults.length) * 100,
            )
          : 0;

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

      return {
        scanId,
        results,
        mentionRate,
        realMentionRate,
        echoMentionRate,
        realTotal: realResults.length,
        echoTotal: echoResults.length,
        citations,
        perEngine,
      };
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

  private async latestBrandPresence(
    brandId: string,
  ): Promise<BrandPresenceReport | null> {
    const snap = await this.firebase
      .brandPresenceReports(brandId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data() as BrandPresenceReport;
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

    // Headline action — overall audit score critically low vs competitors
    if (brandAudit && brandAudit.scoreOutOf > 0) {
      const yourPct = (brandAudit.score / brandAudit.scoreOutOf) * 100;
      const competitorPcts = competitors
        .filter((c) => c.scoreOutOf > 0)
        .map((c) => (c.score / c.scoreOutOf) * 100);
      const competitorAvg =
        competitorPcts.length > 0
          ? competitorPcts.reduce((s, p) => s + p, 0) / competitorPcts.length
          : 0;
      const gap = competitorAvg - yourPct;
      if (yourPct < 40 || gap >= 25) {
        const priority: GeoActionPriority = yourPct < 25 ? 'critical' : 'high';
        const missingSignals = scan.gapSummary
          .filter((row) => !row.yourStatus && row.competitorsWithIt > 0)
          .map((r) => r.label);
        actions.push({
          id: 'audit-overall-score',
          category: 'schema',
          priority,
          title: `AI-readiness score critically low (${brandAudit.score}/${brandAudit.scoreOutOf} vs competitors avg ${Math.round(competitorAvg)}%)`,
          description: `Your site passes only ${brandAudit.score}/${brandAudit.scoreOutOf} of the signals AI engines look at. Competitors average ${Math.round(competitorAvg)}%. Each missing signal is a direct reason AI engines rank competitors above you.`,
          steps: [
            `Missing signals: ${missingSignals.slice(0, 8).join(', ') || '(none — fix individual actions below)'}`,
            'Work through the individual signal actions below in priority order.',
            'Start with the 15-minute wins (robots.txt for GPTBot, llms.txt, meta description).',
            'Then half-day items (JSON-LD schemas).',
            'Re-run audit after each fix to confirm score climbs.',
          ],
          effort: '1d',
          expectedImpact: `Raising audit score to ${Math.max(70, Math.round(competitorAvg))}% closes the structural gap that lets competitors out-rank you on every AI engine. Each +10 points lifts AI mention rate ~5-8pp historically.`,
          evidence: {
            type: 'competitor-audit',
            scanId: scan.id,
            scanType: 'competitor-audit',
            detail: `Your score: ${brandAudit.score}/${brandAudit.scoreOutOf}. Competitor avg: ${Math.round(competitorAvg)}%. Gap: ${Math.round(gap)}pp.`,
            values: {
              yourScore: brandAudit.score,
              scoreOutOf: brandAudit.scoreOutOf,
              competitorAvgPct: Math.round(competitorAvg),
              gapPp: Math.round(gap),
            },
          },
          score: priority === 'critical' ? 120 : 100,
        });
      }
    }

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
        playbook: this.signalPlaybook(row.key, brandAudit?.domain, scan.brand),
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
      realMentionRate: number;
      echoMentionRate: number;
      realTotal: number;
      echoTotal: number;
      citations: CitationFreq[];
      perEngine: Record<string, { mentionRate: number; total: number }>;
    },
    brandName: string,
  ): GeoAction[] {
    const actions: GeoAction[] = [];

    // Real-visibility = 0% → CRITICAL. The brand never appears spontaneously
    // when AI engines answer unbiased category questions. Highest-leverage
    // single signal — overrides everything else.
    if (aiScan.realTotal >= 3 && aiScan.realMentionRate < 10) {
      actions.push({
        id: 'ai-zero-real-visibility',
        category: 'engine-weakness',
        priority: 'critical',
        title: `Zero real visibility (${aiScan.realMentionRate}% on unbiased queries)`,
        description: `When customers ask AI engines about your category WITHOUT naming you, your brand surfaces in only ${aiScan.realMentionRate}% of answers (${aiScan.realTotal} queries tested). This is the #1 metric to fix — it measures whether AI engines discovered you on their own.`,
        steps: [
          'This is a SYMPTOM — the root causes are below. Fix in this exact order:',
          '1. Knowledge Panel — see Presence actions (Google must recognise you as an entity)',
          '2. Wikipedia article — see Presence actions (ChatGPT training corpus)',
          '3. JSON-LD Organization schema — see Audit actions (Gemini reads structured data)',
          '4. /llms.txt + GPTBot allowed — see Crawler actions (engines must be able to read your site)',
          '5. Citation footprint — see Citation Coverage action (get featured on top 5 AI-cited domains)',
          '6. Re-scan in 30-60 days. Real visibility should rise from 0% to 15-30% after the first cycle of fixes.',
        ],
        effort: 'ongoing',
        expectedImpact:
          'Going from 0% to 30% real visibility = your brand becomes one of the default options AI engines name when shoppers research the category. This compounds (each engine that names you reinforces the signal).',
        evidence: {
          type: 'ai-scan',
          scanId: aiScan.scanId,
          scanType: 'ai-scan',
          detail: `Unbiased prompts tested: ${aiScan.realTotal}. Brand mentioned in: ${Math.round((aiScan.realMentionRate / 100) * aiScan.realTotal)}.`,
          values: {
            realMentionRate: aiScan.realMentionRate,
            realTotal: aiScan.realTotal,
            echoMentionRate: aiScan.echoMentionRate,
            gap: aiScan.echoMentionRate - aiScan.realMentionRate,
          },
        },
        score: 130,
      });
    } else if (
      aiScan.echoTotal >= 2 &&
      aiScan.echoMentionRate - aiScan.realMentionRate >= 40
    ) {
      // Echo > Real by 40+ points → brand is recognised when asked but not
      // discovered spontaneously. Classic "AI knows your name but doesn't
      // surface you" pattern.
      actions.push({
        id: 'ai-echo-gap',
        category: 'engine-weakness',
        priority: 'high',
        title: `AI knows your name but doesn't recommend you (echo gap: ${aiScan.echoMentionRate - aiScan.realMentionRate}pp)`,
        description: `AI engines mention you ${aiScan.echoMentionRate}% of the time when the prompt names you, but only ${aiScan.realMentionRate}% when it doesn't. Big gap = brand identity known, but ranking/recommendation signal weak.`,
        steps: [
          'You have brand recognition but lack ranking authority. Focus on signals that lift recommendation rank, not awareness:',
          '1. Get on every "top 10" / "best of" listicle in your category — see Listicle Gap actions',
          '2. Add Review + AggregateRating schema to your site (signals quality to engines)',
          '3. Build citations on category-specific publishers (not just general PR)',
          '4. Run a 60-day content sprint: publish answer-style articles for the top 10 buying-stage questions in your category',
          '5. Re-scan after 60 days — target: close echo gap to under 20pp',
        ],
        effort: 'ongoing',
        expectedImpact:
          'Closing the echo gap converts brand awareness into AI-driven leads. Echo gap < 20pp = brand is positioned as a default option, not just a known name.',
        evidence: {
          type: 'ai-scan',
          scanId: aiScan.scanId,
          scanType: 'ai-scan',
          detail: 'Real-vs-echo mention rate gap',
          values: {
            realMentionRate: aiScan.realMentionRate,
            echoMentionRate: aiScan.echoMentionRate,
            gap: aiScan.echoMentionRate - aiScan.realMentionRate,
          },
        },
        score: 110,
      });
    }

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
        playbook: this.citationOutreachPlaybook(brandName, topCitedMissing.map((c) => c.domain)),
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
          'Add (or remove the block on) these two lines: "User-agent: GPTBot" then "Allow: /"',
          'Add the same pair for: "User-agent: ChatGPT-User" then "Allow: /"',
          'Without this, OpenAI cannot crawl your site for ChatGPT answers',
        ];
      case 'allowsAnthropic':
        return [
          'Open your /robots.txt file',
          'Add these two lines: "User-agent: ClaudeBot" then "Allow: /"',
          'Add these two lines: "User-agent: anthropic-ai" then "Allow: /"',
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

  // ─────────────────────────────────────────────────────────────────────────
  // Presence synthesizer. Knowledge Panel + Wikipedia are training-data signals
  // — Gemini relies heavily on Knowledge Graph, ChatGPT training corpus includes
  // Wikipedia. Both = high-leverage when missing while competitors have them.
  // ─────────────────────────────────────────────────────────────────────────
  private synthesizeFromPresence(report: BrandPresenceReport): GeoAction[] {
    const actions: GeoAction[] = [];
    const brand = report.brandCheck;
    const competitors = report.competitorChecks ?? [];
    if (!brand || competitors.length === 0) return actions;

    // Knowledge Panel gap
    if (!brand.hasKnowledgePanel) {
      const competitorsWithKP = competitors.filter((c) => c.hasKnowledgePanel);
      if (competitorsWithKP.length > 0) {
        const ratio = competitorsWithKP.length / competitors.length;
        const priority: GeoActionPriority =
          ratio >= 0.5 ? 'critical' : 'high';
        actions.push({
          id: 'presence-knowledge-panel',
          category: 'presence',
          priority,
          title: 'Establish a Google Knowledge Panel',
          description: `${competitorsWithKP.length}/${competitors.length} competitors have a Google Knowledge Panel and you don't. Knowledge Panels are one of the strongest signals Gemini uses to recognize and rank brands.`,
          steps: [
            'Verify your business on Google Business Profile (https://business.google.com)',
            'Build a Wikipedia article first — Knowledge Panels often source from Wikipedia (see Wikipedia action below)',
            'Get cited by authoritative sources (news outlets, industry publications) — Google Knowledge Graph pulls from these',
            'Add Organization JSON-LD schema with sameAs links to your social profiles + Wikipedia + Crunchbase',
            'Claim Knowledge Panel if it appears: https://support.google.com/knowledgepanel/answer/7534842',
            `Competitors with Knowledge Panel: ${competitorsWithKP.map((c) => c.name).join(', ')}`,
          ],
          effort: 'ongoing',
          expectedImpact:
            'Knowledge Panel = direct Gemini visibility lift + Google SERP real estate. Strongest single brand-recognition signal.',
          evidence: {
            type: 'brand-presence',
            scanId: report.id,
            scanType: 'brand-presence',
            detail: `Competitors with Knowledge Panel: ${competitorsWithKP
              .map((c) => `${c.name} (${c.knowledgePanelTitle ?? 'verified'})`)
              .join(', ')}`,
            values: {
              competitorsWithKP: competitorsWithKP.length,
              totalCompetitors: competitors.length,
            },
          },
          score: 95 + (priority === 'critical' ? 10 : 0),
          playbook: this.knowledgePanelPlaybook(report.brand),
        });
      }
    }

    // Wikipedia gap
    if (!brand.hasWikipedia) {
      const competitorsWithWiki = competitors.filter((c) => c.hasWikipedia);
      if (competitorsWithWiki.length > 0) {
        const ratio = competitorsWithWiki.length / competitors.length;
        const priority: GeoActionPriority = ratio >= 0.5 ? 'high' : 'medium';
        actions.push({
          id: 'presence-wikipedia',
          category: 'presence',
          priority,
          title: 'Get a Wikipedia article for your brand',
          description: `${competitorsWithWiki.length}/${competitors.length} competitors have Wikipedia pages and you don't. Wikipedia is heavily weighted in ChatGPT's training corpus and feeds Google's Knowledge Graph.`,
          steps: [
            'Build notability first — Wikipedia requires significant coverage in independent reliable sources (3+ in-depth articles from established media)',
            'Have a third-party editor draft the article — direct self-creation violates Wikipedia\'s Conflict of Interest policy and gets pages deleted',
            'Cite only secondary sources (news articles, industry analyses) — never your own site or press releases',
            'Focus on factual encyclopedic tone, NOT marketing copy',
            'Submit via Articles for Creation (AfC) so an editor reviews before publication',
            `Competitor Wikipedia URLs: ${competitorsWithWiki
              .map((c) => c.wikipediaUrl ?? c.name)
              .filter(Boolean)
              .join(', ')}`,
          ],
          effort: 'ongoing',
          expectedImpact:
            'Wikipedia entry → ChatGPT training data inclusion + boost toward Knowledge Panel + authoritative citation that lifts all AI-engine confidence.',
          evidence: {
            type: 'brand-presence',
            scanId: report.id,
            scanType: 'brand-presence',
            detail: `Competitor Wikipedia pages`,
            urls: competitorsWithWiki
              .map((c) => c.wikipediaUrl ?? '')
              .filter(Boolean),
            values: {
              competitorsWithWikipedia: competitorsWithWiki.length,
              totalCompetitors: competitors.length,
            },
          },
          score: 80 + (priority === 'high' ? 10 : 0),
          playbook: this.wikipediaPlaybook(report.brand),
        });
      }
    }

    return actions;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Citation-building playbooks — Wikipedia + Wikidata + press release +
  // directory submission. These are the "off-site" actions that prove brand
  // notability to Knowledge Graph / ChatGPT training corpus.
  // ─────────────────────────────────────────────────────────────────────────
  private wikipediaPlaybook(brandName: string): GeoActionPlaybook {
    const safe = brandName.replace(/"/g, '\\"');
    return {
      why: 'Wikipedia is the highest-leverage citation source for AI engines. ChatGPT\'s training corpus includes the full Wikipedia dump; Knowledge Panels often inherit their first description from Wikipedia. A single Wikipedia article can lift AI mention rate by 15-25 percentage points across all engines.',
      codeBlocks: [
        {
          label: 'Notability self-check (Wikipedia requires ALL three)',
          language: 'markdown',
          content: `## Wikipedia Notability Checklist for ${brandName}

Pass ALL three before attempting an article:

1. ✅ SIGNIFICANT COVERAGE
   - At least 3 in-depth articles ABOUT your brand (not just mentions)
   - Each article must be 500+ words focused on your brand
   - Must be from INDEPENDENT sources (not your blog, not paid PR)

2. ✅ RELIABLE SOURCES
   - Major newspapers (e.g. NYT, Reuters, BBC, Khaleej Times, Gulf News)
   - Trade publications with editorial standards (e.g. TechCrunch, Wired)
   - Academic / industry analyst reports (not vendor white papers)

3. ✅ SUSTAINED COVERAGE OVER TIME
   - Coverage must span 12+ months (not just one launch announcement)
   - Indicates lasting impact, not a press-release blip

If you fail any item: focus 3-6 months on building real coverage FIRST. Submitting too early triggers Speedy Deletion.`,
        },
        {
          label: 'Article structure template (paste as starting point in Wikipedia draft)',
          language: 'markdown',
          content: `'''${brandName}''' is a [category, e.g. "Dubai-based real estate brokerage"] [founded in YEAR by FOUNDERS].<ref name="source1">[Citation 1 — Reuters/NYT/Khaleej Times/etc.]</ref> The company [primary activity, neutral tone].<ref name="source2">[Citation 2]</ref>

== History ==
${brandName} was founded in YEAR.<ref>[source]</ref> [Factual history paragraph — funding rounds, key milestones, expansion events. CITE EVERYTHING.]

== Operations ==
The company operates [scale: how many offices/clients/markets]. [What it does, neutrally — no marketing adjectives.]<ref>[source]</ref>

== Reception ==
${brandName} has been profiled in [list outlets].<ref>[source]</ref> [Awards/recognitions — only if independently verified.]

== References ==
{{Reflist}}

== External links ==
* [https://yourdomain.com Official website]

[[Category:Companies of <Country>]]
[[Category:<Industry> companies established in <Year>]]`,
        },
      ],
      verifySteps: [
        'Run your sources through https://en.wikipedia.org/wiki/Wikipedia:Reliable_sources (each must qualify)',
        'Search Wikipedia for "Wikipedia:Articles for creation" and submit your draft there',
        'Wait for AfC reviewer feedback (typically 1-3 months)',
        'After acceptance, monitor the article weekly — vandalism happens',
        `Search Google for "${safe} site:en.wikipedia.org" after 30 days to confirm indexing`,
      ],
      timeline: '6-12 months from "no Wikipedia" to "live article" if you start with insufficient sources. 1-3 months if you already have 3+ reliable independent sources.',
      pitfalls: [
        'Conflict of Interest — NEVER edit your own brand\'s Wikipedia page directly. Use the AfC process or a paid Wikipedia editor (Wiki PR firms charge $1.5-5k for compliant drafting)',
        'Promotional tone gets articles deleted — must read like a neutral encyclopedia entry',
        'Citing your own website as source = automatic rejection. Cite ONLY independent secondary sources',
        'Press releases do NOT count as reliable sources, even if republished by a news site',
        'Speedy Deletion: if rejected once, second submission must show substantial new sources, not just rewording',
      ],
      resources: [
        { label: 'Wikipedia:Articles for creation', url: 'https://en.wikipedia.org/wiki/Wikipedia:Articles_for_creation' },
        { label: 'Wikipedia:Notability (companies)', url: 'https://en.wikipedia.org/wiki/Wikipedia:Notability_(organizations_and_companies)' },
        { label: 'Wikipedia:Conflict of interest', url: 'https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest' },
      ],
    };
  }

  private citationOutreachPlaybook(brandName: string, topDomains: string[]): GeoActionPlaybook {
    const safe = brandName.replace(/"/g, '\\"');
    return {
      why: 'AI engines (especially Perplexity, Gemini-with-search, Bing Copilot) build answers by reading a small set of "trusted" domains for each category. If your brand appears on those domains, you get cited. If not, you are invisible regardless of how strong your own site is.',
      codeBlocks: [
        {
          label: 'Press release template (Newsworthy hook + factual lede + boilerplate)',
          language: 'markdown',
          content: `FOR IMMEDIATE RELEASE
${new Date().toISOString().slice(0, 10)}

# ${brandName} <verb that signals news — launches/announces/raises/expands> <thing>

<CITY> — ${brandName}, <one-sentence positioning ("a Dubai-based real-estate brokerage")>, today announced <the news in one sentence>. <Why it matters to the industry — concrete impact, not adjectives>.

## Key facts
- <stat 1 with source: e.g. "Now operating in 12 markets across the GCC">
- <stat 2: e.g. "Closed $XM in funding from <investor>">
- <stat 3: e.g. "Serves over 10,000 clients">

## Quote
"<Quote from CEO/founder explaining the WHY, not the WHAT>" said <NAME>, <TITLE> of ${brandName}.

## About ${brandName}
${brandName} is <factual 2-3 sentence boilerplate>. Founded in <YEAR>, the company is headquartered in <CITY>. Learn more at <https://yourdomain.com>.

## Contact
<Name>
<Title>
<Email>
<Phone>`,
        },
        {
          label: 'Email pitch template — for publisher outreach',
          language: 'text',
          content: `Subject: <Specific story angle, not "press release"> — concrete data point

Hi <FIRST NAME>,

I read your piece on <ARTICLE TITLE — show you actually read it> and the point about <SPECIFIC INSIGHT> resonated.

We just <NEWSWORTHY EVENT — funded, launched, hit milestone, published research>. Specifically:
- <data point 1>
- <data point 2>
- <unique angle no competitor can match>

If you're working on a follow-up to <THEIR ARTICLE>, I can offer:
1. Exclusive access to <DATA / EXEC / CUSTOMER>
2. A <NUMBER>-data-point briefing in 20 minutes
3. <SOMETHING THE COMPETITOR CAN'T GIVE>

Quick reply with "interested" and I'll send the full deck.

— <NAME>
<TITLE>, ${safe}
<phone>`,
        },
        {
          label: 'Top general directories to submit to (free, high authority)',
          language: 'text',
          content: `1. Crunchbase           https://about.crunchbase.com/products/add-organizations/
2. LinkedIn Company     https://www.linkedin.com/company/setup/new/
3. Google Business      https://business.google.com
4. Bing Places          https://www.bingplaces.com
5. Apple Business       https://mapsconnect.apple.com
6. Trustpilot           https://business.trustpilot.com
7. G2 (B2B SaaS)        https://www.g2.com/sellers/new
8. Capterra (B2B SaaS)  https://www.capterra.com/vendors/sign-up
9. Yelp                 https://biz.yelp.com
10. Yellow Pages        https://www.yellowpages.com

UAE / Middle East:
- Khaleej Times Business   https://www.khaleejtimes.com
- Gulf News                https://gulfnews.com
- Arabian Business         https://www.arabianbusiness.com
- Yellow Pages UAE         https://www.yellowpages.ae

US:
- Forbes Business Council  (paid, $1.5k/mo but high authority)
- Inc.com                  (pitch via inc.com/contact)

Submit ONLY where your category genuinely fits. Spam submissions reduce trust signal.`,
        },
      ],
      verifySteps: [
        topDomains.length > 0
          ? `Open each top-cited domain in turn (${topDomains.slice(0, 3).join(', ')}) and decide: directory / publisher / forum / review site`
          : 'List the top 5 domains AI engines cite for your category and inspect each',
        'Send 5-10 outreach emails per week (not a one-time blast) — relationships build slowly',
        'Track replies in a simple spreadsheet (date sent / publisher / status / placement URL)',
        'Re-run AI scan after 30 days — citation coverage should rise 5-15pp per cycle',
      ],
      timeline: '30-90 days for first placements. 6-12 months to reach 50%+ citation coverage from 0%.',
      pitfalls: [
        'Generic mass pitches get ignored — always reference a SPECIFIC article the writer wrote',
        'Press releases on PRNewswire/PRWeb without follow-up = waste of money. Newswires only work for SEC-style obligations, not earned media',
        'Paid placements (Forbes Councils, Featured.com) deliver fast but mark you as "sponsored" — use sparingly to avoid devaluing the domain',
        'Trade publications that ask for $5k+ to publish a "feature" are pay-to-play — AI engines often de-prioritise these',
      ],
      resources: [
        { label: 'HARO (Help A Reporter Out)', url: 'https://www.helpareporter.com' },
        { label: 'Qwoted (similar to HARO)', url: 'https://www.qwoted.com' },
        { label: 'Featured.com (paid Q&A pitches)', url: 'https://featured.com' },
      ],
    };
  }

  private knowledgePanelPlaybook(brandName: string): GeoActionPlaybook {
    return {
      why: 'A Google Knowledge Panel is the right-hand-side info card that appears when someone searches your brand name. It directly powers Gemini\'s brand recognition and is the single strongest signal that AI engines see you as a "real entity" worth recommending.',
      codeBlocks: [
        {
          label: 'Wikidata claim list — minimum entity for Knowledge Panel eligibility',
          language: 'text',
          content: `Create a Wikidata item at https://www.wikidata.org/wiki/Special:NewItem

Required claims (Property → Value):
  Label (English):         ${brandName}
  Description (English):   <short factual description, e.g. "Dubai real estate brokerage">

  P31 (instance of):       Q4830453 (business)  OR  Q43229 (organization)
  P17 (country):           Q<country wikidata ID, e.g. Q878 for UAE>
  P159 (headquarters):     Q<city wikidata ID>
  P571 (inception):        <YYYY-MM-DD founding date>
  P856 (official website): https://yourdomain.com
  P452 (industry):         Q<industry wikidata ID>
  P2003 (Instagram):       <handle, no @>
  P2013 (Facebook ID):     <numeric facebook page ID>
  P2002 (Twitter):         <handle, no @>
  P4264 (LinkedIn ID):     <linkedin company slug>

Each claim MUST have a source (P248 + URL or external ID). Unsourced claims = the
panel will not surface them, and the Wikidata item may be deleted.`,
        },
        {
          label: 'sameAs schema — link your site to every external identity',
          language: 'html',
          content: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${brandName}",
  "url": "https://yourdomain.com",
  "sameAs": [
    "https://www.wikidata.org/wiki/Q<your wikidata ID>",
    "https://en.wikipedia.org/wiki/<your wikipedia slug>",
    "https://www.linkedin.com/company/<your handle>",
    "https://twitter.com/<your handle>",
    "https://www.instagram.com/<your handle>",
    "https://www.facebook.com/<your handle>",
    "https://www.crunchbase.com/organization/<your slug>",
    "https://www.youtube.com/@<your handle>"
  ]
}
</script>`,
        },
      ],
      verifySteps: [
        `Search Google for "${brandName}" — if a panel appears, claim it at https://support.google.com/knowledgepanel/answer/7534842`,
        'If no panel after 30 days post-Wikidata: check your Wikidata item has at least 5 sourced claims',
        'Verify Google Business Profile is verified (https://business.google.com)',
        'Check https://www.google.com/search?q=<brand+name>&kgmid= — your knowledge graph ID will appear in URL if Google recognises you',
      ],
      timeline: '30-90 days after Wikidata + Google Business Profile + Wikipedia. Without Wikipedia, panel rarely appears unless brand has Crunchbase + Bloomberg-level coverage.',
      pitfalls: [
        'Knowledge Panels REQUIRE Google to recognise you as an entity. The fastest path = Wikidata + Wikipedia + Google Business Profile + Crunchbase, all cross-linked via sameAs schema',
        'Do NOT use the Knowledge Panel "Suggest an edit" button before you have a verified profile — Google ignores unverified suggestions',
        'Inconsistent NAP (name/address/phone) across web = no panel. Audit Yelp, Yellow Pages, Crunchbase, LinkedIn, Bing Places for consistency before applying',
      ],
      resources: [
        { label: 'Wikidata new item', url: 'https://www.wikidata.org/wiki/Special:NewItem' },
        { label: 'Google Business Profile', url: 'https://business.google.com' },
        { label: 'Claim Knowledge Panel', url: 'https://support.google.com/knowledgepanel/answer/7534842' },
        { label: 'Crunchbase add company', url: 'https://about.crunchbase.com/products/add-organizations/' },
      ],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Per-signal Playbook — "how to actually do it" with code/verify/timeline.
  // Lifts every action from generic guidance to copy-paste-and-verify recipe.
  // ─────────────────────────────────────────────────────────────────────────
  private signalPlaybook(
    key: string,
    domain: string | undefined,
    brandName: string,
  ): GeoActionPlaybook | undefined {
    const site = domain ? `https://${domain}` : 'https://yourdomain.com';
    const escapedBrand = brandName.replace(/"/g, '\\"');

    switch (key) {
      case 'orgOrLocalBiz':
        return {
          why: 'JSON-LD Organization schema is how Gemini, Google Knowledge Graph, and Bing Copilot identify your business as a distinct entity. Without it, AI engines see you as "just another page" instead of a brand they can confidently recommend.',
          codeBlocks: [
            {
              label: 'Paste this in <head> of your homepage',
              language: 'html',
              content: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${escapedBrand}",
  "url": "${site}",
  "logo": "${site}/logo.png",
  "description": "(120-160 char description of what you do)",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Your street",
    "addressLocality": "City",
    "addressRegion": "Region",
    "postalCode": "00000",
    "addressCountry": "AE"
  },
  "telephone": "+971-X-XXX-XXXX",
  "email": "hello@yourdomain.com",
  "sameAs": [
    "https://www.linkedin.com/company/your-handle",
    "https://twitter.com/yourhandle",
    "https://www.instagram.com/yourhandle",
    "https://www.facebook.com/yourhandle"
  ]
}
</script>`,
            },
          ],
          verifySteps: [
            `Open https://validator.schema.org/ and paste your homepage URL`,
            `Confirm "Organization" detected with 0 errors`,
            `Open https://search.google.com/test/rich-results and paste the same URL`,
            `Wait 7-14 days, then search "${brandName}" on Google — you should see a richer brand card`,
          ],
          timeline: 'Schema indexed in 1-7 days. Knowledge Graph effects take 2-6 weeks.',
          pitfalls: [
            'Do NOT use multiple competing @type values (Organization + LocalBusiness on same page confuses crawlers)',
            'sameAs URLs must be live and reciprocally link back to your domain (broken socials get the markup ignored)',
            'Address must match what is on Google Business Profile and other directories — NAP consistency is critical',
          ],
          resources: [
            { label: 'Schema.org Organization spec', url: 'https://schema.org/Organization' },
            { label: 'Merkle Schema Markup Generator', url: 'https://www.schemaapp.com/tools/jsonld-schema-generator/' },
          ],
        };

      case 'hasFAQ':
        return {
          why: 'FAQ schema is the #1 source AI engines quote VERBATIM when answering category questions. A well-marked FAQ entry can put your exact words into ChatGPT/Gemini answers.',
          codeBlocks: [
            {
              label: 'Embed in a visible FAQ section + add this script',
              language: 'html',
              content: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What does ${escapedBrand} do?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "(40-80 word concise answer)"
      }
    },
    {
      "@type": "Question",
      "name": "(another common customer question)",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "(40-80 word concise answer)"
      }
    }
  ]
}
</script>`,
            },
          ],
          verifySteps: [
            'Run https://search.google.com/test/rich-results on the page',
            'Confirm "FAQ" rich result detected',
            'Search one of the questions on Google — your FAQ should be eligible for the People Also Ask box within 30 days',
          ],
          timeline: 'Rich result eligibility 7-14 days. PAA appearance 2-4 weeks.',
          pitfalls: [
            'The questions/answers MUST be visible on the page (Google penalises hidden FAQ-only-in-schema)',
            'Do NOT use FAQ schema for promotional Q&A — Google demoted that signal in 2023',
            'Maximum effective: 5-10 questions per page',
          ],
          resources: [
            { label: 'Google FAQ guidance', url: 'https://developers.google.com/search/docs/appearance/structured-data/faqpage' },
          ],
        };

      case 'hasReview':
        return {
          why: 'AggregateRating signals quality strongly to AI engines. ChatGPT and Gemini disproportionately recommend brands with visible 4+ star ratings when answering "best X" queries.',
          codeBlocks: [
            {
              label: 'AggregateRating + Review JSON-LD',
              language: 'html',
              content: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${escapedBrand}",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "127",
    "bestRating": "5"
  },
  "review": [
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Real Customer Name" },
      "datePublished": "2025-11-01",
      "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
      "reviewBody": "(real testimonial text 50-150 words)"
    }
  ]
}
</script>`,
            },
          ],
          verifySteps: [
            'Validate at https://validator.schema.org/',
            'Confirm aggregateRating + at least one Review parse cleanly',
            'After 14 days, search "${brandName} reviews" — Google may surface star snippet',
          ],
          timeline: '7-14 days for rich snippets. Compound effect across AI engines: 30+ days.',
          pitfalls: [
            'Do NOT fabricate ratings or use fake authors — Google penalises and downstream AI loses trust',
            'Source reviews from real customers (Google Business Profile, Trustpilot, industry directory)',
            'Display matching reviews on the actual page (schema-only without visible content gets stripped)',
          ],
        };

      case 'hasLlmsTxt':
        return {
          why: '/llms.txt is the new robots.txt for AI crawlers. It tells ChatGPT/Claude/Perplexity exactly which content to prioritise when answering questions about your brand. Brands with llms.txt get cited 3-5x more often per crawl.',
          codeBlocks: [
            {
              label: 'Upload to yourdomain.com/llms.txt',
              language: 'markdown',
              content: `# ${brandName}

> One-sentence positioning statement. What you do, for whom, where.

## About

Concise 3-4 sentence overview. Include category, founding year, scale (clients/markets/team size).

## Products & Services

- [Service or product 1](${site}/service-1) — one-line description
- [Service or product 2](${site}/service-2) — one-line description
- [Pricing](${site}/pricing)

## Key Content

- [Customer success stories](${site}/case-studies)
- [Help docs / FAQs](${site}/faq)
- [Blog / Insights](${site}/blog)

## Contact

- Email: hello@yourdomain.com
- Phone: +XXX-XXX-XXXX
- Address: City, Country

## Optional

- [Press kit](${site}/press)
- [Privacy policy](${site}/privacy)`,
            },
          ],
          verifySteps: [
            `curl ${site}/llms.txt  → should return 200 with the markdown content`,
            'Check the file renders correctly in browser at the URL above',
            'Add a link to it from your robots.txt: `Sitemap: ${site}/llms.txt`',
          ],
          timeline: 'Indexed by AI crawlers within 1-7 days. Citation lift visible in 30-60 day re-scans.',
          pitfalls: [
            'File MUST be at the root, not /docs/llms.txt or /assets/llms.txt',
            'Keep it under 5000 words — overlong files get truncated by crawlers',
            'Use real, working internal links — broken links degrade the file\'s authority signal',
          ],
          resources: [{ label: 'llmstxt.org spec', url: 'https://llmstxt.org' }],
        };

      case 'allowsGPTBot':
        return {
          why: 'GPTBot is OpenAI\'s crawler. If you block it (default for many WordPress/Webflow sites), your content NEVER reaches ChatGPT\'s training or browsing. You are invisible to the largest AI search audience.',
          codeBlocks: [
            {
              label: 'Add to robots.txt (replace any existing GPTBot block)',
              language: 'text',
              content: `User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /`,
            },
          ],
          verifySteps: [
            `curl ${site}/robots.txt | grep -i GPTBot  → must show "Allow: /" (not "Disallow")`,
            'Test crawl access via https://www.opal.dev/robots-txt-tester',
            'Wait 14 days, re-run scan — citations from chatgpt-style should appear',
          ],
          timeline: '15 minutes to ship. ChatGPT picks up within 7-14 days. Visibility shift in 30-60 days.',
          pitfalls: [
            'Some CDNs (Cloudflare) override robots.txt with their own AI-bot blocking — check Cloudflare > Security > Bots > AI Scrapers',
            'WordPress security plugins (Wordfence, etc) sometimes block AI bots by user-agent — disable AI-bot blocking rules',
          ],
        };

      case 'allowsAnthropic':
        return {
          why: 'ClaudeBot indexes for Claude (Anthropic). Many enterprises use Claude via API — if blocked, you miss B2B AI-driven discovery.',
          codeBlocks: [
            {
              label: 'Add to robots.txt',
              language: 'text',
              content: `User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Claude-Web
Allow: /`,
            },
          ],
          verifySteps: [
            `curl ${site}/robots.txt | grep -i Claude  → must show "Allow: /"`,
            'Wait 14 days, ask Claude.ai about your category — your brand should be recallable',
          ],
          timeline: 'Indexed within 14 days. Discovery lift in 30-60 days.',
          pitfalls: ['Same Cloudflare/WordPress caveats as GPTBot above'],
        };

      case 'hasSitemap':
        return {
          why: 'Sitemap.xml tells crawlers (AI + Google) every URL worth indexing. Without one, AI engines may miss your deep content (case studies, detailed product pages) — the exact pages that prove expertise.',
          codeBlocks: [
            {
              label: 'Minimal sitemap.xml',
              language: 'xml',
              content: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site}/</loc>
    <lastmod>2026-01-15</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${site}/about</loc>
    <lastmod>2026-01-15</lastmod>
    <priority>0.8</priority>
  </url>
  <!-- one <url> block per public page -->
</urlset>`,
            },
            {
              label: 'Reference in robots.txt',
              language: 'text',
              content: `Sitemap: ${site}/sitemap.xml`,
            },
          ],
          verifySteps: [
            `curl ${site}/sitemap.xml  → must return 200 with valid XML`,
            'Submit via https://search.google.com/search-console under your property',
            'Check Coverage report after 7 days — all URLs should show "Indexed"',
          ],
          timeline: 'Indexed in 3-14 days. AI crawler discovery follows Google indexing.',
          pitfalls: [
            'Most CMS platforms (WordPress/Webflow/Wix) generate sitemap.xml automatically — check before writing by hand',
            'Do NOT include redirect URLs, 404s, or noindex pages — they degrade crawl efficiency',
            'Keep under 50,000 URLs per file. For larger sites, use a sitemap index',
          ],
        };

      case 'hasMetaAndOg':
        return {
          why: 'Meta description + Open Graph tags are how every link to your site previews. AI engines pull these as the canonical "what this site is about" signal when they cite you.',
          codeBlocks: [
            {
              label: 'Add to <head> of every page',
              language: 'html',
              content: `<meta name="description" content="(150-160 char summary of this specific page — must be unique per page)">

<meta property="og:title" content="${escapedBrand} — page title">
<meta property="og:description" content="(same 150-160 char summary)">
<meta property="og:image" content="${site}/og-image-1200x630.jpg">
<meta property="og:url" content="${site}/this-page">
<meta property="og:type" content="website">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapedBrand} — page title">
<meta name="twitter:description" content="(same summary)">
<meta name="twitter:image" content="${site}/og-image-1200x630.jpg">`,
            },
          ],
          verifySteps: [
            'Validate Open Graph at https://opengraph.dev/ — paste your URL',
            'Test Twitter card at https://cards-dev.twitter.com/validator',
            'Test LinkedIn preview at https://www.linkedin.com/post-inspector/',
          ],
          timeline: 'Effects immediate. Cache refresh on social platforms: 24-48h.',
          pitfalls: [
            'og:image MUST be 1200×630px (recommended) and under 8MB',
            'Every page should have a UNIQUE meta description — duplicates hurt SEO',
            'og:url should be the canonical URL (not the current URL with tracking params)',
          ],
        };

      case 'hasArticle':
        return {
          why: 'Blog/article content is the long-tail of AI discovery. Each indexed article is a new entry point for AI engines to learn about your expertise. Brands with 50+ indexed articles get 3-5x more AI citations.',
          codeBlocks: [
            {
              label: 'Wrap each blog post with Article schema',
              language: 'html',
              content: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "(your article title — exact match to <h1>)",
  "image": ["${site}/articles/feature.jpg"],
  "datePublished": "2026-01-15T08:00:00+04:00",
  "dateModified": "2026-01-15T08:00:00+04:00",
  "author": [{
    "@type": "Person",
    "name": "Author Name",
    "url": "${site}/team/author-slug"
  }],
  "publisher": {
    "@type": "Organization",
    "name": "${escapedBrand}",
    "logo": { "@type": "ImageObject", "url": "${site}/logo.png" }
  }
}
</script>`,
            },
          ],
          verifySteps: [
            'Validate each article URL at https://search.google.com/test/rich-results',
            'Check Search Console > Enhancements > Articles for warnings',
            'Re-scan after 60 days — article-source citations should appear',
          ],
          timeline: 'Indexed in 1-7 days per article. Compound visibility lift in 60-120 days.',
          pitfalls: [
            'Author "Person" entities should have their own page (about/team) to satisfy E-E-A-T',
            'datePublished must be ISO 8601 with timezone',
            'Skipping the publisher.logo field strips you from Google News eligibility',
          ],
        };

      default:
        return undefined;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Action-completion tracking + brand progress (P1-7).
  // Stored under brands/{brandId}/actionCompletions/{actionId}.
  // ─────────────────────────────────────────────────────────────────────────
  async listCompletions(
    brandName: string,
  ): Promise<Record<string, { completed: boolean; updatedAt: string; notes?: string }>> {
    const brandId = await this.brandIdByName(brandName);
    if (!brandId) return {};
    const snap = await this.firebase.actionCompletions(brandId).get();
    const out: Record<string, { completed: boolean; updatedAt: string; notes?: string }> = {};
    snap.forEach((d) => {
      const data = d.data() as { completed: boolean; updatedAt?: { toDate?: () => Date }; notes?: string };
      out[d.id] = {
        completed: !!data.completed,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
        notes: data.notes,
      };
    });
    return out;
  }

  async setCompletion(
    brandName: string,
    actionId: string,
    completed: boolean,
    notes?: string,
  ): Promise<{ ok: true; actionId: string; completed: boolean }> {
    const brandId = await this.brandIdByName(brandName);
    if (!brandId) throw new NotFoundException(`Brand "${brandName}" not found`);
    const ref = this.firebase.actionCompletions(brandId).doc(actionId);
    await ref.set(
      {
        completed,
        notes: notes ?? null,
        updatedAt: this.firebase.now(),
      },
      { merge: true },
    );
    return { ok: true, actionId, completed };
  }

  async brandProgress(brandName: string): Promise<{
    brand: string;
    snapshots: Array<{
      date: string;
      realMentionRate: number | null;
      echoMentionRate: number | null;
      mentionRate: number | null;
      brandPresenceScore: number | null;
      auditScorePct: number | null;
      onPageAvgScore: number | null;
    }>;
    deltas: {
      realMentionRate: number | null;
      brandPresenceScore: number | null;
      auditScorePct: number | null;
      onPageAvgScore: number | null;
    };
    actionsTotal: number;
    actionsCompleted: number;
  }> {
    const brandId = await this.brandIdByName(brandName);
    if (!brandId) throw new NotFoundException(`Brand "${brandName}" not found`);

    const [scanSnaps, audits, presence, onPage, completions] = await Promise.all([
      this.firebase.scans(brandId).orderBy('createdAt', 'desc').limit(10).get(),
      this.firebase.competitorAuditScans(brandId).orderBy('createdAt', 'desc').limit(10).get(),
      this.firebase.brandPresenceReports(brandId).orderBy('createdAt', 'desc').limit(10).get(),
      this.firebase.onPageSeoReports(brandId).orderBy('createdAt', 'desc').limit(10).get(),
      this.firebase.actionCompletions(brandId).get(),
    ]);

    const snapshots: Array<{
      date: string;
      realMentionRate: number | null;
      echoMentionRate: number | null;
      mentionRate: number | null;
      brandPresenceScore: number | null;
      auditScorePct: number | null;
      onPageAvgScore: number | null;
    }> = [];

    // Anchor on AI scans (the freshness signal). Pair with the audit/presence/onPage
    // doc closest in time per snapshot.
    for (const doc of scanSnaps.docs) {
      const data = doc.data() as Scan;
      if (data.status !== 'done') continue;
      const scanId = doc.id;
      const resultsSnap = await this.firebase.results(brandId, scanId).get();
      const results = resultsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ScanResult,
      );
      const real = results.filter(
        (r) => !GeoActionsService.ECHO_TEMPLATE_IDS.has(r.templateId ?? ''),
      );
      const echo = results.filter((r) =>
        GeoActionsService.ECHO_TEMPLATE_IDS.has(r.templateId ?? ''),
      );
      const realRate = real.length
        ? Math.round((real.filter((r) => r.mentioned).length / real.length) * 100)
        : null;
      const echoRate = echo.length
        ? Math.round((echo.filter((r) => r.mentioned).length / echo.length) * 100)
        : null;
      const overallRate = results.length
        ? Math.round((results.filter((r) => r.mentioned).length / results.length) * 100)
        : null;

      const createdAt = (data as { createdAt?: { toDate?: () => Date } }).createdAt
        ?.toDate?.()
        ?.toISOString() ?? new Date().toISOString();

      snapshots.push({
        date: createdAt,
        realMentionRate: realRate,
        echoMentionRate: echoRate,
        mentionRate: overallRate,
        brandPresenceScore: null,
        auditScorePct: null,
        onPageAvgScore: null,
      });
      if (snapshots.length >= 8) break;
    }

    // Pair latest audit / presence / onPage values into the most recent snapshot
    if (snapshots.length > 0) {
      const latestAudit = audits.docs.find((d) => (d.data() as { status?: string }).status === 'done');
      if (latestAudit) {
        const a = latestAudit.data() as { brandAudit?: { score?: number; scoreOutOf?: number } };
        if (a.brandAudit && a.brandAudit.scoreOutOf) {
          snapshots[0].auditScorePct = Math.round(
            (a.brandAudit.score! / a.brandAudit.scoreOutOf) * 100,
          );
        }
      }
      const latestPresence = presence.docs.find((d) => (d.data() as { status?: string }).status === 'done');
      if (latestPresence) {
        const p = latestPresence.data() as { brandCheck?: { presenceScore?: number } };
        snapshots[0].brandPresenceScore = p.brandCheck?.presenceScore ?? null;
      }
      const latestOnPage = onPage.docs.find((d) => (d.data() as { status?: string }).status === 'done');
      if (latestOnPage) {
        const o = latestOnPage.data() as { summary?: { avgScore?: number } };
        snapshots[0].onPageAvgScore = o.summary?.avgScore ?? null;
      }
    }

    const deltas = {
      realMentionRate: pairDelta(snapshots, 'realMentionRate'),
      brandPresenceScore: pairDelta(snapshots, 'brandPresenceScore'),
      auditScorePct: pairDelta(snapshots, 'auditScorePct'),
      onPageAvgScore: pairDelta(snapshots, 'onPageAvgScore'),
    };

    let actionsCompleted = 0;
    completions.forEach((d) => {
      if ((d.data() as { completed?: boolean }).completed) actionsCompleted += 1;
    });

    return {
      brand: brandName,
      snapshots,
      deltas,
      actionsTotal: completions.size,
      actionsCompleted,
    };
  }

  async brandBenchmark(brandName: string): Promise<{
    brand: string;
    metrics: Array<{
      key: string;
      label: string;
      unit: string;
      higherIsBetter: boolean;
      yours: number | null;
      topCompetitor: { name: string; value: number } | null;
      median: number | null;
      gapVsMedian: number | null;
      verdict: 'leader' | 'parity' | 'behind' | 'critical' | 'unknown';
    }>;
  }> {
    const brandId = await this.brandIdByName(brandName);
    if (!brandId) throw new NotFoundException(`Brand "${brandName}" not found`);

    const auditSnap = await this.firebase
      .competitorAuditScans(brandId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    let latestAudit: CompetitorAuditScan | null = null;
    for (const d of auditSnap.docs) {
      const data = d.data() as CompetitorAuditScan;
      if (data.status === 'done') {
        latestAudit = { id: d.id, ...data };
        break;
      }
    }

    const presenceSnap = await this.firebase
      .brandPresenceReports(brandId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    let latestPresence: BrandPresenceReport | null = null;
    for (const d of presenceSnap.docs) {
      const data = d.data() as BrandPresenceReport;
      if (data.status === 'done') {
        latestPresence = { id: d.id, ...data };
        break;
      }
    }

    const metrics: Array<{
      key: string;
      label: string;
      unit: string;
      higherIsBetter: boolean;
      yours: number | null;
      topCompetitor: { name: string; value: number } | null;
      median: number | null;
      gapVsMedian: number | null;
      verdict: 'leader' | 'parity' | 'behind' | 'critical' | 'unknown';
    }> = [];

    // Audit score
    if (latestAudit && latestAudit.brandAudit && latestAudit.competitorAudits) {
      const yourPct =
        latestAudit.brandAudit.scoreOutOf > 0
          ? Math.round(
              (latestAudit.brandAudit.score / latestAudit.brandAudit.scoreOutOf) * 100,
            )
          : null;
      const compPcts = latestAudit.competitorAudits
        .filter((c) => c.scoreOutOf > 0)
        .map((c) => ({
          name: c.name,
          value: Math.round((c.score / c.scoreOutOf) * 100),
        }));
      const sorted = [...compPcts].sort((a, b) => b.value - a.value);
      const top = sorted[0] ?? null;
      const median = compPcts.length ? medianOf(compPcts.map((c) => c.value)) : null;
      metrics.push({
        key: 'audit',
        label: 'AI-readiness audit',
        unit: '%',
        higherIsBetter: true,
        yours: yourPct,
        topCompetitor: top,
        median,
        gapVsMedian:
          yourPct !== null && median !== null ? yourPct - median : null,
        verdict: verdictFor(yourPct, median, top?.value, true),
      });
    }

    // Brand presence
    if (latestPresence && latestPresence.brandCheck && latestPresence.competitorChecks) {
      const yours = latestPresence.brandCheck.presenceScore ?? null;
      const compScores = latestPresence.competitorChecks.map((c) => ({
        name: c.name,
        value: c.presenceScore ?? 0,
      }));
      const sorted = [...compScores].sort((a, b) => b.value - a.value);
      const top = sorted[0] ?? null;
      const median = compScores.length ? medianOf(compScores.map((c) => c.value)) : null;
      metrics.push({
        key: 'presence',
        label: 'Brand presence (KP + Wikipedia)',
        unit: '/100',
        higherIsBetter: true,
        yours,
        topCompetitor: top,
        median,
        gapVsMedian: yours !== null && median !== null ? yours - median : null,
        verdict: verdictFor(yours, median, top?.value, true),
      });
    }

    return { brand: brandName, metrics };
  }

  async brandDigest(brandName: string): Promise<{
    brand: string;
    generatedAt: string;
    markdown: string;
  }> {
    const [report, progress, benchmark] = await Promise.all([
      this.generate(brandName).catch(() => null),
      this.brandProgress(brandName).catch(() => null),
      this.brandBenchmark(brandName).catch(() => null),
    ]);

    const lines: string[] = [];
    lines.push(`# ${brandName} — Weekly AI Visibility Digest`);
    lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
    lines.push('');

    if (progress) {
      lines.push('## Movement since first scan');
      const d = progress.deltas;
      const fmt = (n: number | null, suffix: string) =>
        n === null ? '—' : `${n > 0 ? '+' : ''}${n}${suffix}`;
      lines.push(`- Real visibility: ${fmt(d.realMentionRate, '%')}`);
      lines.push(`- Brand presence: ${fmt(d.brandPresenceScore, '/100')}`);
      lines.push(`- Audit score: ${fmt(d.auditScorePct, '%')}`);
      lines.push(`- On-page SEO: ${fmt(d.onPageAvgScore, '/100')}`);
      lines.push(
        `- Actions completed: ${progress.actionsCompleted}/${progress.actionsTotal}`,
      );
      lines.push('');
    }

    if (benchmark && benchmark.metrics.length > 0) {
      lines.push('## Where you stand vs competitors');
      for (const m of benchmark.metrics) {
        const yourStr = m.yours !== null ? `${m.yours}${m.unit}` : '—';
        const topStr = m.topCompetitor
          ? `${m.topCompetitor.value}${m.unit} (${m.topCompetitor.name})`
          : '—';
        const medianStr = m.median !== null ? `${m.median}${m.unit}` : '—';
        lines.push(
          `- ${m.label}: you ${yourStr} | top ${topStr} | median ${medianStr} — ${m.verdict}`,
        );
      }
      lines.push('');
    }

    if (report) {
      const critical = report.actions.filter((a) => a.priority === 'critical');
      const high = report.actions.filter((a) => a.priority === 'high');
      if (critical.length > 0) {
        lines.push('## Critical — fix this week');
        for (const a of critical.slice(0, 5)) {
          lines.push(`### ${a.title}`);
          lines.push(`- ${a.description}`);
          lines.push(`- Effort: ${a.effort}`);
          lines.push(`- Expected: ${a.expectedImpact}`);
          lines.push('');
        }
      }
      if (high.length > 0) {
        lines.push('## High — next 2 weeks');
        for (const a of high.slice(0, 5)) {
          lines.push(`- **${a.title}** (${a.effort}) — ${a.description}`);
        }
        lines.push('');
      }
      const counts = report.summary.byPriority;
      lines.push('## Action queue summary');
      lines.push(
        `- ${counts.critical ?? 0} critical · ${counts.high ?? 0} high · ${counts.medium ?? 0} medium · ${counts.low ?? 0} low`,
      );
    }

    return {
      brand: brandName,
      generatedAt: new Date().toISOString(),
      markdown: lines.join('\n'),
    };
  }

  private async brandIdByName(brandName: string): Promise<string | null> {
    const snap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].id;
  }

  // Helper to avoid unused-var warning when types reference SiteAudit only structurally
  private _siteAuditMarker(_x?: SiteAudit, _y?: CompetitorGap): void {}
}

function pairDelta(
  snapshots: Array<Record<string, number | null | string>>,
  key: string,
): number | null {
  if (snapshots.length < 2) return null;
  const newest = snapshots[0][key];
  const previous = snapshots[snapshots.length - 1][key];
  if (typeof newest !== 'number' || typeof previous !== 'number') return null;
  return newest - previous;
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function verdictFor(
  yours: number | null,
  median: number | null,
  top: number | undefined,
  higherIsBetter: boolean,
): 'leader' | 'parity' | 'behind' | 'critical' | 'unknown' {
  if (yours === null || median === null) return 'unknown';
  if (higherIsBetter) {
    if (top !== undefined && yours >= top) return 'leader';
    if (yours >= median + 10) return 'leader';
    if (yours >= median - 5) return 'parity';
    if (yours >= median - 25) return 'behind';
    return 'critical';
  }
  if (yours <= median - 10) return 'leader';
  if (yours <= median + 5) return 'parity';
  if (yours <= median + 25) return 'behind';
  return 'critical';
}
