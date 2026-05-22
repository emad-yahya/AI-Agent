import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as admin from 'firebase-admin';
import { FirebaseService } from 'src/firebase/firebase.service';
import { PublicUser, UserDoc, UserRole } from './users.types';

export interface CreateDemoInput {
  email: string;
  password: string;
  daysValid: number;
  maxMasterScans: number;
  maxScans: number;
}

export interface UpdateDemoInput {
  active?: boolean;
  addDaysValid?: number;
  maxMasterScans?: number;
  maxScans?: number;
  resetUsage?: boolean;
  newPassword?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private firebase: FirebaseService) {}

  private col() {
    return this.firebase.getDb().collection('users');
  }

  private toPublic(id: string, doc: UserDoc): PublicUser {
    const expiresAt = doc.expiresAt ? doc.expiresAt.toDate() : null;
    return {
      id,
      email: doc.email,
      role: doc.role,
      active: doc.active,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      maxMasterScans: doc.maxMasterScans,
      maxScans: doc.maxScans,
      usedMasterScans: doc.usedMasterScans,
      usedScans: doc.usedScans,
      createdAt: doc.createdAt.toDate().toISOString(),
      lastLoginAt: doc.lastLoginAt ? doc.lastLoginAt.toDate().toISOString() : null,
      expired: expiresAt ? expiresAt.getTime() < Date.now() : false,
    };
  }

  async findByEmail(email: string) {
    const snap = await this.col()
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, data: doc.data() as UserDoc };
  }

  async findById(id: string) {
    const doc = await this.col().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, data: doc.data() as UserDoc };
  }

  async verifyCredentials(email: string, password: string) {
    const found = await this.findByEmail(email);
    if (!found) return null;
    const ok = await bcrypt.compare(password, found.data.passwordHash);
    if (!ok) return null;
    if (!found.data.active) {
      throw new ForbiddenException('Account disabled');
    }
    if (found.data.expiresAt && found.data.expiresAt.toDate().getTime() < Date.now()) {
      throw new ForbiddenException('Account expired');
    }
    return found;
  }

  async touchLogin(id: string) {
    await this.col().doc(id).update({ lastLoginAt: this.firebase.now() });
  }

  async listAll(): Promise<PublicUser[]> {
    const snap = await this.col().orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => this.toPublic(d.id, d.data() as UserDoc));
  }

  async createOwner(email: string, password: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      // Update password if owner already exists (re-seed)
      await this.col().doc(existing.id).update({
        passwordHash: await bcrypt.hash(password, 10),
        role: 'owner',
        active: true,
      });
      return { id: existing.id, updated: true };
    }
    const ref = await this.col().add({
      email: email.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(password, 10),
      role: 'owner' as UserRole,
      active: true,
      expiresAt: null,
      maxMasterScans: 999999,
      maxScans: 999999,
      usedMasterScans: 0,
      usedScans: 0,
      createdAt: this.firebase.now(),
      createdBy: null,
      lastLoginAt: null,
    } as UserDoc);
    return { id: ref.id, updated: false };
  }

  async createDemo(input: CreateDemoInput, createdBy: string): Promise<PublicUser> {
    if (!input.email || !input.password) {
      throw new BadRequestException('email and password required');
    }
    if (input.password.length < 6) {
      throw new BadRequestException('password must be at least 6 chars');
    }
    const existing = await this.findByEmail(input.email);
    if (existing) throw new BadRequestException('email already in use');

    const days = Math.max(1, Math.floor(input.daysValid || 3));
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + days * 24 * 60 * 60 * 1000,
    );

    const docData: UserDoc = {
      email: input.email.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(input.password, 10),
      role: 'demo',
      active: true,
      expiresAt,
      maxMasterScans: Math.max(0, Math.floor(input.maxMasterScans ?? 1)),
      maxScans: Math.max(0, Math.floor(input.maxScans ?? 10)),
      usedMasterScans: 0,
      usedScans: 0,
      createdAt: this.firebase.now(),
      createdBy,
      lastLoginAt: null,
    };
    const ref = await this.col().add(docData);
    return this.toPublic(ref.id, docData);
  }

  async updateDemo(id: string, input: UpdateDemoInput): Promise<PublicUser> {
    const found = await this.findById(id);
    if (!found) throw new NotFoundException('user not found');
    if (found.data.role === 'owner') {
      throw new ForbiddenException('cannot modify owner via this endpoint');
    }

    const patch: Record<string, unknown> = {};
    if (typeof input.active === 'boolean') patch.active = input.active;
    if (typeof input.maxMasterScans === 'number') {
      patch.maxMasterScans = Math.max(0, Math.floor(input.maxMasterScans));
    }
    if (typeof input.maxScans === 'number') {
      patch.maxScans = Math.max(0, Math.floor(input.maxScans));
    }
    if (input.resetUsage) {
      patch.usedMasterScans = 0;
      patch.usedScans = 0;
    }
    if (input.addDaysValid && input.addDaysValid > 0) {
      const base =
        found.data.expiresAt && found.data.expiresAt.toDate().getTime() > Date.now()
          ? found.data.expiresAt.toDate().getTime()
          : Date.now();
      patch.expiresAt = admin.firestore.Timestamp.fromMillis(
        base + Math.floor(input.addDaysValid) * 24 * 60 * 60 * 1000,
      );
    }
    if (input.newPassword) {
      if (input.newPassword.length < 6) {
        throw new BadRequestException('password must be at least 6 chars');
      }
      patch.passwordHash = await bcrypt.hash(input.newPassword, 10);
    }
    await this.col().doc(id).update(patch);
    const fresh = await this.findById(id);
    return this.toPublic(fresh!.id, fresh!.data);
  }

  async deleteDemo(id: string) {
    const found = await this.findById(id);
    if (!found) throw new NotFoundException('user not found');
    if (found.data.role === 'owner') {
      throw new ForbiddenException('cannot delete owner');
    }
    await this.col().doc(id).delete();
    return { ok: true };
  }

  async changeOwnPassword(id: string, oldPassword: string, newPassword: string) {
    const found = await this.findById(id);
    if (!found) throw new NotFoundException('user not found');
    const ok = await bcrypt.compare(oldPassword, found.data.passwordHash);
    if (!ok) throw new ForbiddenException('current password wrong');
    if (newPassword.length < 6) {
      throw new BadRequestException('password must be at least 6 chars');
    }
    await this.col().doc(id).update({
      passwordHash: await bcrypt.hash(newPassword, 10),
    });
    return { ok: true };
  }

  // ── Quota helpers ─────────────────────────────────────────────────────────

  async checkScanQuota(userId: string, isMaster: boolean) {
    const found = await this.findById(userId);
    if (!found) throw new ForbiddenException('user not found');
    const u = found.data;
    if (u.role === 'owner') return;
    if (!u.active) throw new ForbiddenException('account disabled');
    if (u.expiresAt && u.expiresAt.toDate().getTime() < Date.now()) {
      throw new ForbiddenException('account expired');
    }
    if (isMaster) {
      if (u.usedMasterScans >= u.maxMasterScans) {
        throw new ForbiddenException(
          `Full scan quota exhausted (${u.usedMasterScans}/${u.maxMasterScans})`,
        );
      }
    } else {
      if (u.usedScans >= u.maxScans) {
        throw new ForbiddenException(
          `Scan quota exhausted (${u.usedScans}/${u.maxScans})`,
        );
      }
    }
  }

  async incrementUsage(userId: string, isMaster: boolean) {
    const found = await this.findById(userId);
    if (!found || found.data.role === 'owner') return;
    const field = isMaster ? 'usedMasterScans' : 'usedScans';
    await this.col()
      .doc(userId)
      .update({ [field]: admin.firestore.FieldValue.increment(1) });
  }

  publicShape(id: string, doc: UserDoc) {
    return this.toPublic(id, doc);
  }

  // ── Demo seed ──────────────────────────────────────────────────────────────

  /**
   * Returns the canonical demo seed account if one exists. The seed account is
   * the one whose email matches the DEMO_EMAIL env var (case-insensitive) and
   * whose role is 'demo'. /auth/demo-login uses this lookup so we never have
   * to expose credentials in the public link.
   */
  async findDemoSeed() {
    const email = (process.env.DEMO_EMAIL || 'demo@aivisibilitytracker.com')
      .toLowerCase()
      .trim();
    const found = await this.findByEmail(email);
    if (!found || found.data.role !== 'demo') return null;
    return found;
  }

  /**
   * Idempotent: ensures a demo account exists at boot. Re-runs every cold
   * start, so changing DEMO_PASSWORD via env var rotates the seed password.
   * The seed account never expires (expiresAt = null) so the public View Demo
   * link keeps working indefinitely.
   */
  async seedDemoAccount() {
    const email = (process.env.DEMO_EMAIL || 'demo@aivisibilitytracker.com')
      .toLowerCase()
      .trim();
    const password = process.env.DEMO_PASSWORD || 'demo-public-2026';
    const existing = await this.findByEmail(email);
    if (existing) {
      // Refresh password + ensure flags. Don't clobber usage counters.
      await this.col().doc(existing.id).update({
        passwordHash: await bcrypt.hash(password, 10),
        role: 'demo',
        active: true,
        expiresAt: null,
        maxMasterScans: 0,
        maxScans: 0,
      });
      this.logger.log(`Demo account refreshed: ${email}`);
      return { id: existing.id, updated: true };
    }
    const docData: UserDoc = {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'demo',
      active: true,
      expiresAt: null,
      maxMasterScans: 0,
      maxScans: 0,
      usedMasterScans: 0,
      usedScans: 0,
      createdAt: this.firebase.now(),
      createdBy: null,
      lastLoginAt: null,
    };
    const ref = await this.col().add(docData);
    this.logger.log(`Demo account seeded: ${email}`);
    return { id: ref.id, updated: false };
  }
}
