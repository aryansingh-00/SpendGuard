import React from "react";
import { RiskLevel } from "@/types";
import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

interface RiskGaugeProps {
  score: number;
  level?: RiskLevel;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function RiskGauge({ score, level, size = "md", showLabel = true }: RiskGaugeProps) {
  const calculatedLevel = level || (score >= 70 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW");

  const colors = {
    LOW: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      stroke: "#10b981",
      badge: "bg-emerald-950/80 text-emerald-300 border-emerald-500/40",
      icon: ShieldCheck,
    },
    MEDIUM: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      stroke: "#f59e0b",
      badge: "bg-amber-950/80 text-amber-300 border-amber-500/40",
      icon: AlertTriangle,
    },
    HIGH: {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      stroke: "#f43f5e",
      badge: "bg-rose-950/80 text-rose-300 border-rose-500/40",
      icon: ShieldAlert,
    },
  };

  const style = colors[calculatedLevel];
  const Icon = style.icon;

  const radius = size === "sm" ? 18 : size === "lg" ? 36 : 26;
  const strokeWidth = size === "sm" ? 3.5 : size === "lg" ? 6 : 4.5;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const diameter = radius * 2;

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex items-center justify-center">
        <svg height={diameter} width={diameter} className="rotate-[-90deg]">
          <circle
            stroke="#334155"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={style.stroke}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset, transition: "stroke-dashoffset 0.8s ease" }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <span
          className={`absolute font-mono font-bold ${
            size === "sm" ? "text-[10px]" : size === "lg" ? "text-base" : "text-xs"
          } ${style.text}`}
        >
          {score}
        </span>
      </div>

      {showLabel && (
        <div className="flex flex-col">
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${style.badge}`}
          >
            <Icon className="w-3 h-3" />
            <span>{calculatedLevel} RISK</span>
          </div>
        </div>
      )}
    </div>
  );
}
