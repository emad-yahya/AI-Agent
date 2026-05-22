// frontend/src/components/LoginPage.tsx
// Pixel match to the user's reference screenshot:
// dark cyber bg + circuit grid behind form + robot as centerpiece (no heavy mask)
// + hero copy left + lightweight glassy form right.
import { useEffect, useState, type FormEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
    Lock, Mail, Loader2, MessageCircle, BarChart3, Target, Zap, Sparkles,
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
    { icon: BarChart3, color: 'from-violet-500 to-indigo-600',  text: 'Track brand mentions across ChatGPT, Gemini & Perplexity' },
    { icon: Target,    color: 'from-fuchsia-500 to-purple-600', text: 'Benchmark competitors — schemas, content gaps, SERP slots' },
    { icon: Zap,       color: 'from-amber-400 to-pink-500',     text: 'One-click Master scan: AI engines + 6 Google modules' },
];

type Focus = 'email' | 'password' | null;

// Circuit / network grid SVG — sits behind the form on the right side.
function CircuitGrid() {
    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <pattern id="circuit-grid" width="140" height="140" patternUnits="userSpaceOnUse">
                    <path
                        d="M 0 70 H 140 M 70 0 V 140"
                        stroke="rgba(124,58,237,0.35)"
                        strokeWidth="0.7"
                        fill="none"
                    />
                    <path
                        d="M 70 70 H 110 V 110 H 140"
                        stroke="rgba(34,211,238,0.45)"
                        strokeWidth="0.9"
                        fill="none"
                    />
                    <path
                        d="M 70 70 V 30 H 30 V 0"
                        stroke="rgba(168,85,247,0.4)"
                        strokeWidth="0.9"
                        fill="none"
                    />
                    <circle cx="70" cy="70" r="2.2" fill="#a78bfa" />
                    <circle cx="110" cy="110" r="1.6" fill="#22d3ee" />
                    <circle cx="30" cy="30" r="1.6" fill="#a855f7" />
                    <circle cx="0" cy="0" r="1.2" fill="#22d3ee" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#circuit-grid)" />
        </svg>
    );
}

