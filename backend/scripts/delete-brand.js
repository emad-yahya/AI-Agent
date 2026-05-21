// Hard-deletes one brand and ALL of its associated data.
//
// Usage:
//   node scripts/delete-brand.js <brandId>          # preview (dry run)
//   node scripts/delete-brand.js <brandId> --apply  # actually delete
//
// Deletes:
//   brands/{brandId}
//   brands/{brandId}/scans/* + their results subcollection
//   brands/{brandId}/scanSummaries/*
//   brands/{brandId}/seoScans/*
//   brands/{brandId}/listicleGapScans/*
//   brands/{brandId}/competitorAuditScans/*
//   brands/{brandId}/brandPresenceReports/*
//   brands/{brandId}/onPageSeoReports/*
//   brands/{brandId}/serpRankScans/*
//   brands/{brandId}/contentGapScans/*
//   brands/{brandId}/config/*  (alerts)
//   brands/{brandId}/actionCompletions/*
//   seoSites where brandId == <brandId>  +  their scans subcollection

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const brandId = process.argv[2];
const apply = process.argv.includes('--apply');

if (!brandId) {
    console.error('Usage: node scripts/delete-brand.js <brandId> [--apply]');
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

const SUBCOLLECTIONS = [
    'scans',
    'scanSummaries',
    'seoScans',
    'listicleGapScans',
    'competitorAuditScans',
    'brandPresenceReports',
    'onPageSeoReports',
    'serpRankScans',
    'contentGapScans',
    'config',
    'actionCompletions',
];

async function deleteSubcollection(parentRef, subPath, label) {
    const snap = await parentRef.collection(subPath).get();
    let total = snap.size;
    if (total === 0) return 0;

    if (subPath === 'scans') {
        // Also delete results subcollection per scan
        for (const doc of snap.docs) {
            const results = await doc.ref.collection('results').get();
            total += results.size;
            if (apply) {
                const batch = db.batch();
                results.docs.forEach((r) => batch.delete(r.ref));
                await batch.commit();
            }
        }
    }

    if (apply) {
        // Delete in batches of 500 (Firestore limit)
        let chunk = [];
        for (const doc of snap.docs) {
            chunk.push(doc);
            if (chunk.length === 500) {
                const batch = db.batch();
                chunk.forEach((d) => batch.delete(d.ref));
                await batch.commit();
                chunk = [];
            }
        }
        if (chunk.length > 0) {
            const batch = db.batch();
            chunk.forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    }

    console.log(`  ${label.padEnd(28)} ${String(total).padStart(4)} docs ${apply ? 'DELETED' : '(would delete)'}`);
    return total;
}

async function deleteSeoSitesForBrand(brandId) {
    const sitesSnap = await db.collection('seoSites').where('brandId', '==', brandId).get();
    let totalSiteScans = 0;
    for (const site of sitesSnap.docs) {
        const scansSnap = await site.ref.collection('scans').get();
        totalSiteScans += scansSnap.size;
        if (apply) {
            // delete scans first
            let chunk = [];
            for (const s of scansSnap.docs) {
                chunk.push(s);
                if (chunk.length === 500) {
                    const batch = db.batch();
                    chunk.forEach((d) => batch.delete(d.ref));
                    await batch.commit();
                    chunk = [];
                }
            }
            if (chunk.length > 0) {
                const batch = db.batch();
                chunk.forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }
            // then delete site
            await site.ref.delete();
        }
    }
    console.log(`  seoSites                     ${String(sitesSnap.size).padStart(4)} docs ${apply ? 'DELETED' : '(would delete)'}`);
    console.log(`  seoSiteScans                 ${String(totalSiteScans).padStart(4)} docs ${apply ? 'DELETED' : '(would delete)'}`);
    return sitesSnap.size + totalSiteScans;
}

(async () => {
    const brandRef = db.collection('brands').doc(brandId);
    const brandDoc = await brandRef.get();
    if (!brandDoc.exists) {
        console.error(`Brand ${brandId} does not exist.`);
        process.exit(1);
    }

    const data = brandDoc.data();
    console.log(`\nBrand: ${brandId}`);
    console.log(`Name : "${data.name}"`);
    console.log(`Mode : ${apply ? '🔴 APPLY (deletes for real)' : '🔵 DRY RUN (preview)'}`);
    console.log('');

    let total = 0;
    for (const sub of SUBCOLLECTIONS) {
        total += await deleteSubcollection(brandRef, sub, sub);
    }
    total += await deleteSeoSitesForBrand(brandId);

    if (apply) {
        await brandRef.delete();
        console.log(`  brands/${brandId}      DELETED`);
        total += 1;
    } else {
        console.log(`  brands/${brandId}      (would delete)`);
        total += 1;
    }

    console.log('');
    console.log(`Total docs: ${total} ${apply ? 'DELETED' : 'would be deleted'}`);
    console.log('');

    process.exit(0);
})().catch((e) => {
    console.error('Error:', e);
    process.exit(1);
});
