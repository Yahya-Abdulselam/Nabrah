'use client';

import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';

/**
 * Language Switcher Component
 *
 * Toggles between English and Arabic languages.
 * - Shows current language (not the opposite)
 * - Button stays in same position (fixed width)
 * - Updates localStorage and entire UI
 */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const handleToggle = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      className="flex items-center gap-2 min-w-[100px]"
      aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
    >
      <Globe className="h-4 w-4" />
      <span className="text-sm font-medium">
        {language === 'en' ? 'English' : 'العربية'}
      </span>
    </Button>
  );
}
