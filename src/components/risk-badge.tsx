import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/badge";

export type RiskLevel = "critical" | "medium" | "low";

const CONFIG: Record<
  RiskLevel,
  { label: string; tone: BadgeTone; icon: typeof AlertTriangle }
> = {
  critical: { label: "Критичный", tone: "danger", icon: AlertTriangle },
  medium: { label: "Средний", tone: "warning", icon: AlertCircle },
  low: { label: "Низкий", tone: "success", icon: CheckCircle },
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

// Risk level chip — a thin wrapper over <Badge> so risk levels and
// every other status chip share one shape.
export function RiskBadge({ level, className }: RiskBadgeProps) {
  const { label, tone, icon: Icon } = CONFIG[level];
  return (
    <Badge tone={tone} className={className}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