export function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [focused, setFocused] = useState<Focus>(null);

    // Subtle mouse parallax for the robot.
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const smx = useSpring(mx, { stiffness: 35, damping: 22, mass: 1 });
    const smy = useSpring(my, { stiffness: 35, damping: 22, mass: 1 });
    const robotX = useTransform(smx, [-1, 1], [-12, 12]);
    const robotY = useTransform(smy, [-1, 1], [-6, 6]);

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
        <div
            className="min-h-screen w-full relative overflow-hidden text-white"
            style={{
                background:
                    'radial-gradient(1100px 750px at 70% 40%, #3b1670 0%, transparent 60%),' +
                    'radial-gradient(900px 700px at 20% 80%, #4a1e6b 0%, transparent 55%),' +
                    'linear-gradient(135deg, #1a0c3a 0%, #261245 50%, #2e0f4c 100%)',
            }}
        >
            {/* ─── Circuit grid (right-half emphasis) ─── */}
            <div className="absolute inset-y-0 right-0 w-[60%] z-0">
                <CircuitGrid />
            </div>

            {/* ─── Ambient drifting orbs ─── */}
            <motion.div
                className="absolute top-[8%] right-[5%] w-[360px] h-[360px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(34,211,238,0.20) 0%, transparent 70%)',
                    filter: 'blur(70px)',
                }}
                animate={{ x: [0, -30, 0], y: [0, 25, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute bottom-[8%] left-[15%] w-[420px] h-[420px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(168,85,247,0.30) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                }}
                animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
                transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* ─── ROBOT — full background image ─── */}
            <motion.div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{ x: robotX, y: robotY }}
                animate={{ scale: focused ? 1.04 : 1 }}
                transition={{ type: 'spring', stiffness: 80, damping: 22 }}
            >
                <img
                    src="/robot-1.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="w-full h-full object-cover object-center"
                    style={{
                        filter: 'saturate(1.08) contrast(1.04)',
                    }}
                />
                {/* Edge vignette: dark on left + right for hero/form legibility, robot stays bright in center */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(90deg, rgba(15,8,40,0.78) 0%, rgba(20,10,55,0.30) 22%, rgba(20,10,55,0) 45%, rgba(20,10,55,0) 60%, rgba(20,10,55,0.45) 82%, rgba(15,8,40,0.80) 100%)',
                    }}
                />
            </motion.div>

            {/* ─── Focus colour halo behind robot ─── */}
            <motion.div
                className="absolute inset-y-0 left-[20%] right-[30%] z-0 pointer-events-none hidden md:block"
                animate={{
                    background: isEmail
                        ? 'radial-gradient(500px 500px at 50% 45%, rgba(34,211,238,0.25), transparent 65%)'
                        : isPw
                            ? 'radial-gradient(500px 500px at 50% 45%, rgba(236,72,153,0.28), transparent 65%)'
                            : 'radial-gradient(500px 500px at 50% 45%, rgba(0,0,0,0), transparent 65%)',
                }}
                transition={{ duration: 0.5 }}
                style={{ mixBlendMode: 'screen' }}
            />

            {/* ═════════════ Content ═════════════ */}
            <div className="relative z-10 min-h-screen flex flex-col">
                {/* ─── Top brand ─── */}
                <header className="px-8 md:px-12 lg:px-16 pt-8 flex items-center gap-3 shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(168,85,247,0.7)] text-white font-bold text-[11px] tracking-tight">
                        SaaS
                    </div>
                    <div className="text-[16px] font-bold text-white tracking-tight">
                        AI Visibility Tracker
                    </div>
                </header>

                {/* ─── Main grid ─── */}
                <div className="flex-1 grid lg:grid-cols-[1fr_1fr] gap-8 px-8 md:px-12 lg:px-16 py-10 items-center relative">
                    {/* LEFT: hero copy */}
                    <motion.div
                        className="relative z-10 max-w-xl"
                        animate={{ opacity: focused ? 0.4 : 1, x: focused ? -8 : 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <motion.h1
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="text-[56px] xl:text-[72px] font-bold tracking-tight leading-[1.02] text-white"
                            style={{ textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}
                        >
                            Reach{' '}
                            <span className="text-amber-300">#1</span>
                            {' '}in
                            <br />
                            ChatGPT,
                            <br />
                            Gemini & Google.
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.5 }}
                            className="mt-6 text-[16px] text-indigo-100/85 leading-relaxed max-w-md"
                        >
                            Audit your brand's presence in AI answers, compare against
                            competitors, and follow playbooks that actually move the needle.
                        </motion.p>

                        <ul className="mt-8 space-y-4">
                            {HIGHLIGHTS.map((h, i) => (
                                <motion.li
                                    key={i}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.25 + i * 0.08, duration: 0.45 }}
                                    className="flex items-start gap-3.5 text-[14px] text-white/95"
                                >
                                    <span className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${h.color} shadow-[0_6px_16px_-4px_rgba(0,0,0,0.5)]`}>
                                        <h.icon className="w-3.5 h-3.5 text-white" />
                                    </span>
                                    <span>{h.text}</span>
                                </motion.li>
                            ))}
                        </ul>

                        {/* Owner pill bottom-left */}
                        <a
                            href={OWNER_WA_CONTACT_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-10 inline-flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/[0.06] backdrop-blur ring-1 ring-white/10 hover:bg-white/[0.10] hover:ring-emerald-300/40 text-[12px] font-medium text-white/85 transition"
                        >
                            <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[10px] font-bold text-white">
                                E
                                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#1a0c3a]" />
                            </span>
                            <span>Powered by {OWNER_NAME}</span>
                            <span className="text-white/30">·</span>
                            <span className="font-mono text-white/65">+{OWNER_WA_NUMBER}</span>
                        </a>
                    </motion.div>

                    {/* RIGHT: form card (lightweight, glassy) */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: focused ? 1.03 : 1,
                        }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="relative z-10 w-full max-w-[440px] mx-auto lg:ml-auto lg:mr-0"
                    >
                        <motion.div
                            className="rounded-3xl p-7 md:p-8 backdrop-blur-2xl ring-1"
                            animate={{
                                background: 'rgba(20,10,45,0.55)',
                                boxShadow: isEmail
                                    ? '0 30px 80px -20px rgba(34,211,238,0.35), inset 0 1px 0 rgba(255,255,255,0.06)'
                                    : isPw
                                        ? '0 30px 80px -20px rgba(236,72,153,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
                                        : '0 30px 80px -20px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
                            }}
                            style={{
                                // @ts-expect-error -- CSS custom prop OK
                                '--tw-ring-color': 'rgba(255,255,255,0.08)',
                            }}
                            transition={{ duration: 0.4 }}
                        >
                            {/* Heading */}
                            <h2 className="text-[34px] font-bold tracking-tight text-white leading-tight">
                                Welcome back
                            </h2>
                            <p className="text-[13px] text-indigo-200/65 mt-1.5 mb-7">
                                Sign in to access your dashboard.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* EMAIL */}
                                <div>
                                    <label className="block text-[10.5px] font-bold text-indigo-200/85 mb-2 uppercase tracking-[0.18em]">
                                        Email
                                    </label>
                                    <motion.div
                                        animate={isEmail ? {
                                            boxShadow: [
                                                '0 0 0 0 rgba(34,211,238,0.0)',
                                                '0 0 0 3px rgba(34,211,238,0.20)',
                                                '0 0 24px 1px rgba(34,211,238,0.40)',
                                                '0 0 0 3px rgba(34,211,238,0.20)',
                                            ],
                                        } : { boxShadow: '0 0 0 0 rgba(34,211,238,0)' }}
                                        transition={isEmail
                                            ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                                            : { duration: 0.3 }}
                                        className="rounded-xl"
                                    >
                                        <div className="relative">
                                            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isEmail ? 'text-cyan-300' : 'text-indigo-300/50'}`} />
                                            <input
                                                type="email"
                                                autoComplete="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                onFocus={() => setFocused('email')}
                                                onBlur={() => setFocused((f) => (f === 'email' ? null : f))}
                                                className={`w-full pl-11 pr-3 py-3.5 rounded-xl border bg-white/[0.04] text-white outline-none text-sm transition placeholder:text-indigo-300/40
                                                    ${isEmail ? 'border-cyan-400/60' : 'border-white/10 focus:border-cyan-400/60'}`}
                                                placeholder="you@example.com"
                                            />
                                        </div>
                                    </motion.div>
                                </div>

                                {/* PASSWORD */}
                                <div>
                                    <label className="block text-[10.5px] font-bold text-indigo-200/85 mb-2 uppercase tracking-[0.18em]">
                                        Password
                                    </label>
                                    <motion.div
                                        animate={isPw ? {
                                            boxShadow: [
                                                '0 0 0 0 rgba(236,72,153,0.0)',
                                                '0 0 0 3px rgba(236,72,153,0.20)',
                                                '0 0 24px 1px rgba(236,72,153,0.40)',
                                                '0 0 0 3px rgba(236,72,153,0.20)',
                                            ],
                                        } : { boxShadow: '0 0 0 0 rgba(236,72,153,0)' }}
                                        transition={isPw
                                            ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                                            : { duration: 0.3 }}
                                        className="rounded-xl"
                                    >
                                        <div className="relative">
                                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isPw ? 'text-fuchsia-300' : 'text-indigo-300/50'}`} />
                                            <input
                                                type={showPw ? 'text' : 'password'}
                                                autoComplete="current-password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                onFocus={() => setFocused('password')}
                                                onBlur={() => setFocused((f) => (f === 'password' ? null : f))}
                                                className={`w-full pl-11 pr-16 py-3.5 rounded-xl border bg-white/[0.04] text-white outline-none text-sm transition placeholder:text-indigo-300/40
                                                    ${isPw ? 'border-fuchsia-400/60' : 'border-white/10 focus:border-fuchsia-400/60'}`}
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPw((s) => !s)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-indigo-200/75 hover:text-fuchsia-200 px-3 py-1.5 rounded-md hover:bg-white/5 transition"
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
                                        className="text-xs text-red-200 bg-red-500/10 border border-red-400/30 rounded-lg px-3.5 py-3 flex items-start gap-2"
                                    >
                                        <span className="mt-0.5">⚠</span>
                                        <span>{error}</span>
                                    </motion.div>
                                )}

                                {/* SIGN IN */}
                                <motion.button
                                    type="submit"
                                    disabled={submitting}
                                    whileHover={{ y: -1 }}
                                    whileTap={{ y: 0 }}
                                    animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                                    transition={{
                                        backgroundPosition: { duration: 5, repeat: Infinity, ease: 'linear' },
                                    }}
                                    style={{
                                        backgroundImage:
                                            'linear-gradient(90deg, #6366f1 0%, #a855f7 40%, #ec4899 70%, #6366f1 100%)',
                                        backgroundSize: '200% 100%',
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-[15px] shadow-[0_15px_40px_-12px_rgba(168,85,247,0.7)] hover:shadow-[0_20px_50px_-12px_rgba(236,72,153,0.7)] disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Signing in…
                                        </>
                                    ) : (
                                        'Sign in'
                                    )}
                                </motion.button>
                            </form>

                            {/* Demo CTA */}
                            <motion.a
                                href={OWNER_WA_DEMO_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ y: -2 }}
                                className="mt-5 flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ring-white/10 hover:ring-emerald-300/40 transition-all group"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                            >
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(16,185,129,0.6)] shrink-0">
                                    <MessageCircle className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13.5px] font-bold text-white leading-tight">
                                        Get a free demo.
                                    </div>
                                    <div className="text-[11.5px] text-indigo-200/70 mt-0.5">
                                        WhatsApp Emad — full trial within minutes.
                                    </div>
                                </div>
                                <MessageCircle className="w-4 h-4 text-emerald-300/80 shrink-0 group-hover:scale-110 transition-transform" />
                            </motion.a>
                        </motion.div>
                    </motion.div>
                </div>

                {/* ─── Footer ─── */}
                <footer className="relative z-10 px-8 md:px-12 lg:px-16 pb-5 flex items-center justify-end gap-2 text-[11.5px] text-indigo-300/55">
                    <span>© {new Date().getFullYear()} {OWNER_NAME}. All rights reserved.</span>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-300/60" />
                </footer>
            </div>
        </div>
    );
}
