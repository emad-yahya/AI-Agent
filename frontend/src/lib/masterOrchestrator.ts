import { api, type ScanResult } from '../api/client';

export type ModuleKey =
    | 'brandPresence'
    | 'competitorAudit'
    | 'onPageSeo'
    | 'contentGap'
    | 'listicleGap'
    | 'seoSite';

export type ModuleStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface MasterOrchestrationState {
    modules: Record<ModuleKey, ModuleStatus>;
    errors: Partial<Record<ModuleKey, string>>;
    seoSiteId: string | null;
}

export const INITIAL_STATE: MasterOrchestrationState = {
    modules: {
        brandPresence: 'pending',
        competitorAudit: 'pending',
        onPageSeo: 'pending',
        contentGap: 'pending',
        listicleGap: 'pending',
        seoSite: 'pending',
    },
    errors: {},
    seoSiteId: null,
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
    brandPresence: 'Brand presence (Knowledge Panel + Wikipedia)',
    competitorAudit: 'Competitor schema audit',
    onPageSeo: 'On-page SEO + Core Web Vitals',
    contentGap: 'Content gap + PAA',
    listicleGap: 'Listicle gap ("Best X" lists)',
    seoSite: 'Google rank tracker (Serper)',
};

const NON_COMPANY_PHRASES = new Set([
    'market knowledge', 'real estate', 'real estate market', 'first time',
    'quick wins', 'long term', 'short term', 'high quality', 'low cost',
    'wide range', 'years experience', 'last year', 'this year', 'next year',
    'north america', 'south america', 'middle east', 'south asia', 'european union',
]);

export function extractCompetitorsFromResults(
    results: ScanResult[],
    brand: string,
    limit = 6,
): string[] {
    const brandLower = brand.toLowerCase();
    const counts = new Map<string, number>();
    for (const r of results) {
        for (const topic of r.topics ?? []) {
            const t = topic.trim();
            if (!t) continue;
            if (t.toLowerCase().includes(brandLower)) continue;
            if (NON_COMPANY_PHRASES.has(t.toLowerCase())) continue;
            if (/^in\s+/i.test(t)) continue;
            // Drop overly long phrases (3+ words usually not company names)
            if (t.split(/\s+/).length > 4) continue;
            counts.set(t, (counts.get(t) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name]) => name);
}

export interface MasterScanArgs {
    brand: string;
    category: string;
    domain: string;
    country: string;
    results: ScanResult[];
    onUpdate: (next: MasterOrchestrationState) => void;
}

/**
 * Fires all 6 companion module scans in parallel (fire-and-forget).
 * Each module reports its own status via onUpdate. Panels themselves poll
 * for completion, so this just kicks them off so the data is ready when the
 * user opens the corresponding panel.
 */
export async function runMasterScan(args: MasterScanArgs): Promise<void> {
    const { brand, category, domain, country, results, onUpdate } = args;
    let state: MasterOrchestrationState = {
        ...INITIAL_STATE,
        modules: { ...INITIAL_STATE.modules },
        errors: {},
    };

    const setModule = (key: ModuleKey, status: ModuleStatus, errMsg?: string) => {
        state = {
            ...state,
            modules: { ...state.modules, [key]: status },
            errors: errMsg ? { ...state.errors, [key]: errMsg } : state.errors,
        };
        onUpdate(state);
    };

    const setSeoSite = (siteId: string) => {
        state = { ...state, seoSiteId: siteId };
        onUpdate(state);
    };

    const competitors = extractCompetitorsFromResults(results, brand, 6);

    // Brand presence (no domain needed)
    setModule('brandPresence', 'running');
    api.createBrandPresenceCheck(brand, competitors, country)
        .then(() => setModule('brandPresence', 'done'))
        .catch((e) => setModule('brandPresence', 'failed', (e as Error).message));

    // Listicle gap (no domain needed)
    setModule('listicleGap', 'running');
    api.createListicleGapScan(brand, category, competitors, country)
        .then(() => setModule('listicleGap', 'done'))
        .catch((e) => setModule('listicleGap', 'failed', (e as Error).message));

    if (!domain) {
        setModule('competitorAudit', 'skipped', 'Domain required');
        setModule('onPageSeo', 'skipped', 'Domain required');
        setModule('contentGap', 'skipped', 'Domain required');
        setModule('seoSite', 'skipped', 'Domain required');
        return;
    }

    // Competitor audit (needs brand domain)
    setModule('competitorAudit', 'running');
    api.createCompetitorAudit(brand, domain, competitors, country)
        .then(() => setModule('competitorAudit', 'done'))
        .catch((e) => setModule('competitorAudit', 'failed', (e as Error).message));

    // On-page SEO (needs domain)
    setModule('onPageSeo', 'running');
    api.createOnPageSeoScan(brand, domain)
        .then(() => setModule('onPageSeo', 'done'))
        .catch((e) => setModule('onPageSeo', 'failed', (e as Error).message));

    // Content gap (needs domain + queries — derive queries from category)
    setModule('contentGap', 'running');
    const queries = deriveQueries(category, brand);
    api.createContentGapScan({
        brand,
        domain,
        queries,
        country,
    })
        .then(() => setModule('contentGap', 'done'))
        .catch((e) => setModule('contentGap', 'failed', (e as Error).message));

    // SEO site (Google rank tracker) — create site then run first scan
    setModule('seoSite', 'running');
    (async () => {
        try {
            const site = await api.createSeoSite({ brand, domain, country });
            setSeoSite(site.siteId);
            await api.runSeoSiteScan(site.siteId);
            setModule('seoSite', 'done');
        } catch (e) {
            // Site may already exist — try to find it
            try {
                const sites = await api.listSeoSites(brand);
                const existing = sites.find(
                    (s) => s.domain.toLowerCase() === domain.toLowerCase(),
                );
                if (existing) {
                    setSeoSite(existing.id);
                    await api.runSeoSiteScan(existing.id);
                    setModule('seoSite', 'done');
                    return;
                }
            } catch {
                // fall through
            }
            setModule('seoSite', 'failed', (e as Error).message);
        }
    })();
}

function deriveQueries(category: string, brand: string): string[] {
    const c = category.trim().toLowerCase();
    return [
        `best ${c}`,
        `top ${c}`,
        `${c} near me`,
        `how to choose a ${c}`,
        `${brand} reviews`,
    ];
}
