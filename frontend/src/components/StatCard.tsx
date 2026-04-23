
// frontend/src/components/StatCard.tsx
import type { LucideIcon } from 'lucide-react';

interface Props {
    label: string;
    value: string | number;
    sub?: string;
    color?: 'blue' | 'green' | 'purple';
    icon?: LucideIcon;
}

const COLOR_MAP = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
};

const ICON_BG_MAP = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    purple: 'bg-purple-50',
};

export function StatCard({ label, value, sub, color = 'blue', icon: Icon }: Props) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
                {Icon && (
                    <span className={`p-1.5 rounded-lg ${ICON_BG_MAP[color]}`}>
                        <Icon className={`w-4 h-4 ${COLOR_MAP[color]}`} />
                    </span>
                )}
            </div>
            <span className={`text-3xl font-semibold ${COLOR_MAP[color]}`}>{value}</span>
            {sub && <span className="text-xs text-gray-400">{sub}</span>}
        </div>
    );
}