import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  CoreWebVitals,
  OnPageSeoReport,
  PageSeoAudit,
  PageSeoIssue,
} from 'src/common/types';
import { CrawlerService } from 'src/seo/crawler.service';
import { PageSpeedService } from './page-speed.service';
import { CreateOnPageSeoScanDto } from './dto';

const FETCH_TIMEOUT_MS = 15000;
const MAX_PAGES = 5;
const MAX_SCORE = 100;

@Injectable()
export class OnPageSeoService {
  private readonly logger = new Logger(OnPageSeoService.name);

  constructor(
    private firebase: FirebaseService,
    private crawler: CrawlerService,
    private pageSpeed: PageSpeedService,
  ) {}

  async createScan(dto: CreateOnPageSeoScanDto) {
    const brandRef = await this.getOrCreateBrand(dto.brand);
    const brandId = brandRef.id;
    const ref = this.firebase.onPageSeoReports(brandId).doc();
    const reportId = ref.id;
    const domain = this.normalizeDomain(dto.domain);

    await ref.set({
      brandId,
      brand: dto.brand,
      domain,
      status: 'running',
      createdAt: this.firebase.now(),
    } as OnPageSeoReport);

    this.logger.log(
      `On-page SEO scan ${reportId} started for ${dto.brand} (${domain})`,
    );

    void this.runInBackground(brandId, reportId, dto, domain);
    return { reportId, brandId };
  }

  private async runInBackground(
    brandId: string,
    reportId: string,
    dto: CreateOnPageSeoScanDto,
    domain: string,
  ) {
    const ref = this.firebase.onPageSeoReports(brandId).doc(reportId);
    try {
      const urls = await this.resolveUrls(domain, dto.pages);
      const strategy = dto.strategy ?? 'mobile';

      const pages: PageSeoAudit[] = [];
      const vitals: CoreWebVitals[] = [];

      // Audit pages sequentially (cheerio cheap), but parallelise PSI per page
      for (const url of urls) {
        const [audit, vital] = await Promise.all([
          this.auditPage(url),
          this.pageSpeed.fetch(url, strategy),
        ]);
        pages.push(audit);
        vitals.push(vital);
      }

      const summary = this.computeSummary(pages, vitals);
      const topIssues = this.aggregateIssues(pages);

      await ref.update({
        status: 'done',
        completedAt: this.firebase.now(),
        pages,
        vitals,
        summary,
        topIssues,
      });

      this.logger.log(
        `On-page SEO ${reportId} done. ${pages.length} pages, avg score ${summary.avgScore}`,
      );
    } catch (err) {
      await ref.update({ status: 'failed' });
      this.logger.error(
        `On-page SEO ${reportId} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async resolveUrls(
    domain: string,
    explicit?: string[],
  ): Promise<string[]> {
    if (explicit && explicit.length > 0) {
      return [...new Set(explicit)].slice(0, MAX_PAGES);
    }
    try {
      const crawl = await this.crawler.crawl(`https://${domain}`);
      const all = (crawl.pages ?? [crawl.page]).map((p) => p.url);
      return [...new Set(all)].slice(0, MAX_PAGES);
    } catch (err) {
      this.logger.warn(
        `Crawler discovery failed for ${domain}: ${(err as Error).message}; falling back to homepage only`,
      );
      return [`https://${domain}`];
    }
  }

  private async auditPage(url: string): Promise<PageSeoAudit> {
    let html = '';
    try {
      html = await this.fetchText(url);
    } catch (err) {
      return this.unreachablePage(url, (err as Error).message);
    }

    const $ = cheerio.load(html);
    const baseHost = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    })();

