import React from 'react';
import { PriorityLevel } from '../types/database.types';
import { useLanguage } from '../context/LanguageContext';

export interface PriorityColorConfig {
  level: PriorityLevel | 'Unknown';
  badgeClass: string;
  hex: string;
  pulseHex: string;
  textClass: string;
  dotClass: string;
  borderClass: string;
}

/**
 * Universal NAGARSETU Semantic Priority Palette with Severity Dots:
 * - CRITICAL → RED DOT (bg-red-500)
 * - HIGH → ORANGE DOT (bg-orange-500)
 * - MEDIUM → YELLOW DOT (bg-yellow-400)
 * - LOW → GREEN DOT (bg-green-500)
 * - UNKNOWN → GRAY DOT (bg-gray-400)
 */
export const PRIORITY_COLORS: Record<string, PriorityColorConfig> = {
  Critical: {
    level: 'Critical',
    badgeClass: 'bg-red-50 text-red-900 border-red-300 font-extrabold',
    hex: '#dc2626',
    pulseHex: '#f87171',
    textClass: 'text-red-700',
    dotClass: 'bg-red-500',
    borderClass: 'border-red-300'
  },
  High: {
    level: 'High',
    badgeClass: 'bg-orange-50 text-orange-900 border-orange-300 font-bold',
    hex: '#ea580c',
    pulseHex: '#fb923c',
    textClass: 'text-orange-700',
    dotClass: 'bg-orange-500',
    borderClass: 'border-orange-300'
  },
  Medium: {
    level: 'Medium',
    badgeClass: 'bg-yellow-50 text-yellow-900 border-yellow-300 font-semibold',
    hex: '#ca8a04',
    pulseHex: '#fde047',
    textClass: 'text-yellow-800',
    dotClass: 'bg-yellow-400',
    borderClass: 'border-yellow-300'
  },
  Low: {
    level: 'Low',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium',
    hex: '#16a34a',
    pulseHex: '#4ade80',
    textClass: 'text-emerald-700',
    dotClass: 'bg-green-500',
    borderClass: 'border-emerald-300'
  },
  Unknown: {
    level: 'Unknown',
    badgeClass: 'bg-gray-50 text-gray-800 border-gray-300 font-medium',
    hex: '#9ca3af',
    pulseHex: '#d1d5db',
    textClass: 'text-gray-700',
    dotClass: 'bg-gray-400',
    borderClass: 'border-gray-300'
  }
};

/**
 * Safely normalizes priority values from any source (DB, API, user input)
 * without crashing if undefined, null, or unknown.
 */
export function normalizePriority(priority?: unknown): PriorityLevel {
  if (typeof priority !== 'string') return 'Medium';
  const clean = priority.trim().toLowerCase();
  if (clean === 'critical') return 'Critical';
  if (clean === 'high') return 'High';
  if (clean === 'medium') return 'Medium';
  if (clean === 'low') return 'Low';
  return 'Medium';
}

/**
 * Retrieves the priority color and style configuration safely.
 */
export function getPriorityConfig(priority?: unknown): PriorityColorConfig {
  if (typeof priority !== 'string') return PRIORITY_COLORS.Medium;
  const clean = priority.trim().toLowerCase();
  if (clean === 'critical') return PRIORITY_COLORS.Critical;
  if (clean === 'high') return PRIORITY_COLORS.High;
  if (clean === 'medium') return PRIORITY_COLORS.Medium;
  if (clean === 'low') return PRIORITY_COLORS.Low;
  return PRIORITY_COLORS.Unknown || PRIORITY_COLORS.Medium;
}

export interface PriorityBadgeProps {
  priority?: PriorityLevel | string | null;
  className?: string;
  showDot?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  className = '',
  showDot = true
}) => {
  const { translatePriority, t } = useLanguage();
  const normalized = normalizePriority(priority);
  const config = getPriorityConfig(priority);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${config.badgeClass} ${className}`.trim()}
    >
      {showDot && (
        <span
          className={`w-2 h-2 rounded-full mr-1.5 shrink-0 ${config.dotClass}`}
          aria-hidden="true"
        />
      )}
      {translatePriority(normalized)} {t('priority')}
    </span>
  );
};
