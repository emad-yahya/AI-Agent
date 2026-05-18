import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  AiBotAccess,
  CompetitorAuditScan,
  SiteAudit,
} from 'src/common/types';
import { SerperService } from 'src/seo/serper.service';
import { CreateCompetitorAuditDto } from './dto';

const FETCH_TIMEOUT_MS = 12000;
const AUDIT_CONCURRENCY = 3;
const SIGNAL_RUBRIC: Array<{ key: string; label: string }> = [
  { key: 'orgOrLocalBiz', label: 'Organization or LocalBusiness schema' },
  { key: 'hasFAQ', label: 'FAQ schema' },
  { key: 'hasReview', label: 'Review / AggregateRating schema' },
  { key: 'hasBreadcrumb', label: 'Breadcrumb schema' },
  { key: 'hasArticle', label: 'Article / BlogPosting schema' },
  { key: 'hasLlmsTxt', label: '/llms.txt file present' },
  { key: 'allowsGPTBot', label: 'robots.txt allows GPTBot (ChatGPT)' },
  { key: 'allowsAnthropic', label: 'robots.txt allows ClaudeBot / anthropic-ai' },
  { key: 'hasSitemap', label: '/sitemap.xml present' },
  { key: 'hasMetaAndOg', label: 'Meta description + Open Graph tags' },
];
const SIGNAL_MAX = SIGNAL_RUBRIC.length;

interface AiBotPolicy {
  blocked: boolean;
  allowedExplicit: boolean;
}

@Injectable()
export class CompetitorAuditService {
  private readonly logger = new Logger(CompetitorAuditService.name);

  constructor(
    private firebase: FirebaseService,
    private serper: SerperService,
  ) {}

  async createScan(dto: CreateCompetitorAuditDto) {
    const brandRef = await this.getOrCreateBrand(dto.brand);
    const brandId = brandRef.id;
    const scanRef = this.firebase.competitorAuditScans(brandId).doc();
    const scanId = scanRef.id;

    const brandDomain = this.normalizeDomain(dto.brandDomain);

    await scanRef.set({
      brandId,
      brand: dto.brand,
      brandDomain,
      status: 'running',
      createdAt: this.firebase.now(),
    } as CompetitorAuditScan);

    this.logger.log(
      `Competitor audit ${scanId} started for ${dto.brand} (${brandDomain}) vs ${dto.competitors.length} competitors`,
    );

    void this.runInBackground(brandId, scanId, dto, brandDomain);

    return { scanId, brandId };
  }

