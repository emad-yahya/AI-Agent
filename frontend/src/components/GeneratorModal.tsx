import { useState } from 'react';
import { Check, Code, Copy, Download, FileText, Loader2, X } from 'lucide-react';
import {
  api,
  type GeneratorResult,
  type LlmsTxtResult,
  type RobotsPatchResult,
} from '../api/client';

export type GeneratorKind = 'faq' | 'organization' | 'article' | 'review' | 'llmstxt' | 'robots';

interface Props {
  open: boolean;
  kind: GeneratorKind;
  onClose: () => void;
  context?: {
    brandName?: string;
    domain?: string;
  };
}

export function GeneratorModal({ open, kind, onClose, context }: Props) {
  if (!open) return null;
  const title: Record<GeneratorKind, string> = {
    faq: 'FAQ Schema Generator',
    organization: 'Organization Schema Generator',
    article: 'Article Schema Generator',
    review: 'Review / Rating Schema Generator',
    llmstxt: 'llms.txt Generator',
    robots: 'robots.txt AI-Bot Patch',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <Code className="text-blue-600" size={22} />
            <h2 className="font-bold text-slate-900">{title[kind]}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {kind === 'faq' && <FaqForm />}
          {kind === 'organization' && <OrgForm context={context} />}
          {kind === 'article' && <ArticleForm context={context} />}
          {kind === 'review' && <ReviewForm context={context} />}
          {kind === 'llmstxt' && <LlmsTxtForm context={context} />}
          {kind === 'robots' && <RobotsForm />}
        </div>
      </div>
    </div>
  );
}

function FaqForm() {
  const [items, setItems] = useState([
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, field: 'question' | 'answer', val: string) => {
    setItems(items.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));
  };

  const submit = async () => {
    const valid = items.filter((i) => i.question.trim() && i.answer.trim());
    if (valid.length === 0) {
      setError('Add at least one Q+A');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.generateFaqSchema(valid);
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
          <input
            type="text"
            value={it.question}
            onChange={(e) => update(i, 'question', e.target.value)}
            placeholder={`Question ${i + 1}`}
            className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={it.answer}
            onChange={(e) => update(i, 'answer', e.target.value)}
            placeholder="Answer (40-80 words ideal)"
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button
          onClick={() => setItems([...items, { question: '', answer: '' }])}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add Q+A
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        Generate JSON-LD
      </button>
      {result && <SchemaOutput result={result} />}
    </div>
  );
}

function OrgForm({ context }: { context?: { brandName?: string; domain?: string } }) {
  const [form, setForm] = useState({
    type: 'Organization',
    name: context?.brandName ?? '',
    url: context?.domain ? `https://${context.domain}` : '',
    description: '',
    telephone: '',
    email: '',
    streetAddress: '',
    addressLocality: '',
    addressCountry: '',
    linkedin: '',
    facebook: '',
    instagram: '',
  });
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.name || !form.url) {
      setError('Name + URL are required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.generateOrgSchema({
        type: form.type as 'Organization',
        name: form.name,
        url: form.url,
        description: form.description || undefined,
        telephone: form.telephone || undefined,
        email: form.email || undefined,
        address: form.streetAddress
          ? {
              streetAddress: form.streetAddress,
              addressLocality: form.addressLocality,
              addressCountry: form.addressCountry,
            }
          : undefined,
        social: {
          linkedin: form.linkedin || undefined,
          facebook: form.facebook || undefined,
          instagram: form.instagram || undefined,
        },
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Business type">
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option>Organization</option>
          <option>LocalBusiness</option>
          <option>RealEstateAgent</option>
          <option>Restaurant</option>
          <option>Store</option>
          <option>ProfessionalService</option>
        </select>
      </Field>
      <Field label="Business name *">
        <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      </Field>
      <Field label="Website URL *">
        <Input value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="https://yourbrand.com" />
      </Field>
      <Field label="Short description">
        <Input value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><Input value={form.telephone} onChange={(v) => setForm({ ...form, telephone: v })} /></Field>
        <Field label="Email"><Input value={form.email} onChange={(v) => setForm({ ...form, email: v })} /></Field>
      </div>
      <Field label="Street address"><Input value={form.streetAddress} onChange={(v) => setForm({ ...form, streetAddress: v })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><Input value={form.addressLocality} onChange={(v) => setForm({ ...form, addressLocality: v })} /></Field>
        <Field label="Country"><Input value={form.addressCountry} onChange={(v) => setForm({ ...form, addressCountry: v })} /></Field>
      </div>
      <Field label="LinkedIn URL"><Input value={form.linkedin} onChange={(v) => setForm({ ...form, linkedin: v })} /></Field>
      <Field label="Facebook URL"><Input value={form.facebook} onChange={(v) => setForm({ ...form, facebook: v })} /></Field>
      <Field label="Instagram URL"><Input value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} /></Field>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={submit} disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <Loader2 size={16} className="animate-spin" />}
        Generate JSON-LD
      </button>
      {result && <SchemaOutput result={result} />}
    </div>
  );
}

