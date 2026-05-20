// frontend/src/App.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanForm } from './components/ScanForm';
import { ResultTable } from './components/ResultsTable';
import { Dashboard } from './pages/Dashboard';
import { CompareForm } from './components/CompareForm';
import { ComparisonTable } from './components/ComparisonTable';
import { ExportButtons } from './components/ExportButtons';
import { SeoSiteHistory } from './components/SeoSiteHistory';
import { SeoSiteResults } from './components/SeoSiteResults';
import { SeoTrendChart } from './components/SeoTrendChart';
import { TopicsPanel } from './components/TopicsPanel';
import { CitationsPanel } from './components/CitationsPanel';
import { ListicleGapPanel } from './components/ListicleGapPanel';
import { CompetitorAuditPanel } from './components/CompetitorAuditPanel';
import { BrandPresencePanel } from './components/BrandPresencePanel';
import { GeoActionsPanel } from './components/GeoActionsPanel';
import { ProgressPanel } from './components/ProgressPanel';
import { BenchmarkPanel } from './components/BenchmarkPanel';
import { OnPageSeoPanel } from './components/OnPageSeoPanel';
import { ContentGapPanel } from './components/ContentGapPanel';
import { OnboardingWizard } from './components/OnboardingWizard';
import { GeneratorModal, type GeneratorKind } from './components/GeneratorModal';
import { CompetitorTrendChart } from './components/CompetitorTrend';
import { AlertSettings } from './components/AlertSettings';
import { SovChart } from './components/SovChart';
import { MasterScanProgress } from './components/MasterScanProgress';
import { api, type ScanResponse, type BrandComparisonResult } from './api/client';
import { useAsync } from './hooks/useAsync';
import {
    runMasterScan,
    INITIAL_STATE,
    type MasterOrchestrationState,
} from './lib/masterOrchestrator';
import {
    Eye, ScanSearch, LayoutDashboard, GitCompareArrows, Loader2,
    Sparkles, Code, FileText, Bot, Rocket, Settings, Globe2,
} from 'lucide-react';
import { SystemHealthPanel } from './components/SystemHealthPanel';

type Tab = 'scan' | 'dashboard' | 'compare' | 'settings';

const TABS: ReadonlyArray<{ key: Tab; label: string; Icon: typeof ScanSearch; gradient: string }> = [
    { key: 'scan', label: 'New scan', Icon: ScanSearch, gradient: 'from-indigo-500 to-fuchsia-500' },
    { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, gradient: 'from-cyan-500 to-blue-600' },
    { key: 'compare', label: 'Compare', Icon: GitCompareArrows, gradient: 'from-violet-500 to-pink-500' },
    { key: 'settings', label: 'Settings', Icon: Settings, gradient: 'from-slate-500 to-slate-700' },
];

type ScanMeta = {
    brand: string;
    category: string;
    domain: string;
    country: string;
    mode: 'quick' | 'master';
};

