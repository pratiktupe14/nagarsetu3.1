import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useLanguage } from '../../context/LanguageContext';
import { getAnnouncementById } from '../../services/announcementService';
import { OfficialAnnouncement } from '../../types/database.types';
import {
  ArrowLeft, Megaphone, Calendar, MapPin, Clock, ShieldCheck, Share2, Building2
} from 'lucide-react';

export const AnnouncementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { lang, t, translateCategory } = useLanguage();
  const [announcement, setAnnouncement] = useState<OfficialAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getAnnouncementById(id).then((data) => {
        setAnnouncement(data);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="Announcement Notice">
        <div className="max-w-4xl mx-auto p-8 space-y-4 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!announcement) {
    return (
      <DashboardLayout title="Announcement Notice">
        <div className="max-w-4xl mx-auto p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Announcement Not Found</h2>
          <Link to="/citizen/announcements" className="text-emerald-700 font-bold underline">
            ← {t('back')}
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const displayTitle = (lang === 'hi' && announcement.title_hi) ? announcement.title_hi : (lang === 'mr' && announcement.title_mr) ? announcement.title_mr : announcement.title;
  const displayDesc = (lang === 'hi' && announcement.description_hi) ? announcement.description_hi : (lang === 'mr' && announcement.description_mr) ? announcement.description_mr : announcement.description;

  return (
    <DashboardLayout title="Announcement Notice">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* BACK LINK */}
        <Link
          to="/citizen/announcements"
          className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>← {t('back')}</span>
        </Link>

        {/* MAIN ANNOUNCEMENT CARD */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-6 p-6 sm:p-8">
          
          {announcement.image_url && (
            <div className="rounded-xl overflow-hidden h-72 bg-gray-100 border border-gray-200">
              <img src={announcement.image_url} alt={displayTitle} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-xs text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 font-outfit">
                📢 {translateCategory(announcement.category)} Notice
              </span>

              <span className={`px-3 py-1 rounded-lg text-xs font-extrabold uppercase ${
                announcement.priority === 'Emergency'
                  ? 'bg-rose-600 text-white'
                  : announcement.priority === 'Important'
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}>
                {announcement.priority} Priority
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit leading-tight">
              {displayTitle}
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 font-medium">
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Area: <strong>{announcement.area}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Date: <strong>{announcement.start_date}</strong></span>
              </div>
              {announcement.start_time && (
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Time: <strong>{announcement.start_time} - {announcement.end_time || 'TBD'}</strong></span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-extrabold text-gray-900 font-outfit">Notice Details</h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {displayDesc}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900 font-semibold">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <span>Published by: <strong>{announcement.published_by}</strong></span>
            </div>
            <span className="font-mono text-[10px] text-emerald-700">Official Municipal Bulletin</span>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
};
