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
    'service charges', 'older buildings', 'newer buildings', 'check online listings',
    'online listings', 'consider shared accommodation', 'shared accommodation',
    'explore nearby areas', 'nearby areas', 'price range', 'square feet',
    'good location', 'prime location', 'central location', 'public transport',
    'customer service', 'customer support', 'free wifi', 'great views',
]);

// Verbs and adjectives that signal a sentence fragment, not a brand name.
const SENTENCE_STARTERS = new Set([
    'check', 'consider', 'explore', 'find', 'search', 'visit', 'try', 'use',
    'compare', 'contact', 'ask', 'browse', 'review', 'avoid', 'choose',
    'pick', 'select', 'see', 'look', 'read', 'get', 'buy', 'rent', 'book',
    'call', 'email', 'older', 'newer', 'best', 'top', 'cheap', 'cheapest',
    'affordable', 'luxury', 'budget', 'large', 'small', 'modern', 'classic',
    'good', 'great', 'high', 'low', 'nearby', 'local', 'online', 'free',
    'paid', 'private', 'public', 'open', 'closed', 'new', 'old',
]);

// Generic singleton nouns that leak through (concepts, not entities).
const GENERIC_SINGLETONS = new Set([
    'listings', 'areas', 'buildings', 'accommodation', 'charges', 'fees',
    'reviews', 'ratings', 'options', 'choices', 'services', 'features',
    'amenities', 'facilities', 'prices', 'costs', 'budget', 'agents',
    'brokers', 'developers', 'companies', 'firms', 'agencies',
]);

// Landmarks, neighborhoods, geographic features — not competitors.
const GEO_TOKENS = new Set([
    'mall', 'burj', 'tower', 'towers', 'marina', 'beach', 'palm', 'island',
    'downtown', 'creek', 'lagoon', 'gulf', 'sea', 'bay', 'port', 'harbor',
    'park', 'district', 'centre', 'center', 'plaza', 'square', 'avenue',
    'street', 'road', 'boulevard', 'ranches', 'hills', 'heights', 'gardens',
    'meadows', 'springs', 'lakes', 'shores', 'oasis', 'village',
    // city/country/region
    'dubai', 'abu', 'sharjah', 'ajman', 'fujairah', 'uae', 'emirates',
    'difc', 'jbr', 'jvc', 'jlt', 'mbr',
]);

function isLikelyBrandName(t: string): boolean {
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) return false;

    const lower = t.toLowerCase();
    if (NON_COMPANY_PHRASES.has(lower)) return false;

    const firstLower = words[0].toLowerCase();
    if (SENTENCE_STARTERS.has(firstLower)) return false;
    if (/^(in|on|at|of|for|to|with|from|by)\s+/i.test(t)) return false;

    // Each word must start uppercase (proper noun heuristic).
    // Allow "&", "and", "of", "the", "for" as connectors mid-name.
    const connectors = new Set(['&', 'and', 'of', 'the', 'for', 'la', 'le', 'de', 'du']);
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (i > 0 && connectors.has(w.toLowerCase())) continue;
        if (!/^[A-Z]/.test(w)) return false;
    }

    // Single-word lower-case-stem in generic singletons set.
    if (words.length === 1 && GENERIC_SINGLETONS.has(firstLower)) return false;

    // Any geo/landmark token disqualifies UNLESS the phrase carries a
    // corporate suffix (then it's a real company that happens to be named
    // after a place — e.g. "Dubai Properties", "Emirates Group").
    const geoCount = words.filter((w) => GEO_TOKENS.has(w.toLowerCase())).length;
    const hasCorp = words.some((w) => CORP_SUFFIXES.has(w.toLowerCase()));
    if (geoCount >= 2) return false; // two geo tokens = place name (e.g. "Dubai Marina", "Burj Khalifa")
    if (geoCount === 1 && !hasCorp) return false;

    return true;
}

const CORP_SUFFIXES = new Set([
    'inc', 'llc', 'ltd', 'corp', 'co', 'group', 'holdings', 'company',
    'partners', 'capital', 'ventures', 'labs', 'studio', 'studios',
    'systems', 'solutions', 'technologies', 'tech', 'media', 'agency',
    'properties', 'realty', 'estates', 'brokers', 'homes', 'international',
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
            if (!isLikelyBrandName(t)) continue;
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
