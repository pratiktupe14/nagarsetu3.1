import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { getCitizenComplaints, getComplaintById } from '../../services/complaintService';
import { calculateDistanceMeters } from '../../services/locationService';
import { Complaint, ComplaintStatus } from '../../types/database.types';
import { getApiUrl } from '../../config/apiConfig';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import { getValidImageUrl, DEFAULT_CIVIC_IMAGE_PLACEHOLDER } from '../../lib/supabase';
import { LiveGoogleMap } from '../../components/LiveGoogleMap';
import {
  Clock, Search, CheckCircle2, AlertTriangle, ArrowLeft, RefreshCw, Zap,
  Building2, UserCheck, FileText, Activity, ShieldCheck, Check, Sparkles, MapPin, ChevronRight, User
} from 'lucide-react';

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  statusMatch: (status: ComplaintStatus) => boolean;
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    key: 'submitted',
    label: 'Submitted',
    description: 'Complaint registered & queued',
    statusMatch: () => true // Always completed if complaint exists
  },
  {
    key: 'verified',
    label: 'Under Review',
    description: 'Officer verifying issue authenticity',
    statusMatch: (s) => s !== 'Submitted'
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Approved & routed for resolution',
    statusMatch: (s) => s !== 'Submitted' && s !== 'Verified' && s !== 'Rejected'
  },
  {
    key: 'dept_assigned',
    label: 'Department Assigned',
    description: 'Routed to responsible department',
    statusMatch: (s) => ['Department Assigned', 'Staff Assigned', 'Accepted', 'On the Way', 'In Progress', 'Resolution Submitted', 'Resolved'].includes(s)
  },
  {
    key: 'staff_assigned',
    label: 'Officer Assigned',
    description: 'Field officer dispatched to site',
    statusMatch: (s) => ['Staff Assigned', 'Accepted', 'On the Way', 'In Progress', 'Resolution Submitted', 'Resolved'].includes(s)
  },
  {
    key: 'in_progress',
    label: 'Work in Progress',
    description: 'Repair & maintenance active',
    statusMatch: (s) => ['Accepted', 'On the Way', 'In Progress', 'Resolution Submitted', 'Resolved'].includes(s)
  },
  {
    key: 'resolved',
    label: 'Resolved',
    description: 'Completed with photo proof',
    statusMatch: (s) => ['Resolution Submitted', 'Resolved'].includes(s)
  }
];

