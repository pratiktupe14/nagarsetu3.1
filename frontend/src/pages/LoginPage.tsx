import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, getPortalForRole } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserRole } from '../types/database.types';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Shield, User, Building2, Wrench, Smartphone, Mail, Lock, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [selectedRole, setSelectedRole] = useState<UserRole>('citizen');
  const [identifier, setIdentifier] = useState('8788562103');
  const [password, setPassword] = useState('8788562103');
  const [showPassword, setShowPassword] = useState(false);
  const [useOtp, setUseOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg('');
    const demoAdminPass = import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'NagarSetu@Admin2026!';
    const demoUserPass = import.meta.env.VITE_DEMO_USER_PASSWORD || 'password123';
    const demoHeadPass = import.meta.env.VITE_DEMO_HEAD_PASSWORD || 'head123';
    const demoStaffPass = import.meta.env.VITE_DEMO_STAFF_PASSWORD || 'staff123';

    if (role === 'citizen') {
      setIdentifier('8788562103');
      setPassword('8788562103');
    } else if (role === 'city_admin') {
      setIdentifier('admin@nagarsetu.gov.in');
      setPassword(demoAdminPass);
    } else if (role === 'department_head') {
      setIdentifier('rahul.kumar@nagarsetu.gov.in');
      setPassword(demoHeadPass);
    } else if (role === 'service_staff') {
      setIdentifier('staff@nagarsetu.gov.in');
      setPassword(demoStaffPass);
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || identifier.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    setOtpSent(true);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (useOtp && selectedRole === 'citizen') {
        if (otpCode !== '123456') {
          setErrorMsg('Invalid OTP. Please enter 123456 for demo verification.');
          setLoading(false);
          return;
        }
      }

      await login(identifier, password, selectedRole);

      const currentUser = JSON.parse(localStorage.getItem('nagarsetu_user') || '{}');
      const activeRole = currentUser?.role || selectedRole;
      const targetPortal = getPortalForRole(activeRole);
      navigate(targetPortal);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-between">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex-1 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
          
          {/* Left Column: Branding & AI Highlights */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>NAGARSETU — {t('tagline')}</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-outfit leading-tight">
                {t('landingHeroTitle')}
              </h1>
              <p className="text-sm text-gray-600 leading-relaxed">
                {t('landingHeroSubtitle')}
              </p>
            </div>

            {/* AI Feature Highlights */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start space-x-3 text-xs text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>{t('aiVisionFeatureTitle')}:</strong> {t('aiVisionFeatureDesc')}</span>
              </div>
              <div className="flex items-start space-x-3 text-xs text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>{t('geoTaggingFeatureTitle')}:</strong> {t('geoTaggingFeatureDesc')}</span>
              </div>
              <div className="flex items-start space-x-3 text-xs text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>{t('slaTrackingFeatureTitle')}:</strong> {t('slaTrackingFeatureDesc')}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center space-x-4 text-xs text-gray-500 font-mono">
              <span>Clean • Smart • Connected</span>
            </div>
          </div>

          {/* Right Column: Pure White Login Card */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
              
              <div className="text-center space-y-1">
                <h2 className="text-xl font-extrabold text-gray-900 font-outfit">{t('loginTitle')}</h2>
                <p className="text-xs text-gray-500">{t('loginSubtitle')}</p>
              </div>

              {/* 4 Role Selection Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleRoleChange('citizen')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1.5 ${
                    selectedRole === 'citizen'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700 font-bold shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="text-xs">{t('roleCitizen')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('city_admin')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1.5 ${
                    selectedRole === 'city_admin'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700 font-bold shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                  <span className="text-xs">{t('roleAdmin')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('department_head')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1.5 ${
                    selectedRole === 'department_head'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700 font-bold shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  <span className="text-xs">{t('roleDeptHead')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('service_staff')}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1.5 ${
                    selectedRole === 'service_staff'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700 font-bold shadow-xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Wrench className="w-5 h-5" />
                  <span className="text-xs">{t('roleStaff')}</span>
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center">
                  {errorMsg}
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                
                {/* Identifier Input */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {t('mobileOrEmail')}
                  </label>
                  <div className="relative">
                    {selectedRole === 'citizen' ? (
                      <Smartphone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    ) : (
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    )}
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={t('enterMobileOrEmail')}
                      className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-gray-700">{t('password')}</label>
                    <a href="#" className="text-[11px] text-emerald-600 font-semibold hover:underline">
                      {t('forgotPassword')}
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-10 py-2.5 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none p-0.5"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all mt-2 min-h-[44px]"
                >
                  <span>{loading ? t('loading') : t('login')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Citizen Registration Link & Demo Account Badge */}
              {selectedRole === 'citizen' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs">
                    <div className="flex items-center space-x-2 text-emerald-800 font-medium">
                      <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Demo Account: <strong className="font-bold">8788562103</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setIdentifier('8788562103'); setPassword('8788562103'); setErrorMsg(''); }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-all"
                    >
                      Auto-Fill
                    </button>
                  </div>

                  <div className="text-center text-xs text-gray-600">
                    {t('dontHaveAccount')}{' '}
                    <Link to="/register" className="text-emerald-700 font-bold hover:underline">
                      {t('registerTitle')}
                    </Link>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};
