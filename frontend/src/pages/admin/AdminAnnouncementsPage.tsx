import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { createAnnouncement, createMaintenanceWork } from '../../services/announcementService';
import { AnnouncementCategory, AnnouncementPriority, PriorityLevel } from '../../types/database.types';
import { Megaphone, HardHat, CheckCircle2, ArrowLeft, PlusCircle } from 'lucide-react';

export const AdminAnnouncementsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'announcement' | 'maintenance'>('announcement');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Announcement Form State
  const [annTitle, setAnnTitle] = useState('');
  const [annTitleHi, setAnnTitleHi] = useState('');
  const [annTitleMr, setAnnTitleMr] = useState('');
  const [annDesc, setAnnDesc] = useState('');
  const [annDescHi, setAnnDescHi] = useState('');
  const [annDescMr, setAnnDescMr] = useState('');
  const [annCat, setAnnCat] = useState<AnnouncementCategory>('Water Supply');
  const [annArea, setAnnArea] = useState('Panchavati, Nashik');
  const [annPrio, setAnnPrio] = useState<AnnouncementPriority>('Important');
  const [annStartDate, setAnnStartDate] = useState('2026-08-21');
  const [annStartTime, setAnnStartTime] = useState('10:00 AM');
  const [annEndTime, setAnnEndTime] = useState('02:00 PM');
  const [annImage, setAnnImage] = useState('https://images.unsplash.com/photo-1542013936693-884638332954?w=800&auto=format&fit=crop&q=60');

  // Maintenance Work Form State
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintDept, setMaintDept] = useState('Roads & Public Works');
  const [maintArea, setMaintArea] = useState('M.G. Road, Panchavati, Nashik');
  const [maintPrio, setMaintPrio] = useState<PriorityLevel>('High');
  const [maintStartDate, setMaintStartDate] = useState('2026-08-20');
  const [maintCompletion, setMaintCompletion] = useState('2026-08-24');
  const [maintStaff, setMaintStaff] = useState('Suresh Patil (Road Supervisor)');
  const [maintImage, setMaintImage] = useState('https://images.unsplash.com/photo-1584467735815-f778f274e296?w=800&auto=format&fit=crop&q=60');

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annDesc) return;
    await createAnnouncement({
      title: annTitle,
      title_hi: annTitleHi || undefined,
      title_mr: annTitleMr || undefined,
      description: annDesc,
      description_hi: annDescHi || undefined,
      description_mr: annDescMr || undefined,
      category: annCat,
      area: annArea,
      priority: annPrio,
      start_date: annStartDate,
      start_time: annStartTime,
      end_time: annEndTime,
      image_url: annImage,
      status: 'Published',
      published_by: 'City Municipal Administration'
    });
    setSuccessMsg('✓ Announcement published successfully!');
    setTimeout(() => {
      setSuccessMsg(null);
      navigate('/citizen/announcements');
    }, 1500);
  };

  const handlePublishMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintTitle || !maintDesc) return;
    await createMaintenanceWork({
      title: maintTitle,
      description: maintDesc,
      department_name: maintDept,
      area: maintArea,
      latitude: 19.0760,
      longitude: 72.8777,
      status: 'In Progress',
      priority: maintPrio,
      start_date: maintStartDate,
      expected_completion: maintCompletion,
      assigned_staff_name: maintStaff,
      image_url: maintImage,
      created_by: 'City Admin'
    });
    setSuccessMsg('✓ Maintenance work update published successfully!');
    setTimeout(() => {
      setSuccessMsg(null);
      navigate('/citizen/work');
    }, 1500);
  };

  return (
    <DashboardLayout title="City Announcements">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">
            Publish Municipal Advisories & Maintenance Works
          </h1>
          <p className="text-xs text-gray-600">
            Publish official city announcements or launch new ongoing maintenance projects for public tracking.
          </p>
        </div>

        {/* SUCCESS TOAST */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB SELECTOR */}
        <div className="bg-gray-100 p-1 rounded-xl border border-gray-200 flex items-center space-x-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('announcement')}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all min-h-[44px] ${
              activeTab === 'announcement' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Megaphone className="w-4 h-4 text-emerald-600" />
            <span>Publish Official Announcement</span>
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all min-h-[44px] ${
              activeTab === 'maintenance' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <HardHat className="w-4 h-4 text-emerald-600" />
            <span>Publish Maintenance Work Update</span>
          </button>
        </div>

        {/* ANNOUNCEMENT FORM */}
        {activeTab === 'announcement' ? (
          <form onSubmit={handlePublishAnnouncement} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="font-extrabold text-gray-900 text-xs block">Multilingual Announcement Titles</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">English Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="English title"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Hindi Title (हिंदी)</label>
                  <input
                    type="text"
                    placeholder="हिंदी शीर्षक (वैकल्पिक)"
                    value={annTitleHi}
                    onChange={(e) => setAnnTitleHi(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Marathi Title (मराठी)</label>
                  <input
                    type="text"
                    placeholder="मराठी शीर्षक (वैकल्पिक)"
                    value={annTitleMr}
                    onChange={(e) => setAnnTitleMr(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[44px]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={annCat}
                  onChange={(e) => setAnnCat(e.target.value as any)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-emerald-800 min-h-[44px]"
                >
                  <option value="Water Supply">💧 Water Supply</option>
                  <option value="Road Work">🛣️ Road Work</option>
                  <option value="Sanitation">🚮 Sanitation</option>
                  <option value="Electrical">💡 Electrical</option>
                  <option value="Drainage">🚰 Drainage</option>
                  <option value="Traffic">🚦 Traffic</option>
                  <option value="General">📢 General</option>
                  <option value="Emergency">⚠️ Emergency</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Area / Ward</label>
                <input
                  type="text"
                  required
                  value={annArea}
                  onChange={(e) => setAnnArea(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[44px]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Priority</label>
                <select
                  value={annPrio}
                  onChange={(e) => setAnnPrio(e.target.value as any)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold min-h-[44px]"
                >
                  <option value="Normal">Normal</option>
                  <option value="Important">Important</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="font-extrabold text-gray-900 text-xs block">Multilingual Announcement Descriptions</span>
              
              <div>
                <label className="block font-bold text-gray-700 mb-1">English Message *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide detailed description in English..."
                  value={annDesc}
                  onChange={(e) => setAnnDesc(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Hindi Message (हिंदी)</label>
                  <textarea
                    rows={3}
                    placeholder="हिंदी विवरण (वैकल्पिक)..."
                    value={annDescHi}
                    onChange={(e) => setAnnDescHi(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Marathi Message (मराठी)</label>
                  <textarea
                    rows={3}
                    placeholder="मराठी विवरण (वैकल्पिक)..."
                    value={annDescMr}
                    onChange={(e) => setAnnDescMr(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider text-xs min-h-[44px]"
              >
                Publish Official Announcement →
              </button>
            </div>
          </form>
        ) : (
          /* MAINTENANCE WORK FORM */
          <form onSubmit={handlePublishMaintenance} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Maintenance Work Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Main Road Asphalt Resurfacing Work"
                value={maintTitle}
                onChange={(e) => setMaintTitle(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Department</label>
                <select
                  value={maintDept}
                  onChange={(e) => setMaintDept(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold min-h-[44px]"
                >
                  <option value="Roads & Public Works">Roads & Public Works</option>
                  <option value="Drainage & Stormwater">Drainage & Stormwater</option>
                  <option value="Electrical & Lighting">Electrical & Lighting</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Area / Location</label>
                <input
                  type="text"
                  required
                  value={maintArea}
                  onChange={(e) => setMaintArea(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[44px]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Assigned Field Staff</label>
                <input
                  type="text"
                  value={maintStaff}
                  onChange={(e) => setMaintStaff(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Work Description</label>
              <textarea
                required
                rows={4}
                placeholder="Describe scope of maintenance work, equipment deployed, and target resolution timeline..."
                value={maintDesc}
                onChange={(e) => setMaintDesc(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider text-xs min-h-[44px]"
              >
                Publish Work Update →
              </button>
            </div>
          </form>
        )}

      </div>
    </DashboardLayout>
  );
};
