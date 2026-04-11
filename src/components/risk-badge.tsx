import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

export type RiskLevel = "critical" | "medium" | "low";

const config: Record<
  RiskLevel,
  { label: string; className: string; icon: typeof AlertTriangle }
> = {
  critical: {
    label: "Критичный",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: AlertTriangle,
  },
  medium: {
    label: "Средний",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: AlertCircle,
  },
  low: {
    label: "Низкий",
    className: "bg-green-50 text-green-700 border-green-200",
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
