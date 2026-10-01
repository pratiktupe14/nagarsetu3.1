import React, { useState, useEffect, ReactNode, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DashboardHeader } from './DashboardHeader';
import { Footer } from './Footer';
import { ForcePasswordChangeModal } from './ForcePasswordChangeModal';

import { useLanguage } from '../context/LanguageContext';

interface LayoutContextType {
  isInside: boolean;
  setTitle: (title: string) => void;
}

const DashboardLayoutContext = createContext<LayoutContextType | null>(null);

interface DashboardLayoutProps {
  children?: ReactNode;
  title?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const { t } = useLanguage();
  const parentLayout = useContext(DashboardLayoutContext);
  const [currentTitle, setCurrentTitle] = useState(() => title || t('dashboard'));

  useEffect(() => {
    if (parentLayout) {
      if (title) {
        parentLayout.setTitle(title);
      }
    } else {
      if (title) {
        setCurrentTitle(title);
      } else {
        setCurrentTitle(t('dashboard'));
      }
    }
  }, [parentLayout, title, t]);

  useEffect(() => {
    const activeTitle = parentLayout ? title : currentTitle;
    if (activeTitle) {
      document.title = `NAGARSETU — ${activeTitle}`;
    }
  }, [parentLayout, title, currentTitle]);

  const [mobileOpen, setMobileOpen] = useState(false);

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

  // If already rendered inside an active parent DashboardLayout, render content directly
  if (parentLayout?.isInside) {
    return <>{children || <Outlet />}</>;
  }

  return (
    <DashboardLayoutContext.Provider value={{ isInside: true, setTitle: setCurrentTitle }}>
      <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
        <ForcePasswordChangeModal />
        
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
            title={currentTitle}
            onMobileMenuOpen={() => setMobileOpen(true)}
            isMobileMenuOpen={mobileOpen}
          />

          {/* MAIN PAGE CONTENT */}
          <main className="flex-1 w-full bg-white transition-opacity duration-150">
            {children || <Outlet />}
          </main>

          <Footer />
        </div>

      </div>
    </DashboardLayoutContext.Provider>
  );
};