function ArticleForm({ context }: { context?: { domain?: string } }) {
  const [form, setForm] = useState({
    headline: '',
    url: context?.domain ? `https://${context.domain}/blog/` : '',
    authorName: '',
    publisherName: context?.domain ?? '',
    description: '',
    image: '',
  });
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.headline || !form.url || !form.authorName || !form.publisherName) {
      setError('Headline, URL, author, publisher all required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.generateArticleSchema({
        headline: form.headline,
        url: form.url,
        authorName: form.authorName,
        publisherName: form.publisherName,
        description: form.description || undefined,
        image: form.image || undefined,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Headline *"><Input value={form.headline} onChange={(v) => setForm({ ...form, headline: v })} /></Field>
      <Field label="Article URL *"><Input value={form.url} onChange={(v) => setForm({ ...form, url: v })} /></Field>
      <Field label="Image URL (1200×630)"><Input value={form.image} onChange={(v) => setForm({ ...form, image: v })} /></Field>
      <Field label="Description"><Input value={form.description} onChange={(v) => setForm({ ...form, description: v })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Author name *"><Input value={form.authorName} onChange={(v) => setForm({ ...form, authorName: v })} /></Field>
        <Field label="Publisher name *"><Input value={form.publisherName} onChange={(v) => setForm({ ...form, publisherName: v })} /></Field>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={submit} disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <Loader2 size={16} className="animate-spin" />}
        Generate JSON-LD
      </button>
      {result && <SchemaOutput result={result} />}
    </div>
  );
}

