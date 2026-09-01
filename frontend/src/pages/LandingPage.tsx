import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles, ArrowRight, User, Camera, MapPin, Cpu, Building2,
  CheckCircle2, Clock, MessageSquare, ArrowUpRight,
  Send, Layers, Eye
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { t, translateCategory } = useLanguage();
  const { user } = useAuth();

  const reportTarget = user ? '/citizen/report' : '/login?role=citizen';

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-between">
      <Navbar />

      <main className="space-y-20 pb-16">
        
        {/* HERO SECTION */}
        <section className="relative pt-12 pb-16 bg-gradient-to-b from-emerald-50/40 via-white to-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>NAGARSETU — Citizen–Government Digital Bridge</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight font-outfit max-w-5xl mx-auto leading-tight">
              Connecting Citizens with City Governance for Faster Issue Resolution
            </h1>

            <p className="text-sm sm:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed font-medium">
              NagarSetu acts as a digital bridge between citizens and government. Citizens can easily report civic issues with photos, description and live location, while municipal authorities receive, categorize, assign, track, and resolve those issues transparently.
            </p>

            {/* CITIZEN ACTION MODULE */}
            <div className="max-w-2xl mx-auto pt-4">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200/90 shadow-lg space-y-6 text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900 font-outfit">Citizen Civic Portal</h3>
                    <p className="text-xs text-gray-500 font-medium">Report civic issues, track complaint progress & submit feedback</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <Link
                    to={reportTarget}
                    className="py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all min-h-[48px]"
                  >
                    <span>Report Civic Issue</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    to="/login?role=citizen"
                    className="py-3.5 px-5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all min-h-[48px]"
                  >
                    <span>Citizen Sign In</span>
                    <ArrowUpRight className="w-4 h-4 text-gray-500" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* HOW NAGARSETU WORKS (LIFECYCLE FLOW) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
              <span>Transparent 5-Step Lifecycle</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 font-outfit">
              How NagarSetu Works
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 font-medium">
              Citizen → NagarSetu → Government Department → Resolution → Citizen
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {[
              {
                step: '01',
                title: 'Citizen Reports',
                desc: 'Upload photo with live GPS location & issue description.',
                icon: Camera,
                badge: 'Citizen'
              },
              {
                step: '02',
                title: 'NagarSetu AI',
                desc: 'Smart issue categorization & automated department routing.',
                icon: Cpu,
                badge: 'NagarSetu'
              },
              {
                step: '03',
                title: 'Govt Department',
                desc: 'Department Head reviews complaint & assigns field staff.',
                icon: Building2,
                badge: 'Government'
              },
              {
                step: '04',
                title: 'Field Resolution',
                desc: 'Maintenance staff resolves defect & uploads photo proof.',
                icon: CheckCircle2,
                badge: 'Resolution'
              },
              {
                step: '05',
                title: 'Citizen Feedback',
                desc: 'Real-time status tracking, notification & star feedback.',
                icon: MessageSquare,
                badge: 'Citizen'
              }
            ].map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={index}
                  className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-mono font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {item.step}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 block font-mono">
                        {item.badge}
                      </span>
                      <h3 className="text-sm font-extrabold text-gray-900 font-outfit mt-0.5">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* KEY PLATFORM FEATURES */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 font-outfit">
              Key Platform Features
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 font-medium">
              Empowering citizens with seamless civic reporting and complete transparency
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Easy Civic Issue Reporting',
                desc: 'Report potholes, garbage, water leaks, and street lights in seconds from any device.',
                icon: Send
              },
              {
                title: 'Photo, Location & Description Support',
                desc: 'Live GPS location tagging, EXIF photo validation, and interactive map pin-point accuracy.',
                icon: MapPin
              },
              {
                title: 'Smart Issue Categorization',
                desc: 'Automated defect classification and exact municipal department routing.',
                icon: Layers
              },
              {
                title: 'Direct Connection with Concerned Authorities',
                desc: 'Links issue reports directly to designated department officers and field maintenance staff.',
                icon: Building2
              },
              {
                title: 'Real-Time Complaint Status Tracking',
                desc: 'Track complaint progress live from pending to assigned, in-progress, and resolved.',
                icon: Clock
              },
              {
                title: 'Transparent Resolution Process',
                desc: 'Field staff upload verified photo proof before completing and resolving complaints.',
                icon: Eye
              },
              {
                title: 'Better Citizen–Government Communication',
                desc: 'Direct citizen feedback ratings, municipal announcements, and service transparency.',
                icon: MessageSquare
              }
            ].map((feat, idx) => {
              const FeatIcon = feat.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-md hover:border-emerald-500/50 transition-all space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <FeatIcon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">{feat.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
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
              NagarSetu bridges the gap between citizens and municipal authorities. Report civic issues in seconds.
            </p>
            <Link
              to={reportTarget}
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
