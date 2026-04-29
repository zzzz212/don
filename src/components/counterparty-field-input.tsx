"use client";

import { useState, useCallback } from "react";
import { Loader2, AlertOctagon, AlertTriangle, AlertCircle, CheckCircle, Info } from "lucide-react";

interface CounterpartyProfile {
  riskScore: number;
  riskLevel: string;
  name: string;
}

interface CounterpartyFieldInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CounterpartyFieldInput({
  value,
  onChange,
  placeholder,
}: CounterpartyFieldInputProps) {
  const [profile, setProfile] = useState<CounterpartyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkCounterparty = useCallback(async (inn: string) => {
    if (!inn || !/^\d{10,12}$/.test(inn)) {
      setProfile(null);
      return;
    }

    setChecking(true);
    try {
      const response = await fetch("/api/counterparty/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Counterparty check error:", err);
      setProfile(null);
    } finally {
      setChecking(false);
    }
  }, []);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    // Debounce the check
    const timer = setTimeout(() => {
      checkCounterparty(newValue.replace(/\D/g, ""));
    }, 800);
    return () => clearTimeout(timer);
  };

  const getRiskIcon = () => {
    if (!profile) return null;
    switch (profile.riskLevel) {
      case "critical":
        return <AlertOctagon className="h-4 w-4 text-red-600" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case "medium":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  const getRiskBgColor = () => {
    if (!profile) return "";
    switch (profile.riskLevel) {
      case "critical":
        return "bg-red-50 border-red-200";
      case "high":
        return "bg-orange-50 border-orange-200";
      case "medium":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-green-50 border-green-200";
    }
  };

  const getRiskLabel = () => {
    if (!profile) return "";
    switch (profile.riskLevel) {
      case "critical":
        return "🔴 Критический риск";
      case "high":
        return "🟠 Высокий риск";
      case "medium":
        return "🟡 Средний риск";
      default:
        return "🟢 Низкий риск";
    }
  };

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          maxLength={12}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {checking && (
          <div className="absolute right-3 top-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      {profile && (
        <div
          className={`mt-2 rounded-lg border p-3 flex items-start gap-3 ${getRiskBgColor()}`}
        >
          <div className="pt-0.5">{getRiskIcon()}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-1">
              {profile.name}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{getRiskLabel()}</span>
              <span className="text-xs font-bold">
                {profile.riskScore}/100
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
