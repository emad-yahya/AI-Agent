import { useEffect, useRef, useState } from "react";
import { api, BASE_URL, type ScanProgressEvent } from "../api/client";
import { Globe, Loader2, MapPin, Radar, Rocket, Sparkles, Wand2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    onScanComplete: (
        brandId: string,
        scanId: string,
        brand: string,
        category: string,
        opts: { mode: Mode; domain: string; country: string },
    ) => void;
}

type Phase = 'idle' | 'creating' | 'scanning' | 'loading';
type Mode = 'quick' | 'master';

const MODE_META: Record<Mode, { calls: number; eta: string; label: string; tagline: string }> = {
    quick: { calls: 15, eta: '~1 min', label: 'Quick scan', tagline: 'AI only · 5 prompts × 3 engines' },
    master: { calls: 90, eta: '~8 min', label: 'Master scan', tagline: 'AI + Google · 30 prompts + full diagnostics + rank tracker' },
};

const COUNTRIES: Array<{ code: string; label: string }> = [
    { code: 'us', label: '🇺🇸 United States' },
    { code: 'gb', label: '🇬🇧 United Kingdom' },
    { code: 'ae', label: '🇦🇪 UAE' },
    { code: 'sa', label: '🇸🇦 Saudi Arabia' },
    { code: 'eg', label: '🇪🇬 Egypt' },
    { code: 'in', label: '🇮🇳 India' },
    { code: 'de', label: '🇩🇪 Germany' },
    { code: 'fr', label: '🇫🇷 France' },
    { code: 'ca', label: '🇨🇦 Canada' },
    { code: 'au', label: '🇦🇺 Australia' },
];

