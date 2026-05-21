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
  citations?: string[];
}

export interface ScanResponse {
  scan: { id: string; brandId: string; status: string };
  results: ScanResult[];
  stats: {
    total: number;
    mentioned: number;
    mentionRate: number;
    avgScore: number;
    // Real visibility = unbiased prompts (no brand name in prompt).
    // Echo rate = prompts that explicitly name the brand.
    realTotal?: number;
    realMentioned?: number;
    realMentionRate?: number;
    realAvgScore?: number;
    echoTotal?: number;
    echoMentioned?: number;
    echoMentionRate?: number;
    echoAvgScore?: number;
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
  category?: string | null;
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

export interface ListicleArticle {
  url: string;
  domain: string;
  title: string;
  query: string;
  position: number;
  mentionsBrand: boolean;
  competitorsFound: string[];
}

export interface CompetitorGap {
  competitor: string;
  totalArticles: number;
  brandAlsoMentioned: number;
  gapArticles: number;
  sampleArticles: Array<{ url: string; domain: string; title: string }>;
}

export interface ListicleGapScan {
  id?: string;
  brandId: string;
  brand: string;
  category: string;
  status: 'running' | 'done' | 'failed';
  createdAt: string | { seconds: number };
  completedAt?: string | { seconds: number };
  queries: string[];
  competitors: string[];
  articles?: ListicleArticle[];
  competitorGaps?: CompetitorGap[];
  brandCoveragePercent?: number;
  totalArticles?: number;
  brandMentionedCount?: number;
}

export type GeoActionCategory =
  | 'schema'
  | 'crawler-access'
  | 'citation'
  | 'listicle'
  | 'engine-weakness'
  | 'presence'
  | 'content';

export type GeoActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface GeoActionPlaybook {
  why?: string;
  codeBlocks?: Array<{
    label: string;
    language: 'html' | 'json' | 'text' | 'bash' | 'markdown' | 'xml';
    content: string;
  }>;
  verifySteps?: string[];
  timeline?: string;
  pitfalls?: string[];
  resources?: Array<{ label: string; url: string }>;
}

export interface GeoAction {
  id: string;
  category: GeoActionCategory;
  priority: GeoActionPriority;
  title: string;
  description: string;
  steps: string[];
  effort: '15m' | '1h' | 'half-day' | '1d' | 'ongoing';
  expectedImpact: string;
  evidence: {
    type: 'ai-scan' | 'citation' | 'listicle-gap' | 'competitor-audit' | 'brand-presence';
    scanId?: string;
    scanType?: string;
    detail?: string;
    urls?: string[];
    values?: Record<string, string | number | boolean>;
  };
  score: number;
  playbook?: GeoActionPlaybook;
}

export interface GeoActionsReport {
  brand: string;
  generatedAt: string;
  actions: GeoAction[];
  sources: {
    hasAiScan: boolean;
    hasListicleGap: boolean;
    hasCompetitorAudit: boolean;
    hasBrandPresence?: boolean;
    aiScanId?: string;
    listicleGapScanId?: string;
    competitorAuditScanId?: string;
    brandPresenceReportId?: string;
  };
  summary: {
    total: number;
    byPriority: Record<GeoActionPriority, number>;
    byCategory: Record<GeoActionCategory, number>;
  };
}

export interface BrandPresenceCheck {
  name: string;
  hasKnowledgePanel: boolean;
  knowledgePanelTitle?: string;
  knowledgePanelDescription?: string;
  hasWikipedia: boolean;
  wikipediaUrl?: string;
  wikipediaExtract?: string;
  presenceScore: number;
  signals: Array<{ key: string; label: string; passed: boolean }>;
}

export interface BrandPresenceReport {
  id?: string;
  brandId: string;
  brand: string;
  status: 'running' | 'done' | 'failed';
  createdAt: string | { seconds: number };
  completedAt?: string | { seconds: number };
  brandCheck?: BrandPresenceCheck;
  competitorChecks?: BrandPresenceCheck[];
  gapSummary?: Array<{
    key: string;
    label: string;
    yourStatus: boolean;
    competitorsWithIt: number;
    totalCompetitors: number;
  }>;
}

export interface AiBotAccess {
  GPTBot: boolean;
  ChatGPTUser: boolean;
  ClaudeBot: boolean;
  AnthropicAI: boolean;
  GoogleExtended: boolean;
  PerplexityBot: boolean;
  CCBot: boolean;
  AppleBotExtended: boolean;
}

export interface SiteAudit {
  name: string;
  domain: string;
  url: string;
  status: 'ok' | 'unreachable';
  schemas: string[];
  hasOrganization: boolean;
  hasLocalBusiness: boolean;
  hasFAQ: boolean;
  hasReview: boolean;
  hasBreadcrumb: boolean;
  hasArticle: boolean;
  hasLlmsTxt: boolean;
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
  aiBots: AiBotAccess;
  hasMetaDescription: boolean;
  hasOgTags: boolean;
  indexedPages: number | null;
  score: number;
  scoreOutOf: number;
  signals: Array<{ key: string; label: string; passed: boolean }>;
}

export interface CompetitorAuditScan {
  id?: string;
  brandId: string;
  brand: string;
  brandDomain: string;
  status: 'running' | 'done' | 'failed';
  createdAt: string | { seconds: number };
  completedAt?: string | { seconds: number };
  brandAudit?: SiteAudit;
  competitorAudits?: SiteAudit[];
  gapSummary?: Array<{
    key: string;
    label: string;
    yourStatus: boolean;
    competitorsWithIt: number;
    totalCompetitors: number;
  }>;
}

export interface ScanProgressEvent {
  type: 'progress' | 'done' | 'error';
  completed?: number;
  total?: number;
  message?: string;
}

// ── Generators types ──────────────────────────────────────────────────────

export interface GeneratorResult {
  jsonLd: Record<string, unknown>;
  htmlSnippet: string;
  installInstructions: string[];
}

export interface LlmsTxtResult {
  filename: string;
  content: string;
  installInstructions: string[];
}

export interface RobotsPatchResult {
  filename: string;
  patch: string;
  fullFile: string;
  installInstructions: string[];
  botsAdded: string[];
}

export interface OrgSchemaPayload {
  type:
    | 'Organization'
    | 'LocalBusiness'
    | 'RealEstateAgent'
    | 'Store'
    | 'Restaurant'
    | 'ProfessionalService';
  name: string;
  url: string;
  logo?: string;
  description?: string;
  telephone?: string;
  email?: string;
  address?: {
    streetAddress: string;
    addressLocality: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry: string;
  };
  social?: {
    linkedin?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
    wikipedia?: string;
    crunchbase?: string;
  };
}

export interface ArticleSchemaPayload {
  headline: string;
  url: string;
  image?: string;
  authorName: string;
  authorUrl?: string;
  publisherName: string;
  publisherLogo?: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
}

export interface ReviewSchemaPayload {
  itemName: string;
  ratingValue: string;
  reviewCount: string;
  reviews: Array<{ author: string; reviewBody: string; rating: string }>;
}

export interface LlmsTxtPayload {
  siteName: string;
  siteUrl: string;
  summary: string;
  details?: string;
  primaryLinks?: Array<{ title: string; url: string; description?: string }>;
  optionalLinks?: Array<{ title: string; url: string; description?: string }>;
  contactEmail?: string;
}

export interface RobotsPatchPayload {
  existingRobotsTxt?: string;
  sitemapUrl?: string;
}

// ── On-Page SEO types ─────────────────────────────────────────────────────

export interface PageSeoIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  code: string;
  message: string;
  fix?: string;
}

export interface PageSeoAudit {
  url: string;
  fetched: boolean;
  fetchError?: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1Count: number;
  h1Texts: string[];
  h2Count: number;
  canonical: string | null;
  hasOgImage: boolean;
  hasTwitterCard: boolean;
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
  imagesWithAltCount: number;
  wordCount: number;
  langAttr: string | null;
  hasHtmlLang: boolean;
  hasViewport: boolean;
  hasStructuredData: boolean;
  brokenAnchorCount: number;
  issues: PageSeoIssue[];
  score: number;
  scoreOutOf: number;
}

export interface CoreWebVitals {
  url: string;
  fetched: boolean;
  fetchError?: string;
  performanceScore: number | null;
  lcp: { value: number; displayValue: string; score: number | null } | null;
  cls: { value: number; displayValue: string; score: number | null } | null;
  inp: { value: number; displayValue: string; score: number | null } | null;
  tbt: { value: number; displayValue: string; score: number | null } | null;
  fcp: { value: number; displayValue: string; score: number | null } | null;
  ttfb: { value: number; displayValue: string; score: number | null } | null;
  strategy: 'mobile' | 'desktop';
}

export interface OnPageSeoReport {
  id?: string;
  brandId: string;
  brand: string;
  domain: string;
  status: 'running' | 'done' | 'failed';
  createdAt: string | { _seconds: number };
  completedAt?: string | { _seconds: number };
  pages?: PageSeoAudit[];
  vitals?: CoreWebVitals[];
  summary?: {
    avgScore: number;
    totalIssues: number;
    criticalIssues: number;
    pagesAudited: number;
    avgPerformance: number | null;
  };
  topIssues?: Array<{
    code: string;
    count: number;
    message: string;
    severity: PageSeoIssue['severity'];
  }>;
}

// ── Content Gap types ─────────────────────────────────────────────────────

export interface ContentGapItem {
  query: string;
  brandHasPage: boolean;
  brandUrl?: string;
  brandPosition?: number | null;
  competitorsRanking: Array<{
    domain: string;
    url: string;
    position: number;
    title: string;
  }>;
  paa?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  opportunityScore: number;
}

export interface ContentGapReport {
  id?: string;
  brandId: string;
  brand: string;
  domain: string;
  status: 'running' | 'done' | 'failed';
  createdAt: string | { _seconds: number };
  completedAt?: string | { _seconds: number };
  queries?: string[];
  items?: ContentGapItem[];
  summary?: {
    totalQueries: number;
    brandHasPageCount: number;
    gapCount: number;
    avgOpportunity: number;
  };
}

export interface PaaResult {
  seed: string;
  questions: string[];
  relatedSearches: string[];
}

// ── Onboarding types ──────────────────────────────────────────────────────

export interface OnboardingAnalysis {
  domain: string;
  brand: string;
  category: string | null;
  categoryAudience?: string | null;
  categoryGeo?: string | null;
  categoryModel?: string | null;
  categorySource?: 'llm' | 'regex' | 'none';
  country: string;
  keywords: string[];
  suggestedCompetitors: string[];
  crawlError: string | null;
}

export interface OnboardingStartResult {
  aiScan: { ok: boolean; data?: { scanId: string; brandId: string }; error?: string };
  competitorAudit: { ok: boolean; data?: { scanId: string; brandId: string }; error?: string };
  brandPresence: { ok: boolean; data?: { reportId: string; brandId: string }; error?: string };
  onPageSeo: { ok: boolean; data?: { reportId: string; brandId: string }; error?: string };
}

export const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api';

// api calls

export const api = {
  createScan: async (
    brand: string,
    category: string,
    mode: 'quick' | 'full' = 'quick',
  ) => {
    const res = await http.post<CreateScanResponse>("/scans", {
      brand,
      category,
      mode,
    });
    return res.data;
  },

  suggestCategories: async (brand: string) => {
    const res = await http.get<{ categories: string[] }>(
      "/scans/suggest-categories",
      { params: { brand } },
    );
    return res.data.categories;
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

  createListicleGapScan: async (
    brand: string,
    category: string,
    competitors?: string[],
    country?: string,
  ) => {
    const res = await http.post<{ scanId: string; brandId: string }>(
      '/listicle-gap/scan',
      { brand, category, competitors, country },
    );
    return res.data;
  },

  getListicleGapScan: async (brandId: string, scanId: string) => {
    const res = await http.get<ListicleGapScan>(
      `/listicle-gap/${brandId}/${scanId}`,
    );
    return res.data;
  },

  listListicleGapScans: async (brand: string) => {
    const res = await http.get<ListicleGapScan[]>('/listicle-gap', {
      params: { brand },
    });
    return res.data;
  },

  getGeoActions: async (brand: string) => {
    const res = await http.get<GeoActionsReport>('/geo-actions', {
      params: { brand },
    });
    return res.data;
  },

  createCompetitorAudit: async (
    brand: string,
    brandDomain: string,
    competitors: string[],
    country?: string,
  ) => {
    const res = await http.post<{ scanId: string; brandId: string }>(
      '/competitor-audit/scan',
      { brand, brandDomain, competitors, country },
    );
    return res.data;
  },

  getCompetitorAudit: async (brandId: string, scanId: string) => {
    const res = await http.get<CompetitorAuditScan>(
      `/competitor-audit/${brandId}/${scanId}`,
    );
    return res.data;
  },

  listCompetitorAudits: async (brand: string) => {
    const res = await http.get<CompetitorAuditScan[]>('/competitor-audit', {
      params: { brand },
    });
    return res.data;
  },

  createBrandPresenceCheck: async (
    brand: string,
    competitors: string[],
    country?: string,
  ) => {
    const res = await http.post<{ reportId: string; brandId: string }>(
      '/brand-presence/check',
      { brand, competitors, country },
    );
    return res.data;
  },

  getBrandPresenceReport: async (brandId: string, reportId: string) => {
    const res = await http.get<BrandPresenceReport>(
      `/brand-presence/${brandId}/${reportId}`,
    );
    return res.data;
  },

  listBrandPresenceReports: async (brand: string) => {
    const res = await http.get<BrandPresenceReport[]>('/brand-presence', {
      params: { brand },
    });
    return res.data;
  },

  generateGeoActions: async (brand: string) => {
    const res = await http.get<GeoActionsReport>('/geo-actions', {
      params: { brand },
    });
    return res.data;
  },

  // ── Generators (Phase A) ─────────────────────────────────────────────────

  generateFaqSchema: async (
    items: Array<{ question: string; answer: string }>,
  ) => {
    const res = await http.post<GeneratorResult>('/generators/schema/faq', {
      items,
    });
    return res.data;
  },

  generateFaqFromPaa: async (input: {
    questions: string[];
    brand: string;
    category?: string;
  }) => {
    const res = await http.post<GeneratorResult>(
      '/generators/schema/faq-from-paa',
      input,
    );
    return res.data;
  },

  generateOrgSchema: async (payload: OrgSchemaPayload) => {
    const res = await http.post<GeneratorResult>(
      '/generators/schema/organization',
      payload,
    );
    return res.data;
  },

  generateArticleSchema: async (payload: ArticleSchemaPayload) => {
    const res = await http.post<GeneratorResult>(
      '/generators/schema/article',
      payload,
    );
    return res.data;
  },

  generateReviewSchema: async (payload: ReviewSchemaPayload) => {
    const res = await http.post<GeneratorResult>(
      '/generators/schema/review',
      payload,
    );
    return res.data;
  },

  generateLlmsTxt: async (payload: LlmsTxtPayload) => {
    const res = await http.post<LlmsTxtResult>('/generators/llms-txt', payload);
    return res.data;
  },

  generateRobotsPatch: async (payload: RobotsPatchPayload) => {
    const res = await http.post<RobotsPatchResult>(
      '/generators/robots-patch',
      payload,
    );
    return res.data;
  },

  // ── On-Page SEO (Phase B) ────────────────────────────────────────────────

  createOnPageSeoScan: async (
    brand: string,
    domain: string,
    options?: { pages?: string[]; strategy?: 'mobile' | 'desktop' },
  ) => {
    const res = await http.post<{ reportId: string; brandId: string }>(
      '/on-page-seo/scan',
      { brand, domain, ...options },
    );
    return res.data;
  },

  getOnPageSeoReport: async (brandId: string, reportId: string) => {
    const res = await http.get<OnPageSeoReport>(
      `/on-page-seo/${brandId}/${reportId}`,
    );
    return res.data;
  },

  listOnPageSeoReports: async (brand: string) => {
    const res = await http.get<OnPageSeoReport[]>('/on-page-seo', {
      params: { brand },
    });
    return res.data;
  },

  // ── Content Gap (Phase C) ────────────────────────────────────────────────

  createContentGapScan: async (payload: {
    brand: string;
    domain: string;
    queries: string[];
    competitorDomains?: string[];
    country?: string;
  }) => {
    const res = await http.post<{ reportId: string; brandId: string }>(
      '/content-gap/scan',
      payload,
    );
    return res.data;
  },

  getContentGapReport: async (brandId: string, reportId: string) => {
    const res = await http.get<ContentGapReport>(
      `/content-gap/${brandId}/${reportId}`,
    );
    return res.data;
  },

  listContentGapReports: async (brand: string) => {
    const res = await http.get<ContentGapReport[]>('/content-gap', {
      params: { brand },
    });
    return res.data;
  },

  fetchPaa: async (seeds: string[], country?: string) => {
    const res = await http.post<PaaResult[]>('/content-gap/paa', {
      seeds,
      country,
    });
    return res.data;
  },

  // ── Onboarding (Phase E) ─────────────────────────────────────────────────

  analyzeOnboarding: async (domain: string, country?: string) => {
    const res = await http.post<OnboardingAnalysis>('/onboarding/analyze', {
      domain,
      country,
    });
    return res.data;
  },

  startOnboarding: async (payload: {
    brand: string;
    domain: string;
    category: string;
    competitors: string[];
    country?: string;
  }) => {
    const res = await http.post<OnboardingStartResult>(
      '/onboarding/start',
      payload,
    );
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

  getSystemHealth: async () => {
    const res = await http.get<SystemHealthResponse>('/system/health/integrations');
    return res.data;
  },

  generateContentBrief: async (input: {
    query: string;
    brand: string;
    category?: string;
    country?: string;
  }) => {
    const res = await http.post<ContentBrief>('/content-gap/brief', input);
    return res.data;
  },

  listActionCompletions: async (brand: string) => {
    const res = await http.get<Record<string, ActionCompletionState>>(
      '/geo-actions/completions',
      { params: { brand } },
    );
    return res.data;
  },

  setActionCompletion: async (
    brand: string,
    actionId: string,
    completed: boolean,
    notes?: string,
  ) => {
    const res = await http.post<{ ok: true; actionId: string; completed: boolean }>(
      '/geo-actions/completion',
      { brand, actionId, completed, notes },
    );
    return res.data;
  },

  getBrandProgress: async (brand: string) => {
    const res = await http.get<BrandProgress>('/geo-actions/progress', {
      params: { brand },
    });
    return res.data;
  },

  getBrandBenchmark: async (brand: string) => {
    const res = await http.get<BrandBenchmark>('/geo-actions/benchmark', {
      params: { brand },
    });
    return res.data;
  },

  getBrandDigest: async (brand: string) => {
    const res = await http.get<{ brand: string; generatedAt: string; markdown: string }>(
      '/geo-actions/digest',
      { params: { brand } },
    );
    return res.data;
  },
};

export interface BrandBenchmark {
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
}

export interface ActionCompletionState {
  completed: boolean;
  updatedAt: string;
  notes?: string;
}

export interface BrandProgress {
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
}

export interface ContentBrief {
  query: string;
  intent: string;
  intentReason: string;
  targetWordCount: number;
  title: string;
  metaDescription: string;
  h2Outline: Array<{ heading: string; bullets: string[] }>;
  entitiesToMention: string[];
  paaQuestions: string[];
  relatedSearches: string[];
  topCompetitors: Array<{ title: string; url: string; snippet: string }>;
  schemaSuggestions: string[];
  internalLinkSuggestions: string[];
  callToAction: string;
}

export type IntegrationStatus = 'ok' | 'missing' | 'invalid' | 'rate_limited' | 'unknown';

export interface IntegrationCheck {
  key: string;
  name: string;
  status: IntegrationStatus;
  required: boolean;
  envVar: string;
  description: string;
  setupUrl: string;
  setupSteps: string[];
  message?: string;
  cost?: string;
}

export interface SystemHealthResponse {
  checks: IntegrationCheck[];
  allOk: boolean;
  coreOk: boolean;
}
