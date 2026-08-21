import React from 'react';
import { Shield } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
        
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-gray-900 font-outfit">NAGARSETU 3.0</span>
          <span className="text-gray-400">•</span>
          <span>AI-Powered Municipal Governance Platform</span>
        </div>

        <div className="flex items-center space-x-6 text-gray-500 font-medium">
          <a href="#" className="hover:text-emerald-700">Privacy Policy</a>
          <a href="#" className="hover:text-emerald-700">Terms of Service</a>
          <a href="#" className="hover:text-emerald-700">Municipal Helpdesk</a>
        </div>

        <div className="text-gray-400 font-mono text-[11px]">
          © {new Date().getFullYear()} NAGARSETU Tech. All rights reserved.
        </div>

      </div>
    </footer>
  );
};
