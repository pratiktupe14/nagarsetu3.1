import React from 'react';
import { PriorityLevel } from '../types/database.types';
import { useLanguage } from '../context/LanguageContext';

export interface PriorityColorConfig {
  level: PriorityLevel;
  badgeClass: string;
  hex: string;
  pulseHex: string;
  textClass: string;
  dotClass: string;
  borderClass: string;
}

/**
 * Universal NAGARSETU Semantic Priority Palette:
 * - CRITICAL → RED
 * - HIGH → ORANGE
 * - MEDIUM → YELLOW
 * - LOW → GREEN
 */
export const PRIORITY_COLORS: Record<PriorityLevel, PriorityColorConfig> = {
  Critical: {
    level: 'Critical',
    badgeClass: 'bg-red-50 text-red-900 border-red-300 font-extrabold',
    hex: '#dc2626',
    pulseHex: '#f87171',
    textClass: 'text-red-700',
    dotClass: 'bg-red-600',
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
    dotClass: 'bg-yellow-500',
    borderClass: 'border-yellow-300'
  },
  Low: {
    level: 'Low',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium',
    hex: '#16a34a',
    pulseHex: '#4ade80',
    textClass: 'text-emerald-700',
    dotClass: 'bg-emerald-600',
    borderClass: 'border-emerald-300'
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
  const norm = normalizePriority(priority);
  return PRIORITY_COLORS[norm];
}

export interface PriorityBadgeProps {
  priority?: PriorityLevel | string | null;
  className?: string;
  showDot?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  className = '',
  showDot = false
}) => {
  const { translatePriority, t } = useLanguage();
  const normalized = normalizePriority(priority);
  const config = PRIORITY_COLORS[normalized];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${config.badgeClass} ${className}`.trim()}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${config.dotClass}`}
          aria-hidden="true"
        />
      )}
      {translatePriority(normalized)} {t('priority')}
    </span>
  );
};
