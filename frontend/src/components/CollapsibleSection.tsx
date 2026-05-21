import { useState, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    title: string;
    subtitle?: string;
    Icon?: LucideIcon;
    iconGradient?: string;
    defaultOpen?: boolean;
    headerRight?: ReactNode;
    children: ReactNode;
}

export function CollapsibleSection({
    title,
    subtitle,
    Icon,
    iconGradient = 'from-indigo-500 to-fuchsia-500',
    defaultOpen = false,
    headerRight,
    children,
}: Props) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="glass rounded-[var(--radius-card)] overflow-hidden">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/40 transition text-left"
                aria-expanded={open}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {Icon && (
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center shadow-[var(--shadow-soft)] shrink-0`}>
                            <Icon className="w-4 h-4 text-white" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{title}</div>
                        {subtitle && (
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {headerRight}
                    <motion.div
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    </motion.div>
                </div>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-white/40 p-5">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
