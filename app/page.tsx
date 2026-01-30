'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, Activity, AlertCircle, ClipboardList, Waves, Heart, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n';

// Reusable scroll-triggered animation wrapper
function ScrollReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { t, language } = useLanguage();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden transition-colors duration-300">
      {/* Ambient background orbs */}
      <div className="ambient-orb orb-red absolute -top-32 -left-32 md:-top-40 md:-left-40" />
      <div className="ambient-orb orb-yellow absolute top-1/4 -right-16 md:-right-20" />
      <div className="ambient-orb orb-green absolute bottom-1/4 -left-20 md:left-1/4" />

      {/* Top Bar with Theme Toggle and Language Switcher */}
      <div className="fixed z-50 flex gap-2 ltr-force" style={{ top: '1rem', right: '1rem' }}>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          {/* Logo/Title */}
          <div className="mb-6">
            <h1 className={`text-6xl md:text-8xl font-black tracking-tight text-slate-900 dark:text-white mb-3 ${language === 'ar' ? 'font-arabic' : ''}`}>
              {t('common.appName')}
            </h1>
            <p className={`text-2xl md:text-3xl text-indigo-600 dark:text-indigo-400 font-medium tracking-wide ${language === 'ar' ? 'font-arabic' : ''}`}>
              {language === 'en' ? 'نبرة' : 'Nabrah'}
            </p>
          </div>

          {/* Sound Wave Visualization */}
          <div className="sound-wave sound-wave-medical my-8">
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
          </div>

          {/* Tagline */}
          <p className={`text-2xl md:text-4xl text-slate-800 dark:text-slate-100 mb-4 font-semibold tracking-tight ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t('home.tagline')}
          </p>

          <p className={`text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t('home.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => router.push('/check')}
              className="btn-shimmer cursor-pointer text-lg px-10 py-7 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-300 border-0"
            >
              <Mic className={`h-6 w-6 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {t('home.ctaButton')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/queue')}
              className="cursor-pointer text-lg px-10 py-7 border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
            >
              <ClipboardList className={`h-6 w-6 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {t('home.queueButton')}
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <div className={`flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full ${language === 'ar' ? 'font-arabic' : ''}`}>
              <Timer className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{t('home.stat1')}</span>
            </div>
            <div className={`flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full ${language === 'ar' ? 'font-arabic' : ''}`}>
              <Activity className="h-4 w-4 text-green-500" />
              <span className="font-medium">{t('home.stat2')}</span>
            </div>
          </div>
        </motion.div>
      </section>

      <div className="section-divider" />

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-12 md:py-16 relative z-10">
        <ScrollReveal>
          <h2 className={`text-3xl md:text-5xl font-bold tracking-tight text-center text-slate-900 dark:text-white mb-14 ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t('home.howItWorks')}
          </h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
          {/* Step 1 - Record */}
          <ScrollReveal delay={0.1} className="h-full">
            <Card className="h-full border-0 bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-slate-700 shadow-lg hover:shadow-xl hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20 hover:-translate-y-2 transition-all duration-300 group">
              <CardContent className="pt-8 pb-6 h-full flex flex-col">
                <div className="flex justify-center mb-5">
                  <div className="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-2xl p-5 group-hover:scale-110 transition-transform duration-300">
                    <Mic className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-center flex-1 flex flex-col">
                  <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-2">1</div>
                  <h3 className={`text-xl font-bold mb-3 text-slate-900 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.step1Title')}
                  </h3>
                  <p className={`text-slate-600 dark:text-slate-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.step1Desc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Step 2 - Analyze */}
          <ScrollReveal delay={0.2} className="h-full">
            <Card className="h-full border-0 bg-gradient-to-br from-white to-green-50 dark:from-slate-800 dark:to-slate-700 shadow-lg hover:shadow-xl hover:shadow-green-100/50 dark:hover:shadow-green-900/20 hover:-translate-y-2 transition-all duration-300 group">
              <CardContent className="pt-8 pb-6 h-full flex flex-col">
                <div className="flex justify-center mb-5">
                  <div className="bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-2xl p-5 group-hover:scale-110 transition-transform duration-300">
                    <Activity className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="text-center flex-1 flex flex-col">
                  <div className="text-3xl font-black text-green-600 dark:text-green-400 mb-2">2</div>
                  <h3 className={`text-xl font-bold mb-3 text-slate-900 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.step2Title')}
                  </h3>
                  <p className={`text-slate-600 dark:text-slate-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.step2Desc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          {/* Step 3 - Triage */}
          <ScrollReveal delay={0.3} className="h-full">
            <Card className="h-full border-0 bg-gradient-to-br from-white to-yellow-50 dark:from-slate-800 dark:to-slate-700 shadow-lg hover:shadow-xl hover:shadow-yellow-100/50 dark:hover:shadow-yellow-900/20 hover:-translate-y-2 transition-all duration-300 group">
              <CardContent className="pt-8 pb-6 h-full flex flex-col">
                <div className="flex justify-center mb-5">
                  <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900 dark:to-yellow-800 rounded-2xl p-5 group-hover:scale-110 transition-transform duration-300">
                    <AlertCircle className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
                <div className="text-center flex-1 flex flex-col">
                  <div className="text-3xl font-black text-yellow-600 dark:text-yellow-400 mb-2">3</div>
                  <h3 className={`text-xl font-bold mb-3 text-slate-900 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.step3Title')}
                  </h3>
                  <p className={`text-slate-600 dark:text-slate-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.step3Desc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Features Section */}
      <section className="container mx-auto px-4 py-12 md:py-16 relative z-10">
        <ScrollReveal>
          <div className="max-w-4xl mx-auto bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-xl">
            <h2 className={`text-3xl md:text-4xl font-bold tracking-tight text-center text-slate-900 dark:text-white mb-10 ${language === 'ar' ? 'font-arabic' : ''}`}>
              {t('home.featuresTitle')}
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <ScrollReveal delay={0.1} className="flex items-start gap-4">
                <div className="bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/50 dark:to-red-800/50 rounded-xl p-3 shrink-0">
                  <Waves className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className={`font-bold text-lg mb-1 text-slate-900 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.feature1Title')}
                  </h3>
                  <p className={`text-slate-600 dark:text-slate-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.feature1Desc')}
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={0.15} className="flex items-start gap-4">
                <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/50 dark:to-yellow-800/50 rounded-xl p-3 shrink-0">
                  <Activity className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className={`font-bold text-lg mb-1 text-slate-900 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.feature2Title')}
                  </h3>
                  <p className={`text-slate-600 dark:text-slate-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.feature2Desc')}
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={0.2} className="flex items-start gap-4">
                <div className="bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/50 dark:to-green-800/50 rounded-xl p-3 shrink-0">
                  <Timer className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className={`font-bold text-lg mb-1 text-slate-900 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.feature3Title')}
                  </h3>
                  <p className={`text-slate-600 dark:text-slate-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.feature3Desc')}
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={0.25} className="flex items-start gap-4">
                <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/50 dark:to-yellow-800/50 rounded-xl p-3 shrink-0">
                  <Heart className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className={`font-bold text-lg mb-1 text-slate-900 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.feature4Title')}
                  </h3>
                  <p className={`text-slate-600 dark:text-slate-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t('home.feature4Desc')}
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Medical Disclaimer */}
      <footer className="container mx-auto px-4 py-12 text-center relative z-10">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700">
              <AlertCircle className="h-8 w-8 text-slate-500 dark:text-slate-400 mx-auto mb-4" />
              <h3 className={`font-bold text-lg text-slate-900 dark:text-white mb-3 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('medical.disclaimer.title')}
              </h3>
              <p className={`text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('medical.disclaimer.text')} {t('medical.disclaimer.emergency')}
              </p>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-8">
              &copy; 2026 Nabrah. Built for emergency voice triage assistance.
            </p>
          </div>
        </ScrollReveal>
      </footer>
    </main>
  );
}