export default function App() {
    const [tab, setTab] = useState<Tab>('scan');
    const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
    const [scanMeta, setScanMeta] = useState<ScanMeta | null>(null);
    const [compareResult, setCompareResult] = useState<BrandComparisonResult[] | null>(null);
    const [lastScanBrandId, setLastScanBrandId] = useState<string | null>(null);
    const [onboardingOpen, setOnboardingOpen] = useState(false);
    const [generatorOpen, setGeneratorOpen] = useState<GeneratorKind | null>(null);
    const [scanSubTab, setScanSubTab] = useState<ScanSubTab>('actions');
    const [orchestration, setOrchestration] = useState<MasterOrchestrationState>(INITIAL_STATE);
    const { loading, run } = useAsync<ScanResponse>();

    const handleScanComplete = async (
        brandId: string,
        scanId: string,
        brand: string,
        category: string,
        opts: { mode: 'quick' | 'master'; domain: string; country: string },
    ) => {
        setScanMeta({ brand, category, domain: opts.domain, country: opts.country, mode: opts.mode });
        setLastScanBrandId(brandId);
        setOrchestration(INITIAL_STATE);
        setScanSubTab('actions');
        const result = await run(api.getScan(brandId, scanId));
        if (result) {
            setScanResult(result);
            if (opts.mode === 'master') {
                void runMasterScan({
                    brand,
                    category,
                    domain: opts.domain,
                    country: opts.country,
                    results: result.results,
                    onUpdate: setOrchestration,
                });
            }
        }
    };

    const activeTab = TABS.find(t => t.key === tab)!;

    return (
        <div className="min-h-screen relative">
            <div className="app-mesh-bg" />
            <div className="app-grain" />

            {/* Header */}
            <header className="sticky top-0 z-40 glass-strong border-b border-white/40">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-3 min-w-0">
                        <motion.div
                            initial={{ rotate: -180, scale: 0 }}
                            animate={{ rotate: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                            className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-[var(--shadow-glow-brand)]"
                        >
                            <Eye className="w-5 h-5 text-white drop-shadow" />
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white glow-dot" />
                        </motion.div>
                        <div className="min-w-0">
                            <h1 className="text-[15px] font-bold text-slate-900 tracking-tight">
                                AI Visibility <span className="text-gradient">Tracker</span>
                            </h1>
                            <p className="text-[11px] text-slate-500 -mt-0.5 truncate flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-fuchsia-500" />
                                Track how AI engines describe your brand
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setOnboardingOpen(true)}
                        className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold shadow-sm hover:opacity-90"
                    >
                        <Rocket className="w-3.5 h-3.5" />
                        Quick Start
                    </button>

                    {/* Segmented tabs */}
                    <nav className="flex gap-1 bg-white/60 rounded-2xl p-1.5 ring-1 ring-slate-200/60 shadow-[var(--shadow-soft)]">
                        {TABS.map(({ key, label, Icon, gradient }) => {
                            const active = tab === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setTab(key)}
                                    className="relative px-3.5 py-1.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5
                                               text-slate-600 hover:text-slate-900 transition-colors"
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="tab-pill"
                                            className={`absolute inset-0 bg-gradient-to-r ${gradient} rounded-xl shadow-[0_6px_16px_-4px_rgba(99,102,241,0.5)]`}
                                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                        />
                                    )}
                                    <Icon className={`w-3.5 h-3.5 relative z-10 ${active ? 'text-white' : ''}`} />
                                    <span className={`relative z-10 ${active ? 'text-white' : ''}`}>{label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </header>

            {/* Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
                {/* Hero strip for active tab */}
                <motion.div
                    key={`hero-${tab}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-7 flex items-center gap-4"
                >
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${activeTab.gradient} flex items-center justify-center shadow-[var(--shadow-glow-brand)]`}>
                        <activeTab.Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{tabTitle(tab)}</h2>
                        <p className="text-sm text-slate-500 mt-0.5">{tabSubtitle(tab)}</p>
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={tab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                        className="flex flex-col gap-6"
                    >
                        {tab === 'scan' && (
                            <>
                                <ScanForm onScanComplete={handleScanComplete} />

                                {loading && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-10">
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                        Fetching results...
                                    </div>
                                )}

                                {scanResult && !loading && scanMeta && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                        className="flex flex-col gap-6"
                                    >
                                        <BrandHeaderStrip
                                            scanMeta={scanMeta}
                                            scanResult={scanResult}
                                        />

                                        {scanMeta.mode === 'master' && (
                                            <MasterScanProgress state={orchestration} />
                                        )}

                                        <ScanSubTabs current={scanSubTab} onChange={setScanSubTab} />

                                        {scanSubTab === 'actions' && (
                                            <>
                                                <ActionPlanHero
                                                    stats={scanResult.stats}
                                                />
                                                <GeoActionsPanel brand={scanMeta.brand} />
                                                <ProgressPanel brand={scanMeta.brand} />
                                                <BenchmarkPanel brand={scanMeta.brand} />
                                                <GeneratorToolbar onOpen={(k) => setGeneratorOpen(k)} brand={scanMeta.brand} />
                                            </>
                                        )}

                                        {scanSubTab === 'ai' && (
                                            <>
                                                <ResultTable results={scanResult.results} stats={scanResult.stats} />
                                                <TopicsPanel results={scanResult.results} />
                                                <CitationsPanel results={scanResult.results} brand={scanMeta.brand} />
                                            </>
                                        )}

                                        {scanSubTab === 'google' && (
                                            <>
                                                <BrandPresencePanel
                                                    brand={scanMeta.brand}
                                                    results={scanResult.results}
                                                />
                                                <OnPageSeoPanel brand={scanMeta.brand} domain={scanMeta.domain} />
                                                <ContentGapPanel brand={scanMeta.brand} domain={scanMeta.domain} results={scanResult.results} />
                                                <CompetitorAuditPanel
                                                    brand={scanMeta.brand}
                                                    results={scanResult.results}
                                                />
                                                <ListicleGapPanel
                                                    brand={scanMeta.brand}
                                                    category={scanMeta.category}
                                                    results={scanResult.results}
                                                />
                                                {orchestration.seoSiteId && scanMeta.domain && (
                                                    <SeoSiteSection
                                                        siteId={orchestration.seoSiteId}
                                                        brand={scanMeta.brand}
                                                        domain={scanMeta.domain}
                                                    />
                                                )}
                                                {lastScanBrandId && (
                                                    <AlertSettings brandId={lastScanBrandId} brandName={scanMeta.brand} />
                                                )}
                                            </>
                                        )}
                                    </motion.div>
                                )}
                                {scanResult && !loading && scanMeta && (
                                    <ExportButtons
                                        brand={scanMeta.brand}
                                        category={scanMeta.category}
                                        results={scanResult.results}
                                        stats={scanResult.stats}
                                        recommendations={scanResult.recommendations}
                                    />
                                )}
                            </>
                        )}

                        {tab === 'dashboard' && <Dashboard />}

                        {tab === 'compare' && (
                            <>
                                <CompareForm onResult={(r) => { setCompareResult(r); }} />
                                {compareResult && (
                                    <>
                                        <ComparisonTable results={compareResult} />
                                        <SovChart results={compareResult} />
                                    </>
                                )}
                                <CompetitorTrendChart />
                            </>
                        )}

                        {tab === 'settings' && <SystemHealthPanel />}
                    </motion.div>
                </AnimatePresence>

                <OnboardingWizard
                    open={onboardingOpen}
                    onClose={() => setOnboardingOpen(false)}
                    onComplete={(brand) => {
                        setScanMeta({ brand, category: '', domain: '', country: 'us', mode: 'quick' });
                        setTab('dashboard');
                    }}
                />
                {generatorOpen && (
                    <GeneratorModal
                        open={!!generatorOpen}
                        kind={generatorOpen}
                        onClose={() => setGeneratorOpen(null)}
                        context={{ brandName: scanMeta?.brand }}
                    />
                )}

                {/* Footer */}
                <footer className="mt-20 pt-6 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 glow-dot" />
                        All systems operational
                    </span>
                    <span>AI Visibility Tracker · v2</span>
                </footer>
            </main>
        </div>
    );
}

function tabTitle(t: Tab) {
    switch (t) {
        case 'scan': return 'New scan';
        case 'dashboard': return 'Dashboard';
        case 'compare': return 'Compare brands';
        case 'settings': return 'Settings & integrations';
    }
}
function tabSubtitle(t: Tab) {
    switch (t) {
        case 'scan': return 'Master scan: AI engines + Google in one run.';
        case 'dashboard': return 'Your brand history, trends, and scheduled scans.';
        case 'compare': return 'Pit 2–4 brands head-to-head with Share of Voice.';
        case 'settings': return 'Verify external API keys, view system health.';
    }
}

void React;

type ScanSubTab = 'actions' | 'ai' | 'google';

const SCAN_SUBTABS: Array<{ key: ScanSubTab; label: string; Icon: typeof ScanSearch; hint: string }> = [
    { key: 'actions', label: '🚀 Action Plan', Icon: Rocket, hint: 'How to reach #1 — playbooks + completion tracking' },
    { key: 'ai', label: '🤖 AI Visibility', Icon: Bot, hint: 'ChatGPT / Gemini / Perplexity results, topics, citations' },
    { key: 'google', label: '🔍 Google Visibility', Icon: Globe2, hint: 'Knowledge Panel, SERP, Core Web Vitals, rank tracker' },
];

function ScanSubTabs({
    current,
    onChange,
}: {
    current: ScanSubTab;
    onChange: (t: ScanSubTab) => void;
}) {
    return (
        <div className="flex gap-1 bg-white/70 backdrop-blur rounded-xl p-1.5 ring-1 ring-slate-200/60 shadow-[var(--shadow-soft)] overflow-x-auto">
            {SCAN_SUBTABS.map(({ key, label, hint }) => {
                const active = current === key;
                return (
                    <button
                        key={key}
                        onClick={() => onChange(key)}
                        title={hint}
                        className={`relative px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors flex-1 justify-center ${active
                            ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-[0_4px_12px_-2px_rgba(99,102,241,0.45)]'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

function BrandHeaderStrip({
    scanMeta,
    scanResult,
}: {
    scanMeta: ScanMeta;
    scanResult: ScanResponse;
}) {
    return (
        <div className="flex items-center justify-between flex-wrap gap-3 glass rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 glow-dot" />
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{scanMeta.brand}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-sm text-slate-500">{scanMeta.category}</span>
                    </div>
                    {scanMeta.domain && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{scanMeta.domain}</span>
                            <span>·</span>
                            <span className="uppercase">{scanMeta.country}</span>
                            <span>·</span>
                            <span className="uppercase font-semibold text-fuchsia-600">{scanMeta.mode}</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-4">
                <KpiPill label="Real visibility" value={`${scanResult.stats.realMentionRate ?? 0}%`} good={(scanResult.stats.realMentionRate ?? 0) >= 30} />
                <KpiPill label="Echo rate" value={`${scanResult.stats.echoMentionRate ?? 0}%`} good={(scanResult.stats.echoMentionRate ?? 0) >= 50} />
                <KpiPill label="Avg score" value={`${scanResult.stats.avgScore}`} good={scanResult.stats.avgScore >= 60} />
            </div>
        </div>
    );
}

function KpiPill({ label, value, good }: { label: string; value: string; good: boolean }) {
    return (
        <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{label}</div>
            <div className={`text-sm font-bold ${good ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</div>
        </div>
    );
}

function ActionPlanHero({ stats }: { stats: ScanResponse['stats'] }) {
    const realPct = stats.realMentionRate ?? 0;
    const echoPct = stats.echoMentionRate ?? 0;
    const realTotal = stats.realTotal ?? 0;
    const realMentioned = stats.realMentioned ?? 0;
    const status =
        realPct === 0
            ? { tone: 'critical', headline: "You're invisible in unbiased AI search", color: 'from-rose-500 to-red-600', emoji: '🚨' }
            : realPct < 30
                ? { tone: 'low', headline: 'AI rarely mentions you without brand cues', color: 'from-amber-500 to-orange-600', emoji: '⚠️' }
                : realPct < 60
                    ? { tone: 'mid', headline: 'You appear sometimes — there is room to climb', color: 'from-indigo-500 to-sky-600', emoji: '📈' }
                    : { tone: 'good', headline: 'Strong AI presence — defend the top', color: 'from-emerald-500 to-teal-600', emoji: '🏆' };

    return (
        <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${status.color} text-white p-6 shadow-[var(--shadow-card)]`}
        >
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
            <div className="relative flex items-start gap-4">
                <div className="text-4xl">{status.emoji}</div>
                <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-[0.16em] font-bold opacity-80 mb-1">How to reach #1</div>
                    <h3 className="text-xl font-bold leading-tight">{status.headline}</h3>
                    <p className="text-sm opacity-90 mt-2 max-w-2xl">
                        Real visibility = <b>{realPct}%</b> ({realMentioned}/{realTotal}).
                        Echo (brand-cued) = <b>{echoPct}%</b>.
                        The action plan below ranks fixes by impact — start with critical items.
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

function SeoSiteSection({ siteId, brand, domain }: { siteId: string; brand: string; domain: string }) {
    const [activeScanId, setActiveScanId] = useState<string | null>(null);
    return (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <Globe2 className="text-emerald-600" size={18} />
                <h3 className="font-bold text-slate-900">Google rank tracker</h3>
                <span className="text-xs text-slate-400">— {domain}</span>
            </div>
            <SeoTrendChart siteId={siteId} refreshKey={0} />
            <div className="mt-4">
                <SeoSiteHistory
                    siteId={siteId}
                    refreshKey={0}
                    activeScanId={activeScanId}
                    onSelectScan={(id) => setActiveScanId(id)}
                />
            </div>
            {activeScanId && (
                <div className="mt-4">
                    <SeoSiteResults
                        siteId={siteId}
                        scanId={activeScanId}
                        brand={brand}
                        domain={domain}
                    />
                </div>
            )}
        </section>
    );
}

function GeneratorToolbar({
    onOpen,
}: {
    onOpen: (k: GeneratorKind) => void;
    brand: string;
}) {
    const items: Array<{ k: GeneratorKind; label: string; Icon: typeof Code; color: string }> = [
        { k: 'organization', label: 'Org / LocalBusiness Schema', Icon: Code, color: 'from-blue-500 to-cyan-500' },
        { k: 'faq', label: 'FAQ Schema', Icon: Code, color: 'from-violet-500 to-fuchsia-500' },
        { k: 'article', label: 'Article Schema', Icon: Code, color: 'from-pink-500 to-rose-500' },
        { k: 'review', label: 'Review Schema', Icon: Code, color: 'from-amber-500 to-orange-500' },
        { k: 'llmstxt', label: 'llms.txt', Icon: FileText, color: 'from-emerald-500 to-teal-500' },
        { k: 'robots', label: 'robots.txt AI patch', Icon: Bot, color: 'from-slate-600 to-slate-800' },
    ];
    return (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-1">
                <Sparkles className="text-violet-600" size={18} />
                <h3 className="font-bold text-slate-900">One-click Fix Generators</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">
                Ready-to-paste code blocks referenced by playbooks above.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {items.map(({ k, label, Icon, color }) => (
                    <button
                        key={k}
                        onClick={() => onOpen(k)}
                        className={`flex items-center gap-2 rounded-lg p-3 text-white text-sm font-semibold bg-gradient-to-br ${color} hover:opacity-90 shadow-sm`}
                    >
                        <Icon size={16} />
                        <span className="truncate">{label}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
