import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface RiskAssessmentProps {
  safety_score?: number;
  disruption_score?: number;
  health_environment_score?: number;
  defect_severity_score?: number;
  risk_score?: number;
  priority_rank?: number;
  priority?: string;
  severity?: string;
}

export const RiskAssessmentCard: React.FC<RiskAssessmentProps> = ({
  safety_score = 0,
  disruption_score = 0,
  health_environment_score = 0,
  defect_severity_score = 0,
  risk_score,
  priority_rank,
  priority = 'Medium',
  severity
}) => {
  const finalSafety = Math.max(0, Math.min(3, Number(safety_score || 0)));
  const finalDisruption = Math.max(0, Math.min(3, Number(disruption_score || 0)));
  const finalHealth = Math.max(0, Math.min(3, Number(health_environment_score || 0)));
  const finalDefect = Math.max(0, Math.min(3, Number(defect_severity_score || 0)));

  const computedRisk = risk_score !== undefined
    ? Number(risk_score)
    : (finalSafety + finalDisruption + finalHealth + finalDefect);

  const rawSeverity = (severity || priority || 'Medium').toUpperCase();
  let severityLabel = 'MEDIUM';
  let badgeColor = 'bg-yellow-50 text-yellow-800 border-yellow-300';
  let barColor = 'bg-yellow-400';

  if (rawSeverity.includes('CRIT') || computedRisk >= 9) {
    severityLabel = 'CRITICAL';
    badgeColor = 'bg-red-50 text-red-800 border-red-300';
    barColor = 'bg-red-500';
  } else if (rawSeverity.includes('HIGH') || computedRisk >= 6) {
    severityLabel = 'HIGH';
    badgeColor = 'bg-orange-50 text-orange-800 border-orange-300';
    barColor = 'bg-orange-500';
  } else if (rawSeverity.includes('LOW') || computedRisk <= 2) {
    severityLabel = 'LOW';
    badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    barColor = 'bg-green-500';
  }

  const computedRank = priority_rank !== undefined ? Number(priority_rank) : (computedRisk * 10 + 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs space-y-3 font-sans text-xs">
      {/* Title & Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center space-x-1.5 font-extrabold text-gray-900 font-outfit uppercase tracking-wider text-[11px]">
          <ShieldAlert className="w-4 h-4 text-emerald-600" />
          <span>Risk Assessment</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full font-mono font-extrabold text-[10px] border ${badgeColor}`}>
          {severityLabel}
        </span>
      </div>

      {/* 4 Quadrants Grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-gray-500 block text-[10px]">Safety</span>
          <span className="font-extrabold text-gray-900 font-mono">{finalSafety}/3</span>
        </div>
        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-gray-500 block text-[10px]">Public Disruption</span>
          <span className="font-extrabold text-gray-900 font-mono">{finalDisruption}/3</span>
        </div>
        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-gray-500 block text-[10px]">Health/Environment</span>
          <span className="font-extrabold text-gray-900 font-mono">{finalHealth}/3</span>
        </div>
        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-gray-500 block text-[10px]">Defect Severity</span>
          <span className="font-extrabold text-gray-900 font-mono">{finalDefect}/3</span>
        </div>
      </div>

      {/* Summary Score & Priority Rank */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 font-mono text-[11px]">
        <div>
          <span className="text-gray-500">Risk Score: </span>
          <strong className="text-gray-900 font-extrabold">{computedRisk}/12</strong>
        </div>
        <div>
          <span className="text-gray-500">Priority Rank: </span>
          <strong className="text-emerald-700 font-extrabold">{computedRank}</strong>
        </div>
      </div>
    </div>
  );
};
