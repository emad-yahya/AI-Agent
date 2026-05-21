// frontend/src/components/LoginPage.tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
    Eye, Lock, Mail, Loader2, ShieldCheck, Sparkles, BarChart3,
    Target, Zap, MessageCircle, ArrowRight, Gift,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const OWNER_NAME = 'Emad Yahya';
const OWNER_WA_NUMBER = '971566392647';
const OWNER_WA_DEMO_LINK = `https://wa.me/${OWNER_WA_NUMBER}?text=${encodeURIComponent(
    "Hi Emad, I'd like a free demo of AI Visibility Tracker. Can you set me up with a trial account?",
)}`;
const OWNER_WA_CONTACT_LINK = `https://wa.me/${OWNER_WA_NUMBER}?text=${encodeURIComponent(
    "Hi Emad, I saw your AI Visibility Tracker and I'm interested in learning more about your services.",
)}`;

const FEATURES = [
    {
        icon: BarChart3,
        title: 'Track AI mentions',
        desc: 'See how often ChatGPT, Gemini & Perplexity recommend your brand.',
    },
    {
        icon: Target,
        title: 'Beat competitors',
        desc: 'Audit their schemas, content gaps, and SERP positions side by side.',
    },
    {
        icon: Zap,
        title: 'One-click Master scan',
        desc: 'AI engines + 6 Google modules running in parallel — done in minutes.',
    },
];

// Smooth mouse-following orb for the hero background.
function useMouseSpring() {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 50, damping: 20, mass: 1 });
    const sy = useSpring(y, { stiffness: 50, damping: 20, mass: 1 });
    return { x, y, sx, sy };
}

