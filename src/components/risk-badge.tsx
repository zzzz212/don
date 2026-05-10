import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

export type RiskLevel = "critical" | "medium" | "low";

const config: Record<
  RiskLevel,
  { label: string; className: string; icon: typeof AlertTriangle }
> = {
  critical: {
    label: "Критичный",
    className: "bg-danger-light text-danger border-danger/30",
    icon: AlertTriangle,
  },
  medium: {
    label: "Средний",
    className: "bg-warning-light text-warning border-warning/30",
    icon: AlertCircle,
  },
  low: {
    label: "Низкий",
    className: "bg-success-light text-success border-success/30",
    icon: CheckCircle,
  },
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const { label, className: badgeClass, icon: Icon } = config[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        badgeClass,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
