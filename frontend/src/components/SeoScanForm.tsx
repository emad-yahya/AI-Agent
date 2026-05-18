// frontend/src/components/SeoScanForm.tsx
import { useState } from 'react';
import { api } from '../api/client';
import { Loader2, SearchCheck } from 'lucide-react';

interface Props {
  onScanReady: (brandId: string, scanId: string, brand: string) => void;
}

export function SeoScanForm({ onScanReady }: Props) {
  const [brand, setBrand] = useState('');
  const [keywordsRaw, setKeywordsRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseKeywords = (raw: string): string[] =>
    raw
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 10);

  const handleSubmit = async () => {
    const keywords = parseKeywords(keywordsRaw);
    if (!brand.trim() || keywords.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const { brandId, scanId } = await api.createSeoScan(brand.trim(), keywords);
      onScanReady(brandId, scanId, brand.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const keywords = parseKeywords(keywordsRaw);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-lg">
      <h2 className="text-lg font-medium text-gray-800 mb-1">SEO Keyword Scan</h2>
      <p className="text-xs text-gray-400 mb-4">
        Check where your brand appears in Google search results for each keyword.
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Brand name</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Bosch"
            disabled={loading}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 block">
            Keywords{' '}
            <span className="text-gray-400">(one per line or comma-separated, max 10)</span>
          </label>
          <textarea
            value={keywordsRaw}
            onChange={(e) => setKeywordsRaw(e.target.value)}
            placeholder={"best home appliances\nbosch washing machine review\ntop dishwasher brands"}
            disabled={loading}
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-50 disabled:text-gray-400 resize-none"
          />
          {keywords.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">{keywords.length} keyword{keywords.length !== 1 ? 's' : ''} detected</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !brand.trim() || keywords.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded-lg py-2.5
                     transition-colors duration-150"
        >
          {loading ? (
            <div className="flex flex-row justify-center gap-2 items-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Starting scan...</span>
            </div>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <SearchCheck className="w-4 h-4" /> Run SEO scan
            </span>
          )}
        </button>

        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  );
}
