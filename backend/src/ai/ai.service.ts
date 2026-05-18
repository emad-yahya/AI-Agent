import { Engine } from 'src/common/types';
import {
  buildPrompt,
  ENGINE_PERSONAS,
  PromptTemplate,
  SEARCH_PROMPTS,
} from './prompts';
import { ParsedResult, parseResponse } from './parser';
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI, Tool } from '@google/generative-ai';

export interface ScanInput {
  brand: string;
  category: string;
}

export interface RawResult {
  engine: Engine;
  template: PromptTemplate;
  prompt: string;
  response: string;
  parsed: ParsedResult;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly claude: Anthropic;
  private readonly openrouter: OpenAI;
  private readonly openai: OpenAI | null;
  private readonly gemini: GoogleGenerativeAI | null;

  private readonly provider: string;
  private readonly anthropicModel: string;
  private readonly openrouterModel: string;
  private readonly maxEngines: number;
  private readonly maxPrompts: number;
  private readonly concurrency: number;
  private readonly delayMs: number;

  // Cache of generated prompts per category (in-memory, survives until restart)
  private readonly promptCache = new Map<string, PromptTemplate[]>();

  // Cache of suggested categories per brand (in-memory)
  private readonly categorySuggestCache = new Map<string, string[]>();

  constructor(private config: ConfigService) {
    this.claude = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '',
    });
    this.openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.config.get<string>('OPENROUTER_API_KEY') ?? '',
    });

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    this.openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

    const geminiKey = this.config.get<string>('GOOGLE_GEMINI_API_KEY');
    this.gemini = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

    this.provider = this.config.get<string>('AI_PROVIDER', 'openrouter');
    this.anthropicModel = this.config.get<string>(
      'ANTHROPIC_MODEL',
      'claude-haiku-4-5',
    );
    this.openrouterModel = this.config.get<string>(
      'OPENROUTER_MODEL',
      'google/gemma-4-31b-it:free',
    );
    this.maxEngines = this.config.get<number>('AI_MAX_ENGINES', 3);
    this.maxPrompts = this.config.get<number>('AI_MAX_PROMPTS', 5);
    this.concurrency = this.config.get<number>('AI_CONCURRENCY', 2);
    this.delayMs = this.config.get<number>('AI_DELAY_MS', 2000);
  }

  private async callClaude(
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    const response = await this.claude.messages.create({
      model: this.anthropicModel,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }

  private async callOpenrouter(
    systemPrompt: string,
    userMessage: string,
    attempt = 0,
  ): Promise<string> {
    try {
      const response = await this.openrouter.chat.completions.create({
        model: this.openrouterModel,
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });
      return response.choices[0]?.message?.content ?? '';
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt === 0) {
        this.logger.warn(`OpenRouter 429 — retry in 30s`);
        await new Promise((r) => setTimeout(r, 30_000));
        return this.callOpenrouter(systemPrompt, userMessage, 1);
      }
      throw err;
    }
  }

  private async callLLM(
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    if (this.provider === 'openrouter') {
      return this.callOpenrouter(systemPrompt, userMessage);
    }
    return this.callClaude(systemPrompt, userMessage);
  }

  // Real OpenAI — chatgpt-style engine
  private async callOpenAI(
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY not set — falling back to OpenRouter');
      return this.callOpenrouter(systemPrompt, userMessage);
    }
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
      max_tokens: 400,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
  }

  // Real Gemini — gemini-style (no search) + perplexity-style (search grounding)
  private async callGemini(
    systemPrompt: string,
    userMessage: string,
    useSearch = false,
    attempt = 0,
  ): Promise<string> {
    if (!this.gemini) {
      this.logger.warn(
        'GOOGLE_GEMINI_API_KEY not set — falling back to OpenRouter',
      );
      return this.callOpenrouter(systemPrompt, userMessage);
    }
    const tools = useSearch
      ? ([{ googleSearch: {} }] as unknown as Tool[])
      : undefined;
    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0 },
      ...(tools ? { tools } : {}),
    });
    try {
      const result = await model.generateContent(userMessage);
      return result.response.text();
    } catch (err) {
      const msg = (err as Error).message ?? '';
      const is429 = msg.includes('429') || msg.includes('Too Many Requests');
      if (is429 && attempt < 2) {
        const retryMatch = msg.match(/retry in ([\d.]+)s/i);
        const waitMs = retryMatch
          ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500
          : 15000;
        this.logger.warn(`Gemini 429 — retry ${attempt + 1}/2 in ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        return this.callGemini(
          systemPrompt,
          userMessage,
          useSearch,
          attempt + 1,
        );
      }
      throw err;
    }
  }

  // Route each engine to its real API
  private async callEngine(
    engine: Engine,
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    switch (engine) {
      case 'chatgpt-style':
        return this.callOpenAI(systemPrompt, userMessage);
      case 'gemini-style':
        return this.callGemini(systemPrompt, userMessage, false);
      case 'perplexity-style':
        // Gemini + Google Search grounding = real web search, same as Perplexity
        return this.callGemini(systemPrompt, userMessage, true);
    }
  }

  private async runSingle(
    template: PromptTemplate,
    engine: Engine,
    brand: string,
    category: string,
  ): Promise<RawResult> {
    const prompt = buildPrompt(template, brand, category);
    const systemPrompt = ENGINE_PERSONAS[engine];

    this.logger.debug(`[${engine}] "${prompt.slice(0, 60)}..."`);

    const response = await this.callEngine(engine, systemPrompt, prompt);
    const parsed = parseResponse(response, brand);
    return { engine, template, prompt, response, parsed };
  }

  private async runWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number,
    delayMs: number,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = [];

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch.map((t) => t()));
      results.push(...batchResults);
      onProgress?.(results.length, tasks.length);

      if (i + concurrency < tasks.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    return results;
  }

  async generateText(prompt: string): Promise<string> {
    const system =
      'You are a helpful assistant. When asked for JSON, return only valid JSON with no explanation or markdown fences.';

    if (this.gemini) {
      const model = this.gemini.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        systemInstruction: system,
        generationConfig: { temperature: 0 },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    }

    if (this.provider === 'openrouter') {
      const res = await this.openrouter.chat.completions.create({
        model: this.openrouterModel,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      });
      return res.choices[0]?.message?.content ?? '';
    }
    const res = await this.claude.messages.create({
      model: this.anthropicModel,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = res.content[0];
    return block.type === 'text' ? block.text : '';
  }

  /**
   * Generates category-tailored search prompts via LLM.
   * Cached per normalized category so we only pay once per category.
   * Falls back to static SEARCH_PROMPTS on any failure.
   */
  async generateCategoryPrompts(category: string): Promise<PromptTemplate[]> {
    const key = category.trim().toLowerCase();
    if (!key) return SEARCH_PROMPTS.slice(0, this.maxPrompts);

    const cached = this.promptCache.get(key);
    if (cached) return cached;

    const llmPrompt = `You are designing market-research questions for an AI visibility tracker.

Generate exactly 5 diverse, natural-sounding questions that a real customer would type into ChatGPT/Gemini/Perplexity when researching the "${category}" market.

Requirements:
- Each question must read like a real human typed it (conversational, specific, not a template)
- 2 questions MUST include the literal placeholder {brand} where the brand name goes
- 3 questions MUST NOT mention any brand (pure category-level questions)
- Questions should encourage the AI to name specific companies/products in its answer
- Cover 5 distinct intents — best in category, alternatives, brand reputation, buying advice, market leaders

Return ONLY a JSON array — no markdown, no commentary. Exact format:
[
  {"id":"best_in_category","category":"recommendation","text":"..."},
  {"id":"top_alternatives","category":"alternatives","text":"... {brand} ..."},
  {"id":"brand_reputation","category":"reputation","text":"... {brand} ..."},
  {"id":"buying_advice","category":"buying","text":"..."},
  {"id":"market_leaders","category":"market","text":"..."}
]`;

    try {
      const raw = await this.generateText(llmPrompt);
      const parsed = this.parsePromptJson(raw);
      if (parsed.length === 5) {
        this.promptCache.set(key, parsed);
        this.logger.log(
          `Generated ${parsed.length} category-specific prompts for "${category}"`,
        );
        return parsed;
      }
      this.logger.warn(
        `Prompt generator returned ${parsed.length} prompts (expected 5) for "${category}" — using fallback`,
      );
    } catch (err) {
      this.logger.warn(
        `Prompt generation failed for "${category}": ${(err as Error).message} — using fallback`,
      );
    }

    return SEARCH_PROMPTS.slice(0, this.maxPrompts);
  }

  /**
   * Suggest 3-5 narrow market categories for a brand. Cached per brand.
   * Used by ScanForm so the user picks a precise category instead of
   * typing a vague one that produces off-target prompts.
   */
  async suggestCategories(brand: string): Promise<string[]> {
    const key = brand.trim().toLowerCase();
    if (!key) return [];

    const cached = this.categorySuggestCache.get(key);
    if (cached) return cached;

    const llmPrompt = `You help users set up an AI visibility tracker for the brand "${brand}".

Suggest 3 to 5 specific, narrow market categories this brand most likely competes in.

Rules:
- Be specific: "Dubai real estate broker" not "real estate"; "vegan protein powder" not "supplements"
- Each category should be something a real customer would research on ChatGPT/Gemini/Perplexity
- Distinct from each other (different angles, not synonyms)
- Lowercase, 2 to 6 words each
- If the brand name is ambiguous, cover the most likely interpretations

Return ONLY a JSON array of strings, no markdown, no commentary.
Example: ["dubai luxury real estate broker", "dubai off-plan property advisor", "dubai apartment broker for expats"]`;

    try {
      const raw = await this.generateText(llmPrompt);
      const parsed = this.parseStringArray(raw);
      const trimmed = parsed
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 80)
        .slice(0, 5);
      if (trimmed.length >= 3) {
        this.categorySuggestCache.set(key, trimmed);
        this.logger.log(
          `Suggested ${trimmed.length} categories for "${brand}"`,
        );
        return trimmed;
      }
      this.logger.warn(
        `Category suggester returned ${trimmed.length} items for "${brand}" — returning what we have`,
      );
      return trimmed;
    } catch (err) {
      this.logger.warn(
        `Category suggestion failed for "${brand}": ${(err as Error).message}`,
      );
      return [];
    }
  }

  private parseStringArray(raw: string): string[] {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    try {
      const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      return [];
    }
  }

  // Canonical IDs keep Coverage Map + analytics aligned across dynamic prompts
  private static readonly REQUIRED_PROMPT_IDS = [
    'best_in_category',
    'top_alternatives',
    'brand_reputation',
    'buying_advice',
    'market_leaders',
  ] as const;

  private parsePromptJson(raw: string): PromptTemplate[] {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    const required = AIService.REQUIRED_PROMPT_IDS;
    const byId = new Map<string, PromptTemplate>();
    parsed.forEach((item, idx) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof (item as PromptTemplate).text !== 'string' ||
        (item as PromptTemplate).text.length < 10
      ) {
        return;
      }
      const incoming = item as PromptTemplate;
      // If LLM returned a canonical ID, keep it. Otherwise map by ordinal so
      // Coverage Map columns stay stable per scan.
      const canonical = required.includes(
        incoming.id as (typeof required)[number],
      )
        ? incoming.id
        : (required[idx] ?? incoming.id);
      byId.set(canonical, {
        id: canonical,
        category: incoming.category ?? canonical,
        text: incoming.text,
      });
    });

    const ordered: PromptTemplate[] = [];
    for (const id of required) {
      const p = byId.get(id);
      if (p) ordered.push(p);
    }
    return ordered;
  }

  async runScan(
    input: ScanInput,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<RawResult[]> {
    const allEngines = Object.keys(ENGINE_PERSONAS) as Engine[];
    const engines = allEngines.slice(0, this.maxEngines);
    const generated = await this.generateCategoryPrompts(input.category);
    const promptTemplates = generated.slice(0, this.maxPrompts);

    const tasks = promptTemplates.flatMap((template) =>
      engines.map(
        (engine) => () =>
          this.runSingle(template, engine, input.brand, input.category),
      ),
    );

    this.logger.log(
      `Running ${tasks.length} tasks via real engines [${engines.join(', ')}] (${engines.length} engines × ${promptTemplates.length} prompts, concurrency=${this.concurrency}, delay=${this.delayMs}ms) for brand: "${input.brand}"`,
    );

    const settled = await this.runWithConcurrency(
      tasks,
      this.concurrency,
      this.delayMs,
      onProgress,
    );

    const results: RawResult[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        this.logger.warn(
          `Call failed: ${(outcome.reason as Error)?.message ?? String(outcome.reason)}`,
        );
      }
    }

    this.logger.log(
      `Scan complete. ${results.length}/${tasks.length} succeeded`,
    );
    return results;
  }
}
