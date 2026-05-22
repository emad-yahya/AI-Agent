// frontend/src/components/DemoBanner.tsx
// Sticky banner shown only when the active session is a demo account.
// Tells the visitor what they're looking at + gives them a one-tap WhatsApp
// route to a real audit. Self-contained: reads from AuthContext, no props.
import { motion } from 'framer-motion';
import { Play, MessageCircle, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const OWNER_WA_NUMBER = '971566392647';
const OWNER_WA_DEMO_LINK = `https://wa.me/${OWNER_WA_NUMBER}?text=${encodeURIComponent(
    "Hi Emad, I just tried the AI Visibility Tracker demo. Can you set up a live audit on my brand?",
)}`;

export function DemoBanner() {
    const { isDemo, logout } = useAuth();
    const [hidden, setHidden] = useState(false);

    if (!isDemo || hidden) return null;

    return (
        <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            className="sticky top-0 z-50 w-full text-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)]"
            style={{
                background:
                    'linear-gradient(90deg, #6d28d9 0%, #a21caf 45%, #be185d 100%)',
            }}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/15 shrink-0">
                    <Play className="w-3 h-3 text-white" fill="currentColor" />
                </span>
                <div className="flex-1 min-w-0 text-[12.5px] leading-snug">
                    <span className="font-bold">Demo mode</span>
                    <span className="hidden sm:inline text-white/85">
                        {' '}— viewing <span className="font-semibold">Platinum Square</span> sample data.
                        Generators show pre-built outputs. Scans are disabled.
                    </span>
                    <span className="sm:hidden text-white/85"> · Platinum Square sample data</span>
                </div>
                <a
                    href={OWNER_WA_DEMO_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 text-[12px] font-semibold whitespace-nowrap transition shrink-0"
                >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Live audit on WhatsApp
                </a>
                <button
                    type="button"
                    onClick={logout}
                    className="text-[11.5px] font-semibold text-white/80 hover:text-white whitespace-nowrap shrink-0"
                >
                    Exit demo
                </button>
                <button
                    type="button"
                    onClick={() => setHidden(true)}
                    aria-label="Dismiss demo banner"
                    className="p-1 rounded hover:bg-white/15 transition shrink-0"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </motion.div>
    );
}
