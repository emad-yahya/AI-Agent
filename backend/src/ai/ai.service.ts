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

export type ScanMode = 'quick' | 'full';

export interface ScanInput {
  brand: string;
  category: string;
  mode?: ScanMode;
}

// Full scan = 30 prompts spanning the category (6 per intent bucket).
// Quick scan uses AI_MAX_PROMPTS env (default 5).
const FULL_SCAN_PROMPT_COUNT = 30;

export interface RawResult {
  engine: Engine;
  template: PromptTemplate;
  prompt: string;
  response: string;
  parsed: ParsedResult;
  citations: string[];
}

interface EngineResponse {
  text: string;
  citations: string[];
}

interface GroundingChunk {
  web?: { uri?: string; title?: string };
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

  // Cache of suggested categories per brand (in-memory)
  // Note: scan prompts intentionally NOT cached — variance across scans is
  // more valuable than the cost saving.
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
  // Returns text + grounding citations (Perplexity-style only — search-grounded
  // calls expose the URLs Gemini actually read from the web).
  private async callGemini(
    systemPrompt: string,
    userMessage: string,
    useSearch = false,
    attempt = 0,
  ): Promise<EngineResponse> {
    if (!this.gemini) {
      this.logger.warn(
        'GOOGLE_GEMINI_API_KEY not set — falling back to OpenRouter',
      );
      const text = await this.callOpenrouter(systemPrompt, userMessage);
      return { text, citations: [] };
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
      const text = result.response.text();
      const rawCitations = useSearch
        ? this.extractGeminiCitations(result.response)
        : [];
      // Vertex AI grounding URIs are proxy redirects. Unwrap to the actual
      // source URL so the user sees real domains (nytimes.com, zillow.com)
      // instead of identical vertexaisearch.cloud.google.com placeholders.
      const citations = useSearch
        ? await this.unwrapVertexUris(rawCitations)
        : rawCitations;
      return { text, citations };
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

  // Gemini search-grounded responses carry citations in candidates[0].groundingMetadata.
  // Extract unique URIs — these are the exact pages AI engines read to answer
  // shopper queries about the category. Knowing them tells the brand WHERE to
  // fight for visibility (guest posts, listicle inclusion, PR pitches).
  /**
   * Resolves Vertex AI Search proxy URIs to their real destination URLs.
   * Vertex returns `https://vertexaisearch.cloud.google.com/grounding-api-redirect/...`
   * which the user has no way to interpret. We HEAD-request each (with short
   * timeout) and follow redirects to extract the actual source.
   * Falls back to the original URI if resolution fails.
   */
  private async unwrapVertexUris(uris: string[]): Promise<string[]> {
    const out = await Promise.all(
      uris.map(async (uri) => {
        if (!uri.includes('vertexaisearch.cloud.google.com')) return uri;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          // Use GET (HEAD can be 405 on some redirects) but cap response with no body read
          const res = await fetch(uri, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (compatible; AIVisibilityBot/1.0; +https://aivisibility.local)',
            },
          });
          clearTimeout(timeout);
          return res.url || uri;
        } catch {
          return uri;
        }
      }),
    );
    return [...new Set(out)];
  }

  private extractGeminiCitations(response: unknown): string[] {
    try {
      const r = response as {
        candidates?: Array<{
          groundingMetadata?: { groundingChunks?: GroundingChunk[] };
        }>;
      };
      const chunks = r.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const uris = chunks
        .map((c) => c.web?.uri)
        .filter((u): u is string => typeof u === 'string' && u.length > 0);
      return [...new Set(uris)];
    } catch {
      return [];
    }
  }

