// frontend/src/components/LoginPage.tsx
// Cyber-dark login matching the AI video reference: full-page navy/violet bg,
// circuit grid, animated glow orbs, robot art on left, glassy neon form on right.
import { useEffect, useState, type FormEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
    Eye, Lock, Mail, Loader2, ShieldCheck, Sparkles,
    MessageCircle, ArrowRight, Gift,
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

type Focus = 'email' | 'password' | null;

// Animated circuit grid SVG pattern — repeats across background.
function CircuitGrid() {
    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.18]"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <pattern id="circuit" width="120" height="120" patternUnits="userSpaceOnUse">
                    {/* base grid */}
                    <path
                        d="M 0 60 H 120 M 60 0 V 120"
                        stroke="rgba(167,139,250,0.35)"
                        strokeWidth="0.6"
                        fill="none"
                    />
                    {/* node dots */}
                    <circle cx="60" cy="60" r="2" fill="#a78bfa" />
                    <circle cx="0" cy="0" r="1.5" fill="#22d3ee" />
                    <circle cx="120" cy="0" r="1.5" fill="#22d3ee" />
                    <circle cx="0" cy="120" r="1.5" fill="#22d3ee" />
                    {/* L-shapes (circuit traces) */}
                    <path
                        d="M 60 60 H 100 V 100"
                        stroke="rgba(34,211,238,0.5)"
                        strokeWidth="0.8"
                        fill="none"
                    />
                    <path
                        d="M 60 60 V 30 H 30"
                        stroke="rgba(236,72,153,0.4)"
                        strokeWidth="0.8"
                        fill="none"
                    />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#circuit)" />
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

    // Subtle mouse parallax for robot.
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const smx = useSpring(mx, { stiffness: 40, damping: 22, mass: 1 });
    const smy = useSpring(my, { stiffness: 40, damping: 22, mass: 1 });
    const robotX = useTransform(smx, [-1, 1], [-14, 14]);
    const robotY = useTransform(smy, [-1, 1], [-8, 8]);

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
                    'radial-gradient(1200px 800px at 20% 30%, #2a1364 0%, transparent 60%),' +
                    'radial-gradient(1000px 700px at 85% 75%, #4c1d95 0%, transparent 55%),' +
                    'radial-gradient(800px 600px at 50% 100%, #831843 0%, transparent 60%),' +
                    'linear-gradient(135deg, #0a0820 0%, #14092e 50%, #1a0a3a 100%)',
            }}
        >
            {/* ─── Background layer 1: circuit grid ─── */}
            <CircuitGrid />

            {/* ─── Background layer 2: animated glow orbs ─── */}
            <motion.div
                className="absolute top-[10%] left-[5%] w-[420px] h-[420px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(124,58,237,0.45) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                }}
                animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute bottom-[10%] right-[10%] w-[480px] h-[480px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(236,72,153,0.35) 0%, transparent 70%)',
                    filter: 'blur(70px)',
                }}
                animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
                transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute top-[40%] left-[35%] w-[360px] h-[360px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(34,211,238,0.30) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                }}
                animate={{ x: [0, 30, 0], y: [0, 30, 0] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* ─── Robot art — left half, parallax + zoom on focus ─── */}
            <motion.div
                className="absolute inset-y-0 left-0 w-[55%] z-[1] hidden md:block pointer-events-none"
                style={{ x: robotX, y: robotY }}
                animate={{ scale: focused ? 1.08 : 1 }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            >
                <img
                    src="/roobot.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover object-[35%_center] scale-105"
                    style={{
                        filter: 'saturate(1.15) contrast(1.08) hue-rotate(-8deg) brightness(0.95)',
                        maskImage:
                            'linear-gradient(90deg, #000 55%, rgba(0,0,0,0.7) 78%, transparent 100%)',
                        WebkitMaskImage:
                            'linear-gradient(90deg, #000 55%, rgba(0,0,0,0.7) 78%, transparent 100%)',
                    }}
                />
                {/* Violet tint to push robot into palette */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(135deg, rgba(76,29,149,0.35) 0%, rgba(168,85,247,0.20) 50%, transparent 100%)',
                        mixBlendMode: 'multiply',
                    }}
                />
                {/* Cyan circuit highlight on robot face (mimics video) */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(420px 380px at 45% 35%, rgba(34,211,238,0.20), transparent 65%)',
                        mixBlendMode: 'screen',
                    }}
                />
            </motion.div>

            {/* ─── Focus colour wash on robot area ─── */}
            <motion.div
                className="absolute inset-y-0 left-0 w-[55%] z-[1] pointer-events-none hidden md:block"
                animate={{
                    background: isEmail
                        ? 'radial-gradient(600px 500px at 60% 50%, rgba(34,211,238,0.30), transparent 60%)'
                        : isPw
                            ? 'radial-gradient(600px 500px at 60% 50%, rgba(236,72,153,0.30), transparent 60%)'
                            : 'radial-gradient(600px 500px at 60% 50%, rgba(0,0,0,0), transparent 60%)',
                }}
                transition={{ duration: 0.5 }}
                style={{ mixBlendMode: 'screen' }}
            />

            {/* ═════════════ Content ═════════════ */}
            <div className="relative z-10 min-h-screen flex flex-col">
                {/* Top bar: brand */}
                <header className="px-6 md:px-10 lg:px-14 pt-7 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(168,85,247,0.7)]">
                                <Eye className="w-5 h-5 text-white" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#14092e] animate-pulse" />
                        </div>
                        <div>
                            <div className="text-[15px] font-bold tracking-tight text-white">
                                AI Visibility Tracker
                            </div>
                            <div className="text-[11px] text-indigo-200/80 font-medium">
                                Win the AI search era
                            </div>
                        </div>
                    </div>

                    <a
                        href={OWNER_WA_CONTACT_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 backdrop-blur ring-1 ring-white/10 hover:bg-white/10 hover:ring-emerald-300/40 text-[11px] font-semibold text-white/90 transition"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Powered by {OWNER_NAME}
                        <span className="text-white/30">·</span>
                        <span className="font-mono text-white/70">+{OWNER_WA_NUMBER}</span>
                    </a>
                </header>

                {/* Main: hero left, form right (form-only on mobile) */}
                <div className="flex-1 grid lg:grid-cols-[1.05fr_1fr] gap-8 px-6 md:px-10 lg:px-14 py-10 lg:py-16 items-center">
                    {/* HERO copy — dims & shrinks slightly when form is focused (zoom-in feel) */}
                    <motion.div
                        className="hidden lg:block max-w-xl"
                        animate={{ opacity: focused ? 0.35 : 1, scale: focused ? 0.96 : 1, x: focused ? -10 : 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 backdrop-blur ring-1 ring-white/15 text-[11px] font-semibold text-cyan-100 mb-7"
                        >
                            <Sparkles className="w-3 h-3" />
                            Built for B2B SaaS that want to rank in AI
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                            className="text-[44px] xl:text-[58px] font-bold tracking-tight leading-[1.04] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
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
                            className="mt-6 text-[15px] text-indigo-100/85 leading-relaxed max-w-md drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                        >
                            Audit your brand's presence in AI answers, benchmark competitors,
                            and follow playbooks that actually move the needle.
                        </motion.p>
                    </motion.div>

                    {/* FORM — glassy dark cyber card, zooms in on focus */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: focused ? 1.04 : 1,
                        }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full max-w-[440px] mx-auto lg:ml-auto lg:mr-0"
                    >
                        {/* Gradient border wrapper — animates intensity on focus */}
                        <motion.div
                            className="rounded-3xl p-[1.5px]"
                            animate={{
                                background: isEmail
                                    ? 'linear-gradient(135deg, rgba(34,211,238,0.95), rgba(99,102,241,0.7) 50%, rgba(168,85,247,0.6))'
                                    : isPw
                                        ? 'linear-gradient(135deg, rgba(168,85,247,0.7), rgba(236,72,153,0.95) 50%, rgba(244,63,94,0.7))'
                                        : 'linear-gradient(135deg, rgba(34,211,238,0.6), rgba(168,85,247,0.5) 50%, rgba(236,72,153,0.5))',
                            }}
                            transition={{ duration: 0.4 }}
                        >
                            <div
                                className="rounded-3xl p-8 md:p-9 backdrop-blur-2xl"
                                style={{
                                    background:
                                        'linear-gradient(135deg, rgba(40,15,75,0.85) 0%, rgba(58,20,90,0.75) 50%, rgba(75,20,80,0.75) 100%)',
                                    boxShadow:
                                        '0 30px 80px -20px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
                                }}
                            >
                                {/* Heading */}
                                <div className="mb-7">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-fuchsia-500 to-pink-500 shadow-[0_10px_30px_-8px_rgba(168,85,247,0.7)] mb-5">
                                        <ShieldCheck className="w-5 h-5 text-white" />
                                    </div>
                                    <h2 className="text-[26px] font-bold tracking-tight text-white leading-tight">
                                        Welcome back
                                    </h2>
                                    <p className="text-[13px] text-indigo-200/70 mt-1.5">
                                        Sign in to access your dashboard.
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {/* EMAIL */}
                                    <div>
                                        <label className="block text-[10.5px] font-bold text-indigo-200/90 mb-2 uppercase tracking-[0.15em]">
                                            Email
                                        </label>
                                        <motion.div
                                            animate={isEmail ? {
                                                boxShadow: [
                                                    '0 0 0 0 rgba(34,211,238,0.0)',
                                                    '0 0 0 4px rgba(34,211,238,0.20)',
                                                    '0 0 28px 2px rgba(34,211,238,0.45)',
                                                    '0 0 0 4px rgba(34,211,238,0.20)',
                                                ],
                                            } : { boxShadow: '0 0 0 0 rgba(34,211,238,0)' }}
                                            transition={isEmail
                                                ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                                                : { duration: 0.3 }}
                                            className="rounded-xl"
                                        >
                                            <div className="relative group">
                                                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isEmail ? 'text-cyan-300' : 'text-indigo-300/60'}`} />
                                                <input
                                                    type="email"
                                                    autoComplete="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    onFocus={() => setFocused('email')}
                                                    onBlur={() => setFocused((f) => (f === 'email' ? null : f))}
                                                    className={`w-full pl-11 pr-3 py-3.5 rounded-xl border bg-white/[0.04] text-white outline-none text-sm transition placeholder:text-indigo-300/40
                                                        ${isEmail ? 'border-cyan-400/70' : 'border-white/10 focus:border-cyan-400/70'}`}
                                                    placeholder="you@example.com"
                                                />
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* PASSWORD */}
                                    <div>
                                        <label className="block text-[10.5px] font-bold text-indigo-200/90 mb-2 uppercase tracking-[0.15em]">
                                            Password
                                        </label>
                                        <motion.div
                                            animate={isPw ? {
                                                boxShadow: [
                                                    '0 0 0 0 rgba(236,72,153,0.0)',
                                                    '0 0 0 4px rgba(236,72,153,0.20)',
                                                    '0 0 28px 2px rgba(236,72,153,0.45)',
                                                    '0 0 0 4px rgba(236,72,153,0.20)',
                                                ],
                                            } : { boxShadow: '0 0 0 0 rgba(236,72,153,0)' }}
                                            transition={isPw
                                                ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                                                : { duration: 0.3 }}
                                            className="rounded-xl"
                                        >
                                            <div className="relative group">
                                                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isPw ? 'text-fuchsia-300' : 'text-indigo-300/60'}`} />
                                                <input
                                                    type={showPw ? 'text' : 'password'}
                                                    autoComplete="current-password"
                                                    required
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    onFocus={() => setFocused('password')}
                                                    onBlur={() => setFocused((f) => (f === 'password' ? null : f))}
                                                    className={`w-full pl-11 pr-16 py-3.5 rounded-xl border bg-white/[0.04] text-white outline-none text-sm transition placeholder:text-indigo-300/40
                                                        ${isPw ? 'border-fuchsia-400/70' : 'border-white/10 focus:border-fuchsia-400/70'}`}
                                                    placeholder="••••••••"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPw((s) => !s)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-indigo-200/80 hover:text-fuchsia-200 px-3 py-1.5 rounded-md hover:bg-white/5 transition"
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

                                    {/* SIGN-IN button — animated cyber gradient */}
                                    <motion.button
                                        type="submit"
                                        disabled={submitting}
                                        whileHover={{ y: -1 }}
                                        whileTap={{ y: 0 }}
                                        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                                        transition={{
                                            backgroundPosition: { duration: 4, repeat: Infinity, ease: 'linear' },
                                        }}
                                        style={{
                                            backgroundImage:
                                                'linear-gradient(90deg, #22d3ee 0%, #6366f1 25%, #a855f7 50%, #ec4899 75%, #22d3ee 100%)',
                                            backgroundSize: '200% 100%',
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm shadow-[0_15px_38px_-10px_rgba(168,85,247,0.7)] hover:shadow-[0_20px_48px_-10px_rgba(236,72,153,0.7)] disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
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

                                {/* Divider */}
                                <div className="flex items-center gap-3 my-6">
                                    <div className="flex-1 h-px bg-white/10" />
                                    <span className="text-[10px] uppercase tracking-[0.15em] text-indigo-200/60 font-semibold">
                                        No account?
                                    </span>
                                    <div className="flex-1 h-px bg-white/10" />
                                </div>

                                {/* Demo CTA */}
                                <motion.a
                                    href={OWNER_WA_DEMO_LINK}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ y: -2 }}
                                    className="block rounded-2xl p-4 ring-1 ring-emerald-400/30 hover:ring-emerald-300/60 transition-all group"
                                    style={{
                                        background:
                                            'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(20,184,166,0.10) 100%)',
                                    }}
                                >
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(16,185,129,0.6)] shrink-0">
                                            <Gift className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[13px] font-bold text-white">
                                                Get a free demo
                                            </div>
                                            <div className="text-[11px] text-emerald-200/80 mt-0.5">
                                                WhatsApp Emad — full trial within minutes.
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-emerald-300 font-semibold text-xs shrink-0">
                                            <MessageCircle className="w-3.5 h-3.5" />
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </motion.a>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>

                {/* Footer */}
                <footer className="relative z-10 pb-5 pt-2 text-center text-[11px] text-indigo-300/50">
                    © {new Date().getFullYear()} {OWNER_NAME}. All rights reserved.
                </footer>
            </div>
        </div>
    );
}
