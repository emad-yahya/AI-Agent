import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private db: Firestore;

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: this.loadCredential() });
    }
    this.db = admin.firestore();
    this.logger.log('Firestore connected');
  }

  private loadCredential(): admin.credential.Credential {
    const jsonEnv =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ??
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (jsonEnv && jsonEnv.trim().length > 0) {
      try {
        const parsed = JSON.parse(jsonEnv);
        this.logger.log('Using service account from env var');
        return admin.credential.cert(parsed);
      } catch (err) {
        this.logger.error(
          'FIREBASE_SERVICE_ACCOUNT_JSON set but not valid JSON',
          err instanceof Error ? err.message : String(err),
        );
        throw err;
      }
    }

    const filePath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(filePath)) {
      this.logger.log(`Using service account from ${filePath}`);
      return admin.credential.cert(filePath);
    }

    throw new Error(
      'No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_JSON env var ' +
        'or place serviceAccountKey.json in the backend working directory.',
    );
  }

  getDb() {
    return this.db;
  }

  brands() {
    return this.db.collection('brands');
  }

  scans(brandId: string) {
    return this.brands().doc(brandId).collection('scans');
  }

  results(brandId: string, scanId: string) {
    return this.scans(brandId).doc(scanId).collection('results');
  }

  scanSummaries(brandId: string) {
    return this.brands().doc(brandId).collection('scanSummaries');
  }

  seoScans(brandId: string) {
    return this.brands().doc(brandId).collection('seoScans');
  }

  seoSites() {
    return this.db.collection('seoSites');
  }

  seoSiteScans(siteId: string) {
    return this.seoSites().doc(siteId).collection('scans');
  }

  listicleGapScans(brandId: string) {
    return this.brands().doc(brandId).collection('listicleGapScans');
  }

  alertSettings(brandId: string) {
    return this.brands().doc(brandId).collection('config').doc('alerts');
  }

  schedulerConfig() {
    return this.db.collection('config').doc('scheduler');
  }

  now() {
    return admin.firestore.Timestamp.now();
  }
}
