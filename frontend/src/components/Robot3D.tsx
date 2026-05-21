// frontend/src/components/Robot3D.tsx
// Stylized 3D-looking robot built from SVG + gradients. No three.js dep.
// Whole body tilts toward mouse, eyes track cursor, antenna glow pulses,
// idle floating animation.

import { useEffect } from 'react';
import {
    motion,
    useMotionValue,
    useSpring,
    useTransform,
} from 'framer-motion';

export function Robot3D({ className = '' }: { className?: string }) {
    // Raw mouse position normalized to [-1, 1] relative to viewport center.
    const mx = useMotionValue(0);
    const my = useMotionValue(0);

    // Spring-smoothed values for buttery tracking.
    const smx = useSpring(mx, { stiffness: 60, damping: 18, mass: 1 });
    const smy = useSpring(my, { stiffness: 60, damping: 18, mass: 1 });

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

    // Body tilt — gentle 3D rotation toward cursor.
    const rotY = useTransform(smx, [-1, 1], [-12, 12]);
    const rotX = useTransform(smy, [-1, 1], [10, -10]);
    const tx = useTransform(smx, [-1, 1], [-15, 15]);
    const ty = useTransform(smy, [-1, 1], [-10, 10]);

    // Eye pupils — independent tracking, larger range.
    const pupilX = useTransform(smx, [-1, 1], [-5, 5]);
    const pupilY = useTransform(smy, [-1, 1], [-3, 3]);

    return (
        <motion.div
            className={`pointer-events-none select-none ${className}`}
            style={{ perspective: 1200 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
            <motion.div
                style={{
                    rotateX: rotX,
                    rotateY: rotY,
                    x: tx,
                    y: ty,
                    transformStyle: 'preserve-3d',
                }}
                animate={{ y: [0, -12, 0] }}
                transition={{
                    y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                }}
            >
                <svg
                    viewBox="0 0 400 480"
                    width="100%"
                    height="100%"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        {/* Head metallic gradient */}
                        <linearGradient id="headGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e2e8f0" />
                            <stop offset="40%" stopColor="#94a3b8" />
                            <stop offset="100%" stopColor="#475569" />
                        </linearGradient>
                        {/* Head shine */}
                        <linearGradient id="headShine" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                        </linearGradient>
                        {/* Body gradient */}
                        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#cbd5e1" />
                            <stop offset="50%" stopColor="#64748b" />
                            <stop offset="100%" stopColor="#1e293b" />
                        </linearGradient>
                        {/* Chest panel glow */}
                        <radialGradient id="chestGlow" cx="0.5" cy="0.5" r="0.5">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity="1" />
                            <stop offset="60%" stopColor="#6366f1" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </radialGradient>
                        {/* Eye glow */}
                        <radialGradient id="eyeGlow" cx="0.5" cy="0.5" r="0.5">
                            <stop offset="0%" stopColor="#67e8f9" stopOpacity="1" />
                            <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                        </radialGradient>
                        {/* Antenna ball glow */}
                        <radialGradient id="antennaGlow" cx="0.5" cy="0.5" r="0.5">
                            <stop offset="0%" stopColor="#fef08a" stopOpacity="1" />
                            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                        </radialGradient>
                        {/* Soft drop shadow */}
                        <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
                            <feOffset dx="0" dy="10" result="offsetblur" />
                            <feComponentTransfer>
                                <feFuncA type="linear" slope="0.25" />
                            </feComponentTransfer>
                            <feMerge>
                                <feMergeNode />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* ───── Antenna ───── */}
                    <line
                        x1="200"
                        y1="80"
                        x2="200"
                        y2="40"
                        stroke="#475569"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    {/* Antenna glow halo */}
                    <circle cx="200" cy="35" r="22" fill="url(#antennaGlow)" />
                    <motion.circle
                        cx="200"
                        cy="35"
                        r="8"
                        fill="#fef08a"
                        animate={{ opacity: [0.7, 1, 0.7], r: [7, 9, 7] }}
                        transition={{ duration: 1.8, repeat: Infinity }}
                    />

                    {/* ───── Head ───── */}
                    <g filter="url(#softShadow)">
                        <rect
                            x="100"
                            y="80"
                            width="200"
                            height="160"
                            rx="40"
                            fill="url(#headGrad)"
                            stroke="#334155"
                            strokeWidth="2"
                        />
                        {/* Highlight stripe */}
                        <rect
                            x="100"
                            y="80"
                            width="200"
                            height="160"
                            rx="40"
                            fill="url(#headShine)"
                        />
                    </g>

                    {/* Side bolts */}
                    <circle cx="100" cy="140" r="6" fill="#1e293b" />
                    <circle cx="100" cy="180" r="6" fill="#1e293b" />
                    <circle cx="300" cy="140" r="6" fill="#1e293b" />
                    <circle cx="300" cy="180" r="6" fill="#1e293b" />

                    {/* ───── Eye sockets (dark recess) ───── */}
                    <ellipse cx="155" cy="155" rx="32" ry="28" fill="#0f172a" />
                    <ellipse cx="245" cy="155" rx="32" ry="28" fill="#0f172a" />

                    {/* Eye glow halos */}
                    <circle cx="155" cy="155" r="36" fill="url(#eyeGlow)" opacity="0.5" />
                    <circle cx="245" cy="155" r="36" fill="url(#eyeGlow)" opacity="0.5" />

                    {/* ───── Pupils — track mouse ───── */}
                    <motion.g style={{ x: pupilX, y: pupilY }}>
                        <circle cx="155" cy="155" r="14" fill="#06b6d4" />
                        <circle cx="151" cy="151" r="5" fill="#cffafe" opacity="0.9" />
                        <circle cx="245" cy="155" r="14" fill="#06b6d4" />
                        <circle cx="241" cy="151" r="5" fill="#cffafe" opacity="0.9" />
                    </motion.g>

                    {/* ───── Mouth (smile speaker grid) ───── */}
                    <rect
                        x="170"
                        y="195"
                        width="60"
                        height="22"
                        rx="6"
                        fill="#0f172a"
                    />
                    <line x1="180" y1="200" x2="180" y2="212" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
                    <line x1="190" y1="200" x2="190" y2="212" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                    <line x1="200" y1="200" x2="200" y2="212" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
                    <line x1="210" y1="200" x2="210" y2="212" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                    <line x1="220" y1="200" x2="220" y2="212" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

                    {/* ───── Neck ───── */}
                    <rect x="175" y="240" width="50" height="20" fill="#334155" />
                    <rect x="170" y="255" width="60" height="10" rx="3" fill="#475569" />

                    {/* ───── Body ───── */}
                    <g filter="url(#softShadow)">
                        <path
                            d="M 90 280 Q 90 265 110 265 L 290 265 Q 310 265 310 280 L 310 420 Q 310 450 280 450 L 120 450 Q 90 450 90 420 Z"
                            fill="url(#bodyGrad)"
                            stroke="#1e293b"
                            strokeWidth="2"
                        />
                    </g>

                    {/* Chest panel */}
                    <rect
                        x="150"
                        y="310"
                        width="100"
                        height="100"
                        rx="14"
                        fill="#0f172a"
                        stroke="#475569"
                        strokeWidth="2"
                    />
                    {/* Chest glow core */}
                    <circle cx="200" cy="360" r="55" fill="url(#chestGlow)" />
                    <motion.circle
                        cx="200"
                        cy="360"
                        r="20"
                        fill="#a855f7"
                        animate={{ opacity: [0.7, 1, 0.7], r: [18, 24, 18] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <circle cx="200" cy="360" r="8" fill="#fce7f3" />

                    {/* Tech lines on chest panel */}
                    <line x1="160" y1="320" x2="180" y2="320" stroke="#a855f7" strokeWidth="2" opacity="0.6" />
                    <line x1="220" y1="320" x2="240" y2="320" stroke="#a855f7" strokeWidth="2" opacity="0.6" />
                    <line x1="160" y1="400" x2="180" y2="400" stroke="#06b6d4" strokeWidth="2" opacity="0.6" />
                    <line x1="220" y1="400" x2="240" y2="400" stroke="#06b6d4" strokeWidth="2" opacity="0.6" />

                    {/* Shoulder lights */}
                    <motion.circle
                        cx="110"
                        cy="285"
                        r="5"
                        fill="#10b981"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <motion.circle
                        cx="290"
                        cy="285"
                        r="5"
                        fill="#ec4899"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.7 }}
                    />
                </svg>
            </motion.div>
        </motion.div>
    );
}
