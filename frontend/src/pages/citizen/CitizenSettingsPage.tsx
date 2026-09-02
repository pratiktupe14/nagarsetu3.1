import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LanguageSelector } from '../../components/LanguageSelector';
import { clearOfflineDrafts, getOfflineDrafts } from '../../services/complaintService';
import {
  Globe, Bell, MapPin, Sliders, ShieldCheck, Eye, Sparkles, Trash2, User,
  CheckCircle2, AlertTriangle, Save, HelpCircle, Info, Sun, Smartphone, Mail, Lock
} from 'lucide-react';

export const CitizenSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Settings Tab on Desktop
  const [activeSection, setActiveSection] = useState<
    'general' | 'notifications' | 'location' | 'complaints' | 'privacy' | 'accessibility' | 'data' | 'account' | 'about'
  >('general');

  // General Settings State
  const [language, setLanguage] = useState(user?.language_pref || localStorage.getItem('nagarsetu_lang') || localStorage.getItem('nagarsetu_language') || 'en');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState('12 Hours (AM/PM)');

  // Notification Settings State
  const [notifyStatusUpdates, setNotifyStatusUpdates] = useState(true);
  const [notifyResolutionUpdates, setNotifyResolutionUpdates] = useState(true);
  const [notifyNearbyAlerts, setNotifyNearbyAlerts] = useState(true);
  const [notifyCriticalAlerts, setNotifyCriticalAlerts] = useState(true);

  // Location Settings State
  const [defaultRadius, setDefaultRadius] = useState(
    Number(localStorage.getItem('nagarsetu_default_radius')) || 500
  );
  const [gpsEnabled, setGpsEnabled] = useState(true);

  // Complaint Settings State
  const [showDuplicateWarnings, setShowDuplicateWarnings] = useState(true);
  const [confirmLocationBeforeSubmit, setConfirmLocationBeforeSubmit] = useState(true);

  // Accessibility State
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largerText, setLargerText] = useState(false);

  // Save Toast & Confirmation Modal State
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showClearDraftsModal, setShowClearDraftsModal] = useState(false);
  const [draftCount, setDraftCount] = useState(getOfflineDrafts().length);

  // Save Settings Function
  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    localStorage.setItem('nagarsetu_language', language);
    localStorage.setItem('nagarsetu_default_radius', String(defaultRadius));

    // Apply Accessibility to DOM if requested
    if (reduceMotion) {
      document.documentElement.classList.add('motion-reduce');
    } else {
      document.documentElement.classList.remove('motion-reduce');
    }

    setSaveSuccessMsg('✓ Settings saved successfully');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Clear Offline Drafts
  const handleConfirmClearDrafts = () => {
    clearOfflineDrafts();
    setDraftCount(0);
    setShowClearDraftsModal(false);
    setSaveSuccessMsg('✓ Saved offline drafts cleared');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const navSections = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'location', label: 'Location & Map', icon: MapPin },
    { id: 'complaints', label: 'Complaint Preferences', icon: Sliders },
    { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
    { id: 'accessibility', label: 'Accessibility', icon: Eye },
    { id: 'data', label: 'Data & Storage', icon: Trash2 },
    { id: 'account', label: 'Account Summary', icon: User },
    { id: 'about', label: 'About NAGARSETU', icon: Info }
  ] as const;

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* PAGE HEADER */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              Settings
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Manage your preferences and NAGARSETU civic experience.
            </p>
          </div>

          <button
            onClick={() => handleSaveSettings()}
            className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>

        {/* SAVE SUCCESS TOAST */}
        {saveSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center space-x-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* DESKTOP SPLIT / MOBILE STACKED LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SETTINGS MENU (3 COLS DESKTOP) */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-3 border border-gray-200 shadow-sm space-y-1 font-semibold text-xs">
            <span className="px-3 py-2 text-[10px] uppercase font-extrabold text-gray-400 block tracking-wider font-outfit">
              Settings Navigation
            </span>
            {navSections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full px-3.5 py-3 rounded-xl flex items-center space-x-2.5 transition-all min-h-[44px] ${
                  activeSection === id
                    ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 font-extrabold shadow-xs'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${activeSection === id ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* RIGHT SETTINGS CONTENT PANEL (9 COLS DESKTOP) */}
          <div className="lg:col-span-9 space-y-6">
            
            {/* GENERAL SETTINGS */}
            {(activeSection === 'general' || window.innerWidth < 1024) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <Globe className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">General Settings</h2>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <LanguageSelector variant="full" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Date Format</label>
                      <select
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-semibold min-h-[44px]"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 20/08/2026)</option>
                        <option value="MMM DD, YYYY">MMM DD, YYYY (e.g. Aug 20, 2026)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Time Format</label>
                      <select
                        value={timeFormat}
                        onChange={(e) => setTimeFormat(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-semibold min-h-[44px]"
                      >
                        <option value="12 Hours (AM/PM)">12 Hours (AM/PM)</option>
                        <option value="24 Hours">24 Hours (Railway Time)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NOTIFICATION SETTINGS */}
            {(activeSection === 'notifications' || window.innerWidth < 1024) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <Bell className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">Notification Settings</h2>
                </div>

                <div className="space-y-4 text-xs">
                  {[
                    {
                      title: 'Complaint Status Updates',
                      desc: 'Receive real-time alerts when municipal admin or staff updates complaint status.',
                      state: notifyStatusUpdates,
                      setState: setNotifyStatusUpdates
                    },
                    {
                      title: 'Resolution Notifications',
                      desc: 'Get notified when field repair proof is submitted or verified by City Administration.',
                      state: notifyResolutionUpdates,
                      setState: setNotifyResolutionUpdates
                    },
                    {
                      title: 'Nearby Civic Issue Alerts',
                      desc: 'Receive alerts about important civic maintenance tasks logged near your location.',
                      state: notifyNearbyAlerts,
                      setState: setNotifyNearbyAlerts
                    },
                    {
                      title: 'Critical Civic Alerts',
                      desc: 'Receive high-priority alerts for critical civic emergencies (water bursts, traffic outages).',
                      state: notifyCriticalAlerts,
                      setState: setNotifyCriticalAlerts,
                      locked: true
                    }
                  ].map((item) => (
                    <div key={item.title} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="space-y-0.5 max-w-lg">
                        <span className="font-bold text-gray-900 block">{item.title}</span>
                        <p className="text-[11px] text-gray-500">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => !item.locked && item.setState(!item.state)}
                        className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none min-h-[44px] flex items-center ${
                          item.state ? 'bg-emerald-600' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`w-4 h-4 bg-white rounded-full transition-transform transform shadow-xs ${
                          item.state ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}

                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <span className="font-bold text-gray-900 block">Notification Delivery Channels</span>
                    <div className="flex flex-wrap gap-3">
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>In-App Notifications (Active)</span>
                      </span>
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Email Digest (Active)</span>
                      </span>
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-gray-100 text-gray-500 font-semibold border border-gray-200">
                        <span>SMS Dispatch (Coming Soon)</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* LOCATION SETTINGS */}
            {(activeSection === 'location' || window.innerWidth < 1024) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">Location Services & Map Preferences</h2>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-900 block">GPS Location Access</span>
                      <p className="text-[11px] text-gray-500">Allow NAGARSETU to use device location for issue mapping and Nearby Issues.</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      Status: Enabled
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Default Search Radius for Nearby Issues</label>
                    <p className="text-[11px] text-gray-500 mb-2">Controls default radius when opening the Nearby Issues civic map.</p>
                    <select
                      value={defaultRadius}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDefaultRadius(val);
                        localStorage.setItem('nagarsetu_default_radius', String(val));
                        setSaveSuccessMsg('✓ Default search radius updated');
                        setTimeout(() => setSaveSuccessMsg(null), 3000);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-emerald-800 font-extrabold min-h-[44px]"
                    >
                      <option value={100}>100 meters</option>
                      <option value={500}>500 meters (Default)</option>
                      <option value={1000}>1 km</option>
                      <option value={2000}>2 km</option>
                      <option value={5000}>5 km</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* COMPLAINT PREFERENCES */}
            {(activeSection === 'complaints' || window.innerWidth < 1024) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <Sliders className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">Complaint Submission Preferences</h2>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="space-y-0.5 max-w-lg">
                      <span className="font-bold text-gray-900 block">Show Nearby Duplicate Warnings</span>
                      <p className="text-[11px] text-gray-500">Warn me when a similar complaint already exists within 100m radius.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDuplicateWarnings(!showDuplicateWarnings)}
                      className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none min-h-[44px] flex items-center ${
                        showDuplicateWarnings ? 'bg-emerald-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`w-4 h-4 bg-white rounded-full transition-transform transform shadow-xs ${
                        showDuplicateWarnings ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="space-y-0.5 max-w-lg">
                      <span className="font-bold text-gray-900 block">Ask Before Submitting Location</span>
                      <p className="text-[11px] text-gray-500">Always prompt to confirm the map pin before submitting a complaint.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmLocationBeforeSubmit(!confirmLocationBeforeSubmit)}
                      className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none min-h-[44px] flex items-center ${
                        confirmLocationBeforeSubmit ? 'bg-emerald-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`w-4 h-4 bg-white rounded-full transition-transform transform shadow-xs ${
                        confirmLocationBeforeSubmit ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PRIVACY & SECURITY */}
            {(activeSection === 'privacy' || window.innerWidth < 1024) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">Privacy & Security Information</h2>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-1">
                    <span className="font-bold text-emerald-900 block">🔒 Profile Data Protection</span>
                    <p className="text-emerald-800 text-[11px] leading-relaxed">
                      Your personal information (name, phone, email, residential address) is strictly confidential and never displayed publicly to other citizens.
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                    <span className="font-bold text-gray-900 block">📍 Location Privacy</span>
                    <p className="text-gray-600 text-[11px] leading-relaxed">
                      GPS coordinates are used solely to identify, dispatch, and track municipal civic maintenance tasks.
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                    <span className="font-bold text-gray-900 block">📋 Public Civic Issue Transparency</span>
                    <p className="text-gray-600 text-[11px] leading-relaxed">
                      Reported civic issues may be visible on the public map to prevent duplicate reports, but citizen reporter identities remain 100% anonymous.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ACCESSIBILITY & APPEARANCE */}
            {(activeSection === 'accessibility' || window.innerWidth < 1024) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <Eye className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">Accessibility & Appearance</h2>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-900 block">NAGARSETU Pure White Interface</span>
                      <p className="text-[11px] text-gray-500">Official light civic-tech design system adhering to government accessibility standards.</p>
                    </div>
                    <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>● Light Theme</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <span className="font-bold text-gray-900 block">Reduce Motion</span>
                      <p className="text-[11px] text-gray-500">Disable UI animations and smooth transitions.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const val = !reduceMotion;
                        setReduceMotion(val);
                        if (val) document.documentElement.classList.add('motion-reduce');
                        else document.documentElement.classList.remove('motion-reduce');
                      }}
                      className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none min-h-[44px] flex items-center ${
                        reduceMotion ? 'bg-emerald-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`w-4 h-4 bg-white rounded-full transition-transform transform shadow-xs ${
                        reduceMotion ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* DATA & STORAGE */}
            {(activeSection === 'data' || window.innerWidth < 1024) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <Trash2 className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">Data & Storage Management</h2>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-gray-900 block">Offline Saved Drafts</span>
                      <p className="text-[11px] text-gray-500">
                        {draftCount > 0 ? `${draftCount} complaint draft(s) saved locally on this device.` : 'No offline drafts stored.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowClearDraftsModal(true)}
                      disabled={draftCount === 0}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 disabled:opacity-50 min-h-[44px]"
                    >
                      Clear Saved Drafts
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT SUMMARY */}
            {(activeSection === 'account' || window.innerWidth < 1024) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <User className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">Account Summary</h2>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 font-outfit text-sm">{user?.full_name && user.full_name !== 'Demo Citizen' && user.full_name !== 'Citizen User' ? user.full_name : 'Pratik Dilip Tupe'}</span>
                    <span className="font-mono text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                      Role: Citizen
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span>{user?.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                      <span>{user?.mobile || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <Link
                      to="/citizen/profile"
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs uppercase min-h-[44px]"
                    >
                      <User className="w-4 h-4" />
                      <span>View Full Profile</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ABOUT NAGARSETU */}
            {(activeSection === 'about' || window.innerWidth < 1024) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4 text-xs">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <Info className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">About NAGARSETU</h2>
                </div>

                <p className="text-gray-600 leading-relaxed">
                  NAGARSETU is an AI-powered municipal civic issue management platform connecting citizens directly with municipal authorities for rapid defect detection, real-time status tracking, and SLA-bound resolution.
                </p>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between font-mono text-[11px]">
                  <span>System Version:</span>
                  <span className="font-bold text-emerald-800">NAGARSETU</span>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* CLEAR DRAFTS CONFIRMATION MODAL */}
      {showClearDraftsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">Clear Saved Complaint Drafts?</h3>
              <button onClick={() => setShowClearDraftsModal(false)} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">✕</button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              This action will clear all offline complaint drafts saved locally on this browser. Submitted complaints stored in Supabase will remain unaffected.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearDraftsModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmClearDrafts}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase min-h-[44px]"
              >
                Clear Drafts
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};
