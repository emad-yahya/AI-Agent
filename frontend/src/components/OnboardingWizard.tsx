import { useState } from 'react';
import { CheckCircle2, Globe, Loader2, Sparkles, X } from 'lucide-react';
import { api, type OnboardingAnalysis, type OnboardingStartResult } from '../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: (brand: string) => void;
}

export function OnboardingWizard({ open, onClose, onComplete }: Props) {
  const [step, setStep] = useState<'input' | 'analyzing' | 'review' | 'starting' | 'done'>('input');
  const [domain, setDomain] = useState('');
  const [country, setCountry] = useState('us');
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null);
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [allCompetitors, setAllCompetitors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startResult, setStartResult] = useState<OnboardingStartResult | null>(null);

  if (!open) return null;

  const handleAnalyze = async () => {
    if (!domain.trim()) {
      setError('Enter a domain (e.g. mybrand.com)');
      return;
    }
    setError(null);
    setStep('analyzing');
    try {
      const result = await api.analyzeOnboarding(domain.trim(), country || undefined);
      setAnalysis(result);
      setBrand(result.brand);
      setCategory(result.category ?? '');
      setAllCompetitors(result.suggestedCompetitors);
      setCompetitors(result.suggestedCompetitors.slice(0, 4));
      setStep('review');
    } catch (err) {
      setError((err as Error).message);
      setStep('input');
    }
  };

  const handleStart = async () => {
    if (!brand || !category || competitors.length === 0) {
      setError('Brand, category, and at least one competitor are required');
      return;
    }
    setError(null);
    setStep('starting');
    try {
      const result = await api.startOnboarding({
        brand,
        domain: analysis?.domain ?? domain,
        category,
        competitors,
        country,
      });
      setStartResult(result);
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
      setStep('review');
    }
  };

  const handleFinish = () => {
    onComplete(brand);
    onClose();
    setTimeout(() => {
      setStep('input');
      setDomain('');
      setAnalysis(null);
      setStartResult(null);
      setCompetitors([]);
      setAllCompetitors([]);
    }, 200);
  };

  const toggleCompetitor = (c: string) => {
    setCompetitors((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].slice(0, 6),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-blue-50 to-violet-50">
          <div className="flex items-center gap-3">
            <Sparkles className="text-violet-600" size={22} />
            <div>
              <h2 className="font-bold text-slate-900">Get Started in 60 seconds</h2>
              <p className="text-xs text-slate-600">
                Paste your domain → we'll find competitors + start 4 scans automatically
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {step === 'input' && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Your website</span>
                <div className="mt-1 flex items-center gap-2 border rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500">
                  <Globe size={18} className="text-slate-400" />
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="yourbrand.com"
                    className="flex-1 outline-none text-sm"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Country (Google search location)</span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="us">United States</option>
                  <option value="ae">United Arab Emirates</option>
                  <option value="sa">Saudi Arabia</option>
                  <option value="gb">United Kingdom</option>
                  <option value="de">Germany</option>
                  <option value="fr">France</option>
                  <option value="es">Spain</option>
                  <option value="it">Italy</option>
                  <option value="jp">Japan</option>
                  <option value="in">India</option>
                  <option value="au">Australia</option>
                  <option value="ca">Canada</option>
                </select>
              </label>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                onClick={handleAnalyze}
                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white py-3 rounded-lg font-semibold hover:opacity-90"
              >
                Analyze My Site
              </button>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-600">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="font-medium">Crawling site + finding competitors via Google…</p>
              <p className="text-xs">~15 seconds</p>
            </div>
          )}

          {step === 'review' && analysis && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 flex items-start gap-2">
                <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
                <div>
                  Auto-detected the basics. Confirm or edit below.
                  {analysis.crawlError && (
                    <p className="text-amber-700 mt-1">
                      Crawl notice: {analysis.crawlError} — guessed brand from domain.
                    </p>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Brand name</span>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. real estate, SaaS, dentist"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Competitors ({competitors.length} selected, max 6)
                </p>
                <p className="text-xs text-slate-500 mb-2">
                  We searched Google for "top {category || 'your category'}" and pulled the
                  top non-directory domains. Toggle which to track.
                </p>
                <div className="flex flex-wrap gap-2">
                  {allCompetitors.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No competitors auto-found. Add manually below.
                    </p>
                  )}
                  {allCompetitors.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleCompetitor(c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                        competitors.includes(c)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Add custom competitor domain + Enter"
                  className="mt-2 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim().toLowerCase();
                      if (val && !allCompetitors.includes(val)) {
                        setAllCompetitors([...allCompetitors, val]);
                        setCompetitors([...competitors, val].slice(0, 6));
                      }
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                onClick={handleStart}
                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white py-3 rounded-lg font-semibold hover:opacity-90"
              >
                Start All 4 Scans
              </button>
            </div>
          )}

          {step === 'starting' && (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-600">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="font-medium">Kicking off scans in parallel…</p>
            </div>
          )}

          {step === 'done' && startResult && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 font-medium">
                Scans started. They'll finish in the background (1-3 minutes each).
              </p>
              <ul className="space-y-2 text-sm">
                <StartItem label="AI visibility scan" result={startResult.aiScan} />
                <StartItem label="Competitor schema audit" result={startResult.competitorAudit} />
                <StartItem label="Brand presence (KP + Wikipedia)" result={startResult.brandPresence} />
                <StartItem label="On-page SEO + Core Web Vitals" result={startResult.onPageSeo} />
              </ul>
              <button
                onClick={handleFinish}
                className="w-full mt-3 bg-emerald-600 text-white py-2.5 rounded-lg font-semibold hover:bg-emerald-700"
              >
                Open Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StartItem({
  label,
  result,
}: {
  label: string;
  result: { ok: boolean; error?: string };
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-flex w-2 h-2 rounded-full ${
          result.ok ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      <span className="text-slate-700">{label}</span>
      {!result.ok && (
        <span className="text-xs text-red-600 ml-auto">{result.error}</span>
      )}
    </li>
  );
}
