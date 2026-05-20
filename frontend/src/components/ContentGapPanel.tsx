import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { api, type ContentBrief, type ContentGapReport, type ScanResult } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
  domain?: string;
  results?: ScanResult[];
}

const POLL_MS = 3500;
const MAX_POLLS = 80;

export function ContentGapPanel({ brand, domain, results }: Props) {
  const [domainInput, setDomainInput] = useState(domain ?? '');
  const [queriesInput, setQueriesInput] = useState('');
  const [competitorsInput, setCompetitorsInput] = useState('');
  const [country, setCountry] = useState('us');
  const [report, setReport] = useState<ContentGapReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefQuery, setBriefQuery] = useState<string | null>(null);
  const [brief, setBrief] = useState<ContentBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [faqSchemaHtml, setFaqSchemaHtml] = useState<string | null>(null);
  const [faqSchemaLoading, setFaqSchemaLoading] = useState(false);
  const [faqSchemaCopied, setFaqSchemaCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  const openFaqSchema = async (questions: string[]) => {
    setFaqSchemaHtml('');
    setFaqSchemaLoading(true);
    setFaqSchemaCopied(false);
    try {
      const res = await api.generateFaqFromPaa({ questions, brand });
      setFaqSchemaHtml(res.htmlSnippet);
    } catch (err) {
      setFaqSchemaHtml(`<!-- Error: ${(err as Error).message} -->`);
    } finally {
      setFaqSchemaLoading(false);
    }
  };
  const copyFaqSchema = async () => {
    if (!faqSchemaHtml) return;
    try {
      await navigator.clipboard.writeText(faqSchemaHtml);
      setFaqSchemaCopied(true);
      setTimeout(() => setFaqSchemaCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const openBrief = async (query: string) => {
    setBriefQuery(query);
    setBrief(null);
    setBriefError(null);
    setBriefLoading(true);
    try {
      const b = await api.generateContentBrief({ query, brand, country });
      setBrief(b);
    } catch (err) {
      setBriefError((err as Error).message);
    } finally {
      setBriefLoading(false);
    }
  };
  const closeBrief = () => {
    setBriefQuery(null);
    setBrief(null);
    setBriefError(null);
    setBriefLoading(false);
  };

  // Pre-fill queries from AI scan results' prompts
  useEffect(() => {
    if (queriesInput || !results || results.length === 0) return;
    const prompts = Array.from(
      new Set(results.map((r) => r.prompt).filter(Boolean)),
    ).slice(0, 8);
    if (prompts.length > 0) setQueriesInput(prompts.join('\n'));
  }, [results, queriesInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listContentGapReports(brand);
        if (!cancelled && list[0] && list[0].status === 'done') setReport(list[0]);
      } catch {
        // none yet
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [brand]);

  const start = async () => {
    const queries = queriesInput.split('\n').map((q) => q.trim()).filter(Boolean);
    if (!domainInput.trim() || queries.length === 0) {
      setError('Domain + at least one query required');
      return;
    }
    const competitorDomains = competitorsInput
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    setError(null);
    setLoading(true);
    setReport(null);
    try {
      const { reportId, brandId } = await api.createContentGapScan({
        brand,
        domain: domainInput.trim(),
        queries,
        competitorDomains,
        country,
      });
      let polls = 0;
      pollRef.current = window.setInterval(async () => {
        polls += 1;
        try {
          const r = await api.getContentGapReport(brandId, reportId);
          if (r.status === 'done' || r.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setReport(r);
            setLoading(false);
            if (r.status === 'failed') setError('Scan failed');
          }
        } catch {
          /* keep polling */
        }
        if (polls >= MAX_POLLS && pollRef.current) {
          clearInterval(pollRef.current);
          setError('Timed out');
          setLoading(false);
        }
      }, POLL_MS);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Target className="text-violet-600" size={20} />
        <h3 className="font-bold text-slate-900">Content Gap Finder</h3>
      </div>
      <SectionIntro>
        <b>How it works:</b> for each query you list, we ask Google directly — which competitors rank, where you rank (if at all), People Also Ask suggestions, and an opportunity score (0–100) based on real SERP data. No LLM guesswork.
      </SectionIntro>

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder="Your domain (yourbrand.com)"
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={queriesInput}
          onChange={(e) => setQueriesInput(e.target.value)}
          placeholder="One query per line (e.g. 'best CRM for small business')"
          rows={5}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={competitorsInput}
            onChange={(e) => setCompetitorsInput(e.target.value)}
            placeholder="Competitor domains (optional, comma-sep)"
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="us">United States</option>
            <option value="ae">UAE</option>
            <option value="sa">Saudi Arabia</option>
            <option value="gb">UK</option>
            <option value="de">Germany</option>
            <option value="fr">France</option>
            <option value="in">India</option>
          </select>
        </div>
        <button
          onClick={start}
          disabled={loading}
          className="w-full bg-violet-600 text-white py-2.5 rounded-lg font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Scanning queries…' : 'Find Gaps'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      {briefQuery && (
        <ContentBriefModal
          query={briefQuery}
          brief={brief}
          loading={briefLoading}
          error={briefError}
          onClose={closeBrief}
        />
      )}

      {faqSchemaHtml !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <FileText size={14} /> FAQ Schema (paste in &lt;head&gt;)
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={copyFaqSchema}
                  disabled={faqSchemaLoading}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {faqSchemaCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {faqSchemaCopied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => setFaqSchemaHtml(null)}
                  className="p-1.5 rounded hover:bg-slate-100"
                >
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {faqSchemaLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="animate-spin mx-auto mb-2 text-amber-600" />
                  <p className="text-slate-600 text-xs">Generating answers + schema…</p>
                </div>
              ) : (
                <pre className="font-mono text-[11px] whitespace-pre-wrap text-slate-800 leading-relaxed bg-slate-50 p-3 rounded">
                  {faqSchemaHtml}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {report && report.status === 'done' && report.items && (
        <div className="mt-5 space-y-4">
          {report.summary && (
            <div className="grid grid-cols-4 gap-3 text-sm">
              <Box label="Queries" value={String(report.summary.totalQueries)} color="blue" />
              <Box label="You rank" value={String(report.summary.brandHasPageCount)} color="green" />
              <Box label="Gaps" value={String(report.summary.gapCount)} color="amber" />
              <Box label="Avg opportunity" value={`${report.summary.avgOpportunity}`} color="violet" />
            </div>
          )}
          <div className="space-y-2">
            {report.items
              .sort((a, b) => b.opportunityScore - a.opportunityScore)
              .map((it, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Search size={14} className="text-slate-400" />
                        <p className="font-medium text-sm text-slate-800">{it.query}</p>
                        <button
                          onClick={() => openBrief(it.query)}
                          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 hover:bg-violet-200"
                        >
                          <FileText size={11} /> Generate brief
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {it.brandHasPage ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 size={12} /> You rank #{it.brandPosition}
                          </span>
                        ) : (
                          <span className="text-red-600">No page found</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          it.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                          it.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{it.difficulty}</span>
                        <span className="text-violet-600 flex items-center gap-1">
                          <TrendingUp size={12} /> {it.opportunityScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  {it.competitorsRanking.length > 0 && (
                    <div className="mt-2 text-xs space-y-0.5">
                      <p className="text-slate-500">Competitors ranking:</p>
                      {it.competitorsRanking.slice(0, 3).map((c, ci) => (
                        <div key={ci} className="flex items-center gap-1.5">
                          <span className="text-slate-400">#{c.position}</span>
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5 truncate">
                            {c.domain} <ExternalLink size={10} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                  {it.paa && it.paa.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-slate-500">People Also Ask ({it.paa.length})</summary>
                      <ul className="mt-1 pl-4 list-disc text-slate-600 space-y-0.5">
                        {it.paa.map((q, qi) => <li key={qi}>{q}</li>)}
                      </ul>
                      <button
                        onClick={() => openFaqSchema(it.paa!)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200"
                      >
                        <FileText size={11} /> Generate FAQ schema from these
                      </button>
                    </details>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ContentBriefModal({
  query,
  brief,
  loading,
  error,
  onClose,
}: {
  query: string;
  brief: ContentBrief | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyAll = async () => {
    if (!brief) return;
    const md = briefToMarkdown(brief);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-violet-700">
              Content Brief
            </p>
            <h3 className="font-bold text-slate-900 text-sm truncate">{query}</h3>
          </div>
          <div className="flex items-center gap-1">
            {brief && (
              <button
                onClick={copyAll}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700"
              >
                {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy as Markdown'}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100">
              <X size={16} className="text-slate-500" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4 text-sm">
          {loading && (
            <div className="text-center py-10">
              <Loader2 className="animate-spin mx-auto mb-2 text-violet-600" />
              <p className="text-slate-600 text-xs">
                Fetching SERP + generating brief…
              </p>
            </div>
          )}
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          {brief && (
            <>
              <Field label="Intent">
                <span className="inline-block px-2 py-0.5 rounded text-[11px] uppercase font-bold bg-blue-100 text-blue-800 mr-2">
                  {brief.intent}
                </span>
                <span className="text-xs text-slate-600">{brief.intentReason}</span>
              </Field>
              <Field label="Target word count">
                <p className="text-lg font-bold text-violet-700">
                  {brief.targetWordCount.toLocaleString()} words
                </p>
              </Field>
              <Field label="Recommended <title>">
                <p className="font-mono text-xs bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
                  {brief.title}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {brief.title.length} chars (target 55-60)
                </p>
              </Field>
              <Field label="Meta description">
                <p className="font-mono text-xs bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
                  {brief.metaDescription}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {brief.metaDescription.length} chars (target 145-160)
                </p>
              </Field>
              {brief.h2Outline.length > 0 && (
                <Field label="Article outline (H2 → bullets)">
                  <ol className="space-y-2 list-decimal list-inside">
                    {brief.h2Outline.map((h, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-semibold text-slate-800">{h.heading}</span>
                        {h.bullets.length > 0 && (
                          <ul className="ml-5 mt-1 list-disc text-slate-600 space-y-0.5">
                            {h.bullets.map((b, bi) => (
                              <li key={bi}>{b}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </Field>
              )}
              {brief.entitiesToMention.length > 0 && (
                <Field label="Entities to mention (boosts AI topical authority)">
                  <div className="flex flex-wrap gap-1.5">
                    {brief.entitiesToMention.map((e, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {e}
                      </span>
                    ))}
                  </div>
                </Field>
              )}
              {brief.paaQuestions.length > 0 && (
                <Field label="People Also Ask (answer each in an H3 or FAQ)">
                  <ul className="space-y-0.5 list-disc list-inside text-xs text-slate-700">
                    {brief.paaQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </Field>
              )}
              {brief.relatedSearches.length > 0 && (
                <Field label="Related searches (semantic neighbours)">
                  <div className="flex flex-wrap gap-1.5">
                    {brief.relatedSearches.map((r, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {r}
                      </span>
                    ))}
                  </div>
                </Field>
              )}
              {brief.topCompetitors.length > 0 && (
                <Field label="Top SERP results to outrank">
                  <ol className="space-y-1 list-decimal list-inside text-xs">
                    {brief.topCompetitors.map((c, i) => (
                      <li key={i}>
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                          {c.title}
                        </a>
                        <p className="ml-5 text-slate-500 text-[11px] leading-snug">
                          {c.snippet}
                        </p>
                      </li>
                    ))}
                  </ol>
                </Field>
              )}
              {brief.schemaSuggestions.length > 0 && (
                <Field label="Schema markup to add">
                  <div className="flex flex-wrap gap-1.5">
                    {brief.schemaSuggestions.map((s, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                        {s}
                      </span>
                    ))}
                  </div>
                </Field>
              )}
              {brief.internalLinkSuggestions.length > 0 && (
                <Field label="Internal link suggestions">
                  <ul className="space-y-0.5 list-disc list-inside text-xs text-slate-700">
                    {brief.internalLinkSuggestions.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </Field>
              )}
              {brief.callToAction && (
                <Field label="Suggested call-to-action">
                  <p className="text-xs italic text-slate-700">"{brief.callToAction}"</p>
                </Field>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function briefToMarkdown(b: ContentBrief): string {
  return [
    `# Content Brief — ${b.query}`,
    '',
    `**Intent:** ${b.intent} — ${b.intentReason}`,
    `**Target word count:** ${b.targetWordCount}`,
    `**Title:** ${b.title}`,
    `**Meta description:** ${b.metaDescription}`,
    '',
    `## Outline`,
    ...b.h2Outline.flatMap((h) => [
      `### ${h.heading}`,
      ...h.bullets.map((bb) => `- ${bb}`),
      '',
    ]),
    `## Entities to mention`,
    ...b.entitiesToMention.map((e) => `- ${e}`),
    '',
    `## People Also Ask`,
    ...b.paaQuestions.map((q) => `- ${q}`),
    '',
    `## Related searches`,
    ...b.relatedSearches.map((r) => `- ${r}`),
    '',
    `## Top SERP results to outrank`,
    ...b.topCompetitors.map((c) => `- [${c.title}](${c.url}) — ${c.snippet}`),
    '',
    `## Schema markup`,
    ...b.schemaSuggestions.map((s) => `- ${s}`),
    '',
    `## Internal links`,
    ...b.internalLinkSuggestions.map((l) => `- ${l}`),
    '',
    `## Call to action`,
    b.callToAction,
  ].join('\n');
}

function Box({ label, value, color }: { label: string; value: string; color: 'blue' | 'green' | 'amber' | 'violet' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  return (
    <div className={`border rounded-lg p-3 ${colors[color]}`}>
      <p className="text-xs">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
