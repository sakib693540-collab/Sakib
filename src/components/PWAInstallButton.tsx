import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  X,
  CheckCircle2,
  WifiOff,
  Terminal,
  ShieldCheck,
  Layers,
  Share2,
} from 'lucide-react';
import { TranslationStrings } from '../i18n/translations';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallButtonProps {
  onOpenAndroidGuide: () => void;
  t: TranslationStrings;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenAndroidGuide,
  t,
}) => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      onOpenAndroidGuide();
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {!isInstalled && (
        <button
          onClick={handleInstallClick}
          className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#168653] hover:bg-[#126E44] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          title={t.installAppBtn}
          aria-label={t.installAppBtn}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{t.installAppBtn}</span>
          <span className="sm:hidden">PWA</span>
        </button>
      )}

      <button
        onClick={onOpenAndroidGuide}
        className="px-2.5 py-1.5 rounded-xl bg-[#EAD8B8] hover:bg-[#DFC9A2] border border-[#C6A279] text-[#4A2E1B] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        title={t.androidApkBtn}
        aria-label={t.androidApkBtn}
      >
        <Smartphone className="w-3.5 h-3.5 text-[#168653] shrink-0" />
        <span className="hidden md:inline">{t.androidApkBtn}</span>
      </button>
    </div>
  );
};

interface OfflineIndicatorProps {
  t: TranslationStrings;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ t }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[#FFF4E5] border-b border-[#E6B87D] px-4 py-2 text-xs font-semibold text-[#7A440E] flex flex-wrap items-center justify-center gap-2 text-center"
    >
      <WifiOff className="w-4 h-4 text-[#D97706] shrink-0" />
      <span className="font-bold">{t.offlineTitle}:</span>
      <span>{t.offlineDesc}</span>
    </div>
  );
};

interface AndroidGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: TranslationStrings;
}

