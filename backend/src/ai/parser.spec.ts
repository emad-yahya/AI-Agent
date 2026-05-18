import {
  detectMention,
  detectPosition,
  detectSentiment,
  calcVisibilityScore,
  parseResponse,
} from './parser';

describe('detectMention', () => {
  it('returns true when brand present (exact case)', () => {
    expect(detectMention('Bosch makes great appliances', 'Bosch')).toBe(true);
  });

  it('returns true when brand present (case insensitive)', () => {
    expect(detectMention('BOSCH leads the market', 'bosch')).toBe(true);
    expect(detectMention('bosch is reliable', 'Bosch')).toBe(true);
  });

  it('returns false when brand absent', () => {
    expect(detectMention('Samsung leads the market', 'Bosch')).toBe(false);
  });

  it('returns false on empty response', () => {
    expect(detectMention('', 'Bosch')).toBe(false);
  });

  // Fuzzy matching tests (Session 21)
  it('respects word boundary — Apple does not match Pineapple', () => {
    expect(detectMention('Pineapple is a fruit', 'Apple')).toBe(false);
  });

  it('matches brand with corporate suffix variation', () => {
    expect(detectMention('Apple Inc. released a new iPhone', 'Apple')).toBe(
      true,
    );
    expect(detectMention('Apple is a great brand', 'Apple Inc.')).toBe(true);
  });

  it('matches with apostrophe-s', () => {
    expect(detectMention("Apple's iPhone is popular", 'Apple')).toBe(true);
  });

  it('matches hyphen / space variations', () => {
    expect(detectMention('Coca-Cola tastes good', 'Coca Cola')).toBe(true);
    expect(detectMention('Coca Cola tastes good', 'Coca-Cola')).toBe(true);
  });

  it('strips "The" prefix', () => {
    expect(detectMention('Coca-Cola is a global brand', 'The Coca-Cola')).toBe(
      true,
    );
  });

  it('matches & vs and', () => {
    expect(detectMention('A&P is a chain', 'A and P')).toBe(true);
    expect(detectMention('A and P is a chain', 'A&P')).toBe(true);
  });

  it('handles brand followed by punctuation', () => {
    expect(detectMention('Tesla, the EV leader', 'Tesla')).toBe(true);
    expect(detectMention('Best is Tesla.', 'Tesla')).toBe(true);
  });
});

describe('detectPosition', () => {
  it('returns 1 for brand at position 1 in numbered list', () => {
    const response = '1. Bosch\n2. Samsung\n3. LG';
    expect(detectPosition(response, 'Bosch')).toBe(1);
  });

  it('returns 2 for brand at position 2 in numbered list', () => {
    const response = '1. Samsung\n2. Bosch\n3. LG';
    expect(detectPosition(response, 'Bosch')).toBe(2);
  });

  it('returns 1 for brand at position 1 in bullet list', () => {
    const response = '- Bosch\n- Samsung\n- LG';
    expect(detectPosition(response, 'Bosch')).toBe(1);
  });

  it('returns 2 for brand at position 2 in bullet list', () => {
    const response = '- Samsung\n- Bosch\n- LG';
    expect(detectPosition(response, 'Bosch')).toBe(2);
  });

  it('returns null when brand in prose (no list)', () => {
    expect(
      detectPosition('Bosch is a great brand known worldwide', 'Bosch'),
    ).toBeNull();
  });

  it('returns null when brand not in response', () => {
    const response = '1. Samsung\n2. LG\n3. Sony';
    expect(detectPosition(response, 'Bosch')).toBeNull();
  });

  it('is case insensitive', () => {
    const response = '1. BOSCH\n2. Samsung';
    expect(detectPosition(response, 'bosch')).toBe(1);
  });

  it('handles period and parenthesis list markers', () => {
    const responseParen = '1) Bosch\n2) Samsung';
    expect(detectPosition(responseParen, 'Bosch')).toBe(1);
  });
});

