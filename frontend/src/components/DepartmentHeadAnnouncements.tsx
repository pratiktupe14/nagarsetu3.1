import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Megaphone, Bell, Calendar, Lock, CheckCircle2, Search,
  ChevronRight, RefreshCw, AlertTriangle, ShieldAlert,
  Info, Wrench, Zap, Filter, Eye, X, Check, ArrowRight
} from 'lucide-react';
import {
  getDepartmentHeadAnnouncements,
  markAnnouncementAsRead,
  AnnouncementItem,
  AnnouncementType
} from '../services/announcementService';

interface DepartmentHeadAnnouncementsProps {
  departmentName?: string;
  departmentShortName?: string;
  className?: string;
}

export const DepartmentHeadAnnouncements: React.FC<DepartmentHeadAnnouncementsProps> = ({
  departmentName = 'Public Works Department',
  departmentShortName = 'PWD',
  className = ''
}) => {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View All Modal State
  const [showAllModal, setShowAllModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [onlyUnread, setOnlyUnread] = useState(false);

  // Detail Modal State
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);

  // Load announcements
  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDepartmentHeadAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      console.error('Failed to load department announcements:', err);
      setError('Unable to load announcements. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // Mark an announcement as read
  const handleOpenDetail = async (ann: AnnouncementItem) => {
    setSelectedAnnouncement(ann);
    if (!ann.is_read) {
      // Optimistic update
      setAnnouncements((prev) =>
        prev.map((item) => (item.id === ann.id ? { ...item, is_read: true } : item))
      );
      await markAnnouncementAsRead(ann.id);
    }
  };

  // Compute unread count
  const unreadCount = useMemo(() => {
    return announcements.filter((a) => !a.is_read).length;
  }, [announcements]);

  // Filtered announcements for modal
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((ann) => {
      if (onlyUnread && ann.is_read) return false;
      if (selectedTypeFilter !== 'All') {
        if (selectedTypeFilter === 'Unread' && ann.is_read) return false;
        if (selectedTypeFilter !== 'Unread' && ann.type !== selectedTypeFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const tMatch = ann.title.toLowerCase().includes(q);
        const dMatch = ann.description.toLowerCase().includes(q);
        const deptMatch = (ann.department_name || '').toLowerCase().includes(q);
        const typeMatch = (ann.type || '').toLowerCase().includes(q);
        if (!tMatch && !dMatch && !deptMatch && !typeMatch) return false;
      }
      return true;
    });
  }, [announcements, onlyUnread, selectedTypeFilter, searchQuery]);

  // Helper badge color picker
  const getTypeBadgeStyle = (type: AnnouncementType) => {
    switch (type) {
      case 'Emergency':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold';
      case 'Urgent':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold';
      case 'Important':
        return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
      case 'Maintenance':
        return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
      case 'System Update':
        return 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 font-semibold';
    }
  };

  const getPriorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-rose-600 text-white font-mono uppercase text-[10px] px-2 py-0.5 rounded';
      case 'High':
        return 'bg-amber-600 text-white font-mono uppercase text-[10px] px-2 py-0.5 rounded';
      default:
        return 'bg-slate-200 text-slate-700 font-mono uppercase text-[10px] px-2 py-0.5 rounded';
    }
  };

  return (
    <div className={`space-y-4 font-sans ${className}`}>
      {/* DASHBOARD WIDGET HEADER */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <Megaphone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-extrabold text-gray-900 font-outfit">
                  Municipal Announcements & Advisories
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold font-mono animate-pulse">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Official notices, emergency protocols, and municipal updates for {departmentShortName}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={loadAnnouncements}
              disabled={loading}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors disabled:opacity-50 text-xs font-bold flex items-center space-x-1"
              title="Refresh Announcements"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowAllModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs border border-emerald-200 flex items-center space-x-1.5 transition-colors"
            >
              <span>View All ({announcements.length})</span>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
            </button>
          </div>
        </div>

        {/* LOADING SKELETON */}
        {loading && announcements.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-2 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-1/3 bg-gray-300 rounded"></div>
                  <div className="h-3 w-16 bg-gray-200 rounded"></div>
                </div>
                <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2 text-rose-800 font-medium text-center">
            <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
            <p>{error}</p>
            <button
              onClick={loadAnnouncements}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs"
            >
              Retry Loading
            </button>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !error && announcements.length === 0 && (
          <div className="p-8 text-center bg-slate-50 border border-gray-200 rounded-xl space-y-2">
            <Bell className="w-10 h-10 text-gray-400 mx-auto" />
            <h4 className="text-xs font-extrabold text-gray-900 font-outfit">No announcements</h4>
            <p className="text-[11px] text-gray-500 font-medium max-w-xs mx-auto">
              New announcements from municipal administration will appear here automatically.
            </p>
          </div>
        )}

        {/* TOP 3 ANNOUNCEMENTS CARDS LIST */}
        {!loading && !error && announcements.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {announcements.slice(0, 3).map((ann) => (
              <div
                key={ann.id}
                onClick={() => handleOpenDetail(ann)}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between space-y-3 relative group ${
                  !ann.is_read
                    ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-white border-gray-200 hover:border-emerald-300'
                }`}
              >
                {!ann.is_read && (
                  <div className="absolute top-3 right-3 flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-extrabold font-mono">
                      NEW
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <span className={`px-2 py-0.5 rounded border text-[10px] ${getTypeBadgeStyle(ann.type)}`}>
                      {ann.type}
                    </span>
                    <span className={getPriorityBadgeStyle(ann.priority)}>
                      {ann.priority}
                    </span>
                  </div>

                  <h3 className="text-xs font-extrabold text-gray-900 font-outfit line-clamp-2 group-hover:text-emerald-700 transition-colors">
                    📢 {ann.title}
                  </h3>

                  <p className="text-[11px] text-gray-600 font-medium line-clamp-2 leading-relaxed">
                    {ann.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] font-mono text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span>{ann.published_at ? new Date(ann.published_at).toLocaleDateString() : 'Today'}</span>
                  </div>
                  <span className="font-semibold text-emerald-800">
                    {ann.target_type === 'all' ? 'All Departments' : ann.department_name || departmentShortName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* VIEW ALL ANNOUNCEMENTS WORKSPACE MODAL / DRAWER */}
      {/* ================================================== */}
      {showAllModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 border border-gray-200 shadow-xl my-8 font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Megaphone className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 font-outfit text-lg">
                    Municipal Announcements Directory
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Filtered for {departmentName} • {announcements.length} Total Notices
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SEARCH & TYPE FILTER TOOLBAR */}
            <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search announcements by title, content, or department..."
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium"
                  />
                </div>

                <label className="flex items-center space-x-2 font-extrabold text-gray-700 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={onlyUnread}
                    onChange={(e) => setOnlyUnread(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Unread Only</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {['All', 'Unread', 'Emergency', 'Urgent', 'Important', 'Maintenance', 'System Update', 'General'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors ${
                      selectedTypeFilter === t
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* ANNOUNCEMENTS GRID IN MODAL */}
            {filteredAnnouncements.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 border border-gray-200 rounded-xl space-y-2">
                <Bell className="w-10 h-10 text-gray-400 mx-auto" />
                <h4 className="text-xs font-extrabold text-gray-900 font-outfit">No matching announcements</h4>
                <p className="text-[11px] text-gray-500 font-medium max-w-xs mx-auto">
                  Try adjusting your search keyword or selected type filters.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {filteredAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    onClick={() => handleOpenDetail(ann)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-xs space-y-2.5 ${
                      !ann.is_read
                        ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300/40'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        {!ann.is_read && (
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold font-mono">
                            ● NEW
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded border text-[11px] ${getTypeBadgeStyle(ann.type)}`}>
                          {ann.type}
                        </span>
                        <span className={getPriorityBadgeStyle(ann.priority)}>
                          {ann.priority}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-mono font-bold border border-gray-200">
                          Target: {ann.target_type === 'all' ? 'All Departments' : ann.department_name}
                        </span>
                      </div>

                      <span className="font-mono text-[11px] text-gray-500">
                        {ann.published_at ? new Date(ann.published_at).toLocaleString() : 'N/A'}
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-gray-900 font-outfit flex items-center space-x-1.5">
                      <span>📢 {ann.title}</span>
                    </h4>

                    <p className="text-xs text-gray-700 leading-relaxed font-medium">
                      {ann.description}
                    </p>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-gray-500 font-medium">
                        Posted by: <strong className="text-gray-800 font-bold">{ann.posted_by}</strong>
                      </span>
                      <span className="text-emerald-700 font-extrabold text-[11px] hover:underline flex items-center space-x-1">
                        <span>Read Full Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowAllModal(false)}
                className="px-5 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs hover:bg-gray-800"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* SINGLE ANNOUNCEMENT FULL DETAIL MODAL */}
      {/* ================================================== */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-gray-200 shadow-2xl my-8 font-sans">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <Megaphone className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">
                  Official Municipal Advisory
                </h3>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className={`px-2.5 py-0.5 rounded border text-xs ${getTypeBadgeStyle(selectedAnnouncement.type)}`}>
                  {selectedAnnouncement.type}
                </span>
                <span className={getPriorityBadgeStyle(selectedAnnouncement.priority)}>
                  {selectedAnnouncement.priority} Priority
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-xs font-mono font-bold border border-emerald-200">
                  Target: {selectedAnnouncement.target_type === 'all' ? 'All Departments' : selectedAnnouncement.department_name}
                </span>
              </div>

              <h2 className="text-lg font-extrabold text-gray-900 font-outfit">
                📢 {selectedAnnouncement.title}
              </h2>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 text-xs text-gray-800 leading-relaxed font-medium space-y-2 whitespace-pre-wrap">
              {selectedAnnouncement.description}
            </div>

            <div className="p-3 bg-gray-100 rounded-xl text-xs grid grid-cols-2 gap-2 font-mono text-gray-600">
              <div>
                <span className="text-[10px] text-gray-400 block font-bold uppercase">Issued By</span>
                <strong className="text-gray-900 font-bold">{selectedAnnouncement.posted_by}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-bold uppercase">Publish Date</span>
                <strong className="text-gray-900 font-bold">
                  {selectedAnnouncement.published_at ? new Date(selectedAnnouncement.published_at).toLocaleString() : 'N/A'}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-5 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs hover:bg-gray-800"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
