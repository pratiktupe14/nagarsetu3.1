import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGE_OPTIONS, SupportedLanguage } from '../utils/i18n';
import { Globe, ChevronDown, Check } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'compact' | 'dropdown' | 'full';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'compact',
  className = ''
}) => {
  const { lang, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOption = LANGUAGE_OPTIONS.find((opt) => opt.code === lang) || LANGUAGE_OPTIONS[0];

  if (variant === 'full') {
    return (
      <div className={`space-y-3 ${className}`}>
        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
          Preferred Language
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LANGUAGE_OPTIONS.map((opt) => {
            const isSelected = lang === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => changeLanguage(opt.code)}
                aria-pressed={isSelected}
                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20 font-semibold shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="block text-sm font-medium">{opt.nativeLabel}</span>
                    {opt.code !== 'en' && (
                      <span className="block text-xs text-gray-500">({opt.label})</span>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 ${className}`}>
        {LANGUAGE_OPTIONS.map((opt) => {
          const isSelected = lang === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => changeLanguage(opt.code)}
              aria-pressed={isSelected}
              title={opt.label}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              {opt.nativeLabel}
            </button>
          );
        })}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Select Preferred Language"
        className="inline-flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
      >
        <Globe className="w-3.5 h-3.5 text-emerald-600" />
        <span>{currentOption.nativeLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="origin-top-right absolute right-0 mt-2 w-44 rounded-xl shadow-lg bg-white border border-gray-100 ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1">
            {LANGUAGE_OPTIONS.map((opt) => {
              const isSelected = lang === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => {
                    changeLanguage(opt.code);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-700 font-bold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  role="menuitem"
                >
                  <span className="flex items-center space-x-2">
                    <span>{opt.nativeLabel}</span>
                    {opt.code !== 'en' && <span className="text-gray-400 font-normal">({opt.label})</span>}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
