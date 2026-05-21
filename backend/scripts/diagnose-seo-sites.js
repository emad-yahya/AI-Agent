// Diagnose why Google chart shows only 1 point.
//
// Usage:
//   node scripts/diagnose-seo-sites.js <brandName>
//
// Lists every seoSite for that brand, every scan inside it, status, dates,
// and rankedCount/totalKeywords so we can see why most points are missing
// from the dashboard chart.

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const brand = process.argv[2];
if (!brand) {
    console.error('Usage: node scripts/diagnose-seo-sites.js <brandName>');
    process.exit(1);
}

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
    console.error('Missing serviceAccountKey.json');
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

function fmtDate(ts) {
    if (!ts) return '—';
    if (ts._seconds != null) return new Date(ts._seconds * 1000).toISOString();
    if (ts.seconds != null) return new Date(ts.seconds * 1000).toISOString();
    return String(ts);
}

(async () => {
    const sitesSnap = await db
        .collection('seoSites')
        .where('brand', '==', brand)
        .get();

    console.log(`\nBrand: "${brand}"`);
    console.log(`seoSites found: ${sitesSnap.size}\n`);

    if (sitesSnap.size === 0) {
        console.log('No seoSites match by exact brand text. Trying a case-insensitive scan over all seoSites...');
        const all = await db.collection('seoSites').get();
        const fuzzy = all.docs.filter((d) => {
            const b = (d.data().brand || '').toLowerCase();
            return b.includes(brand.toLowerCase());
        });
        console.log(`Fuzzy matches: ${fuzzy.length}`);
        for (const d of fuzzy) {
            console.log(`  ${d.id}  brand="${d.data().brand}"  domain=${d.data().domain}  brandId=${d.data().brandId}`);
        }
        process.exit(0);
    }

    const statusCounts = { done: 0, running: 0, failed: 0, other: 0 };
    const dayKeys = new Set();

    for (const siteDoc of sitesSnap.docs) {
        const site = siteDoc.data();
        const scansSnap = await siteDoc.ref.collection('scans').orderBy('createdAt', 'desc').get();
        console.log(`Site ${siteDoc.id}`);
        console.log(`  brand="${site.brand}"  domain=${site.domain}  country=${site.country}  brandId=${site.brandId}`);
        console.log(`  scans: ${scansSnap.size}`);
        for (const scanDoc of scansSnap.docs) {
            const s = scanDoc.data();
            const dt = fmtDate(s.createdAt);
            const day = dt.slice(0, 10);
            if (s.status === 'done') {
                statusCounts.done++;
                dayKeys.add(day);
            } else if (s.status === 'running') statusCounts.running++;
            else if (s.status === 'failed') statusCounts.failed++;
            else statusCounts.other++;

            const ranked = s.rankedCount ?? 0;
            const total = s.totalKeywords ?? (s.keywords ? s.keywords.length : 0);
            const cov = total > 0 ? Math.round((ranked / total) * 100) : 0;
            const errMsg = s.error || s.errorMessage || '';
            console.log(
                `    ${day}  status=${(s.status || '').padEnd(7)}  ranked=${String(ranked).padStart(3)}/${String(total).padStart(3)}  cov=${cov}%  ${errMsg ? '  ERR: ' + errMsg.slice(0, 80) : ''}`
            );
        }
        console.log('');
    }

    console.log('────────────────────────────────────────');
    console.log(`Total done    : ${statusCounts.done}`);
    console.log(`Total running : ${statusCounts.running}`);
    console.log(`Total failed  : ${statusCounts.failed}`);
    console.log(`Total other   : ${statusCounts.other}`);
    console.log(`Distinct done-days (= chart points): ${dayKeys.size}`);
    if (dayKeys.size > 0) console.log(`Days: ${[...dayKeys].sort().join(', ')}`);
    console.log('');
    process.exit(0);
})().catch((e) => {
    console.error('Error:', e);
    process.exit(1);
});
