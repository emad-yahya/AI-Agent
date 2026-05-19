import { Injectable, Logger } from '@nestjs/common';
import { AIService } from 'src/ai/ai.service';
import { CrawlerService } from 'src/seo/crawler.service';
import { SerperService } from 'src/seo/serper.service';
import { ScansService } from 'src/scans/scans.service';
import { CompetitorAuditService } from 'src/competitor-audit/competitor-audit.service';
import { BrandPresenceService } from 'src/brand-presence/brand-presence.service';
import { OnPageSeoService } from 'src/on-page-seo/on-page-seo.service';
import { AnalyzeSiteDto, StartOnboardingDto } from './dto';

const CATEGORY_HINT_PATTERNS: Array<{ re: RegExp; category: string }> = [
  { re: /real ?estate|property|broker|realtor/i, category: 'real estate' },
  { re: /law(yer)?|attorney|legal/i, category: 'legal services' },
  { re: /dentist|dental|orthodont/i, category: 'dental services' },
  { re: /restaurant|cafe|menu|cuisine/i, category: 'restaurant' },
  { re: /hotel|resort|stay|booking/i, category: 'hospitality' },
  { re: /software|saas|platform|api/i, category: 'software / SaaS' },
  { re: /ecommerce|shop|store|buy/i, category: 'ecommerce' },
  { re: /clinic|hospital|doctor|medical/i, category: 'healthcare' },
  { re: /agency|marketing|advertising/i, category: 'marketing agency' },
  { re: /school|university|education|course/i, category: 'education' },
  { re: /fitness|gym|workout/i, category: 'fitness' },
  { re: /consult(ing|ant)/i, category: 'consulting' },
];

