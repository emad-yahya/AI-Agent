import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AIService, RawResult } from 'src/ai/ai.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import { AlertsService } from 'src/alerts/alerts.service';
import { CreateScanDto } from './dto';
import { CompareDto } from './compare.dto';
import { GenerateContentDto } from './generate-content.dto';
import {
  CompetitorPlaybookEntry,
  Recommendation,
  Scan,
  ScanResult,
  ScanSummary,
  Sentiment,
} from 'src/common/types';
import { ScanEventsService } from './scan-events.service';
import { SCAN_JOB, SCAN_QUEUE } from './scan-queue.constants';

// Firestore single-field cap = 1,048,487 bytes. Truncate generously to leave
// room for UTF-8 multi-byte chars and other fields in the same document.
const FIRESTORE_FIELD_MAX_CHARS = 900_000;
function truncateForFirestore(text: string): string {
  if (!text) return text;
  if (Buffer.byteLength(text, 'utf8') <= FIRESTORE_FIELD_MAX_CHARS) return text;
  return text.slice(0, FIRESTORE_FIELD_MAX_CHARS) + '\n…[truncated]';
}

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private firebase: FirebaseService,
    private ai: AIService,
    private scanEvents: ScanEventsService,
    private alerts: AlertsService,
    @Optional() @InjectQueue(SCAN_QUEUE) private readonly queue: Queue | null,
  ) {}

  async createScan(dto: CreateScanDto) {
    const brandRef = await this.getOrCreateBrand(dto.brand, dto.category);
    const brandId = brandRef.id;
    const mode = dto.mode ?? 'quick';

    const scanRef = this.firebase.scans(brandId).doc();
    const scanId = scanRef.id;
    await scanRef.set({
      brandId,
      status: 'running',
      mode,
      createdAt: this.firebase.now(),
    } as Scan);

    this.logger.log(
      `Scan created: ${scanId} for brand: ${dto.brand} (mode=${mode})`,
    );

    if (this.queue) {
      await this.queue.add(SCAN_JOB, {
        scanId,
        brandId,
        brand: dto.brand,
        category: dto.category,
        mode,
      });
      this.logger.log(`Scan ${scanId} queued via BullMQ`);
    } else {
      void this.runScanInBackground(scanId, brandId, dto);
    }

    return { scanId, brandId };
  }

  async runScanInBackground(
    scanId: string,
    brandId: string,
    dto: CreateScanDto,
  ) {
    const scanRef = this.firebase.scans(brandId).doc(scanId);

    try {
      const rawResults = await this.ai.runScan(
        { brand: dto.brand, category: dto.category, mode: dto.mode ?? 'quick' },
        (completed, total) => {
          this.scanEvents.emit(scanId, { type: 'progress', completed, total });
        },
      );

      const batch = this.firebase.getDb().batch();

      for (const raw of rawResults) {
        const resultRef = this.firebase.results(brandId, scanId).doc();
        batch.set(resultRef, {
          scanId,
          engine: raw.engine,
          templateId: raw.template.id,
          prompt: raw.prompt,
          response: truncateForFirestore(raw.response),
          mentioned: raw.parsed.mentioned,
          position: raw.parsed.position,
          sentiment: raw.parsed.sentiment,
          visibilityScore: raw.parsed.visibilityScore,
          topics: raw.parsed.topics,
          citations: raw.citations ?? [],
          createdAt: this.firebase.now(),
        } as ScanResult);
      }

      await batch.commit();

      const [recommendations, competitorPlaybook] = await Promise.all([
        Promise.race([
          this.generateRecommendations(dto.brand, dto.category, rawResults),
          new Promise<Recommendation[]>((resolve) =>
            setTimeout(() => resolve([]), 25000),
          ),
        ]),
        Promise.race([
          this.generateCompetitorPlaybook(dto.brand, dto.category, rawResults),
          new Promise<CompetitorPlaybookEntry[]>((resolve) =>
            setTimeout(() => resolve([]), 25000),
          ),
        ]),
      ]);

      // Write pre-aggregated summary for fast analytics reads
      const summary = this.buildScanSummary(scanId, rawResults);
      await this.firebase
        .scanSummaries(brandId)
        .doc(scanId)
        .set({ ...summary, date: this.firebase.now() } as ScanSummary);

      const { anomaly, anomalyDelta } = await this.detectAnomaly(
        brandId,
        summary.avgScore,
      );

      if (anomaly) {
        this.logger.warn(
          `Anomaly detected for brand ${brandId}: score ${summary.avgScore} (delta ${anomalyDelta})`,
        );
      }

      await scanRef.update({
        status: 'done',
        completedAt: this.firebase.now(),
        anomaly,
        anomalyDelta,
        ...(recommendations.length > 0 ? { recommendations } : {}),
        ...(competitorPlaybook.length > 0 ? { competitorPlaybook } : {}),
      });

      this.scanEvents.emit(scanId, { type: 'done' });
      this.logger.log(
        `Scan ${scanId} complete. ${rawResults.length} results saved.`,
      );

      void this.alerts.checkAndAlert(
        brandId,
        dto.brand,
        scanId,
        summary.avgScore,
      );
    } catch (err) {
      await scanRef.update({ status: 'failed' });
      this.scanEvents.emit(scanId, {
        type: 'error',
        message: (err as Error).message,
      });
      this.logger.error(`Scan ${scanId} failed: ${(err as Error).message}`);
    }
  }

  async getScanResults(brandId: string, scanId: string) {
    const scanDoc = await this.firebase.scans(brandId).doc(scanId).get();
    if (!scanDoc.exists) {
      throw new NotFoundException(`Scan ${scanId} not found`);
    }

    const resultsSnap = await this.firebase
      .results(brandId, scanId)
      .orderBy('createdAt', 'asc')
      .get();

    const results = resultsSnap.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as ScanResult,
    );

    const mentioned = results.filter((r) => r.mentioned);
    const avgScore =
      mentioned.length > 0
        ? Math.round(
            mentioned.reduce((sum, r) => sum + r.visibilityScore, 0) /
              mentioned.length,
          )
        : 0;
    const mentionRate = Math.round((mentioned.length / results.length) * 100);

    // Real vs Echo split based on prompt templateId
    const realResults = results.filter(
      (r) => !ScansService.ECHO_TEMPLATE_IDS.has(r.templateId ?? ''),
    );
    const echoResults = results.filter((r) =>
      ScansService.ECHO_TEMPLATE_IDS.has(r.templateId ?? ''),
    );
    const realMentioned = realResults.filter((r) => r.mentioned);
    const echoMentioned = echoResults.filter((r) => r.mentioned);

    const scanData = scanDoc.data() as Scan;

    return {
      scan: { id: scanId, ...scanData },
      results,
      stats: {
        total: results.length,
        mentioned: mentioned.length,
        mentionRate,
        avgScore,
        realTotal: realResults.length,
        realMentioned: realMentioned.length,
        realMentionRate:
          realResults.length > 0
            ? Math.round((realMentioned.length / realResults.length) * 100)
            : 0,
        realAvgScore:
          realMentioned.length > 0
            ? Math.round(
                realMentioned.reduce((s, r) => s + r.visibilityScore, 0) /
                  realMentioned.length,
              )
            : 0,
        echoTotal: echoResults.length,
        echoMentioned: echoMentioned.length,
        echoMentionRate:
          echoResults.length > 0
            ? Math.round((echoMentioned.length / echoResults.length) * 100)
            : 0,
        echoAvgScore:
          echoMentioned.length > 0
            ? Math.round(
                echoMentioned.reduce((s, r) => s + r.visibilityScore, 0) /
                  echoMentioned.length,
              )
            : 0,
      },
      recommendations: scanData.recommendations ?? [],
      competitorPlaybook: scanData.competitorPlaybook ?? [],
    };
  }

  async listScansByBrand(brandName: string) {
    const brandSnap = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();

    if (brandSnap.empty) {
      throw new NotFoundException(`Brand "${brandName}" not found`);
    }

    const brandId = brandSnap.docs[0].id;

    const scansSnap = await this.firebase
      .scans(brandId)
      .orderBy('createdAt', 'desc')
      .get();

    return scansSnap.docs.map((doc) => {
      const data = doc.data() as Scan;
      return {
        scanId: doc.id,
        brandId,
        status: data.status,
        createdAt: data.createdAt.toDate().toISOString(),
        completedAt: data.completedAt?.toDate().toISOString() ?? null,
        anomaly: data.anomaly ?? false,
        anomalyDelta: data.anomalyDelta ?? 0,
      };
    });
  }

  async compareBrands(dto: CompareDto) {
    const brandResults = await Promise.all(
      dto.brands.map(async (brand) => {
        const rawResults = await this.ai.runScan({
          brand,
          category: dto.category,
        });
        return this.buildBrandComparison(brand, rawResults);
      }),
    );
    return brandResults;
  }

  private buildBrandComparison(brand: string, rawResults: RawResult[]) {
    const mentioned = rawResults.filter((r) => r.parsed.mentioned);
    const avgScore =
      mentioned.length > 0
        ? Math.round(
            mentioned.reduce((sum, r) => sum + r.parsed.visibilityScore, 0) /
              mentioned.length,
          )
        : 0;
    const mentionRate =
      rawResults.length > 0
        ? Math.round((mentioned.length / rawResults.length) * 100)
        : 0;

    const engines = [...new Set(rawResults.map((r) => r.engine))];
    const byEngine: Record<
      string,
      { mentionRate: number; avgScore: number; sentiment: Sentiment }
    > = {};

    for (const engine of engines) {
      const engineResults = rawResults.filter((r) => r.engine === engine);
      const engineMentioned = engineResults.filter((r) => r.parsed.mentioned);
      const engineAvgScore =
        engineMentioned.length > 0
          ? Math.round(
              engineMentioned.reduce(
                (sum, r) => sum + r.parsed.visibilityScore,
                0,
              ) / engineMentioned.length,
            )
          : 0;
      const engineMentionRate = Math.round(
        (engineMentioned.length / engineResults.length) * 100,
      );
      const sentiments = engineMentioned.map((r) => r.parsed.sentiment);
      const pos = sentiments.filter((s) => s === 'positive').length;
      const neg = sentiments.filter((s) => s === 'negative').length;
      const sentiment: Sentiment =
        pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';

      byEngine[engine] = {
        mentionRate: engineMentionRate,
        avgScore: engineAvgScore,
        sentiment,
      };
    }

    return {
      brand,
      stats: {
        total: rawResults.length,
        mentioned: mentioned.length,
        mentionRate,
        avgScore,
      },
      byEngine,
    };
  }

  // Echo buckets — prompts that MENTION the brand by name. Hitting these is
  // not "real visibility" because the LLM is responding to a brand cue.
  private static readonly ECHO_TEMPLATE_IDS = new Set([
    'top_alternatives',
    'brand_reputation',
  ]);

  private buildScanSummary(
    scanId: string,
    rawResults: RawResult[],
  ): Omit<ScanSummary, 'date'> {
    const mentioned = rawResults.filter((r) => r.parsed.mentioned);
    const avgScore =
      mentioned.length > 0
        ? Math.round(
            mentioned.reduce((s, r) => s + r.parsed.visibilityScore, 0) /
              mentioned.length,
          )
        : 0;
    const mentionRate = Math.round(
      (mentioned.length / rawResults.length) * 100,
    );

    // Split into real (unbiased) vs echo (brand-mention) buckets
    const realResults = rawResults.filter(
      (r) => !ScansService.ECHO_TEMPLATE_IDS.has(r.template.id),
    );
    const echoResults = rawResults.filter((r) =>
      ScansService.ECHO_TEMPLATE_IDS.has(r.template.id),
    );
    const realMentioned = realResults.filter((r) => r.parsed.mentioned);
    const echoMentioned = echoResults.filter((r) => r.parsed.mentioned);

    const engines = [...new Set(rawResults.map((r) => r.engine))];
    const byEngine: ScanSummary['byEngine'] = {};
    for (const engine of engines) {
      const er = rawResults.filter((r) => r.engine === engine);
      const em = er.filter((r) => r.parsed.mentioned);
      byEngine[engine] = {
        totalCalls: er.length,
        mentionRate: Math.round((em.length / er.length) * 100),
        avgScore:
          em.length > 0
            ? Math.round(
                em.reduce((s, r) => s + r.parsed.visibilityScore, 0) /
                  em.length,
              )
            : 0,
      };
    }

    return {
      scanId,
      avgScore,
      mentionRate,
      total: rawResults.length,
      mentioned: mentioned.length,
      realTotal: realResults.length,
      realMentioned: realMentioned.length,
      realMentionRate:
        realResults.length > 0
          ? Math.round((realMentioned.length / realResults.length) * 100)
          : 0,
      realAvgScore:
        realMentioned.length > 0
          ? Math.round(
              realMentioned.reduce(
                (s, r) => s + r.parsed.visibilityScore,
                0,
              ) / realMentioned.length,
            )
          : 0,
      echoTotal: echoResults.length,
      echoMentioned: echoMentioned.length,
      echoMentionRate:
        echoResults.length > 0
          ? Math.round((echoMentioned.length / echoResults.length) * 100)
          : 0,
      echoAvgScore:
        echoMentioned.length > 0
          ? Math.round(
              echoMentioned.reduce(
                (s, r) => s + r.parsed.visibilityScore,
                0,
              ) / echoMentioned.length,
            )
          : 0,
      byEngine,
    };
  }

  /**
   * Reverse-engineers competitor visibility — extracts top mentioned competitors from
   * scan results, then asks the LLM why each is notable + how a smaller brand can replicate.
   */
  private async generateCompetitorPlaybook(
    brand: string,
    category: string,
    rawResults: RawResult[],
  ): Promise<CompetitorPlaybookEntry[]> {
    try {
      const competitorFreq = this.extractCompetitorFrequency(brand, rawResults);
      const topCompetitors = competitorFreq.slice(0, 5);
      if (topCompetitors.length === 0) {
        this.logger.log('No competitors detected — skipping playbook');
        return [];
      }

      const prompt = this.buildPlaybookPrompt(
        brand,
        category,
        topCompetitors,
        rawResults,
      );
      const raw = await this.ai.generateText(prompt);
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) {
        this.logger.warn('Playbook: no JSON array in LLM response');
        return [];
      }
      const parsed = JSON.parse(match[0]) as CompetitorPlaybookEntry[];
      if (!Array.isArray(parsed)) return [];

      // Attach frequency from scan data (LLM may not know exact count)
      const freqMap = new Map(topCompetitors.map((c) => [c.name, c.count]));
      return parsed
        .filter(
          (p) =>
            p &&
            typeof p.competitor === 'string' &&
            typeof p.whyNotable === 'string' &&
            typeof p.strategy === 'string',
        )
        .map((p) => ({
          ...p,
          mentionFrequency: freqMap.get(p.competitor) ?? 0,
          quickWins: Array.isArray(p.quickWins) ? p.quickWins : [],
        }));
    } catch (err) {
      this.logger.warn(
        `Competitor playbook generation failed: ${(err as Error).message}`,
      );
      return [];
    }
  }

  // Phrases that look like Proper Nouns but are NOT brand/company names
  // (locations, generic concepts, time periods, etc.)
  private static readonly NON_COMPANY_PHRASES = new Set([
    'market knowledge',
    'in dubai',
    'in london',
    'in new york',
    'in paris',
    'real estate',
    'real estate market',
    'property market',
    'first time',
    'quick wins',
    'long term',
    'short term',
    'high quality',
    'low cost',
    'wide range',
    'years experience',
    'last year',
    'this year',
    'next year',
    'north america',
    'south america',
    'middle east',
    'south asia',
    'european union',
  ]);

  private extractCompetitorFrequency(
    brand: string,
    rawResults: RawResult[],
  ): Array<{ name: string; count: number }> {
    const brandLower = brand.toLowerCase();
    const counts = new Map<string, number>();
    for (const r of rawResults) {
      for (const topic of r.parsed.topics ?? []) {
        const t = topic.trim();
        if (!t) continue;
        if (t.toLowerCase().includes(brandLower)) continue;
        if (ScansService.NON_COMPANY_PHRASES.has(t.toLowerCase())) continue;
        // Drop single-word locations + phrases starting with "In " (e.g. "In Dubai")
        if (/^in\s+/i.test(t)) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private buildPlaybookPrompt(
    brand: string,
    category: string,
    topCompetitors: Array<{ name: string; count: number }>,
    rawResults: RawResult[],
  ): string {
    const competitorList = topCompetitors
      .map(
        (c) =>
          `- ${c.name} (mentioned ${c.count} time${c.count > 1 ? 's' : ''})`,
      )
      .join('\n');

    const sampleResponse = rawResults.find((r) =>
      topCompetitors.some((c) =>
        r.response.toLowerCase().includes(c.name.toLowerCase()),
      ),
    );
    const sampleSnippet = sampleResponse
      ? sampleResponse.response.slice(0, 500)
      : '';

    return `You are a competitive intelligence analyst for AI search visibility (ChatGPT, Gemini, Perplexity).

A smaller business "${brand}" (${category}) is being outranked in AI search results. AI responses frequently mention these candidate entities:

${competitorList}

Sample AI response context: "${sampleSnippet}"

CRITICAL FILTER — Before analyzing, REMOVE any candidate that is NOT an actual brand, company, or competing business. EXCLUDE:
- Geographic locations or neighborhoods (e.g. "Palm Jumeirah", "Downtown Dubai", "Manhattan")
- Generic descriptive phrases (e.g. "Market Knowledge", "Real Estate", "Premium Service")
- Time periods, country names, regions
- Industry concepts that are not company names

Only analyze entities that are CLEARLY company/brand names competing with "${brand}".
If fewer than 2 valid competitors remain after filtering, return the strongest ones plus a note.

For EACH valid competitor, explain in 2-3 concise sentences:
1. WHY the AI knows them (data sources, brand age, content footprint, citations)
2. Their visibility STRATEGY (PR, content, SEO, partnerships, schema, directories — be specific)
3. HOW TO REPLICATE — what "${brand}" can practically do in 30-90 days to compete
4. QUICK WINS — 2-3 concrete actions doable this week

Be specific and tactical. Avoid generic advice like "post on social media". Reference real platforms, directories, schema types, content formats, partnership types that fit "${category}".

Return ONLY a JSON array (filtered competitors only) — no markdown fences, no explanation:
[
  {
    "competitor": "exact company name from list above (filtered)",
    "whyNotable": "2-3 sentences on why AI mentions them",
    "strategy": "their specific visibility strategy",
    "howToReplicate": "what ${brand} can do in 30-90 days",
    "quickWins": ["specific action 1", "specific action 2", "specific action 3"]
  }
]`;
  }

  private async generateRecommendations(
    brand: string,
    category: string,
    rawResults: RawResult[],
  ): Promise<Recommendation[]> {
    try {
      const prompt = this.buildRecommendationsPrompt(
        brand,
        category,
        rawResults,
      );
      const raw = await this.ai.generateText(prompt);
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) {
        this.logger.warn('Recommendations: no JSON array in LLM response');
        return [];
      }
      const parsed = JSON.parse(match[0]) as Recommendation[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      this.logger.warn(
        `Recommendations generation failed: ${(err as Error).message}`,
      );
      return [];
    }
  }

  private buildRecommendationsPrompt(
    brand: string,
    category: string,
    rawResults: RawResult[],
  ): string {
    const mentioned = rawResults.filter((r) => r.parsed.mentioned);
    const avgScore =
      mentioned.length > 0
        ? Math.round(
            mentioned.reduce((s, r) => s + r.parsed.visibilityScore, 0) /
              mentioned.length,
          )
        : 0;
    const mentionRate = Math.round(
      (mentioned.length / rawResults.length) * 100,
    );

    const engines = [...new Set(rawResults.map((r) => r.engine))];
    const engineLines = engines
      .map((engine) => {
        const er = rawResults.filter((r) => r.engine === engine);
        const em = er.filter((r) => r.parsed.mentioned);
        const rate = Math.round((em.length / er.length) * 100);
        const avgPos =
          em.length > 0
            ? Math.round(
                em.reduce((s, r) => s + (r.parsed.position ?? 10), 0) /
                  em.length,
              )
            : null;
        const sent = em.length > 0 ? em[0].parsed.sentiment : 'N/A';
        return `- ${engine}: ${rate}% mention rate${avgPos ? `, avg position #${avgPos}` : ', not mentioned'}, sentiment: ${sent}`;
      })
      .join('\n');

    return `You are an AI visibility expert helping businesses appear in AI search results (ChatGPT, Gemini, Perplexity).

Business: "${brand}"
Business Type: ${category}
Overall Visibility Score: ${avgScore}/100
Overall Mention Rate: ${mentionRate}% (${mentioned.length}/${rawResults.length} AI responses)

Performance by AI Engine:
${engineLines}

Generate exactly 6 actionable recommendations specific to "${category}" businesses. Each must be concrete and specific to this industry type.

IMPORTANT: Tailor every recommendation to the business type. Examples:
- Restaurant: "Register on TripAdvisor and Zomato with full menu, 10+ photos, and weekly review responses"
- Marketing agency: "Publish 3 case studies on Clutch.co with specific ROI numbers like '340% ROI in 6 months'"
- Barber/salon: "Post weekly before/after photos on Instagram with local hashtags and Google Maps link in bio"
- Real estate: "Get featured in local property portals and publish market insights articles"

Focus on weakest engines first. If mention rate is below 50%, prioritize citation and directory building.

Return ONLY a JSON array — no explanation, no markdown fences:
[
  {
    "priority": "high",
    "title": "Short action title (max 8 words)",
    "description": "Why this specifically helps a ${category} appear in AI results (2 sentences max)",
    "steps": ["Specific step 1", "Specific step 2", "Specific step 3"],
    "effort": "1 hour",
    "expectedImpact": "What improvement to expect",
    "platforms": ["Platform1", "Platform2"]
  }
]

priority: "high" (do this week) | "medium" (do this month) | "low" (ongoing)
effort: "1 hour" | "half day" | "1 day" | "1 week" | "ongoing"`;
  }

  private async detectAnomaly(
    brandId: string,
    currentScore: number,
  ): Promise<{ anomaly: boolean; anomalyDelta: number }> {
    const snap = await this.firebase
      .scanSummaries(brandId)
      .orderBy('date', 'desc')
      .limit(10)
      .get();

    if (snap.size < 3) return { anomaly: false, anomalyDelta: 0 };

    const scores = snap.docs.map((d) => (d.data() as ScanSummary).avgScore);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const delta = Math.round(currentScore - mean);
    const zScore = stdDev > 0 ? (currentScore - mean) / stdDev : 0;

    return { anomaly: zScore < -1.5, anomalyDelta: delta };
  }

  async generateContent(dto: GenerateContentDto): Promise<string> {
    const prompt = this.buildContentPrompt(dto);
    return this.ai.generateText(prompt);
  }

  private buildContentPrompt(dto: GenerateContentDto): string {
    const contextLine =
      dto.mentionRate !== undefined
        ? `Current AI visibility: ${dto.mentionRate}% mention rate, quality score ${dto.avgScore ?? 0}/100.`
        : '';

    const platformInstructions: Record<string, string> = {
      gmb: `Write a Google My Business business description.
Rules: MAX 750 characters. Include what the business does, unique value proposition, and a soft call to action. Write in first person as the business owner. No phone numbers or URLs.`,

      linkedin: `Write a LinkedIn post.
Rules: 150-300 words. Start with a strong first line (no "I am excited to"). Include one concrete insight or tip. End with a question or call to action. Use short paragraphs. No hashtag spam (max 3 hashtags at the end only).`,

      blog: `Write a detailed blog post outline.
Rules: Include an SEO-optimized H1 title, a 2-sentence intro hook, 4-5 H2 sections each with 2-3 bullet sub-points, and a conclusion with CTA. Format in Markdown. Make it useful for someone searching for "${dto.topic}".`,

      twitter: `Write 3 alternative posts for X (Twitter).
Rules: MAX 280 characters each. Each must stand alone. Make them specific, not generic. No filler phrases. Number them: 1) ... 2) ... 3) ...`,
    };

    const instructions = platformInstructions[dto.platform] ?? '';

    return `You are a marketing copywriter writing content for a ${dto.category} business named "${dto.brand}".
${contextLine}
Topic to write about: ${dto.topic}

${instructions}

Output ONLY the final content. No intro like "Here is..." or "Sure!". No separators. Start directly.`;
  }

  private async getOrCreateBrand(brandName: string, category: string) {
    const snapshot = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      this.logger.debug(`Brand found: ${brandName}`);
      const ref = snapshot.docs[0].ref;
      await ref.update({ category });
      return ref;
    }

    this.logger.debug(`Brand not found, creating: ${brandName}`);
    return this.firebase.brands().add({
      name: brandName,
      category,
      createdAt: this.firebase.now(),
    });
  }
}
