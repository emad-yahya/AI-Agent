import axios from "axios";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  headers: { "Content-Type": "application/json" },
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScanResult {
  id: string;
  engine: "chatgpt-style" | "gemini-style" | "perplexity-style";
  prompt: string;
  response: string;
  mentioned: boolean;
  position: number | null;
  sentiment: "positive" | "neutral" | "negative";
  visibilityScore: number;
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

export interface CreateScanResponse {
  scanId: string;
  brandId: string;
  resultCount: number;
}

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
};
