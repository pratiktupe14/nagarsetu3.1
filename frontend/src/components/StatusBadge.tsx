import React from 'react';
import { ComplaintStatus } from '../types/database.types';
import { useLanguage } from '../context/LanguageContext';

export const StatusBadge: React.FC<{ status: ComplaintStatus }> = ({ status }) => {
  const { translateStatus } = useLanguage();
  const styles: Record<ComplaintStatus, string> = {
    Submitted: 'bg-gray-50 text-gray-700 border-gray-200',
    Verified: 'bg-blue-50 text-blue-700 border-blue-200',
    Approved: 'bg-blue-50 text-blue-700 border-blue-200',
    'Department Assigned': 'bg-sky-50 text-sky-700 border-sky-200',
    'Staff Assigned': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    Accepted: 'bg-sky-50 text-sky-800 border-sky-300 font-semibold',
    'On the Way': 'bg-indigo-50 text-indigo-800 border-indigo-300 font-semibold',
    'In Progress': 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
    'Resolution Submitted': 'bg-purple-50 text-purple-800 border-purple-300 font-bold',
    Resolved: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
    Reopened: 'bg-orange-50 text-orange-800 border-orange-300 font-bold',
    Rejected: 'bg-rose-50 text-rose-700 border-rose-200'
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${styles[status] || styles.Submitted}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {translateStatus(status)}
    </span>
  );
};