  private async runInBackground(
    brandId: string,
    scanId: string,
    dto: CreateCompetitorAuditDto,
    brandDomain: string,
  ) {
    const scanRef = this.firebase.competitorAuditScans(brandId).doc(scanId);
    try {
      const competitorDomains = await this.resolveDomains(
        dto.competitors,
        dto.country,
      );

      const allTargets: Array<{ name: string; domain: string }> = [
        { name: dto.brand, domain: brandDomain },
        ...competitorDomains,
      ];

      const audits: SiteAudit[] = [];
      for (let i = 0; i < allTargets.length; i += AUDIT_CONCURRENCY) {
        const batch = allTargets.slice(i, i + AUDIT_CONCURRENCY);
        const settled = await Promise.allSettled(
          batch.map(({ name, domain }) =>
            this.auditSite(name, domain, dto.country),
          ),
        );
        for (const r of settled) {
          if (r.status === 'fulfilled') audits.push(r.value);
        }
      }

      const brandAudit = audits.find((a) => a.domain === brandDomain) ?? null;
      const competitorAudits = audits.filter((a) => a.domain !== brandDomain);
      const gapSummary = this.buildGapSummary(brandAudit, competitorAudits);

      await scanRef.update({
        status: 'done',
        completedAt: this.firebase.now(),
        ...(brandAudit ? { brandAudit } : {}),
        competitorAudits,
        gapSummary,
      });

      this.logger.log(
        `Competitor audit ${scanId} done. Brand score ${brandAudit?.score ?? 0}/${SIGNAL_MAX}`,
      );
    } catch (err) {
      await scanRef.update({ status: 'failed' });
      this.logger.error(
        `Competitor audit ${scanId} failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Turns inputs that may be either bare domains or brand names into
   * { name, domain } pairs. Names go through Serper to find the most likely
   * official domain (first organic result). Inputs containing a dot are
   * treated as domains directly.
   */
  private async resolveDomains(
    inputs: string[],
    country?: string,
  ): Promise<Array<{ name: string; domain: string }>> {
    const out: Array<{ name: string; domain: string }> = [];
    for (const input of inputs) {
      const trimmed = input.trim();
      if (!trimmed) continue;
      if (this.looksLikeDomain(trimmed)) {
        out.push({ name: trimmed, domain: this.normalizeDomain(trimmed) });
        continue;
      }
      const domain = await this.searchDomainForName(trimmed, country);
      if (domain) out.push({ name: trimmed, domain });
    }
    return out;
  }

  private looksLikeDomain(s: string): boolean {
    return /^[a-z0-9][a-z0-9\-.]+\.[a-z]{2,}/i.test(s) || s.includes('://');
  }

  private async searchDomainForName(
    name: string,
    country?: string,
  ): Promise<string | null> {
    const res = await this.serper.search(`${name} official website`, {
      country: country ?? 'us',
      num: 5,
    });
    const organic = res?.organic ?? [];
    for (const item of organic) {
      if (!item.link) continue;
      const domain = this.serper.extractDomain(item.link);
      // Skip directory aggregators when looking for "official"
      if (this.isAggregator(domain)) continue;
      return domain;
    }
    return null;
  }

  private static readonly AGGREGATOR_DOMAINS = new Set([
    'wikipedia.org',
    'linkedin.com',
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'youtube.com',
    'yelp.com',
    'tripadvisor.com',
    'crunchbase.com',
    'glassdoor.com',
  ]);

  private isAggregator(domain: string): boolean {
    return CompetitorAuditService.AGGREGATOR_DOMAINS.has(domain);
  }

  normalizeDomain(input: string): string {
    let raw = input.trim().toLowerCase();
    raw = raw.replace(/^https?:\/\//, '').replace(/^www\./, '');
    raw = raw.split('/')[0];
    return raw;
  }

  /**
   * Audits a single site:
   *  - GET https://{domain}/ → parse JSON-LD types, meta, OG
   *  - GET /llms.txt, /robots.txt, /sitemap.xml → presence
   *  - robots.txt parsed for AI-bot allow/disallow rules
   *  - Serper site: query → indexed pages estimate
   */
  private async auditSite(
    name: string,
    domain: string,
    country?: string,
  ): Promise<SiteAudit> {
    const baseUrl = `https://${domain}`;
    const home = await this.tryFetchText(baseUrl);
    const llmsTxt = await this.tryFetchText(`${baseUrl}/llms.txt`);
    const robotsTxt = await this.tryFetchText(`${baseUrl}/robots.txt`);
    const sitemap = await this.tryFetchText(`${baseUrl}/sitemap.xml`);

    if (!home) {
      return this.unreachableAudit(name, domain, baseUrl);
    }

    const homeAnalysis = this.parseHomepage(home);
    const aiBots = this.parseAiBotPolicy(robotsTxt ?? '');
    const indexedPages = await this.estimateIndexedPages(domain, country);

    const signals = this.computeSignals(homeAnalysis, {
      hasLlmsTxt: Boolean(llmsTxt),
      hasSitemap: Boolean(sitemap),
      aiBots,
    });
    const score = signals.filter((s) => s.passed).length;

    return {
      name,
      domain,
      url: baseUrl,
      status: 'ok',
      schemas: homeAnalysis.schemas,
      hasOrganization: homeAnalysis.hasOrganization,
      hasLocalBusiness: homeAnalysis.hasLocalBusiness,
      hasFAQ: homeAnalysis.hasFAQ,
      hasReview: homeAnalysis.hasReview,
      hasBreadcrumb: homeAnalysis.hasBreadcrumb,
      hasArticle: homeAnalysis.hasArticle,
      hasLlmsTxt: Boolean(llmsTxt),
      hasSitemap: Boolean(sitemap),
      hasRobotsTxt: Boolean(robotsTxt),
      aiBots,
      hasMetaDescription: homeAnalysis.hasMetaDescription,
      hasOgTags: homeAnalysis.hasOgTags,
      indexedPages,
      score,
      scoreOutOf: SIGNAL_MAX,
      signals,
    };
  }

  private unreachableAudit(
    name: string,
    domain: string,
    baseUrl: string,
  ): SiteAudit {
    const emptyBots: AiBotAccess = {
      GPTBot: false,
      ChatGPTUser: false,
      ClaudeBot: false,
      AnthropicAI: false,
      GoogleExtended: false,
      PerplexityBot: false,
      CCBot: false,
      AppleBotExtended: false,
    };
    return {
      name,
      domain,
      url: baseUrl,
      status: 'unreachable',
      schemas: [],
      hasOrganization: false,
      hasLocalBusiness: false,
      hasFAQ: false,
      hasReview: false,
      hasBreadcrumb: false,
      hasArticle: false,
      hasLlmsTxt: false,
      hasSitemap: false,
      hasRobotsTxt: false,
      aiBots: emptyBots,
      hasMetaDescription: false,
      hasOgTags: false,
      indexedPages: null,
      score: 0,
      scoreOutOf: SIGNAL_MAX,
      signals: SIGNAL_RUBRIC.map((s) => ({ ...s, passed: false })),
    };
  }

  private async tryFetchText(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; AIVisibilityBot/1.0; +https://aivisibility.local)',
          Accept: '*/*',
        },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseHomepage(html: string): {
    schemas: string[];
    hasOrganization: boolean;
    hasLocalBusiness: boolean;
    hasFAQ: boolean;
    hasReview: boolean;
    hasBreadcrumb: boolean;
    hasArticle: boolean;
    hasMetaDescription: boolean;
    hasOgTags: boolean;
  } {
    const $ = cheerio.load(html);
    const schemas = new Set<string>();
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text().trim();
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        this.collectSchemaTypes(parsed, schemas);
      } catch {
        // ignore malformed JSON-LD blocks
      }
    });

