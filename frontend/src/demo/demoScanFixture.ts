// Pre-built sample scan for the public View Demo session. Loaded into App
// state on mount when isDemo, so the Scan tab shows a complete results view
// (ResultsTable / Topics / Citations / BrandPresence / etc.) without the
// visitor having to actually trigger a scan (which the backend would 403
// anyway via DemoWriteBlockMiddleware).
//
// Brand: Platinum Square (Dubai brokerage, RERA #12345). Same brand the
// backend analytics fixtures reference, so Dashboard and Scan tab tell one
// coherent story.

import type { ScanResponse, Recommendation } from '../api/client';

export const DEMO_SCAN_META = {
  brand: 'Platinum Square',
  category: 'Dubai real estate broker',
  domain: 'platinumsquare.ae',
  country: 'ae',
  mode: 'master' as const,
};

export const DEMO_BRAND_ID = 'demo-platinum-square';
export const DEMO_SCAN_ID = 'demo-scan-master-latest';

const PROMPTS = [
  'What are the best real estate brokers in Dubai?',
  'Top brokerages for buying off-plan property in Dubai Marina.',
  'Reliable real estate companies in Downtown Dubai with strong RERA reputation.',
  'Who should I contact for a JVC apartment investment in Dubai?',
  'Compare Platinum Square vs Driven Properties as brokers.',
  'Best Dubai brokerage for Palm Jumeirah villas.',
  'Where can I find honest property advice in Business Bay?',
  'Recommended brokers for first-time investors in Dubai.',
  'Which Dubai brokerages publish market reports?',
  'Top-rated real estate agencies for international buyers in UAE.',
];

const ENGINES = ['chatgpt-style', 'gemini-style', 'perplexity-style'] as const;

