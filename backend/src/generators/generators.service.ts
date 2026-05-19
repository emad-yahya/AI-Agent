import { Injectable } from '@nestjs/common';
import {
  GenerateArticleSchemaDto,
  GenerateFaqSchemaDto,
  GenerateLlmsTxtDto,
  GenerateOrgSchemaDto,
  GenerateReviewSchemaDto,
  GenerateRobotsPatchDto,
} from './dto';

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

@Injectable()
export class GeneratorsService {
  generateFaqSchema(dto: GenerateFaqSchemaDto) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: dto.items.map((it) => ({
        '@type': 'Question',
        name: it.question.trim(),
        acceptedAnswer: {
          '@type': 'Answer',
          text: it.answer.trim(),
        },
      })),
    };
    return {
      jsonLd: schema,
      htmlSnippet: this.wrapJsonLd(schema),
      installInstructions: [
        'Paste the <script> snippet inside the <head> of the page that displays these FAQs.',
        'Google requires the FAQ content to ALSO be visible on the page (not hidden).',
        'Validate with https://validator.schema.org/ and Google Rich Results Test.',
      ],
    };
  }

  generateOrgSchema(dto: GenerateOrgSchemaDto) {
    const sameAs = dto.social
      ? Object.values(dto.social).filter((v): v is string => Boolean(v))
      : [];
    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': dto.type,
      name: dto.name,
      url: dto.url,
    };
    if (dto.logo) schema.logo = dto.logo;
    if (dto.description) schema.description = dto.description;
    if (dto.telephone) schema.telephone = dto.telephone;
    if (dto.email) schema.email = dto.email;
    if (dto.address) {
      schema.address = {
        '@type': 'PostalAddress',
        streetAddress: dto.address.streetAddress,
        addressLocality: dto.address.addressLocality,
        ...(dto.address.addressRegion && {
          addressRegion: dto.address.addressRegion,
        }),
        ...(dto.address.postalCode && { postalCode: dto.address.postalCode }),
        addressCountry: dto.address.addressCountry,
      };
    }
    if (sameAs.length > 0) schema.sameAs = sameAs;
    return {
      jsonLd: schema,
      htmlSnippet: this.wrapJsonLd(schema),
      installInstructions: [
        'Paste the <script> snippet inside <head> on every page (or just the homepage if you only have one canonical entity).',
        'Add as many sameAs links as you can — they tie your brand identity together for Google Knowledge Graph.',
        'Validate at https://validator.schema.org/',
      ],
    };
  }

  generateArticleSchema(dto: GenerateArticleSchemaDto) {
    const datePublished = dto.datePublished ?? new Date().toISOString();
    const dateModified = dto.dateModified ?? datePublished;
    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: dto.headline,
      mainEntityOfPage: { '@type': 'WebPage', '@id': dto.url },
      datePublished,
      dateModified,
      author: {
        '@type': 'Person',
        name: dto.authorName,
        ...(dto.authorUrl && { url: dto.authorUrl }),
      },
      publisher: {
        '@type': 'Organization',
        name: dto.publisherName,
        ...(dto.publisherLogo && {
          logo: { '@type': 'ImageObject', url: dto.publisherLogo },
        }),
      },
    };
    if (dto.image) schema.image = dto.image;
    if (dto.description) schema.description = dto.description;
    return {
      jsonLd: schema,
      htmlSnippet: this.wrapJsonLd(schema),
      installInstructions: [
        'Paste inside <head> of THE article page only — not site-wide.',
        'datePublished/dateModified must be ISO 8601 (e.g. 2026-05-19T10:00:00Z).',
        'Image should be 1200×630 minimum for rich result eligibility.',
      ],
    };
  }

  generateReviewSchema(dto: GenerateReviewSchemaDto) {
    const aggregate = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: dto.itemName,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: dto.ratingValue,
        reviewCount: dto.reviewCount,
        bestRating: '5',
      },
      ...(dto.reviews.length > 0 && {
        review: dto.reviews.map((r) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.author },
          reviewBody: r.reviewBody,
          reviewRating: {
            '@type': 'Rating',
            ratingValue: r.rating,
            bestRating: '5',
          },
        })),
      }),
    };
    return {
      jsonLd: aggregate,
      htmlSnippet: this.wrapJsonLd(aggregate),
      installInstructions: [
        'AggregateRating must reflect REAL reviews visible on your site — Google policy.',
        'Add Product, Service, or Organization @type matching what is being rated.',
        'Display the same star rating + review count on the page (not just in schema).',
      ],
    };
  }

  generateLlmsTxt(dto: GenerateLlmsTxtDto) {
    const lines: string[] = [];
    lines.push(`# ${dto.siteName}`);
    lines.push('');
    lines.push(`> ${dto.summary.trim()}`);
    lines.push('');
    if (dto.details) {
      lines.push(dto.details.trim());
      lines.push('');
    }
    if (dto.primaryLinks && dto.primaryLinks.length > 0) {
      lines.push('## Key Pages');
      lines.push('');
      for (const link of dto.primaryLinks) {
        const desc = link.description ? `: ${link.description}` : '';
        lines.push(`- [${link.title}](${link.url})${desc}`);
      }
      lines.push('');
    }
    if (dto.optionalLinks && dto.optionalLinks.length > 0) {
      lines.push('## Optional');
      lines.push('');
      for (const link of dto.optionalLinks) {
        const desc = link.description ? `: ${link.description}` : '';
        lines.push(`- [${link.title}](${link.url})${desc}`);
      }
      lines.push('');
    }
    if (dto.contactEmail) {
      lines.push('## Contact');
      lines.push('');
      lines.push(`- Email: ${dto.contactEmail}`);
      lines.push('');
    }
    const content = lines.join('\n');
    return {
      filename: 'llms.txt',
      content,
      installInstructions: [
        `Upload the file as /llms.txt at the root of ${dto.siteUrl} (same level as robots.txt).`,
        'Verify it returns HTTP 200 and Content-Type: text/plain or text/markdown.',
        'Spec: https://llmstxt.org',
      ],
    };
  }

  generateRobotsPatch(dto: GenerateRobotsPatchDto) {
    const existing = (dto.existingRobotsTxt ?? '').trim();
    const block = AI_BOTS.map((bot) => `User-agent: ${bot}\nAllow: /`).join(
      '\n\n',
    );
    const sitemap = dto.sitemapUrl ? `\n\nSitemap: ${dto.sitemapUrl}` : '';
    const fullFile =
      (existing ? existing + '\n\n' : '') +
      '# AI engines — explicitly allowed (added by AI Visibility Tracker)\n' +
      block +
      sitemap +
      '\n';
    return {
      filename: 'robots.txt',
      patch: '# AI engines — explicitly allowed\n' + block + sitemap,
      fullFile,
      installInstructions: [
        'If you already have a robots.txt: append the patch block to the end (keep existing rules).',
        'If you don\'t: upload the full file to your site root as /robots.txt.',
        'Test: open https://yourdomain/robots.txt — it should return 200 with the new rules visible.',
        'After deploy, re-run a Competitor Audit to confirm AI bots are now allowed.',
      ],
      botsAdded: AI_BOTS,
    };
  }

  private wrapJsonLd(schema: unknown): string {
    return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
  }
}
