import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useLanguage } from '../../context/LanguageContext';
import { getMaintenanceWorks } from '../../services/announcementService';
import { MaintenanceWork } from '../../types/database.types';
import {
  HardHat, Search, Filter, Calendar, MapPin, Clock, ArrowRight, Building2, CheckCircle2
} from 'lucide-react';

function getMaintenanceBadge(status: MaintenanceWork['status']) {
  switch (status) {
    case 'Planned': return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'Approved': return 'bg-purple-50 text-purple-800 border-purple-200';
    case 'In Progress': return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Completed': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Delayed': return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'Cancelled': return 'bg-rose-50 text-rose-800 border-rose-200';
    default: return 'bg-gray-50 text-gray-800 border-gray-200';
  }
}

export const CitizenWorkPage: React.FC = () => {
  const { t, translateDepartment } = useLanguage();
  const [works, setWorks] = useState<MaintenanceWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All');

  useEffect(() => {
    getMaintenanceWorks().then((data) => {
      setWorks(data);
      setLoading(false);
    });
  }, []);

  const filtered = works.filter((w) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      w.title.toLowerCase().includes(q) ||
      w.description.toLowerCase().includes(q) ||
      w.area.toLowerCase().includes(q);

    const matchesStatus = selectedStatus === 'All' || w.status === selectedStatus;
    const matchesDept = selectedDept === 'All' || w.department_name === selectedDept;

    return matchesSearch && matchesStatus && matchesDept;
  });

  return (
    <DashboardLayout title={t('civicWorks')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              Ongoing Municipal Maintenance Work
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Track planned, ongoing, and completed civic infrastructure work performed by municipal departments.
            </p>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search maintenance work by title, department, or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:border-emerald-500 font-medium min-h-[44px]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-semibold text-gray-800 focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">Status: All</option>
                <option value="Planned">Planned</option>
                <option value="Approved">Approved</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Delayed">Delayed</option>
              </select>

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-semibold text-gray-800 focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">Department: All</option>
                <option value="Roads & Public Works">Roads & Public Works</option>
                <option value="Drainage & Stormwater">Drainage & Stormwater</option>
                <option value="Electrical & Lighting">Electrical & Lighting</option>
              </select>
            </div>
          </div>
        </div>

        {/* WORK CARDS GRID */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3 animate-pulse">
                <div className="h-36 bg-gray-100 rounded-xl" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-3">
            <HardHat className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-base font-extrabold text-gray-900 font-outfit">No ongoing municipal work matches your filter</h3>
            <p className="text-xs text-gray-500">Check back later or adjust your search filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {item.image_url && (
                    <div className="relative h-44 overflow-hidden bg-gray-100">
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                      <div className="absolute top-3 left-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border ${getMaintenanceBadge(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        🏢 {item.department_name}
                      </span>
                      <span className="font-mono text-[10px] text-gray-500">{item.start_date}</span>
                    </div>

                    <h3 className="text-base font-extrabold text-gray-900 leading-snug font-outfit line-clamp-2">
                      {item.title}
                    </h3>

                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>

                    <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs text-gray-500 font-medium">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Location: {item.area}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Expected Completion: <strong>{item.expected_completion}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <Link
                    to={`/citizen/work/${item.id}`}
                    className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all min-h-[44px]"
                  >
                    <span>View Work Timeline</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
