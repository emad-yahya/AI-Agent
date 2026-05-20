// Firestore Timestamp values arrive over JSON in three shapes:
//   1. ISO string                          (after manual serialization)
//   2. { seconds: number, nanoseconds }    (firebase-admin REST shape)
//   3. { _seconds: number, _nanoseconds }  (firebase-admin internal shape)
// new Date(obj) returns Invalid Date for shapes 2/3 — this helper normalises them.

export type FirestoreDate =
    | string
    | number
    | Date
    | { seconds: number; nanoseconds?: number }
    | { _seconds: number; _nanoseconds?: number }
    | null
    | undefined;

export function parseFirestoreDate(value: FirestoreDate): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'object') {
        const obj = value as { seconds?: number; _seconds?: number };
        const s = obj.seconds ?? obj._seconds;
        if (typeof s === 'number') return new Date(s * 1000);
    }
    return null;
}

export function formatFirestoreDate(
    value: FirestoreDate,
    fallback = '—',
): string {
    const d = parseFirestoreDate(value);
    return d ? d.toLocaleString() : fallback;
}