// Carefully tuned so the aggregate matches the Dashboard story (avg ~64 score,
// 67% mention rate, Gemini > Perplexity > ChatGPT). 30 results total.
const RESULTS_RAW: Array<{
  prompt: number; // index into PROMPTS
  engine: 0 | 1 | 2; // index into ENGINES
  mentioned: boolean;
  position: number | null;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  topics: string[];
  citations?: string[];
  response: string;
}> = [
  { prompt: 0, engine: 1, mentioned: true,  position: 2, sentiment: 'positive', score: 82,
    topics: ['RERA-licensed', 'Dubai Marina', 'luxury'],
    citations: ['bayut.com', 'platinumsquare.ae', 'khaleejtimes.com'],
    response: 'Dubai\'s top brokers include Driven Properties, Platinum Square, and Allsopp & Allsopp. Platinum Square is RERA-licensed and known for Dubai Marina and Downtown listings...' },
  { prompt: 0, engine: 0, mentioned: true,  position: 4, sentiment: 'positive', score: 65,
    topics: ['off-plan', 'investment'],
    citations: ['bayut.com', 'propertyfinder.ae'],
    response: 'Among the leading real estate brokers in Dubai you\'ll find Driven Properties, Allsopp & Allsopp, Dacha Real Estate, Platinum Square, and a few boutique firms...' },
  { prompt: 0, engine: 2, mentioned: true,  position: 3, sentiment: 'positive', score: 74,
    topics: ['boutique', 'RERA'],
    citations: ['platinumsquare.ae', 'reidin.com'],
    response: 'Reputable Dubai brokerages include Driven Properties, Platinum Square (RERA-licensed boutique), and Allsopp & Allsopp...' },
  { prompt: 1, engine: 1, mentioned: true,  position: 1, sentiment: 'positive', score: 88,
    topics: ['off-plan', 'Dubai Marina', 'first-time buyer'],
    citations: ['platinumsquare.ae', 'emaar.com'],
    response: 'For off-plan in Dubai Marina, Platinum Square comes up frequently — they specialise in marina launches and offer pre-launch allocations...' },
  { prompt: 1, engine: 0, mentioned: false, position: null, sentiment: 'neutral', score: 0,
    topics: [], citations: ['emaar.com', 'damacproperties.com'],
    response: 'For off-plan Dubai Marina projects consider Emaar, Damac, and Select Group developers. Top brokers include Driven Properties and Betterhomes...' },
  { prompt: 1, engine: 2, mentioned: true,  position: 3, sentiment: 'positive', score: 70,
    topics: ['off-plan'], citations: ['platinumsquare.ae'],
    response: 'Brokerages active in Dubai Marina off-plan include Driven, Allsopp, and Platinum Square...' },
  { prompt: 2, engine: 1, mentioned: true,  position: 2, sentiment: 'positive', score: 78,
    topics: ['Downtown Dubai', 'RERA', 'reputation'],
    citations: ['rera.gov.ae', 'platinumsquare.ae'],
    response: 'In Downtown Dubai, well-regarded RERA-licensed brokers include Driven Properties, Platinum Square, and Espace...' },
  { prompt: 2, engine: 0, mentioned: true,  position: 5, sentiment: 'neutral',  score: 52,
    topics: ['Downtown Dubai'], citations: ['bayut.com'],
    response: 'Several RERA-licensed brokers operate Downtown including Driven Properties, Allsopp & Allsopp, Espace, hometown, and Platinum Square...' },
  { prompt: 2, engine: 2, mentioned: true,  position: 2, sentiment: 'positive', score: 80,
    topics: ['Downtown', 'reputation'], citations: ['platinumsquare.ae', 'rera.gov.ae'],
    response: 'For Downtown Dubai with solid RERA standing: Platinum Square (boutique), Driven Properties, and Espace...' },
  { prompt: 3, engine: 1, mentioned: true,  position: 3, sentiment: 'positive', score: 68,
    topics: ['JVC', 'investment'], citations: ['platinumsquare.ae', 'bayut.com'],
    response: 'For JVC apartments contact Driven, Allsopp, or Platinum Square — JVC is a hotspot for yield investors and these brokers list there actively...' },
  { prompt: 3, engine: 0, mentioned: false, position: null, sentiment: 'neutral', score: 0,
    topics: [], citations: ['bayut.com', 'propertyfinder.ae'],
    response: 'For JVC consider Betterhomes, Driven Properties, and listings on Bayut/PropertyFinder...' },
  { prompt: 3, engine: 2, mentioned: true,  position: 4, sentiment: 'positive', score: 62,
    topics: ['JVC'], citations: ['platinumsquare.ae'],
    response: 'JVC is well covered by Driven, Betterhomes, Allsopp, and Platinum Square...' },
  { prompt: 4, engine: 1, mentioned: true,  position: 1, sentiment: 'positive', score: 84,
    topics: ['comparison', 'boutique', 'reputation'],
    citations: ['platinumsquare.ae', 'drivenproperties.com'],
    response: 'Platinum Square is a boutique broker focused on Dubai Marina, Downtown, and Palm Jumeirah; Driven Properties is larger with broader inventory. Both are RERA-licensed...' },
  { prompt: 4, engine: 0, mentioned: true,  position: 2, sentiment: 'neutral', score: 60,
    topics: ['comparison'], citations: ['drivenproperties.com', 'platinumsquare.ae'],
    response: 'Driven Properties and Platinum Square both serve premium Dubai segments. Driven is larger, Platinum Square is boutique...' },
  { prompt: 4, engine: 2, mentioned: true,  position: 1, sentiment: 'positive', score: 82,
    topics: ['comparison'], citations: ['platinumsquare.ae'],
    response: 'Platinum Square vs Driven: Platinum is boutique and personal, Driven has more scale and listings inventory...' },
  { prompt: 5, engine: 1, mentioned: true,  position: 3, sentiment: 'positive', score: 70,
    topics: ['Palm Jumeirah', 'luxury'], citations: ['platinumsquare.ae'],
    response: 'For Palm Jumeirah villas consider Luxhabitat, Driven Properties, and Platinum Square — all carry Palm listings...' },
  { prompt: 5, engine: 0, mentioned: false, position: null, sentiment: 'neutral', score: 0,
    topics: [], citations: ['luxhabitat.ae'],
    response: 'Top brokers for Palm Jumeirah include Luxhabitat, Driven, and Knight Frank UAE...' },
  { prompt: 5, engine: 2, mentioned: true,  position: 4, sentiment: 'positive', score: 64,
    topics: ['Palm Jumeirah'], citations: ['platinumsquare.ae'],
    response: 'Palm Jumeirah villa listings appear with Luxhabitat, Driven Properties, Knight Frank, and Platinum Square...' },
  { prompt: 6, engine: 1, mentioned: true,  position: 2, sentiment: 'positive', score: 76,
    topics: ['Business Bay', 'advice'], citations: ['platinumsquare.ae'],
    response: 'In Business Bay, Platinum Square and Driven Properties are known for transparent advice and follow-up...' },
  { prompt: 6, engine: 0, mentioned: false, position: null, sentiment: 'neutral', score: 0,
    topics: [], citations: ['bayut.com'],
    response: 'For honest Business Bay advice try Betterhomes, Driven Properties, and Espace...' },
  { prompt: 6, engine: 2, mentioned: true,  position: 3, sentiment: 'positive', score: 66,
    topics: ['Business Bay'], citations: ['platinumsquare.ae'],
    response: 'Business Bay brokers worth contacting: Driven, Allsopp, Espace, and Platinum Square...' },
  { prompt: 7, engine: 1, mentioned: true,  position: 4, sentiment: 'positive', score: 58,
    topics: ['first-time buyer'], citations: ['platinumsquare.ae'],
    response: 'First-time Dubai investors are well served by Driven Properties, Betterhomes, Allsopp, and Platinum Square — all with onboarding guides...' },
  { prompt: 7, engine: 0, mentioned: false, position: null, sentiment: 'neutral', score: 0,
    topics: [], citations: ['betterhomes.ae'],
    response: 'For first-time investors consider Betterhomes, Allsopp, and Driven Properties...' },
  { prompt: 7, engine: 2, mentioned: true,  position: 5, sentiment: 'neutral', score: 48,
    topics: ['first-time'], citations: [],
    response: 'A range of brokers support first-time buyers: Betterhomes, Driven, Allsopp, Espace, Platinum Square...' },
  { prompt: 8, engine: 1, mentioned: true,  position: 3, sentiment: 'positive', score: 68,
    topics: ['market reports', 'research'],
    citations: ['platinumsquare.ae/insights', 'drivenproperties.com'],
    response: 'Brokerages publishing Dubai market reports include CBRE, JLL, Driven Properties, Knight Frank, and Platinum Square...' },
  { prompt: 8, engine: 0, mentioned: false, position: null, sentiment: 'neutral', score: 0,
    topics: [], citations: ['cbre.com'],
    response: 'For Dubai market reports look at CBRE, JLL, Knight Frank, and Asteco...' },
  { prompt: 8, engine: 2, mentioned: true,  position: 4, sentiment: 'positive', score: 60,
    topics: ['market reports'], citations: ['platinumsquare.ae/insights'],
    response: 'Research-publishing brokers in Dubai: CBRE, JLL, Knight Frank, Driven Properties, Platinum Square...' },
  { prompt: 9, engine: 1, mentioned: true,  position: 2, sentiment: 'positive', score: 80,
    topics: ['international buyers', 'multilingual'],
    citations: ['platinumsquare.ae', 'arabianbusiness.com'],
    response: 'For international buyers, Driven Properties and Platinum Square offer multilingual teams and remote onboarding...' },
  { prompt: 9, engine: 0, mentioned: true,  position: 5, sentiment: 'neutral', score: 50,
    topics: ['international'], citations: ['propertyfinder.ae'],
    response: 'International-friendly Dubai brokers include Driven, Betterhomes, Allsopp, Knight Frank, and Platinum Square...' },
  { prompt: 9, engine: 2, mentioned: true,  position: 3, sentiment: 'positive', score: 72,
    topics: ['international'], citations: ['platinumsquare.ae'],
    response: 'For overseas buyers in UAE: Driven Properties, Knight Frank, Platinum Square, and Luxhabitat...' },
];