function ReviewForm({ context }: { context?: { brandName?: string } }) {
  const [form, setForm] = useState({
    itemName: context?.brandName ?? '',
    ratingValue: '4.8',
    reviewCount: '50',
  });
  const [reviews, setReviews] = useState([{ author: '', reviewBody: '', rating: '5' }]);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.itemName || !form.ratingValue || !form.reviewCount) {
      setError('Item name + rating + count required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const validReviews = reviews.filter((r) => r.author && r.reviewBody);
      const res = await api.generateReviewSchema({
        itemName: form.itemName,
        ratingValue: form.ratingValue,
        reviewCount: form.reviewCount,
        reviews: validReviews,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Item / business name *"><Input value={form.itemName} onChange={(v) => setForm({ ...form, itemName: v })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Avg rating (0-5) *"><Input value={form.ratingValue} onChange={(v) => setForm({ ...form, ratingValue: v })} /></Field>
        <Field label="Review count *"><Input value={form.reviewCount} onChange={(v) => setForm({ ...form, reviewCount: v })} /></Field>
      </div>
      <p className="text-xs text-slate-500">Add 1-3 individual reviews to enrich the schema (optional but recommended)</p>
      {reviews.map((r, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
          <input type="text" value={r.author} placeholder="Reviewer name" onChange={(e) => setReviews(reviews.map((x, idx) => idx === i ? { ...x, author: e.target.value } : x))} className="w-full border rounded px-3 py-2 text-sm outline-none" />
          <textarea value={r.reviewBody} placeholder="Review body" rows={2} onChange={(e) => setReviews(reviews.map((x, idx) => idx === i ? { ...x, reviewBody: e.target.value } : x))} className="w-full border rounded px-3 py-2 text-sm outline-none" />
          <input type="text" value={r.rating} placeholder="Rating 1-5" onChange={(e) => setReviews(reviews.map((x, idx) => idx === i ? { ...x, rating: e.target.value } : x))} className="w-20 border rounded px-3 py-2 text-sm outline-none" />
        </div>
      ))}
      <button onClick={() => setReviews([...reviews, { author: '', reviewBody: '', rating: '5' }])} className="text-sm text-blue-600 hover:underline">+ Add review</button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={submit} disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <Loader2 size={16} className="animate-spin" />}
        Generate JSON-LD
      </button>
      {result && <SchemaOutput result={result} />}
    </div>
  );
}

function LlmsTxtForm({ context }: { context?: { brandName?: string; domain?: string } }) {
  const [form, setForm] = useState({
    siteName: context?.brandName ?? '',
    siteUrl: context?.domain ? `https://${context.domain}` : '',
    summary: '',
    details: '',
    contactEmail: '',
  });
  const [links, setLinks] = useState([{ title: '', url: '', description: '' }]);
  const [result, setResult] = useState<LlmsTxtResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.siteName || !form.siteUrl || !form.summary) {
      setError('Name + URL + summary required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const validLinks = links.filter((l) => l.title && l.url);
      const res = await api.generateLlmsTxt({
        siteName: form.siteName,
        siteUrl: form.siteUrl,
        summary: form.summary,
        details: form.details || undefined,
        contactEmail: form.contactEmail || undefined,
        primaryLinks: validLinks,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Site name *"><Input value={form.siteName} onChange={(v) => setForm({ ...form, siteName: v })} /></Field>
      <Field label="Site URL *"><Input value={form.siteUrl} onChange={(v) => setForm({ ...form, siteUrl: v })} /></Field>
      <Field label="One-line summary *"><Input value={form.summary} onChange={(v) => setForm({ ...form, summary: v })} placeholder="What your site is about (max 800 chars)" /></Field>
      <Field label="Details (optional, 2-3 paragraphs)">
        <textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={4} className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      <Field label="Contact email"><Input value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} /></Field>
      <p className="text-sm font-medium text-slate-700">Key pages</p>
      {links.map((l, i) => (
        <div key={i} className="grid grid-cols-3 gap-2">
          <input type="text" value={l.title} placeholder="Title" onChange={(e) => setLinks(links.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} className="border rounded px-2 py-1.5 text-sm outline-none" />
          <input type="text" value={l.url} placeholder="URL" onChange={(e) => setLinks(links.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x))} className="border rounded px-2 py-1.5 text-sm outline-none" />
          <input type="text" value={l.description} placeholder="Description" onChange={(e) => setLinks(links.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} className="border rounded px-2 py-1.5 text-sm outline-none" />
        </div>
      ))}
      <button onClick={() => setLinks([...links, { title: '', url: '', description: '' }])} className="text-sm text-blue-600 hover:underline">+ Add page</button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={submit} disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <Loader2 size={16} className="animate-spin" />}
        Generate llms.txt
      </button>
      {result && <FileOutput filename={result.filename} content={result.content} instructions={result.installInstructions} />}
    </div>
  );
}

function RobotsForm() {
  const [existing, setExisting] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [result, setResult] = useState<RobotsPatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.generateRobotsPatch({
        existingRobotsTxt: existing || undefined,
        sitemapUrl: sitemapUrl || undefined,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Existing robots.txt (paste to merge, optional)">
        <textarea value={existing} onChange={(e) => setExisting(e.target.value)} rows={5} className="w-full border rounded px-3 py-2 text-sm outline-none font-mono" placeholder="User-agent: *&#10;Disallow: /admin/" />
      </Field>
      <Field label="Sitemap URL (optional)"><Input value={sitemapUrl} onChange={setSitemapUrl} placeholder="https://yourbrand.com/sitemap.xml" /></Field>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={submit} disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <Loader2 size={16} className="animate-spin" />}
        Generate Patch
      </button>
      {result && (
        <>
          <FileOutput filename="patch.txt" content={result.patch} instructions={['Append this to your existing robots.txt.', ...result.installInstructions]} />
          <details className="text-sm">
            <summary className="cursor-pointer text-blue-600">Show full file (if no existing robots.txt)</summary>
            <FileOutput filename={result.filename} content={result.fullFile} instructions={[]} />
          </details>
          <p className="text-xs text-slate-600">Allowed bots: {result.botsAdded.join(', ')}</p>
        </>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />;
}

function SchemaOutput({ result }: { result: GeneratorResult }) {
  return (
    <div className="space-y-3">
      <CopyBlock label="HTML snippet (paste in <head>)" content={result.htmlSnippet} />
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm space-y-1">
        <p className="font-semibold text-emerald-800 flex items-center gap-1.5">
          <Check size={14} /> Install instructions
        </p>
        <ol className="list-decimal pl-5 text-emerald-700">
          {result.installInstructions.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>
    </div>
  );
}

function FileOutput({ filename, content, instructions }: { filename: string; content: string; instructions: string[] }) {
  const download = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <CopyBlock label={filename} content={content} />
      <button onClick={download} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
        <Download size={14} /> Download {filename}
      </button>
      {instructions.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
          <p className="font-semibold text-emerald-800 flex items-center gap-1.5 mb-1">
            <FileText size={14} /> Install
          </p>
          <ol className="list-decimal pl-5 text-emerald-700">
            {instructions.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

function CopyBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <button onClick={copy} className="flex items-center gap-1 text-blue-600 hover:underline">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-xs bg-slate-900 text-slate-100 overflow-x-auto max-h-80">{content}</pre>
    </div>
  );
}