export const TrackComplaintPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadCitizenData = useCallback(async (targetId?: string) => {
    setLoading(true);
    setSearchError(null);
    try {
      const lookupId = targetId || id || searchInput.trim();
      let targetComp: Complaint | null = null;

      if (lookupId) {
        targetComp = await getComplaintById(lookupId);
      }

      const list = await getCitizenComplaints(user?.id || '');
      const safeList = Array.isArray(list) ? list : [];
      setComplaints(safeList);

      if (!targetComp && lookupId && safeList.length > 0) {
        targetComp = safeList.find((c) => (c.complaint_number && c.complaint_number.toLowerCase() === lookupId.toLowerCase()) || String(c.id) === String(lookupId)) || null;
      } else if (!targetComp && !lookupId && safeList.length > 0) {
        targetComp = safeList[0];
      }

      if (targetComp) {
        setActiveComplaint(targetComp);
        fetchStatusHistory(targetComp);
      } else if (lookupId) {
        setSearchError(`No complaint found with ID "${lookupId}". Please verify the complaint number.`);
        setActiveComplaint(null);
      } else {
        setActiveComplaint(null);
      }
    } catch (e) {
      console.error('Error loading complaint tracking:', e);
      setSearchError('Unable to load complaint details.');
    } finally {
      setLoading(false);
    }
  }, [user, id, searchInput]);

  const fetchStatusHistory = async (targetComp: Complaint) => {
    if (!targetComp) return;
    const lookupKey = targetComp.complaint_number || targetComp.id;
    try {
      const token = localStorage.getItem('nagarsetu_token');
      const response = await fetch(`${getApiUrl()}/api/complaints/${encodeURIComponent(lookupKey)}/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        if (data.history && Array.isArray(data.history) && data.history.length > 0) {
          setHistoryLogs(data.history);
          return;
        }
      }
    } catch (e) {
      // Fallback silent
    }

    // Default synthetic history entry if backend history is unavailable
    setHistoryLogs([
      {
        id: `hist-${targetComp.id}`,
        status: targetComp.status || 'Submitted',
        remark: `Complaint registered in municipal system with status: ${targetComp.status || 'Submitted'}.`,
        department: targetComp.department_name || 'Municipal Triage Queue',
        updated_by: targetComp.assigned_staff_name || 'System Dispatch',
        created_at: targetComp.created_at || new Date().toISOString()
      }
    ]);
  };

  useEffect(() => {
    loadCitizenData();
  }, [loadCitizenData]);

  // Realtime subscription callback
  useRealtimeComplaints(useCallback((payload) => {
    setLastLiveUpdate(new Date().toLocaleTimeString());
    
    if (activeComplaint && (payload.complaintId === activeComplaint.id || payload.complaintId === 'poll-refresh')) {
      getComplaintById(activeComplaint.id).then((updated) => {
        if (updated) {
          if (updated.status !== activeComplaint.status) {
            setToastMessage(`Status updated to "${updated.status}"`);
            setTimeout(() => setToastMessage(null), 6000);
          }
          setActiveComplaint(updated);
          fetchStatusHistory(updated);
        }
      });
    } else {
      loadCitizenData(activeComplaint?.id);
    }
  }, [activeComplaint, loadCitizenData]));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    loadCitizenData(searchInput.trim());
  };

  const getStepStatus = (step: TimelineStep, currentStatus: ComplaintStatus): 'completed' | 'current' | 'upcoming' | 'rejected' => {
    if (currentStatus === 'Rejected') {
      if (step.key === 'submitted') return 'completed';
      if (step.key === 'verified') return 'rejected';
      return 'upcoming';
    }

    const isStepCompleted = step.statusMatch(currentStatus);
    if (isStepCompleted) {
      // Check if this is the active current step
      const stepIndex = TIMELINE_STEPS.findIndex((s) => s.key === step.key);
      const nextStep = TIMELINE_STEPS[stepIndex + 1];
      if (!nextStep || !nextStep.statusMatch(currentStatus)) {
        return 'current';
      }
      return 'completed';
    }
    return 'upcoming';
  };

  return (
    <DashboardLayout title="Track Complaint Status">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 font-sans">
        
        {/* REALTIME LIVE TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-900 text-white border border-emerald-500 shadow-xl flex items-center space-x-3 animate-bounce font-sans">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div className="text-xs font-bold">
              <span className="block text-emerald-300 uppercase tracking-wider text-[10px]">Realtime Update</span>
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* TOP BAR & LIVE INDICATOR */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Link
                to="/citizen/portal"
                className="inline-flex items-center space-x-1 text-xs font-bold text-gray-500 hover:text-emerald-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Citizen Portal</span>
              </Link>
              <span className="text-gray-300">|</span>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>● Live updates enabled</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit pt-1">
              Complaint Status Tracker
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Track your complaint and see real-time updates without refreshing the page.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => loadCitizenData(activeComplaint?.id)}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center space-x-1.5 min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* COMPLAINT ID SEARCH BAR */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-sm font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
            Track by Complaint ID / Number
          </h2>
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Enter Complaint Number (e.g. NS-2026-123456 or comp-1700000)"
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:border-emerald-500 focus:outline-none min-h-[44px]"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-sm min-h-[44px]"
            >
              Track Complaint
            </button>
          </form>

          {searchError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </div>

        {/* CITIZEN MY COMPLAINTS QUICK SWITCHER */}
        {complaints.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider font-outfit">
              Your Reported Complaints ({complaints.length})
            </h3>
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-thin">
              {complaints.map((c) => {
                const isSelected = activeComplaint?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveComplaint(c);
                      fetchStatusHistory(c);
                    }}
                    className={`p-4 rounded-xl border text-left shrink-0 w-64 transition-all min-h-[44px] ${
                      isSelected
                        ? 'bg-emerald-50/60 border-emerald-500 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-extrabold text-emerald-800">
                        {c.complaint_number}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs font-bold text-gray-900 truncate">{c.title}</p>
                    <span className="text-[10px] text-gray-500 block pt-1 font-mono">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ACTIVE COMPLAINT TRACKING DASHBOARD */}
        {loading ? (
          <div className="bg-white rounded-3xl p-16 text-center space-y-3 border border-gray-200 shadow-sm">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-bold text-gray-600 font-outfit">Fetching live GIS complaint status...</p>
          </div>
        ) : activeComplaint ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* LEFT COLUMN: COMPLAINT DETAILS & TIMELINE STEPPER */}
            <div className="lg:col-span-5 space-y-5">
              
              {/* CARD 1: LIVE COMPLAINT DETAILS */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4 font-sans">
                
                {/* CARD HEADER & LIVE STATUS ACCENT */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse mr-0.5" />
                    <span>LIVE COMPLAINT TRACKING</span>
                  </span>

                  <span className="text-[10px] font-bold text-gray-500 font-mono">
                    NAGARSETU GIS
                  </span>
                </div>

                {/* COMPLAINT ID & TITLE */}
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-emerald-700 font-mono bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 inline-block">
                    {activeComplaint.complaint_number}
                  </span>
                  <h2 className="text-base sm:text-lg font-extrabold text-gray-900 font-outfit leading-tight pt-1">
                    {activeComplaint.title}
                  </h2>
                </div>

                {/* LOCATION ADDRESS */}
                <div className="flex items-start space-x-2 text-xs text-gray-600 bg-slate-50 p-2.5 rounded-xl border border-gray-100 font-mono">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="truncate">{activeComplaint.location_address || 'Rajaram Road, Kolhapur, Maharashtra'}</span>
                </div>

                {/* STATUS & PRIORITY BADGES */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusBadge status={activeComplaint.status} />
                  <PriorityBadge priority={activeComplaint.priority} />
                </div>

                {/* METADATA GRID */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-100">
                  <div className="bg-slate-50/80 p-2.5 rounded-xl border border-gray-100 space-y-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">Department</span>
                    <span className="font-extrabold text-gray-900 text-[11px] block truncate font-outfit">
                      {activeComplaint.department_name || 'Streetlight / Electrical'}
                    </span>
                  </div>

                  <div className="bg-slate-50/80 p-2.5 rounded-xl border border-gray-100 space-y-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">Assigned Officer</span>
                    <span className="font-extrabold text-emerald-800 text-[11px] block truncate font-outfit flex items-center space-x-1">
                      <User className="w-3 h-3 text-emerald-600 inline mr-0.5" />
                      <span>{activeComplaint.assigned_staff_name || 'Electrical Maintenance Team'}</span>
                    </span>
                  </div>

                  <div className="bg-slate-50/80 p-2.5 rounded-xl border border-gray-100 space-y-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">Reported On</span>
                    <span className="font-mono text-[10px] text-gray-700 block">
                      {new Date(activeComplaint.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="bg-slate-50/80 p-2.5 rounded-xl border border-gray-100 space-y-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">Last Updated</span>
                    <span className="font-mono text-[10px] text-gray-700 block">
                      {new Date(activeComplaint.updated_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* PHOTO EVIDENCE THUMBNAILS */}
                {activeComplaint.photo_before_url && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block font-mono mb-1.5">
                      Photo Evidence
                    </span>
                    <div className="flex space-x-2">
                      <div className="w-20 h-16 rounded-xl overflow-hidden border border-gray-200 shrink-0 bg-gray-100">
                        <img
                          src={getValidImageUrl(activeComplaint.photo_before_url)}
                          alt="Before"
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.src = DEFAULT_CIVIC_IMAGE_PLACEHOLDER; }}
                        />
                      </div>
                      {activeComplaint.photo_after_url && (
                        <div className="w-20 h-16 rounded-xl overflow-hidden border-2 border-emerald-400 shrink-0 bg-emerald-50">
                          <img
                            src={getValidImageUrl(activeComplaint.photo_after_url)}
                            alt="After"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.src = DEFAULT_CIVIC_IMAGE_PLACEHOLDER; }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* CARD 2: LIVE STATUS TIMELINE STEPPER */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3.5 font-sans">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="text-xs font-extrabold text-gray-900 font-outfit uppercase tracking-wider flex items-center space-x-1.5">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>LIVE STATUS TIMELINE</span>
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                    {activeComplaint.status}
                  </span>
                </div>

                {/* VERTICAL STEPPER LIST */}
                <div className="relative pl-3 border-l-2 border-emerald-200 space-y-3.5 text-xs font-sans my-1">
                  {TIMELINE_STEPS.map((step) => {
                    const stepState = getStepStatus(step, activeComplaint.status);

                    let iconNode = <span className="w-2 h-2 rounded-full bg-gray-300" />;
                    let labelColor = 'text-gray-400 font-normal';
                    let badgeTag = null;

                    if (stepState === 'completed') {
                      iconNode = <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-extrabold">✓</span>;
                      labelColor = 'text-gray-900 font-bold';
                    } else if (stepState === 'current') {
                      iconNode = <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-extrabold animate-pulse">●</span>;
                      labelColor = 'text-emerald-800 font-extrabold';
                      badgeTag = <span className="ml-2 text-[9px] font-mono font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">Active</span>;
                    } else if (stepState === 'rejected') {
                      iconNode = <span className="w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-extrabold">✕</span>;
                      labelColor = 'text-rose-700 font-bold';
                    }

                    return (
                      <div key={step.key} className="relative flex items-start space-x-2.5">
                        <div className="absolute -left-[19px] top-0.5 flex items-center justify-center bg-white rounded-full">
                          {iconNode}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${labelColor} font-outfit`}>
                              {step.label}
                              {badgeTag}
                            </span>
                            {stepState === 'completed' && (
                              <span className="text-[10px] font-mono text-gray-400">
                                {new Date(activeComplaint.updated_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500 block leading-tight pt-0.5 font-sans">
                            {step.description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CARD 3: LATEST OFFICER REMARKS */}
              {historyLogs.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 font-sans">
                  <h4 className="font-extrabold text-gray-900 font-outfit text-xs border-b border-gray-100 pb-2 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Latest Officer Remarks</span>
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {historyLogs.slice(0, 5).map((log, index) => (
                      <div key={log.id || index} className="p-2.5 bg-slate-50 rounded-xl border border-gray-100 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-gray-900">{log.updated_by || 'Officer'}</span>
                          <span className="font-mono text-[10px] text-gray-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                        </div>
                        {log.remark && (
                          <p className="text-[11px] text-gray-700 italic bg-white p-2 rounded-lg border border-gray-100">
                            "{log.remark}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* RIGHT COLUMN: INTERACTIVE GIS MAP & LIVE STATUS BAR */}
            <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-20">
              
              {/* GIS MAP CONTAINER */}
              <div className="relative w-full h-[520px] sm:h-[580px] rounded-3xl overflow-hidden border border-gray-200 shadow-sm bg-slate-50">
                <LiveGoogleMap
                  complaint={activeComplaint}
                  nearbyComplaints={complaints.filter((nc) => {
                    if (nc.id === activeComplaint.id) return false;
                    if (nc.latitude == null || nc.longitude == null || activeComplaint.latitude == null || activeComplaint.longitude == null) return false;
                    const d = calculateDistanceMeters(
                      Number(activeComplaint.latitude),
                      Number(activeComplaint.longitude),
                      Number(nc.latitude),
                      Number(nc.longitude)
                    );
                    return d <= 1000;
                  })}
                  isRealtimeConnected={true}
                />
              </div>

              {/* LIVE STATUS BAR (POSITIONED CLEANLY BELOW MAP) */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between font-sans text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="font-extrabold text-emerald-800 font-outfit">● Live Updates Active</span>
                  <span className="hidden md:inline text-gray-500 font-medium">— You will receive real-time updates for this complaint.</span>
                </div>

                <div className="flex items-center space-x-3 font-mono text-[11px] text-gray-500">
                  <span>Last updated: {new Date(activeComplaint.updated_at).toLocaleTimeString()}</span>
                  <span className="hidden sm:inline font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    NAGARSETU GIS
                  </span>
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-4 shadow-sm">
            <FileText className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-900 font-outfit">No Active Complaint Selected</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Please enter your Complaint ID above or report a new civic issue.
            </p>
            <Link
              to="/citizen/report"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase shadow-sm hover:bg-emerald-700 min-h-[44px]"
            >
              <span>+ Report Civic Issue</span>
            </Link>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
