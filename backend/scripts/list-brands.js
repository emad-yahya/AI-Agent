// One-shot read-only inventory of brands matching a name pattern.
// Usage: node scripts/list-brands.js [name-substring]
//   default substring: "platinum"

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
    console.error('Missing serviceAccountKey.json at', keyPath);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(require(keyPath)),
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const needle = (process.argv[2] || 'platinum').toLowerCase();

(async () => {
    const snap = await db.collection('brands').get();
    const matches = [];

    for (const doc of snap.docs) {
        const data = doc.data();
        const name = (data.name || '').toString();
        if (!name.toLowerCase().includes(needle)) continue;

        // Count scans
        const scansSnap = await db
            .collection('brands').doc(doc.id)
            .collection('scans').get();

        // Count SEO sites tied to this brandId
        const sitesSnap = await db
            .collection('seoSites')
            .where('brandId', '==', doc.id)
            .get();

        const createdAt = data.createdAt
            ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : String(data.createdAt))
            : '(no date)';

        matches.push({
            id: doc.id,
            name,
            createdAt,
            scans: scansSnap.size,
            seoSites: sitesSnap.size,
        });
    }

    matches.sort((a, b) => (b.scans - a.scans) || a.createdAt.localeCompare(b.createdAt));

    console.log(`\nFound ${matches.length} brand(s) matching "${needle}":\n`);
    console.log('id'.padEnd(24), 'name'.padEnd(28), 'created'.padEnd(28), 'scans  sites');
    console.log('-'.repeat(96));
    for (const m of matches) {
        console.log(
            m.id.padEnd(24),
            m.name.padEnd(28),
            m.createdAt.padEnd(28),
            String(m.scans).padStart(5),
            String(m.seoSites).padStart(6),
        );
    }
    console.log('');
    process.exit(0);
})().catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
});
