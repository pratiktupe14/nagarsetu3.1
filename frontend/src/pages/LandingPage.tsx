import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight, User, Camera, MapPin, Building2,
  CheckCircle2, Clock, MessageSquare, ArrowUpRight,
  Send, ShieldCheck, Megaphone
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { t, translateCategory } = useLanguage();
  const { user } = useAuth();

  const reportTarget = user ? '/citizen/report' : '/login?role=citizen';

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-between">
      <Navbar />

      <main className="space-y-20 pb-16">
        
        {/* CLASSIC HERO SECTION */}
        <section className="pt-12 pb-16 bg-slate-50/60 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold font-mono uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Official Municipal Civic Grievance Portal</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight font-outfit max-w-4xl mx-auto leading-tight">
              Empowering Citizens. Building Better Cities.
            </h1>

            <p className="text-sm sm:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed font-medium">
              NagarSetu is the digital bridge connecting city residents directly with municipal authorities. Easily report potholes, garbage accumulation, streetlight outages, and water leaks for fast, transparent resolution.
            </p>

            {/* CITIZEN ACTION MODULE */}
            <div className="max-w-xl mx-auto pt-2">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6 text-left">
                
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">Citizen Civic Portal</h3>
                    <p className="text-xs text-gray-500 font-medium">Submit grievances, monitor repair status, and rate completed work</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    to={reportTarget}
                    className="py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-xs flex items-center justify-center space-x-2 transition-colors min-h-[46px]"
                  >
                    <span>Report Civic Issue</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    to="/login?role=citizen"
                    className="py-3.5 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-800 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors min-h-[46px]"
                  >
                    <span>Citizen Sign In</span>
                    <ArrowUpRight className="w-4 h-4 text-gray-500" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* HOW IT WORKS (CLASSIC 4-STEP PROCESS) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              How NagarSetu Works
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              A direct, transparent 4-step process from citizen report to official resolution
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: 'Step 1',
                title: 'Submit Complaint',
                desc: 'Upload a photo, describe the issue, and confirm your location on the interactive map.',
                icon: Camera
              },
              {
                step: 'Step 2',
                title: 'Direct Dispatch',
                desc: 'The complaint is automatically categorized and sent directly to the responsible municipal department.',
                icon: Building2
              },
              {
                step: 'Step 3',
                title: 'Field Action',
                desc: 'Department heads assign maintenance crews to inspect and repair the reported defect.',
                icon: Clock
              },
              {
                step: 'Step 4',
                title: 'Verified Resolution',
                desc: 'Receive live notifications and photo proof upon job completion, then rate the resolution.',
                icon: CheckCircle2
              }
            ].map((item, idx) => {
              const StepIcon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs hover:border-emerald-500 transition-colors space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                      {item.step}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* KEY PLATFORM FEATURES */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              Built for Citizen Convenience & Transparency
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              Modern digital tools ensuring civic issues get addressed promptly and fairly
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'GPS & Photo Support',
                desc: 'Pinpoint precise defect locations with live GPS tagging and EXIF photo validation.',
                icon: MapPin
              },
              {
                title: 'Direct Department Reach',
                desc: 'Bypasses manual paperwork by routing complaints directly to official department officers.',
                icon: Building2
              },
              {
                title: 'Real-Time Status Tracking',
                desc: 'Track complaint progress live from submission to crew assignment and final repair.',
                icon: Clock
              },
              {
                title: 'Verified Photo Proof',
                desc: 'Maintenance staff submit mandatory "After" photos before closing any reported issue.',
                icon: CheckCircle2
              },
              {
                title: 'Citizen Feedback & Ratings',
                desc: 'Rate the quality of municipal repair work to ensure ongoing service standards.',
                icon: MessageSquare
              },
              {
                title: 'Public Civic Announcements',
                desc: 'Stay informed about local ward updates, planned maintenance drives, and city alerts.',
                icon: Megaphone
              }
            ].map((feat, idx) => {
              const FeatIcon = feat.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs hover:border-emerald-500 transition-colors space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                    <FeatIcon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">{feat.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* MUNICIPAL CATEGORIES */}
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
                className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs hover:border-emerald-500 transition-colors space-y-3"
              >
                <div className="text-3xl">{cat.icon}</div>
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">{translateCategory(cat.rawName)}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{t(cat.key)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CALL TO ACTION BANNER */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-emerald-700 rounded-3xl p-8 sm:p-12 text-center text-white space-y-6 shadow-sm">
            <h2 className="text-2xl sm:text-4xl font-extrabold font-outfit">Take Action for Your Neighborhood Today</h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-xl mx-auto leading-relaxed">
              Report civic defects in seconds and help municipal teams build a cleaner, safer, and better-maintained city.
            </p>
            <Link
              to={reportTarget}
              className="inline-flex items-center space-x-2 px-8 py-3.5 rounded-xl bg-white text-emerald-800 font-extrabold text-xs uppercase tracking-wider shadow-xs hover:bg-emerald-50 transition-colors min-h-[46px]"
            >
              <span>Report a Civic Issue</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
};
