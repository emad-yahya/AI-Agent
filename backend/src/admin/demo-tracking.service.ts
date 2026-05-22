import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Request } from 'express';
import { FirebaseService } from 'src/firebase/firebase.service';

/**
 * Firestore-backed visit log for the public demo account. Captures every
 * /auth/demo-login as a session document and keeps a `lastActiveAt` heartbeat
 * field that the frontend pings every 60s so we can derive session duration
 * and "currently active" without needing reliable logout signals.
 *
 * Owner-only admin endpoints in DemoTrackingController surface this in the
 * Settings tab so Emad can see who's poking around the demo.
 */
@Injectable()
export class DemoTrackingService {
  private readonly logger = new Logger(DemoTrackingService.name);

  // A session is "active" if it's heartbeated within this window.
  private readonly ACTIVE_WINDOW_MS = 2 * 60 * 1000;

  constructor(private firebase: FirebaseService) {}

  private col() {
    return this.firebase.getDb().collection('demo_sessions');
  }

  /**
   * Read a best-effort client IP. Trusts standard reverse-proxy headers
   * (Railway / Vercel / Cloudflare) before falling back to req.ip. We don't
   * try to be clever about XFF chains — just take the first segment.
   */
  private extractIp(req: Request): string {
    const xff = (req.headers['x-forwarded-for'] as string) ?? '';
    if (xff) return xff.split(',')[0].trim();
    const real = req.headers['x-real-ip'] as string | undefined;
    if (real) return real.trim();
    return req.ip ?? 'unknown';
  }

  /**
   * Read country code from CDN/proxy headers if present. Railway exposes
   * `x-real-country`, Vercel `x-vercel-ip-country`, Cloudflare `cf-ipcountry`.
   * Returns null if no provider tagged the request.
   */
  private extractCountry(req: Request): string | null {
    const candidates = [
      'cf-ipcountry',
      'x-vercel-ip-country',
      'x-real-country',
      'x-country-code',
    ];
    for (const h of candidates) {
      const v = req.headers[h];
      if (typeof v === 'string' && v.trim().length > 0 && v !== 'XX') {
        return v.toUpperCase();
      }
    }
    return null;
  }

  /**
   * Compact a raw User-Agent into "Browser / OS" for the dashboard.
   * Full UA is stored too for forensic use.
   */
  private summariseUa(ua: string): string {
    if (!ua) return 'unknown';
    let browser = 'Other';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';
    else if (/CriOS/.test(ua)) browser = 'Chrome iOS';
    else if (/FxiOS/.test(ua)) browser = 'Firefox iOS';

    let os = 'Unknown OS';
    if (/Windows NT/.test(ua)) os = 'Windows';
    else if (/Mac OS X/.test(ua) && !/Mobile/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad/.test(ua)) os = 'iOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    return `${browser} / ${os}`;
  }

  async startSession(req: Request) {
    const ip = this.extractIp(req);
    const userAgent = (req.headers['user-agent'] as string) ?? '';
    const country = this.extractCountry(req);
    const referrer =
      ((req.headers['referer'] || req.headers['referrer']) as string) ?? null;

    const docData = {
      ip,
      userAgent,
      uaSummary: this.summariseUa(userAgent),
      country,
      referrer: referrer && referrer.length > 500 ? referrer.slice(0, 500) : referrer,
      startedAt: this.firebase.now(),
      lastActiveAt: this.firebase.now(),
    };
    const ref = await this.col().add(docData);
    this.logger.log(`demo session ${ref.id} started ip=${ip} country=${country ?? '?'}`);
    return ref.id;
  }

  /**
   * Idempotent heartbeat. Bumps lastActiveAt so derived duration grows and
   * the session stays in the "active" bucket. Silent no-op if id missing.
   */
  async heartbeat(sessionId: string) {
    if (!sessionId) return;
    try {
      await this.col().doc(sessionId).update({
        lastActiveAt: this.firebase.now(),
      });
    } catch (err) {
      // Stale id (cleared on backend) — don't surface
      this.logger.debug(
        `heartbeat ignored for missing session ${sessionId}: ${(err as Error).message}`,
      );
    }
  }

  async listSessions(limit = 200) {
    const snap = await this.col()
      .orderBy('startedAt', 'desc')
      .limit(Math.min(Math.max(limit, 1), 500))
      .get();

    const now = Date.now();
    return snap.docs.map((d) => {
      const data = d.data();
      const startedAt = (data.startedAt as admin.firestore.Timestamp).toDate();
      const lastActiveAt = (data.lastActiveAt as admin.firestore.Timestamp).toDate();
      const durationSec = Math.max(
        0,
        Math.round((lastActiveAt.getTime() - startedAt.getTime()) / 1000),
      );
      const active = now - lastActiveAt.getTime() < this.ACTIVE_WINDOW_MS;
      return {
        id: d.id,
        ip: (data.ip as string) ?? 'unknown',
        country: (data.country as string | null) ?? null,
        uaSummary: (data.uaSummary as string) ?? 'unknown',
        userAgent: (data.userAgent as string) ?? '',
        referrer: (data.referrer as string | null) ?? null,
        startedAt: startedAt.toISOString(),
        lastActiveAt: lastActiveAt.toISOString(),
        durationSec,
        active,
      };
    });
  }

  async summary() {
    const all = await this.listSessions(500);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const last24h = all.filter(
      (s) => now - new Date(s.startedAt).getTime() < dayMs,
    );
    const last7d = all.filter(
      (s) => now - new Date(s.startedAt).getTime() < 7 * dayMs,
    );
    const today = all.filter(
      (s) => new Date(s.startedAt).getTime() >= startOfToday.getTime(),
    );

    // Bucket by country / referrer source / UA
    const countryCounts: Record<string, number> = {};
    const referrerCounts: Record<string, number> = {};
    const uaCounts: Record<string, number> = {};
    let totalDuration = 0;
    let countedDuration = 0;
    for (const s of all) {
      const c = s.country ?? 'Unknown';
      countryCounts[c] = (countryCounts[c] ?? 0) + 1;
      const r = s.referrer ? safeHost(s.referrer) : 'Direct';
      referrerCounts[r] = (referrerCounts[r] ?? 0) + 1;
      uaCounts[s.uaSummary] = (uaCounts[s.uaSummary] ?? 0) + 1;
      if (s.durationSec > 0) {
        totalDuration += s.durationSec;
        countedDuration++;
      }
    }

    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([country, count]) => ({ country, count }));
    const topReferrers = Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([source, count]) => ({ source, count }));
    const topUas = Object.entries(uaCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ua, count]) => ({ ua, count }));

    return {
      total: all.length,
      last24h: last24h.length,
      last7d: last7d.length,
      today: today.length,
      active: all.filter((s) => s.active).length,
      avgDurationSec:
        countedDuration > 0 ? Math.round(totalDuration / countedDuration) : 0,
      topCountries,
      topReferrers,
      topUas,
    };
  }
}

function safeHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return 'Unknown';
  }
}
