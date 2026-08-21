import React from 'react';
import { getComplaintActivityLogs } from '../services/adminService';
import { ComplaintActivityLog } from '../types/database.types';
import { Clock, CheckCircle2, UserCheck, ShieldCheck, Sparkles, Building2, Wrench } from 'lucide-react';

export const ActivityTimeline: React.FC<{ complaintId: string }> = ({ complaintId }) => {
  const logs = getComplaintActivityLogs(complaintId);

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 font-outfit flex items-center space-x-1.5">
        <Clock className="w-4 h-4 text-emerald-600" />
        <span>Audit Trail & Activity Log</span>
      </h4>

      <div className="relative border-l-2 border-gray-200 ml-3 space-y-4 pl-4 py-1 text-xs">
        {logs.map((log) => (
          <div key={log.id} className="relative group">
            <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-emerald-600 border-2 border-white" />
            
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{log.action}</span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 text-[11px]">
                <span className="text-gray-500 font-medium">By: {log.actor_name}</span>
                {log.new_status && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ➔ {log.new_status}
                  </span>
                )}
              </div>

              {log.notes && (
                <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 mt-1">
                  {log.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
