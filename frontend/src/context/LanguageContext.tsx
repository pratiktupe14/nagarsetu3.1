import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SupportedLanguage, t as tFunction, translateStatus as translateStatusFn, translateCategory as translateCategoryFn, translatePriority as translatePriorityFn, translateDepartment as translateDepartmentFn } from '../utils/i18n';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface LanguageContextType {
  lang: SupportedLanguage;
  changeLanguage: (newLang: SupportedLanguage) => Promise<void>;
  t: (key: string) => string;
  translateStatus: (status?: string) => string;
  translateCategory: (category?: string) => string;
  translatePriority: (priority?: string) => string;
  translateDepartment: (department?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const user = auth?.user;

  const [lang, setLang] = useState<SupportedLanguage>(() => {
    const savedUserPref = user?.language_pref as SupportedLanguage;
    if (savedUserPref && ['en', 'hi', 'mr'].includes(savedUserPref)) {
      return savedUserPref;
    }
    const savedLocal = localStorage.getItem('nagarsetu_lang') as SupportedLanguage;
    if (savedLocal && ['en', 'hi', 'mr'].includes(savedLocal)) {
      return savedLocal;
    }
    return 'en';
  });

  // Sync state if user changes in AuthContext or has loaded profile preference
  useEffect(() => {
    if (user?.language_pref && ['en', 'hi', 'mr'].includes(user.language_pref)) {
      const userLang = user.language_pref as SupportedLanguage;
      if (userLang !== lang) {
        setLang(userLang);
        localStorage.setItem('nagarsetu_lang', userLang);
      }
    }
  }, [user?.id, user?.language_pref]);

  const changeLanguage = async (newLang: SupportedLanguage) => {
    if (!['en', 'hi', 'mr'].includes(newLang)) return;
    
    setLang(newLang);
    localStorage.setItem('nagarsetu_lang', newLang);

    // Save to user object in AuthContext and Supabase if authenticated user
    if (user && user.id) {
      if (user.language_pref !== newLang) {
        user.language_pref = newLang;
        const updatedUser = { ...user, language_pref: newLang };
        localStorage.setItem('nagarsetu_user', JSON.stringify(updatedUser));
      }

      if (isSupabaseConfigured()) {
        try {
          await supabase
            .from('profiles')
            .update({ language_pref: newLang })
            .eq('id', user.id);
        } catch (err) {
          console.warn('Could not persist preferred_language to Supabase profile:', err);
        }
      }
    }
  };

  const t = (key: string): string => tFunction(key, lang);
  const translateStatus = (status?: string): string => translateStatusFn(status, lang);
  const translateCategory = (category?: string): string => translateCategoryFn(category, lang);
  const translatePriority = (priority?: string): string => translatePriorityFn(priority, lang);
  const translateDepartment = (department?: string): string => translateDepartmentFn(department, lang);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        changeLanguage,
        t,
        translateStatus,
        translateCategory,
        translatePriority,
        translateDepartment
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback safe dummy context if used outside provider during initialization
    return {
      lang: 'en',
      changeLanguage: async () => {},
      t: (key: string) => tFunction(key, 'en'),
      translateStatus: (status?: string) => translateStatusFn(status, 'en'),
      translateCategory: (category?: string) => translateCategoryFn(category, 'en'),
      translatePriority: (priority?: string) => translatePriorityFn(priority, 'en'),
      translateDepartment: (department?: string) => translateDepartmentFn(department, 'en')
    };
  }
  return context;
};
