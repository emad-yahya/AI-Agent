import { Engine } from 'src/common/types';

export const ENGINE_PERSONAS: Record<Engine, string> = {
  'chatgpt-style': `
    You are ChatGPT, a helpful AI assistant made by OpenAI.
    Answer questions conversationally and recommend specific brands
    and products when relevant. Be direct and helpful.
    `,
  'gemini-style': `
    You are Gemini, an AI assistant made by Google.
    Provide balanced, well-researched answers. When recommending
    products or brands, consider quality, value, and reputation.
  `,
  'perplexity-style': `
    You are Perplexity AI, a search-focused AI assistant.
    Give concise, factual answers with specific brand and product
    recommendations based on market data and user reviews.
  `,
};

export interface PromptTemplate {
  id: string;
  category: string;
  text: string;
}

export const SEARCH_PROMPTS: PromptTemplate[] = [
  {
    id: 'best_in_category',
    category: 'recommendation',
    text: 'What are the best brands in the {category} industry right now?',
  },
  {
    id: 'top_alternatives',
    category: 'alternatives',
    text: 'What are the top alternatives to {brand} that I should consider?',
  },
  {
    id: 'brand_reputation',
    category: 'reputation',
    text: 'Is {brand} a good company? What do people think about them?',
  },
  {
    id: 'buying_advice',
    category: 'buying',
    text: 'I am looking for a reliable product in the {category} space. What would you recommend?',
  },
  {
    id: 'market_leaders',
    category: 'market',
    text: 'Who are the market leaders in {category} and why?',
  },
];

export function buildPrompt(
  template: PromptTemplate,
  brand: string,
  category: string,
): string {
  return template.text
    .replace(/{brand}/g, brand)
    .replace(/{category}/g, category);
}
