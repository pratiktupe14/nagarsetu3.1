import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LanguageSelector } from '../../components/LanguageSelector';
import { useAuth } from '../../context/AuthContext';
import {
  User, Bell, Clock, Globe, ShieldCheck, LogOut, CheckCircle2,
  AlertTriangle, Save, RefreshCw, Building2, Key, Sliders, Smartphone, Mail
} from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active Navigation Section
  const [activeSection, setActiveSection] = useState<
    'profile' | 'notifications' | 'sla' | 'application' | 'security' | 'account'
  >('profile');

  // Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || 'City Admin');
  const [email, setEmail] = useState(user?.email || 'admin@nagarsetu.gov.in');
  const [mobile, setMobile] = useState(user?.mobile || '+91 9876543210');
  const [department, setDepartment] = useState('Municipal Administration');

  // Notification Preferences State
  const [notifNewComplaint, setNotifNewComplaint] = useState(true);
  const [notifVerification, setNotifVerification] = useState(true);
  const [notifDeptAssignment, setNotifDeptAssignment] = useState(true);
  const [notifStaffAssignment, setNotifStaffAssignment] = useState(true);
  const [notifSlaWarning, setNotifSlaWarning] = useState(true);
  const [notifSlaBreached, setNotifSlaBreached] = useState(true);
  const [notifReopened, setNotifReopened] = useState(true);
  const [notifResolutionProof, setNotifResolutionProof] = useState(true);
  const [notifCitizenFeedback, setNotifCitizenFeedback] = useState(true);
  const [notifSystemAnnounce, setNotifSystemAnnounce] = useState(true);

  // SLA Alert Settings State
  const [slaAlert24h, setSlaAlert24h] = useState(true);
  const [slaAlert12h, setSlaAlert12h] = useState(true);
  const [slaAlert6h, setSlaAlert6h] = useState(true);
  const [slaAlert1h, setSlaAlert1h] = useState(true);
  const [slaAlertOverdue, setSlaAlertOverdue] = useState(true);

  // Application Settings State
  const [language, setLanguage] = useState(user?.language_pref || localStorage.getItem('nagarsetu_admin_lang') || 'en');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState('12 Hour');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('30s');

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Toast / Feedback State
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Load Persisted Admin Settings
  useEffect(() => {
    const cachedLang = localStorage.getItem('nagarsetu_admin_lang');
    if (cachedLang) setLanguage(cachedLang);
  }, []);

  // Save Settings Function
  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveErrorMsg(null);

    // Save language preference
    localStorage.setItem('nagarsetu_admin_lang', language);

    // Show soft success feedback
    setSaveSuccessMsg('✓ Settings saved successfully.');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Update Password Function
  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveErrorMsg(null);

    if (!currentPassword) {
      setSaveErrorMsg('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setSaveErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSaveErrorMsg('New password and confirm password do not match.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSaveSuccessMsg('✓ Password updated successfully.');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const sections = [
    { id: 'profile', label: 'Admin Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'sla', label: 'SLA Alerts', icon: Clock },
    { id: 'application', label: 'Application Preferences', icon: Globe },
    { id: 'security', label: 'Security & Password', icon: Key },
    { id: 'account', label: 'Session & Account', icon: ShieldCheck }
  ] as const;

  return (
    <DashboardLayout title="Settings">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto text-gray-900 bg-white min-h-screen">
        
        {/* ================================================== */}
        {/* 2. PAGE HEADER */}
        {/* ================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-outfit">
                Settings
              </h1>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold font-mono bg-emerald-50 text-emerald-800 border border-emerald-300">
                City Admin Settings
              </span>
            </div>
            <p className="text-sm text-gray-600 font-medium">
              Manage your administrator account, notifications and application preferences.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleSaveSettings}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* 11. SOFT CONFIRMATION TOAST */}
        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold font-mono flex items-center justify-between animate-fadeIn">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </div>
          </div>
        )}

        {saveErrorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold font-mono flex items-center justify-between animate-fadeIn">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{saveErrorMsg}</span>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* 3. SETTINGS LAYOUT (CLASSIC TWO-COLUMN) */}
        {/* ================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* LEFT: SETTINGS NAVIGATION (Desktop column / Mobile stacked pills) */}
          <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-1 lg:space-y-1">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider px-3 py-1.5 block font-outfit">
              Navigation
            </span>
            <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 pb-1 lg:pb-0">
              {sections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-emerald-800 border border-gray-200 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: SELECTED SETTINGS CONTENT */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* ================================================== */}
            {/* 4 & 5. ADMIN PROFILE & ROLE INFORMATION */}
            {/* ================================================== */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                
                {/* 4. ADMIN PROFILE FORM */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-xs">
                  <div className="border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-extrabold text-gray-900 font-outfit">Admin Profile</h3>
                    <p className="text-xs text-gray-500">Manage administrator account personal details and contact info.</p>
                  </div>

                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Official Email Address</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Mobile Contact Number</label>
                        <input
                          type="text"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-mono font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Assigned Department</label>
                        <input
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFullName(user?.full_name || 'City Admin');
                          setEmail(user?.email || 'admin@nagarsetu.gov.in');
                          setMobile(user?.mobile || '+91 9876543210');
                        }}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>

                {/* 5. ROLE INFORMATION CARD */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-xs">
                  <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-gray-900 font-outfit">Role & Privilege Information</h3>
                      <p className="text-xs text-gray-500">System authorization and municipal clearance level.</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded font-mono font-extrabold text-xs">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 border border-gray-200 rounded-lg space-y-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Role</span>
                      <span className="font-extrabold text-gray-900 block font-outfit">City Admin</span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-gray-200 rounded-lg space-y-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Account Status</span>
                      <span className="font-mono font-bold text-emerald-700 block">Verified Active</span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-gray-200 rounded-lg space-y-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Clearance Tier</span>
                      <span className="font-bold text-gray-800 block">Supervising Municipal Officer</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ================================================== */}
            {/* 6. NOTIFICATION PREFERENCES */}
            {/* ================================================== */}
            {activeSection === 'notifications' && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-xs">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-extrabold text-gray-900 font-outfit">Notification Preferences</h3>
                  <p className="text-xs text-gray-500">Choose which operational events send real-time system alerts.</p>
                </div>

                <div className="space-y-3 divide-y divide-gray-100 text-xs">
                  
                  <ToggleRow
                    title="New Complaint Submitted"
                    desc="Receive instant alert when a citizen files a new civic complaint."
                    checked={notifNewComplaint}
                    onChange={setNotifNewComplaint}
                  />

                  <ToggleRow
                    title="Complaint Verification Required"
                    desc="Notify when AI flags a complaint for manual verification."
                    checked={notifVerification}
                    onChange={setNotifVerification}
                  />

                  <ToggleRow
                    title="Department Assignment Updates"
                    desc="Notify when a complaint is routed to a municipal department."
                    checked={notifDeptAssignment}
                    onChange={setNotifDeptAssignment}
                  />

                  <ToggleRow
                    title="Service Staff Dispatched"
                    desc="Alert when field officers accept or begin work on site."
                    checked={notifStaffAssignment}
                    onChange={setNotifStaffAssignment}
                  />

                  <ToggleRow
                    title="SLA Due Soon Warning"
                    desc="Alert when a complaint has less than 2 hours remaining in its SLA target."
                    checked={notifSlaWarning}
                    onChange={setNotifSlaWarning}
                  />

                  <ToggleRow
                    title="Overdue SLA Breached"
                    desc="Receive critical notification when SLA deadline expires without resolution."
                    checked={notifSlaBreached}
                    onChange={setNotifSlaBreached}
                  />

                  <ToggleRow
                    title="Complaint Reopened by Citizen"
                    desc="Alert when a citizen reopens a resolved complaint."
                    checked={notifReopened}
                    onChange={setNotifReopened}
                  />

                  <ToggleRow
                    title="Resolution Proof Uploaded"
                    desc="Notify when service staff submits after-work photos for review."
                    checked={notifResolutionProof}
                    onChange={setNotifResolutionProof}
                  />

                  <ToggleRow
                    title="Citizen Feedback & Ratings"
                    desc="Notify when citizens leave ratings or feedback comments."
                    checked={notifCitizenFeedback}
                    onChange={setNotifCitizenFeedback}
                  />

                  <ToggleRow
                    title="System Announcements"
                    desc="Receive updates on official municipal announcements and scheduled maintenance."
                    checked={notifSystemAnnounce}
                    onChange={setNotifSystemAnnounce}
                  />

                </div>

                <div className="pt-2 text-right">
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {/* ================================================== */}
            {/* 7. SLA ALERT SETTINGS */}
            {/* ================================================== */}
            {activeSection === 'sla' && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-xs">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-extrabold text-gray-900 font-outfit">SLA Alert Preferences</h3>
                  <p className="text-xs text-gray-500">Configure Service Level Agreement countdown thresholds and breach warnings.</p>
                </div>

                <div className="space-y-3 divide-y divide-gray-100 text-xs">
                  
                  <ToggleRow
                    title="Notify at 24 Hours Remaining"
                    desc="Early warning for long-duration municipal repair SLA targets."
                    checked={slaAlert24h}
                    onChange={setSlaAlert24h}
                  />

                  <ToggleRow
                    title="Notify at 12 Hours Remaining"
                    desc="Standard mid-way SLA countdown alert."
                    checked={slaAlert12h}
                    onChange={setSlaAlert12h}
                  />

                  <ToggleRow
                    title="Notify at 6 Hours Remaining"
                    desc="Urgent notification for active staff dispatches."
                    checked={slaAlert6h}
                    onChange={setSlaAlert6h}
                  />

                  <ToggleRow
                    title="Notify at 1 Hour Remaining"
                    desc="High priority warning before SLA deadline breach."
                    checked={slaAlert1h}
                    onChange={setSlaAlert1h}
                  />

                  <ToggleRow
                    title="Overdue SLA Breached Alert (Locked)"
                    desc="Critical alert sent immediately when deadline is breached."
                    checked={slaAlertOverdue}
                    onChange={setSlaAlertOverdue}
                    disabled={true}
                  />

                </div>

                <div className="pt-2 text-right">
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Save SLA Settings
                  </button>
                </div>
              </div>
            )}

            {/* ================================================== */}
            {/* 8. APPLICATION PREFERENCES */}
            {/* ================================================== */}
            {activeSection === 'application' && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-xs">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-extrabold text-gray-900 font-outfit">Application Preferences</h3>
                  <p className="text-xs text-gray-500">System language, date formats, and auto-refresh intervals.</p>
                </div>

                <div className="space-y-4">
                  <LanguageSelector variant="full" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs pt-4 border-t border-gray-100">

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Date Display Format</label>
                    <select
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-mono font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (21/08/2026)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (08/21/2026)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2026-08-21)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Time Display Format</label>
                    <select
                      value={timeFormat}
                      onChange={(e) => setTimeFormat(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-mono font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="12 Hour">12 Hour (09:41 AM)</option>
                      <option value="24 Hour">24 Hour (09:41)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Live Dashboard Auto-Refresh</label>
                    <select
                      value={autoRefreshInterval}
                      onChange={(e) => setAutoRefreshInterval(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-mono font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="30s">Every 30 Seconds</option>
                      <option value="1m">Every 1 Minute</option>
                      <option value="5m">Every 5 Minutes</option>
                      <option value="manual">Manual Refresh Only</option>
                    </select>
                  </div>

                </div>

                <div className="pt-2 text-right">
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {/* ================================================== */}
            {/* 9. SECURITY & CHANGE PASSWORD */}
            {/* ================================================== */}
            {activeSection === 'security' && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-xs">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-extrabold text-gray-900 font-outfit">Security & Password Management</h3>
                  <p className="text-xs text-gray-500">Update admin login password and authentication credentials.</p>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                  
                  <div>
                    <label className="block font-bold text-gray-700 mb-1 text-xs">Current Password</label>
                    <input
                      type="password"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1 text-xs">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password (min. 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1 text-xs">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Update Password
                    </button>
                  </div>

                </form>
              </div>
            )}

            {/* ================================================== */}
            {/* 10. SESSION & ACCOUNT SUMMARY */}
            {/* ================================================== */}
            {activeSection === 'account' && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-xs">
                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900 font-outfit">Session & Account Summary</h3>
                    <p className="text-xs text-gray-500">Active session details and security audit history.</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded font-mono font-extrabold text-xs">
                    Session Active
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Last Login Timestamp:</span>
                    <span className="font-mono font-bold text-gray-900">{new Date().toLocaleString()} IST</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Account Created:</span>
                    <span className="font-mono font-bold text-gray-800">15 Jan 2026</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Current Session Details:</span>
                    <span className="font-mono font-bold text-emerald-700">192.168.1.45 (Chrome / Windows)</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs rounded-lg hover:bg-rose-100 transition-colors flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Sign Out Administrator</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

// Toggle Row Helper Component
interface ToggleRowProps {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ title, desc, checked, onChange, disabled }) => {
  return (
    <div className="pt-3 first:pt-0 flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <span className="font-bold text-gray-900 block font-outfit text-xs">{title}</span>
        <span className="text-gray-500 text-[11px] block">{desc}</span>
      </div>

      <label className={`relative inline-flex items-center cursor-pointer shrink-0 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 font-mono"></div>
      </label>
    </div>
  );
};
