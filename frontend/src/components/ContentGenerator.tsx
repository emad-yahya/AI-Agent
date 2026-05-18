import { useState } from 'react';
import { Wand2, Copy, CheckCheck, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api/client';

type Platform = 'gmb' | 'linkedin' | 'blog' | 'twitter';

interface Props {
  brand: string;
  category: string;
  mentionRate?: number;
  avgScore?: number;
}

const PLATFORMS: { id: Platform; label: string; hint: string; maxChars?: number }[] = [
  { id: 'gmb', label: 'Google My Business', hint: 'Business description (≤750 chars)', maxChars: 750 },
  { id: 'linkedin', label: 'LinkedIn Post', hint: '150–300 words, professional tone' },
  { id: 'blog', label: 'Blog Post Outline', hint: 'SEO-optimized structure in Markdown' },
  { id: 'twitter', label: 'X / Twitter', hint: '3 alternatives, ≤280 chars each', maxChars: 280 },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      {copied ? (
        <>
          <CheckCheck className="w-3.5 h-3.5 text-green-500" />
          <span className="text-green-600">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-500">Copy</span>
        </>
      )}
    </button>
  );
}

export function ContentGenerator({ brand, category, mentionRate, avgScore }: Props) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('gmb');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPlatform = PLATFORMS.find((p) => p.id === platform)!;

  const handleGenerate = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return;

    setLoading(true);
    setContent(null);
    setError(null);

    try {
      const result = await api.generateContent(
        brand,
        category,
        platform,
        trimmedTopic,
        mentionRate,
        avgScore,
      );
      setContent(result.content);
    } catch {
      setError('Generation failed. Check your API key and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header — always visible, toggles panel */}
      <button
        className="w-full flex items-center justify-between p-5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-purple-600" />
          <div>
            <p className="text-base font-semibold text-gray-800">Content Generator</p>
            <p className="text-xs text-gray-400">
              Generate ready-to-use copy for {brand} — real LLM output, copy-paste directly
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-gray-100">
          {/* Platform selector */}
          <div className="flex flex-col gap-1.5 pt-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Platform
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPlatform(p.id);
                    setContent(null);
                  }}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    platform === p.id
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${platform === p.id ? 'text-purple-800' : 'text-gray-700'}`}
                  >
                    {p.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Topic input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Topic / Focus
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={`e.g. "Why ${brand} is the best ${category} in the area"`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
            <p className="text-xs text-gray-400">
              Be specific. The AI uses your scan data (mention rate, category) to write real content.
            </p>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-200 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate {selectedPlatform.label} content
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Output */}
          {content && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Generated content — {selectedPlatform.label}
                </p>
                <div className="flex items-center gap-2">
                  {selectedPlatform.maxChars && (
                    <span
                      className={`text-xs ${content.length > selectedPlatform.maxChars ? 'text-red-500 font-medium' : 'text-gray-400'}`}
                    >
                      {content.length} / {selectedPlatform.maxChars} chars
                    </span>
                  )}
                  <CopyButton text={content} />
                </div>
              </div>
              <textarea
                readOnly
                value={content}
                rows={10}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-gray-50 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
