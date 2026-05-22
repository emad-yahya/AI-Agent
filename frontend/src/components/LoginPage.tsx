// frontend/src/components/LoginPage.tsx
// Pixel-match reference + UI/UX Pro Max polish:
//   - Hero copy tightened (no awkward wraps, doesn't smother robot face)
//   - Animated #1 (gradient + glow pulse), staggered entrance
//   - Circuit "data flow" overlay (animated dashes along grid lines)
//   - Brain halo that recolours on focus (cyan email / pink password)
//   - Remember me / Forgot password / proper focus rings / a11y motion guard
//   - Loading shimmer on button + ArrowRight CTA chevron
import { useEffect, useState, type FormEvent } from 'react';
import {
    motion,
    useMotionValue,
    useSpring,
    useTransform,
    useReducedMotion,
} from 'framer-motion';
import {
    Lock, Mail, Loader2, MessageCircle, BarChart3, Target, Zap, Sparkles, ArrowRight,
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

// Animated "data flow" lines on top of the image's static circuit grid.
function CircuitOverlay({ reducedMotion }: { reducedMotion: boolean }) {
    const paths = [
        { d: 'M 0 120 L 280 120 L 360 60 L 720 60',  color: 'rgba(34,211,238,0.55)',  delay: 0 },
        { d: 'M 0 360 L 200 360 L 280 440 L 700 440', color: 'rgba(168,85,247,0.55)', delay: 0.6 },
        { d: 'M 1440 200 L 1180 200 L 1100 280 L 820 280', color: 'rgba(236,72,153,0.45)', delay: 1.2 },
        { d: 'M 1440 540 L 1240 540 L 1160 620 L 880 620', color: 'rgba(34,211,238,0.40)', delay: 1.8 },
    ];
    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen"
            viewBox="0 0 1440 800"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
        >
            {paths.map((p, i) => (
                <motion.path
                    key={i}
                    d={p.d}
                    stroke={p.color}
                    strokeWidth="1.4"
                    fill="none"
                    strokeDasharray="8 14"
                    initial={{ strokeDashoffset: 0, opacity: 0.6 }}
                    animate={reducedMotion ? {} : { strokeDashoffset: [-0, -220] }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: 'linear',
                        delay: p.delay,
                    }}
                />
            ))}
        </svg>
    );
}

