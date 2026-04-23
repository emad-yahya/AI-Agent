// frontend/src/App.tsx
import { useState } from 'react';
import { ScanForm } from './components/ScanForm';
import { ResultTable } from './components/ResultsTable';
import { Dashboard } from './pages/Dashboard';
import { api, type ScanResponse } from './api/client';
import { useAsync } from './hooks/useAsync';
import { Eye, ScanSearch, LayoutDashboard } from 'lucide-react';

type Tab = 'scan' | 'dashboard';

export default function App() {
  const [tab, setTab] = useState<Tab>('scan');
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const { loading, run } = useAsync<ScanResponse>();

  const handleScanComplete = async (brandId: string, scanId: string) => {
    const result = await run(api.getScan(brandId, scanId));
    if (result) setScanResult(result);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              AI Visibility Tracker
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Track how your brand appears across AI search engines
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['scan', 'dashboard'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5
                  ${tab === t
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {t === 'scan'
                  ? <><ScanSearch className="w-4 h-4" /> New scan</>
                  : <><LayoutDashboard className="w-4 h-4" /> Dashboard</>
                }
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-8 py-8 flex flex-col gap-6">
        {tab === 'scan' && (
          <>
            <ScanForm onScanComplete={handleScanComplete} />

            {loading && (
              <div className="text-center text-sm text-gray-400 py-8">
                Fetching results...
              </div>
            )}

            {scanResult && !loading && (
              <ResultTable
                results={scanResult.results}
                stats={scanResult.stats}
              />
            )}
          </>
        )}

        {tab === 'dashboard' && <Dashboard />}
      </div>
    </div>
  );
}
