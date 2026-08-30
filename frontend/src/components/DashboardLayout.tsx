import React, { useState, useEffect, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { DashboardHeader } from './DashboardHeader';
import { Footer } from './Footer';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title = 'Dashboard' }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.title = `NAGARSETU — ${title}`;
  }, [title]);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('nagarsetu_sidebar_collapsed');
    return saved === 'true';
  });

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('nagarsetu_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      
      {/* REUSABLE SIDEBAR */}
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* MAIN CONTAINER (Adjusts margin based on desktop sidebar collapse state) */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        {/* REUSABLE DASHBOARD HEADER */}
        <DashboardHeader
          title={title}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />

        {/* MAIN PAGE CONTENT */}
        <main className="flex-1 w-full bg-white">
          {children}
        </main>

        <Footer />
      </div>

    </div>
  );
};
