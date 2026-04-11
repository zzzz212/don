import { RiskBadge, type RiskLevel } from "./risk-badge";

export interface RiskItem {
  clause: string;
  level: RiskLevel;
  description: string;
  recommendation: string;
}

interface AnalysisCardProps {
  risk: RiskItem;
  index: number;
}

export function AnalysisCard({ risk, index }: AnalysisCardProps) {
  return (
    <div
      className="animate-slide-up rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
      style={{ animationDelay: `${index * 0.1}s`, opacity: 0 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <RiskBadge level={risk.level} />
          </div>
          <h3 className="mb-1 font-semibold text-foreground">{risk.clause}</h3>
          <p className="mb-3 text-sm text-muted leading-relaxed">
            {risk.description}
          </p>
          <div className="rounded-lg bg-primary-light/50 p-3">
            <p className="text-sm font-medium text-primary-dark">
              Рекомендация:
            </p>
            <p className="mt-0.5 text-sm text-primary-dark/80">
              {risk.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
