import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AIService } from 'src/ai/ai.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import { CreateScanDto } from './dto';
import { Scan, ScanResult } from 'src/common/types';

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private firebase: FirebaseService,
    private ai: AIService,
  ) {}

  async createScan(dto: CreateScanDto) {
    const brandRef = await this.getOrCreateBrand(dto.brand);
    const brandId = brandRef.id;

    const scanRef = await this.firebase.scans(brandId).add({
      brandId,
      status: 'running',
      createdAt: this.firebase.now(),
    } as Scan);

    const scanId = scanRef.id;
    this.logger.log(`Scan created: ${scanId} for brand: ${dto.brand}`);

    const rawResults = await this.ai.runScan({
      brand: dto.brand,
      category: dto.category,
    });

    const batch = this.firebase.getDb().batch();

    for (const raw of rawResults) {
      const resultRef = this.firebase.results(brandId, scanId).doc();
      batch.set(resultRef, {
        scanId,
        engine: raw.engine,
        prompt: raw.prompt,
        response: raw.response,
        mentioned: raw.parsed.mentioned,
        position: raw.parsed.position,
        sentiment: raw.parsed.sentiment,
        visibilityScore: raw.parsed.visibilityScore,
        createdAt: this.firebase.now(),
      } as ScanResult);
    }

    await batch.commit();
    await scanRef.update({
      status: 'done',
      completedAt: this.firebase.now(),
    });
    this.logger.log(
      `Scan ${scanId} complete. ${rawResults.length} results saved.`,
    );
    return { scanId, brandId, resultCount: rawResults.length };
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

    return {
      scan: { id: scanId, ...scanDoc.data() },
      results,
      stats: {
        total: results.length,
        mentioned: mentioned.length,
        mentionRate,
        avgScore,
      },
    };
  }

  private async getOrCreateBrand(brandName: string) {
    const snapshot = await this.firebase
      .brands()
      .where('name', '==', brandName)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      this.logger.debug(`Brand found: ${brandName}`);
      return snapshot.docs[0].ref;
    }

    this.logger.debug(`Brand not found, creating: ${brandName}`);
    return this.firebase.brands().add({
      name: brandName,
      createdAt: this.firebase.now(),
    });
  }
}