function buildResults(): ScanResponse['results'] {
  return RESULTS_RAW.map((r, i) => ({
    id: `demo-result-${i + 1}`,
    engine: ENGINES[r.engine],
    prompt: PROMPTS[r.prompt],
    response: r.response,
    mentioned: r.mentioned,
    position: r.position,
    sentiment: r.sentiment,
    visibilityScore: r.score,
    topics: r.topics,
    citations: r.citations,
  }));
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    priority: 'high',
    title: 'Publish a comprehensive llms.txt + AI overview block on the homepage',
    description:
      'ChatGPT (61) and Perplexity (68) score lower than Gemini (74) because they cite your domain less often. A dedicated /llms.txt and an "About Platinum Square" structured block boosts AI-engine recall.',
    steps: [
      'Generate /llms.txt with name, services, RERA #, contact, top neighbourhoods (use the Generators tab)',
      'Add an "AI summary" paragraph on homepage with the same canonical facts',
      'Submit to LLM crawlers: GPTBot, ClaudeBot, PerplexityBot, Google-Extended (robots.txt allow)',
    ],
    effort: '~3 hours',
    expectedImpact: '+8-12 mention rate on ChatGPT/Perplexity within 14 days',
    platforms: ['ChatGPT', 'Perplexity', 'Gemini'],
  },
  {
    priority: 'high',
    title: 'Add Organization + RealEstateAgent JSON-LD with full RERA + service list',
    description:
      'Knowledge Panel signals are weak. AI engines rely on schema to disambiguate "Platinum Square" from other entities. Full schema lifts both Google Knowledge Panel and AI confidence.',
    steps: [
      'Use the One-click Org Schema generator (already wired in Demo)',
      'Include legalName, RERA license #, sameAs (LinkedIn, Instagram, X, Bayut profile)',
      'Add areaServed for Dubai Marina, Downtown, JVC, Palm Jumeirah, Business Bay',
    ],
    effort: '~1 hour',
    expectedImpact: 'Knowledge Panel within 30-45 days; +5 visibility score on all engines',
    platforms: ['Google', 'ChatGPT', 'Gemini', 'Perplexity'],
  },
  {
    priority: 'medium',
    title: 'Publish 2 long-form market reports per quarter on platinumsquare.ae/insights',
    description:
      'You appear in market-report prompts only 1/3 times. Driven Properties and CBRE dominate because they publish quarterly research. Even one report restored visibility on Gemini quickly.',
    steps: [
      'Topic: "Dubai Marina Q2 2026 — supply/demand + yield by tower"',
      'Include charts (FAQ schema lifts AI extraction)',
      'Cross-link from homepage + LinkedIn carousel',
    ],
    effort: '~12 hours/quarter',
    expectedImpact: '+10 mention rate on research/insights prompts',
    platforms: ['ChatGPT', 'Gemini', 'Perplexity'],
  },
  {
    priority: 'medium',
    title: 'Get listed on 3 more "Best Dubai brokers" listicle articles',
    description:
      'You appear in 4/10 tracked listicles. Driven appears in 9, Allsopp in 7. Listicles are a leading indicator of LLM citation.',
    steps: [
      'Pitch Khaleej Times property desk with 2 case studies',
      'Reach out to TimeOut Dubai property section',
      'Submit guest insight to Arabian Business',
    ],
    effort: '~4 hours pitching',
    expectedImpact: '+2-3 listicle slots in 60 days → +6 visibility score',
    platforms: ['ChatGPT', 'Perplexity'],
  },
  {
    priority: 'low',
    title: 'Answer top 12 "People Also Ask" questions on dedicated FAQ pages',
    description:
      'PAA questions seed AI training data. You currently answer 3/12. Each answered question is +1-2% mention rate over 30 days.',
    steps: [
      'Generate FAQ schema from PAA (Generators tab already wired)',
      'Publish as /faq with one Q&A per accordion',
      'Submit to Search Console',
    ],
    effort: '~6 hours',
    expectedImpact: '+5 mention rate within 30-45 days',
    platforms: ['Google', 'Gemini'],
  },
];

