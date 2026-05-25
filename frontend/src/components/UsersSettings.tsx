// frontend/src/components/UsersSettings.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, UserPlus, Trash2, RefreshCw, Power, KeyRound, Clock, Loader2,
} from 'lucide-react';
import { api, type PublicUser } from '../api/client';

function fmtDate(iso: string | null) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function daysLeft(iso: string | null): number | null {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function UsersSettings() {
    const [users, setUsers] = useState<PublicUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    // create form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [daysValid, setDaysValid] = useState(3);
    const [maxMasterScans, setMaxMasterScans] = useState(1);
    const [maxScans, setMaxScans] = useState(10);

    async function load() {
        setLoading(true);
        try {
            const list = await api.listUsers();
            setUsers(list);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load users');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function handleCreate(e: FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError(null);
        try {
            await api.createTrialUser({
                email: email.trim(),
                password,
                daysValid: Number(daysValid),
                maxMasterScans: Number(maxMasterScans),
                maxScans: Number(maxScans),
            });
            setEmail('');
            setPassword('');
            setDaysValid(3);
            setMaxMasterScans(1);
            setMaxScans(10);
            setShowCreate(false);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'create failed');
        } finally {
            setCreating(false);
        }
    }

    async function toggleActive(u: PublicUser) {
        await api.updateTrialUser(u.id, { active: !u.active });
        await load();
    }

    async function extend(u: PublicUser, days: number) {
        await api.updateTrialUser(u.id, { addDaysValid: days });
        await load();
    }

    async function resetUsage(u: PublicUser) {
        await api.updateTrialUser(u.id, { resetUsage: true });
        await load();
    }

    async function changeQuotas(u: PublicUser) {
        const nm = window.prompt(`Max FULL scans for ${u.email}?`, String(u.maxMasterScans));
        if (nm === null) return;
        const nr = window.prompt(`Max regular scans for ${u.email}?`, String(u.maxScans));
        if (nr === null) return;
        await api.updateTrialUser(u.id, {
            maxMasterScans: Number(nm) || 0,
            maxScans: Number(nr) || 0,
        });
        await load();
    }

    async function changePw(u: PublicUser) {
        const np = window.prompt(`New password for ${u.email} (min 6 chars)`);
        if (!np) return;
        await api.updateTrialUser(u.id, { newPassword: np });
        alert('Password updated');
    }

    async function remove(u: PublicUser) {
        if (!window.confirm(`Delete ${u.email}? This cannot be undone.`)) return;
        await api.deleteTrialUser(u.id);
        await load();
    }

    const trials = users.filter((u) => u.role === 'trial');
    const owners = users.filter((u) => u.role === 'owner');

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6"
        >
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow">
                        <Users className="w-4 h-4 text-white" />
                    </span>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                            Trial accounts
                        </h3>
                        <p className="text-xs text-slate-500">
                            Time-limited accounts for prospects — full system access, quota-capped.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    <button
                        onClick={() => setShowCreate((s) => !s)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1.5 shadow"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        {showCreate ? 'Cancel' : 'New trial'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                    {error}
                </div>
            )}

            <AnimatePresence>
                {showCreate && (
                    <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleCreate}
                        className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-xl mb-5 overflow-hidden"
                    >
                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                                placeholder="client@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Password</label>
                            <input
                                type="text"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                                placeholder="min 6 chars"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Days valid</label>
                            <input
                                type="number"
                                min={1}
                                value={daysValid}
                                onChange={(e) => setDaysValid(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Full scans</label>
                            <input
                                type="number"
                                min={0}
                                value={maxMasterScans}
                                onChange={(e) => setMaxMasterScans(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div className="md:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Regular scans</label>
                            <input
                                type="number"
                                min={0}
                                value={maxScans}
                                onChange={(e) => setMaxScans(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                        </div>
                        <div className="md:col-span-1 flex items-end">
                            <button
                                type="submit"
                                disabled={creating}
                                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow disabled:opacity-60"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create'}
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {loading ? (
                <div className="text-sm text-slate-500 py-6 text-center">Loading…</div>
            ) : (
                <>
                    {trials.length === 0 && (
                        <div className="text-sm text-slate-400 py-6 text-center italic">
                            No trial accounts yet.
                        </div>
                    )}
                    <div className="space-y-2">
                        {trials.map((u) => {
                            const dleft = daysLeft(u.expiresAt);
                            const lowQuota =
                                u.maxScans > 0 && u.usedScans / u.maxScans > 0.8;
                            return (
                                <div
                                    key={u.id}
                                    className={`rounded-xl border p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${
                                        u.active && !u.expired
                                            ? 'border-slate-200 bg-white'
                                            : 'border-slate-200 bg-slate-50 opacity-70'
                                    }`}
                                >
                                    <div className="md:col-span-4">
                                        <div className="text-sm font-semibold text-slate-900 break-all">
                                            {u.email}
                                        </div>
                                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                            <Clock className="w-3 h-3" />
                                            {u.expired ? (
                                                <span className="text-red-600 font-semibold">EXPIRED</span>
                                            ) : dleft !== null ? (
                                                <span>{dleft} days left · {fmtDate(u.expiresAt)}</span>
                                            ) : (
                                                <span>no expiry</span>
                                            )}
                                            {!u.active && (
                                                <span className="text-amber-700 font-semibold">DISABLED</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="md:col-span-3 text-xs">
                                        <div className="text-slate-500">Full scans</div>
                                        <div className="font-semibold text-slate-800">
                                            {u.usedMasterScans} / {u.maxMasterScans}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 text-xs">
                                        <div className="text-slate-500">Regular</div>
                                        <div className={`font-semibold ${lowQuota ? 'text-amber-700' : 'text-slate-800'}`}>
                                            {u.usedScans} / {u.maxScans}
                                        </div>
                                    </div>
                                    <div className="md:col-span-3 flex flex-wrap justify-end gap-1.5">
                                        <button onClick={() => toggleActive(u)} title={u.active ? 'Disable' : 'Enable'}
                                            className="text-[11px] px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1">
                                            <Power className="w-3 h-3" /> {u.active ? 'Disable' : 'Enable'}
                                        </button>
                                        <button onClick={() => extend(u, 3)} title="Extend +3 days"
                                            className="text-[11px] px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50">
                                            +3d
                                        </button>
                                        <button onClick={() => resetUsage(u)} title="Reset usage counters"
                                            className="text-[11px] px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50">
                                            Reset
                                        </button>
                                        <button onClick={() => changeQuotas(u)} title="Edit quotas"
                                            className="text-[11px] px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50">
                                            Quotas
                                        </button>
                                        <button onClick={() => changePw(u)} title="Change password"
                                            className="text-[11px] px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1">
                                            <KeyRound className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => remove(u)} title="Delete"
                                            className="text-[11px] px-2 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center gap-1">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {owners.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-slate-200">
                            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Owners</div>
                            {owners.map((u) => (
                                <div key={u.id} className="text-sm text-slate-700 flex items-center justify-between py-1">
                                    <span>{u.email}</span>
                                    <span className="text-[11px] text-slate-400">last login {fmtDate(u.lastLoginAt)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </motion.div>
    );
}
