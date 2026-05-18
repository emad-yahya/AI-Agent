import { useState } from 'react';
import { api } from '../api/client';
import { Loader2, Globe2 } from 'lucide-react';

interface Props {
  onSiteCreated: (siteId: string, brand: string, domain: string) => void;
}

const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: 'us', label: 'United States' },
  { code: 'ae', label: 'United Arab Emirates' },
  { code: 'sa', label: 'Saudi Arabia' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'de', label: 'Germany' },
  { code: 'fr', label: 'France' },
  { code: 'es', label: 'Spain' },
  { code: 'it', label: 'Italy' },
  { code: 'in', label: 'India' },
  { code: 'eg', label: 'Egypt' },
  { code: 'ca', label: 'Canada' },
  { code: 'au', label: 'Australia' },
  { code: 'br', label: 'Brazil' },
  { code: 'jp', label: 'Japan' },
  { code: 'tr', label: 'Turkey' },
];

export function SeoSiteForm({ onSiteCreated }: Props) {
  const [brand, setBrand] = useState('');
  const [domain, setDomain] = useState('');
  const [country, setCountry] = useState('us');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const cleanedDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    if (!brand.trim() || !cleanedDomain) return;

    setLoading(true);
    setError(null);

    try {
      const { siteId } = await api.createSeoSite({
        brand: brand.trim(),
        domain: cleanedDomain,
        country,
      });
      onSiteCreated(siteId, brand.trim(), cleanedDomain);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = e?.response?.data?.message ?? e?.message ?? 'Something went wrong';
      setError(typeof msg === 'string' ? msg : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-lg">
      <h2 className="text-lg font-medium text-gray-800 mb-1 flex items-center gap-2">
        <Globe2 className="w-5 h-5 text-blue-500" />
        Add your website
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Just paste your domain — we'll crawl your homepage, extract keywords, and track Google rankings.
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Brand name</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Acme Corp"
            disabled={loading}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 block">Website URL</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            disabled={loading}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 block">Target country</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={loading}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-50 disabled:text-gray-400 bg-white"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} ({c.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !brand.trim() || !domain.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white text-sm font-medium rounded-lg py-2.5
                     transition-colors duration-150"
        >
          {loading ? (
            <div className="flex flex-row justify-center gap-2 items-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Adding site...</span>
            </div>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Globe2 className="w-4 h-4" /> Add website
            </span>
          )}
        </button>

        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  );
}
