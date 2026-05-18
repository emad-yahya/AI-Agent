import { useEffect, useState } from 'react';
import { Bell, Send, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { api } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brandId: string;
  brandName: string;
}

export function AlertSettings({ brandId, brandName }: Props) {
  const [threshold, setThreshold] = useState<string>('');
  const [email, setEmail] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [reportFrequency, setReportFrequency] = useState<'weekly' | 'monthly' | 'disabled'>('disabled');
  const [reportEmail, setReportEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAlertSettings(brandId).then((s) => {
      setThreshold(s.alertThreshold !== null ? String(s.alertThreshold) : '');
      setEmail(s.alertEmail ?? '');
      setWebhookUrl(s.webhookUrl ?? '');
      setReportFrequency(s.reportFrequency ?? 'disabled');
      setReportEmail(s.reportEmail ?? '');
    }).catch(() => {});
  }, [brandId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveAlertSettings(brandId, {
        alertThreshold: threshold !== '' ? Number(threshold) : undefined,
        alertEmail: email || undefined,
        webhookUrl: webhookUrl || undefined,
        reportFrequency,
        reportEmail: reportEmail || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    try {
      await api.testWebhook(brandId);
    } catch (err) {
      setError('Webhook test failed — check the URL.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Bell className="w-4 h-4 text-amber-500" />
        Alerts &amp; Reports — {brandName}
      </h3>
      <SectionIntro>
        Get notified automatically. Set a <b>score threshold</b> and we'll email/webhook you when a scan drops below it. Optionally receive a weekly/monthly PDF report. Email needs SMTP configured on the backend.
      </SectionIntro>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Score alert threshold (0–100)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="e.g. 40"
              className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">
              Alert when score drops below this value
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Alert email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Requires EMAIL_HOST/USER/PASS in backend .env
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Webhook URL (Slack, Teams, Zapier, etc.)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleTest}
              disabled={!webhookUrl || testing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600
                hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <Send className="w-3 h-3" />
              {testing ? 'Sending...' : 'Test'}
            </button>
          </div>
        </div>

        {/* Scheduled Reports */}
        <div className="border-t border-gray-100 pt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            Scheduled PDF report
          </label>
          <div className="flex gap-2 mb-2">
            {(['disabled', 'weekly', 'monthly'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setReportFrequency(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize
                  ${reportFrequency === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
              >
                {f === 'disabled' ? 'Off' : f}
              </button>
            ))}
          </div>
          {reportFrequency !== 'disabled' && (
            <input
              type="email"
              value={reportEmail}
              onChange={(e) => setReportEmail(e.target.value)}
              placeholder="report@company.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          {reportFrequency === 'weekly' && (
            <p className="text-xs text-gray-400 mt-1">Sends every Monday at 9:00 AM</p>
          )}
          {reportFrequency === 'monthly' && (
            <p className="text-xs text-gray-400 mt-1">Sends on the 1st of each month at 9:00 AM</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-500">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 text-white rounded-lg
            text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saved
            ? <><CheckCircle className="w-4 h-4" /> Saved</>
            : saving ? 'Saving...' : 'Save alert settings'
          }
        </button>
      </div>
    </div>
  );
}
