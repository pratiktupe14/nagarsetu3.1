import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { Footer } from '../../components/Footer';
import { Complaint } from '../../types/database.types';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { CheckCircle2, ArrowRight, Copy } from 'lucide-react';

export const SubmissionSuccessPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const complaint = location.state?.complaint as Complaint | undefined;

  const [copied, setCopied] = React.useState(false);

  const handleCopyId = () => {
    if (complaint?.complaint_number) {
      navigator.clipboard.writeText(complaint.complaint_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-between">
      <Navbar />

      <main className="max-w-xl w-full mx-auto px-4 py-12 flex-1 flex items-center">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm w-full text-center space-y-6">
          
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">Complaint Submitted Successfully</h1>
            <p className="text-xs text-gray-500">Your issue has been logged into the municipal command system</p>
          </div>

          {complaint ? (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 text-left space-y-4 text-xs shadow-xs">
              
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-500 font-semibold">Unique Complaint ID</span>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-extrabold text-emerald-700 font-mono tracking-wider">
                    {complaint.complaint_number}
                  </span>
                  <button
                    onClick={handleCopyId}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Copy ID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copied && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Issue Title</span>
                  <h4 className="text-sm font-extrabold text-gray-900 leading-snug">{complaint.title}</h4>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Category</span>
                    <span className="font-semibold text-gray-800">{complaint.category}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Priority</span>
                    <PriorityBadge priority={complaint.priority} />
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Assigned Department</span>
                  <span className="font-semibold text-gray-800">{complaint.department_name || 'Public Works Department (PWD)'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <StatusBadge status={complaint.status} />
                <span className="text-[10px] text-gray-500 font-mono">
                  GPS: {complaint.latitude.toFixed(4)}, {complaint.longitude.toFixed(4)}
                </span>
              </div>

            </div>
          ) : null}

          <div className="pt-2 space-y-3">
            <button
              onClick={() => navigate(complaint ? `/citizen/complaint/${complaint.id}` : '/citizen/portal')}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all"
            >
              <span>Track Complaint</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link to="/citizen/portal" className="block text-xs font-semibold text-gray-500 hover:text-gray-800">
              Return to Citizen Dashboard
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};
