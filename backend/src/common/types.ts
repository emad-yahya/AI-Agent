import { firestore } from 'firebase-admin';

export type ScanStatus = 'pending' | 'running' | 'done' | 'failed';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type Engine = 'chatgpt-style' | 'gemini-style' | 'perplexity-style';

export interface Brand {
  id?: string;
  name: string;
  createdAt: firestore.Timestamp;
}

export interface Scan {
  id?: string;
  brandId: string;
  status: ScanStatus;
  createdAt: firestore.Timestamp;
  completedAt?: firestore.Timestamp;
}

export interface ScanResult {
  id?: string;
  scanId: string;
  engine: Engine;
  prompt: string;
  response: string;
  mentioned: boolean;
  position: number | null;
  sentiment: Sentiment;
  visibilityScore: number;
  createdAt: firestore.Timestamp;
}