export const AndroidGuideModal: React.FC<AndroidGuideModalProps> = ({
  isOpen,
  onClose,
  t,
}) => {
  const [activeTab, setActiveTab] = useState<'install' | 'debug' | 'release'>(
    'install'
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
  }, []);

  if (!isOpen) return null;

  const handleTriggerPrompt = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2D1B0E]/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#FDF7EC] border-2 border-[#98643D] shadow-2xl overflow-hidden text-[#3D2516]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-[#EAD8B8] to-[#F5E8CF] border-b border-[#D5BC96] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#168653] text-white flex items-center justify-center shadow-xs shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-[#3D2516] truncate">
                {t.androidGuideTitle}
              </h3>
              <p className="text-xs text-[#6E472B] truncate">
                {t.androidGuideSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t.closeBtn}
            className="p-1.5 rounded-xl bg-[#EAD8B8] hover:bg-[#DFC9A2] text-[#4A2E1B] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-6 pt-3 bg-[#F5E8CF] border-b border-[#DEC6A1] flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('install')}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'install'
                ? 'bg-[#FDF7EC] text-[#168653] border-[#168653]'
                : 'text-[#6E472B] border-transparent hover:text-[#3D2516]'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span>{t.androidTabInstall}</span>
          </button>

          <button
            onClick={() => setActiveTab('debug')}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'debug'
                ? 'bg-[#FDF7EC] text-[#168653] border-[#168653]'
                : 'text-[#6E472B] border-transparent hover:text-[#3D2516]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 shrink-0" />
            <span>{t.androidTabDebug}</span>
          </button>

          <button
            onClick={() => setActiveTab('release')}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'release'
                ? 'bg-[#FDF7EC] text-[#168653] border-[#168653]'
                : 'text-[#6E472B] border-transparent hover:text-[#3D2516]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{t.androidTabRelease}</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm leading-relaxed">
          {activeTab === 'install' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#E8F8F0] border border-[#A5DFC4] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-[#0E5C38] flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#168653] shrink-0" />
                    <span>{t.androidWebApkTitle}</span>
                  </div>
                  {isStandalone ? (
                    <span className="px-2.5 py-1 rounded-lg bg-[#168653] text-white text-xs font-bold">
                      {t.androidInstalledBadge}
                    </span>
                  ) : (
                    deferredPrompt && (
                      <button
                        onClick={handleTriggerPrompt}
                        className="px-3 py-1.5 rounded-lg bg-[#168653] hover:bg-[#126E44] text-white text-xs font-bold cursor-pointer"
                      >
                        {t.androidInstallNowBtn}
                      </button>
                    )
                  )}
                </div>
                <p className="text-[#1D5B3E] text-xs">{t.androidWebApkDesc}</p>
                <div className="pt-1 space-y-1">
                  <div className="font-bold text-xs text-[#0E5C38]">
                    {t.androidManualTitle}
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-[#2B4C3B] font-medium">
                    <li>{t.androidManualStep1}</li>
                    <li>{t.androidManualStep2}</li>
                    <li>{t.androidManualStep3}</li>
                    <li>{t.androidManualStep4}</li>
                  </ol>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F5E8CF] border border-[#D8C09A] space-y-2">
                <div className="font-bold text-[#4A2E1B] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#98643D] shrink-0" />
                  <span>{t.androidConfigTitle}</span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#5C3A21] pt-1">
                  <li className="p-2.5 rounded-xl bg-[#FDF7EC] border border-[#E2CCA8]">
                    <span className="font-bold block text-[#3D2516]">App Name:</span>
                    ষোলো গুটি - Sholo Guti
                  </li>
                  <li className="p-2.5 rounded-xl bg-[#FDF7EC] border border-[#E2CCA8]">
                    <span className="font-bold block text-[#3D2516]">Package ID:</span>
                    com.bangla.shologuti
                  </li>
                  <li className="p-2.5 rounded-xl bg-[#FDF7EC] border border-[#E2CCA8]">
                    <span className="font-bold block text-[#3D2516]">Theme / Splash:</span>
                    #98643D / #F5E8CF
                  </li>
                  <li className="p-2.5 rounded-xl bg-[#FDF7EC] border border-[#E2CCA8]">
                    <span className="font-bold block text-[#3D2516]">Native Wrapper:</span>
                    Capacitor 8 (/android)
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF3E4] border border-[#D8C09A] space-y-1.5">
                <div className="font-bold text-xs text-[#3D2516]">
                  {t.androidCloudTitle}
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-[#5C3A21]">
                  <li>{t.androidCloudItem1}</li>
                  <li>{t.androidCloudItem2}</li>
                  <li>{t.androidCloudItem3}</li>
                  <li>{t.androidCloudItem4}</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'debug' && (
            <div className="space-y-3.5">
              <p className="text-xs text-[#5C3A21]">{t.androidDebugIntro}</p>

              <div className="space-y-2">
                <div className="font-bold text-xs text-[#3D2516]">
                  {t.androidDebugStep1}
                </div>
                <pre className="p-3 rounded-xl bg-[#2B1B10] text-[#F5E8CF] font-mono text-xs overflow-x-auto">
{`npm install
npm run build
npx cap sync android`}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-xs text-[#3D2516]">
                  {t.androidDebugStep2}
                </div>
                <pre className="p-3 rounded-xl bg-[#2B1B10] text-[#F5E8CF] font-mono text-xs overflow-x-auto">
{`npx cap open android
cd android && ./gradlew assembleDebug`}
                </pre>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F5E8CF] border border-[#D8C09A] text-xs space-y-1">
                <div className="font-bold text-[#3D2516]">
                  {t.androidDebugOut}
                </div>
                <code className="block text-[#168653] font-mono break-all">
                  android/app/build/outputs/apk/debug/app-debug.apk
                </code>
                <p className="text-[#5C3A21] pt-1">{t.androidDebugStep3}</p>
              </div>
            </div>
          )}

          {activeTab === 'release' && (
            <div className="space-y-3.5">
              <p className="text-xs text-[#5C3A21]">{t.androidReleaseIntro}</p>

              <div className="space-y-1.5">
                <div className="font-bold text-xs text-[#3D2516]">
                  {t.androidReleaseStep1}
                </div>
                <pre className="p-3 rounded-xl bg-[#2B1B10] text-[#F5E8CF] font-mono text-xs overflow-x-auto">
{`keytool -genkey -v -keystore sholo-guti-release.keystore \\
  -alias shologuti -keyalg RSA -keysize 2048 -validity 10000`}
                </pre>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-xs text-[#3D2516]">
                  {t.androidReleaseStep2}
                </div>
                <pre className="p-3 rounded-xl bg-[#2B1B10] text-[#F5E8CF] font-mono text-xs overflow-x-auto">
{`npm run build
npx cap sync android
cd android && ./gradlew assembleRelease`}
                </pre>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FFF6EB] border border-[#E6B88A] text-xs space-y-1">
                <div className="font-bold text-[#8A4B16]">
                  {t.androidReleaseNoteTitle}
                </div>
                <p className="text-[#6E472B]">{t.androidReleaseNoteBody}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-[#F5E8CF] border-t border-[#DEC6A1] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#98643D] hover:bg-[#7F512F] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
