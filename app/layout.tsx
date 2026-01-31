'use client';

import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { LanguageProvider, useLanguage } from "@/lib/i18n";
import { ServiceWorkerRegistration } from "./sw-register";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { SyncProgress } from "@/components/SyncProgress";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

function RootLayoutInner({ children }: { children: React.ReactNode }) {
  const { dir, language } = useLanguage();

  return (
    <html lang={language} dir={dir} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme and language */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('nabrah-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }

                  var lang = localStorage.getItem('nabrah-language') || 'en';
                  document.documentElement.lang = lang;
                  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
                } catch (e) {}
              })();
            `,
          }}
        />

        {/* Basic Meta Tags */}
        <title>Nabrah - Emergency Voice Triage</title>
        <meta
          name="description"
          content="5-second voice analysis for emergency triage. Detect speech abnormalities and get RED/YELLOW/GREEN recommendations instantly."
        />
        <meta name="application-name" content="Nabrah" />
        <meta name="keywords" content="emergency, triage, voice analysis, medical, health, stroke detection, speech analysis" />

        {/* PWA Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Nabrah" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Icons */}
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />

        {/* iOS Splash Screens (optional - can be generated later) */}
        {/*
        <link rel="apple-touch-startup-image" href="/splash/iphone5.png" media="(device-width: 320px) and (device-height: 568px)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone6.png" media="(device-width: 375px) and (device-height: 667px)" />
        */}

        {/* Open Graph Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Nabrah - Emergency Voice Triage" />
        <meta property="og:description" content="5-second voice analysis for emergency triage" />
        <meta property="og:image" content="/icons/icon-512.png" />
        <meta property="og:site_name" content="Nabrah" />

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Nabrah - Emergency Voice Triage" />
        <meta name="twitter:description" content="5-second voice analysis for emergency triage" />
        <meta name="twitter:image" content="/icons/icon-512.png" />
      </head>
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          ${notoArabic.variable}
          ${language === 'ar' ? 'font-arabic' : ''}
          antialiased
        `}
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
        <OfflineIndicator />
        <SyncProgress />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LanguageProvider>
      <RootLayoutInner>{children}</RootLayoutInner>
    </LanguageProvider>
  );
}
