import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Hint } from './Hint';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'pink' | 'cyan';
  icon?: LucideIcon;
  delta?: number | null;
  deltaUnit?: string;
  hint?: string;
}

const PALETTE: Record<NonNullable<Props['color']>, {
  text: string; iconBg: string; iconText: string; glow: string; barFrom: string; barTo: string;
}> = {
  blue:   { text: 'text-blue-700',    iconBg: 'bg-blue-500/10',    iconText: 'text-blue-600',    glow: 'shadow-blue-500/20',    barFrom: 'from-blue-400',    barTo: 'to-cyan-400' },
  green:  { text: 'text-emerald-600', iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-600', glow: 'shadow-emerald-500/20', barFrom: 'from-emerald-400', barTo: 'to-teal-400' },
  purple: { text: 'text-violet-600',  iconBg: 'bg-violet-500/10',  iconText: 'text-violet-600',  glow: 'shadow-violet-500/20',  barFrom: 'from-violet-400',  barTo: 'to-fuchsia-400' },
  amber:  { text: 'text-amber-600',   iconBg: 'bg-amber-500/10',   iconText: 'text-amber-600',   glow: 'shadow-amber-500/20',   barFrom: 'from-amber-400',   barTo: 'to-orange-400' },
  pink:   { text: 'text-pink-600',    iconBg: 'bg-pink-500/10',    iconText: 'text-pink-600',    glow: 'shadow-pink-500/20',    barFrom: 'from-pink-400',    barTo: 'to-rose-400' },
  cyan:   { text: 'text-cyan-600',    iconBg: 'bg-cyan-500/10',    iconText: 'text-cyan-600',    glow: 'shadow-cyan-500/20',    barFrom: 'from-cyan-400',    barTo: 'to-blue-400' },
};

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(from + (target - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function StatCard({ label, value, sub, color = 'blue', icon: Icon, delta, deltaUnit = 'pts', hint }: Props) {
  const showDelta = delta != null && delta !== 0;
  const isPositive = (delta ?? 0) > 0;
  const p = PALETTE[color];

  const numericMatch = typeof value === 'number'
    ? { num: value, suffix: '' }
    : (() => {
        const m = String(value).match(/^(-?\d+(?:\.\d+)?)(.*)$/);
        return m ? { num: parseFloat(m[1]), suffix: m[2] } : null;
      })();

  const animated = useCountUp(numericMatch?.num ?? 0);
  const display = numericMatch
    ? `${Math.round(animated * 10) / 10}${numericMatch.suffix}`.replace(/\.0(?=\D|$)/, '')
    : String(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={`group relative bg-white rounded-[var(--radius-card)] border border-white/80
                  p-5 flex flex-col gap-2.5 shadow-[var(--shadow-card)]
                  hover:shadow-[var(--shadow-card-hover)] transition-all overflow-hidden`}
    >
      {/* Hover gradient sheen */}
      <div className={`absolute -inset-px rounded-[var(--radius-card)] bg-gradient-to-br ${p.barFrom} ${p.barTo} opacity-0 group-hover:opacity-[0.06] transition-opacity pointer-events-none`} />

      {/* Top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${p.barFrom} ${p.barTo}`} />

      {/* Decorative blob */}
      <div className={`absolute -right-10 -bottom-10 w-32 h-32 rounded-full bg-gradient-to-br ${p.barFrom} ${p.barTo} opacity-[0.06] blur-2xl pointer-events-none`} />

      <div className="relative flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold flex items-center gap-1.5">
          {label}
          {hint && <Hint text={hint} />}
        </span>
        {Icon && (
          <motion.span
            whileHover={{ rotate: 8, scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14 }}
            className={`p-2 rounded-xl ${p.iconBg} ${p.iconText} ring-1 ring-inset ring-white/40 shadow-sm ${p.glow}`}
          >
            <Icon className="w-4 h-4" />
          </motion.span>
        )}
      </div>
      <div className="relative flex items-baseline gap-2">
        <span className={`text-[34px] leading-none font-bold tracking-tight ${p.text} tabular-nums`}>
          {display}
        </span>
      </div>
      <div className="relative flex items-center gap-2 flex-wrap">
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
        {showDelta && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md
              ${isPositive ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-100' : 'text-rose-600 bg-rose-50 ring-1 ring-rose-100'}`}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{delta}{deltaUnit ? ` ${deltaUnit}` : ''}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}
