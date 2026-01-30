/**
 * i18n System for Nabrah
 *
 * Lightweight custom implementation without external dependencies
 * Supports English (en) and Arabic (ar) with RTL layout
 */

'use client';

import * as React from 'react';
import { en } from './en';
import { ar } from './ar';
import { Translations, Language } from './types';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const translations: Record<Language, Translations> = { en, ar };

const LanguageContext = React.createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>('en');

  // Load language preference from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem('nabrah-language') as Language;
    if (stored && (stored === 'en' || stored === 'ar')) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('nabrah-language', lang);

    // Update document direction
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, []);

  /**
   * Translation function
   * Supports nested keys with dot notation: t('common.appName')
   */
  const t = React.useCallback((key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation missing for key: ${key} in language: ${language}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key ${key} does not resolve to a string`);
      return key;
    }

    return value;
  }, [language]);

  const dir: 'ltr' | 'rtl' = language === 'ar' ? 'rtl' : 'ltr';

  const contextValue = React.useMemo(
    () => ({ language, setLanguage, t, dir }),
    [language, setLanguage, t, dir]
  );

  return React.createElement(
    LanguageContext.Provider,
    { value: contextValue },
    children
  );
}

/**
 * Hook to access language context
 * Must be used within LanguageProvider
 */
export const useLanguage = () => {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

// Export types for external use
export type { Language, Translations } from './types';
