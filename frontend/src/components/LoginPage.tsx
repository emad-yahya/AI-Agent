// frontend/src/components/LoginPage.tsx
import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
    Eye, Lock, Mail, Loader2, ShieldCheck, Sparkles, BarChart3,
    Target, Zap, MessageCircle, Globe2, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const OWNER_NAME = 'Emad Yahya';
const OWNER_WA_NUMBER = '971566392647';
const OWNER_WA_LINK = `https://wa.me/${OWNER_WA_NUMBER}?text=${encodeURIComponent(
    "Hi Emad, I saw your AI Visibility Tracker and I'm interested in learning more about your services.",
)}`;

const FEATURES = [
    { icon: BarChart3, text: 'Track AI mentions across ChatGPT, Gemini & Perplexity' },
    { icon: Target, text: 'Audit competitors, find content gaps, win the SERP' },
    { icon: Zap, text: 'One-click Master scan: AI + 6 Google modules' },
    { icon: ShieldCheck, text: 'Actionable playbooks with verify steps' },
];

export function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await login(email.trim(), password);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Login failed';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen w-full relative overflow-hidden">
            {/* Animated mesh background */}
            <div className="app-mesh-bg" />
            <div className="app-grain" />

            <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
                {/* ───── LEFT PANE: hero ───── */}
                <motion.aside
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="hidden lg:flex flex-col justify-between p-12 xl:p-16 relative"
                >
                    {/* Logo + product name */}
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-[var(--shadow-glow-brand)]">
                                    <Eye className="w-6 h-6 text-white" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white glow-dot" />
                            </div>
                            <div>
                                <div className="text-base font-bold text-slate-900 tracking-tight">
                                    AI Visibility Tracker
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                    Win the AI search era
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hero copy */}
                    <div className="max-w-lg">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 backdrop-blur ring-1 ring-indigo-100 text-[11px] font-semibold text-indigo-700 mb-5">
                            <Sparkles className="w-3 h-3" />
                            Built for B2B SaaS that want to rank in AI
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-bold tracking-tight text-slate-900 leading-[1.05]">
                            Reach <span className="text-gradient">#1</span> in
                            <br />
                            ChatGPT, Gemini
                            <br />
                            and Google.
                        </h1>
                        <p className="mt-5 text-base text-slate-600 leading-relaxed">
                            Audit your brand's presence in AI answers, compare
                            against competitors, and follow data-driven playbooks
                            that move the needle.
                        </p>

                        {/* Feature checklist */}
                        <ul className="mt-7 space-y-2.5">
                            {FEATURES.map((f, i) => (
                                <motion.li
                                    key={i}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                                    className="flex items-center gap-3 text-sm text-slate-700"
                                >
                                    <span className="w-7 h-7 rounded-lg bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center shrink-0">
                                        <f.icon className="w-3.5 h-3.5 text-indigo-600" />
                                    </span>
                                    <span>{f.text}</span>
                                </motion.li>
                            ))}
                        </ul>
                    </div>

                    {/* Owner card */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                    >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                            EY
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-900">
                                Built by {OWNER_NAME}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <Globe2 className="w-3 h-3" />
                                Dubai · GEO/SEO architect
                            </div>
                        </div>
                        <a
                            href={OWNER_WA_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition"
                        >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                        </a>
                    </motion.div>
                </motion.aside>

                {/* ───── RIGHT PANE: form ───── */}
                <main className="flex flex-col justify-center items-center px-6 py-12 lg:py-8">
                    {/* Mobile logo (visible only when left pane hidden) */}
                    <div className="lg:hidden mb-8 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-md">
                            <Eye className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-900">AI Visibility Tracker</div>
                            <div className="text-[10px] text-slate-500">Win the AI search era</div>
                        </div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full max-w-md"
                    >
                        {/* Form card with animated gradient border */}
                        <div className="gradient-border rounded-[var(--radius-card)] glass-strong p-7">
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-[var(--shadow-glow-brand)] mb-4">
                                    <ShieldCheck className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                                    Welcome back
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    Sign in to access your dashboard
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                        Email
                                    </label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="email"
                                            autoComplete="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-11 pr-3 py-3 rounded-[var(--radius-control)] border border-slate-200 bg-white/80 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-sm transition placeholder:text-slate-400"
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                        Password
                                    </label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type={showPw ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-11 pr-16 py-3 rounded-[var(--radius-control)] border border-slate-200 bg-white/80 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-sm transition placeholder:text-slate-400"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPw((s) => !s)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition"
                                        >
                                            {showPw ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-start gap-2"
                                    >
                                        <span className="mt-0.5">⚠</span>
                                        <span>{error}</span>
                                    </motion.div>
                                )}

                                <motion.button
                                    type="submit"
                                    disabled={submitting}
                                    whileHover={{ y: -1 }}
                                    whileTap={{ y: 0 }}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[var(--radius-control)] bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-600 hover:from-indigo-700 hover:via-fuchsia-700 hover:to-pink-700 text-white font-semibold text-sm shadow-[var(--shadow-glow-brand)] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Signing in…
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="w-4 h-4" />
                                            Sign in securely
                                        </>
                                    )}
                                </motion.button>
                            </form>

                            {/* Trust row */}
                            <div className="mt-5 pt-5 border-t border-slate-200/70 grid grid-cols-3 gap-2 text-center">
                                <div className="text-[10px] text-slate-500 flex flex-col items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    JWT secured
                                </div>
                                <div className="text-[10px] text-slate-500 flex flex-col items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    bcrypt hashed
                                </div>
                                <div className="text-[10px] text-slate-500 flex flex-col items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    Invite only
                                </div>
                            </div>
                        </div>

                        {/* Footer: owner badge + copyright */}
                        <div className="mt-6 flex flex-col items-center gap-3">
                            <a
                                href={OWNER_WA_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Contact ${OWNER_NAME} on WhatsApp · +${OWNER_WA_NUMBER}`}
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur ring-1 ring-emerald-200 hover:ring-emerald-400 hover:bg-emerald-50 text-emerald-700 text-[11px] font-semibold transition shadow-sm"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 glow-dot" />
                                <MessageCircle className="w-3 h-3" />
                                Powered by {OWNER_NAME}
                                <span className="text-emerald-500">·</span>
                                <span className="font-mono">+{OWNER_WA_NUMBER}</span>
                            </a>
                            <p className="text-[10px] text-slate-400 text-center leading-relaxed max-w-sm">
                                © {new Date().getFullYear()} {OWNER_NAME}. All rights reserved.
                                <br />
                                Unauthorized use, copy, or redistribution is prohibited.
                            </p>
                        </div>

                        {/* Mobile-only: short value prop */}
                        <div className="lg:hidden mt-5 text-center text-[11px] text-slate-500">
                            Access by invitation only. Need a demo account?{' '}
                            <a
                                href={OWNER_WA_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-700 font-semibold underline decoration-emerald-300 underline-offset-2"
                            >
                                Contact the owner
                            </a>
                            .
                        </div>
                    </motion.div>
                </main>
            </div>
        </div>
    );
}
