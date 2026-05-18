export const SCAN_QUEUE = 'scan';
export const SCAN_JOB = 'run-scan';

export interface ScanJobData {
  scanId: string;
  brandId: string;
  brand: string;
  category: string;
  mode?: 'quick' | 'full';
}
