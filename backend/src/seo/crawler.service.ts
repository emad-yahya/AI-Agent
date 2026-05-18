import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface CrawledPage {
  url: string;
  domain: string;
  title: string;
  description: string;
  h1: string[];
  h2: string[];
  bodyText: string;
  fetchedAt: number;
}

export interface CrawlResult {
  page: CrawledPage;
  pages?: CrawledPage[];
  keywords: string[];
}

// CTA / navigation / boilerplate phrases that pollute keyword extraction
const CTA_NAVIGATION_PHRASES = new Set([
  'contact us',
  'about us',
  'register interest',
  'register your interest',
  'register now',
  'sign up',
  'sign in',
  'log in',
  'log out',
  'login',
  'logout',
  'subscribe',
  'subscribe now',
  'newsletter',
  'home page',
  'home',
  'menu',
  'search',
  'read more',
  'learn more',
  'click here',
  'view all',
  'see all',
  'show more',
  'load more',
  'latest news',
  'latest blog',
  'latest blogs',
  'latest projects',
  'latest articles',
  'recent posts',
  'recent news',
  'all rights reserved',
  'privacy policy',
  'cookie policy',
  'terms of service',
  'terms of use',
  'terms conditions',
  'follow us',
  'share this',
  'site map',
  'sitemap',
  'get in touch',
  'get started',
  'book now',
  'apply now',
  'download now',
  'visit us',
  'find us',
  'send message',
  'send email',
  'call now',
  'whatsapp us',
]);