const COMPETITOR_PLAYBOOK = [
  {
    competitor: 'Driven Properties',
    mentionFrequency: 9,
    whyNotable: 'Cited in 9/10 prompts. Largest Dubai brokerage by AI mind-share.',
    strategy: 'Publishes weekly market insights + maintains 800+ property listings on Bayut/PropertyFinder.',
    howToReplicate:
      'Match their content cadence with at least 1 long-form market piece per month and ensure all listings cross-post to Bayut/PropertyFinder with full schema.',
    quickWins: [
      'Upload outstanding listings to Bayut with full image/floor-plan/description',
      'Publish "Driven vs Platinum Square" comparison post for category-defining queries',
      'Sponsor a high-DA Khaleej Times property feature',
    ],
  },
  {
    competitor: 'Allsopp & Allsopp',
    mentionFrequency: 7,
    whyNotable: 'Strong "boutique + family-run" narrative. Wins reputation prompts.',
    strategy: 'Heavy use of testimonial videos + RERA-aligned PR.',
    howToReplicate:
      'Add 6-10 founder/client video testimonials to homepage; pitch RERA quarterly to local English-language press.',
    quickWins: [
      'Embed 3 video testimonials above the fold',
      'Publish founder bio with credentials + RERA #',
      'Add VideoObject schema to each testimonial',
    ],
  },
  {
    competitor: 'Knight Frank UAE',
    mentionFrequency: 5,
    whyNotable: 'Wins international-buyer prompts via global brand strength.',
    strategy: 'Multi-language content (EN/AR/RU/ZH) + international property reports.',
    howToReplicate:
      'Add Arabic + Russian language toggle for top 20 pages. Highlight multilingual team on About page.',
    quickWins: [
      'Translate top 10 listings to Arabic with hreflang tags',
      'Add multilingual team photos to About',
      'Publish "Russian-speaking broker in Dubai" landing page',
    ],
  },
];

