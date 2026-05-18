import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIService, RawResult } from './ai.service';
import { SEARCH_PROMPTS } from './prompts';

const mockConfig: Record<string, string | number> = {
  ANTHROPIC_API_KEY: 'sk-ant-test-key',
  OPENROUTER_API_KEY: 'sk-or-test-key',
  // No real engine keys — tests use callEngine mock (no real API calls)
  AI_PROVIDER: 'openrouter',
  OPENROUTER_MODEL: 'meta-llama/llama-3.3-70b-instruct:free',
  AI_MAX_ENGINES: 2,
  AI_MAX_PROMPTS: 2,
  AI_CONCURRENCY: 2,
  AI_DELAY_MS: 0,
};

function buildService(): Promise<AIService> {
  return Test.createTestingModule({
    providers: [
      AIService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, defaultVal?: unknown) =>
            key in mockConfig ? mockConfig[key] : defaultVal,
        },
      },
    ],
  })
    .compile()
    .then((m: TestingModule) => m.get(AIService));
}

type PrivateService = {
  callEngine: (
    engine: string,
    systemPrompt: string,
    userMessage: string,
  ) => Promise<{ text: string; citations: string[] }>;
};

describe('AIService', () => {
  let service: AIService;

  beforeEach(async () => {
    service = await buildService();
    // Spy on callEngine — no real API calls in tests
    jest
      .spyOn(service as unknown as PrivateService, 'callEngine')
      .mockResolvedValue({
        text: '1. Bosch — excellent appliances recommended by experts.',
        citations: [],
      });
    // Skip live LLM call for dynamic prompts — return static fallback
    jest
      .spyOn(service, 'generateCategoryPrompts')
      .mockResolvedValue(SEARCH_PROMPTS.slice(0, 2));
  });

  afterEach(() => jest.restoreAllMocks());

  describe('runScan', () => {
    it('returns array of RawResult', async () => {
      const results = await service.runScan({
        brand: 'Bosch',
        category: 'appliances',
      });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('each result has required fields', async () => {
      const results = await service.runScan({
        brand: 'Bosch',
        category: 'appliances',
      });
      for (const r of results) {
        expect(r).toHaveProperty('engine');
        expect(r).toHaveProperty('prompt');
        expect(r).toHaveProperty('response');
        expect(r).toHaveProperty('parsed');
        expect(r.parsed).toHaveProperty('mentioned');
        expect(r.parsed).toHaveProperty('position');
        expect(r.parsed).toHaveProperty('sentiment');
        expect(r.parsed).toHaveProperty('visibilityScore');
      }
    });

    it('parses mock response correctly — brand mentioned at position 1 positive', async () => {
      const results = await service.runScan({
        brand: 'Bosch',
        category: 'appliances',
      });
      for (const r of results) {
        expect(r.parsed.mentioned).toBe(true);
        expect(r.parsed.position).toBe(1);
        expect(r.parsed.sentiment).toBe('positive');
        expect(r.parsed.visibilityScore).toBe(100);
      }
    });

    it('calls callEngine once per (engine × prompt) combination', async () => {
      const callEngine = jest.spyOn(
        service as unknown as PrivateService,
        'callEngine',
      );
      await service.runScan({ brand: 'Bosch', category: 'appliances' });
      // AI_MAX_ENGINES=2, AI_MAX_PROMPTS=2 → 4 calls
      expect(callEngine).toHaveBeenCalledTimes(4);
    });

    it('calls onProgress after each concurrency batch', async () => {
      const onProgress = jest.fn<void, [number, number]>();
      await service.runScan(
        { brand: 'Bosch', category: 'appliances' },
        onProgress,
      );
      expect(onProgress).toHaveBeenCalled();
      // Last call: completed === total
      const calls = onProgress.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe(lastCall[1]);
    });

    it('skips failed individual calls and returns remaining results', async () => {
      let callCount = 0;
      jest
        .spyOn(service as unknown as PrivateService, 'callEngine')
        .mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.reject(new Error('API error'));
          return Promise.resolve({ text: 'Bosch is excellent.', citations: [] });
        });

      const results = await service.runScan({
        brand: 'Bosch',
        category: 'appliances',
      });
      // 4 total tasks, 1 fails → 3 results
      expect(results.length).toBe(3);
    });

    it('returns empty array when all calls fail', async () => {
      jest
        .spyOn(service as unknown as PrivateService, 'callEngine')
        .mockRejectedValue(new Error('API down'));

      const results = await service.runScan({
        brand: 'Bosch',
        category: 'appliances',
      });
      expect(results).toEqual([]);
    });
  });

  describe('runWithConcurrency (via runScan)', () => {
    it('respects AI_MAX_ENGINES limit', async () => {
      const callEngine = jest.spyOn(
        service as unknown as PrivateService,
        'callEngine',
      );
      await service.runScan({ brand: 'Test', category: 'tech' });
      expect(callEngine).toHaveBeenCalledTimes(
        (mockConfig['AI_MAX_ENGINES'] as number) *
          (mockConfig['AI_MAX_PROMPTS'] as number),
      );
    });

    it('returns results in same count as tasks when all succeed', async () => {
      const results = await service.runScan({ brand: 'X', category: 'y' });
      const expectedCount =
        (mockConfig['AI_MAX_ENGINES'] as number) *
        (mockConfig['AI_MAX_PROMPTS'] as number);
      expect(results.length).toBe(expectedCount);
    });
  });

  describe('result typing', () => {
    it('each result engine is a known Engine value', async () => {
      const validEngines = [
        'chatgpt-style',
        'gemini-style',
        'perplexity-style',
      ];
      const results = await service.runScan({
        brand: 'Bosch',
        category: 'appliances',
      });
      for (const r of results) {
        expect(validEngines).toContain(r.engine);
      }
    });

    it('visibilityScore is between 0 and 100', async () => {
      const results: RawResult[] = await service.runScan({
        brand: 'Bosch',
        category: 'appliances',
      });
      for (const r of results) {
        expect(r.parsed.visibilityScore).toBeGreaterThanOrEqual(0);
        expect(r.parsed.visibilityScore).toBeLessThanOrEqual(100);
      }
    });
  });
});