describe('detectSentiment', () => {
  it('returns positive when positive words near brand', () => {
    expect(detectSentiment('Bosch is excellent and reliable.', 'Bosch')).toBe(
      'positive',
    );
  });

  it('returns negative when negative words near brand', () => {
    expect(
      detectSentiment('Bosch has poor quality and many complaints.', 'Bosch'),
    ).toBe('negative');
  });

  it('returns neutral when no sentiment words near brand', () => {
    expect(
      detectSentiment('Bosch is a brand that sells appliances.', 'Bosch'),
    ).toBe('neutral');
  });

  it('returns neutral when brand not in response', () => {
    expect(detectSentiment('Samsung is excellent and reliable.', 'Bosch')).toBe(
      'neutral',
    );
  });

  it('returns neutral when positive and negative counts are equal', () => {
    // 'excellent' = 1 positive, 'bad' = 1 negative → tie → neutral
    expect(detectSentiment('Bosch is excellent but bad.', 'Bosch')).toBe(
      'neutral',
    );
  });

  it('ignores sentiment words in sentences without brand', () => {
    const response = 'Samsung is excellent. Bosch sells appliances.';
    expect(detectSentiment(response, 'Bosch')).toBe('neutral');
  });

  it('is case insensitive for brand matching', () => {
    expect(detectSentiment('BOSCH is the best brand.', 'bosch')).toBe(
      'positive',
    );
  });
});

describe('calcVisibilityScore', () => {
  it('returns 0 when not mentioned', () => {
    expect(calcVisibilityScore(false, null, 'neutral')).toBe(0);
    expect(calcVisibilityScore(false, 1, 'positive')).toBe(0);
  });

  it('position 1 neutral = 100', () => {
    expect(calcVisibilityScore(true, 1, 'neutral')).toBe(100);
  });

  it('position 1 positive = 100 (capped)', () => {
    expect(calcVisibilityScore(true, 1, 'positive')).toBe(100);
  });

  it('position 1 negative = 90', () => {
    expect(calcVisibilityScore(true, 1, 'negative')).toBe(90);
  });

  it('position 2 neutral = 80', () => {
    expect(calcVisibilityScore(true, 2, 'neutral')).toBe(80);
  });

  it('position 2 positive = 90', () => {
    expect(calcVisibilityScore(true, 2, 'positive')).toBe(90);
  });

  it('position 3 neutral = 65', () => {
    expect(calcVisibilityScore(true, 3, 'neutral')).toBe(65);
  });

  it('position 4+ neutral = 50', () => {
    expect(calcVisibilityScore(true, 4, 'neutral')).toBe(50);
    expect(calcVisibilityScore(true, 10, 'neutral')).toBe(50);
  });

  it('no position neutral = 40', () => {
    expect(calcVisibilityScore(true, null, 'neutral')).toBe(40);
  });

  it('no position negative = 30', () => {
    expect(calcVisibilityScore(true, null, 'negative')).toBe(30);
  });

  it('no position positive = 50', () => {
    expect(calcVisibilityScore(true, null, 'positive')).toBe(50);
  });

  it('score never exceeds 100', () => {
    expect(calcVisibilityScore(true, 1, 'positive')).toBeLessThanOrEqual(100);
  });

  it('score never below 0', () => {
    expect(calcVisibilityScore(true, null, 'negative')).toBeGreaterThanOrEqual(
      0,
    );
  });
});

describe('parseResponse (integration)', () => {
  it('fully parses mentioned brand in numbered list with positive sentiment', () => {
    const response =
      '1. Bosch — excellent and reliable appliances.\n2. Samsung';
    const result = parseResponse(response, 'Bosch');
    expect(result.mentioned).toBe(true);
    expect(result.position).toBe(1);
    expect(result.sentiment).toBe('positive');
    expect(result.visibilityScore).toBe(100);
  });

  it('returns all-zero defaults when brand not mentioned', () => {
    const result = parseResponse('Samsung leads the market.', 'Bosch');
    expect(result.mentioned).toBe(false);
    expect(result.position).toBeNull();
    expect(result.sentiment).toBe('neutral');
    expect(result.visibilityScore).toBe(0);
  });

  it('mentioned in prose (no list) gives null position and score 40', () => {
    const result = parseResponse('Bosch is a well-known brand.', 'Bosch');
    expect(result.mentioned).toBe(true);
    expect(result.position).toBeNull();
    expect(result.visibilityScore).toBe(40);
  });
});
