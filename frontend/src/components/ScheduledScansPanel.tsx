import { useEffect, useState } from 'react';
import { api, type SchedulerStatus } from '../api/client';
import { Calendar, Clock, Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { SectionIntro } from './Hint';

const PRESETS: Array<{ label: string; cron: string; description: string }> = [
  { label: 'Every 6 hours', cron: '0 */6 * * *', description: '4 scans/day' },
  { label: 'Daily at 9:00 AM', cron: '0 9 * * *', description: 'once per day' },
  { label: 'Daily at midnight', cron: '0 0 * * *', description: 'once per day' },
  { label: 'Weekly Monday 9:00', cron: '0 9 * * 1', description: 'once per week' },
];

export function ScheduledScansPanel() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customCron, setCustomCron] = useState('');

  const reload = async () => {
    try {
      const s = await api.getSchedulerStatus();
      setStatus(s);
      setCustomCron(s.cron);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleEnable = async (cron: string) => {
    setBusy('enable');
    setError(null);
    try {
      const s = await api.enableScheduler(cron);
      setStatus(s);
      setCustomCron(s.cron);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to enable');
    } finally {
      setBusy(null);
    }
  };

  const handleDisable = async () => {
    setBusy('disable');
    setError(null);
    try {
      const s = await api.disableScheduler();
      setStatus(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disable');
    } finally {
      setBusy(null);
    }
  };

  const handleRunNow = async () => {
    setBusy('runNow');
    setError(null);
    try {
      const { started } = await api.runSchedulerNow();
      await reload();
      setError(null);
      setTimeout(() => {
        // surface success briefly via the lastRunResult on status
        void reload();
      }, 1500);
      if (started === 0) {
        setError('No brands with category — add a brand first via "New scan"');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span className="text-sm text-gray-500">Loading scheduler...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <SectionIntro>
        Let the system run AI scans <b>automatically</b> for all your tracked brands. Pick a preset (daily/weekly) or write a custom cron. You don't need to be on the page — scans run on schedule and update the dashboard. Use this to build a real trend over time.
      </SectionIntro>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            Scheduled scans
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Run AI scans automatically for all tracked brands on a recurring schedule
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            status?.enabled
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {status?.enabled ? 'Active' : 'Disabled'}
        </span>
      </div>

      {status?.enabled && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-500">Schedule:</span>
            <code className="text-gray-700 bg-white px-1.5 py-0.5 rounded text-[11px]">
              {status.cron}
            </code>
          </div>
          {status.nextRun && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Next run:</span>
              <span className="text-gray-700">{new Date(status.nextRun).toLocaleString()}</span>
            </div>
          )}
          {status.lastRun && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Last run:</span>
              <span className="text-gray-700">
                {new Date(status.lastRun).toLocaleString()}
                {status.lastRunResult && ` — ${status.lastRunResult}`}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.cron}
            onClick={() => void handleEnable(p.cron)}
            disabled={busy !== null}
            className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
              status?.enabled && status.cron === p.cron
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            } disabled:opacity-50`}
          >
            <div className="font-medium">{p.label}</div>
            <div className="text-xs text-gray-400">{p.description}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customCron}
          onChange={(e) => setCustomCron(e.target.value)}
          placeholder="custom cron (e.g. 0 */4 * * *)"
          disabled={busy !== null}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono
                     focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
        />
        <button
          onClick={() => void handleEnable(customCron)}
          disabled={busy !== null || customCron.trim().length < 7}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm rounded-lg"
        >
          {busy === 'enable' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
        </button>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        {status?.enabled ? (
          <button
            onClick={() => void handleDisable()}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
          >
            {busy === 'disable' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Disable
          </button>
        ) : null}
        <button
          onClick={() => void handleRunNow()}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg disabled:opacity-50"
        >
          {busy === 'runNow' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Run now
        </button>
        <button
          onClick={() => void reload()}
          disabled={busy !== null}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-500 flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {status?.enabled && !error && (
        <div className="text-xs text-green-600 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Scheduled scans will run automatically — no backend restart needed.
        </div>
      )}
    </div>
  );
}