export function LoginPage() {
    const { login } = useAuth();
    const prefersReducedMotion = !!useReducedMotion();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [remember, setRemember] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [focused, setFocused] = useState<Focus>(null);

    // Mouse parallax for the robot (stronger range, smooth spring).
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const smx = useSpring(mx, { stiffness: 35, damping: 22, mass: 1 });
    const smy = useSpring(my, { stiffness: 35, damping: 22, mass: 1 });
    const robotX = useTransform(smx, [-1, 1], [-22, 22]);
    const robotY = useTransform(smy, [-1, 1], [-12, 12]);

    useEffect(() => {
        if (prefersReducedMotion) return;
        function onMove(e: MouseEvent) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            mx.set((e.clientX - cx) / cx);
            my.set((e.clientY - cy) / cy);
        }
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, [mx, my, prefersReducedMotion]);

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

    // Stagger schedule — keep it tight (UI UX skill: 150-300ms micro-interactions).
    const stagger = (i: number) => ({
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as const },
    });

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
                    style={{ filter: 'saturate(1.08) contrast(1.04)' }}
                />
                {/* Edge vignette — dark at sides for legibility, robot stays bright centre. */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(90deg, rgba(15,8,40,0.82) 0%, rgba(20,10,55,0.35) 22%, rgba(20,10,55,0) 45%, rgba(20,10,55,0) 58%, rgba(20,10,55,0.55) 80%, rgba(15,8,40,0.85) 100%)',
                    }}
                />
            </motion.div>

            {/* ─── Animated circuit data-flow overlay ─── */}
            <div className="absolute inset-0 z-[1] pointer-events-none">
                <CircuitOverlay reducedMotion={prefersReducedMotion} />
            </div>

            {/* ─── Focus-driven brain halo (cyan email / pink password) ─── */}
            <motion.div
                className="absolute inset-0 z-[1] pointer-events-none hidden md:block"
                animate={{
                    background: isEmail
                        ? 'radial-gradient(450px 450px at 50% 38%, rgba(34,211,238,0.32), transparent 65%)'
                        : isPw
                            ? 'radial-gradient(450px 450px at 50% 38%, rgba(236,72,153,0.34), transparent 65%)'
                            : 'radial-gradient(450px 450px at 50% 38%, rgba(0,0,0,0), transparent 65%)',
                }}
                transition={{ duration: 0.5 }}
                style={{ mixBlendMode: 'screen' }}
            />

            {/* ═════════════ Content ═════════════ */}
            <div className="relative z-10 min-h-screen flex flex-col">
                {/* ─── Top brand ─── */}
                <motion.header
                    {...stagger(0)}
                    className="px-8 md:px-12 lg:px-16 pt-8 flex items-center gap-3 shrink-0"
                >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(168,85,247,0.7)] text-white font-bold text-[11px] tracking-tight">
                        SaaS
                    </div>
                    <div className="text-[16px] font-bold text-white tracking-tight">
                        AI Visibility Tracker
                    </div>
                </motion.header>

                {/* ─── Main grid ─── */}
                <div className="flex-1 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 px-8 md:px-12 lg:px-16 py-10 items-center relative">
                    {/* LEFT: hero copy */}
                    <motion.div
                        className="relative z-10 max-w-[520px]"
                        animate={{ opacity: focused ? 0.45 : 0.96, x: focused ? -10 : 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <motion.h1
                            {...stagger(1)}
                            className="text-[44px] sm:text-[48px] xl:text-[56px] font-bold tracking-tight leading-[1.04] text-white"
                            style={{ textShadow: '0 4px 30px rgba(0,0,0,0.55)' }}
                        >
                            Reach{' '}
                            <motion.span
                                className="text-amber-300 inline-block"
                                animate={prefersReducedMotion ? {} : {
                                    filter: [
                                        'drop-shadow(0 0 0px rgba(252,211,77,0))',
                                        'drop-shadow(0 0 22px rgba(252,211,77,0.75))',
                                        'drop-shadow(0 0 0px rgba(252,211,77,0))',
                                    ],
                                }}
                                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                #1
                            </motion.span>
                            {' '}in
                            <br />
                            ChatGPT, Gemini
                            <br />
                            &amp; Google.
                        </motion.h1>

                        <motion.p
                            {...stagger(2)}
                            className="mt-5 text-[15.5px] text-indigo-100/85 leading-relaxed max-w-[440px]"
                        >
                            Audit your brand's presence in AI answers, compare against
                            competitors, and follow playbooks that actually move the needle.
                        </motion.p>

                        <ul className="mt-7 space-y-3.5">
                            {HIGHLIGHTS.map((h, i) => (
                                <motion.li
                                    key={i}
                                    {...stagger(3 + i)}
                                    className="flex items-start gap-3.5 text-[14px] text-white/95"
                                >
                                    <span className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${h.color} shadow-[0_6px_16px_-4px_rgba(0,0,0,0.5)]`}>
                                        <h.icon className="w-3.5 h-3.5 text-white" />
                                    </span>
                                    <span>{h.text}</span>
                                </motion.li>
                            ))}
                        </ul>

                        {/* Owner pill */}
                        <motion.a
                            {...stagger(7)}
                            href={OWNER_WA_CONTACT_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-8 inline-flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/[0.06] backdrop-blur ring-1 ring-white/10 hover:bg-white/[0.10] hover:ring-emerald-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 text-[12px] font-medium text-white/85 transition"
                        >
                            <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[10px] font-bold text-white">
                                E
                                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#1a0c3a]" />
                            </span>
                            <span>Powered by {OWNER_NAME}</span>
                            <span className="text-white/30">·</span>
                            <span className="font-mono text-white/65">+{OWNER_WA_NUMBER}</span>
                        </motion.a>
                    </motion.div>

                    {/* RIGHT: form card */}
                    <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: focused ? 1.025 : 1,
                        }}
                        transition={{ duration: 0.55, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="relative z-10 w-full max-w-[420px] mx-auto lg:ml-auto lg:mr-2"
                    >
                        <motion.div
                            className="rounded-3xl p-7 md:p-8 backdrop-blur-2xl ring-1 ring-white/10"
                            animate={{
                                background: 'rgba(20,10,45,0.55)',
                                boxShadow: isEmail
                                    ? '0 30px 80px -20px rgba(34,211,238,0.40), inset 0 1px 0 rgba(255,255,255,0.06)'
                                    : isPw
                                        ? '0 30px 80px -20px rgba(236,72,153,0.45), inset 0 1px 0 rgba(255,255,255,0.06)'
                                        : '0 30px 80px -20px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
                            }}
                            transition={{ duration: 0.4 }}
                        >
                            {/* Heading */}
                            <h2 className="text-[32px] font-bold tracking-tight text-white leading-tight">
                                Welcome back
                            </h2>
                            <p className="text-[13px] text-indigo-200/65 mt-1.5 mb-6">
                                Sign in to access your dashboard.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* EMAIL */}
                                <div>
                                    <label
                                        htmlFor="email"
                                        className="block text-[10.5px] font-bold text-indigo-200/85 mb-2 uppercase tracking-[0.18em]"
                                    >
                                        Email
                                    </label>
                                    <motion.div
                                        animate={isEmail && !prefersReducedMotion ? {
                                            boxShadow: [
                                                '0 0 0 0 rgba(34,211,238,0.0)',
                                                '0 0 0 3px rgba(34,211,238,0.20)',
                                                '0 0 24px 1px rgba(34,211,238,0.40)',
                                                '0 0 0 3px rgba(34,211,238,0.20)',
                                            ],
                                        } : { boxShadow: '0 0 0 0 rgba(34,211,238,0)' }}
                                        transition={isEmail && !prefersReducedMotion
                                            ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                                            : { duration: 0.3 }}
                                        className="rounded-xl"
                                    >
                                        <div className="relative">
                                            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isEmail ? 'text-cyan-300' : 'text-indigo-300/50'}`} />
                                            <input
                                                id="email"
                                                type="email"
                                                autoComplete="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                onFocus={() => setFocused('email')}
                                                onBlur={() => setFocused((f) => (f === 'email' ? null : f))}
                                                className={`w-full pl-11 pr-3 py-3.5 rounded-xl border bg-white/[0.04] text-white outline-none text-sm transition placeholder:text-indigo-300/40 focus-visible:ring-2 focus-visible:ring-cyan-400/60
                                                    ${isEmail ? 'border-cyan-400/60' : 'border-white/10'}`}
                                                placeholder="you@example.com"
                                            />
                                        </div>
                                    </motion.div>
                                </div>

                                {/* PASSWORD */}
                                <div>
                                    <label
                                        htmlFor="password"
                                        className="block text-[10.5px] font-bold text-indigo-200/85 mb-2 uppercase tracking-[0.18em]"
                                    >
                                        Password
                                    </label>
                                    <motion.div
                                        animate={isPw && !prefersReducedMotion ? {
                                            boxShadow: [
                                                '0 0 0 0 rgba(236,72,153,0.0)',
                                                '0 0 0 3px rgba(236,72,153,0.20)',
                                                '0 0 24px 1px rgba(236,72,153,0.40)',
                                                '0 0 0 3px rgba(236,72,153,0.20)',
                                            ],
                                        } : { boxShadow: '0 0 0 0 rgba(236,72,153,0)' }}
                                        transition={isPw && !prefersReducedMotion
                                            ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                                            : { duration: 0.3 }}
                                        className="rounded-xl"
                                    >
                                        <div className="relative">
                                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isPw ? 'text-fuchsia-300' : 'text-indigo-300/50'}`} />
                                            <input
                                                id="password"
                                                type={showPw ? 'text' : 'password'}
                                                autoComplete="current-password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                onFocus={() => setFocused('password')}
                                                onBlur={() => setFocused((f) => (f === 'password' ? null : f))}
                                                className={`w-full pl-11 pr-16 py-3.5 rounded-xl border bg-white/[0.04] text-white outline-none text-sm transition placeholder:text-indigo-300/40 focus-visible:ring-2 focus-visible:ring-fuchsia-400/60
                                                    ${isPw ? 'border-fuchsia-400/60' : 'border-white/10'}`}
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                aria-label={showPw ? 'Hide password' : 'Show password'}
                                                onClick={() => setShowPw((s) => !s)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-indigo-200/75 hover:text-fuchsia-200 px-3 py-1.5 rounded-md hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 transition"
                                            >
                                                {showPw ? 'Hide' : 'Show'}
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Remember me / Forgot password */}
                                <div className="flex items-center justify-between text-[12px] -mt-1">
                                    <label className="flex items-center gap-2 text-indigo-200/80 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={remember}
                                            onChange={(e) => setRemember(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded accent-fuchsia-500 cursor-pointer"
                                        />
                                        Remember me
                                    </label>
                                    <a
                                        href={OWNER_WA_CONTACT_LINK}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-fuchsia-300/85 hover:text-fuchsia-200 focus-visible:outline-none focus-visible:underline transition"
                                    >
                                        Forgot password?
                                    </a>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: [0, -4, 4, -2, 2, 0] }}
                                        transition={{ duration: 0.45 }}
                                        className="text-xs text-red-200 bg-red-500/10 border border-red-400/30 rounded-lg px-3.5 py-3 flex items-start gap-2"
                                        role="alert"
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
                                    animate={prefersReducedMotion ? {} : {
                                        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                                    }}
                                    transition={{
                                        backgroundPosition: { duration: 5, repeat: Infinity, ease: 'linear' },
                                    }}
                                    style={{
                                        backgroundImage:
                                            'linear-gradient(90deg, #6366f1 0%, #a855f7 40%, #ec4899 70%, #6366f1 100%)',
                                        backgroundSize: '200% 100%',
                                    }}
                                    className="relative overflow-hidden w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-[15px] shadow-[0_15px_40px_-12px_rgba(168,85,247,0.7)] hover:shadow-[0_20px_50px_-12px_rgba(236,72,153,0.75)] disabled:opacity-70 disabled:cursor-not-allowed transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Signing in…</span>
                                            {/* Bottom progress shimmer */}
                                            <motion.span
                                                className="absolute left-0 bottom-0 h-[2px] bg-white/70"
                                                initial={{ width: '0%' }}
                                                animate={{ width: ['0%', '85%', '92%'] }}
                                                transition={{ duration: 4, ease: 'easeOut' }}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <span>Sign in</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </motion.button>
                            </form>

                            {/* Demo CTA */}
                            <motion.a
                                href={OWNER_WA_DEMO_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ y: -2 }}
                                className="mt-5 flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ring-white/10 hover:ring-emerald-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition-all group"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                            >
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(16,185,129,0.6)] shrink-0">
                                    <MessageCircle className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13.5px] font-bold text-white leading-tight">
                                        Start free trial — 5 min setup
                                    </div>
                                    <div className="text-[11.5px] text-indigo-200/70 mt-0.5">
                                        WhatsApp Emad for instant access.
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-emerald-300/85 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            </motion.a>
                        </motion.div>
                    </motion.div>
                </div>

                {/* ─── Footer ─── */}
                <footer className="relative z-10 px-8 md:px-12 lg:px-16 pb-5 flex items-center justify-between gap-3 text-[11.5px] text-indigo-300/55">
                    <span className="inline-flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>System operational</span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <span>© {new Date().getFullYear()} {OWNER_NAME}. All rights reserved.</span>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-300/60" />
                    </span>
                </footer>
            </div>
        </div>
    );
}
