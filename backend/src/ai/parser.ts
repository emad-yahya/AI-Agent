import { Sentiment } from 'src/common/types';

export interface ParsedResult {
  mentioned: boolean;
  position: number | null;
  sentiment: Sentiment;
  visibilityScore: number;
  topics: string[];
}

// Common corporate suffixes — stripped to enable "Apple Inc." == "Apple"
const CORPORATE_SUFFIX_RE =
  /\s+(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|company|co\.?|group|holdings|gmbh|sa|ag|plc|limited)\.?$/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates plausible textual variations of a brand name so detection
 * captures real-world mentions like "Apple Inc.", "Coca Cola", "The X Group".
 */
export function brandVariations(brand: string): string[] {
  const out = new Set<string>();
  const original = brand.trim();
  if (!original) return [];
  out.add(original);

  // Strip corporate suffix: "Apple Inc." -> "Apple"
  const noSuffix = original.replace(CORPORATE_SUFFIX_RE, '').trim();
  if (noSuffix && noSuffix !== original) out.add(noSuffix);

  // Strip leading "The "
  const noThe = original.replace(/^the\s+/i, '').trim();
  if (noThe && noThe !== original) out.add(noThe);

  // Hyphen ↔ space ↔ glued: "Coca-Cola" / "Coca Cola" / "CocaCola"
  if (original.includes('-')) {
    out.add(original.replace(/-/g, ' '));
    out.add(original.replace(/-/g, ''));
  }
  if (original.includes(' ') && original.split(' ').length === 2) {
    out.add(original.replace(/ /g, '-'));
    out.add(original.replace(/ /g, ''));
  }

  // & ↔ "and" — generate both spaced and unspaced ampersand forms
  if (original.includes('&')) {
    out.add(original.replace(/\s*&\s*/g, ' and '));
  } else if (/\band\b/i.test(original)) {
    out.add(original.replace(/\s+and\s+/gi, ' & '));
    out.add(original.replace(/\s+and\s+/gi, '&'));
  }

  return [...out].filter((v) => v.length > 1);
}

/**
 * Word-boundary aware match — "Apple" matches "Apple Inc." but NOT "Pineapple".
 * Uses ASCII-letter/digit lookarounds rather than \b so we handle apostrophes,
 * punctuation, and unicode neighbours safely.
 */
function matchesAny(text: string, variations: string[]): boolean {
  for (const v of variations) {
    const pattern = new RegExp(
      `(^|[^a-zA-Z0-9])${escapeRegex(v)}(?=[^a-zA-Z0-9]|$)`,
      'i',
    );
    if (pattern.test(text)) return true;
  }
  return false;
}

export function detectMention(response: string, brand: string): boolean {
  return matchesAny(response, brandVariations(brand));
}

export function detectPosition(response: string, brand: string): number | null {
  const lines = response.split('\n');
  const variations = brandVariations(brand);

  for (let i = 0; i < lines.length; i++) {
    if (!matchesAny(lines[i], variations)) continue;

    const numbered = lines[i].match(/^\s*(\d+)[.)]/); // 1. 2. 3.
    if (numbered) return parseInt(numbered[1]);

    const bulletLines = lines.filter((l) => /^[-*•]/.test(l.trim())); // bullet list
    const bulletIndex = bulletLines.findIndex((l) => matchesAny(l, variations));
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
  const variations = brandVariations(brand);
  const sentences = response
    .split(/[.!?]/)
    .filter((s) => matchesAny(s, variations))
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

const TOPIC_SKIP = new Set([
  'The',
  'This',
  'That',
  'These',
  'Those',
  'They',
  'Their',
  'Our',
  'Your',
  'For',
  'With',
  'From',
  'About',
  'When',
  'While',
  'Also',
  'Some',
  'Many',
  'Here',
  'There',
]);

// Geographic suffixes and common place modifiers — phrases ending in or
// containing these are usually neighborhoods/cities/streets, not topics
// or competitor brands. Lowercase for case-insensitive match.
const GEO_TOKEN_BLOCKLIST = new Set([
  // Streets / addresses
  'street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd',
  'lane', 'drive', 'dr', 'way', 'court', 'plaza', 'square', 'circle',
  // Neighborhood / district
  'district', 'neighborhood', 'quarter', 'borough', 'precinct',
  'heights', 'hills', 'park', 'gardens', 'estate', 'estates',
  'village', 'town', 'township', 'community',
  // Geographic features
  'beach', 'bay', 'harbor', 'harbour', 'island', 'islands',
  'valley', 'ridge', 'creek', 'river', 'lake', 'cove', 'coast',
  'point', 'shores', 'shore',
  // Administrative units
  'city', 'county', 'state', 'province', 'region', 'territory',
  'country', 'nation', 'kingdom', 'republic', 'emirate', 'emirates',
  // Direction modifiers used in place names
  'north', 'south', 'east', 'west', 'central', 'upper', 'lower', 'old', 'new',
  // Common Dubai / UAE area words (project is Dubai-heavy)
  'marina', 'jumeirah', 'downtown', 'silicon', 'oasis',
]);

const GEO_FULL_NAMES = new Set([
  'New York', 'Los Angeles', 'San Francisco', 'San Diego', 'Las Vegas',
  'United States', 'United Kingdom', 'United Arab', 'Saudi Arabia',
  'Hong Kong', 'Abu Dhabi', 'Dubai Marina', 'Palm Jumeirah',
  'Park Slope', 'Fort Greene', 'Long Island', 'Wall Street',
]);

function isGeographicPhrase(phrase: string): boolean {
  if (GEO_FULL_NAMES.has(phrase)) return true;
  const tokens = phrase.toLowerCase().split(/\s+/);
  for (const t of tokens) {
    if (GEO_TOKEN_BLOCKLIST.has(t)) return true;
  }
  return false;
}

export function extractTopics(response: string, brand: string): string[] {
  if (!response) return [];
  const brandLower = brand.toLowerCase();
  const phrases = response.match(/[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)+/g) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const phrase of phrases) {
    const words = phrase.split(' ');
    if (words.some((w) => TOPIC_SKIP.has(w))) continue;
    if (phrase.toLowerCase().includes(brandLower)) continue;
    if (isGeographicPhrase(phrase)) continue;
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    result.push(phrase);
    if (result.length >= 6) break;
  }
  return result;
}

export function parseResponse(response: string, brand: string): ParsedResult {
  const mentioned = detectMention(response, brand);
  const position = mentioned ? detectPosition(response, brand) : null;
  const sentiment = mentioned ? detectSentiment(response, brand) : 'neutral';
  const visibilityScore = calcVisibilityScore(mentioned, position, sentiment);
  const topics = extractTopics(response, brand);

  return { mentioned, position, sentiment, visibilityScore, topics };
}