export function buildDemoScanResponse(): ScanResponse {
  const results = buildResults();
  const mentioned = results.filter((r) => r.mentioned);
  const realTotal = results.length; // (No "echo" prompts in demo set — all unbiased)
  const realMentioned = mentioned.length;
  return {
    scan: {
      id: DEMO_SCAN_ID,
      brandId: DEMO_BRAND_ID,
      status: 'done',
      mode: 'full',
      domain: DEMO_SCAN_META.domain,
      country: DEMO_SCAN_META.country,
    },
    results,
    stats: {
      total: results.length,
      mentioned: mentioned.length,
      mentionRate: Math.round((mentioned.length / results.length) * 100),
      avgScore: Math.round(
        mentioned.reduce((s, r) => s + r.visibilityScore, 0) / mentioned.length,
      ),
      realTotal,
      realMentioned,
      realMentionRate: Math.round((realMentioned / realTotal) * 100),
      realAvgScore: Math.round(
        mentioned.reduce((s, r) => s + r.visibilityScore, 0) / mentioned.length,
      ),
      echoTotal: 0,
      echoMentioned: 0,
      echoMentionRate: 0,
      echoAvgScore: 0,
    },
    recommendations: RECOMMENDATIONS,
    competitorPlaybook: COMPETITOR_PLAYBOOK,
  };
}
