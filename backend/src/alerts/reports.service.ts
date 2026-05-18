import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from 'src/firebase/firebase.service';
import { AlertsService } from './alerts.service';
import { Brand, ScanSummary } from 'src/common/types';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private firebase: FirebaseService,
    private alerts: AlertsService,
  ) {}

  @Cron('0 9 * * 1')
  async sendWeeklyReports() {
    this.logger.log('Sending weekly reports...');
    await this.sendScheduledReports('weekly');
  }

  @Cron('0 9 1 * *')
  async sendMonthlyReports() {
    this.logger.log('Sending monthly reports...');
    await this.sendScheduledReports('monthly');
  }

  private async sendScheduledReports(frequency: 'weekly' | 'monthly') {
    const snap = await this.firebase.brands().get();
    for (const doc of snap.docs) {
      try {
        const brandId = doc.id;
        const brand = doc.data() as Brand;
        const settings = await this.alerts.getAlertSettings(brandId);
        if (settings.reportFrequency !== frequency) continue;
        if (!settings.reportEmail) continue;
        await this.sendBrandReport(
          brandId,
          brand.name,
          settings.reportEmail,
          frequency,
        );
      } catch (err) {
        this.logger.error(
          `Report failed for brand ${doc.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async sendBrandReport(
    brandId: string,
    brandName: string,
    email: string,
    frequency: string,
  ) {
    const limit = frequency === 'weekly' ? 7 : 30;
    const summariesSnap = await this.firebase
      .scanSummaries(brandId)
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    if (summariesSnap.empty) {
      this.logger.log(`No scan data for ${brandName} — skipping report`);
      return;
    }

    const summaries = summariesSnap.docs
      .map((d) => d.data() as ScanSummary)
      .reverse();

    const latest = summaries[summaries.length - 1];
    const oldest = summaries[0];
    const scoreDelta = latest.avgScore - oldest.avgScore;
    const periodLabel = frequency === 'weekly' ? 'Weekly' : 'Monthly';
    const dateLabel = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const html = this.buildReportHtml({
      brand: brandName,
      periodLabel,
      dateLabel,
      avgScore: latest.avgScore,
      mentionRate: latest.mentionRate,
      totalScans: summaries.length,
      scoreDelta,
      timeline: summaries.map((s) => ({
        date: s.date
          .toDate()
          .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        score: s.avgScore,
      })),
    });

    await this.alerts.sendReportEmail(
      email,
      `[${periodLabel} Report] ${brandName} — AI Visibility`,
      html,
    );
    this.logger.log(
      `${periodLabel} report sent to ${email} for brand ${brandName}`,
    );
  }

  private buildReportHtml(data: {
    brand: string;
    periodLabel: string;
    dateLabel: string;
    avgScore: number;
    mentionRate: number;
    totalScans: number;
    scoreDelta: number;
    timeline: { date: string; score: number }[];
  }): string {
    const {
      brand,
      periodLabel,
      dateLabel,
      avgScore,
      mentionRate,
      totalScans,
      scoreDelta,
      timeline,
    } = data;
    const deltaStr =
      scoreDelta >= 0 ? `▲ +${scoreDelta} pts` : `▼ ${scoreDelta} pts`;
    const deltaColor = scoreDelta >= 0 ? '#10b981' : '#ef4444';

    const timelineRows = timeline
      .map(
        (t) =>
          `<tr>
            <td style="padding:5px 10px;font-size:12px;color:#6b7280;">${t.date}</td>
            <td style="padding:5px 10px;font-size:12px;color:#1f2937;font-weight:500;">${t.score}/100</td>
          </tr>`,
      )
      .join('');

    return `<!DOCTYPE html><html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;background:#f9fafb;">
  <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <div style="border-bottom:3px solid #4f46e5;padding-bottom:16px;margin-bottom:24px;">
      <h1 style="font-size:20px;margin:0;color:#1f2937;">${periodLabel} AI Visibility Report</h1>
      <p style="font-size:13px;color:#6b7280;margin:6px 0 0 0;">${brand} · ${dateLabel}</p>
    </div>

    <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="background:#f0f0ff;border-radius:8px;padding:16px;text-align:center;width:33%;">
          <div style="font-size:30px;font-weight:bold;color:#4f46e5;">${avgScore}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Avg Score</div>
          <div style="font-size:11px;color:${deltaColor};margin-top:4px;font-weight:600;">${deltaStr}</div>
        </td>
        <td width="10"></td>
        <td style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;width:33%;">
          <div style="font-size:30px;font-weight:bold;color:#10b981;">${mentionRate}%</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Mention Rate</div>
        </td>
        <td width="10"></td>
        <td style="background:#fffbeb;border-radius:8px;padding:16px;text-align:center;width:33%;">
          <div style="font-size:30px;font-weight:bold;color:#f59e0b;">${totalScans}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Scans This Period</div>
        </td>
      </tr>
    </table>

    <h3 style="font-size:13px;font-weight:600;color:#374151;margin:0 0 8px 0;">Score Trend</h3>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:6px 10px;font-size:11px;text-align:left;color:#9ca3af;font-weight:500;">Date</th>
          <th style="padding:6px 10px;font-size:11px;text-align:left;color:#9ca3af;font-weight:500;">Score</th>
        </tr>
      </thead>
      <tbody>${timelineRows}</tbody>
    </table>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px 0;">
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0;">
      Generated by <strong>AI Visibility Tracker</strong> · ${periodLabel} Report
    </p>
  </div>
</body>
</html>`;
  }
}
