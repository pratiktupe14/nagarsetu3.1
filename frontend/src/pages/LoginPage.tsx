import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, getPortalForRole } from '../context/AuthContext';
import { UserRole } from '../types/database.types';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Shield, User, Building2, Wrench, Smartphone, Mail, Lock, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('citizen');
  const [identifier, setIdentifier] = useState('9876543210');
  const [password, setPassword] = useState('password123');
  const [useOtp, setUseOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg('');
    if (role === 'citizen') {
      setIdentifier('9876543210');
      setPassword('password123');
    } else if (role === 'city_admin') {
      setIdentifier('admin@nagarsetu.gov.in');
      setPassword('NagarSetu@Admin2026!');
    } else if (role === 'department_head') {
      setIdentifier('rahul.patil@nagarsetu.gov.in');
      setPassword('head123');
    } else if (role === 'service_staff') {
      setIdentifier('staff@nagarsetu.gov.in');
      setPassword('staff123');
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
              <span>NAGARSETU 3.0 Unified Portal</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-outfit leading-tight">
                AI-Powered Civic Management & Bridge Tech
              </h1>
              <p className="text-sm text-gray-600 leading-relaxed">
                Connecting citizens, municipal officers, and service maintenance teams for rapid issue detection and transparent resolution.
              </p>
            </div>

            {/* AI Feature Highlights */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start space-x-3 text-xs text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Instant Defect Detection:</strong> Computer Vision auto-detects potholes, garbage overflow, and water leaks.</span>
              </div>
              <div className="flex items-start space-x-3 text-xs text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Verified GPS Engine:</strong> Resolves camera, EXIF, or map pin drop location accuracy.</span>
              </div>
              <div className="flex items-start space-x-3 text-xs text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>7-Stage Progress Timeline:</strong> Real-time status tracking with before/after resolution proof images.</span>
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
                <h2 className="text-xl font-extrabold text-gray-900 font-outfit">Welcome to NAGARSETU</h2>
                <p className="text-xs text-gray-500">Select your account role to continue</p>
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
                  <span className="text-xs">Citizen</span>
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
                  <span className="text-xs">City Admin</span>
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
                  <span className="text-xs">Dept Head</span>
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
                  <span className="text-xs">Service Staff</span>
                </button>
              </div>

              {/* Role Explanatory Subtitle */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center text-xs text-gray-600 font-medium">
                {selectedRole === 'citizen' && 'Report civic issues and track resolution progress.'}
                {selectedRole === 'city_admin' && 'City-wide municipal governance & department head allocation.'}
                {selectedRole === 'department_head' && 'Department operations, staff workload management & resolution review.'}
                {selectedRole === 'service_staff' && 'Field service execution, location mapping & proof submission.'}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center">
                  {errorMsg}
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                
                {/* OTP / Password Toggle for Citizen */}
                {selectedRole === 'citizen' && (
                  <div className="flex items-center justify-between bg-gray-50 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setUseOtp(false)}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        !useOtp ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-500'
                      }`}
                    >
                      Password Login
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseOtp(true)}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        useOtp ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-gray-500'
                      }`}
                    >
                      OTP Login
                    </button>
                  </div>
                )}

                {/* Identifier Input */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {selectedRole === 'citizen' ? 'Mobile Number / Email' : 'Official Email Address'}
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
                      placeholder={selectedRole === 'citizen' ? 'Enter 10-digit mobile number' : 'officer@nagarsetu.gov.in'}
                      className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Password / OTP Input */}
                {useOtp && selectedRole === 'citizen' ? (
                  <div className="space-y-2">
                    <label className="block font-bold text-gray-700">Enter 6-Digit OTP</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="flex-1 bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-center font-mono font-bold tracking-widest text-gray-900 focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl border border-gray-200 transition-colors"
                      >
                        {otpSent ? 'Resend' : 'Get OTP'}
                      </button>
                    </div>
                    {otpSent && <p className="text-[11px] text-emerald-600 font-semibold">Demo OTP sent: Use 123456</p>}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-gray-700">Password</label>
                      <a href="#" className="text-[11px] text-emerald-600 font-semibold hover:underline">
                        Forgot Password?
                      </a>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all mt-2"
                >
                  <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Citizen Registration Link */}
              {selectedRole === 'citizen' && (
                <div className="text-center pt-2 border-t border-gray-100 text-xs text-gray-600">
                  New to NAGARSETU?{' '}
                  <Link to="/register" className="text-emerald-700 font-bold hover:underline">
                    Create Citizen Account
                  </Link>
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
