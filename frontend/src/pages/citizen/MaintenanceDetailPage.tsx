import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { getMaintenanceWorkById } from '../../services/announcementService';
import { MaintenanceWork } from '../../types/database.types';
import {
  ArrowLeft, HardHat, Calendar, MapPin, CheckCircle2, Clock, Building2, UserCheck, ShieldCheck
} from 'lucide-react';

export const MaintenanceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [work, setWork] = useState<MaintenanceWork | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getMaintenanceWorkById(id).then((data) => {
        setWork(data);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="Maintenance Details">
        <div className="max-w-4xl mx-auto p-8 space-y-4 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!work) {
    return (
      <DashboardLayout title="Maintenance Details">
        <div className="max-w-4xl mx-auto p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Maintenance Work Record Not Found</h2>
          <Link to="/citizen/work" className="text-emerald-700 font-bold underline">
            ← Return to Ongoing Work
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const steps: MaintenanceWork['status'][] = ['Planned', 'Approved', 'In Progress', 'Completed'];
  const currentStepIndex = steps.indexOf(work.status as any);

  return (
    <DashboardLayout title="Maintenance Details">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* BACK LINK */}
        <Link
          to="/citizen/work"
          className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>← Back to Ongoing Work</span>
        </Link>

        {/* MAIN WORK CARD */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-6 p-6 sm:p-8">
          
          {work.image_url && (
            <div className="rounded-xl overflow-hidden h-72 bg-gray-100 border border-gray-200">
              <img src={work.image_url} alt={work.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-xs text-gray-700 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200 font-outfit">
                🏢 {work.department_name}
              </span>

              <span className="px-3 py-1 rounded-lg text-xs font-extrabold uppercase bg-amber-500 text-white">
                Status: {work.status}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit leading-tight">
              {work.title}
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 font-medium">
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Location: <strong>{work.area}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Start: <strong>{work.start_date}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Completion: <strong>{work.expected_completion}</strong></span>
              </div>
            </div>
          </div>

          {/* PROGRESS STEPPER TIMELINE */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-extrabold text-gray-900 font-outfit">Progress Timeline</h3>
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
              {steps.map((step, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <div key={step} className="space-y-1.5">
                    <div className={`h-2.5 rounded-full transition-all ${
                      isPassed ? 'bg-emerald-600' : 'bg-gray-200'
                    }`} />
                    <span className={isCurrent ? 'text-emerald-700 font-extrabold' : isPassed ? 'text-gray-900' : 'text-gray-400'}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-extrabold text-gray-900 font-outfit">Work Overview</h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {work.description}
            </p>
          </div>

          {work.assigned_staff_name && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs text-gray-800 font-semibold">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Assigned Field Incharge: <strong>{work.assigned_staff_name}</strong></span>
              </div>
              <span className="font-mono text-[10px] text-gray-500">Verified Service Staff</span>
            </div>
          )}

        </div>

      </div>
    </DashboardLayout>
  );
};
