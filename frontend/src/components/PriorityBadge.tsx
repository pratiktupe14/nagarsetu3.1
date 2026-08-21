import React from 'react';
import { PriorityLevel } from '../types/database.types';
import { useLanguage } from '../context/LanguageContext';

export const PriorityBadge: React.FC<{ priority: PriorityLevel }> = ({ priority }) => {
  const { translatePriority, t } = useLanguage();
  const styles: Record<PriorityLevel, string> = {
    Low: 'bg-gray-50 text-gray-700 border-gray-200',
    Medium: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    High: 'bg-orange-50 text-orange-800 border-orange-200 font-semibold',
    Critical: 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${styles[priority] || styles.Medium}`}>
      {translatePriority(priority)} {t('priority')}
    </span>
  );
};
