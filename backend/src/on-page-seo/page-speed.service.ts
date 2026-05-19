import { Injectable, Logger } from '@nestjs/common';
import { CoreWebVitals } from 'src/common/types';

interface PsiAuditRef {
  numericValue?: number;
  displayValue?: string;
  score?: number | null;
}

interface PsiResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
    };
    audits?: Record<string, PsiAuditRef>;
  };
}

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const TIMEOUT_MS = 45000;

@Injectable()
export class PageSpeedService {
  private readonly logger = new Logger(PageSpeedService.name);

  isConfigured(): boolean {
    // Google PageSpeed Insights v5 allows unauthenticated calls (rate-limited
    // to roughly 25k/day with key, lower without). We still work without key.
    return true;
  }

  async fetch(
    url: string,
    strategy: 'mobile' | 'desktop' = 'mobile',
  ): Promise<CoreWebVitals> {
    const apiKey = process.env.GOOGLE_PSI_API_KEY ?? '';
    const params = new URLSearchParams({
      url,
      strategy,
      category: 'performance',
    });
    if (apiKey) params.set('key', apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return this.empty(url, strategy, `PSI HTTP ${res.status}`);
      }
      const data = (await res.json()) as PsiResponse;
      return this.parse(url, strategy, data);
    } catch (err) {
      this.logger.warn(
        `PSI failed for ${url}: ${(err as Error).message}`,
      );
      return this.empty(url, strategy, (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }
  }

  private parse(
    url: string,
    strategy: 'mobile' | 'desktop',
    data: PsiResponse,
  ): CoreWebVitals {
    const audits = data.lighthouseResult?.audits ?? {};
    const perf = data.lighthouseResult?.categories?.performance?.score;
    const performanceScore =
      typeof perf === 'number' ? Math.round(perf * 100) : null;
    return {
      url,
      strategy,
      fetched: true,
      performanceScore,
      lcp: this.metric(audits['largest-contentful-paint']),
      cls: this.metric(audits['cumulative-layout-shift']),
      inp: this.metric(audits['interaction-to-next-paint']),
      tbt: this.metric(audits['total-blocking-time']),
      fcp: this.metric(audits['first-contentful-paint']),
      ttfb: this.metric(audits['server-response-time']),
    };
  }

  private metric(audit?: PsiAuditRef) {
    if (!audit) return null;
    return {
      value: audit.numericValue ?? 0,
      displayValue: audit.displayValue ?? '',
      score: audit.score ?? null,
    };
  }

  private empty(
    url: string,
    strategy: 'mobile' | 'desktop',
    err: string,
  ): CoreWebVitals {
    return {
      url,
      strategy,
      fetched: false,
      fetchError: err,
      performanceScore: null,
      lcp: null,
      cls: null,
      inp: null,
      tbt: null,
      fcp: null,
      ttfb: null,
    };
  }
}
