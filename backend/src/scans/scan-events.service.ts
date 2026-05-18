import { Injectable } from '@nestjs/common';

export interface ScanProgressEvent {
  type: 'progress' | 'done' | 'error';
  completed?: number;
  total?: number;
  message?: string;
}

@Injectable()
export class ScanEventsService {
  private readonly listeners = new Map<
    string,
    Set<(e: ScanProgressEvent) => void>
  >();

  emit(scanId: string, event: ScanProgressEvent): void {
    this.listeners.get(scanId)?.forEach((h) => h(event));
  }

  subscribe(
    scanId: string,
    handler: (e: ScanProgressEvent) => void,
  ): () => void {
    if (!this.listeners.has(scanId)) this.listeners.set(scanId, new Set());
    this.listeners.get(scanId)!.add(handler);
    return () => {
      const set = this.listeners.get(scanId);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) this.listeners.delete(scanId);
    };
  }
}