    const title = $('title').first().text().trim() || null;
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() || null;
    const h1s = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean);
    const h2s = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean);
    const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
    const hasOgImage = Boolean($('meta[property="og:image"]').attr('content'));
    const hasTwitterCard = Boolean($('meta[name="twitter:card"]').attr('content'));
    const langAttr = $('html').attr('lang')?.trim() || null;
    const hasViewport = Boolean($('meta[name="viewport"]').attr('content'));
    const hasStructuredData = $('script[type="application/ld+json"]').length > 0;

    let internal = 0;
    let external = 0;
    let brokenAnchors = 0;
    $('a[href]').each((_, el) => {
      const href = ($(el).attr('href') ?? '').trim();
      if (!href || href === '#') {
        brokenAnchors += 1;
        return;
      }
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const abs = new URL(href, url);
        if (abs.hostname === baseHost) internal += 1;
        else external += 1;
      } catch {
        brokenAnchors += 1;
      }
    });

    let imgCount = 0;
    let imgsWithAlt = 0;
    $('img').each((_, el) => {
      imgCount += 1;
      const alt = $(el).attr('alt');
      if (alt && alt.trim().length > 0) imgsWithAlt += 1;
    });

    // Word count from visible body (after strip script/style)
    $('script,style,noscript,svg').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText ? bodyText.split(' ').filter(Boolean).length : 0;

    const audit: PageSeoAudit = {
      url,
      fetched: true,
      title,
      titleLength: title?.length ?? 0,
      metaDescription,
      metaDescriptionLength: metaDescription?.length ?? 0,
      h1Count: h1s.length,
      h1Texts: h1s.slice(0, 5),
      h2Count: h2s.length,
      canonical,
      hasOgImage,
      hasTwitterCard,
      internalLinkCount: internal,
      externalLinkCount: external,
      imageCount: imgCount,
      imagesWithAltCount: imgsWithAlt,
      wordCount,
      langAttr,
      hasHtmlLang: Boolean(langAttr),
      hasViewport,
      hasStructuredData,
      brokenAnchorCount: brokenAnchors,
      issues: [],
      score: 0,
      scoreOutOf: MAX_SCORE,
    };
    audit.issues = this.diagnoseIssues(audit);
    audit.score = this.scorePage(audit);
    return audit;
  }

  private unreachablePage(url: string, err: string): PageSeoAudit {
    return {
      url,
      fetched: false,
      fetchError: err,
      title: null,
      titleLength: 0,
      metaDescription: null,
      metaDescriptionLength: 0,
      h1Count: 0,
      h1Texts: [],
      h2Count: 0,
      canonical: null,
      hasOgImage: false,
      hasTwitterCard: false,
      internalLinkCount: 0,
      externalLinkCount: 0,
      imageCount: 0,
      imagesWithAltCount: 0,
      wordCount: 0,
      langAttr: null,
      hasHtmlLang: false,
      hasViewport: false,
      hasStructuredData: false,
      brokenAnchorCount: 0,
      issues: [
        {
          severity: 'critical',
          code: 'page_unreachable',
          message: `Page failed to fetch: ${err}`,
          fix: 'Check that this URL returns 200 OK without auth or geo-blocking.',
        },
      ],
      score: 0,
      scoreOutOf: MAX_SCORE,
    };
  }

  private diagnoseIssues(p: PageSeoAudit): PageSeoIssue[] {
    const issues: PageSeoIssue[] = [];
    if (!p.title) {
      issues.push({
        severity: 'critical',
        code: 'missing_title',
        message: 'Page has no <title> tag',
        fix: 'Add a unique <title> describing the page in 30–60 characters.',
      });
    } else if (p.titleLength < 30 || p.titleLength > 60) {
      issues.push({
        severity: 'medium',
        code: 'title_length',
        message: `Title length is ${p.titleLength} chars (target 30–60)`,
        fix: 'Rewrite title to fit Google\'s SERP display range.',
      });
    }
    if (!p.metaDescription) {
      issues.push({
        severity: 'high',
        code: 'missing_meta_description',
        message: 'Missing <meta name="description">',
        fix: 'Write a 120–160 char meta description summarising the page.',
      });
    } else if (
      p.metaDescriptionLength < 120 ||
      p.metaDescriptionLength > 170
    ) {
      issues.push({
        severity: 'low',
        code: 'meta_description_length',
        message: `Meta description ${p.metaDescriptionLength} chars (target 120–160)`,
      });
    }
    if (p.h1Count === 0) {
      issues.push({
        severity: 'high',
        code: 'no_h1',
        message: 'No <h1> heading on page',
        fix: 'Add exactly one <h1> describing the primary topic.',
      });
    } else if (p.h1Count > 1) {
      issues.push({
        severity: 'medium',
        code: 'multiple_h1',
        message: `${p.h1Count} <h1> tags found (best practice: exactly 1)`,
      });
    }
    if (!p.canonical) {
      issues.push({
        severity: 'medium',
        code: 'missing_canonical',
        message: 'No <link rel="canonical"> tag',
        fix: 'Add canonical URL to prevent duplicate-content penalties.',
      });
    }
    if (!p.hasOgImage) {
      issues.push({
        severity: 'low',
        code: 'missing_og_image',
        message: 'No og:image — social shares won\'t render a preview',
      });
    }
    if (!p.hasTwitterCard) {
      issues.push({
        severity: 'low',
        code: 'missing_twitter_card',
        message: 'No twitter:card meta tag',
      });
    }
    if (!p.hasHtmlLang) {
      issues.push({
        severity: 'medium',
        code: 'missing_html_lang',
        message: '<html> tag has no lang attribute',
        fix: 'Add lang="en" (or your locale) to <html>.',
      });
    }
    if (!p.hasViewport) {
      issues.push({
        severity: 'high',
        code: 'missing_viewport',
        message: 'Missing viewport meta tag (mobile rendering broken)',
        fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
      });
    }
    if (!p.hasStructuredData) {
      issues.push({
        severity: 'high',
        code: 'no_structured_data',
        message: 'No JSON-LD structured data found',
        fix: 'Use the Schema Generator to add Organization / FAQ / Article schema.',
      });
    }
    if (p.imageCount > 0) {
      const altPct = Math.round((p.imagesWithAltCount / p.imageCount) * 100);
      if (altPct < 80) {
        issues.push({
          severity: altPct < 50 ? 'high' : 'medium',
          code: 'image_alt_coverage',
          message: `Only ${altPct}% of ${p.imageCount} images have alt text`,
          fix: 'Add descriptive alt attributes to all content images.',
        });
      }
    }
    if (p.internalLinkCount < 3 && p.wordCount > 200) {
      issues.push({
        severity: 'medium',
        code: 'few_internal_links',
        message: `Only ${p.internalLinkCount} internal links (helps crawl depth)`,
      });
    }
    if (p.wordCount < 300 && p.wordCount > 0) {
      issues.push({
        severity: 'medium',
        code: 'thin_content',
        message: `${p.wordCount} words — Google often considers <300 thin content`,
        fix: 'Expand the page with substantive content (target 600+ for landing pages).',
      });
    }
    return issues;
  }

  private scorePage(p: PageSeoAudit): number {
    let score = MAX_SCORE;
    for (const issue of p.issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }
    return Math.max(0, score);
  }

  private computeSummary(
    pages: PageSeoAudit[],
    vitals: CoreWebVitals[],
  ): NonNullable<OnPageSeoReport['summary']> {
    const audited = pages.length;
    const avgScore = audited
      ? Math.round(pages.reduce((s, p) => s + p.score, 0) / audited)
      : 0;
    const totalIssues = pages.reduce((s, p) => s + p.issues.length, 0);
    const criticalIssues = pages.reduce(
      (s, p) => s + p.issues.filter((i) => i.severity === 'critical').length,
      0,
    );
    const perfValues = vitals
      .map((v) => v.performanceScore)
      .filter((s): s is number => typeof s === 'number');
    const avgPerformance = perfValues.length
      ? Math.round(perfValues.reduce((a, b) => a + b, 0) / perfValues.length)
      : null;
    return {
      avgScore,
      totalIssues,
      criticalIssues,
      pagesAudited: audited,
      avgPerformance,
    };
  }

  private aggregateIssues(
    pages: PageSeoAudit[],
  ): NonNullable<OnPageSeoReport['topIssues']> {
    const map = new Map<
      string,
      { count: number; message: string; severity: PageSeoIssue['severity'] }
    >();
    for (const p of pages) {
      for (const i of p.issues) {
        const entry = map.get(i.code) ?? {
          count: 0,
          message: i.message,
          severity: i.severity,
        };
        entry.count += 1;
        map.set(i.code, entry);
      }
    }
    return [...map.entries()]
      .map(([code, v]) => ({ code, count: v.count, message: v.message, severity: v.severity }))
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
        if (a.severity !== b.severity) return order[a.severity] - order[b.severity];
        return b.count - a.count;
      });
  }

  private async fetchText(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; AIVisibilityBot/1.0; +https://aivisibility.local)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeDomain(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }

  async getReport(brandId: string, reportId: string): Promise<OnPageSeoReport> {
    const doc = await this.firebase
      .onPageSeoReports(brandId)
      .doc(reportId)
      .get();
    if (!doc.exists) {
      throw new NotFoundException(`On-page SEO ${reportId} not found`);
    }
    return { id: doc.id, ...(doc.data() as OnPageSeoReport) };
  }

  async listReports(brandName: string): Promise<OnPageSeoReport[]> {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();
    if (brandSnap.empty) return [];
    const brandId = brandSnap.docs[0].id;
    const snap = await this.firebase
      .onPageSeoReports(brandId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as OnPageSeoReport) }),
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
