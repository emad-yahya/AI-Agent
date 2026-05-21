import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  SeoAnomaly,
  SeoCompetitor,
  SeoResult,
  SeoScan,
  SeoSite,
  SeoSiteScan,
} from 'src/common/types';
import { CrawlerService } from './crawler.service';
import { SerperService } from './serper.service';

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);

  constructor(
    private firebase: FirebaseService,
    private crawler: CrawlerService,
    private serper: SerperService,
  ) {}

  // ─── Legacy: per-brand keyword scan (existing flow) ─────────────────────────

  async createScan(
    brand: string,
    keywords: string[],
  ): Promise<{ scanId: string; brandId: string }> {
    const brandId = await this.resolveBrand(brand);

    const scanRef = this.firebase.seoScans(brandId).doc();
    const scanId = scanRef.id;
    await scanRef.set({
      brandId,
      brand,
      status: 'running',
      createdAt: this.firebase.now(),
      keywords,
    });

    void this.runKeywordScanAsync(brandId, scanId, brand, keywords);

    return { scanId, brandId };
  }

  private async runKeywordScanAsync(
    brandId: string,
    scanId: string,
    brand: string,
    keywords: string[],
  ) {
    const scanRef = this.firebase.seoScans(brandId).doc(scanId);
    try {
      const results: SeoResult[] = [];
      const delayMs = parseInt(process.env.SEO_DELAY_MS ?? '500', 10);

      for (const keyword of keywords) {
        const result = await this.checkBrandKeyword(brand, keyword);
        results.push(result);
        await this.sleep(delayMs);
      }

      await scanRef.update({
        status: 'done',
        completedAt: this.firebase.now(),
        results,
      });
    } catch (err) {
      this.logger.error('SEO scan failed', err);
      await scanRef.update({ status: 'failed' });
    }
  }

  private async checkBrandKeyword(
    brand: string,
    keyword: string,
  ): Promise<SeoResult> {
    const empty: SeoResult = {
      keyword,
      position: null,
      url: null,
      title: null,
      found: false,
    };

    if (!this.serper.isConfigured()) {
      this.logger.warn('SERPER_API_KEY not set — returning empty result');
      return empty;
    }

    const res = await this.serper.search(keyword, { num: 10 });
    if (!res) return empty;

    const items = res.organic ?? [];
    const brandLower = brand.toLowerCase();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (
        item.link.toLowerCase().includes(brandLower) ||
        item.title.toLowerCase().includes(brandLower) ||
        (item.snippet ?? '').toLowerCase().includes(brandLower)
      ) {
        return {
          keyword,
          position: i + 1,
          url: item.link,
          title: item.title,
          found: true,
        };
      }
    }

    return empty;
  }

  async getScan(brandId: string, scanId: string): Promise<SeoScan> {
    const doc = await this.firebase.seoScans(brandId).doc(scanId).get();
    if (!doc.exists) throw new NotFoundException('SEO scan not found');
    return { id: doc.id, ...(doc.data() as Omit<SeoScan, 'id'>) };
  }

  async listScans(brand: string): Promise<SeoScan[]> {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brand)
      .limit(1)
      .get();
    if (brandSnap.empty) return [];
    const brandId = brandSnap.docs[0].id;

    const snap = await this.firebase
      .seoScans(brandId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SeoScan, 'id'>),
    }));
  }

  // ─── Semrush-style: Site management + auto scan ─────────────────────────────

  async createSite(input: {
    brand: string;
    domain: string;
    country: string;
    language?: string;
  }): Promise<{ siteId: string; brandId: string; domain: string }> {
    const domain = this.crawler.extractDomain(input.domain);
    const brandId = await this.resolveBrand(input.brand);

    const existing = await this.firebase
      .seoSites()
      .where('domain', '==', domain)
      .where('country', '==', input.country)
      .where('brandId', '==', brandId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return { siteId: existing.docs[0].id, brandId, domain };
    }

    const ref = await this.firebase.seoSites().add({
      brandId,
      brand: input.brand,
      domain,
      country: input.country,
      language: input.language ?? 'en',
      createdAt: this.firebase.now(),
    });
    return { siteId: ref.id, brandId, domain };
  }

  async listSites(brand?: string): Promise<SeoSite[]> {
    if (brand) {
      // Filter by the brand text stored on the seoSite doc directly.
      // Avoids brandId resolution mismatches when duplicate brand docs were
      // cleaned up and the seoSites still point at an older brandId.
      const snap = await this.firebase
        .seoSites()
        .where('brand', '==', brand)
        .limit(50)
        .get();
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SeoSite, 'id'>),
      }));
    }
    const snap = await this.firebase
      .seoSites()
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SeoSite, 'id'>),
    }));
  }

  async getSite(siteId: string): Promise<SeoSite> {
    const doc = await this.firebase.seoSites().doc(siteId).get();
    if (!doc.exists) throw new NotFoundException('SEO site not found');
    return { id: doc.id, ...(doc.data() as Omit<SeoSite, 'id'>) };
  }

  async runSiteScan(siteId: string): Promise<{ scanId: string }> {
    const site = await this.getSite(siteId);

    const scanRef = this.firebase.seoSiteScans(siteId).doc();
    const scanId = scanRef.id;
    await scanRef.set({
      siteId,
      domain: site.domain,
      brand: site.brand,
      country: site.country,
      status: 'running',
      createdAt: this.firebase.now(),
      keywords: [],
    });

    void this.runSiteScanAsync(siteId, scanId, site);

    return { scanId };
  }

  private async runSiteScanAsync(
    siteId: string,
    scanId: string,
    site: SeoSite,
  ) {
    const scanRef = this.firebase.seoSiteScans(siteId).doc(scanId);
    try {
      // 1. Crawl + extract keywords
      const homepageUrl = `https://${site.domain}`;
      this.logger.log(`Crawling ${homepageUrl}`);
      const crawl = await this.crawler.crawl(homepageUrl);
      const keywords = crawl.keywords;

      if (keywords.length === 0) {
        throw new Error('No keywords extracted from homepage');
      }

      await scanRef.update({ keywords });

      // 2. For each keyword: search via Serper, find brand position, capture competitors + SERP features
      const results: SeoResult[] = [];
      const competitorCounts = new Map<string, number>();
      const delayMs = parseInt(process.env.SEO_DELAY_MS ?? '500', 10);

      for (const keyword of keywords) {
        const r = await this.scanKeywordForSite(keyword, site);
        results.push(r);
        for (const c of r.topCompetitors ?? []) {
          if (c.domain === site.domain) continue;
          competitorCounts.set(
            c.domain,
            (competitorCounts.get(c.domain) ?? 0) + 1,
          );
        }
        await this.sleep(delayMs);
      }

      // 3. Aggregates
      const rankedPositions = results
        .filter((r) => r.found && r.position !== null)
        .map((r) => r.position as number);
      const avgPosition =
        rankedPositions.length > 0
          ? rankedPositions.reduce((a, b) => a + b, 0) / rankedPositions.length
          : null;

      const competitorMap = Object.fromEntries(
        [...competitorCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
      );

      // 3.5. Anomaly detection vs previous scan
      const anomalies = await this.detectAnomalies(siteId, {
        avgPosition,
        rankedCount: rankedPositions.length,
        totalKeywords: results.length,
        results,
      });

      await scanRef.update({
        status: 'done',
        completedAt: this.firebase.now(),
        results,
        competitorMap,
        avgPosition,
        rankedCount: rankedPositions.length,
        totalKeywords: results.length,
        anomalies,
      });

      // 4. Update site with discovered metadata
      await this.firebase
        .seoSites()
        .doc(siteId)
        .update({
          discoveredKeywords: keywords,
          autoCompetitors: Object.keys(competitorMap).slice(0, 5),
          lastScanAt: this.firebase.now(),
        });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Site scan ${scanId} failed: ${msg}`, err);
      await scanRef.update({
        status: 'failed',
        completedAt: this.firebase.now(),
        error: msg.slice(0, 500),
      });
    }
  }

  private async detectAnomalies(
    siteId: string,
    current: {
      avgPosition: number | null;
      rankedCount: number;
      totalKeywords: number;
      results: SeoResult[];
    },
  ): Promise<SeoAnomaly[]> {
    // Find the most recent completed scan BEFORE this one
    const snap = await this.firebase
      .seoSiteScans(siteId)
      .where('status', '==', 'done')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return [];

    const prev = snap.docs[0].data() as SeoSiteScan;
    const anomalies: SeoAnomaly[] = [];

    // 1. Average position drop
    const prevAvg = prev.avgPosition ?? null;
    const curAvg = current.avgPosition;
    if (prevAvg !== null && curAvg !== null) {
      const delta = curAvg - prevAvg;
      if (delta >= 1.5) {
        anomalies.push({
          type: 'position_drop',
          severity: delta >= 3 ? 'high' : 'medium',
          message: `Avg position dropped by ${delta.toFixed(1)} (#${prevAvg.toFixed(1)} → #${curAvg.toFixed(1)})`,
          delta,
        });
      } else if (delta <= -1.5) {
        anomalies.push({
          type: 'position_gain',
          severity: 'info',
          message: `Avg position improved by ${Math.abs(delta).toFixed(1)} (#${prevAvg.toFixed(1)} → #${curAvg.toFixed(1)})`,
          delta,
        });
      }
    }

    // 2. Coverage drop (ranked / total %)
    const prevCoverage =
      (prev.totalKeywords ?? 0) > 0
        ? (prev.rankedCount ?? 0) / (prev.totalKeywords ?? 1)
        : null;
    const curCoverage =
      current.totalKeywords > 0
        ? current.rankedCount / current.totalKeywords
        : null;
    if (prevCoverage !== null && curCoverage !== null) {
      const delta = curCoverage - prevCoverage;
      if (delta <= -0.15) {
        anomalies.push({
          type: 'coverage_drop',
          severity: delta <= -0.3 ? 'high' : 'medium',
          message: `Coverage dropped ${Math.abs(delta * 100).toFixed(0)}% (${Math.round(prevCoverage * 100)}% → ${Math.round(curCoverage * 100)}%)`,
          delta,
        });
      } else if (delta >= 0.15) {
        anomalies.push({
          type: 'coverage_gain',
          severity: 'info',
          message: `Coverage improved ${(delta * 100).toFixed(0)}% (${Math.round(prevCoverage * 100)}% → ${Math.round(curCoverage * 100)}%)`,
          delta,
        });
      }
    }

    // 3. Per-keyword: lost ranking (was ranked, now not)
    const prevRanked = new Set(
      (prev.results ?? []).filter((r) => r.found).map((r) => r.keyword),
    );
    const curRanked = new Set(
      current.results.filter((r) => r.found).map((r) => r.keyword),
    );
    const lost = [...prevRanked].filter((k) => !curRanked.has(k));
    const gained = [...curRanked].filter((k) => !prevRanked.has(k));

    if (lost.length > 0) {
      anomalies.push({
        type: 'keyword_lost',
        severity: lost.length >= 3 ? 'high' : 'medium',
        message: `Lost top-10 ranking for ${lost.length} keyword${lost.length > 1 ? 's' : ''}`,
        keywords: lost.slice(0, 5),
      });
    }
    if (gained.length > 0) {
      anomalies.push({
        type: 'keyword_gained',
        severity: 'info',
        message: `Gained top-10 ranking for ${gained.length} new keyword${gained.length > 1 ? 's' : ''}`,
        keywords: gained.slice(0, 5),
      });
    }

    return anomalies;
  }

  private async scanKeywordForSite(
    keyword: string,
    site: SeoSite,
  ): Promise<SeoResult> {
    const empty: SeoResult = {
      keyword,
      position: null,
      url: null,
      title: null,
      found: false,
    };

    if (!this.serper.isConfigured()) return empty;

    const res = await this.serper.search(keyword, {
      country: site.country,
      language: site.language,
      num: 10,
    });
    if (!res) return empty;

    const organic = res.organic ?? [];
    const { position, item } = this.serper.findBrandPosition(
      organic,
      site.domain,
    );

    const topCompetitors: SeoCompetitor[] = organic
      .slice(0, 10)
      .map((o, i) => ({
        domain: this.serper.extractDomain(o.link),
        position: i + 1,
        title: o.title,
        url: o.link,
      }));

    const serpFeatures = this.serper.extractSerpFeatures(res);

    if (position && item) {
      return {
        keyword,
        position,
        url: item.link,
        title: item.title,
        found: true,
        topCompetitors,
        serpFeatures,
      };
    }
    return { ...empty, topCompetitors, serpFeatures };
  }

  async listSiteScans(siteId: string): Promise<SeoSiteScan[]> {
    const snap = await this.firebase
      .seoSiteScans(siteId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SeoSiteScan, 'id'>),
    }));
  }

  async getSiteScan(siteId: string, scanId: string): Promise<SeoSiteScan> {
    const doc = await this.firebase.seoSiteScans(siteId).doc(scanId).get();
    if (!doc.exists) throw new NotFoundException('Site scan not found');
    return { id: doc.id, ...(doc.data() as Omit<SeoSiteScan, 'id'>) };
  }

  /**
   * Compare 2-4 tracked sites side-by-side using their most recent completed scan.
   * Returns per-site summary + keyword overlap analysis.
   */
  async compareSites(siteIds: string[]): Promise<{
    sites: Array<{
      site: SeoSite;
      scan: SeoSiteScan | null;
    }>;
    keywordOverlap: Array<{
      keyword: string;
      byDomain: Record<string, number | null>;
    }>;
  }> {
    if (siteIds.length < 2 || siteIds.length > 4) {
      throw new Error('compareSites: provide 2 to 4 siteIds');
    }

    const sites = await Promise.all(
      siteIds.map(async (id) => {
        const site = await this.getSite(id);
        const latestSnap = await this.firebase
          .seoSiteScans(id)
          .where('status', '==', 'done')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        const scan = latestSnap.empty
          ? null
          : ({
              id: latestSnap.docs[0].id,
              ...(latestSnap.docs[0].data() as Omit<SeoSiteScan, 'id'>),
            } as SeoSiteScan);
        return { site, scan };
      }),
    );

    // Build keyword overlap: union of all keywords seen across sites,
    // mapped to position per domain (null if not in that site's scan)
    const keywordSet = new Set<string>();
    for (const { scan } of sites) {
      for (const r of scan?.results ?? []) keywordSet.add(r.keyword);
    }

    const overlap = [...keywordSet].map((keyword) => {
      const byDomain: Record<string, number | null> = {};
      for (const { site, scan } of sites) {
        const hit = scan?.results?.find((r) => r.keyword === keyword);
        byDomain[site.domain] = hit?.position ?? null;
      }
      return { keyword, byDomain };
    });

    // Sort: keywords ranked by most sites first, then by best avg position
    overlap.sort((a, b) => {
      const aRanked = Object.values(a.byDomain).filter(
        (v) => v !== null,
      ).length;
      const bRanked = Object.values(b.byDomain).filter(
        (v) => v !== null,
      ).length;
      if (aRanked !== bRanked) return bRanked - aRanked;
      const aBest = Math.min(
        ...Object.values(a.byDomain).filter((v) => v !== null),
      );
      const bBest = Math.min(
        ...Object.values(b.byDomain).filter((v) => v !== null),
      );
      return aBest - bBest;
    });

    return { sites, keywordOverlap: overlap.slice(0, 40) };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async resolveBrand(brand: string): Promise<string> {
    const snap = await this.firebase
      .brands()
      .where('name', '==', brand)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].id;
    const ref = await this.firebase
      .brands()
      .add({ name: brand, createdAt: this.firebase.now() });
    return ref.id;
  }

  private async findBrandId(brand: string): Promise<string | null> {
    const snap = await this.firebase
      .brands()
      .where('name', '==', brand)
      .limit(1)
      .get();
    return snap.empty ? null : snap.docs[0].id;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
