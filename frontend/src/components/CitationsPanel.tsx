import { ExternalLink, Link2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ScanResult } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  results: ScanResult[];
  brand: string;
}

interface CitationRow {
  url: string;
  domain: string;
  count: number;
  mentionsBrand: boolean;
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

export function CitationsPanel({ results, brand }: Props) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo<CitationRow[]>(() => {
    const brandLower = brand.trim().toLowerCase();
    const map = new Map<string, CitationRow>();
    for (const r of results) {
      const cites = r.citations ?? [];
      const responseLower = r.response.toLowerCase();
      const responseMentionsBrand =
        brandLower.length > 1 && responseLower.includes(brandLower);
      for (const url of cites) {
        const existing = map.get(url);
        if (existing) {
          existing.count += 1;
          if (responseMentionsBrand) existing.mentionsBrand = true;
        } else {
          map.set(url, {
            url,
            domain: safeDomain(url),
            count: 1,
            mentionsBrand: responseMentionsBrand,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [results, brand]);

  if (rows.length === 0) return null;

  const totalSources = rows.length;
  const brandSources = rows.filter((r) => r.mentionsBrand).length;
  const coveragePct = totalSources > 0 ? Math.round((brandSources / totalSources) * 100) : 0;
  const visible = showAll ? rows : rows.slice(0, 12);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <SectionIntro>
        These are the exact pages AI engines (Gemini + Perplexity-style) read
        from the web to answer shopper queries about your category. To rank
        higher, your brand needs to appear on these pages — guest post, PR
        pitch, listicle inclusion, or build relationships with these sites.
      </SectionIntro>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-emerald-500" />
          AI Citation Sources
          <span className="text-xs text-gray-400 font-normal">
            — pages AI bots actually read
          </span>
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200 font-medium">
            <span className="font-bold">{totalSources}</span> source{totalSources === 1 ? '' : 's'}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border ${
              coveragePct >= 50
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : coveragePct >= 20
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span className="font-bold">{brandSources}/{totalSources}</span>
            <span>mention "{brand}" ({coveragePct}%)</span>
          </span>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
        {visible.map((row) => (
          <li
            key={row.url}
            className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-slate-50/60 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={`inline-flex items-center justify-center w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  row.mentionsBrand ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                title={row.mentionsBrand ? `Page's response mentioned ${brand}` : `Page cited but ${brand} not mentioned in that response`}
              />
              <span className="font-medium text-slate-700 truncate">{row.domain}</span>
              {row.count > 1 && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold flex-shrink-0">
                  ×{row.count}
                </span>
              )}
            </div>
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 flex-shrink-0"
            >
              Open
              <ExternalLink className="w-3 h-3" />
            </a>
          </li>
        ))}
      </ul>

      {rows.length > 12 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-700 font-medium"
        >
          {showAll ? 'Show top 12 only' : `Show all ${rows.length} sources`}
        </button>
      )}

      {brandSources === 0 && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          ⚠ Your brand was not mentioned on any of the {totalSources} pages AI
          engines cited. Priority: get featured on at least 3-5 of the
          top-frequency domains above (guest content, listicle inclusion, PR).
        </p>
      )}
    </div>
  );
}