  // Route each engine to its real API
  private async callEngine(
    engine: Engine,
    systemPrompt: string,
    userMessage: string,
  ): Promise<EngineResponse> {
    switch (engine) {
      case 'chatgpt-style': {
        const text = await this.callOpenAI(systemPrompt, userMessage);
        return { text, citations: [] };
      }
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

    const { text, citations } = await this.callEngine(
      engine,
      systemPrompt,
      prompt,
    );
    const parsed = parseResponse(text, brand);
    return {
      engine,
      template,
      prompt,
      response: text,
      parsed,
      citations,
    };
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
   * Generates scenario-rich client-intent prompts via LLM.
   *
   * Mental model: the "category" describes the brand's identity (e.g. "Dubai
   * real estate broker"). A real customer doesn't type the category itself —
   * they type a concrete need ("rent 2BR in JVC under 90k AED"). To measure
   * real visibility we must mimic those concrete needs.
   *
   * The LLM is asked to:
   *   1. infer the typical services a business in this category offers,
   *   2. for each of the 5 intent buckets (best_in_category, top_alternatives,
   *      brand_reputation, buying_advice, market_leaders), generate ONE
   *      prompt anchored to a different concrete service + scenario (location,
   *      budget, sub-type) so the 5 prompts collectively probe the category.
   *
   * Not cached — variance across scans is more valuable than the trivial
   * cost saving (one Gemini call per scan).
   * Falls back to static SEARCH_PROMPTS on any failure.
   */
  async generateCategoryPrompts(category: string): Promise<PromptTemplate[]> {
    const key = category.trim().toLowerCase();
    if (!key) return SEARCH_PROMPTS.slice(0, this.maxPrompts);

    const llmPrompt = `You are designing real customer questions for an AI visibility tracker.

The brand's category is: "${category}"

STEP 1 (think silently, do not output):
- List the typical services or offerings a business in this category provides.
- For each service, think of a concrete scenario a real customer would describe to ChatGPT/Gemini/Perplexity when shopping for that service. Include details a real shopper mentions: location/neighborhood, budget range, sub-type, size, occasion, etc.
- Pick 5 DIFFERENT services or scenarios so the questions span the category, not all about one slice.

STEP 2 (output): produce exactly 5 prompts mapped to these 5 intent buckets. Each prompt must be anchored to ONE of the 5 different concrete scenarios from step 1.

Intent buckets:
1. best_in_category   — pure shopper question, NO brand mentioned. Format: "I need <service> in <location>, budget <amount>, who are the best <category> for this?"
2. top_alternatives   — shopper compares options, MUST contain literal {brand}. Format: "Besides {brand}, who else handles <specific service> in <location/segment>?"
3. brand_reputation   — shopper asks about brand for a specific need, MUST contain literal {brand}. Format: "How is {brand} for <specific service + scenario>? Anyone used them?"
4. buying_advice      — shopper asks for guidance for a specific scenario, NO brand. Format: "I'm <persona> looking to <action> <thing> in <location/segment>. Which providers should I shortlist?"
5. market_leaders     — shopper asks who dominates a sub-segment, NO brand. Format: "Who are the biggest names in <sub-segment + location> for <service>?"

HARD RULES:
- Each prompt MUST include concrete, plausible specifics (neighborhood name, budget number, property type, audience, etc.). Vague prompts are wrong.
- The 5 specifics MUST be different scenarios (don't anchor all 5 to "rent apartment Marina").
- Buckets 1, 4, 5 MUST NOT contain brand placeholders. Buckets 2 and 3 MUST contain the literal token {brand}.
- Conversational tone, first person, like a real shopper typing on their phone.
- {category} placeholder is NOT required in the text — bake the category meaning into the scenario.

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
        this.logger.log(
          `Generated ${parsed.length} scenario-rich prompts for "${category}"`,
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

HARD RULES (a violation makes the suggestion useless):
- NEVER include the brand name "${brand}" (or any variation of it) in any category. Categories describe the MARKET, not the brand itself.
- Phrase each category from the END CUSTOMER'S perspective — what a buyer/renter/user would type into ChatGPT looking for options. NOT analytical/B2B/research framings.
  Good: "dubai luxury apartment broker", "vegan protein powder for women"
  Bad:  "dubai real estate market analysis", "supplement industry report"
- Be specific (include geography, audience, or sub-segment when relevant):
  Good: "dubai real estate broker", "off-plan property advisor dubai"
  Bad:  "real estate", "property" (too broad — AI engines will only name global giants like Zillow/Redfin and the brand has zero chance to appear)
- Distinct from each other (different angles or sub-segments, not synonyms)
- Lowercase, 2 to 6 words each

Return ONLY a JSON array of strings, no markdown, no commentary.
Example for a Dubai real estate broker brand:
["dubai luxury real estate broker", "off-plan property advisor dubai", "palm jumeirah villa broker", "dubai apartment broker for expats"]`;

    try {
      const raw = await this.generateText(llmPrompt);
      const parsed = this.parseStringArray(raw);
      // Strip any category that leaks the brand name (Gemini violates the
      // "no brand in category" rule ~25% of the time despite explicit prompt).
      const brandLower = brand.trim().toLowerCase();
      const brandTokens = brandLower.split(/\s+/).filter((t) => t.length >= 3);
      const trimmed = parsed
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 80)
        .filter((s) => {
          const sl = s.toLowerCase();
          if (sl.includes(brandLower)) return false;
          // Reject if every multi-char brand token appears in the category
          if (
            brandTokens.length > 0 &&
            brandTokens.every((t) => sl.includes(t))
          ) {
            return false;
          }
          return true;
        })
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

  /**
   * Discover direct competitor BRANDS (not article hosts) via Gemini with
   * Google Search grounding. Returns brand names — caller maps them to
   * domains. Falls back to [] on any failure so onboarding can use Serper.
   *
   * Why: Serper-based discovery extracts URL hosts from organic results,
   * which surfaces directory sites (G2, Capterra) or jobs/blogs subdomains
   * instead of actual competitors. Gemini grounding reads the article CONTENT
   * and names real businesses.
   */
  async findCompetitorBrandsViaGemini(
    brand: string,
    category: string | null,
    country: string,
  ): Promise<string[]> {
    if (!this.gemini) return [];
    const cat = (category ?? '').trim() || 'the same market';
    const system =
      'You research markets for an AI visibility tracker. Return ONLY valid JSON arrays of brand names. No commentary, no markdown.';
    const user = `List 5 to 8 direct business competitors of "${brand}" in the "${cat}" industry${
      country ? `, operating in ${this.countryFullName(country)}` : ''
    }.

Hard rules:
- Return ACTUAL competitor BRAND NAMES (not directory sites, not review sites, not jobs sites, not Wikipedia)
- Exclude "${brand}" itself from the list
- Each brand must be a real company that competes for the same customers
- Use the brand's common/public name (e.g. "PayPal" not "PayPal Holdings Inc")

Return ONLY a JSON array of strings, no markdown:
["BrandA", "BrandB", "BrandC", "BrandD", "BrandE"]`;

    try {
      const { text } = await this.callGemini(system, user, true);
      const parsed = this.parseStringArray(text);
      const brandLower = brand.trim().toLowerCase();
      const filtered = parsed
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 80)
        .filter((s) => s.toLowerCase() !== brandLower);
      this.logger.log(
        `Gemini suggested ${filtered.length} competitors for "${brand}" in "${cat}"`,
      );
      return filtered.slice(0, 8);
    } catch (err) {
      this.logger.warn(
        `Gemini competitor lookup failed for "${brand}": ${(err as Error).message}`,
      );
      return [];
    }
  }

  private countryFullName(code: string): string {
    const names: Record<string, string> = {
      us: 'the United States',
      ae: 'the UAE',
      sa: 'Saudi Arabia',
      gb: 'the United Kingdom',
      uk: 'the United Kingdom',
      de: 'Germany',
      fr: 'France',
      it: 'Italy',
      es: 'Spain',
      jp: 'Japan',
      in: 'India',
      au: 'Australia',
      ca: 'Canada',
    };
    return names[code.toLowerCase()] ?? code.toUpperCase();
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

  /**
   * Full GEO scan: 30 scenario-rich prompts spanning the category.
   * Distribution: 6 prompts per intent bucket × 5 buckets = 30.
   * Each prompt is anchored to a DIFFERENT concrete scenario (service +
   * location + budget/persona) so the scan probes the brand's full market
   * coverage, not just 5 sample queries.
   * Not cached — variance across scans matters more than the trivial saving.
   */
  async generateScenarioPrompts(
    category: string,
    count: number,
  ): Promise<PromptTemplate[]> {
    const trimmed = category.trim();
    if (!trimmed) return SEARCH_PROMPTS.slice(0, count);
    const target = Math.max(5, Math.min(count, 50));
    const perBucket = Math.ceil(target / 5);
    const required = AIService.REQUIRED_PROMPT_IDS;

    const llmPrompt = `You are designing real customer queries for an AI visibility tracker.

Category: "${category}"

STEP 1 (think silently): list the typical services this category provides. Then think of ${target} concrete shopper scenarios — each anchored to a DIFFERENT combination of (service × location/neighborhood × budget/size × audience/occasion). Maximize variance.

STEP 2 (output): produce exactly ${target} prompts distributed across these 5 intent buckets (${perBucket} prompts per bucket):
1. best_in_category   — pure shopper question, NO brand mentioned
2. top_alternatives   — shopper compares options, MUST contain literal {brand}
3. brand_reputation   — shopper asks about a brand for a scenario, MUST contain literal {brand}
4. buying_advice      — shopper asks for guidance, NO brand
5. market_leaders     — shopper asks who dominates a sub-segment, NO brand

Hard rules for each prompt:
- Anchor to ONE concrete scenario (neighborhood name, budget number, property type, persona, time horizon, etc.)
- Conversational first-person, like a real shopper typing on phone
- Within a bucket, the ${perBucket} prompts MUST span different scenarios (don't repeat the same neighborhood + service combo)
- Buckets 1, 4, 5 must NOT contain the {brand} token. Buckets 2 and 3 MUST contain {brand}
- {category} placeholder NOT required — bake category meaning into the scenario

Return ONLY a JSON array of ${target} objects, no markdown, no commentary. Each object: {"id":"<bucket_id>","category":"<bucket_id>","text":"..."}`;

    try {
      const raw = await this.generateText(llmPrompt);
      const parsed = this.parseScenarioArray(raw, target);
      if (parsed.length >= target * 0.6) {
        this.logger.log(
          `Generated ${parsed.length} scenario prompts for "${category}" (full scan)`,
        );
        return parsed;
      }
      this.logger.warn(
        `Scenario generator returned ${parsed.length}/${target} prompts for "${category}" — padding with fallback`,
      );
      const fallback = SEARCH_PROMPTS.flatMap((t) =>
        Array.from({ length: perBucket }, (_, i) => ({
          ...t,
          id: t.id,
          text: t.text + (i === 0 ? '' : ' '),
        })),
      ).slice(0, target);
      const merged = [...parsed];
      for (const f of fallback) {
        if (merged.length >= target) break;
        merged.push(f);
      }
      return merged;
    } catch (err) {
      this.logger.warn(
        `Scenario prompt generation failed for "${category}": ${(err as Error).message} — using fallback`,
      );
      const fallback = required
        .flatMap((id) =>
          Array.from({ length: perBucket }, () => {
            const base = SEARCH_PROMPTS.find((p) => p.id === id);
            return base ?? SEARCH_PROMPTS[0];
          }),
        )
        .slice(0, target);
      return fallback;
    }
  }

  /**
   * Parses LLM scenario response. Unlike parsePromptJson, keeps MULTIPLE
   * prompts per intent ID (full scan = 6 per bucket).
   */
  private parseScenarioArray(raw: string, target: number): PromptTemplate[] {
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
    const validIds = new Set<string>(required);
    const seenText = new Set<string>();
    const out: PromptTemplate[] = [];
    for (const item of parsed) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof (item as PromptTemplate).text !== 'string' ||
        (item as PromptTemplate).text.length < 10
      ) {
        continue;
      }
      const incoming = item as PromptTemplate;
      const id = validIds.has(incoming.id)
        ? incoming.id
        : required[out.length % required.length];
      const text = incoming.text.trim();
      if (seenText.has(text)) continue;
      seenText.add(text);
      out.push({ id, category: id, text });
      if (out.length >= target) break;
    }
    return out;
  }

  async runScan(
    input: ScanInput,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<RawResult[]> {
    const allEngines = Object.keys(ENGINE_PERSONAS) as Engine[];
    const engines = allEngines.slice(0, this.maxEngines);
    const mode = input.mode ?? 'quick';
    const generated =
      mode === 'full'
        ? await this.generateScenarioPrompts(
            input.category,
            FULL_SCAN_PROMPT_COUNT,
          )
        : await this.generateCategoryPrompts(input.category);
    const cap = mode === 'full' ? FULL_SCAN_PROMPT_COUNT : this.maxPrompts;
    const promptTemplates = generated.slice(0, cap);

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
