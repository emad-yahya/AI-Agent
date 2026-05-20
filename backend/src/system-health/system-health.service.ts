import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type IntegrationStatus = 'ok' | 'missing' | 'invalid' | 'rate_limited' | 'unknown';

export interface IntegrationCheck {
  key: string;
  name: string;
  status: IntegrationStatus;
  required: boolean;
  envVar: string;
  description: string;
  setupUrl: string;
  setupSteps: string[];
  message?: string;
  cost?: string;
}

@Injectable()
export class SystemHealthService {
  private readonly logger = new Logger(SystemHealthService.name);

  constructor(private config: ConfigService) {}

  async checkAll(): Promise<{ checks: IntegrationCheck[]; allOk: boolean; coreOk: boolean }> {
    const checks = await Promise.all([
      this.checkGemini(),
      this.checkPSI(),
      this.checkSerper(),
      this.checkOpenAI(),
      this.checkOpenRouter(),
    ]);
    const coreChecks = checks.filter((c) => c.required);
    const coreOk = coreChecks.every((c) => c.status === 'ok');
    const allOk = checks.every((c) => c.status === 'ok');
    return { checks, allOk, coreOk };
  }

  private async checkGemini(): Promise<IntegrationCheck> {
    const base: IntegrationCheck = {
      key: 'gemini',
      name: 'Google Gemini (AI engines + categorization)',
      envVar: 'GOOGLE_GEMINI_API_KEY',
      required: true,
      status: 'missing',
      description:
        'Powers AI scans (gemini-style + perplexity-style engines), category classification, competitor discovery, prompt generation. Without it the system falls back to OpenRouter with reduced quality.',
      setupUrl: 'https://aistudio.google.com/app/apikey',
      setupSteps: [
        'Go to https://aistudio.google.com/app/apikey',
        'Click "Create API key" → "Create API key in new project"',
        'Copy the key (starts with AIzaSy…)',
        'In Railway → Variables tab → add GOOGLE_GEMINI_API_KEY = <your key>',
        'Redeploy backend service',
      ],
      cost: 'Free tier: 60 requests/min for Gemini 2.5 Flash',
    };
    const key = this.config.get<string>('GOOGLE_GEMINI_API_KEY');
    if (!key) return base;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        key,
      )}`;
      const res = await fetch(url);
      if (res.ok) return { ...base, status: 'ok', message: 'Authenticated, API responsive' };
      if (res.status === 401 || res.status === 403)
        return { ...base, status: 'invalid', message: `HTTP ${res.status}: key rejected` };
      if (res.status === 429)
        return { ...base, status: 'rate_limited', message: 'Rate-limited (key works, quota exhausted)' };
      return { ...base, status: 'unknown', message: `HTTP ${res.status}` };
    } catch (err) {
      return { ...base, status: 'unknown', message: (err as Error).message };
    }
  }

  private async checkPSI(): Promise<IntegrationCheck> {
    const base: IntegrationCheck = {
      key: 'psi',
      name: 'Google PageSpeed Insights (Core Web Vitals)',
      envVar: 'GOOGLE_PSI_API_KEY',
      required: false,
      status: 'missing',
      description:
        'Lifts PSI quota from ~25 req/day (unkeyed) to 25,000 req/day. Without it, On-Page SEO scans return null Core Web Vitals for most pages.',
      setupUrl: 'https://developers.google.com/speed/docs/insights/v5/get-started#APIKey',
      setupSteps: [
        'Go to https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com',
        'Click "Enable" (free, no billing required for PSI)',
        'Go to APIs & Services → Credentials → Create Credentials → API Key',
        'Copy the key',
        'In Railway → add GOOGLE_PSI_API_KEY = <your key>',
        'Redeploy backend',
      ],
      cost: 'Free up to 25,000 requests/day',
    };
    const key = this.config.get<string>('GOOGLE_PSI_API_KEY');
    if (!key) return base;
    try {
      const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent('https://www.google.com')}&key=${encodeURIComponent(key)}&strategy=mobile`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return { ...base, status: 'ok', message: 'PSI v5 reachable' };
      if (res.status === 400 || res.status === 403)
        return { ...base, status: 'invalid', message: `HTTP ${res.status}: key rejected or restricted` };
      if (res.status === 429)
        return { ...base, status: 'rate_limited', message: 'Daily quota exhausted' };
      return { ...base, status: 'unknown', message: `HTTP ${res.status}` };
    } catch (err) {
      return { ...base, status: 'unknown', message: (err as Error).message };
    }
  }

  private async checkSerper(): Promise<IntegrationCheck> {
    const base: IntegrationCheck = {
      key: 'serper',
      name: 'Serper (Google SERP data)',
      envVar: 'SERPER_API_KEY',
      required: true,
      status: 'missing',
      description:
        'Powers SEO rank tracking, content-gap analysis, PAA extraction, competitor brand→domain resolution, listicle gap discovery. Without it most SEO features return empty results.',
      setupUrl: 'https://serper.dev/api-key',
      setupSteps: [
        'Sign up at https://serper.dev (free 2500 queries on signup)',
        'Go to Dashboard → API Key',
        'Copy the key',
        'In Railway → add SERPER_API_KEY = <your key>',
        'Redeploy backend',
      ],
      cost: 'Free 2500 queries on signup, then $50/month for 100k queries',
    };
    const key = this.config.get<string>('SERPER_API_KEY');
    if (!key) return base;
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: 'test', num: 1 }),
      });
      if (res.ok) return { ...base, status: 'ok', message: 'SERP responses OK' };
      if (res.status === 401 || res.status === 403)
        return { ...base, status: 'invalid', message: `HTTP ${res.status}: key rejected` };
      if (res.status === 429)
        return { ...base, status: 'rate_limited', message: 'Quota exhausted' };
      return { ...base, status: 'unknown', message: `HTTP ${res.status}` };
    } catch (err) {
      return { ...base, status: 'unknown', message: (err as Error).message };
    }
  }

  private async checkOpenAI(): Promise<IntegrationCheck> {
    const base: IntegrationCheck = {
      key: 'openai',
      name: 'OpenAI (chatgpt-style engine)',
      envVar: 'OPENAI_API_KEY',
      required: false,
      status: 'missing',
      description:
        'Powers the chatgpt-style engine in AI scans. Without it the system falls back to OpenRouter (lower-quality Gemma proxy). Highly recommended for accurate ChatGPT visibility readings.',
      setupUrl: 'https://platform.openai.com/api-keys',
      setupSteps: [
        'Go to https://platform.openai.com/api-keys',
        'Click "Create new secret key"',
        'Copy the key (starts with sk-…)',
        'In Railway → add OPENAI_API_KEY = <your key>',
        'Redeploy backend',
      ],
      cost: '~$0.001 per scan (gpt-4o-mini, ~5 prompts)',
    };
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key) return base;
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { ...base, status: 'ok', message: 'OpenAI auth OK' };
      if (res.status === 401)
        return { ...base, status: 'invalid', message: 'Key rejected (401)' };
      if (res.status === 429)
        return { ...base, status: 'rate_limited', message: 'Rate-limited or quota exhausted' };
      return { ...base, status: 'unknown', message: `HTTP ${res.status}` };
    } catch (err) {
      return { ...base, status: 'unknown', message: (err as Error).message };
    }
  }

  private async checkOpenRouter(): Promise<IntegrationCheck> {
    const base: IntegrationCheck = {
      key: 'openrouter',
      name: 'OpenRouter (fallback LLM provider)',
      envVar: 'OPENROUTER_API_KEY',
      required: false,
      status: 'missing',
      description:
        'Fallback when GOOGLE_GEMINI_API_KEY is missing. Free tier uses Gemma models. Lower output quality than Gemini direct.',
      setupUrl: 'https://openrouter.ai/keys',
      setupSteps: [
        'Sign up at https://openrouter.ai',
        'Generate a key at https://openrouter.ai/keys',
        'In Railway → add OPENROUTER_API_KEY = <your key>',
        'Redeploy backend',
      ],
      cost: 'Free tier available with Gemma 3 model',
    };
    const key = this.config.get<string>('OPENROUTER_API_KEY');
    if (!key) return { ...base, status: 'missing' };
    return { ...base, status: 'ok', message: 'Key configured (not actively tested to save quota)' };
  }
}
