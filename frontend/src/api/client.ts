import axios from "axios";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  headers: { "Content-Type": "application/json" },
});

// Attach API key if configured
const apiKey = (import.meta.env.VITE_API_KEY as string | undefined) ?? '';
if (apiKey) {
  http.interceptors.request.use((config) => {
    config.headers['Authorization'] = `Bearer ${apiKey}`;
    return config;
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  steps: string[];
  effort: string;
  expectedImpact: string;
  platforms: string[];
}

export interface CompetitorPlaybookEntry {
  competitor: string;
  mentionFrequency: number;
  whyNotable: string;
  strategy: string;
  howToReplicate: string;
  quickWins: string[];
}

export interface ScanResult {
  id: string;
  engine: "chatgpt-style" | "gemini-style" | "perplexity-style";
  prompt: string;
  response: string;
  mentioned: boolean;
  position: number | null;
  sentiment: "positive" | "neutral" | "negative";
  visibilityScore: number;
  topics: string[];
}

export interface ScanResponse {
  scan: { id: string; brandId: string; status: string };
  results: ScanResult[];
  stats: {
    total: number;
    mentioned: number;
    mentionRate: number;
    avgScore: number;
  };
  recommendations: Recommendation[];
  competitorPlaybook: CompetitorPlaybookEntry[];
}

export interface TimelinePoint {
  scanId: string;
  date: string;
  avgScore: number;
  mentionRate: number;
  totalCalls: number;
  mentioned: number;
}

export interface AnalyticsResponse {
  brand: string;
  timeline: TimelinePoint[];
  byEngine: Record<
    string,
    {
      avgScore: number;
      mentionRate: number;
      totalCalls: number;
    }
  >;
  overall: {
    totalScans: number;
    mentionRate: number;
    avgScore: number;
  };
}

export interface Brand {
  id: string;
  name: string;
  createdAt: string;
}

export interface ScanHistoryItem {
  scanId: string;
  brandId: string;
  status: 'running' | 'done' | 'failed';
  createdAt: string;
  completedAt: string | null;
  anomaly: boolean;
  anomalyDelta: number;
}

export interface CreateScanResponse {
  scanId: string;
  brandId: string;
}

export interface SeoCompetitor {
  domain: string;
  position: number;
  title: string;
  url: string;
}

export type SerpFeature =
  | 'featured_snippet'
  | 'people_also_ask'
  | 'knowledge_panel'
  | 'images'
  | 'video'
  | 'shopping'
  | 'local_pack'
  | 'ads_top'
  | 'ads_bottom';

export interface SeoResult {
  keyword: string;
  position: number | null;
  url: string | null;
  title: string | null;
  found: boolean;
  topCompetitors?: SeoCompetitor[];
  serpFeatures?: SerpFeature[];
}

export interface SeoScan {
  id?: string;
  brandId: string;
  brand: string;
  status: 'running' | 'done' | 'failed';
  createdAt: string;
  completedAt?: string;
  keywords: string[];
  results?: SeoResult[];
}

export interface SeoSite {
  id: string;
  brandId: string;
  brand: string;
  domain: string;
  country: string;
  language?: string;
  discoveredKeywords?: string[];
  autoCompetitors?: string[];
  createdAt: string;
  lastScanAt?: string;
}

export type SeoAnomalyType =
  | 'position_drop'
  | 'position_gain'
  | 'coverage_drop'
  | 'coverage_gain'
  | 'keyword_lost'
  | 'keyword_gained';

export type SeoAnomalySeverity = 'high' | 'medium' | 'low' | 'info';

export interface SeoAnomaly {
  type: SeoAnomalyType;
  severity: SeoAnomalySeverity;
  message: string;
  delta?: number;
  keywords?: string[];
}

export interface SeoSiteScan {
  id: string;
  siteId: string;
  domain: string;
  brand: string;
  country: string;
  status: 'running' | 'done' | 'failed';
  createdAt: string;
  completedAt?: string;
  keywords: string[];
  results?: SeoResult[];
  competitorMap?: Record<string, number>;
  avgPosition?: number | null;
  rankedCount?: number;
  totalKeywords?: number;
  anomalies?: SeoAnomaly[];
}

export interface CreateSeoSiteResponse {
  siteId: string;
  brandId: string;
  domain: string;
}

export interface SeoCompareResponse {
  sites: Array<{
    site: SeoSite;
    scan: SeoSiteScan | null;
  }>;
  keywordOverlap: Array<{
    keyword: string;
    byDomain: Record<string, number | null>;
  }>;
}

export interface SchedulerStatus {
  enabled: boolean;
  cron: string;
  nextRun: string | null;
  lastRun: string | null;
  lastRunResult: string | null;
}

export interface CompetitorTrendPoint {
  date: string;
  avgScore: number;
  mentionRate: number;
}

export interface CompetitorTrend {
  name: string;
  timeline: CompetitorTrendPoint[];
}

export interface BrandComparisonResult {
  brand: string;
  stats: {
    total: number;
    mentioned: number;
    mentionRate: number;
    avgScore: number;
  };
  byEngine: Record<string, {
    mentionRate: number;
    avgScore: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
}

export interface AlertSettings {
  alertThreshold: number | null;
  alertEmail: string | null;
  webhookUrl: string | null;
  reportFrequency: 'weekly' | 'monthly' | 'disabled' | null;
  reportEmail: string | null;
}

export interface AlertSettingsInput {
  alertThreshold?: number;
  alertEmail?: string;
  webhookUrl?: string;
  reportFrequency?: 'weekly' | 'monthly' | 'disabled';
  reportEmail?: string;
}

export interface SovResult {
  name: string;
  mentions: number;
  sovPercent: number;
}

export interface PromptCoverageRow {
  intent: string;
  label: string;
  byEngine: Record<string, boolean | null>;
}

export interface PromptCoverageResponse {
  brand: string;
  scanId: string | null;
  coverage: PromptCoverageRow[];
}

export interface ScanProgressEvent {
  type: 'progress' | 'done' | 'error';
  completed?: number;
  total?: number;
  message?: string;
}

export const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api';

// api calls

export const api = {
  createScan: async (brand: string, category: string) => {
    const res = await http.post<CreateScanResponse>("/scans", { brand, category });
    return res.data;
  },

  getScan: async (brandId: string, scanId: string) => {
    const res = await http.get<ScanResponse>(`/scans/${brandId}/${scanId}`);
    return res.data;
  },

  getAnalytics: async (brand: string) => {
    const res = await http.get<AnalyticsResponse>("/analytics", {
      params: { brand },
    });
    return res.data;
  },

  getBrands: async () => {
    const res = await http.get<Brand[]>("/analytics/brands");
    return res.data;
  },

  listScans: async (brand: string) => {
    const res = await http.get<ScanHistoryItem[]>("/scans", { params: { brand } });
    return res.data;
  },

  compareBrands: async (brands: string[], category: string) => {
    const res = await http.post<BrandComparisonResult[]>("/scans/compare", { brands, category });
    return res.data;
  },

  getCompetitorTrends: async (brands: string[]) => {
    const res = await http.get<CompetitorTrend[]>("/analytics/competitors", {
      params: { brands: brands.join(',') },
    });
    return res.data;
  },

  createSeoScan: async (brand: string, keywords: string[]) => {
    const res = await http.post<CreateScanResponse>("/seo/scans", { brand, keywords });
    return res.data;
  },

  getSeoScan: async (brandId: string, scanId: string) => {
    const res = await http.get<SeoScan>(`/seo/scans/${brandId}/${scanId}`);
    return res.data;
  },

  listSeoScans: async (brand: string) => {
    const res = await http.get<SeoScan[]>("/seo/scans", { params: { brand } });
    return res.data;
  },

  // ── Semrush-style: Site management ──
  createSeoSite: async (input: {
    brand: string;
    domain: string;
    country: string;
    language?: string;
  }) => {
    const res = await http.post<CreateSeoSiteResponse>('/seo/sites', input);
    return res.data;
  },

  listSeoSites: async (brand?: string) => {
    const res = await http.get<SeoSite[]>('/seo/sites', { params: brand ? { brand } : {} });
    return res.data;
  },

  getSeoSite: async (siteId: string) => {
    const res = await http.get<SeoSite>(`/seo/sites/${siteId}`);
    return res.data;
  },

  runSeoSiteScan: async (siteId: string) => {
    const res = await http.post<{ scanId: string }>(`/seo/sites/${siteId}/scan`);
    return res.data;
  },

  listSeoSiteScans: async (siteId: string) => {
    const res = await http.get<SeoSiteScan[]>(`/seo/sites/${siteId}/scans`);
    return res.data;
  },

  getSeoSiteScan: async (siteId: string, scanId: string) => {
    const res = await http.get<SeoSiteScan>(`/seo/sites/${siteId}/scans/${scanId}`);
    return res.data;
  },

  compareSeoSites: async (siteIds: string[]) => {
    const res = await http.get<SeoCompareResponse>('/seo/compare', {
      params: { siteIds: siteIds.join(',') },
    });
    return res.data;
  },

  // ── Scheduler ──
  getSchedulerStatus: async () => {
    const res = await http.get<SchedulerStatus>('/scheduler/status');
    return res.data;
  },

  enableScheduler: async (cron: string) => {
    const res = await http.post<SchedulerStatus>('/scheduler/enable', { cron });
    return res.data;
  },

  disableScheduler: async () => {
    const res = await http.post<SchedulerStatus>('/scheduler/disable');
    return res.data;
  },

  runSchedulerNow: async () => {
    const res = await http.post<{ started: number }>('/scheduler/run-now');
    return res.data;
  },

  getAlertSettings: async (brandId: string) => {
    const res = await http.get<AlertSettings>(`/alerts/settings/${brandId}`);
    return res.data;
  },

  saveAlertSettings: async (brandId: string, input: AlertSettingsInput) => {
    const res = await http.post<AlertSettings>(`/alerts/settings/${brandId}`, input);
    return res.data;
  },

  testWebhook: async (brandId: string) => {
    await http.post(`/alerts/test/${brandId}`);
  },

  getPromptCoverage: async (brand: string) => {
    const res = await http.get<PromptCoverageResponse>('/analytics/coverage', { params: { brand } });
    return res.data;
  },

  generateContent: async (
    brand: string,
    category: string,
    platform: 'gmb' | 'linkedin' | 'blog' | 'twitter',
    topic: string,
    mentionRate?: number,
    avgScore?: number,
  ) => {
    const res = await http.post<{ content: string }>('/scans/content', {
      brand,
      category,
      platform,
      topic,
      mentionRate,
      avgScore,
    });
    return res.data;
  },
};
