// frontend/src/components/LoginPage.tsx
// Pro split layout — premium AI video as left-panel background, reactive form glows.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
    Eye, Lock, Mail, Loader2, ShieldCheck, Sparkles, BarChart3,
    Target, Zap, MessageCircle, ArrowRight, Gift, Check,
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

const HIGHLIGHTS = [
    { icon: BarChart3, text: 'Track brand mentions across ChatGPT, Gemini & Perplexity' },
    { icon: Target,    text: 'Benchmark competitors — schemas, content gaps, SERP slots' },
    { icon: Zap,       text: 'One-click Master scan: AI engines + 6 Google modules' },
];

type Focus = 'email' | 'password' | null;

export function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [focused, setFocused] = useState<Focus>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Subtle mouse parallax on the video layer.
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const smx = useSpring(mx, { stiffness: 35, damping: 22, mass: 1 });
    const smy = useSpring(my, { stiffness: 35, damping: 22, mass: 1 });
    const parallaxX = useTransform(smx, [-1, 1], [-8, 8]);
    const parallaxY = useTransform(smy, [-1, 1], [-5, 5]);

    useEffect(() => {
        function onMove(e: MouseEvent) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            mx.set((e.clientX - cx) / cx);
            my.set((e.clientY - cy) / cy);
        }
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, [mx, my]);

    // Speed up / slow video subtly on focus to feel "reactive".
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        v.playbackRate = focused === 'email' ? 1.15 : focused === 'password' ? 0.7 : 1;
    }, [focused]);

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

    const isEmail = focused === 'email';
    const isPw = focused === 'password';

    return (
        <div className="min-h-screen w-full grid lg:grid-cols-[1.05fr_1fr] bg-white">
            {/* ═════════════ LEFT — Premium AI video as background ═════════════ */}
            <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 text-white overflow-hidden">
                {/* Video layer */}
                <motion.div
                    className="absolute inset-0 z-0"
                    style={{ x: parallaxX, y: parallaxY }}
                >
                    <video
                        ref={videoRef}
                        src="/login-ai-video.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        className="absolute inset-0 w-full h-full object-cover object-center scale-110"
                    />
                </motion.div>

                {/* Legibility overlay — lighter than before so video shines */}
                <div
                    className="absolute inset-0 z-[1] pointer-events-none"
                    style={{
                        background:
                            'linear-gradient(135deg, rgba(15,23,42,0.55) 0%, rgba(30,27,75,0.45) 45%, rgba(76,29,149,0.40) 100%)',
                    }}
                />
                {/* Focus-driven colour wash */}
                <AnimatePresence>
                    {isEmail && (
                        <motion.div
                            key="wash-email"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            className="absolute inset-0 z-[1] pointer-events-none"
                            style={{
                                background:
                                    'radial-gradient(800px 600px at 70% 50%, rgba(6,182,212,0.30), transparent 60%)',
                                mixBlendMode: 'screen',
                            }}
                        />
                    )}
                    {isPw && (
                        <motion.div
                            key="wash-pw"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            className="absolute inset-0 z-[1] pointer-events-none"
                            style={{
                                background:
                                    'radial-gradient(800px 600px at 70% 50%, rgba(236,72,153,0.30), transparent 60%)',
                                mixBlendMode: 'screen',
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* ─── Top: brand mark ─── */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="relative">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-400 via-fuchsia-400 to-pink-400 flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(168,85,247,0.6)]">
                            <Eye className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                    </div>
                    <div>
                        <div className="text-[15px] font-bold tracking-tight">
                            AI Visibility Tracker
                        </div>
                        <div className="text-[11px] text-indigo-200/80 font-medium">
                            Win the AI search era
                        </div>
                    </div>
                </div>

                {/* ─── Middle: hero copy ─── */}
                <div className="relative z-10 max-w-lg">
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/15 text-[11px] font-semibold text-indigo-100 mb-7"
                    >
                        <Sparkles className="w-3 h-3" />
                        Built for B2B SaaS that want to rank in AI
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.5 }}
                        className="text-[44px] xl:text-[52px] font-bold tracking-tight leading-[1.05] drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                    >
                        Reach{' '}
                        <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                            #1
                        </span>
                        {' '}in ChatGPT,
                        <br />
                        Gemini & Google.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="mt-6 text-[15px] text-indigo-50/90 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                    >
                        Audit your brand's presence in AI answers, compare against competitors,
                        and follow playbooks that actually move the needle.
                    </motion.p>

                    <ul className="mt-8 space-y-3.5">
                        {HIGHLIGHTS.map((h, i) => (
                            <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.08, duration: 0.45 }}
                                className="flex items-start gap-3 text-[13.5px] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                            >
                                <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-400/30 ring-1 ring-emerald-300/50 shrink-0 backdrop-blur">
                                    <Check className="w-3 h-3 text-emerald-200" strokeWidth={3} />
                                </span>
                                <span>{h.text}</span>
                            </motion.li>
                        ))}
                    </ul>
                </div>

                {/* ─── Bottom: owner pill + reactive caption ─── */}
                <div className="relative z-10 flex items-center gap-3 flex-wrap">
                    <a
                        href={OWNER_WA_CONTACT_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/15 hover:bg-white/15 hover:ring-emerald-300/40 text-[11px] font-semibold text-white/90 transition"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Powered by {OWNER_NAME}
                        <span className="text-white/30">·</span>
                        <span className="font-mono text-white/70">+{OWNER_WA_NUMBER}</span>
                    </a>
                    <AnimatePresence>
                        {focused && (
                            <motion.div
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6 }}
                                className="text-[11px] text-cyan-100/90 font-medium italic backdrop-blur bg-white/5 px-2.5 py-1 rounded-full ring-1 ring-white/10"
                            >
                                {isEmail ? '👀 reading your email…' : '🙈 not peeking at your password!'}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </aside>

            {/* ═════════════ RIGHT — Form panel ═════════════ */}
            <main className="relative flex flex-col justify-center items-center px-6 py-12 lg:px-12 xl:px-16 bg-white">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background:
                            'radial-gradient(600px 500px at 100% 0%, rgba(6,182,212,0.07), transparent 60%),' +
                            'radial-gradient(500px 400px at 0% 100%, rgba(236,72,153,0.06), transparent 60%)',
                    }}
                />

                {/* Mobile brand mark + tiny video preview */}
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative w-full max-w-[400px]"
                >
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-[0_10px_28px_-8px_rgba(168,85,247,0.5)] mb-5">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-[28px] font-bold tracking-tight text-slate-900 leading-tight">
                            Welcome back
                        </h2>
                        <p className="text-[13.5px] text-slate-500 mt-1.5">
                            Sign in to access your dashboard.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* EMAIL — cyan glow when focused (matches video) */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-2 uppercase tracking-wider">
                                Email
                            </label>
                            <motion.div
                                animate={isEmail ? {
                                    boxShadow: [
                                        '0 0 0 0 rgba(6,182,212,0.0)',
                                        '0 0 0 6px rgba(6,182,212,0.18)',
                                        '0 0 30px 4px rgba(6,182,212,0.35)',
                                        '0 0 0 6px rgba(6,182,212,0.18)',
                                    ],
                                } : { boxShadow: '0 0 0 0 rgba(6,182,212,0)' }}
                                transition={isEmail
                                    ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                                    : { duration: 0.3 }}
                                className="rounded-xl"
                            >
                                <div className="relative group">
                                    <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isEmail ? 'text-cyan-500' : 'text-slate-400'}`} />
                                    <input
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onFocus={() => setFocused('email')}
                                        onBlur={() => setFocused((f) => (f === 'email' ? null : f))}
                                        className={`w-full pl-11 pr-3 py-3.5 rounded-xl border bg-white outline-none text-sm transition placeholder:text-slate-400
                                            ${isEmail ? 'border-cyan-500 ring-4 ring-cyan-100' : 'border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100'}`}
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </motion.div>
                        </div>

                        {/* PASSWORD — magenta glow when focused */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-2 uppercase tracking-wider">
                                Password
                            </label>
                            <motion.div
                                animate={isPw ? {
                                    boxShadow: [
                                        '0 0 0 0 rgba(236,72,153,0.0)',
                                        '0 0 0 6px rgba(236,72,153,0.18)',
                                        '0 0 30px 4px rgba(236,72,153,0.35)',
                                        '0 0 0 6px rgba(236,72,153,0.18)',
                                    ],
                                } : { boxShadow: '0 0 0 0 rgba(236,72,153,0)' }}
                                transition={isPw
                                    ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                                    : { duration: 0.3 }}
                                className="rounded-xl"
                            >
                                <div className="relative group">
                                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isPw ? 'text-fuchsia-500' : 'text-slate-400'}`} />
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setFocused('password')}
                                        onBlur={() => setFocused((f) => (f === 'password' ? null : f))}
                                        className={`w-full pl-11 pr-16 py-3.5 rounded-xl border bg-white outline-none text-sm transition placeholder:text-slate-400
                                            ${isPw ? 'border-fuchsia-500 ring-4 ring-fuchsia-100' : 'border-slate-200 focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-100'}`}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw((s) => !s)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-fuchsia-600 px-3 py-1.5 rounded-md hover:bg-slate-100 transition"
                                    >
                                        {showPw ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </motion.div>
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

                        {/* Sign in — pulsing cyan→violet→pink gradient like video */}
                        <motion.button
                            type="submit"
                            disabled={submitting}
                            whileHover={{ y: -1 }}
                            whileTap={{ y: 0 }}
                            animate={{
                                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                            }}
                            transition={{
                                backgroundPosition: { duration: 4, repeat: Infinity, ease: 'linear' },
                            }}
                            style={{
                                backgroundImage:
                                    'linear-gradient(90deg, #06b6d4 0%, #6366f1 25%, #a855f7 50%, #ec4899 75%, #06b6d4 100%)',
                                backgroundSize: '200% 100%',
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm shadow-[0_10px_28px_-8px_rgba(168,85,247,0.55)] hover:shadow-[0_15px_38px_-10px_rgba(236,72,153,0.6)] disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
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

                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                            No account?
                        </span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    <motion.a
                        href={OWNER_WA_DEMO_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -2 }}
                        className="block bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 ring-1 ring-emerald-200 hover:ring-emerald-400 transition-all group"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shrink-0">
                                <Gift className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-bold text-slate-900">
                                    Get a free demo
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5">
                                    WhatsApp Emad — full trial within minutes.
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs shrink-0">
                                <MessageCircle className="w-3.5 h-3.5" />
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>
                    </motion.a>

                    <div className="mt-10 text-center text-[11px] text-slate-400">
                        © {new Date().getFullYear()} {OWNER_NAME}. All rights reserved.
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
