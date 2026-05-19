import { Injectable, Logger } from '@nestjs/common';
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

      // Brand guess from <title> (strip common suffixes like " | Best Real Estate")
      if (title) {
        const titleBrand = title.split(/[|\-–—]/)[0].trim();
        if (titleBrand && titleBrand.length >= 2 && titleBrand.length <= 80) {
          brand = titleBrand;
        }
      }

      const corpus = `${title} ${desc} ${h1Joined} ${keywords.join(' ')}`;
      category = this.guessCategory(corpus);
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
    if (!this.serper.isConfigured()) return [];

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
  ]);

  private isDirectoryDomain(domain: string): boolean {
    return OnboardingService.DIRECTORY_DOMAINS.has(domain);
  }

  private guessBrandFromDomain(domain: string): string {
    const root = domain.split('.')[0];
    return root
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private guessCategory(corpus: string): string | null {
    for (const { re, category } of CATEGORY_HINT_PATTERNS) {
      if (re.test(corpus)) return category;
    }
    return null;
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
