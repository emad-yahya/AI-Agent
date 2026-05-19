// frontend/src/App.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanForm } from './components/ScanForm';
import { ResultTable } from './components/ResultsTable';
import { Dashboard } from './pages/Dashboard';
import { CompareForm } from './components/CompareForm';
import { ComparisonTable } from './components/ComparisonTable';
import { RecommendationsPanel } from './components/RecommendationsPanel';
import { ExportButtons } from './components/ExportButtons';
import { SeoSiteForm } from './components/SeoSiteForm';
import { SeoSiteDashboard } from './components/SeoSiteDashboard';
import { SeoSiteHistory } from './components/SeoSiteHistory';
import { SeoSiteResults } from './components/SeoSiteResults';
import { SeoTrendChart } from './components/SeoTrendChart';
import { SeoCompareView } from './components/SeoCompareView';
import { TopicsPanel } from './components/TopicsPanel';
import { CitationsPanel } from './components/CitationsPanel';
import { ListicleGapPanel } from './components/ListicleGapPanel';
import { CompetitorAuditPanel } from './components/CompetitorAuditPanel';
import { BrandPresencePanel } from './components/BrandPresencePanel';
import { GeoActionsPanel } from './components/GeoActionsPanel';
import { OnPageSeoPanel } from './components/OnPageSeoPanel';
import { ContentGapPanel } from './components/ContentGapPanel';
import { OnboardingWizard } from './components/OnboardingWizard';
import { GeneratorModal, type GeneratorKind } from './components/GeneratorModal';
import { CompetitorTrendChart } from './components/CompetitorTrend';
import { AlertSettings } from './components/AlertSettings';
import { SovChart } from './components/SovChart';
import { PromptCoverageMap } from './components/PromptCoverageMap';
import { ActionPlan } from './components/ActionPlan';
import { ImpactPredictor } from './components/ImpactPredictor';
import { ContentGenerator } from './components/ContentGenerator';
import { CompetitorPlaybook } from './components/CompetitorPlaybook';
import { SectionIntro } from './components/Hint';
import { api, type ScanResponse, type BrandComparisonResult } from './api/client';
import { useAsync } from './hooks/useAsync';
import { Eye, ScanSearch, LayoutDashboard, GitCompareArrows, Globe, Loader2, Sparkles, GitCompare, Code, FileText, Bot, Rocket } from 'lucide-react';

type Tab = 'scan' | 'dashboard' | 'compare' | 'seo';

