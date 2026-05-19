import { firestore } from 'firebase-admin';

export type ScanStatus = 'pending' | 'running' | 'done' | 'failed';
export type ScanMode = 'quick' | 'full';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type Engine = 'chatgpt-style' | 'gemini-style' | 'perplexity-style';

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

export interface Brand {
  id?: string;
  name: string;
  category?: string;
  createdAt: firestore.Timestamp;
}

export interface Scan {
  id?: string;
  brandId: string;
  status: ScanStatus;
  mode?: ScanMode;
  createdAt: firestore.Timestamp;
  completedAt?: firestore.Timestamp;
  recommendations?: Recommendation[];
  competitorPlaybook?: CompetitorPlaybookEntry[];
  anomaly?: boolean;
  anomalyDelta?: number;
}

export interface ScanSummary {
  scanId: string;
  date: firestore.Timestamp;
  avgScore: number;
  mentionRate: number;
  total: number;
  mentioned: number;
  byEngine: Record<
    string,
    { avgScore: number; mentionRate: number; totalCalls: number }
  >;
}

export interface ScanResult {
  id?: string;
  scanId: string;
  engine: Engine;
  templateId?: string;
  prompt: string;
  response: string;
  mentioned: boolean;
  position: number | null;
  sentiment: Sentiment;
  visibilityScore: number;
  topics: string[];
  citations?: string[];
  createdAt: firestore.Timestamp;
}

export interface SeoResult {
  keyword: string;
  position: number | null;
  url: string | null;
  title: string | null;
  found: boolean;
  topCompetitors?: SeoCompetitor[];
  serpFeatures?: SerpFeature[];
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

export interface SeoScan {
  id?: string;
  brandId: string;
  brand: string;
  status: 'running' | 'done' | 'failed';
  createdAt: firestore.Timestamp;
  completedAt?: firestore.Timestamp;
  keywords: string[];
  results?: SeoResult[];
}

export interface SeoSite {
  id?: string;
  brandId: string;
  brand: string;
  domain: string;
  country: string;
  language?: string;
  discoveredKeywords?: string[];
  autoCompetitors?: string[];
  createdAt: firestore.Timestamp;
  lastScanAt?: firestore.Timestamp;
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
  scanId?: string;
  status: 'running' | 'done' | 'failed';
  createdAt: firestore.Timestamp;
  completedAt?: firestore.Timestamp;
  queries: string[];
  competitors: string[];
  articles?: ListicleArticle[];
  competitorGaps?: CompetitorGap[];
  brandCoveragePercent?: number;
  totalArticles?: number;
  brandMentionedCount?: number;
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
  createdAt: firestore.Timestamp;
  completedAt?: firestore.Timestamp;
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

export type GeoActionCategory =
  | 'schema'
  | 'crawler-access'
  | 'citation'
  | 'listicle'
  | 'engine-weakness'
  | 'presence'
  | 'content';

export type GeoActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface GeoActionEvidence {
  type:
    | 'ai-scan'
    | 'citation'
    | 'listicle-gap'
    | 'competitor-audit'
    | 'brand-presence';
  scanId?: string;
  scanType?: string;
  detail?: string;
  urls?: string[];
  values?: Record<string, string | number | boolean>;
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
  evidence: GeoActionEvidence;
  score: number;
}

export interface GeoActionsReport {
  brand: string;
  generatedAt: string;
  actions: GeoAction[];
  sources: {
    hasAiScan: boolean;
    hasListicleGap: boolean;
    hasCompetitorAudit: boolean;
    hasBrandPresence: boolean;
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
  createdAt: firestore.Timestamp;
  completedAt?: firestore.Timestamp;
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

export interface PageSeoIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  code: string;
  message: string;
  fix?: string;
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

export interface ContentGapItem {
  query: string;
  brandHasPage: boolean;
  brandUrl?: string;
  brandPosition?: number | null;
  competitorsRanking: Array<{ domain: string; url: string; position: number; title: string }>;
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
  createdAt: firestore.Timestamp;
  completedAt?: firestore.Timestamp;
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

export interface OnPageSeoReport {
  id?: string;
  brandId: string;
  brand: string;
  domain: string;
  status: 'running' | 'done' | 'failed';
  createdAt: firestore.Timestamp;
  completedAt?: firestore.Timestamp;
  pages?: PageSeoAudit[];
  vitals?: CoreWebVitals[];
  summary?: {
    avgScore: number;
    totalIssues: number;
    criticalIssues: number;
    pagesAudited: number;
    avgPerformance: number | null;
  };
  topIssues?: Array<{ code: string; count: number; message: string; severity: PageSeoIssue['severity'] }>;
}

export interface SeoSiteScan {
  id?: string;
  siteId: string;
  domain: string;
  brand: string;
  country: string;
  status: 'running' | 'done' | 'failed';
  createdAt: firestore.Timestamp;
  completedAt?: firestore.Timestamp;
  keywords: string[];
  results?: SeoResult[];
  competitorMap?: Record<string, number>;
  avgPosition?: number | null;
  rankedCount?: number;
  totalKeywords?: number;
  anomalies?: SeoAnomaly[];
}
