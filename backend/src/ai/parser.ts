import { Sentiment } from 'src/common/types';

export interface ParsedResult {
  mentioned: boolean;
  position: number | null;
  sentiment: Sentiment;
  visibilityScore: number;
}

export function detectMention(reponse: string, brand: string): boolean {
  return reponse.toLowerCase().includes(brand.toLowerCase());
}

export function detectPosition(response: string, brand: string): number | null {
  const lines = response.split('\n');
  const brandLower = brand.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (!line.includes(brandLower)) continue;

    const numbered = line.match(/^(\d+)[.)]/); // 1. 2. 3.
    if (numbered) return parseInt(numbered[1]);

    const bulletLines = lines.filter((l) => /^[-*•]/.test(l.trim())); // bullet list
    const bulletIndex = bulletLines.findIndex((l) =>
      l.toLowerCase().includes(brandLower),
    );
    if (bulletIndex !== -1) return bulletIndex + 1;
  }

  return null;
}

const POSITIVE_WORDS = [
  'excellent',
  'great',
  'best',
  'top',
  'leading',
  'reliable',
  'trusted',
  'popular',
  'recommended',
  'quality',
  'outstanding',
  'strong',
  'innovative',
  'well-regarded',
  'highly rated',
];

const NEGATIVE_WORDS = [
  'poor',
  'bad',
  'worst',
  'unreliable',
  'avoid',
  'problems',
  'issues',
  'complaints',
  'disappointing',
  'overpriced',
  'outdated',
  'struggling',
  'controversial',
];

export function detectSentiment(response: string, brand: string): Sentiment {
  const brandLower = brand.toLowerCase();
  const sentences = response
    .split(/[.!?]/)
    .filter((s) => s.toLowerCase().includes(brandLower))
    .join(' ')
    .toLowerCase();

  if (!sentences) return 'neutral';

  const positiveCount = POSITIVE_WORDS.filter((w) =>
    sentences.includes(w),
  ).length;
  const negativeCount = NEGATIVE_WORDS.filter((w) =>
    sentences.includes(w),
  ).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

export function calcVisibilityScore(
  mentioned: boolean,
  position: number | null,
  sentiment: Sentiment,
): number {
  if (!mentioned) return 0; // if not mentioned we got nothing 0
  const positionScore =
    position === 1
      ? 100
      : position === 2
        ? 80
        : position === 3
          ? 65
          : position !== null
            ? 50
            : 40; // pos1 -> 100 , pos2 -> 80, pos3 -> 65, pos4+ -> 50, no pos -> 40

  const sentimentBonus =
    sentiment === 'positive' ? 10 : sentiment === 'negative' ? -10 : 0; // positive +10, negative -10 , neutral 0

  return Math.min(100, Math.max(0, positionScore + sentimentBonus));
}

export function parseResponse(response: string, brand: string): ParsedResult {
  const mentioned = detectMention(response, brand);
  const position = mentioned ? detectPosition(response, brand) : null;
  const sentiment = mentioned ? detectSentiment(response, brand) : 'neutral';
  const visibilityScore = calcVisibilityScore(mentioned, position, sentiment);

  return { mentioned, position, sentiment, visibilityScore };
}
