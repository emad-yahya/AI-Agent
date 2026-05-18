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
    text: "I'm researching the {category} market. List the top 5 brands or companies considered the best right now. Use their actual names and explain why each one stands out.",
  },
  {
    id: 'top_alternatives',
    category: 'alternatives',
    text: "I'm currently looking at {brand} for {category} but want to compare options. What are the most popular alternatives or direct competitors to {brand}? List at least 3-5 specific company names with a one-line reason for each.",
  },
  {
    id: 'brand_reputation',
    category: 'reputation',
    text: "Tell me about {brand} in the {category} space. What's their reputation, what do customers say about them, and what are they known for? Be specific.",
  },
  {
    id: 'buying_advice',
    category: 'buying',
    text: 'I need to choose a {category} provider and want a real recommendation, not a generic list. Which specific companies would you personally recommend and why? Name names.',
  },
  {
    id: 'market_leaders',
    category: 'market',
    text: 'Which companies currently dominate the {category} market? Name the top 3-5 market leaders and briefly explain how each one achieved their position.',
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