export function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const { x, y, sx, sy } = useMouseSpring();

    useEffect(() => {
        function onMove(e: MouseEvent) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            x.set(e.clientX - rect.left);
            y.set(e.clientY - rect.top);
        }
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, [x, y]);

    const orb1X = useTransform(sx, (v) => v - 250);
    const orb1Y = useTransform(sy, (v) => v - 250);
    const orb2X = useTransform(sx, (v) => v * -0.3 + 100);
    const orb2Y = useTransform(sy, (v) => v * -0.3 + 100);

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
        <div ref={containerRef} className="min-h-screen w-full relative overflow-hidden bg-slate-50">
            {/* ───────── Interactive background ───────── */}
            {/* Base mesh gradient */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    background:
                        'radial-gradient(900px 700px at 15% -10%, rgba(99,102,241,0.18), transparent 60%),' +
                        'radial-gradient(800px 600px at 90% 110%, rgba(236,72,153,0.16), transparent 60%),' +
                        'radial-gradient(700px 600px at 50% 50%, rgba(168,85,247,0.10), transparent 65%),' +
                        'linear-gradient(180deg, #f8f9ff 0%, #eef1fb 100%)',
                }}
            />

            {/* Mouse-following orbs */}
            <motion.div
                className="absolute z-0 w-[500px] h-[500px] rounded-full pointer-events-none"
                style={{
                    x: orb1X,
                    y: orb1Y,
                    background:
                        'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.12) 40%, transparent 70%)',
                    filter: 'blur(40px)',
                }}
            />
            <motion.div
                className="absolute z-0 w-[400px] h-[400px] rounded-full pointer-events-none"
                style={{
                    x: orb2X,
                    y: orb2Y,
                    background:
                        'radial-gradient(circle, rgba(236,72,153,0.22) 0%, rgba(6,182,212,0.10) 40%, transparent 70%)',
                    filter: 'blur(50px)',
                }}
            />

            {/* Floating decorative shapes */}
            <motion.div
                className="absolute top-[15%] right-[8%] w-3 h-3 rounded-full bg-indigo-400/40 z-0 hidden md:block"
                animate={{ y: [0, -20, 0], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute bottom-[20%] left-[10%] w-4 h-4 rounded-sm bg-fuchsia-400/30 z-0 hidden md:block"
                animate={{ rotate: [0, 180, 360], y: [0, 15, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute top-[60%] right-[15%] w-2 h-2 rounded-full bg-cyan-400/50 z-0 hidden md:block"
                animate={{ y: [0, -30, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />

            {/* Subtle grid overlay */}
            <div
                className="absolute inset-0 z-0 opacity-[0.025] pointer-events-none"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(15,23,42,1) 1px, transparent 1px),' +
                        'linear-gradient(90deg, rgba(15,23,42,1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />

            {/* ───────── Content ───────── */}
            <div className="relative z-10 min-h-screen grid lg:grid-cols-[1.1fr_1fr] gap-0">
                {/* LEFT: hero */}
                <motion.aside
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="hidden lg:flex flex-col justify-between p-14 xl:p-20"
                >
                    {/* Brand mark */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-[0_10px_32px_-8px_rgba(99,102,241,0.5)]">
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

                    {/* Hero block */}
                    <div className="max-w-xl py-10">
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur ring-1 ring-indigo-100 text-[11px] font-semibold text-indigo-700 mb-8 shadow-sm"
                        >
                            <Sparkles className="w-3 h-3" />
                            Built for B2B SaaS that want to rank in AI
                        </motion.div>

                        <h1 className="text-5xl xl:text-6xl font-bold tracking-tight text-slate-900 leading-[1.04]">
                            Reach{' '}
                            <span className="text-gradient">#1</span>
                            <br />
                            in ChatGPT,
                            <br />
                            Gemini & Google.
                        </h1>

                        <p className="mt-8 text-lg text-slate-600 leading-relaxed max-w-md">
                            Audit your brand's presence in AI answers, compare
                            against competitors, and follow playbooks that move
                            the needle.
                        </p>

                        {/* Features with breathing room */}
                        <div className="mt-12 space-y-6">
                            {FEATURES.map((f, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                                    className="flex items-start gap-4"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center shrink-0">
                                        <f.icon className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">
                                            {f.title}
                                        </div>
                                        <div className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                                            {f.desc}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom: copyright */}
                    <div className="text-[11px] text-slate-400">
                        © {new Date().getFullYear()} {OWNER_NAME}. All rights reserved.
                    </div>
                </motion.aside>

                {/* RIGHT: form */}
                <main className="flex flex-col justify-center items-center px-6 py-12 lg:py-8">
                    {/* Mobile brand mark */}
                    <div className="lg:hidden mb-10 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-md">
                            <Eye className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-900">
                                AI Visibility Tracker
                            </div>
                            <div className="text-[10px] text-slate-500">
                                Win the AI search era
                            </div>
                        </div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full max-w-md space-y-6"
                    >
                        {/* Form card */}
                        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] ring-1 ring-white/80 p-8 md:p-10">
                            <div className="mb-8">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-[0_10px_32px_-8px_rgba(99,102,241,0.5)] mb-5">
                                    <ShieldCheck className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                                    Welcome back
                                </h2>
                                <p className="text-sm text-slate-500 mt-1.5">
                                    Sign in to access your dashboard
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-2 uppercase tracking-wider">
                                        Email
                                    </label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="email"
                                            autoComplete="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-11 pr-3 py-3.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-sm transition placeholder:text-slate-400"
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-2 uppercase tracking-wider">
                                        Password
                                    </label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type={showPw ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-11 pr-16 py-3.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-sm transition placeholder:text-slate-400"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPw((s) => !s)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-md hover:bg-slate-100 transition"
                                        >
                                            {showPw ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 flex items-start gap-2"
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
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-600 hover:shadow-[0_15px_35px_-10px_rgba(168,85,247,0.6)] text-white font-semibold text-sm shadow-[0_10px_24px_-8px_rgba(99,102,241,0.45)] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Signing in…
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="w-4 h-4" />
                                            Sign in
                                        </>
                                    )}
                                </motion.button>
                            </form>
                        </div>

                        {/* Demo CTA card */}
                        <motion.a
                            href={OWNER_WA_DEMO_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ y: -2 }}
                            className="block bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 ring-1 ring-emerald-200 hover:ring-emerald-400 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shrink-0">
                                    <Gift className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                        No account? Get a free demo
                                    </div>
                                    <div className="text-[11px] text-slate-600 mt-0.5">
                                        WhatsApp the owner — full trial within minutes.
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs shrink-0">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </motion.a>

                        {/* Powered by + WhatsApp */}
                        <div className="flex items-center justify-center">
                            <a
                                href={OWNER_WA_CONTACT_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Contact ${OWNER_NAME} on WhatsApp`}
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur ring-1 ring-slate-200 hover:ring-emerald-300 hover:bg-white text-slate-600 hover:text-emerald-700 text-[11px] font-semibold transition"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 glow-dot" />
                                Powered by {OWNER_NAME}
                                <span className="text-slate-300">·</span>
                                <span className="font-mono text-slate-500">+{OWNER_WA_NUMBER}</span>
                            </a>
                        </div>

                        {/* Mobile copyright */}
                        <div className="lg:hidden text-center text-[10px] text-slate-400">
                            © {new Date().getFullYear()} {OWNER_NAME}. All rights reserved.
                        </div>
                    </motion.div>
                </main>
            </div>
        </div>
    );
}
