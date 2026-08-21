import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Shield, Camera, MapPin, Sparkles, CheckCircle2, Clock, Users,
  Building2, ArrowRight, Activity, Cpu, Bell, CheckSquare, FileText, User, Wrench
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-between">
      <Navbar />

      <main className="space-y-16 pb-16">
        
        {/* HERO & DIRECT PORTAL ACCESS CARDS */}
        <section className="relative pt-10 pb-12 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>NAGARSETU 3.0 — Direct Access Civic Platform</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight font-outfit max-w-4xl mx-auto leading-tight">
              AI-Powered Municipal Management & Bridge Tech
            </h1>

            <p className="text-xs sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Select your portal below to directly access municipal reporting, city command center triage, or field service operations.
            </p>

            {/* 3 DIRECT PORTAL CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto pt-4 text-left">
              
              {/* CITIZEN PORTAL */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 hover:border-emerald-500 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">CITIZEN PORTAL</h3>
                    <p className="text-xs text-gray-600 mt-1">Report civic issues and track complaints.</p>
                  </div>
                </div>

                <Link
                  to="/citizen/portal"
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all min-h-[44px]"
                >
                  <span>Open Citizen Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* CITY ADMIN PORTAL */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 hover:border-blue-500 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">CITY ADMIN PORTAL</h3>
                    <p className="text-xs text-gray-600 mt-1">Manage complaints and city operations.</p>
                  </div>
                </div>

                <Link
                  to="/admin/portal"
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all min-h-[44px]"
                >
                  <span>Open City Admin Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* SERVICE STAFF PORTAL */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 hover:border-amber-500 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                    <Wrench className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">SERVICE STAFF PORTAL</h3>
                    <p className="text-xs text-gray-600 mt-1">View assigned tasks and update service progress.</p>
                  </div>
                </div>

                <Link
                  to="/staff/portal"
                  className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all min-h-[44px]"
                >
                  <span>Open Service Staff Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

            </div>

          </div>
        </section>

        {/* 6 PROBLEM CATEGORIES */}
        <section id="problems" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">Supported Civic Issue Domains</h2>
            <p className="text-xs sm:text-sm text-gray-500">Report any municipal defect across these core urban service domains</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Garbage & Waste Accumulation', desc: 'Uncollected trash heaps, overflowing public dustbins, and organic waste.', icon: '🚮' },
              { title: 'Potholes & Road Damage', desc: 'Asphalt craters, cracked pavement, and hazardous road surface depressions.', icon: '🛣️' },
              { title: 'Broken Streetlights', desc: 'Non-functional luminaires causing darkness and pedestrian safety risks.', icon: '💡' },
              { title: 'Water Leakage & Pipeline Rupture', desc: 'Substantial clean water main leaks and street inundation.', icon: '💧' },
              { title: 'Drainage & Sewage Overflow', desc: 'Blocked storm sewers spilling wastewater onto public walkways.', icon: '🌧️' },
              { title: 'Traffic Signal Malfunctions', desc: 'Blinking or offline signals creating vehicle bottlenecks.', icon: '🚦' }
            ].map((cat, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:border-emerald-500 hover:bg-emerald-50/20 transition-all space-y-3"
              >
                <div className="text-3xl">{cat.icon}</div>
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">{cat.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{cat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA BANNER */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-emerald-600 rounded-3xl p-8 sm:p-12 text-center text-white space-y-6 shadow-md">
            <h2 className="text-2xl sm:text-4xl font-extrabold font-outfit">Ready to Report a Civic Issue?</h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-xl mx-auto">
              Join thousands of citizens making cities cleaner, safer, and smarter with NAGARSETU 3.0.
            </p>
            <Link
              to="/citizen/portal"
              className="inline-flex items-center space-x-2 px-8 py-3.5 rounded-2xl bg-white text-emerald-700 font-extrabold text-xs uppercase tracking-wider shadow-sm hover:bg-emerald-50 transition-colors min-h-[44px]"
            >
              <span>Launch Citizen Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
};
