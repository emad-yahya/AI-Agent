/**
 * Integration tests for ScansService.
 * Firebase is mocked at the service level (no emulator required).
 * AIService.callLLM is mocked to avoid real API calls.
 * Tests verify full service wiring: createScan, getScanResults, listScansByBrand, compareBrands.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { ScansService } from './scans.service';
import { AIService } from 'src/ai/ai.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import { AlertsService } from 'src/alerts/alerts.service';
import { ScanEventsService } from './scan-events.service';

// ── Firestore in-memory helpers ───────────────────────────────────────────────

function makeTimestamp() {
  return { toDate: () => new Date('2026-01-01T00:00:00.000Z') };
}

function makeDocRef(id: string, data: Record<string, unknown>) {
  const stored: Record<string, unknown> = { ...data };
  return {
    id,
    set: jest.fn((d: Record<string, unknown>) => {
      Object.assign(stored, d);
      return Promise.resolve();
    }),
    update: jest.fn((d: Record<string, unknown>) => {
      Object.assign(stored, d);
      return Promise.resolve();
    }),
    get: jest.fn(() =>
      Promise.resolve({ exists: true, id, data: () => ({ ...stored }) }),
    ),
  };
}

function makeCollectionRef(docs: ReturnType<typeof makeDocRef>[]) {
  const refs = new Map(docs.map((d) => [d.id, d]));
  return {
    doc: jest.fn((id?: string) => {
      const key = id ?? `auto-${Math.random().toString(36).slice(2)}`;
      if (!refs.has(key)) refs.set(key, makeDocRef(key, {}));
      return refs.get(key)!;
    }),
    add: jest.fn((data: Record<string, unknown>) => {
      const key = `auto-${Math.random().toString(36).slice(2)}`;
      const ref = makeDocRef(key, data);
      refs.set(key, ref);
      return Promise.resolve(ref);
    }),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    get: jest.fn(() =>
      Promise.resolve({
        empty: refs.size === 0,
        docs: [...refs.values()].map((r) => ({
          id: r.id,
          ref: r,
          data: (): Record<string, unknown> => ({}),
        })),
      }),
    ),
  };
}

// ── Build service under test ──────────────────────────────────────────────────

async function buildModule() {
  const brandRef = makeDocRef('brand-1', {
    name: 'Bosch',
    category: 'appliances',
    createdAt: makeTimestamp(),
  });
  const scanRef = makeDocRef('scan-1', {
    brandId: 'brand-1',
    status: 'done',
    createdAt: makeTimestamp(),
    completedAt: makeTimestamp(),
  });
  const resultRef = makeDocRef('result-1', {
    scanId: 'scan-1',
    engine: 'chatgpt-style',
    prompt: 'test prompt',
    response: '1. Bosch — excellent appliance.',
    mentioned: true,
    position: 1,
    sentiment: 'positive',
    visibilityScore: 100,
    createdAt: makeTimestamp(),
  });

  const brandsCollection = makeCollectionRef([brandRef]);
  const scansCollection = makeCollectionRef([scanRef]);
  const resultsCollection = makeCollectionRef([resultRef]);

  // Wire where() on brandsCollection to simulate brand lookup by name
  brandsCollection.where.mockReturnValue({
    limit: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: 'brand-1', ref: brandRef, data: () => brandRef }],
      }),
    }),
  });

  // Wire orderBy on scansCollection to simulate scan list
  scansCollection.orderBy.mockReturnValue({
    get: jest.fn().mockResolvedValue({
      docs: [
        {
          id: 'scan-1',
          data: () => ({
            brandId: 'brand-1',
            status: 'done',
            createdAt: makeTimestamp(),
            completedAt: makeTimestamp(),
          }),
        },
      ],
    }),
  });

  // Wire orderBy on resultsCollection
  resultsCollection.orderBy.mockReturnValue({
    get: jest.fn().mockResolvedValue({
      docs: [
        {
          id: 'result-1',
          data: () => ({
            scanId: 'scan-1',
            engine: 'chatgpt-style',
            prompt: 'test prompt',
            response: '1. Bosch — excellent appliance.',
            mentioned: true,
            position: 1,
            sentiment: 'positive',
            visibilityScore: 100,
            createdAt: makeTimestamp(),
          }),
        },
      ],
    }),
  });

  const batchMock = {
    set: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const scanSummaryDoc = {
    set: jest.fn(() => Promise.resolve()),
  };
  const scanSummariesCollection = {
    doc: jest.fn(() => scanSummaryDoc),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ size: 0, docs: [] }),
  };

  const mockFirebase: Partial<FirebaseService> = {
    brands: jest.fn().mockReturnValue(brandsCollection),
    scans: jest.fn().mockReturnValue(scansCollection),
    results: jest.fn().mockReturnValue(resultsCollection),
    scanSummaries: jest.fn().mockReturnValue(scanSummariesCollection),
    alertSettings: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({ exists: false }),
      set: jest.fn().mockResolvedValue(undefined),
    }),
    now: jest.fn().mockReturnValue(makeTimestamp()),
    getDb: jest
      .fn()
      .mockReturnValue({ batch: jest.fn().mockReturnValue(batchMock) }),
  };

  const mockConfig: Record<string, string | number> = {
    ANTHROPIC_API_KEY: 'sk-ant-test',
    OPENROUTER_API_KEY: 'sk-or-test',
    AI_PROVIDER: 'openrouter',
    AI_MAX_ENGINES: 1,
    AI_MAX_PROMPTS: 1,
    AI_CONCURRENCY: 1,
    AI_DELAY_MS: 0,
  };

  const mockAlerts: Partial<AlertsService> = {
    checkAndAlert: jest.fn().mockResolvedValue(undefined),
    getAlertSettings: jest.fn().mockResolvedValue({
      alertThreshold: null,
      alertEmail: null,
      webhookUrl: null,
    }),
    saveAlertSettings: jest.fn().mockResolvedValue({
      alertThreshold: null,
      alertEmail: null,
      webhookUrl: null,
    }),
    sendWebhookTest: jest.fn().mockResolvedValue(undefined),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      ScansService,
      ScanEventsService,
      AIService,
      {
        provide: FirebaseService,
        useValue: mockFirebase,
      },
      {
        provide: AlertsService,
        useValue: mockAlerts,
      },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, def?: unknown) =>
            key in mockConfig ? mockConfig[key] : def,
        },
      },
    ],
  }).compile();

  const service = moduleRef.get(ScansService);
  const ai = moduleRef.get(AIService);

  jest
    .spyOn(ai as unknown as { callLLM: () => Promise<string> }, 'callLLM')
    .mockResolvedValue(
      '1. Bosch — excellent appliance recommended by experts.',
    );

  return { service, mockFirebase };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ScansService integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('createScan', () => {
    it('returns { scanId, brandId } immediately', async () => {
      const { service } = await buildModule();
      const result = await service.createScan({
        brand: 'Bosch',
        category: 'appliances',
      });
      expect(result).toHaveProperty('scanId');
      expect(result).toHaveProperty('brandId');
      expect(typeof result.scanId).toBe('string');
      expect(typeof result.brandId).toBe('string');
    });

    it('calls firebase.brands() to get-or-create brand', async () => {
      const { service, mockFirebase } = await buildModule();
      await service.createScan({ brand: 'Bosch', category: 'appliances' });
      expect(mockFirebase.brands).toHaveBeenCalled();
    });

    it('calls firebase.scans() to create scan document', async () => {
      const { service, mockFirebase } = await buildModule();
      await service.createScan({ brand: 'Bosch', category: 'appliances' });
      expect(mockFirebase.scans).toHaveBeenCalled();
    });
  });

  describe('getScanResults', () => {
    it('returns scan + results + stats', async () => {
      const { service } = await buildModule();
      const result = await service.getScanResults('brand-1', 'scan-1');
      expect(result).toHaveProperty('scan');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('stats');
    });

    it('stats are correctly computed from mock results', async () => {
      const { service } = await buildModule();
      const result = await service.getScanResults('brand-1', 'scan-1');
      expect(result.stats.total).toBe(1);
      expect(result.stats.mentioned).toBe(1);
      expect(result.stats.mentionRate).toBe(100);
      expect(result.stats.avgScore).toBe(100);
    });

    it('throws NotFoundException for unknown scan', async () => {
      const { service, mockFirebase } = await buildModule();
      const notFoundRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
      };
      const missingScansCol = { doc: jest.fn().mockReturnValue(notFoundRef) };
      (mockFirebase.scans as jest.Mock).mockReturnValue(missingScansCol);

      await expect(
        service.getScanResults('brand-1', 'missing-scan'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listScansByBrand', () => {
    it('returns scan list with correct shape', async () => {
      const { service } = await buildModule();
      const list = await service.listScansByBrand('Bosch');
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      const item = list[0];
      expect(item).toHaveProperty('scanId');
      expect(item).toHaveProperty('brandId');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('createdAt');
    });

    it('throws NotFoundException for unknown brand', async () => {
      const { service, mockFirebase } = await buildModule();
      const emptyBrandsQuery = {
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      };
      (mockFirebase.brands as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnValue(emptyBrandsQuery),
      });

      await expect(service.listScansByBrand('UnknownBrand')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('compareBrands', () => {
    it('returns comparison result for each brand', async () => {
      const { service } = await buildModule();
      const results = await service.compareBrands({
        brands: ['Bosch', 'Samsung'],
        category: 'appliances',
      });
      expect(results.length).toBe(2);
      expect(results[0].brand).toBe('Bosch');
      expect(results[1].brand).toBe('Samsung');
    });

    it('each result has stats and byEngine', async () => {
      const { service } = await buildModule();
      const results = await service.compareBrands({
        brands: ['Bosch', 'Samsung'],
        category: 'appliances',
      });
      for (const r of results) {
        expect(r).toHaveProperty('stats');
        expect(r).toHaveProperty('byEngine');
        expect(r.stats).toHaveProperty('mentionRate');
        expect(r.stats).toHaveProperty('avgScore');
      }
    });
  });
});
