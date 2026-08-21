import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LanguageSelector } from '../../components/LanguageSelector';
import { useAuth } from '../../context/AuthContext';
import {
  User, Bell, Clock, Globe, ShieldCheck, LogOut, CheckCircle2,
  AlertTriangle, Save, RefreshCw, Building2, Key, Sliders, Smartphone, Mail,
  Lock, Wrench, Shield, Check, X
} from 'lucide-react';

export const StaffSettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active Navigation Section
  const [activeSection, setActiveSection] = useState<
    'profile' | 'notifications' | 'alerts' | 'language' | 'security' | 'account'
  >('profile');

  // Locked Staff Identity
  const staffEmployeeId = 'STF-0012';
  const staffDepartment = 'Roads / PWD';
  const staffDepartmentFull = 'Roads & Public Works (PWD)';
  const staffRole = 'Field Service Technician';

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [mobile, setMobile] = useState(user?.mobile || '');

  // Notification Preferences State
  const [notifNewTask, setNotifNewTask] = useState(true);
  const [notifTaskReassigned, setNotifTaskReassigned] = useState(true);
  const [notifSlaDueSoon, setNotifSlaDueSoon] = useState(true);
  const [notifTaskOverdue, setNotifTaskOverdue] = useState(true);
  const [notifAdminInstructions, setNotifAdminInstructions] = useState(true);
  const [notifTaskVerification, setNotifTaskVerification] = useState(true);
  const [notifComplaintReopened, setNotifComplaintReopened] = useState(true);
  const [notifTaskCompleted, setNotifTaskCompleted] = useState(true);
  const [notifSystemAnnounce, setNotifSystemAnnounce] = useState(true);

  // Work Alerts State
  const [alertSla24h, setAlertSla24h] = useState(true);
  const [alertSla12h, setAlertSla12h] = useState(true);
  const [alertSla6h, setAlertSla6h] = useState(true);
  const [alertSla1h, setAlertSla1h] = useState(true);
  const [alertOverdue, setAlertOverdue] = useState(true);
  const [alertCritical, setAlertCritical] = useState(true);

  // Language Preference State
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>(
    (user?.language_pref as 'en' | 'hi' | 'mr') ||
    (localStorage.getItem('nagarsetu_staff_lang') as 'en' | 'hi' | 'mr') ||
    'en'
  );

  // Security Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Feedback Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Logout Modal State
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const showSaveToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Handle Profile Save
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      showSaveToast('Profile settings saved successfully.');
    }, 400);
  };

  // Handle Notification Preferences Save
  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      showSaveToast('Notification preferences saved successfully.');
    }, 400);
  };

  // Handle Work Alerts Save
  const handleSaveAlerts = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      showSaveToast('Work alert configurations saved successfully.');
    }, 400);
  };

  // Handle Language Preference Save
  const handleSaveLanguage = (newLang: 'en' | 'hi' | 'mr') => {
    setLanguage(newLang);
    localStorage.setItem('nagarsetu_staff_lang', newLang);
    showSaveToast(`Language updated to ${newLang === 'en' ? 'English' : newLang === 'hi' ? 'हिंदी' : 'मराठी'}.`);
  };

  // Handle Password Update
  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setUpdatingPassword(true);
    setTimeout(() => {
      setUpdatingPassword(false);
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSaveToast('Account security password updated.');
    }, 600);
  };

  // Handle Logout Execution
  const handlePerformLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <DashboardLayout title="Settings">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto text-gray-900 bg-white min-h-screen font-sans">
        
        {/* ================================================== */}
        {/* 2. PAGE HEADER */}
        {/* ================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-outfit">
                Settings
              </h1>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-extrabold font-mono bg-emerald-50 text-emerald-800 border border-emerald-300">
                <Wrench className="w-3.5 h-3.5 text-emerald-700" />
                <span>Field Service Portal</span>
              </span>
            </div>
            <p className="text-sm text-gray-600 font-medium">
              Manage your profile, work notifications and account preferences.
            </p>
          </div>

          {/* LOCKED IDENTITY BADGE */}
          <div className="bg-slate-50 border border-gray-200 rounded-xl p-2.5 px-4 flex items-center space-x-4 shadow-xs shrink-0">
            <div className="flex items-center space-x-2 text-xs">
              <User className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-extrabold text-gray-900 font-outfit block">{fullName}</span>
                <span className="font-mono text-[10px] text-gray-500 font-bold block">{staffEmployeeId}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-gray-200" />

            <div className="flex items-center space-x-2 text-xs">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="flex items-center space-x-1">
                  <span className="font-extrabold text-gray-900 font-outfit">{staffDepartment}</span>
                  <Lock className="w-3 h-3 text-gray-400" />
                </div>
                <span className="text-[10px] text-gray-500 font-medium block">{staffRole}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================== */}
        {/* 12. SAVE CONFIRMATION TOAST */}
        {/* ================================================== */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-md text-xs font-bold flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ================================================== */}
        {/* 3. SETTINGS TWO-COLUMN LAYOUT (DESKTOP) / STACKED (MOBILE) */}
        {/* ================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* LEFT SIDE: SETTINGS NAVIGATION */}
          <div className="md:col-span-3 space-y-1">
            {[
              { id: 'profile', label: 'My Profile', icon: User },
              { id: 'notifications', label: 'Notification Preferences', icon: Bell },
              { id: 'alerts', label: 'Work Alerts', icon: Clock },
              { id: 'language', label: 'Language', icon: Globe },
              { id: 'security', label: 'Security', icon: Key },
              { id: 'account', label: 'Account Summary', icon: ShieldCheck }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as any)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-extrabold transition-colors text-left ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs'
                      : 'text-gray-700 hover:bg-slate-50 hover:text-gray-900 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-gray-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="pt-4 border-t border-gray-200 mt-4">
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-extrabold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Logout Session</span>
              </button>
            </div>
          </div>

          {/* RIGHT SIDE: SETTINGS CONTENT */}
          <div className="md:col-span-9 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
            
            {/* ================================================== */}
            {/* SECTION 1: MY PROFILE */}
            {/* ================================================== */}
            {activeSection === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-6 font-sans">
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">My Profile</h3>
                  <p className="text-xs text-gray-500">View and update your personal service staff contact details.</p>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-700 text-white font-extrabold text-xl flex items-center justify-center font-outfit shadow-sm">
                    {fullName.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <span className="font-extrabold text-gray-900 text-sm block font-outfit">{fullName}</span>
                    <span className="font-mono text-xs text-emerald-700 font-bold block">{staffEmployeeId}</span>
                    <span className="text-xs text-gray-500 font-medium block">{staffDepartmentFull}</span>
                  </div>
                </div>

                {/* READ-ONLY / LOCKED FIELDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-gray-200 text-xs">
                  <div>
                    <label className="block text-gray-500 font-medium mb-1">Employee ID (Locked)</label>
                    <div className="flex items-center space-x-1.5 font-mono font-extrabold text-gray-900 bg-white p-2.5 rounded-lg border border-gray-200">
                      <span>{staffEmployeeId}</span>
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-500 font-medium mb-1">Assigned Department (Locked)</label>
                    <div className="flex items-center space-x-1.5 font-extrabold text-gray-900 bg-white p-2.5 rounded-lg border border-gray-200">
                      <span className="truncate">{staffDepartment}</span>
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-500 font-medium mb-1">Staff Role (Locked)</label>
                    <div className="flex items-center space-x-1.5 font-bold text-gray-900 bg-white p-2.5 rounded-lg border border-gray-200">
                      <span className="truncate">{staffRole}</span>
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* EDITABLE PROFILE FIELDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Contact Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center space-x-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center space-x-1.5 min-h-[44px]"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* ================================================== */}
            {/* SECTION 2: NOTIFICATION PREFERENCES */}
            {/* ================================================== */}
            {activeSection === 'notifications' && (
              <form onSubmit={handleSaveNotifications} className="space-y-6 font-sans">
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">Notification Preferences</h3>
                  <p className="text-xs text-gray-500">Choose which work-related updates trigger notifications.</p>
                </div>

                <div className="space-y-3 divide-y divide-gray-100 text-xs">
                  {[
                    { label: 'New Task Assigned', state: notifNewTask, set: setNotifNewTask, desc: 'Notify immediately when a new task is dispatched to you.' },
                    { label: 'Task Reassigned / Department Update', state: notifTaskReassigned, set: setNotifTaskReassigned, desc: 'Notify if a task is reassigned or updated by department head.' },
                    { label: 'SLA Due Soon Warning', state: notifSlaDueSoon, set: setNotifSlaDueSoon, desc: 'Receive alert when SLA completion deadline is approaching.' },
                    { label: 'Task Overdue Alert', state: notifTaskOverdue, set: setNotifTaskOverdue, desc: 'Receive immediate alert when a task breaches its SLA.' },
                    { label: 'Admin Instructions', state: notifAdminInstructions, set: setNotifAdminInstructions, desc: 'Notify when City Admin adds special work instructions.' },
                    { label: 'Task Verification & Approval', state: notifTaskVerification, set: setNotifTaskVerification, desc: 'Notify when your completed work proof is verified by admin.' },
                    { label: 'Complaint Reopened', state: notifComplaintReopened, set: setNotifComplaintReopened, desc: 'Notify if a resolved task is reopened by citizen or admin.' },
                    { label: 'System Announcements', state: notifSystemAnnounce, set: setNotifSystemAnnounce, desc: 'Receive municipal administrative system updates.' }
                  ].map((item, idx) => (
                    <div key={idx} className="pt-3 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-bold text-gray-900 block">{item.label}</span>
                        <span className="text-[11px] text-gray-500">{item.desc}</span>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={item.state}
                          onChange={(e) => item.set(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                      </label>
                    </div>
                  ))}
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center space-x-1.5 min-h-[44px]"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Notification Preferences'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* ================================================== */}
            {/* SECTION 3: WORK ALERTS */}
            {/* ================================================== */}
            {activeSection === 'alerts' && (
              <form onSubmit={handleSaveAlerts} className="space-y-6 font-sans">
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">Work Alerts</h3>
                  <p className="text-xs text-gray-500">Configure SLA warning thresholds and critical hazard alerts.</p>
                </div>

                <div className="space-y-4 text-xs">
                  <span className="font-bold text-gray-700 block">SLA Warning Time Thresholds</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: '24 Hours Before SLA', state: alertSla24h, set: setAlertSla24h },
                      { label: '12 Hours Before SLA', state: alertSla12h, set: setAlertSla12h },
                      { label: '6 Hours Before SLA', state: alertSla6h, set: setAlertSla6h },
                      { label: '1 Hour Before SLA', state: alertSla1h, set: setAlertSla1h }
                    ].map((thresh, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-gray-200 rounded-xl flex items-center justify-between">
                        <span className="font-bold text-gray-900">{thresh.label}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={thresh.state}
                            onChange={(e) => thresh.set(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 space-y-3">
                    <span className="font-bold text-gray-700 block">Hazard & Priority Emergency Alerts</span>

                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-rose-900 block">Immediate Overdue SLA Alert</span>
                        <span className="text-[11px] text-rose-700">Receive persistent alerts when SLA target is breached.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alertOverdue}
                          onChange={(e) => setAlertOverdue(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600" />
                      </label>
                    </div>

                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-rose-900 block">Critical Hazard Priority Dispatches</span>
                        <span className="text-[11px] text-rose-700">Immediate high-priority notifications for emergency civic issues.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alertCritical}
                          onChange={(e) => setAlertCritical(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600" />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center space-x-1.5 min-h-[44px]"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Work Alert Settings'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* ================================================== */}
            {/* SECTION 4: LANGUAGE */}
            {/* ================================================== */}
            {activeSection === 'language' && (
              <div className="space-y-6 font-sans">
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">Language Preference</h3>
                  <p className="text-xs text-gray-500">Select your preferred application language for the field service portal.</p>
                </div>

                <div>
                  <LanguageSelector variant="full" />
                </div>
              </div>
            )}

            {/* ================================================== */}
            {/* SECTION 5: SECURITY */}
            {/* ================================================== */}
            {activeSection === 'security' && (
              <form onSubmit={handleUpdatePassword} className="space-y-6 font-sans">
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">Security & Password Update</h3>
                  <p className="text-xs text-gray-500">Update your account authentication password.</p>
                </div>

                {passwordSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="space-y-4 max-w-md text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Current Password *</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">New Password *</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Confirm New Password *</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center space-x-1.5 min-h-[44px]"
                  >
                    <Key className="w-4 h-4" />
                    <span>{updatingPassword ? 'Updating Password...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* ================================================== */}
            {/* SECTION 6: ACCOUNT SUMMARY */}
            {/* ================================================== */}
            {activeSection === 'account' && (
              <div className="space-y-6 font-sans">
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">Account Summary</h3>
                  <p className="text-xs text-gray-500">Official field service staff account details and session controls.</p>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5">Account Status</span>
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        <span>Active (On Duty)</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5">Employee ID</span>
                      <span className="font-mono font-extrabold text-gray-900 text-sm">{staffEmployeeId}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5">Assigned Department</span>
                      <span className="font-extrabold text-gray-900 text-sm font-outfit">{staffDepartmentFull}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5">Staff Role</span>
                      <span className="font-bold text-gray-900 text-xs">{staffRole}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5">Last Login Session</span>
                      <span className="font-mono text-gray-700 text-xs">{new Date().toLocaleString()}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5">Account Created</span>
                      <span className="font-mono text-gray-700 text-xs">15 Mar 2024</span>
                    </div>
                  </div>
                </div>

                {/* LOGOUT BUTTON */}
                <div className="pt-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center space-x-1.5 min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout Session</span>
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* LOGOUT CONFIRMATION MODAL */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-4">
              <div className="flex items-center space-x-3 text-rose-600">
                <LogOut className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">Confirm Session Logout</h3>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Are you sure you want to end your service staff session? You will need to log in again to access field tasks.
              </p>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 bg-white text-gray-700 font-bold text-xs rounded-xl border border-gray-300 hover:bg-slate-50 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePerformLogout}
                  className="px-4 py-2 bg-rose-600 text-white font-extrabold text-xs rounded-xl hover:bg-rose-700 min-h-[44px]"
                >
                  Confirm Logout
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
