import { useState } from 'react';
import { HelpCircle, Info, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface HintProps {
  text: string;
  className?: string;
}

export function Hint({ text, className = '' }: HintProps) {
  const [show, setShow] = useState(false);
  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow((v) => !v); }}
    >
      <HelpCircle className="w-3.5 h-3.5 text-slate-300 hover:text-indigo-500 cursor-help transition-colors" />
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 p-3
                       bg-gradient-to-br from-slate-900 to-slate-800 text-white text-[11px] rounded-xl
                       shadow-[var(--shadow-pop)] leading-relaxed normal-case font-normal pointer-events-none
                       ring-1 ring-white/10"
          >
            {text}
            <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2.5 h-2.5 bg-slate-800 rotate-45 ring-1 ring-white/10" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

interface SectionIntroProps {
  children: React.ReactNode;
  tone?: 'info' | 'neutral' | 'magic';
}

export function SectionIntro({ children, tone = 'info' }: SectionIntroProps) {
  const tones = {
    info: {
      wrap: 'bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50/60 border-indigo-100/80 text-slate-700',
      icon: 'text-indigo-500 bg-indigo-100/60',
      Icon: Info,
    },
    neutral: {
      wrap: 'bg-slate-50 border-slate-200 text-slate-700',
      icon: 'text-slate-500 bg-slate-100',
      Icon: Info,
    },
    magic: {
      wrap: 'bg-gradient-to-r from-fuchsia-50 via-pink-50 to-rose-50/60 border-fuchsia-100/80 text-slate-700',
      icon: 'text-fuchsia-500 bg-fuchsia-100/60',
      Icon: Sparkles,
    },
  } as const;

  const t = tones[tone];
  const Icon = t.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3 px-4 py-3 border rounded-2xl text-xs leading-relaxed ${t.wrap}`}
    >
      <span className={`w-7 h-7 shrink-0 rounded-xl flex items-center justify-center ${t.icon}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="pt-0.5">{children}</div>
    </motion.div>
  );
}
