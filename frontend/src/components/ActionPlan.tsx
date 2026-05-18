import { CalendarDays, CheckCircle2, Circle, Clock, Zap } from 'lucide-react';
import { type Recommendation } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  recommendations: Recommendation[];
  brand: string;
}

const EFFORT_HOURS: Record<string, number> = {
  '1 hour': 1,
  'half day': 4,
  '1 day': 8,
  '1 week': 40,
};

function effortSum(recs: Recommendation[]): string {
  const total = recs.reduce((sum, r) => {
    const h = EFFORT_HOURS[r.effort.toLowerCase()] ?? 2;
    return sum + h;
  }, 0);
  if (total === 0) return 'ongoing';
  if (total <= 8) return `~${total}h`;
  if (total <= 16) return `~${Math.round(total / 8)} day`;
  return `~${Math.round(total / 8)} days`;
}

const WEEKS = [
  {
    key: 'week1' as const,
    label: 'Week 1',
    subLabel: 'Quick wins — start here',
    dotColor: 'bg-red-500',
    borderColor: 'border-red-200',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    badgeColor: 'bg-red-100 text-red-700',
  },
  {
    key: 'week2_3' as const,
    label: 'Week 2–3',
    subLabel: 'Build momentum',
    dotColor: 'bg-yellow-500',
    borderColor: 'border-yellow-200',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    badgeColor: 'bg-yellow-100 text-yellow-700',
  },
  {
    key: 'week4plus' as const,
    label: 'Week 4+',
    subLabel: 'Long-term growth',
    dotColor: 'bg-green-500',
    borderColor: 'border-green-200',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    badgeColor: 'bg-green-100 text-green-700',
  },
] as const;

type WeekKey = (typeof WEEKS)[number]['key'];
type WeekConfig = (typeof WEEKS)[number];

function ActionCard({ rec, color }: { rec: Recommendation; color: WeekConfig }) {
  return (
    <div className={`bg-white rounded-lg border ${color.borderColor} p-3 flex flex-col gap-2`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 leading-snug">{rec.title}</p>
        <span className="text-xs text-gray-400 shrink-0 flex items-center gap-0.5 mt-0.5">
          <Clock className="w-3 h-3" />
          {rec.effort}
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{rec.description}</p>
      {rec.steps.length > 0 && (
        <ul className="flex flex-col gap-1">
          {rec.steps.slice(0, 3).map((step, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
              <Circle className="w-2.5 h-2.5 mt-0.5 shrink-0 text-gray-300" />
              {step}
            </li>
          ))}
        </ul>
      )}
      {rec.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {rec.platforms.map((p, i) => (
            <span
              key={i}
              className="text-xs bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-500"
            >
              {p}
            </span>
          ))}
        </div>
      )}
      {rec.expectedImpact && (
        <p className="text-xs flex items-start gap-1 text-blue-600">
          <Zap className="w-3 h-3 mt-0.5 shrink-0" />
          {rec.expectedImpact}
        </p>
      )}
    </div>
  );
}

export function ActionPlan({ recommendations, brand }: Props) {
  if (!recommendations || recommendations.length === 0) return null;

  const buckets: Record<WeekKey, Recommendation[]> = {
    week1: recommendations.filter((r) => r.priority === 'high'),
    week2_3: recommendations.filter((r) => r.priority === 'medium'),
    week4plus: recommendations.filter((r) => r.priority === 'low'),
  };

  if (Object.values(buckets).every((b) => b.length === 0)) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-blue-600" />
        <div>
          <h3 className="text-base font-semibold text-gray-800">30-Day Action Plan</h3>
          <p className="text-xs text-gray-400">Personalized roadmap for {brand}</p>
        </div>
      </div>
      <SectionIntro>
        Same recommendations above, but organized as a <b>3-week roadmap</b>. Week 1 = quick wins. Week 2-3 = build momentum. Week 4+ = long-term plays. Each column shows total effort needed.
      </SectionIntro>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {WEEKS.map((w) => {
          const items = buckets[w.key];
          const est = effortSum(items);
          return (
            <div key={w.key} className="flex flex-col gap-3">
              <div className={`rounded-lg ${w.bgColor} border ${w.borderColor} p-3`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${w.dotColor}`} />
                  <span className={`text-sm font-semibold ${w.textColor}`}>{w.label}</span>
                  {items.length > 0 && (
                    <span
                      className={`ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full ${w.badgeColor}`}
                    >
                      {est}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-4">{w.subLabel}</p>
                <p className="text-xs text-gray-400 ml-4 mt-0.5">
                  {items.length} action{items.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {items.length > 0 ? (
                  items.map((rec, i) => <ActionCard key={i} rec={rec} color={w} />)
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
                    <CheckCircle2 className="w-4 h-4 text-gray-300 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">Nothing scheduled</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
