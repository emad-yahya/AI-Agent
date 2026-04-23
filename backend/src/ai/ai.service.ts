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

  private readonly provider: string;
  private readonly anthropicModel: string;
  private readonly openrouterModel: string;

  constructor(private config: ConfigService) {
    this.claude = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
    this.openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.config.get<string>('OPENROUTER_API_KEY'),
    });
    this.provider = this.config.get<string>('AI_PROVIDER', 'openrouter');
    this.anthropicModel = this.config.get<string>(
      'ANTHROPIC_MODEL',
      'claude-haiku-4-5',
    );
    this.openrouterModel = this.config.get<string>(
      'OPENROUTER_MODEL',
      'nvidia/nemotron-3-super-120b-a12b:free',
    );
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
  ): Promise<string> {
    const response = await this.openrouter.chat.completions.create({
      model: this.openrouterModel,
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
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

  private async runSingle(
    template: PromptTemplate,
    engine: Engine,
    brand: string,
    category: string,
  ): Promise<RawResult> {
    const prompt = buildPrompt(template, brand, category);
    const systemPrompt = ENGINE_PERSONAS[engine];

    this.logger.debug(`[${engine}] "${prompt.slice(0, 60)}..."`);

    const response = await this.callLLM(systemPrompt, prompt);
    const parsed = parseResponse(response, brand);
    return { engine, template, prompt, response, parsed };
  }

  private async runWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number,
    delayMs: number,
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = [];

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch.map((t) => t()));
      results.push(...batchResults);
      if (i + concurrency < tasks.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return results;
  }

  async runScan(input: ScanInput): Promise<RawResult[]> {
    const engines = Object.keys(ENGINE_PERSONAS) as Engine[];
    const tasks = SEARCH_PROMPTS.flatMap((template) =>
      engines.map(
        (engine) => () =>
          this.runSingle(template, engine, input.brand, input.category),
      ),
    );

    this.logger.log(
      `Running ${tasks.length} via [${this.provider}] parallel calls (3 at a time) for brand: "${input.brand}"`,
    );

    const settled = await this.runWithConcurrency(tasks, 3, 300);

    const results: RawResult[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        this.logger.warn(
          `Call failed: ${outcome.reason?.message ?? outcome.reason}`,
        );
      }
    }

    this.logger.log(
      `Scan complete. ${results.length}/${tasks.length} succeeded`,
    );
    return results;
  }
}
