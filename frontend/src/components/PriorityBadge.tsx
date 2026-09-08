import React from 'react';
import { PriorityLevel } from '../types/database.types';
import { useLanguage } from '../context/LanguageContext';

export const PriorityBadge: React.FC<{ priority: PriorityLevel }> = ({ priority }) => {
  const { translatePriority, t } = useLanguage();
  const styles: Record<PriorityLevel, string> = {
    Low: 'bg-gray-100 text-gray-800 border-gray-300',
    Medium: 'bg-amber-50 text-amber-900 border-amber-300 font-semibold',
    High: 'bg-orange-50 text-orange-900 border-orange-300 font-bold',
    Critical: 'bg-rose-50 text-rose-900 border-rose-300 font-extrabold'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${styles[priority] || styles.Medium}`}>
      {translatePriority(priority)} {t('priority')}
    </span>
  );
};