const INTERNAL_PAGE_PATTERNS = [
  /\/about[-/]?/i,
  /\/services?[-/]?/i,
  /\/products?[-/]?/i,
  /\/solutions?[-/]?/i,
  /\/what-we-do/i,
  /\/our-services/i,
  /\/contact[-/]?/i,
  /\/projects?[-/]?/i,
  /\/portfolio/i,
  /\/why-(us|choose)/i,
];

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'about',
  'your',
  'our',
  'you',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'will',
  'would',
  'can',
  'should',
  'could',
  'may',
  'might',
  'one',
  'two',
  'three',
  'all',
  'any',
  'more',
  'most',
  'some',
  'what',
  'when',
  'where',
  'how',
  'why',
  'who',
  'which',
  'their',
  'they',
  'them',
  'his',
  'her',
  'its',
  'it',
  'as',
  'at',
  'be',
  'by',
  'do',
  'if',
  'in',
  'is',
  'of',
  'on',
  'or',
  'so',
  'to',
  'up',
  'we',
  'an',
  'a',
  'i',
  'my',
  'me',
  'no',
  'not',
  'but',
  'also',
  'than',
  'then',
  'too',
  'very',
  'just',
  'only',
  'out',
  'off',
  'here',
  'there',
  'now',
  'new',
  'old',
  'get',
  'use',
  'make',
  'made',
  'many',
  'much',
  'such',
  'via',
  'per',
  'plus',
  'etc',
  'top',
  'best',
  'good',
  'great',
  'high',
  'low',
  'big',
  'small',
]);

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  async crawl(url: string): Promise<CrawlResult> {
    const candidates = this.buildUrlCandidates(url);
    let homepage: CrawledPage | null = null;
    let homepageHtml = '';
    let lastErr: unknown = null;

    for (const candidate of candidates) {
      try {
        const html = await this.fetchHtml(candidate);
        homepage = this.parseHtml(candidate, html);
        homepageHtml = html;
        break;
      } catch (err) {
        this.logger.warn(
          `Crawl failed for ${candidate}: ${(err as Error).message}`,
        );
        lastErr = err;
      }
    }

    if (!homepage) {
      throw lastErr instanceof Error
        ? lastErr
        : new Error(`All crawl candidates failed for ${url}`);
    }

    // Discover and crawl up to 4 internal "key" pages (about/services/contact/etc)
    const innerUrls = this.discoverInnerPages(homepageHtml, homepage.url).slice(
      0,
      4,
    );
    const innerPages: CrawledPage[] = [];
    for (const innerUrl of innerUrls) {
      try {
        const html = await this.fetchHtml(innerUrl);
        innerPages.push(this.parseHtml(innerUrl, html));
      } catch (err) {
        this.logger.warn(
          `Inner crawl failed for ${innerUrl}: ${(err as Error).message}`,
        );
      }
    }

    const allPages = [homepage, ...innerPages];
    const keywords = this.extractKeywordsFromPages(allPages);
    return { page: homepage, pages: allPages, keywords };
  }

  private discoverInnerPages(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const base = new URL(baseUrl);
    const found = new Map<string, string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      let abs: URL;
      try {
        abs = new URL(href, base);
      } catch {
        return;
      }
      if (abs.hostname !== base.hostname) return;
      const pathname = abs.pathname;
      if (pathname === '/' || pathname === '') return;
      if (!INTERNAL_PAGE_PATTERNS.some((p) => p.test(pathname))) return;
      const key = pathname.toLowerCase().replace(/\/+$/, '');
      if (!found.has(key)) {
        found.set(key, abs.toString().split('#')[0]);
      }
    });

    return [...found.values()];
  }

  private buildUrlCandidates(input: string): string[] {
    const normalized = this.normalizeUrl(input);
    let host: string;
    try {
      host = new URL(normalized).hostname;
    } catch {
      return [normalized];
    }
    const bare = host.replace(/^www\./, '');
    const withWww = `www.${bare}`;
    const proto = normalized.startsWith('http://') ? 'http://' : 'https://';
    const variants = [
      `${proto}${bare}/`,
      `${proto}${withWww}/`,
      `https://${withWww}/`,
      `http://${bare}/`,
    ];
    return [...new Set(variants)];
  }

  normalizeUrl(input: string): string {
    let url = input.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    return url;
  }

  extractDomain(url: string): string {
    try {
      const u = new URL(this.normalizeUrl(url));
      return u.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
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
      if (!res.ok) {
        throw new Error(`Fetch failed ${res.status} for ${url}`);
      }
      return await res.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseHtml(url: string, html: string): CrawledPage {
    const $ = cheerio.load(html);
    $('script,style,noscript,svg,iframe').remove();

    const title = ($('title').first().text() || '').trim();
    const description = (
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      ''
    ).trim();
    const h1 = $('h1')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    const h2 = $('h2')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    const bodyText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);

    return {
      url,
      domain: this.extractDomain(url),
      title,
      description,
      h1,
      h2,
      bodyText,
      fetchedAt: Date.now(),
    };
  }

  private extractKeywords(page: CrawledPage): string[] {
    return this.extractKeywordsFromPages([page]);
  }

  private extractKeywordsFromPages(pages: CrawledPage[]): string[] {
    const candidates: string[] = [];

    for (const page of pages) {
      // Weighted sources: title + h1 carry strongest signals
      candidates.push(...this.splitPhrases(page.title));
      candidates.push(...page.h1.flatMap((h) => this.splitPhrases(h)));
      candidates.push(...this.splitPhrases(page.description));
      candidates.push(...page.h2.flatMap((h) => this.splitPhrases(h)));

      // N-gram phrases from title/h1/description/h2
      const ngramSources = [
        page.title,
        ...page.h1,
        page.description,
        ...page.h2,
      ].filter(Boolean);
      for (const text of ngramSources) {
        candidates.push(...this.ngrams(text, 2));
        candidates.push(...this.ngrams(text, 3));
      }
    }

    const cleaned = candidates
      .map((c) => this.cleanPhrase(c))
      .filter((c) => this.isUsefulKeyword(c));

    return this.dedupeByFrequency(cleaned, 25);
  }

  private splitPhrases(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .split(/[|\-–—•:,;·/()[\]{}!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private ngrams(text: string, n: number): string[] {
    const tokens = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .split(/\s+/)
      .filter((w) => w && w.length > 2 && !STOPWORDS.has(w));
    const out: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      out.push(tokens.slice(i, i + n).join(' '));
    }
    return out;
  }

  private cleanPhrase(phrase: string): string {
    return phrase
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isUsefulKeyword(phrase: string): boolean {
    if (!phrase) return false;
    const words = phrase.split(' ');
    if (words.length < 1 || words.length > 5) return false;
    if (phrase.length < 4 || phrase.length > 80) return false;
    if (words.every((w) => STOPWORDS.has(w))) return false;
    if (/^\d+$/.test(phrase)) return false;
    if (CTA_NAVIGATION_PHRASES.has(phrase)) return false;
    return true;
  }

  private dedupeByFrequency(phrases: string[], limit: number): string[] {
    const counts = new Map<string, number>();
    for (const p of phrases) {
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return b[0].split(' ').length - a[0].split(' ').length;
      })
      .slice(0, limit)
      .map(([phrase]) => phrase);
  }
}
