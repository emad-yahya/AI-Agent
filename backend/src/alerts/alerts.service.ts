import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { FirebaseService } from 'src/firebase/firebase.service';
import { AlertSettingsDto } from './alert-settings.dto';

export interface AlertSettings {
  alertThreshold: number | null;
  alertEmail: string | null;
  webhookUrl: string | null;
  reportFrequency: 'weekly' | 'monthly' | 'disabled' | null;
  reportEmail: string | null;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly mailerEnabled: boolean;
  private readonly transporter: nodemailer.Transporter | null = null;

  constructor(
    private firebase: FirebaseService,
    private config: ConfigService,
  ) {
    const host = this.config.get<string>('EMAIL_HOST');
    const user = this.config.get<string>('EMAIL_USER');
    const pass = this.config.get<string>('EMAIL_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('EMAIL_PORT', 587),
        secure: false,
        auth: { user, pass },
      });
      this.mailerEnabled = true;
      this.logger.log('Email alerts enabled');
    } else {
      this.mailerEnabled = false;
      this.logger.log('Email alerts disabled — EMAIL_HOST/USER/PASS not set');
    }
  }

  async getAlertSettings(brandId: string): Promise<AlertSettings> {
    const doc = await this.firebase.alertSettings(brandId).get();
    if (!doc.exists) {
      return {
        alertThreshold: null,
        alertEmail: null,
        webhookUrl: null,
        reportFrequency: null,
        reportEmail: null,
      };
    }
    const data = doc.data() as Partial<AlertSettings>;
    return {
      alertThreshold: data.alertThreshold ?? null,
      alertEmail: data.alertEmail ?? null,
      webhookUrl: data.webhookUrl ?? null,
      reportFrequency: data.reportFrequency ?? null,
      reportEmail: data.reportEmail ?? null,
    };
  }

  async saveAlertSettings(
    brandId: string,
    dto: AlertSettingsDto,
  ): Promise<AlertSettings> {
    await this.firebase.alertSettings(brandId).set(
      {
        ...(dto.alertThreshold !== undefined
          ? { alertThreshold: dto.alertThreshold }
          : {}),
        ...(dto.alertEmail !== undefined ? { alertEmail: dto.alertEmail } : {}),
        ...(dto.webhookUrl !== undefined ? { webhookUrl: dto.webhookUrl } : {}),
        ...(dto.reportFrequency !== undefined
          ? { reportFrequency: dto.reportFrequency }
          : {}),
        ...(dto.reportEmail !== undefined
          ? { reportEmail: dto.reportEmail }
          : {}),
      },
      { merge: true },
    );
    return this.getAlertSettings(brandId);
  }

  async checkAndAlert(
    brandId: string,
    brandName: string,
    scanId: string,
    score: number,
  ): Promise<void> {
    const settings = await this.getAlertSettings(brandId);
    if (settings.alertThreshold === null) return;
    if (score >= settings.alertThreshold) return;

    const subject = `[AI Visibility Alert] ${brandName} score dropped to ${score}`;
    const body = `Brand: ${brandName}\nScore: ${score}/100\nThreshold: ${settings.alertThreshold}\nScan ID: ${scanId}\n\nAction required — your AI visibility score is below the alert threshold.`;

    if (settings.alertEmail && this.mailerEnabled && this.transporter) {
      await this.sendEmail(settings.alertEmail, subject, body);
    }

    if (settings.webhookUrl) {
      await this.sendWebhook(settings.webhookUrl, {
        event: 'score_alert',
        brand: brandName,
        brandId,
        scanId,
        score,
        threshold: settings.alertThreshold,
      });
    }
  }

  async sendWebhookTest(brandId: string): Promise<void> {
    const settings = await this.getAlertSettings(brandId);
    if (!settings.webhookUrl) throw new Error('No webhook URL configured');
    await this.sendWebhook(settings.webhookUrl, {
      event: 'test',
      brand: brandId,
      score: 42,
      threshold: settings.alertThreshold,
      message: 'This is a test webhook from AI Visibility Tracker',
    });
  }

  async sendReportEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    if (!this.mailerEnabled || !this.transporter) {
      this.logger.warn('Email not configured — cannot send report');
      return;
    }
    try {
      const from = this.config.get<string>(
        'EMAIL_FROM',
        this.config.get('EMAIL_USER')!,
      );
      await this.transporter.sendMail({ from, to, subject, html });
      this.logger.log(`Report email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Report email failed: ${(err as Error).message}`);
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    try {
      const from = this.config.get<string>(
        'EMAIL_FROM',
        this.config.get('EMAIL_USER')!,
      );
      await this.transporter!.sendMail({ from, to, subject, text });
      this.logger.log(`Alert email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Email send failed: ${(err as Error).message}`);
    }
  }

  private async sendWebhook(
    url: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          timestamp: new Date().toISOString(),
        }),
      });
      this.logger.log(`Webhook sent to ${url} → ${res.status}`);
    } catch (err) {
      this.logger.error(`Webhook send failed: ${(err as Error).message}`);
    }
  }
}