const COUNTRY_TLD_HINTS: Record<string, string> = {
  ae: 'ae',
  sa: 'sa',
  uk: 'gb',
  de: 'de',
  fr: 'fr',
  it: 'it',
  es: 'es',
  jp: 'jp',
  in: 'in',
  au: 'au',
  ca: 'ca',
};

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private ai: AIService,
    private crawler: CrawlerService,
    private serper: SerperService,
    private scans: ScansService,
    private competitorAudit: CompetitorAuditService,
    private brandPresence: BrandPresenceService,
    private onPageSeo: OnPageSeoService,
  ) {}

  async analyze(dto: AnalyzeSiteDto) {
    const domain = this.normalizeDomain(dto.domain);
    const country = dto.country ?? this.guessCountry(domain) ?? 'us';

    let brand = this.guessBrandFromDomain(domain);
    let category: string | null = null;
    let keywords: string[] = [];
    let crawlError: string | null = null;

    try {
      const crawl = await this.crawler.crawl(`https://${domain}`);
      const title = crawl.page.title || '';
      const desc = crawl.page.description || '';
      const h1Joined = crawl.page.h1.join(' ');
      keywords = crawl.keywords.slice(0, 12);

      // Detect anti-bot pages (captcha, cloudflare challenge, "verify human") — they
      // poison brand/category guesses if treated as real homepages.
      const blockedSignal = /captcha|verify (you are|that you)|cloudflare|access denied|forbidden|are you a robot/i;
      const looksBlocked =
        blockedSignal.test(title) || blockedSignal.test(h1Joined);
      if (looksBlocked) {
        crawlError = `Anti-bot / captcha page detected — using domain-only guess`;
      } else {
        // Brand guess from <title> (strip common suffixes like " | Best Real Estate")
        if (title) {
          const titleBrand = title.split(/[|\-–—]/)[0].trim();
          if (titleBrand && titleBrand.length >= 2 && titleBrand.length <= 80) {
            brand = titleBrand;
          }
        }
        const corpus = `${title} ${desc} ${h1Joined} ${keywords.join(' ')}`;
        category = this.guessCategory(corpus);
      }
    } catch (err) {
      crawlError = (err as Error).message;
      this.logger.warn(`Onboarding crawl failed for ${domain}: ${crawlError}`);
    }

    const suggestedCompetitors = await this.suggestCompetitors(
      domain,
      brand,
      category,
      country,
    );

    return {
      domain,
      brand,
      category,
      country,
      keywords,
      suggestedCompetitors,
      crawlError,
    };
  }

  async start(dto: StartOnboardingDto) {
    const country = dto.country ?? 'us';
    const domain = this.normalizeDomain(dto.domain);
    const results = await Promise.allSettled([
      this.scans.createScan({
        brand: dto.brand,
        category: dto.category,
        mode: 'quick',
      }),
      this.competitorAudit.createScan({
        brand: dto.brand,
        brandDomain: domain,
        competitors: dto.competitors,
        country,
      }),
      this.brandPresence.createReport({
        brand: dto.brand,
        competitors: dto.competitors,
        country,
      }),
      this.onPageSeo.createScan({ brand: dto.brand, domain }),
    ]);

    return {
      aiScan: this.settled(results[0]),
      competitorAudit: this.settled(results[1]),
      brandPresence: this.settled(results[2]),
      onPageSeo: this.settled(results[3]),
    };
  }

  private settled<T>(r: PromiseSettledResult<T>): { ok: boolean; data?: T; error?: string } {
    if (r.status === 'fulfilled') return { ok: true, data: r.value };
    return { ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) };
  }

  private async suggestCompetitors(
    domain: string,
    brand: string,
    category: string | null,
    country: string,
  ): Promise<string[]> {
    // Primary: Gemini grounded — returns BRAND NAMES (actual competitors,
    // not article hosts). Map each name to a domain via Serper.
    const geminiBrands = await this.ai.findCompetitorBrandsViaGemini(
      brand,
      category,
      country,
    );
    if (geminiBrands.length > 0 && this.serper.isConfigured()) {
      const resolved = await this.resolveBrandsToDomains(
        geminiBrands,
        domain,
        country,
      );
      if (resolved.length >= 3) return resolved.slice(0, 8);
      this.logger.warn(
        `Gemini gave ${geminiBrands.length} brands but only ${resolved.length} resolved — falling back to Serper discovery`,
      );
    }

    // Fallback: Serper organic-host extraction (returns sites that RANK for
    // category queries — may include directories, but better than nothing).
    if (!this.serper.isConfigured()) return [];
    return this.discoverCompetitorsViaSerper(domain, brand, category, country);
  }

  /**
   * Resolves brand NAMES to web domains via Serper. Uses the top organic
   * result for `"<brand>" official site` queries, then filters out the
   * brand's own domain and directory hosts.
   */
  private async resolveBrandsToDomains(
    brands: string[],
    selfDomain: string,
    country: string,
  ): Promise<string[]> {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const b of brands) {
      const d = await this.brandNameToDomain(b, selfDomain, country);
      if (!d || seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
    return out;
  }

  private async brandNameToDomain(
    brandName: string,
    selfDomain: string,
    country: string,
  ): Promise<string | null> {
    try {
      const res = await this.serper.search(`"${brandName}" official site`, {
        country,
        num: 5,
      });
      const organic = res?.organic ?? [];
      for (const item of organic) {
        const d = this.serper.extractDomain(item.link);
        if (!d) continue;
        if (d === selfDomain || d.endsWith(`.${selfDomain}`)) continue;
        if (this.isDirectoryDomain(d)) continue;
        return d;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to resolve brand "${brandName}" to domain: ${(err as Error).message}`,
      );
    }
    return null;
  }

  private async discoverCompetitorsViaSerper(
    domain: string,
    brand: string,
    category: string | null,
    country: string,
  ): Promise<string[]> {
    const queries = [
      `top ${category ?? brand} in ${this.countryName(country)}`,
      `${brand} alternatives`,
      `best ${category ?? brand} companies`,
    ];

    const found = new Map<string, number>();
    for (const q of queries) {
      const res = await this.serper.search(q, { country, num: 10 });
      const organic = res?.organic ?? [];
      for (const item of organic) {
        const d = this.serper.extractDomain(item.link);
        if (!d) continue;
        if (d === domain || d.endsWith(`.${domain}`)) continue;
        if (this.isDirectoryDomain(d)) continue;
        found.set(d, (found.get(d) ?? 0) + 1);
      }
    }
    return [...found.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([d]) => d);
  }

  private static readonly DIRECTORY_DOMAINS = new Set([
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
    'reddit.com',
    'quora.com',
    'medium.com',
    'forbes.com',
    'g2.com',
    'capterra.com',
    'getapp.com',
    'getapp.ae',
    'indeed.com',
    'builtin.com',
    'builtinnyc.com',
    'businesschief.eu',
    'datamation.com',
    'topstartups.io',
    'seedtable.com',
    'naukrigulf.com',
    'lusha.com',
    'similarweb.com',
    'softwareadvice.com',
    'trustpilot.com',
    'bbb.org',
    'pcmag.com',
    'cnet.com',
    'techradar.com',
    'wired.com',
    'theverge.com',
    'github.com',
    'stackoverflow.com',
    'producthunt.com',
    'angel.co',
    'pitchbook.com',
    'owler.com',
    'zoominfo.com',
    'apollo.io',
    'ycombinator.com',
    'news.ycombinator.com',
    'mikesonders.com',
  ]);

  private static readonly DIRECTORY_PATTERNS: RegExp[] = [
    /jobs?\./,
    /careers?\./,
    /blog\./,
    /\.blog$/,
    /reviews?\./,
    /\.wiki(pedia)?$/,
    /\.medium\./,
  ];

  private isDirectoryDomain(domain: string): boolean {
    if (OnboardingService.DIRECTORY_DOMAINS.has(domain)) return true;
    return OnboardingService.DIRECTORY_PATTERNS.some((p) => p.test(domain));
  }

  private guessBrandFromDomain(domain: string): string {
    const root = domain.split('.')[0];
    return root
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private guessCategory(corpus: string): string | null {
    // Count occurrences for every pattern, pick the one with most hits.
    // Single regex match wins over single hit too; ties broken by list order.
    const scores: Array<{ category: string; score: number }> = [];
    for (const { re, category } of CATEGORY_HINT_PATTERNS) {
      const all = corpus.match(new RegExp(re.source, 'gi'));
      if (all && all.length > 0) {
        scores.push({ category, score: all.length });
      }
    }
    if (scores.length === 0) return null;
    scores.sort((a, b) => b.score - a.score);
    return scores[0].category;
  }

  private guessCountry(domain: string): string | null {
    const tld = domain.split('.').pop()?.toLowerCase();
    if (!tld) return null;
    return COUNTRY_TLD_HINTS[tld] ?? null;
  }

  private countryName(code: string): string {
    const names: Record<string, string> = {
      us: 'United States',
      ae: 'UAE',
      sa: 'Saudi Arabia',
      gb: 'United Kingdom',
      de: 'Germany',
      fr: 'France',
      it: 'Italy',
      es: 'Spain',
      jp: 'Japan',
      in: 'India',
      au: 'Australia',
      ca: 'Canada',
    };
    return names[code] ?? code.toUpperCase();
  }

  private normalizeDomain(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }
}
