import { Injectable, Logger } from '@nestjs/common';
import { SerpFeature } from 'src/common/types';

export interface SerperOrganicItem {
  position?: number;
  title: string;
  link: string;
  snippet?: string;
}

export interface SerperResponse {
  organic?: SerperOrganicItem[];
  answerBox?: { title?: string; snippet?: string; link?: string };
  knowledgeGraph?: { title?: string; description?: string };
  peopleAlsoAsk?: Array<{ question: string }>;
  relatedSearches?: Array<{ query: string }>;
  images?: Array<unknown>;
  videos?: Array<unknown>;
  shopping?: Array<unknown>;
  places?: Array<unknown>;
  ads?: Array<unknown>;
  topAds?: Array<unknown>;
  bottomAds?: Array<unknown>;
}

@Injectable()
export class SerperService {
  private readonly logger = new Logger(SerperService.name);
  private readonly endpoint = 'https://google.serper.dev/search';

  isConfigured(): boolean {
    return !!process.env.SERPER_API_KEY;
  }

  async search(
    query: string,
    options: { country?: string; language?: string; num?: number } = {},
    attempt = 0,
  ): Promise<SerperResponse | null> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      this.logger.warn('SERPER_API_KEY not set');
      return null;
    }

    const body: Record<string, unknown> = {
      q: query,
      num: options.num ?? 10,
    };
    if (options.country) body.gl = options.country.toLowerCase();
    if (options.language) body.hl = options.language.toLowerCase();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // 429 (rate limit) and 5xx (transient) — retry with backoff
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        const waitMs = res.status === 429 ? 5000 : 2000 * (attempt + 1);
        this.logger.warn(
          `Serper ${res.status} for "${query}" — retry ${attempt + 1}/2 in ${waitMs}ms`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        return this.search(query, options, attempt + 1);
      }

      if (!res.ok) {
        this.logger.warn(`Serper ${res.status} for "${query}"`);
        return null;
      }
      return (await res.json()) as SerperResponse;
    } catch (err) {
      const isAbort = (err as Error)?.name === 'AbortError';
      if ((isAbort || (err as { code?: string })?.code === 'UND_ERR_CONNECT_TIMEOUT') && attempt < 2) {
        this.logger.warn(
          `Serper timeout for "${query}" — retry ${attempt + 1}/2`,
        );
        return this.search(query, options, attempt + 1);
      }
      this.logger.error(`Serper request failed: ${query}`, err);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  extractSerpFeatures(res: SerperResponse): SerpFeature[] {
    const features: SerpFeature[] = [];
    if (res.answerBox) features.push('featured_snippet');
    if (res.peopleAlsoAsk && res.peopleAlsoAsk.length)
      features.push('people_also_ask');
    if (res.knowledgeGraph) features.push('knowledge_panel');
    if (res.images && res.images.length) features.push('images');
    if (res.videos && res.videos.length) features.push('video');
    if (res.shopping && res.shopping.length) features.push('shopping');
    if (res.places && res.places.length) features.push('local_pack');
    if (res.topAds && res.topAds.length) features.push('ads_top');
    if (res.bottomAds && res.bottomAds.length) features.push('ads_bottom');
    return features;
  }

  extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  findBrandPosition(
    organic: SerperOrganicItem[],
    domain: string,
  ): { position: number | null; item: SerperOrganicItem | null } {
    const target = domain.replace(/^www\./, '').toLowerCase();
    for (let i = 0; i < organic.length; i++) {
      const item = organic[i];
      const itemDomain = this.extractDomain(item.link);
      if (itemDomain === target || itemDomain.endsWith(`.${target}`)) {
        return { position: i + 1, item };
      }
    }
    return { position: null, item: null };
  }
}