    const types = [...schemas];
    const has = (t: string) =>
      types.some((s) => s.toLowerCase() === t.toLowerCase());

    const hasMetaDescription = $('meta[name="description"]').attr('content')
      ? true
      : false;
    const hasOgTitle = Boolean($('meta[property="og:title"]').attr('content'));
    const hasOgDescription = Boolean(
      $('meta[property="og:description"]').attr('content'),
    );

    return {
      schemas: types,
      hasOrganization: has('Organization'),
      hasLocalBusiness:
        has('LocalBusiness') ||
        types.some((t) => /Business|Store|Restaurant|RealEstateAgent/i.test(t)),
      hasFAQ: has('FAQPage'),
      hasReview: has('Review') || has('AggregateRating'),
      hasBreadcrumb: has('BreadcrumbList'),
      hasArticle:
        has('Article') || has('BlogPosting') || has('NewsArticle'),
      hasMetaDescription,
      hasOgTags: hasOgTitle && hasOgDescription,
    };
  }

  private collectSchemaTypes(node: unknown, out: Set<string>): void {
    if (Array.isArray(node)) {
      for (const item of node) this.collectSchemaTypes(item, out);
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const t = obj['@type'];
      if (typeof t === 'string') out.add(t);
      else if (Array.isArray(t)) {
        for (const v of t) if (typeof v === 'string') out.add(v);
      }
      // Recurse into @graph and other nested arrays/objects
      for (const v of Object.values(obj)) this.collectSchemaTypes(v, out);
    }
  }

  /**
   * Parses robots.txt into per-AI-bot allow/disallow. Returns "allowed" if:
   *  - Bot has its own section that does not Disallow: /
   *  - OR no section exists for the bot and global User-agent: * does not block /
   */
  private parseAiBotPolicy(robotsTxt: string): AiBotAccess {
    const groups = this.parseRobotsGroups(robotsTxt);
    const wildcardPolicy = this.policyFor(groups, '*');
    const check = (bot: string): boolean => {
      const own = this.policyFor(groups, bot.toLowerCase());
      if (own.allowedExplicit || own.blocked) return !own.blocked;
      return !wildcardPolicy.blocked;
    };
    return {
      GPTBot: check('GPTBot'),
      ChatGPTUser: check('ChatGPT-User'),
      ClaudeBot: check('ClaudeBot'),
      AnthropicAI: check('anthropic-ai'),
      GoogleExtended: check('Google-Extended'),
      PerplexityBot: check('PerplexityBot'),
      CCBot: check('CCBot'),
      AppleBotExtended: check('Applebot-Extended'),
    };
  }

  private parseRobotsGroups(
    robotsTxt: string,
  ): Map<string, { disallows: string[]; allows: string[] }> {
    const groups = new Map<string, { disallows: string[]; allows: string[] }>();
    if (!robotsTxt) return groups;
    const lines = robotsTxt.split(/\r?\n/);
    let currentAgents: string[] = [];
    let justSetAgent = false;
    for (const rawLine of lines) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;
      const sep = line.indexOf(':');
      if (sep === -1) continue;
      const key = line.slice(0, sep).trim().toLowerCase();
      const value = line.slice(sep + 1).trim();
      if (key === 'user-agent') {
        const agentLower = value.toLowerCase();
        if (!groups.has(agentLower)) {
          groups.set(agentLower, { disallows: [], allows: [] });
        }
        // Stacked User-agent lines (e.g. two in a row) share the next rules block.
        if (justSetAgent) {
          currentAgents.push(agentLower);
        } else {
          currentAgents = [agentLower];
        }
        justSetAgent = true;
      } else if (key === 'disallow' || key === 'allow') {
        justSetAgent = false;
        for (const agent of currentAgents) {
          const g = groups.get(agent);
          if (!g) continue;
          if (key === 'disallow') g.disallows.push(value);
          else g.allows.push(value);
        }
      }
    }
    return groups;
  }

  private policyFor(
    groups: Map<string, { disallows: string[]; allows: string[] }>,
    agent: string,
  ): AiBotPolicy {
    const g = groups.get(agent);
    if (!g) return { blocked: false, allowedExplicit: false };
    // Any explicit "Allow: /" or "Disallow:" (empty) signals allowed
    const allowedExplicit =
      g.allows.includes('/') || g.disallows.some((d) => d === '');
    const blocked = g.disallows.some((d) => d === '/');
    return { blocked, allowedExplicit };
  }

  private async estimateIndexedPages(
    domain: string,
    country?: string,
  ): Promise<number | null> {
    if (!this.serper.isConfigured()) return null;
    const res = await this.serper.search(`site:${domain}`, {
      country: country ?? 'us',
      num: 10,
    });
    if (!res) return null;
    // Serper does not return total count directly; approximate via organic length
    // (capped at num=10). Real estimate requires Google search API; this is a
    // signal-only "has any indexed pages" measure with rough magnitude.
    return res.organic?.length ?? 0;
  }

  private computeSignals(
    home: {
      hasOrganization: boolean;
      hasLocalBusiness: boolean;
      hasFAQ: boolean;
      hasReview: boolean;
      hasBreadcrumb: boolean;
      hasArticle: boolean;
      hasMetaDescription: boolean;
      hasOgTags: boolean;
    },
    extras: {
      hasLlmsTxt: boolean;
      hasSitemap: boolean;
      aiBots: AiBotAccess;
    },
  ): Array<{ key: string; label: string; passed: boolean }> {
    const checks: Record<string, boolean> = {
      orgOrLocalBiz: home.hasOrganization || home.hasLocalBusiness,
      hasFAQ: home.hasFAQ,
      hasReview: home.hasReview,
      hasBreadcrumb: home.hasBreadcrumb,
      hasArticle: home.hasArticle,
      hasLlmsTxt: extras.hasLlmsTxt,
      allowsGPTBot: extras.aiBots.GPTBot,
      allowsAnthropic: extras.aiBots.ClaudeBot || extras.aiBots.AnthropicAI,
      hasSitemap: extras.hasSitemap,
      hasMetaAndOg: home.hasMetaDescription && home.hasOgTags,
    };
    return SIGNAL_RUBRIC.map(({ key, label }) => ({
      key,
      label,
      passed: Boolean(checks[key]),
    }));
  }

  private buildGapSummary(
    brand: SiteAudit | null,
    competitors: SiteAudit[],
  ): CompetitorAuditScan['gapSummary'] {
    return SIGNAL_RUBRIC.map(({ key, label }) => {
      const yourStatus = brand
        ? Boolean(brand.signals.find((s) => s.key === key)?.passed)
        : false;
      const competitorsWithIt = competitors.filter((c) =>
        c.signals.find((s) => s.key === key && s.passed),
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

  async getScan(brandId: string, scanId: string): Promise<CompetitorAuditScan> {
    const doc = await this.firebase
      .competitorAuditScans(brandId)
      .doc(scanId)
      .get();
    if (!doc.exists) {
      throw new NotFoundException(`Competitor audit ${scanId} not found`);
    }
    return { id: doc.id, ...(doc.data() as CompetitorAuditScan) };
  }

  async listScans(brandName: string): Promise<CompetitorAuditScan[]> {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();
    if (brandSnap.empty) return [];
    const brandId = brandSnap.docs[0].id;
    const snap = await this.firebase
      .competitorAuditScans(brandId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as CompetitorAuditScan) }),
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