const TABS: ReadonlyArray<{ key: Tab; label: string; Icon: typeof ScanSearch; gradient: string }> = [
  { key: 'scan',      label: 'New scan',  Icon: ScanSearch,      gradient: 'from-indigo-500 to-fuchsia-500' },
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, gradient: 'from-cyan-500 to-blue-600' },
  { key: 'compare',   label: 'Compare',   Icon: GitCompareArrows, gradient: 'from-violet-500 to-pink-500' },
  { key: 'seo',       label: 'SEO',       Icon: Globe,           gradient: 'from-emerald-500 to-teal-500' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('scan');
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [scanMeta, setScanMeta] = useState<{ brand: string; category: string } | null>(null);
  const [compareResult, setCompareResult] = useState<BrandComparisonResult[] | null>(null);
  const [seoSiteRefresh, setSeoSiteRefresh] = useState(0);
  const [activeSeoSite, setActiveSeoSite] = useState<{ siteId: string; brand: string; domain: string } | null>(null);
  const [activeSeoScan, setActiveSeoScan] = useState<string | null>(null);
  const [seoCompareOpen, setSeoCompareOpen] = useState(false);
  const [lastScanBrandId, setLastScanBrandId] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState<GeneratorKind | null>(null);
  const [geoActionsCount, setGeoActionsCount] = useState<number | null>(null);
  const { loading, run } = useAsync<ScanResponse>();

  const handleScanComplete = async (brandId: string, scanId: string, brand: string, category: string) => {
    setScanMeta({ brand, category });
    setLastScanBrandId(brandId);
    const result = await run(api.getScan(brandId, scanId));
    if (result) setScanResult(result);
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
                <SectionIntro>
                  <b>How it works:</b> Type your brand + category. We send 5 real questions to <b>ChatGPT, Gemini & Perplexity</b> (15 calls total) and analyze if they mention you. You'll get a full report: stats, recommendations, competitor playbook, and a 30-day action plan.
                </SectionIntro>
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
                    <div className="flex items-center justify-between flex-wrap gap-3 glass rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 glow-dot" />
                        <span className="text-sm font-semibold text-slate-800">{scanMeta.brand}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-sm text-slate-500">{scanMeta.category}</span>
                      </div>
                      <ExportButtons
                        brand={scanMeta.brand}
                        category={scanMeta.category}
                        results={scanResult.results}
                        stats={scanResult.stats}
                        recommendations={scanResult.recommendations}
                      />
                    </div>
                    <ResultTable results={scanResult.results} stats={scanResult.stats} />
                    <TopicsPanel results={scanResult.results} />
                    <CitationsPanel results={scanResult.results} brand={scanMeta.brand} />
                    <ListicleGapPanel
                      brand={scanMeta.brand}
                      category={scanMeta.category}
                      results={scanResult.results}
                    />
                    <CompetitorAuditPanel
                      brand={scanMeta.brand}
                      results={scanResult.results}
                    />
                    <BrandPresencePanel
                      brand={scanMeta.brand}
                      results={scanResult.results}
                    />
                    <GeoActionsPanel
                      brand={scanMeta.brand}
                      onActionsLoaded={(c) => setGeoActionsCount(c)}
                    />
                    <OnPageSeoPanel brand={scanMeta.brand} />
                    <ContentGapPanel brand={scanMeta.brand} results={scanResult.results} />
                    <GeneratorToolbar onOpen={(k) => setGeneratorOpen(k)} brand={scanMeta.brand} />
                    <PromptCoverageMap brand={scanMeta.brand} />
                    {/* GeoActionsPanel covers data-driven recommendations. Only show the
                        generic LLM recs panel when GeoActions has nothing to surface. */}
                    {(geoActionsCount === null || geoActionsCount === 0) && (
                      <RecommendationsPanel recommendations={scanResult.recommendations} />
                    )}
                    <ImpactPredictor results={scanResult.results} stats={scanResult.stats} brand={scanMeta.brand} />
                    <CompetitorPlaybook playbook={scanResult.competitorPlaybook} brand={scanMeta.brand} />
                    <ActionPlan recommendations={scanResult.recommendations} brand={scanMeta.brand} />
                    <ContentGenerator
                      brand={scanMeta.brand}
                      category={scanMeta.category}
                      mentionRate={scanResult.stats.mentionRate}
                      avgScore={scanResult.stats.avgScore}
                    />
                    {lastScanBrandId && (
                      <AlertSettings brandId={lastScanBrandId} brandName={scanMeta.brand} />
                    )}
                  </motion.div>
                )}
              </>
            )}

            {tab === 'dashboard' && <Dashboard />}

            {tab === 'compare' && (
              <>
                <SectionIntro>
                  <b>Compare tab:</b> Run an AI scan on 2–4 brands at once. See who AI mentions most (<b>Share of Voice</b>), how each engine scores them, and how trends change over time.
                </SectionIntro>
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

            {tab === 'seo' && (
              <>
                <SectionIntro>
                  <b>SEO tab (Google rankings):</b> Add your website URL + country. We crawl your pages, find your keywords, and check where you rank on Google. Run regular scans to see your trend + auto-detect when rankings drop.
                </SectionIntro>
                <div className="flex items-center justify-end">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSeoCompareOpen((v) => !v)}
                    className="text-xs px-3.5 py-2 border border-slate-200 bg-white/80 hover:bg-white text-slate-700 rounded-xl flex items-center gap-1.5 shadow-[var(--shadow-soft)] backdrop-blur transition-all"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-emerald-600" />
                    {seoCompareOpen ? 'Close compare' : 'Compare sites'}
                  </motion.button>
                </div>
                <SeoCompareView open={seoCompareOpen} onClose={() => setSeoCompareOpen(false)} />
                <SeoSiteForm
                  onSiteCreated={(siteId, brand, domain) => {
                    setActiveSeoSite({ siteId, brand, domain });
                    setActiveSeoScan(null);
                    setSeoSiteRefresh((n) => n + 1);
                  }}
                />
                <SeoSiteDashboard
                  refreshKey={seoSiteRefresh}
                  activeSiteId={activeSeoSite?.siteId ?? null}
                  onSelectSite={(siteId) => {
                    const samePick = activeSeoSite?.siteId === siteId;
                    if (!samePick) setActiveSeoScan(null);
                    if (!samePick) {
                      void api.getSeoSite(siteId).then((s) => {
                        setActiveSeoSite({ siteId: s.id, brand: s.brand, domain: s.domain });
                      });
                    }
                  }}
                  onRunScan={(siteId, scanId, brand, domain) => {
                    setActiveSeoSite({ siteId, brand, domain });
                    setActiveSeoScan(scanId);
                    setSeoSiteRefresh((n) => n + 1);
                  }}
                />
                {activeSeoSite && (
                  <>
                    <SeoTrendChart siteId={activeSeoSite.siteId} refreshKey={seoSiteRefresh} />
                    <SeoSiteHistory
                      siteId={activeSeoSite.siteId}
                      refreshKey={seoSiteRefresh}
                      activeScanId={activeSeoScan}
                      onSelectScan={(scanId) => setActiveSeoScan(scanId)}
                    />
                    {activeSeoScan && (
                      <SeoSiteResults
                        siteId={activeSeoSite.siteId}
                        scanId={activeSeoScan}
                        brand={activeSeoSite.brand}
                        domain={activeSeoSite.domain}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <OnboardingWizard
          open={onboardingOpen}
          onClose={() => setOnboardingOpen(false)}
          onComplete={(brand) => {
            setScanMeta({ brand, category: '' });
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
          <span>AI Visibility Tracker · v1</span>
        </footer>
      </main>
    </div>
  );
}

function tabTitle(t: Tab) {
  switch (t) {
    case 'scan':      return 'New scan';
    case 'dashboard': return 'Dashboard';
    case 'compare':   return 'Compare brands';
    case 'seo':       return 'SEO tracker';
  }
}
function tabSubtitle(t: Tab) {
  switch (t) {
    case 'scan':      return 'Run a live AI visibility check across 3 engines.';
    case 'dashboard': return 'Your brand history, trends, and scheduled scans.';
    case 'compare':   return 'Pit 2–4 brands head-to-head with Share of Voice.';
    case 'seo':       return 'Crawl your site, find keywords, track Google rankings.';
  }
}

void React;

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
        GeoActions tells you <em>what</em> to add. These generators give you ready-to-paste code.
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
