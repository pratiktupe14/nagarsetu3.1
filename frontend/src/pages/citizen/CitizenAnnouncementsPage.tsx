import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useLanguage } from '../../context/LanguageContext';
import { getOfficialAnnouncements } from '../../services/announcementService';
import { OfficialAnnouncement } from '../../types/database.types';
import {
  Megaphone, Search, Filter, Calendar, MapPin, Clock, ArrowRight, ShieldCheck, AlertTriangle
} from 'lucide-react';

export const CitizenAnnouncementsPage: React.FC = () => {
  const { lang, t, translateCategory } = useLanguage();
  const [announcements, setAnnouncements] = useState<OfficialAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');

  useEffect(() => {
    getOfficialAnnouncements().then((data) => {
      setAnnouncements(data);
      setLoading(false);
    });
  }, []);

  const filtered = announcements.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.area.toLowerCase().includes(q);

    const matchesCat = selectedCategory === 'All' || a.category === selectedCategory;
    const matchesPrio = selectedPriority === 'All' || a.priority === selectedPriority;

    return matchesSearch && matchesCat && matchesPrio;
  });

  return (
    <DashboardLayout title="Announcements">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              Official Municipal Announcements
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Stay updated with official notices, maintenance advisories, and emergency alerts.
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
                placeholder="Search announcements by title, area, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:border-emerald-500 font-medium min-h-[44px]"
              />
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-semibold text-gray-800 focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">Priority: All</option>
                <option value="Emergency">Emergency</option>
                <option value="Important">Important</option>
                <option value="Normal">Normal</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 border-t border-gray-100 pt-3 overflow-x-auto font-semibold">
            {['All', 'Water Supply', 'Road Work', 'Sanitation', 'Electrical', 'Drainage', 'Traffic', 'Emergency'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap min-h-[44px] ${
                  selectedCategory === cat
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-600 font-extrabold shadow-xs'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ANNOUNCEMENT CARDS GRID */}
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
            <Megaphone className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-base font-extrabold text-gray-900 font-outfit">No official announcements match your filter</h3>
            <p className="text-xs text-gray-500">Check back soon for municipal updates or reset your filter settings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => {
              const displayTitle = (lang === 'hi' && item.title_hi) ? item.title_hi : (lang === 'mr' && item.title_mr) ? item.title_mr : item.title;
              const displayDesc = (lang === 'hi' && item.description_hi) ? item.description_hi : (lang === 'mr' && item.description_mr) ? item.description_mr : item.description;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                    item.priority === 'Emergency' ? 'border-rose-300 ring-1 ring-rose-200' : 'border-gray-200'
                  }`}
                >
                  <div>
                    {item.image_url && (
                      <div className="relative h-44 overflow-hidden bg-gray-100">
                        <img src={item.image_url} alt={displayTitle} className="w-full h-full object-cover" />
                        <div className="absolute top-3 left-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                            item.priority === 'Emergency'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : item.priority === 'Important'
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}>
                            {item.priority}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 font-outfit">
                          📢 {translateCategory(item.category)}
                        </span>
                        <span className="font-mono text-[10px] text-gray-500">{item.start_date}</span>
                      </div>

                      <h3 className="text-base font-extrabold text-gray-900 leading-snug font-outfit line-clamp-2">
                        {displayTitle}
                      </h3>

                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                        {displayDesc}
                      </p>

                      <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs text-gray-500 font-medium">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Area: {item.area}</span>
                        </div>
                        {item.start_time && (
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Timing: {item.start_time} - {item.end_time || 'TBD'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <Link
                      to={`/citizen/announcements/${item.id}`}
                      className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all min-h-[44px]"
                    >
                      <span>{t('view')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
