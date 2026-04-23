import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private db: Firestore;

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(
          path.join(process.cwd(), 'serviceAccountKey.json'),
        ),
      });
    }
    this.db = admin.firestore();
    this.logger.log('Firestore connected');
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

  now() {
    return admin.firestore.Timestamp.now();
  }
}
