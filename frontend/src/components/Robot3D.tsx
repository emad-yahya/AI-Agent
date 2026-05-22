// frontend/src/components/Robot3D.tsx
// Realistic robot photo with mouse-tracked parallax tilt + idle float.
// Image lives at /roobot.png (in frontend/public).

import { useEffect } from 'react';
import {
    motion,
    useMotionValue,
    useSpring,
    useTransform,
} from 'framer-motion';

export function Robot3D({ className = '' }: { className?: string }) {
    const mx = useMotionValue(0);
    const my = useMotionValue(0);

    const smx = useSpring(mx, { stiffness: 50, damping: 20, mass: 1 });
    const smy = useSpring(my, { stiffness: 50, damping: 20, mass: 1 });

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

    // 3D tilt toward cursor.
    const rotY = useTransform(smx, [-1, 1], [-14, 14]);
    const rotX = useTransform(smy, [-1, 1], [10, -10]);
    // Parallax translate.
    const tx = useTransform(smx, [-1, 1], [-22, 22]);
    const ty = useTransform(smy, [-1, 1], [-14, 14]);

    return (
        <motion.div
            className={`pointer-events-none select-none ${className}`}
            style={{ perspective: 1400 }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
            <motion.div
                className="relative w-full"
                style={{
                    rotateX: rotX,
                    rotateY: rotY,
                    x: tx,
                    y: ty,
                    transformStyle: 'preserve-3d',
                }}
                animate={{ y: [0, -14, 0] }}
                transition={{
                    y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
                }}
            >
                {/* Glow halo behind robot */}
                <div
                    className="absolute inset-0 -z-10 blur-3xl"
                    style={{
                        background:
                            'radial-gradient(circle at 50% 40%, rgba(99,102,241,0.45), rgba(168,85,247,0.25) 40%, transparent 70%)',
                    }}
                />
                <img
                    src="/roobot.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="w-full h-auto drop-shadow-[0_30px_60px_rgba(15,23,42,0.55)]"
                    style={{
                        maskImage:
                            'linear-gradient(180deg, #000 70%, transparent 100%)',
                        WebkitMaskImage:
                            'linear-gradient(180deg, #000 70%, transparent 100%)',
                    }}
                />
            </motion.div>
        </motion.div>
    );
}
