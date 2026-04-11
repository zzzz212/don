"use client";

import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ScoreRing({
  score,
  maxScore = 10,
  size = 120,
  strokeWidth = 10,
  className,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = score / maxScore;
  const offset = circumference - percent * circumference;

  const color =
    score >= 7 ? "text-success" : score >= 4 ? "text-warning" : "text-danger";

  const label =
    score >= 7 ? "Безопасен" : score >= 4 ? "Есть риски" : "Опасен";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="rotate-[-90deg]" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(color, "transition-all duration-1000 ease-out")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold", color)}>{score}</span>
          <span className="text-xs text-muted">/ {maxScore}</span>
        </div>
      </div>
      <span className={cn("text-sm font-semibold", color)}>{label}</span>
    </div>
  );
}
