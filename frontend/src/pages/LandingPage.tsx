import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useLanguage } from '../context/LanguageContext';
import {
  Sparkles, Building2, ArrowRight, User, Wrench, ShieldCheck
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { t, translateCategory } = useLanguage();

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-between">
      <Navbar />

      <main className="space-y-16 pb-16">
        
        {/* HERO & DIRECT PORTAL ACCESS CARDS */}
        <section className="relative pt-10 pb-12 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>NAGARSETU — {t('tagline')}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight font-outfit max-w-4xl mx-auto leading-tight">
              {t('landingHeroTitle')}
            </h1>

            <p className="text-xs sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
              {t('landingHeroSubtitle')}
            </p>

            {/* 4 DIRECT PORTAL CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto pt-6 text-left">
              
              {/* CITIZEN PORTAL */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 hover:border-emerald-500/50 transition-all duration-300 group flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider font-sans leading-snug min-h-[48px] flex items-center">
                      {t('roleCitizen')} Portal
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium min-h-[36px]">
                      AI photo classification & instant civic issue reporting.
                    </p>
                  </div>
                </div>

                <Link
                  to="/login?role=citizen"
                  className="mt-6 w-full py-3.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs tracking-wider shadow-sm flex items-center justify-center space-x-1.5 transition-all min-h-[44px] whitespace-nowrap"
                >
                  <span>Citizen Sign In</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </div>

              {/* CITY ADMIN PORTAL */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 hover:border-blue-500/50 transition-all duration-300 group flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider font-sans leading-snug min-h-[48px] flex items-center">
                      Administrator Portal
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium min-h-[36px]">
                      Municipal command center & executive analytics triage.
                    </p>
                  </div>
                </div>

                <Link
                  to="/login?role=city_admin"
                  className="mt-6 w-full py-3.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs tracking-wider shadow-sm flex items-center justify-center space-x-1.5 transition-all min-h-[44px] whitespace-nowrap"
                >
                  <span>Admin Sign In</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </div>

              {/* DEPARTMENT HEAD PORTAL */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 hover:border-purple-500/50 transition-all duration-300 group flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider font-sans leading-snug min-h-[48px] flex items-center">
                      Dept Head Portal
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium min-h-[36px]">
                      Department operations & field staff task triage.
                    </p>
                  </div>
                </div>

                <Link
                  to="/login?role=department_head"
                  className="mt-6 w-full py-3.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs tracking-wider shadow-sm flex items-center justify-center space-x-1.5 transition-all min-h-[44px] whitespace-nowrap"
                >
                  <span>Department Head Sign In</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </div>

              {/* SERVICE STAFF PORTAL */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 hover:border-amber-500/50 transition-all duration-300 group flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-110 transition-transform">
                    <Wrench className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider font-sans leading-snug min-h-[48px] flex items-center">
                      Field Staff Portal
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium min-h-[36px]">
                      Task navigation, resolution & photo proof upload.
                    </p>
                  </div>
                </div>

                <Link
                  to="/login?role=service_staff"
                  className="mt-6 w-full py-3.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs tracking-wider shadow-sm flex items-center justify-center space-x-1.5 transition-all min-h-[44px] whitespace-nowrap"
                >
                  <span>Staff Sign In</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </div>

            </div>

          </div>
        </section>

        {/* 6 PROBLEM CATEGORIES */}
        <section id="problems" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">{t('features')} & {t('category')}</h2>
            <p className="text-xs sm:text-sm text-gray-500">{t('tagline')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { rawName: 'Garbage & Waste', key: 'categoryGarbageWaste', icon: '🚮' },
              { rawName: 'Road Damage', key: 'categoryRoadDamage', icon: '🛣️' },
              { rawName: 'Streetlight', key: 'categoryStreetlight', icon: '💡' },
              { rawName: 'Water Leakage', key: 'categoryWaterLeakage', icon: '💧' },
              { rawName: 'Drainage & Sewage', key: 'categoryDrainageSewage', icon: '🌧️' },
              { rawName: 'Traffic Signal', key: 'categoryTrafficSignal', icon: '🚦' }
            ].map((cat, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:border-emerald-500 hover:bg-emerald-50/20 transition-all space-y-3"
              >
                <div className="text-3xl">{cat.icon}</div>
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">{translateCategory(cat.rawName)}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{t(cat.key)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA BANNER */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-emerald-600 rounded-3xl p-8 sm:p-12 text-center text-white space-y-6 shadow-md">
            <h2 className="text-2xl sm:text-4xl font-extrabold font-outfit">{t('reportIssueNow')}</h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-xl mx-auto">
              {t('landingHeroSubtitle')}
            </p>
            <Link
              to="/citizen/portal"
              className="inline-flex items-center space-x-2 px-8 py-3.5 rounded-2xl bg-white text-emerald-700 font-extrabold text-xs uppercase tracking-wider shadow-sm hover:bg-emerald-50 transition-colors min-h-[44px]"
            >
              <span>{t('reportComplaint')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
};
