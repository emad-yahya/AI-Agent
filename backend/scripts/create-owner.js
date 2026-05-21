// Seed (or reset) the owner account in Firestore `users` collection.
//
// Usage:
//   node scripts/create-owner.js <email> <password>
//
// If a user with this email exists, password is reset and role forced to
// "owner". If not, a new owner doc is created with unlimited quota.

const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
    console.error('Usage: node scripts/create-owner.js <email> <password>');
    process.exit(1);
}
if (password.length < 6) {
    console.error('Password must be at least 6 chars');
    process.exit(1);
}

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
let creds = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    creds = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
} else if (fs.existsSync(keyPath)) {
    creds = admin.credential.cert(require(keyPath));
} else {
    console.error('No Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or place serviceAccountKey.json.');
    process.exit(1);
}

admin.initializeApp({ credential: creds });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

(async () => {
    const normalized = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 10);

    const snap = await db
        .collection('users')
        .where('email', '==', normalized)
        .limit(1)
        .get();

    if (!snap.empty) {
        const doc = snap.docs[0];
        await doc.ref.update({
            passwordHash,
            role: 'owner',
            active: true,
        });
        console.log(`Owner password reset: ${normalized} (id=${doc.id})`);
    } else {
        const ref = await db.collection('users').add({
            email: normalized,
            passwordHash,
            role: 'owner',
            active: true,
            expiresAt: null,
            maxMasterScans: 999999,
            maxScans: 999999,
            usedMasterScans: 0,
            usedScans: 0,
            createdAt: admin.firestore.Timestamp.now(),
            createdBy: null,
            lastLoginAt: null,
        });
        console.log(`Owner created: ${normalized} (id=${ref.id})`);
    }

    process.exit(0);
})().catch((e) => {
    console.error('Error:', e);
    process.exit(1);
});
