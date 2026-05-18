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