export function ScanForm({ onScanComplete }: Props) {
    const [brand, setBrand] = useState('');
    const [category, setCategory] = useState('');
    const [domain, setDomain] = useState('');
    const [country, setCountry] = useState('us');
    const [mode, setMode] = useState<Mode>('master');
    const [phase, setPhase] = useState<Phase>('idle');
    const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const lastSuggestedBrand = useRef<string>('');

    const isLoading = phase !== 'idle';
    const needsDomain = mode === 'master';
    const cleanDomain = stripDomainScheme(domain);

    useEffect(() => {
        const trimmed = brand.trim();
        if (trimmed.length < 2 || trimmed.toLowerCase() === lastSuggestedBrand.current) return;
        const handle = setTimeout(async () => {
            lastSuggestedBrand.current = trimmed.toLowerCase();
            setSuggestLoading(true);
            try {
                const cats = await api.suggestCategories(trimmed);
                setSuggestions(cats);
            } catch {
                setSuggestions([]);
            } finally {
                setSuggestLoading(false);
            }
        }, 800);
        return () => clearTimeout(handle);
    }, [brand]);

    const handleSubmit = async () => {
        if (!brand.trim() || !category.trim()) return;
        if (needsDomain && !cleanDomain) {
            setError('Domain is required for Master scan (e.g. yoursite.com)');
            return;
        }

        setPhase('creating');
        setError(null);
        setProgress(null);

        try {
            // Master mode = run full AI breadth (90 calls). Quick = 15 calls.
            const aiMode = mode === 'master' ? 'full' : 'quick';
            const { scanId, brandId } = await api.createScan(brand.trim(), category.trim(), aiMode);
            setPhase('scanning');

            await new Promise<void>((resolve, reject) => {
                const es = new EventSource(`${BASE_URL}/scans/stream/${scanId}`);

                es.onmessage = (e: MessageEvent<string>) => {
                    const event = JSON.parse(e.data) as ScanProgressEvent;
                    if (event.type === 'progress') {
                        setProgress({ completed: event.completed!, total: event.total! });
                    } else if (event.type === 'done') {
                        es.close();
                        resolve();
                    } else if (event.type === 'error') {
                        es.close();
                        reject(new Error(event.message ?? 'Scan failed'));
                    }
                };

                es.onerror = () => {
                    es.close();
                    reject(new Error('Connection error — check if backend is running'));
                };
            });

            onScanComplete(brandId, scanId, brand.trim(), category.trim(), {
                mode,
                domain: cleanDomain,
                country,
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setPhase('idle');
            setProgress(null);
        }
    };

    const buttonLabel = () => {
        switch (phase) {
            case 'creating': return 'Starting scan...';
            case 'scanning': return progress
                ? `Scanning ${progress.completed}/${progress.total} calls...`
                : 'Scanning...';
            case 'loading': return 'Loading results...';
            default: return mode === 'master' ? 'Run Master scan' : 'Run Quick scan';
        }
    };

    const pct = progress ? (progress.completed / progress.total) * 100 : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[var(--radius-card)] gradient-border bg-white shadow-[var(--shadow-card)]"
        >
            {/* Decorative gradient mesh */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 opacity-[0.10] blur-3xl" />
                <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 opacity-[0.10] blur-3xl" />
            </div>

            <div className="relative p-6 md:p-8">
                <div className="flex items-center gap-2 mb-2">
                    <motion.span
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                                   bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-[0_4px_12px_-2px_rgba(99,102,241,0.5)]"
                    >
                        <Sparkles className="w-3 h-3" /> Live scan
                    </motion.span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> {MODE_META[mode].eta} · {MODE_META[mode].calls} AI calls
                    </span>
                </div>

                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Run a <span className="text-gradient">new scan</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Master scan = <b className="text-emerald-600">AI</b> (ChatGPT/Gemini/Perplexity) <span className="text-slate-400">+</span> <b className="text-blue-600">Google</b> (Knowledge Panel, SERP, PAA, Core Web Vitals, rank tracker). One click, full coverage.
                </p>

                <div className="mt-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Scan depth</span>
                        <div className="grid grid-cols-2 gap-2">
                            {(['quick', 'master'] as Mode[]).map((m) => {
                                const meta = MODE_META[m];
                                const active = mode === m;
                                const Icon = m === 'quick' ? Zap : Rocket;
                                return (
                                    <motion.button
                                        key={m}
                                        type="button"
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setMode(m)}
                                        disabled={isLoading}
                                        className={`relative text-left rounded-[var(--radius-control)] border px-3.5 py-3 transition-all ${active
                                            ? 'border-transparent bg-gradient-to-br from-indigo-500/10 via-fuchsia-500/10 to-pink-500/10 shadow-[0_4px_16px_-6px_rgba(99,102,241,0.35)] ring-2 ring-fuchsia-400/40'
                                            : 'border-slate-200 bg-white hover:border-fuchsia-300 hover:shadow-sm'
                                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon className={`w-4 h-4 ${active ? 'text-fuchsia-600' : 'text-slate-500'}`} />
                                            <span className={`text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-700'}`}>{meta.label}</span>
                                            <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${active ? 'bg-fuchsia-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                {meta.eta}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-snug">{meta.tagline}</p>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field
                            label="Brand name"
                            value={brand}
                            onChange={setBrand}
                            placeholder="e.g. Platinum Square"
                            disabled={isLoading}
                            accent="from-indigo-500 to-fuchsia-500"
                        />
                        <Field
                            label="Category"
                            value={category}
                            onChange={setCategory}
                            placeholder="e.g. Dubai real estate broker"
                            disabled={isLoading}
                            accent="from-cyan-500 to-blue-600"
                        />
                    </div>

                    <AnimatePresence>
                        {mode === 'master' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden"
                            >
                                <Field
                                    label="Website domain"
                                    value={domain}
                                    onChange={setDomain}
                                    placeholder="yoursite.com"
                                    disabled={isLoading}
                                    accent="from-emerald-500 to-teal-500"
                                    Icon={Globe}
                                />
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-[0.14em]">Target country</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                        <select
                                            value={country}
                                            onChange={(e) => setCountry(e.target.value)}
                                            disabled={isLoading}
                                            className="w-full border border-slate-200 rounded-[var(--radius-control)] pl-9 pr-3 py-3 text-sm bg-white text-slate-900 focus:outline-none focus:border-slate-300 disabled:bg-slate-50"
                                        >
                                            {COUNTRIES.map((c) => (
                                                <option key={c.code} value={c.code}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {(suggestLoading || suggestions.length > 0) && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex flex-col gap-2"
                            >
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                                    <Wand2 className="w-3 h-3 text-fuchsia-500" />
                                    {suggestLoading ? 'AI is suggesting categories...' : 'Suggested categories for your brand'}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {suggestLoading ? (
                                        <>
                                            <span className="skeleton rounded-full h-7 w-32" />
                                            <span className="skeleton rounded-full h-7 w-40" />
                                            <span className="skeleton rounded-full h-7 w-36" />
                                        </>
                                    ) : (
                                        suggestions.map((s) => {
                                            const active = category.trim().toLowerCase() === s.toLowerCase();
                                            return (
                                                <motion.button
                                                    key={s}
                                                    type="button"
                                                    whileTap={{ scale: 0.96 }}
                                                    onClick={() => setCategory(s)}
                                                    disabled={isLoading}
                                                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${active
                                                        ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white border-transparent shadow-[0_4px_12px_-2px_rgba(99,102,241,0.45)]'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-fuchsia-300 hover:text-fuchsia-700 hover:shadow-sm'
                                                        }`}
                                                >
                                                    {s}
                                                </motion.button>
                                            );
                                        })
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {phase === 'scanning' && progress && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex flex-col gap-2"
                            >
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden relative">
                                    <motion.div
                                        className="bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500 h-full rounded-full relative"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        <span className="absolute inset-0 bg-white/30 animate-pulse rounded-full" />
                                    </motion.div>
                                </div>
                                <p className="text-xs text-slate-500 text-right flex items-center justify-end gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 glow-dot" />
                                    {progress.completed}/{progress.total} AI calls complete
                                    {mode === 'master' && ' — Google diagnostics start after AI'}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        disabled={isLoading || !brand.trim() || !category.trim() || (needsDomain && !cleanDomain)}
                        className="relative w-full overflow-hidden rounded-xl py-3.5 font-semibold text-white text-sm
                                   bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-600
                                   disabled:from-slate-300 disabled:via-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed
                                   shadow-[0_8px_24px_-6px_rgba(99,102,241,0.55)]
                                   hover:shadow-[0_12px_32px_-6px_rgba(236,72,153,0.6)]
                                   transition-shadow group"
                    >
                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        <span className="relative flex items-center justify-center gap-2">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                            {buttonLabel()}
                        </span>
                    </motion.button>

                    <AnimatePresence>
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 flex items-center gap-2"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                {error}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}

function stripDomainScheme(raw: string): string {
    return raw.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '').trim();
}

function Field({
    label, value, onChange, placeholder, disabled, accent, Icon,
}: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder: string; disabled: boolean; accent: string;
    Icon?: typeof Globe;
}) {
    const [focused, setFocused] = useState(false);
    return (
        <div className="relative">
            <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-[0.14em]">{label}</label>
            <div className="relative">
                {focused && (
                    <motion.div
                        layoutId={`field-glow-${label}`}
                        className={`absolute -inset-0.5 rounded-[14px] bg-gradient-to-r ${accent} opacity-50 blur-md pointer-events-none`}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    />
                )}
                {Icon && (
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 z-10 pointer-events-none" />
                )}
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`relative w-full border border-slate-200 rounded-[var(--radius-control)] ${Icon ? 'pl-9' : 'pl-3.5'} pr-3.5 py-3 text-sm
                               bg-white placeholder:text-slate-400 text-slate-900
                               focus:outline-none focus:border-slate-300
                               disabled:bg-slate-50 disabled:text-slate-400 transition-all`}
                />
            </div>
        </div>
    );
}
