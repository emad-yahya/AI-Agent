// frontend/src/components/AccountPanel.tsx
import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { LogOut, KeyRound, User as UserIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

function fmtDate(iso: string | null) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export function AccountPanel() {
    const { user, logout, refresh } = useAuth();
    const [oldPw, setOldPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    if (!user) return null;

    async function handleChange(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMsg(null);
        setErr(null);
        try {
            await api.changePassword(oldPw, newPw);
            setMsg('Password updated.');
            setOldPw('');
            setNewPw('');
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'failed');
        } finally {
            setSaving(false);
            await refresh();
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6"
        >
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow">
                        <UserIcon className="w-4 h-4 text-white" />
                    </span>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                            Your account
                        </h3>
                        <p className="text-xs text-slate-500">
                            {user.email} · <span className="uppercase font-semibold">{user.role}</span>
                            {user.expiresAt && (
                                <span> · expires {fmtDate(user.expiresAt)}</span>
                            )}
                        </p>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5"
                >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
            </div>

            {user.role === 'demo' && (
                <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="rounded-xl border border-slate-200 p-3">
                        <div className="text-[11px] text-slate-500 uppercase font-semibold">Full scans</div>
                        <div className="text-xl font-bold text-slate-900 mt-1">
                            {user.usedMasterScans} <span className="text-sm text-slate-400 font-normal">/ {user.maxMasterScans}</span>
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                        <div className="text-[11px] text-slate-500 uppercase font-semibold">Regular scans</div>
                        <div className="text-xl font-bold text-slate-900 mt-1">
                            {user.usedScans} <span className="text-sm text-slate-400 font-normal">/ {user.maxScans}</span>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleChange} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <KeyRound className="w-4 h-4" /> Change password
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                        type="password"
                        required
                        value={oldPw}
                        onChange={(e) => setOldPw(e.target.value)}
                        placeholder="Current password"
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                    <input
                        type="password"
                        required
                        minLength={6}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="New password (min 6)"
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
                    >
                        {saving ? 'Saving…' : 'Update'}
                    </button>
                </div>
                {msg && <div className="text-xs text-emerald-700">{msg}</div>}
                {err && <div className="text-xs text-red-700">{err}</div>}
            </form>
        </motion.div>
    );
}
