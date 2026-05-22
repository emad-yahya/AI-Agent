/**
 * Hardcoded demo outputs for the public demo account.
 *
 * Demo users can click every generator button on the dashboard and see
 * a polished, copy-ready result without ever triggering an LLM call or
 * consuming Gemini credits. The outputs are modelled on the Platinum
 * Square brand so the entire demo tour stays internally consistent.
 *
 * Add a new fixture here when a new generator endpoint ships.
 */

const DEMO_BRAND = {
  name: 'Platinum Square',
  url: 'https://platinumsquare.ae',
  category: 'Dubai real estate brokerage',
};

function wrapJsonLd(schema: unknown): string {
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

export const DEMO_FIXTURES = {
  faqSchema() {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What does Platinum Square specialise in?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Platinum Square is a Dubai-based brokerage focused on prime residential and investment-grade property across Downtown Dubai, Dubai Marina, Palm Jumeirah and Business Bay. The team works with both end-users and HNW investors, with dedicated leasing, off-plan and resale desks.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is Platinum Square RERA registered?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Platinum Square is licensed by the Dubai Department of Economy and Tourism and every consultant carries an active RERA broker card from the Dubai Land Department. The RERA permit number is shown on every listing detail page and is verifiable through the DLD Trakheesi portal.',
          },
        },
        {
          '@type': 'Question',
          name: 'What commission does Platinum Square charge?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'For secondary sales the standard buyer-side commission is 2% of the transaction value plus 5% VAT, paid on signing the MoU. Rental transactions are 5% of the annual rent. Off-plan launches are paid by the developer at no cost to the buyer.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long does a Dubai property transaction take?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A typical cash secondary transaction closes in 14-21 days from signed MoU to DLD transfer. Mortgage transactions add 30-45 days for valuation and bank approval. Platinum Square coordinates NOC, DLD appointment, transfer day and key handover end-to-end.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can foreigners buy property in Dubai through Platinum Square?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Non-residents can buy freehold property anywhere inside Dubai\'s designated freehold areas with full ownership rights. Platinum Square handles the entire process remotely if needed — passport scan, POA, escrow account, and DLD transfer — and the new Golden Visa pathway is triggered above AED 2M.',
          },
        },
      ],
    };
    return {
      jsonLd: schema,
      htmlSnippet: wrapJsonLd(schema),
      installInstructions: [
        'Paste the <script> snippet inside the <head> of the page that displays these FAQs.',
        'Google requires the FAQ content to ALSO be visible on the page (not hidden behind accordions that are not rendered server-side).',
        'Validate with https://validator.schema.org/ and Google Rich Results Test.',
      ],
      demo: true as const,
    };
  },

  orgSchema() {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: DEMO_BRAND.name,
      url: DEMO_BRAND.url,
      logo: `${DEMO_BRAND.url}/logo.svg`,
      description:
        'Dubai-based real estate brokerage specialising in prime residential, off-plan and investment property across Downtown, Marina, Palm Jumeirah and Business Bay.',
      telephone: '+971-4-000-0000',
      email: 'hello@platinumsquare.ae',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Boulevard Plaza Tower 1, 24th Floor',
        addressLocality: 'Downtown Dubai',
        addressRegion: 'Dubai',
        postalCode: '00000',
        addressCountry: 'AE',
      },
      sameAs: [
        'https://www.instagram.com/platinumsquare',
        'https://www.linkedin.com/company/platinum-square',
        'https://www.facebook.com/platinumsquare.ae',
      ],
    };
    return {
      jsonLd: schema,
      htmlSnippet: wrapJsonLd(schema),
      installInstructions: [
        'Paste the <script> snippet inside <head> on every page (or just the homepage if you only have one canonical entity).',
        'Add as many sameAs links as you can — they tie your brand identity together for Google Knowledge Graph and AI engine attribution.',
        'Validate at https://validator.schema.org/',
      ],
      demo: true as const,
    };
  },

  articleSchema() {
    const now = new Date().toISOString();
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline:
        'Dubai Property Market Outlook 2026: Why Prime Downtown Is Still Underpriced',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${DEMO_BRAND.url}/insights/dubai-prime-outlook-2026`,
      },
      datePublished: now,
      dateModified: now,
      author: {
        '@type': 'Person',
        name: 'Sara Al-Mansoori',
        url: `${DEMO_BRAND.url}/team/sara-al-mansoori`,
      },
      publisher: {
        '@type': 'Organization',
        name: DEMO_BRAND.name,
        logo: { '@type': 'ImageObject', url: `${DEMO_BRAND.url}/logo.svg` },
      },
      image: `${DEMO_BRAND.url}/insights/downtown-outlook-2026.jpg`,
      description:
        'Why Dubai Downtown prime residential pricing still sits 28% below Q4 2014 highs despite record transaction volume, and which sub-markets institutional capital is rotating into in H1 2026.',
    };
    return {
      jsonLd: schema,
      htmlSnippet: wrapJsonLd(schema),
      installInstructions: [
        'Paste inside <head> of THE article page only — not site-wide.',
        'datePublished/dateModified must be ISO 8601 (e.g. 2026-05-19T10:00:00Z).',
        'Image should be 1200×630 minimum for rich result eligibility.',
      ],
      demo: true as const,
    };
  },

  reviewSchema() {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Platinum Square — Buyer Advisory',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        reviewCount: '142',
        bestRating: '5',
      },
      review: [
        {
          '@type': 'Review',
          author: { '@type': 'Person', name: 'Mohammed K.' },
          reviewBody:
            'Closed a Burj Vista 2BR in 12 days. The team handled NOC, DLD transfer and Ejari without me having to fly back to Dubai. End-to-end professional.',
          reviewRating: {
            '@type': 'Rating',
            ratingValue: '5',
            bestRating: '5',
          },
        },
        {
          '@type': 'Review',
          author: { '@type': 'Person', name: 'Aisha R.' },
          reviewBody:
            'They pushed back on a soft offer that other brokers told me was final. Saved AED 220K on a Marina Promenade unit. Negotiation that earned its fee.',
          reviewRating: {
            '@type': 'Rating',
            ratingValue: '5',
            bestRating: '5',
          },
        },
      ],
    };
    return {
      jsonLd: schema,
      htmlSnippet: wrapJsonLd(schema),
      installInstructions: [
        'AggregateRating must reflect REAL reviews visible on your site — Google policy.',
        'Add Product, Service, or Organization @type matching what is being rated.',
        'Display the same star rating + review count on the page (not just in schema).',
      ],
      demo: true as const,
    };
  },

  llmsTxt() {
    const content = `# ${DEMO_BRAND.name}

> Dubai-based real estate brokerage specialising in prime residential, off-plan, and investment-grade property. RERA-licensed, with desks for resale, leasing, off-plan launches, and HNW advisory.

Platinum Square represents buyers, sellers and tenants across Downtown Dubai, Dubai Marina, Palm Jumeirah, Business Bay, and Emirates Hills. Every consultant carries an active RERA broker card and works end-to-end — from sourcing and offer negotiation through MoU, NOC, DLD transfer, Ejari and key handover.

## Key Pages

- [Downtown Dubai Properties](${DEMO_BRAND.url}/downtown-dubai): Apartments and penthouses inside Burj Khalifa District — resale and off-plan.
- [Dubai Marina Properties](${DEMO_BRAND.url}/dubai-marina): Waterfront residential across Marina Walk and JBR.
- [Off-Plan Launches](${DEMO_BRAND.url}/off-plan): Pre-launch and EOI access for Emaar, Damac, Sobha, Aldar and Meraas.
- [Sell Your Property](${DEMO_BRAND.url}/sell): Listing playbook — valuation, marketing, viewings and negotiation.
- [About Platinum Square](${DEMO_BRAND.url}/about): RERA registration, leadership, team.

## Optional

- [Market Insights](${DEMO_BRAND.url}/insights): Monthly Dubai property reports and pricing data.
- [Golden Visa Guide](${DEMO_BRAND.url}/golden-visa): How property investment qualifies for the UAE Golden Visa.

## Contact

- Email: hello@platinumsquare.ae
`;
    return {
      filename: 'llms.txt',
      content,
      installInstructions: [
        `Upload the file as /llms.txt at the root of ${DEMO_BRAND.url} (same level as robots.txt).`,
        'Verify it returns HTTP 200 and Content-Type: text/plain or text/markdown.',
        'Spec: https://llmstxt.org',
      ],
      demo: true as const,
    };
  },

  robotsPatch() {
    const AI_BOTS = [
      'GPTBot',
      'ChatGPT-User',
      'OAI-SearchBot',
      'ClaudeBot',
      'anthropic-ai',
      'Claude-Web',
      'Google-Extended',
      'PerplexityBot',
      'CCBot',
      'Applebot-Extended',
      'cohere-ai',
      'Bytespider',
    ];
    const block = AI_BOTS.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n');
    const sitemap = `\n\nSitemap: ${DEMO_BRAND.url}/sitemap.xml`;
    const patch = '# AI engines — explicitly allowed\n' + block + sitemap;
    const fullFile =
      `# robots.txt for ${DEMO_BRAND.url}\nUser-agent: *\nAllow: /\nDisallow: /admin/\n\n` +
      patch +
      '\n';
    return {
      filename: 'robots.txt',
      patch,
      fullFile,
      installInstructions: [
        'If you already have a robots.txt: append the patch block to the end (keep existing rules).',
        "If you don't: upload the full file to your site root as /robots.txt.",
        'Test: open https://yourdomain/robots.txt — it should return 200 with the new rules visible.',
        'After deploy, re-run a Competitor Audit to confirm AI bots are now allowed.',
      ],
      botsAdded: AI_BOTS,
      demo: true as const,
    };
  },
};
